// Bounces: tutto sta nel Dropbox di chi usa l'app, nella cartella Applicazioni/<app> che Dropbox crea al primo collegamento
// (l'app vede solo quella). Audio in /<Progetto>/<Brano>/V1.wav, dati (titoli, versioni, BPM, note, commenti) in
// /.bounces/libreria.json. Nessun server: accesso OAuth PKCE nel browser, il refresh token resta nel dispositivo.
// Questo file fa le veci del server di Inediti (stesse rotte /api/...), così app.js è quasi lo stesso.
'use strict'
const DROPBOX_CHIAVE = 'n4cc976oiv2lwlt'
const LIBRERIA = '/.bounces/libreria.json'
const CESTINO = '/.bounces/cestino'   // niente si cancella davvero: i file eliminati dall'app finiscono qui
const RITORNO = location.origin + location.pathname

const memo = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} },
}
function b64url(buf) {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
// Dropbox vuole l'argomento nell'intestazione HTTP: niente caratteri fuori ASCII (accenti dei titoli)
const argomento = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
const cacheLink = new Map(), attesaLink = new Set()

async function errore(r) {
  const t = await r.text()
  let j
  try { j = JSON.parse(t) } catch { j = { error_summary: t } }
  const e = new Error(j.error_summary || r.statusText)
  e.dbx = j
  e.stato = r.status
  return e
}

const Dbx = {
  token: null, scade: 0,
  collegato: () => !!memo.get('bounces-refresh'),

  async entra() {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)))
    sessionStorage.setItem('bounces-verifier', verifier)
    const sfida = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    location.href = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
      client_id: DROPBOX_CHIAVE, response_type: 'code', code_challenge: sfida, code_challenge_method: 'S256',
      token_access_type: 'offline', redirect_uri: RITORNO,
    })
  },

  // al rientro da Dropbox l'indirizzo ha ?code=...: si scambia col token e si pulisce l'indirizzo
  async ritorno() {
    const q = new URLSearchParams(location.search)
    if (!q.has('code') && !q.has('error')) return false
    history.replaceState(null, '', RITORNO + location.hash)
    if (q.has('error')) throw new Error('Collegamento a Dropbox annullato')
    const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({ code: q.get('code'), grant_type: 'authorization_code', client_id: DROPBOX_CHIAVE,
        code_verifier: sessionStorage.getItem('bounces-verifier') || '', redirect_uri: RITORNO }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error_description || 'Collegamento a Dropbox non riuscito')
    memo.set('bounces-refresh', j.refresh_token)
    this.token = j.access_token
    this.scade = Date.now() + (j.expires_in - 60) * 1000
    return true
  },

  async esci() {
    try { await this.rpc('auth/token/revoke') } catch {}
    memo.set('bounces-refresh', null)
    memo.set('bounces-nome', null)
    this.token = null
  },

  async tokenValido() {
    if (this.token && Date.now() < this.scade) return this.token
    const refresh = memo.get('bounces-refresh')
    if (!refresh) throw new Error('Non sei collegato a Dropbox')
    const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: DROPBOX_CHIAVE }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (r.status === 400 || r.status === 401) memo.set('bounces-refresh', null)
      throw new Error('Accesso a Dropbox scaduto: ricollegalo')
    }
    this.token = j.access_token
    this.scade = Date.now() + (j.expires_in - 60) * 1000
    return this.token
  },

  async rpc(ep, args) {
    const r = await fetch('https://api.dropboxapi.com/2/' + ep, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + await this.tokenValido(), 'Content-Type': 'application/json' },
      body: args === undefined ? 'null' : JSON.stringify(args),
    })
    if (!r.ok) throw await errore(r)
    return r.json()
  },

  async contenuto(ep, args, corpo) {
    const h = { Authorization: 'Bearer ' + await this.tokenValido(), 'Dropbox-API-Arg': argomento(args) }
    if (corpo !== undefined) h['Content-Type'] = 'application/octet-stream'
    const r = await fetch('https://content.dropboxapi.com/2/' + ep, { method: 'POST', headers: h, body: corpo })
    if (!r.ok) throw await errore(r)
    return r
  },

  // a pezzi da 8 MB: niente limiti di dimensione e la barra di avanzamento si muove
  async carica(path, blob, { modo = 'add', rev = null, autorename = true, progresso } = {}) {
    const PEZZO = 8 * 1024 * 1024
    const commit = { path, mode: modo === 'update' ? { '.tag': 'update', update: rev } : modo, autorename, mute: true }
    if (blob.size <= PEZZO) {
      const r = await this.contenuto('files/upload', commit, blob)
      progresso && progresso(1)
      return r.json()
    }
    const s = await (await this.contenuto('files/upload_session/start', { close: false }, blob.slice(0, PEZZO))).json()
    let off = PEZZO
    progresso && progresso(off / blob.size)
    while (blob.size - off > PEZZO) {
      await this.contenuto('files/upload_session/append_v2', { cursor: { session_id: s.session_id, offset: off }, close: false }, blob.slice(off, off + PEZZO))
      off += PEZZO
      progresso && progresso(off / blob.size)
    }
    const r = await this.contenuto('files/upload_session/finish', { cursor: { session_id: s.session_id, offset: off }, commit }, blob.slice(off))
    progresso && progresso(1)
    return r.json()
  },

  scarica(path) { return this.contenuto('files/download', { path }) },

  // link temporaneo (4 ore) per <audio> e copertine
  async link(path) {
    const c = cacheLink.get(path)
    if (c && c.scade > Date.now()) return c.url
    const j = await this.rpc('files/get_temporary_link', { path })
    cacheLink.set(path, { url: j.link, scade: Date.now() + 3.5 * 3600e3 })
    return j.link
  },
  // link scaduto o rifiutato da Dropbox: al prossimo giro se ne chiede uno nuovo
  scordaLink(path) { cacheLink.delete(path) },
  // per disegnare subito: se il link non c'è ancora lo chiede e richiama poi()
  linkSubito(path, poi) {
    const c = cacheLink.get(path)
    if (c && c.scade > Date.now()) return c.url
    if (!attesaLink.has(path)) {
      attesaLink.add(path)
      this.link(path).then(() => poi && poi(), () => {}).finally(() => attesaLink.delete(path))
    }
    return null
  },

  async sposta(da, a) {
    return (await this.rpc('files/move_v2', { from_path: da, to_path: a, autorename: true })).metadata
  },
  async alCestino(path) {
    if (!path) return
    const nome = path.split('/').pop()
    try { await this.sposta(path, `${CESTINO}/${Date.now()} ${nome}`) } catch (e) { console.warn('cestino', path, e) }
  },

  // link pubblico (chi ce l'ha ascolta): {url} è quello di Dropbox (serve per revocarlo), {diretto} va dritto al file
  async linkPubblico(path) {
    let url
    try { url = (await this.rpc('sharing/create_shared_link_with_settings', { path })).url }
    catch (e) {
      if (e.dbx?.error?.['.tag'] !== 'shared_link_already_exists') throw e
      url = e.dbx.error.shared_link_already_exists?.metadata?.url
        || (await this.rpc('sharing/list_shared_links', { path, direct_only: true })).links[0]?.url
      if (!url) throw e
    }
    return { url, diretto: diretto(url) }
  },
  async revoca(url) {
    if (!url) return
    try { await this.rpc('sharing/revoke_shared_link', { url }) } catch (e) { console.warn('revoca', url, e) }
  },

  account() { return this.rpc('users/get_current_account') },
}

