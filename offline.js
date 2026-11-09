// Bounces offline e ascolto senza scatti (09/11, Matteo: a un amico in macchina col Bluetooth andava a scatti).
// Tre pezzi:
// - Off: progetti, brani e Preferiti "disponibili offline", come su Spotify/untitled. I file stanno nel dispositivo
//   (Cache Storage, per ogni dispositivo la sua scelta), con la copia della libreria e le copertine: senza rete si apre
//   l'app e suonano i brani scaricati.
// - Leggere: copia MP3 320 (worker leggero.js) fatta dal dispositivo quando scarica un brano per l'offline: resta solo
//   lì, su Dropbox non si aggiunge niente (09/11, Matteo: "non voglio riempire Dropbox"). Le 4 copie messe in
//   /.bounces/ascolto la prima sera (campo `leggero`) si usano ancora per l'ascolto, ma non se ne creano altre.
// - Tmp: sul telefono il prossimo brano della coda si scarica intero in memoria (appena quello in ascolto è tutto
//   arrivato): dal secondo brano in poi si suona senza rete. Il brano in ascolto va in streaming come prima.
'use strict'
const MOBILE = /iP(hone|ad|od)|Android/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const BASE_OFF = RITORNO.replace(/[^/]*$/, '') + '__offline/'
const conCache = async f => { if (!('caches' in window)) return null; return f(await caches.open('bounces-offline')) }
const pausa = ms => new Promise(ok => setTimeout(ok, ms))
const LOSSLESS = /\.(wav|aiff?|aifc|flac|caf)$/i
const tipoAudio = path => /\.mp3$/i.test(path) ? 'audio/mpeg' : /\.wav$/i.test(path) ? 'audio/wav' : /\.(m4a|aac)$/i.test(path) ? 'audio/mp4'
  : /\.flac$/i.test(path) ? 'audio/flac' : /\.ogg$/i.test(path) ? 'audio/ogg' : 'application/octet-stream'

// impostazioni (per dispositivo). Ascolto: 'auto' = leggera sul telefono, originale sul computer
const Imp = {
  get: (k, def) => memo.get('bounces-' + k) || def,
  set: (k, v) => memo.set('bounces-' + k, v),
  leggeraInAscolto: () => { const q = Imp.get('qualita', 'auto'); return q === 'leggera' || (q === 'auto' && MOBILE) },
  leggeraOffline: () => Imp.get('qualita-offline', 'leggera') === 'leggera',
}
const versione = vid => Archivio.lib && Archivio.lib.versioni.find(v => v.id === vid)
// il file da cui si ascolta in streaming: copia leggera se c'è e se è quella scelta, se no l'originale
function percorsoAscolto(vid) {
  const v = versione(vid)
  if (!v || !v.path) return null
  return v.leggero && Imp.leggeraInAscolto() ? v.leggero : v.path
}