// --- nomi delle cartelle: leggibili, come li vedi su Dropbox ---
const pulisci = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 100) || 'Senza titolo'
const cartellaProgetto = titolo => '/' + pulisci(titolo)
// "L'ENNESIMA CANZONE - Lea Gavino (Calderoni, Milita)" → cartella "L'ENNESIMA CANZONE"
const cartellaBrano = (titoloProgetto, titoloBrano) =>
  `${cartellaProgetto(titoloProgetto)}/${pulisci(String(titoloBrano || '').replace(/\s*\([^()]*\)\s*$/, '').split(/\s+-\s*/)[0])}`

// --- AIFF → WAV (stessi campioni, nessuna perdita): Chrome non legge gli AIFF, e da Logic escono spesso così ---
function aiffInWav(buf) {
  const d = new DataView(buf)
  const id = o => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3))
  if (d.byteLength < 12 || id(0) !== 'FORM' || !['AIFF', 'AIFC'].includes(id(8))) return null
  let ch, bits, sr, comp = 'NONE', inizio, quanti
  for (let o = 12; o + 8 <= d.byteLength;) {
    const nome = id(o), n = d.getUint32(o + 4)
    if (nome === 'COMM') {
      ch = d.getUint16(o + 8)
      bits = d.getUint16(o + 14)
      const esp = d.getUint16(o + 16) & 0x7fff, alto = d.getUint32(o + 18), basso = d.getUint32(o + 22)
      sr = Math.round((alto * 2 ** 32 + basso) * 2 ** (esp - 16383 - 63))
      if (id(8) === 'AIFC') comp = id(o + 26)
    } else if (nome === 'SSND') {
      const scarto = d.getUint32(o + 8)
      inizio = o + 16 + scarto
      quanti = Math.min(n - 8 - scarto, d.byteLength - inizio)
    }
    o += 8 + n + (n & 1)
  }
  const virgola = /^fl32$/i.test(comp)
  if (!ch || !quanti || !sr || bits < 16 || !['NONE', 'sowt', 'fl32', 'FL32'].includes(comp)) return null
  const byte = bits / 8
  const out = new ArrayBuffer(44 + quanti), w = new DataView(out), b = new Uint8Array(out)
  const scrivi = (o, s) => { for (let i = 0; i < 4; i++) w.setUint8(o + i, s.charCodeAt(i)) }
  scrivi(0, 'RIFF'); w.setUint32(4, 36 + quanti, true); scrivi(8, 'WAVE')
  scrivi(12, 'fmt '); w.setUint32(16, 16, true); w.setUint16(20, virgola ? 3 : 1, true); w.setUint16(22, ch, true)
  w.setUint32(24, sr, true); w.setUint32(28, sr * ch * byte, true); w.setUint16(32, ch * byte, true); w.setUint16(34, bits, true)
  scrivi(36, 'data'); w.setUint32(40, quanti, true)
  const src = new Uint8Array(buf, inizio, quanti)
  if (comp === 'sowt') b.set(src, 44)  // già little-endian
  else for (let i = 0; i + byte <= quanti; i += byte) for (let k = 0; k < byte; k++) b[44 + i + k] = src[i + byte - 1 - k]
  return new Blob([out], { type: 'audio/wav' })
}
async function preparaAudio(file) {
  if (/\.(aiff?|aifc)$/i.test(file.name)) {
    const wav = aiffInWav(await file.arrayBuffer())
    if (wav) return { blob: wav, ext: 'wav' }
  }
  return { blob: file, ext: (file.name.match(/\.([^.]+)$/) || [, 'wav'])[1].toLowerCase() }
}

// --- la libreria: un file JSON su Dropbox ---
let ultimoId = 0
const nuovoId = () => (ultimoId = Math.max(ultimoId + 1, Date.now() * 1000 + Math.floor(Math.random() * 1000)))
const adesso = () => Date.now() / 1000