const Off = {
  file: new Map(),    // vid → 'l' (copia leggera) o 'o' (originale), già nel dispositivo
  url: new Map(),     // vid → blob: pronto da suonare
  cover: new Map(),   // percorso su Dropbox → blob: della copertina
  scarica_: new Set(),// vid in download adesso
  pronto: null,

  sel() {
    try { return { p: [], b: [], pref: false, ...JSON.parse(memo.get('bounces-offline-sel') || '{}') } }
    catch { return { p: [], b: [], pref: false } }
  },
  scelto(tipo, id) { const s = this.sel(); return tipo === 'pref' ? !!s.pref : s[tipo].includes(id) },
  imposta(tipo, id, on) {
    const s = this.sel()
    if (tipo === 'pref') s.pref = on
    else s[tipo] = on ? [...new Set([...s[tipo], id])] : s[tipo].filter(x => x !== id)
    memo.set('bounces-offline-sel', JSON.stringify(s))
    this.sincronizza()
  },

  init() {
    return this.pronto ||= conCache(async c => {
      for (const r of await c.keys()) {
        const k = r.url.startsWith(BASE_OFF) ? r.url.slice(BASE_OFF.length) : ''
        let m = k.match(/^v\/(\d+)\.([lo])$/)
        if (m) this.file.set(+m[1], m[2])
        m = k.match(/^c\/(.+)$/)
        if (m) try { this.cover.set(decodeURIComponent(m[1]), URL.createObjectURL(await (await c.match(r)).blob())) } catch {}
      }
    }).catch(e => console.warn('offline init', e))
  },
  ha(vid) { return this.file.has(vid) },
  async urlDi(vid) {
    if (this.url.has(vid)) return this.url.get(vid)
    const q = this.file.get(vid)
    if (!q) return null
    const r = await conCache(c => c.match(BASE_OFF + `v/${vid}.${q}`))
    if (!r) { this.file.delete(vid); return null }
    const u = URL.createObjectURL(await r.blob())
    this.url.set(vid, u)
    // pochi blob aperti alla volta: quelli che non suonano si chiudono
    for (const [x, ux] of this.url) if (this.url.size > 4 && x !== vid && A.src !== ux) { URL.revokeObjectURL(ux); this.url.delete(x) }
    return u
  },

  // copia della libreria su questo dispositivo, per aprire l'app senza rete
  async libLocale() { try { const r = await conCache(c => c.match(BASE_OFF + 'libreria')); return r ? await r.json() : null } catch { return null } },
  salvaLib(lib, rev) {
    let testo
    try { testo = JSON.stringify({ lib, rev }) } catch { return }
    conCache(c => c.put(BASE_OFF + 'libreria', new Response(testo, { headers: { 'Content-Type': 'application/json' } }))).catch(() => {})
  },

  // le versioni da avere nel dispositivo: quelle attive dei brani scelti (progetti, brani, Preferiti), con la qualità giusta
  voluti() {
    const s = this.sel(), l = Archivio.lib, out = new Map()
    if (!l) return out
    const sp = new Set(s.p), sb = new Set(s.b), perV = new Map(l.versioni.map(v => [v.id, v]))
    for (const b of l.brani) {
      if (!(sp.has(b.progetto_id) || sb.has(b.id) || (s.pref && b.preferito))) continue
      const v = perV.get(b.versione_attiva)
      if (v && v.path) out.set(v.id, { v, pid: b.progetto_id, q: Imp.leggeraOffline() && (v.leggero || (LOSSLESS.test(v.path) && !Leggere.falliti.has(v.id))) ? 'l' : 'o' })
    }
    return out
  },
  // stato di un gruppo di brani (progetto, Preferiti): quanti voluti e quanti già scaricati
  conta(brani) {
    const voluti = this.voluti()
    let tot = 0, fatti = 0
    for (const b of brani) {
      const x = voluti.get(b.versione_id)
      if (!x) continue
      tot++
      if (this.file.has(b.versione_id)) fatti++
    }
    return { tot, fatti }
  },

  async sincronizza() {
    if (this.inCorso) { this.ancora = true; return }
    this.inCorso = true
    try {
      await this.init()
      const voluti = this.voluti()
      for (const vid of [...this.file.keys()]) if (!voluti.has(vid)) await this.togli(vid)
      for (const [vid, x] of voluti) {
        if (this.file.get(vid) === x.q) continue
        if (Archivio.senzaRete) break
        await this.scarica(vid, x)
        ridisegnaPresto()
      }
      // copertine dei progetti che hanno qualcosa offline
      const pids = new Set([...voluti.values()].map(x => x.pid)), servono = new Set()
      for (const p of Archivio.lib ? Archivio.lib.progetti : []) if (pids.has(p.id) && p.cover) servono.add(p.cover)
      for (const path of servono) {
        if (this.cover.has(path) || Archivio.senzaRete) continue
        try {
          const blob = await (await Dbx.scarica(path)).blob()
          await conCache(c => c.put(BASE_OFF + 'c/' + encodeURIComponent(path), new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })))
          this.cover.set(path, URL.createObjectURL(blob))
        } catch (e) { console.warn('copertina offline', path, e) }
      }
      for (const [path, u] of [...this.cover]) if (!servono.has(path) && Archivio.lib) {
        await conCache(c => c.delete(BASE_OFF + 'c/' + encodeURIComponent(path)))
        URL.revokeObjectURL(u)
        this.cover.delete(path)
      }
    } catch (e) { console.warn('offline', e) }
    finally {
      this.inCorso = false
      ridisegnaPresto()
      if (this.ancora) { this.ancora = false; this.sincronizza() }
    }
  },

  async scarica(vid, { v, q }) {
    const path = q === 'l' && v.leggero ? v.leggero : v.path
    this.scarica_.add(vid)
    ridisegnaPresto()
    try {
      const r = await Dbx.scarica(path)
      if (q === 'l' && !v.leggero) {
        // copia leggera fatta qui: si scarica l'originale, si converte in MP3 320 e si tiene solo quello
        let mp3
        try { mp3 = await Leggere.codifica(await r.arrayBuffer()) }
        catch (e) { Leggere.falliti.add(vid); console.warn('conversione', vid, e); return this.scarica(vid, { v, q: 'o' }) }
        await conCache(c => c.put(BASE_OFF + `v/${vid}.l`, new Response(mp3, { headers: { 'Content-Type': 'audio/mpeg' } })))
      } else
      // dritto nella cache, senza passare tutto dalla memoria (i WAV pesano)
      await conCache(c => c.put(BASE_OFF + `v/${vid}.${q}`, new Response(r.body, { headers: { 'Content-Type': tipoAudio(path) } })))
      const vecchia = this.file.get(vid)
      if (vecchia && vecchia !== q) await conCache(c => c.delete(BASE_OFF + `v/${vid}.${vecchia}`))
      this.file.set(vid, q)
      if (this.url.has(vid) && A.src !== this.url.get(vid)) { URL.revokeObjectURL(this.url.get(vid)); this.url.delete(vid) }
      if (!this.persistente) { this.persistente = true; try { navigator.storage?.persist?.() } catch {} }
    } catch (e) {
      console.warn('scarico offline', vid, e)
      if (!e.stato) Archivio.senzaRete = true  // niente rete: si riprende quando torna
      else if (/insufficient|quota/i.test(e.message)) avviso('Spazio finito sul dispositivo', true)
    } finally { this.scarica_.delete(vid) }
  },

  async togli(vid) {
    const q = this.file.get(vid)
    this.file.delete(vid)
    if (q) await conCache(c => c.delete(BASE_OFF + `v/${vid}.${q}`))
    const u = this.url.get(vid)
    if (u && A.src !== u) { URL.revokeObjectURL(u); this.url.delete(vid) }
  },

  async togliTutto() {
    memo.set('bounces-offline-sel', null)
    for (const vid of [...this.file.keys()]) await this.togli(vid)
    for (const [path, u] of [...this.cover]) { URL.revokeObjectURL(u); await conCache(c => c.delete(BASE_OFF + 'c/' + encodeURIComponent(path))) }
    this.cover.clear()
    ridisegnaPresto()
  },

  async spazio() {
    try { return (await navigator.storage.estimate()).usage || 0 } catch { return 0 }
  },
}