const Archivio = {
  lib: null, rev: null, pendenti: [], salvando: null, timer: null,
  vuota: () => ({ formato: 1, progetti: [], cartelle: [], brani: [], versioni: [], commenti: [] }),

  async apri() {
    try {
      const r = await Dbx.scarica(LIBRERIA)
      const meta = JSON.parse(r.headers.get('Dropbox-API-Result') || '{}')
      this.lib = await r.json()
      this.rev = meta.rev || (await Dbx.rpc('files/get_metadata', { path: LIBRERIA })).rev
    } catch (e) {
      if (e.stato !== 409 || !/not_found/.test(e.message)) throw e
      this.lib = this.vuota()
      this.rev = null
    }
    const v = this.vuota()
    for (const k of Object.keys(v)) if (!(k in this.lib)) this.lib[k] = v[k]
  },

  // ogni modifica è una funzione sulla libreria: se un altro dispositivo ha salvato nel frattempo, la si riapplica sulla sua versione
  // schede = false per i cambi che chi ascolta da un link non vede (ordine della libreria, ultimi ascolti)
  cambia(op, schede = true) {
    op(this.lib)
    this.pendenti.push(op)
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.salva(), 500)
    if (!schede) return
    // i progetti condivisi aggiornano la loro scheda: chi ha il link sente le versioni nuove senza un link nuovo
    clearTimeout(this.timerSchede)
    this.timerSchede = setTimeout(aggiornaSchede, 2500)
  },

  async salva() {
    if (this.salvando) { this.ancora = true; return }
    if (!this.pendenti.length) return
    this.salvando = (async () => {
      for (let tentativo = 0; tentativo < 5; tentativo++) {
        const n = this.pendenti.length
        const corpo = new Blob([JSON.stringify(this.lib)], { type: 'application/json' })
        try {
          const m = await Dbx.carica(LIBRERIA, corpo, this.rev ? { modo: 'update', rev: this.rev, autorename: false } : { modo: 'add', autorename: false })
          this.rev = m.rev
          this.pendenti.splice(0, n)
          return
        } catch (e) {
          if (e.stato !== 409 || !/conflict/.test(e.message)) throw e
          await this.apri()
          for (const op of this.pendenti) op(this.lib)
        }
      }
      throw new Error('Non riesco a salvare su Dropbox: riprova')
    })()
    try { await this.salvando }
    catch (e) { typeof sbaglio === 'function' ? sbaglio(e) : console.error(e) }
    finally {
      this.salvando = null
      if (this.ancora) { this.ancora = false; this.salva() }
    }
  },

  // tornando sull'app: se un altro dispositivo ha cambiato qualcosa, si ricarica
  async cambiataAltrove() {
    if (!this.lib || this.pendenti.length || this.salvando) return false
    try {
      const m = await Dbx.rpc('files/get_metadata', { path: LIBRERIA })
      if (m.rev === this.rev) return false
    } catch { return false }
    await this.apri()
    return true
  },

  percorso(vid) { return this.lib.versioni.find(v => v.id === vid)?.path || null },
}

// --- le rotte del vecchio server, fatte qui ---
const L = () => Archivio.lib
const trova = (tab, id) => {
  const x = L()[tab].find(r => r.id === id)
  if (!x) throw Object.assign(new Error('Non trovato'), { stato: 404 })
  return x
}
const tocca = (l, pid) => { const p = l.progetti.find(x => x.id === pid); if (p) p.modificato = adesso() }
const vuotoNull = v => (v === '' ? null : v)
function commentiDi(vid) {
  return L().commenti.filter(m => m.versione_id === vid)
    .sort((a, b) => (a.secondi == null) - (b.secondi == null) || (a.secondi || 0) - (b.secondi || 0) || a.creato - b.creato)
}
function contaPer(righe, campo) {
  const m = new Map()
  for (const r of righe) m.set(r[campo], (m.get(r[campo]) || 0) + 1)
  return m
}

function vistaLibreria() {
  const l = L(), perV = new Map(l.versioni.map(v => [v.id, v]))
  const nver = contaPer(l.versioni, 'brano_id'), ncom = contaPer(l.commenti, 'versione_id')
  const brani = l.brani.map(b => {
    const v = perV.get(b.versione_attiva) || {}
    return { id: b.id, progetto_id: b.progetto_id, titolo: b.titolo, artista: b.artista || '', ordine: b.ordine, creato: b.creato, preferito: b.preferito ? 1 : 0,
      preferito_il: b.preferito_il, versione_id: v.id, etichetta: v.etichetta, stato: v.stato || null, bpm: v.bpm, bpm_auto: v.bpm_auto, tonalita: v.tonalita,
      tonalita_auto: v.tonalita_auto, durata: v.durata, audio: v.path ? 1 : 0, nver: nver.get(b.id) || 0, ncom: ncom.get(v.id) || 0 }
  }).sort((a, b) => a.progetto_id - b.progetto_id || a.ordine - b.ordine || a.id - b.id)
  const progetti = l.progetti.map(p => {
    const bs = brani.filter(b => b.progetto_id === p.id)
    return { ...p, n_brani: bs.length, durata: bs.reduce((s, b) => s + (b.durata || 0), 0), senza_audio: bs.filter(b => !b.audio).length }
  }).sort((a, b) => b.modificato - a.modificato)
  const cartelle = l.cartelle.map(c => ({ ...c, n: l.progetti.filter(p => p.cartella_id === c.id).length }))
    .sort((a, b) => a.titolo.localeCompare(b.titolo, 'it', { sensitivity: 'base' }))
  return { progetti, cartelle, brani, foto_autori: { ...(l.foto_autori || {}) }, ordine: l.ordine_libreria || 'ascoltati' }
}