// --- copie leggere (MP3 320) ---
const Leggere = {
  lavoratore: null, attese: new Map(), n: 0, fila: Promise.resolve(), falliti: new Set(), ora: null,

  async codifica(dati) {
    const ctx = new OfflineAudioContext(2, 1, 44100)  // tutto a 44,1 kHz, come i file da ascolto
    const buf = await ctx.decodeAudioData(dati)
    const canali = []
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) canali.push(new Float32Array(buf.getChannelData(c)))
    this.lavoratore ||= Object.assign(new Worker('leggero.js'), {
      onmessage: e => { this.attese.get(e.data.id)?.(e.data); this.attese.delete(e.data.id) },
    })
    const id = ++this.n
    const r = await new Promise(ok => { this.attese.set(id, ok); this.lavoratore.postMessage({ id, sr: buf.sampleRate, canali }, canali.map(c => c.buffer)) })
    if (r.errore) throw new Error(r.errore)
    return r.blob
  },

  // una alla volta (memoria): dati = funzione che dà l'ArrayBuffer del file originale
  crea(vid, dati) {
    this.fila = this.fila.then(async () => {
      const v = versione(vid)
      if (!v || v.leggero || !LOSSLESS.test(v.path || '')) return
      this.ora = vid
      try {
        await salvaLeggera(vid, await this.codifica(await dati()))
        Off.sincronizza()  // chi ha la versione offline in originale passa a quella leggera
      } catch (e) { this.falliti.add(vid); console.warn('copia leggera', vid, e) }
      finally { this.ora = null }
    })
    return this.fila
  },

  // le versioni attive ancora senza copia leggera (prima quelle ascoltate di recente)
  daFare() {
    const l = Archivio.lib
    if (!l) return []
    const perV = new Map(l.versioni.map(v => [v.id, v])), perP = new Map(l.progetti.map(p => [p.id, p]))
    return l.brani.map(b => ({ v: perV.get(b.versione_attiva), p: perP.get(b.progetto_id) }))
      .filter(x => x.v && x.v.path && !x.v.leggero && LOSSLESS.test(x.v.path) && !this.falliti.has(x.v.id))
      .sort((a, b) => ((b.p && b.p.ascoltato) || 0) - ((a.p && a.p.ascoltato) || 0))
      .map(x => x.v)
  },

  // (non più usata dal 09/11 sera: le copie non vanno più su Dropbox)
  async avvia() {
    if (MOBILE || this.avviato || S.ospite) return
    this.avviato = true
    await pausa(8000)
    for (;;) {
      if (S.ospite || !Dbx.collegato()) { this.avviato = false; return }
      if (Archivio.senzaRete) { await pausa(60000); continue }
      const v = this.daFare()[0]
      if (!v) { await pausa(5 * 60e3); continue }  // ricontrolla ogni tanto (versioni caricate da altri dispositivi)
      await this.crea(v.id, async () => (await Dbx.scarica(v.path)).arrayBuffer())
      if (!versione(v.id)?.leggero) this.falliti.add(v.id)
    }
  },
  conteggio() {
    const l = Archivio.lib
    if (!l) return { fatte: 0, tot: 0 }
    const perV = new Map(l.versioni.map(v => [v.id, v]))
    const att = l.brani.map(b => perV.get(b.versione_attiva)).filter(v => v && v.path && LOSSLESS.test(v.path))
    return { fatte: att.filter(v => v.leggero).length, tot: att.length }
  },
}