function vistaProgetto(pid) {
  const l = L(), p = trova('progetti', pid)
  const brani = l.brani.filter(b => b.progetto_id === pid).sort(ordinePer(p)).map(b => ({
    ...b,
    versioni: l.versioni.filter(v => v.brano_id === b.id).sort((x, y) => x.creato - y.creato || x.id - y.id)
      .map(v => ({ ...v, audio: !!v.path, commenti: commentiDi(v.id) })),
  }))
  return { ...p, brani }
}

// rinominare un progetto o un brano sposta anche la sua cartella su Dropbox, e i percorsi salvati la seguono
async function rinominaCartella(da, a) {
  if (da.toLowerCase() === a.toLowerCase()) return
  const usata = L().versioni.some(v => v.path && v.path.toLowerCase().startsWith(da.toLowerCase() + '/'))
    || L().progetti.some(p => p.cover && p.cover.toLowerCase().startsWith(da.toLowerCase() + '/'))
  if (!usata) return
  let nuovo
  try { nuovo = (await Dbx.sposta(da, a)).path_display } catch (e) { console.warn('rinomina cartella', e); return }
  const sost = p => p && p.toLowerCase().startsWith(da.toLowerCase() + '/') ? nuovo + p.slice(da.length) : p
  Archivio.cambia(l => {
    for (const v of l.versioni) { const n = sost(v.path); if (n !== v.path) { v.path = n; v.link = null } }  // il link si richiede al prossimo aggiornamento della scheda
    for (const p of l.progetti) p.cover = sost(p.cover)
  })
}

// link pubblici di versioni e copertina del progetto (per spegnerli quando la condivisione finisce)
async function revocaLinkVersioni(vids) {
  for (const v of L().versioni) if (vids.has(v.id) && v.link_url) await Dbx.revoca(v.link_url)
}