// --- sul telefono: il prossimo brano intero in memoria (contro i buchi di rete) ---
const Tmp = {
  mappa: new Map(),  // vid → { url }
  MAX: 3,
  pronto(vid) { return this.mappa.get(vid)?.url || null },
  // il prossimo della coda: quando il brano in ascolto è tutto nel buffer, o dopo 15 s di ascolto (i browser non
  // bufferizzano mai tutto da soli; con la copia leggera, 40 KB/s, i due download insieme non si danno fastidio)
  dopo(vid, sorgenteRete) {
    clearInterval(this.attesa)
    if (!MOBILE || Off.ha(vid) || this.mappa.has(vid)) return
    const ora = S.coda[S.i]
    const pieno = () => A.src.startsWith('blob:') || A.currentTime > 15 || (A.duration > 0 && A.buffered.length && A.buffered.end(A.buffered.length - 1) >= A.duration - 0.5)
    const prova = () => {
      if (S.coda[S.i] !== ora) return clearInterval(this.attesa)
      if (!pieno()) return
      clearInterval(this.attesa)
      this.carica(vid, sorgenteRete)
    }
    this.attesa = setInterval(prova, 2000)
    prova()
  },
  carica(vid, sorgenteRete) {
    if (!MOBILE || !vid || Off.ha(vid) || this.mappa.has(vid)) return
    const v = versione(vid)
    if (v && !v.leggero && (v.dimensione || 0) > 90e6) return  // WAV enormi: in memoria no
    const voce = { url: null }
    this.mappa.set(vid, voce)
    ;(async () => {
      const r = await fetch(await sorgenteRete(vid))
      if (!r.ok) throw new Error('scarico ' + r.status)
      const blob = await r.blob()
      if (this.mappa.get(vid) !== voce) return
      voce.url = URL.createObjectURL(blob)
      salvagente()
    })().catch(() => { if (this.mappa.get(vid) === voce) this.mappa.delete(vid) })
    for (const [x, y] of this.mappa) {
      if (this.mappa.size <= this.MAX) break
      if (x === vid || x === S.coda[S.i]?.vid || (y.url && A.src === y.url)) continue
      if (y.url) URL.revokeObjectURL(y.url)
      this.mappa.delete(x)
    }
  },
}
// l'audio si è fermato ad aspettare la rete e il brano è già tutto in memoria: si passa a quello, dallo stesso punto
function salvagente() {
  const c = S.coda[S.i], u = c && Tmp.pronto(c.vid)
  if (!u || A.src === u || A.src.startsWith('blob:') || A.paused || A.readyState >= 3) return
  const dove = A.currentTime
  A.src = u
  quandoPronto(() => { salta(dove); A.play().catch(() => {}) })
}