const ROTTE = {
  'GET libreria': () => vistaLibreria(),
  // ordine della libreria (25/10, Matteo): 'ascoltati', 'alfabetico' o 'personale' (trascinando). Uguale su Mac e telefono
  'PATCH libreria': (_, d) => Archivio.cambia(l => { if (d.ordine) l.ordine_libreria = d.ordine }, false),
  'POST libreria/ordine': (_, d) => Archivio.cambia(l => {
    d.ids.forEach((id, i) => { const p = l.progetti.find(x => x.id === id); if (p) p.posizione = i })
    l.ordine_libreria = 'personale'
  }, false),
  'POST progetti/:id/ascoltato': n => Archivio.cambia(l => { const p = l.progetti.find(x => x.id === n); if (p) p.ascoltato = adesso() }, false),

  'POST progetti': (_, d) => {
    const id = nuovoId(), ora = adesso(), sfondo = 1 + Math.floor(Math.random() * 10)
    Archivio.cambia(l => l.progetti.push({ id, titolo: d.titolo || 'Nuovo progetto', artista: d.artista || '', nota: '', cover: null,
      sfondo, fissato: 0, cartella_id: d.cartella_id || null, creato: ora, modificato: ora }))
    return { id }
  },
  'GET progetti/:id': n => vistaProgetto(n),
  'PATCH progetti/:id': async (n, d) => {
    const p = trova('progetti', n)
    if (d.titolo && d.titolo.trim() && d.titolo !== p.titolo) await rinominaCartella(cartellaProgetto(p.titolo), cartellaProgetto(d.titolo))
    Archivio.cambia(l => {
      const x = l.progetti.find(y => y.id === n)
      if (!x) return
      for (const k of ['titolo', 'artista', 'nota', 'fissato', 'cartella_id', 'sfondo', 'ordine_manuale']) if (k in d) x[k] = d[k]
      x.modificato = adesso()
    })
  },
  'DELETE progetti/:id': async n => {
    const l = L(), p = trova('progetti', n)
    const bids = new Set(l.brani.filter(b => b.progetto_id === n).map(b => b.id))
    const vids = new Set(l.versioni.filter(v => bids.has(v.brano_id)).map(v => v.id))
    if (p.condivisione) await revocaCondivisione(n)
    for (const v of l.versioni) if (vids.has(v.id)) await Dbx.alCestino(v.path)
    await Dbx.alCestino(p.cover)
    Archivio.cambia(l => {
      l.commenti = l.commenti.filter(m => !vids.has(m.versione_id))
      l.versioni = l.versioni.filter(v => !vids.has(v.id))
      l.brani = l.brani.filter(b => !bids.has(b.id))
      l.progetti = l.progetti.filter(x => x.id !== n)
    })
  },
  'DELETE progetti/:id/cover': async n => {
    await Dbx.alCestino(trova('progetti', n).cover)
    Archivio.cambia(l => { const p = l.progetti.find(x => x.id === n); if (p) { p.cover = null; p.modificato = adesso() } })
  },
  'POST progetti/:id/ordine': (n, d) => {
    const ids = d.ids || []
    Archivio.cambia(l => {
      ids.forEach((bid, i) => { const b = l.brani.find(x => x.id === bid && x.progetto_id === n); if (b) b.ordine = i })
      const p = l.progetti.find(x => x.id === n)
      if (p) p.ordine_manuale = 1
      tocca(l, n)
    })
  },

  'PATCH brani/:id': async (n, d) => {
    const b = trova('brani', n), p = trova('progetti', b.progetto_id)
    // rinominare o spostare in un altro progetto ("Sposta in", se il nome è stato letto male) sposta anche la cartella su Dropbox
    const nuovoP = d.progetto_id && d.progetto_id !== b.progetto_id ? trova('progetti', d.progetto_id) : p
    if (d.titolo && d.titolo.trim()) d = { ...d, titolo: maiuscoloTitolo(d.titolo) }
    const nuovoT = d.titolo && d.titolo.trim() ? d.titolo : b.titolo
    if (nuovoP !== p || nuovoT !== b.titolo) await rinominaCartella(cartellaBrano(p.titolo, b.titolo), cartellaBrano(nuovoP.titolo, nuovoT))
    const quando = adesso()
    Archivio.cambia(l => {
      const x = l.brani.find(y => y.id === n)
      if (!x) return
      if ('preferito' in d) { x.preferito = d.preferito ? 1 : 0; x.preferito_il = d.preferito ? quando : null }
      for (const k of ['titolo', 'artista', 'nota', 'versione_attiva']) if (k in d) x[k] = d[k]
      if (nuovoP !== p) {
        // l'artista segue lo spostamento, se era quello del vecchio progetto (o mancava); se l'aveva scritto Matteo, resta
        if (!('artista' in d) && (!x.artista || chiaveNome(x.artista) === chiaveNome(artistaDi(p)))) x.artista = artistaDi(nuovoP)
        tocca(l, x.progetto_id)
        x.progetto_id = nuovoP.id
        x.ordine = Math.max(-1, ...l.brani.filter(y => y.progetto_id === nuovoP.id && y.id !== n).map(y => y.ordine)) + 1
      }
      if (Object.keys(d).some(k => k !== 'preferito')) tocca(l, x.progetto_id)  // il cuore non conta come modifica
    })
  },
  'DELETE brani/:id': async n => {
    const b = trova('brani', n)
    const vs = L().versioni.filter(v => v.brano_id === n)
    const vids = new Set(vs.map(v => v.id))
    await revocaLinkVersioni(vids)
    for (const v of vs) await Dbx.alCestino(v.path)
    Archivio.cambia(l => {
      l.commenti = l.commenti.filter(m => !vids.has(m.versione_id))
      l.versioni = l.versioni.filter(v => v.brano_id !== n)
      l.brani = l.brani.filter(x => x.id !== n)
      tocca(l, b.progetto_id)
    })
  },

  'GET versioni/:id': n => { const v = trova('versioni', n); return { id: v.id, picchi: v.picchi, durata: v.durata, commenti: commentiDi(n) } },
  'PATCH versioni/:id': (n, d) => {
    const b = trova('brani', trova('versioni', n).brano_id)
    Archivio.cambia(l => {
      const v = l.versioni.find(x => x.id === n)
      if (!v) return
      for (const k of ['etichetta', 'stato', 'bpm', 'tonalita', 'bpm_auto', 'tonalita_auto', 'picchi', 'durata']) if (k in d) v[k] = vuotoNull(d[k])
      if (['etichetta', 'stato', 'bpm', 'tonalita'].some(k => k in d)) tocca(l, b.progetto_id)
    })
  },
  'DELETE versioni/:id': async n => {
    const v = trova('versioni', n), b = trova('brani', v.brano_id)
    const altre = L().versioni.filter(x => x.brano_id === b.id && x.id !== n).sort((x, y) => y.creato - x.creato)
    if (!altre.length) throw new Error("È l'unica versione: elimina il brano")
    await revocaLinkVersioni(new Set([n]))
    await Dbx.alCestino(v.path)
    Archivio.cambia(l => {
      l.commenti = l.commenti.filter(m => m.versione_id !== n)
      l.versioni = l.versioni.filter(x => x.id !== n)
      const x = l.brani.find(y => y.id === b.id)
      if (x && x.versione_attiva === n) x.versione_attiva = altre[0].id
      tocca(l, b.progetto_id)
    })
  },
  'POST versioni/:id/commenti': (n, d) => {
    const b = trova('brani', trova('versioni', n).brano_id)
    const testo = (d.testo || '').trim()
    if (!testo) throw new Error('Commento vuoto')
    const id = nuovoId(), creato = adesso()
    Archivio.cambia(l => { l.commenti.push({ id, versione_id: n, secondi: d.secondi ?? null, testo, creato }); tocca(l, b.progetto_id) })
    return { id }
  },
  'DELETE commenti/:id': n => Archivio.cambia(l => { l.commenti = l.commenti.filter(m => m.id !== n) }),

  'POST cartelle': (_, d) => {
    const id = nuovoId(), creato = adesso()
    Archivio.cambia(l => l.cartelle.push({ id, titolo: d.titolo || 'Nuova cartella', creato }))
    return { id }
  },
  'PATCH cartelle/:id': (n, d) => Archivio.cambia(l => { const c = l.cartelle.find(x => x.id === n); if (c && d.titolo) c.titolo = d.titolo }),
  'DELETE cartelle/:id': n => Archivio.cambia(l => {
    for (const p of l.progetti) if (p.cartella_id === n) p.cartella_id = null
    l.cartelle = l.cartelle.filter(c => c.id !== n)
  }),
}

async function api(metodo, url, dati = {}) {
  if (!Archivio.lib) await Archivio.apri()
  const m = url.match(/^\/api\/(\w+)(?:\/(\d+))?(?:\/(\w+))?/) || []
  const f = ROTTE[`${metodo} ${m[1]}${m[2] ? '/:id' : ''}${m[3] ? '/' + m[3] : ''}`]
  if (!f) throw new Error('Rotta sconosciuta: ' + metodo + ' ' + url)
  return (await f(m[2] ? +m[2] : null, dati || {})) || { ok: true }
}

// --- caricamenti: il file va dritto nel Dropbox di chi carica ---
async function nuovoBranoDropbox(pid, file, progresso) {
  const p = trova('progetti', pid)
  const { blob, ext } = await preparaAudio(file)
  const titolo = file.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim() || 'Senza titolo'
  const m = await Dbx.carica(`${cartellaBrano(p.titolo, titolo)}/V1.${ext}`, blob, { progresso })
  const bid = nuovoId(), vid = nuovoId(), ora = adesso()
  Archivio.cambia(l => {
    const ordine = Math.max(-1, ...l.brani.filter(b => b.progetto_id === pid).map(b => b.ordine)) + 1
    l.brani.push({ id: bid, progetto_id: pid, titolo, ordine, versione_attiva: vid, nota: '', creato: ora, preferito: 0, preferito_il: null })
    l.versioni.push({ id: vid, brano_id: bid, etichetta: 'V1', path: m.path_display, nome_file: file.name, dimensione: blob.size, creato: ora })
    tocca(l, pid)
  })
  return { brano_id: bid, versione_id: vid, blob }
}

async function nuovaVersioneDropbox(bid, file, progresso) {
  const b = trova('brani', bid), p = trova('progetti', b.progetto_id)
  const { blob, ext } = await preparaAudio(file)
  const info = leggiNomeFile(file.name)  // "... MASTER V3": versione e stato dal nome, se ci sono
  const etichetta = info.versione || 'V' + (L().versioni.filter(v => v.brano_id === bid).length + 1)
  const stato = info.stato
  const m = await Dbx.carica(`${cartellaBrano(p.titolo, b.titolo)}/${nomeVersione(etichetta, stato)}.${ext}`, blob, { progresso })
  const vid = nuovoId(), ora = adesso()
  Archivio.cambia(l => {
    l.versioni.push({ id: vid, brano_id: bid, etichetta, stato, path: m.path_display, nome_file: file.name, dimensione: blob.size, creato: ora })
    const x = l.brani.find(y => y.id === bid)
    if (x) x.versione_attiva = vid
    tocca(l, b.progetto_id)
  })
  return { brano_id: bid, versione_id: vid, blob }
}

// --- caricamento automatico dal nome del file (24/10): "Dhome - Fuggire da te MASTER V3.wav" →
// progetto Dhome (creato se manca), brano "Fuggire da te" (nuova versione se esiste già), stato MASTER, versione V3 ---
const STATI = ['demo', 'prod', 'rec', 'premix', 'mix', 'master']
const chiaveNome = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// "L'ENNESIMA CANZONE - Lea Gavino (Calderoni, Milita)" e "Fuggire da te" → la parte che identifica il brano
const titoloBase = t => String(t || '').replace(/\s*\([^()]*\)\s*$/, '').split(/\s+[-–]\s*/)[0].trim()
// 24/10, Matteo: titoli sempre in MAIUSCOLO. Solo il titolo: "Fuggire da te (Milita, Rondine)" → "FUGGIRE DA TE (Milita, Rondine)"
function maiuscoloTitolo(t) {
  const m = String(t || '').trim().match(/^(.*?)(\s+[-–]\s.*?)?(\s*\([^()]*\))?$/)
  return m ? m[1].toLocaleUpperCase('it') + (m[2] || '') + (m[3] || '') : String(t || '').toLocaleUpperCase('it')
}
// brani in ordine alfabetico (24/10, Matteo), ovunque: progetto, autore, link d'ascolto
const perTitolo = (a, b) => titoloBase(a.titolo).localeCompare(titoloBase(b.titolo), 'it', { sensitivity: 'base', numeric: true }) || a.id - b.id
// se Matteo trascina i brani per riordinarli, quel progetto tiene il suo ordine (ordine_manuale) finché non torna all'alfabetico
const ordinePer = p => p && p.ordine_manuale ? (a, b) => a.ordine - b.ordine || a.id - b.id : perTitolo
const nomeVersione = (etichetta, stato) => pulisci(etichetta + (stato ? ' ' + stato.toUpperCase() : ''))

function leggiNomeFile(nome, artistiNoti = []) {
  let s = nome.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
  let versione = null, stato = null
  // in fondo, in qualsiasi ordine: "MASTER V3", "V3 MASTER", "mix v2", "(pre-mix)"
  for (let giro = 0; giro < 4; giro++) {
    let m = !versione && s.match(/[\s\-–(]*\bv\.?\s?(\d{1,3})\)?$/i)
    if (m) { versione = 'V' + +m[1]; s = s.slice(0, m.index).trim(); continue }
    m = !stato && s.match(/[\s\-–(]*\b(pre[\s-]?mix|demo|prod|rec|mix|master)\)?$/i)
    if (m) { stato = m[1].toLowerCase().replace(/[\s-]/g, ''); s = s.slice(0, m.index).trim(); continue }
    break
  }
  s = s.replace(/[\s\-–]+$/, '')
  // gli autori tra parentesi in fondo restano col titolo, chiunque sia l'artista: "PAZZA DI ME - Andrei (Milita, Rondine)"
  let autori = ''
  const par = s.match(/\s*(\([^()]*\))$/)
  if (par && s.slice(0, par.index).includes(' - ')) { autori = ' ' + par[1]; s = s.slice(0, par.index).trim() }
  let artista = '', titolo = s
  const parti = s.split(/\s+[-–]\s+/)
  if (parti.length >= 2) {
    // "Artista - Titolo" o "TITOLO - Artista" (il modo di Matteo, 24/10): decide chi è già noto, poi le maiuscole
    const primo = parti[0], ultimo = parti[parti.length - 1]
    const noto = x => artistiNoti.some(n => chiaveNome(n) === chiaveNome(x))
    const maiuscolo = x => /\p{Lu}/u.test(x) && x === x.toUpperCase()
    const inverso = noto(primo) !== noto(ultimo) ? noto(ultimo) : maiuscolo(parti.slice(0, -1).join(' - ')) && !maiuscolo(ultimo)
    if (inverso) { artista = ultimo; titolo = parti.slice(0, -1).join(' - ') }
    else { artista = primo; titolo = parti.slice(1).join(' - ') }
  }
  return { artista, titolo: (titolo || s || 'Senza titolo') + autori, stato, versione }
}

// l'artista di un progetto: il campo Artista, se no il nome del progetto (sotto il titolo dei brani smistati a mano)
const artistaDi = p => (p && (p.artista || p.titolo)) || ''

// pid: si sta caricando dentro un progetto (il file resta lì); artistaDefault: nome della cartella trascinata
async function caricaBounce(file, { pid = null, artistaDefault = '', progresso } = {}) {
  const l = L()
  const noti = [...l.progetti.flatMap(p => [p.titolo, p.artista]), ...l.brani.map(b => b.artista)].filter(Boolean)
  const info = leggiNomeFile(file.name, noti)
  const artista = info.artista || (pid ? '' : artistaDefault)
  let p = pid ? trova('progetti', pid)
    : l.progetti.find(x => chiaveNome(x.titolo) === chiaveNome(artista || 'Da smistare') || (artista && chiaveNome(x.artista) === chiaveNome(artista)))
  let progettoNuovo = false
  if (!p) {
    const id = nuovoId(), ora = adesso(), titolo = artista || 'Da smistare', sfondo = 1 + Math.floor(Math.random() * 10)
    Archivio.cambia(lb => lb.progetti.push({ id, titolo, artista, nota: '', cover: null, sfondo, fissato: 0, cartella_id: null, creato: ora, modificato: ora }))
    p = trova('progetti', id)
    progettoNuovo = true
  }
  const b = L().brani.find(x => x.progetto_id === p.id && chiaveNome(titoloBase(x.titolo)) === chiaveNome(titoloBase(info.titolo)))
  let ris
  if (b) {
    const attiva = L().versioni.find(v => v.id === b.versione_attiva)
    if (attiva && !attiva.path) {  // brano importato senza audio: il file è il suo
      ris = await collegaAudioDropbox(attiva.id, file, progresso)
      if (info.stato || info.versione) await api('PATCH', `/api/versioni/${attiva.id}`, { ...(info.stato && { stato: info.stato }), ...(info.versione && { etichetta: info.versione }) })
    } else ris = await nuovaVersioneDropbox(b.id, file, progresso)
  } else {
    const { blob, ext } = await preparaAudio(file)
    const etichetta = info.versione || 'V1', stato = info.stato
    const m = await Dbx.carica(`${cartellaBrano(p.titolo, maiuscoloTitolo(info.titolo))}/${nomeVersione(etichetta, stato)}.${ext}`, blob, { progresso })
    const bid = nuovoId(), vid = nuovoId(), ora = adesso(), pidX = p.id
    Archivio.cambia(lb => {
      const ordine = Math.max(-1, ...lb.brani.filter(x => x.progetto_id === pidX).map(x => x.ordine)) + 1
      lb.brani.push({ id: bid, progetto_id: pidX, titolo: maiuscoloTitolo(info.titolo), artista: info.artista || artistaDi(p), ordine, versione_attiva: vid, nota: '', creato: ora, preferito: 0, preferito_il: null })
      lb.versioni.push({ id: vid, brano_id: bid, etichetta, stato, path: m.path_display, nome_file: file.name, dimensione: blob.size, creato: ora })
      tocca(lb, pidX)
    })
    ris = { brano_id: bid, versione_id: vid, blob }
  }
  return { ...ris, progetto_id: p.id, progetto: p.titolo, progettoNuovo, info }
}

// audio per una versione che non ce l'ha (brani importati rimasti senza file)
async function collegaAudioDropbox(vid, file, progresso) {
  const v = trova('versioni', vid), b = trova('brani', v.brano_id), p = trova('progetti', b.progetto_id)
  const { blob, ext } = await preparaAudio(file)
  const m = await Dbx.carica(`${cartellaBrano(p.titolo, b.titolo)}/${pulisci(v.etichetta || 'V1')}.${ext}`, blob, { progresso })
  if (v.path) { await revocaLinkVersioni(new Set([vid])); await Dbx.alCestino(v.path) }
  Archivio.cambia(l => {
    const x = l.versioni.find(y => y.id === vid)
    if (x) Object.assign(x, { path: m.path_display, nome_file: file.name, dimensione: blob.size, picchi: null, link: null, link_url: null })
    tocca(l, b.progetto_id)
  })
  return { versione_id: vid, blob }
}

async function copertinaDropbox(pid, file) {
  const p = trova('progetti', pid)
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type] || 'jpg'
  const m = await Dbx.carica(`${cartellaProgetto(p.titolo)}/cover.${ext}`, file, { modo: 'overwrite', autorename: false })
  if (p.cover && p.cover.toLowerCase() !== m.path_lower) await Dbx.alCestino(p.cover)
  cacheLink.delete(m.path_display)
  Archivio.cambia(l => { const x = l.progetti.find(y => y.id === pid); if (x) { x.cover = m.path_display; x.modificato = adesso() } })
}

// foto degli autori (25/10, Matteo): una per autore in /.bounces/autori, chiave = nome normalizzato
async function fotoAutoreDropbox(chiave, file) {
  const m = await Dbx.carica(`/.bounces/autori/${chiave.replace(/[\\/:*?"<>|]/g, '') || 'autore'}.jpg`, file, { modo: 'overwrite', autorename: false })
  cacheLink.delete(m.path_display)
  Archivio.cambia(l => { (l.foto_autori ||= {})[chiave] = m.path_display })
}
async function togliFotoAutore(chiave) {
  const p = (L().foto_autori || {})[chiave]
  if (!p) return
  await Dbx.alCestino(p)
  Archivio.cambia(l => { if (l.foto_autori) delete l.foto_autori[chiave] })
}

// --- link d'ascolto sempre aggiornato (24/10) ---
// Condividere un progetto crea una "scheda" in /.bounces/condivisi/<id>.json (titoli + link pubblici alle versioni attive)
// e un link pubblico a quella scheda. Il link d'ascolto contiene solo l'indirizzo della scheda; ogni modifica al progetto
// riscrive la scheda nello stesso file, quindi chi ha il link sente sempre l'ultima versione.
// Dropbox permette di leggere i file pubblici dal browser solo dall'indirizzo diretto (dl.dropboxusercontent.com, verificato 24/10)
const CONDIVISI = '/.bounces/condivisi'
function diretto(url) {
  const u = new URL(url)
  u.hostname = 'dl.dropboxusercontent.com'
  u.searchParams.delete('raw')
  u.searchParams.set('dl', '1')
  return u.href
}
function impronta(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}

async function aggiornaScheda(pid) {
  const l = L(), p = l.progetti.find(x => x.id === pid)
  if (!p || !p.condivisione) return
  const brani = l.brani.filter(b => b.progetto_id === pid).sort(ordinePer(p))
  const voci = []
  for (const b of brani) {
    const v = l.versioni.find(x => x.id === b.versione_attiva)
    if (!v || !v.path) continue
    if (!v.link) {
      const lk = await Dbx.linkPubblico(v.path)
      Archivio.cambia(lb => { const x = lb.versioni.find(y => y.id === v.id); if (x) { x.link = lk.diretto; x.link_url = lk.url } })
    }
    // waveform leggera per chi ascolta: 100 valori da 0 a 9 in una stringa
    const pc = v.picchi && v.picchi.length ? Array.from({ length: 100 }, (_, i) => {
      const da = Math.floor(i * v.picchi.length / 100), a = Math.max(da + 1, Math.floor((i + 1) * v.picchi.length / 100))
      return Math.round(Math.max(...v.picchi.slice(da, a)) * 9)
    }).join('') : ''
    voci.push([b.titolo, v.link, Math.round(v.durata || 0), v.tonalita || v.tonalita_auto || '', Math.round(v.bpm || v.bpm_auto || 0), v.stato || '', b.artista || '', pc])
  }
  if (p.cover && p.cover_di !== p.cover) {
    const lk = await Dbx.linkPubblico(p.cover)
    const di = p.cover
    Archivio.cambia(lb => { const x = lb.progetti.find(y => y.id === pid); if (x) Object.assign(x, { cover_link: lk.diretto, cover_url: lk.url, cover_di: di }) })
  }
  const testo = JSON.stringify({ v: 2, t: p.titolo, a: p.artista, s: p.sfondo, c: p.cover ? p.cover_link : null, b: voci })
  const imp = impronta(testo)
  if (imp === p.condivisione.impronta) return
  await Dbx.carica(p.condivisione.path, new Blob([testo], { type: 'application/json' }), { modo: 'overwrite', autorename: false })
  Archivio.cambia(lb => { const x = lb.progetti.find(y => y.id === pid); if (x && x.condivisione) x.condivisione.impronta = imp })
}

let aggiornandoSchede = null
async function aggiornaSchede() {
  if (aggiornandoSchede) return aggiornandoSchede.then(aggiornaSchede)
  aggiornandoSchede = (async () => {
    for (const p of (L() || { progetti: [] }).progetti.filter(x => x.condivisione)) {
      try { await aggiornaScheda(p.id) } catch (e) { console.warn('scheda', p.titolo, e) }
    }
  })()
  try { await aggiornandoSchede } finally { aggiornandoSchede = null }
}

// accende la condivisione (se non c'è) e restituisce il link d'ascolto, sempre lo stesso
async function attivaCondivisione(pid) {
  if (!trova('progetti', pid).condivisione) {
    const path = `${CONDIVISI}/${nuovoId()}.json`
    Archivio.cambia(l => { const x = l.progetti.find(y => y.id === pid); if (x && !x.condivisione) x.condivisione = { path, impronta: null } })
  }
  await aggiornaScheda(pid)
  let c = trova('progetti', pid).condivisione
  if (!c.url) {
    const lk = await Dbx.linkPubblico(c.path)
    Archivio.cambia(l => { const x = l.progetti.find(y => y.id === pid); if (x && x.condivisione) Object.assign(x.condivisione, { url: lk.url, diretto: lk.diretto }) })
    c = trova('progetti', pid).condivisione
  }
  return RITORNO + '#/ascolta/' + await comprimi(JSON.stringify({ m: c.diretto }))
}

// spegne il link d'ascolto: la scheda e i link pubblici dei file smettono di funzionare
async function revocaCondivisione(pid) {
  const p = trova('progetti', pid), c = p.condivisione
  if (!c) return
  await Dbx.revoca(c.url)
  const bids = new Set(L().brani.filter(b => b.progetto_id === pid).map(b => b.id))
  const vids = new Set(L().versioni.filter(v => bids.has(v.brano_id)).map(v => v.id))
  await revocaLinkVersioni(vids)
  await Dbx.revoca(p.cover_url)
  await Dbx.alCestino(c.path)
  Archivio.cambia(l => {
    const x = l.progetti.find(y => y.id === pid)
    if (x) { delete x.condivisione; x.cover_link = x.cover_url = x.cover_di = null }
    for (const v of l.versioni) if (vids.has(v.id)) v.link = v.link_url = null
  })
}

// --- i dati nell'indirizzo del link d'ascolto viaggiano compressi ---
async function comprimi(testo) {
  const flusso = new Blob([testo]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return b64url(await new Response(flusso).arrayBuffer())
}
async function decomprimi(b) {
  const bin = Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  return new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
}
