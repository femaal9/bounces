// Bounces: Inediti online (23/10), stessa grafica Spotify. Libreria a sinistra (progetti, autori, cartelle),
// pagine progetto / autore / Preferiti come album e playlist, pannello "in riproduzione" a destra, player sotto.
// I dati stanno nel Dropbox di chi la usa: api() e i caricamenti sono in archivio.js, qui c'è solo l'interfaccia.
// Gli autori vengono dai titoli: "TITOLO - Interprete (Autore, Autore)"; "(DEMO V2)" è un'etichetta, non un autore.
// Rotte: #/  #/cerca  #/libreria  #/progetti  #/progetto/ID  #/autore/CHIAVE  #/preferiti  #/cartella/ID
//        #/ascolta/DATI (link d'ascolto condiviso: si apre senza account)
'use strict'
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|flac|ogg|aiff?|aifc|caf)$/i
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const IC = {
  play: '<svg viewBox="0 0 24 24"><path d="M7.05 3.6A1 1 0 0 0 5.5 4.47v15.06a1 1 0 0 0 1.55.87l12.04-7.53a1 1 0 0 0 0-1.74z"/></svg>',
  pausa: '<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="4.5" height="16" rx="1"/><rect x="14" y="4" width="4.5" height="16" rx="1"/></svg>',
  prec: '<svg viewBox="0 0 24 24"><path d="M6 4h2v16H6zM19 5v14a1 1 0 0 1-1.5.86L9 12.86a1 1 0 0 1 0-1.72l8.5-7A1 1 0 0 1 19 5z"/></svg>',
  succ: '<svg viewBox="0 0 24 24"><path d="M16 4h2v16h-2zM5 5v14a1 1 0 0 0 1.5.86l8.5-7a1 1 0 0 0 0-1.72l-8.5-7A1 1 0 0 0 5 5z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l3 3-3 3"/><path d="M4 12V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 12v3a3 3 0 0 1-3 3H4"/></svg>',
  casuale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
  piu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  piuCerchio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 8v8M8 12h8"/></svg>',
  scarica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  cestino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  commento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/></svg>',
  ordine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h11M4 18h6"/></svg>',
  maniglia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h16M4 12h16M4 16h16"/></svg>',
  spillo: '<svg viewBox="0 0 24 24"><path d="M14.6 2.3a1 1 0 0 1 1.4 0l5.7 5.7a1 1 0 0 1-.3 1.6l-3.3 1.5-3 3 .6 4.1a1 1 0 0 1-1.7.9l-3.6-3.6-5.7 5.7a1 1 0 0 1-1.4-1.4l5.7-5.7-3.6-3.6a1 1 0 0 1 .9-1.7l4.1.6 3-3 1.5-3.3a1 1 0 0 1 .2-.3z"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  muto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  altro: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  casa: '<svg viewBox="0 0 24 24"><path d="M12.5 3.25a1 1 0 0 0-1 0l-7.5 4.4A2 2 0 0 0 3 9.38V20a1 1 0 0 0 1 1h5.5v-6.5h5V21H20a1 1 0 0 0 1-1V9.38a2 2 0 0 0-1-1.73z"/></svg>',
  giu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  indietro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  cerca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
  libreria: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 3v18M9 3v18M14 4l6 16"/></svg>',
  cuore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.4 3.7 4 7.2 4c2 0 3.5 1.1 4.8 2.8C13.3 5.1 14.8 4 16.8 4c3.5 0 5.6 3.4 4.4 6.7C19.5 15.4 12 20 12 20z"/></svg>',
  cuorePieno: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.8-4.7-9.6-9.6C1.1 7.2 3.4 3.5 7.2 3.5c2 0 3.6 1 4.8 2.6 1.2-1.6 2.8-2.6 4.8-2.6 3.8 0 6.1 3.7 4.8 7.4-1.8 4.9-9.6 9.6-9.6 9.6z"/></svg>',
  orologio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cartella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
  pannello: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>',
  matita: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  mano: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
}

// --- formati ---
const due = n => String(n).padStart(2, '0')
function tempo(s) {
  s = Math.max(0, Math.floor(s || 0))
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60
  return h ? `${h}:${due(m)}:${due(s % 60)}` : `${m}:${due(s % 60)}`
}
const minuti = s => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round(s % 3600 / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`
function quando(t) {
  if (!t) return ''
  const d = new Date(t * 1000), oggi = new Date(), giorni = Math.round((new Date(oggi.toDateString()) - new Date(d.toDateString())) / 864e5)
  if (giorni === 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  if (giorni < 7) return `${giorni} giorni fa`
  if (giorni < 28) return `${Math.floor(giorni / 7)} sett. fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: d.getFullYear() === oggi.getFullYear() ? undefined : 'numeric' })
}
const nBrani = n => n === 1 ? '1 brano' : `${n} brani`
const bpmDi = v => v && (v.bpm || v.bpm_auto)
const keyDi = v => v && (v.tonalita || v.tonalita_auto) || ''

// colori: quello di base di ogni sfumatura (per gli header), quello medio delle copertine vere calcolato al volo
const COLORI = { 1: '#c4417f', 2: '#0b6fd8', 3: '#d99a12', 4: '#159e73', 5: '#e0867d', 6: '#6a62c0', 7: '#e0405c', 8: '#3a8394', 9: '#3b4c72', 10: '#c066d6' }
const coloriCover = new Map()
function coloreDi(p) {
  if (!p) return '#535353'
  if (p.cover) {
    const chiave = `${p.cover}:${p.modificato}`, url = urlCover(p)
    if (coloriCover.has(chiave)) return coloriCover.get(chiave)
    if (!url) return '#535353'
    coloriCover.set(chiave, '#535353')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'), g = cv.getContext('2d')
        cv.width = cv.height = 8
        g.drawImage(img, 0, 0, 8, 8)
        const d = g.getImageData(0, 0, 8, 8).data
        let r = 0, gg = 0, b = 0
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2] }
        coloriCover.set(chiave, `rgb(${r / 64 | 0}, ${gg / 64 | 0}, ${b / 64 | 0})`)
        ridisegnaPresto()
      } catch {}  // se Dropbox non permette di leggere i pixel resta il grigio
    }
    img.src = url
    return '#535353'
  }
  return COLORI[p.sfondo] || COLORI[1]
}
function coloreTesto(s) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORI[h % 10 + 1]
}
// copertine: link temporaneo di Dropbox (arriva un attimo dopo: intanto grigio), nei link d'ascolto un link pubblico
const urlCover = p => !p || !p.cover ? null : p.coverUrl || Dbx.linkSubito(p.cover, ridisegnaPresto)
const coverStile = p => { const u = urlCover(p); return u ? `style="background-image:url('${u}')"` : '' }
const coverClasse = p => p && p.cover ? 'cover' : `cover sf-${(p && p.sfondo) || 1}`
const coverHtml = (p, extra = '') => `<div class="${coverClasse(p)} ${extra}" ${coverStile(p)}></div>`
const iniziali = nome => nome.split(/\s+/).map(x => x[0]).join('').slice(0, 2)
// con la foto dell'autore se c'è (25/10), altrimenti le iniziali sul suo colore
const urlFotoAutore = a => { const p = S.lib && S.lib.foto_autori && S.lib.foto_autori[a.chiave]; return p ? Dbx.linkSubito(p, ridisegnaPresto) : null }
const avatarHtml = (a, extra = '') => {
  const u = urlFotoAutore(a)
  return `<div class="avatar ${u ? 'foto' : ''} ${extra}" style="background-color:${coloreTesto(a.chiave)}${u ? `;background-image:url('${u}')` : ''}">${u ? '' : esc(iniziali(a.nome))}${extra ? '<span class="cambia">Scegli foto</span>' : ''}</div>`
}

// --- titoli: nome, interprete, etichetta (DEMO V2...) e autori ---
const ETICHETTA = /^(demo|mix|master|v\s?\d|rough|cut|bozza|provino|strum|instr|edit|rmx|remix|live|acustic|acoustic|rev|alt|radio|ref)\b/i
// autori sempre in ordine alfabetico, sotto il titolo e nel titolo salvato (25/10, Matteo)
const perNome = (a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' })
function scomponi(titolo) {
  let t = String(titolo || '').trim(), tag = '', autori = [], interprete = ''
  const m = t.match(/\s*\(([^()]*)\)\s*$/)
  if (m) {
    const dentro = m[1].trim()
    if (ETICHETTA.test(dentro)) tag = dentro
    else autori = dentro.split(/\s*,\s*|\s+-\s+|\s*&\s*/).map(a => a.replace(/^([A-Za-z]\.\s*)+/, '').trim()).filter(Boolean).sort(perNome)
    t = t.slice(0, m.index).trim()
  }
  const d = t.match(/^(.*?)\s+-\s*(.*)$/)
  if (d) { t = d[1].trim(); interprete = d[2].trim() }
  return { nome: (t || String(titolo || '')).toLocaleUpperCase('it'), interprete, tag, autori }  // titoli sempre in maiuscolo
}
// 26/10, Matteo: nome artista sotto il titolo del brano sempre in MAIUSCOLO, solo a schermo (i dati restano come sono)
const maiu = s => String(s || '').toLocaleUpperCase('it')
const maiuscoleIniziali = s => s.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase())

// --- stato ---
const S = {
  lib: null, perId: new Map(), perBrano: new Map(), info: new Map(), autori: [], perAutore: new Map(),
  schermo: false,    // telefono: player a schermo intero aperto
  pann: null,        // {bid, prog}: brano aperto nel pannello a destra, col dettaglio del suo progetto
  scelta: null,      // riga selezionata
  coda: [], i: -1, contesto: null, dett: null, loop: false, casuale: false,
  filtro: 'progetti', sporco: false,
}
let premuto = false

function avviso(testo, errore = false) {
  const el = document.createElement('div')
  el.className = 'avviso' + (errore ? ' errore' : '')
  el.textContent = testo
  $('#avvisi').append(el)
  setTimeout(() => el.remove(), errore ? 5000 : 2600)
}
const sbaglio = e => { console.error(e); avviso(e.message || String(e), true) }

// --- dati ---
async function caricaLib() {
  S.lib = S.ospite ? S.ospite.lib : await api('GET', '/api/libreria')
  S.perId = new Map(S.lib.progetti.map(p => [p.id, p]))
  S.perBrano = new Map(S.lib.brani.map(b => [b.id, b]))
  S.info = new Map()
  const autori = new Map()
  for (const b of S.lib.brani) {
    const x = scomponi(b.titolo)
    S.info.set(b.id, x)
    for (const a of x.autori) {
      const k = norm(a)
      if (!k) continue
      if (!autori.has(k)) autori.set(k, { chiave: k, forme: {}, brani: [] })
      const e = autori.get(k)
      e.forme[a] = (e.forme[a] || 0) + 1
      e.brani.push(b)
    }
  }
  for (const e of autori.values()) {
    // "RONDINE" e "Rondine" sono la stessa persona: vince la forma scritta normale; le sigle corte (GRND) restano maiuscole
    const forme = Object.keys(e.forme).sort((a, b) => e.forme[b] - e.forme[a])
    e.nome = forme.find(f => f !== f.toUpperCase()) || (forme[0].length <= 4 ? forme[0] : maiuscoleIniziali(forme[0]))
    e.progetti = new Set(e.brani.map(b => b.progetto_id)).size
    e.brani.sort(alfabetico)
  }
  S.autori = [...autori.values()].sort((a, b) => b.brani.length - a.brani.length || a.nome.localeCompare(b.nome))
  S.perAutore = autori
}
const alfabetico = (a, b) => S.info.get(a.id).nome.localeCompare(S.info.get(b.id).nome, 'it', { sensitivity: 'base', numeric: true }) || a.id - b.id
const braniDi = pid => S.lib.brani.filter(b => b.progetto_id === pid)
  .sort(S.perId.get(pid)?.ordine_manuale ? (a, b) => a.ordine - b.ordine || a.id - b.id : alfabetico)
const preferiti = () => S.lib.brani.filter(b => b.preferito).sort((a, b) => (b.preferito_il || 0) - (a.preferito_il || 0))
// ordine della libreria (25/10, Matteo): ultimi ascoltati, alfabetico o personalizzato. I fissati restano sempre in cima
const ORDINI = { ascoltati: 'Ultimi ascoltati', alfabetico: 'Alfabetico', personale: 'Personalizzato' }
const perOrdine = {
  ascoltati: (a, b) => (b.ascoltato || 0) - (a.ascoltato || 0) || b.modificato - a.modificato,
  alfabetico: (a, b) => a.titolo.localeCompare(b.titolo, 'it', { sensitivity: 'base', numeric: true }),
  // i progetti nuovi (ancora senza posizione) vanno in cima, finché non li sposti
  personale: (a, b) => (a.posizione ?? -1) - (b.posizione ?? -1) || b.modificato - a.modificato,
}
const progettiOrdinati = () => S.lib.progetti.slice().sort((a, b) => (b.fissato - a.fissato) || (perOrdine[S.lib.ordine] || perOrdine.ascoltati)(a, b))

// la lista di brani di un contesto di ascolto ("progetto:3", "autore:rondine", "preferiti")
function braniContesto(ctx) {
  const [tipo, arg] = ctx.split(/:(.*)/)
  if (tipo === 'progetto') return braniDi(+arg)
  if (tipo === 'autore') return (S.perAutore.get(arg) || { brani: [] }).brani
  if (tipo === 'preferiti') return preferiti()
  return []
}

function campoAttivo() {
  const a = document.activeElement
  return a && a.matches('input:not([type=checkbox]), textarea, select') && a.closest('#principale, #pannello')
}

async function ricarica() {
  try {
    await caricaLib()
    if (S.pann) {
      if (!S.perBrano.has(S.pann.bid)) S.pann = null
      else S.pann.prog = await api('GET', `/api/progetti/${S.perBrano.get(S.pann.bid).progetto_id}`)
    }
    const c = S.coda[S.i]
    if (c) S.dett = await api('GET', `/api/versioni/${c.vid}`).catch(() => S.dett)
  } catch (e) { return sbaglio(e) }
  ridisegna()
}

// né mentre si scrive né a tasto premuto (il clic finirebbe su un elemento appena sostituito)
function ridisegna() {
  if (!S.lib) return
  if (campoAttivo() || premuto) { S.sporco = true; return }
  S.sporco = false
  const main = $('#principale'), su = main.scrollTop
  disegnaPagina()
  main.scrollTop = su
  disegnaLibreria()
  pannello()
  disegnaPlayer()
  barraTelefono()
}
let attesaDisegno = 0
function ridisegnaPresto() { cancelAnimationFrame(attesaDisegno); attesaDisegno = requestAnimationFrame(ridisegna) }
document.addEventListener('focusout', () => setTimeout(() => S.sporco && ridisegna(), 0))
document.addEventListener('pointerdown', () => { premuto = true }, true)
document.addEventListener('pointerup', () => { premuto = false; setTimeout(() => S.sporco && ridisegna(), 50) }, true)

function rotta() {
  const m = location.hash.match(/^#\/(\w*)\/?(.*)$/) || []
  return { vista: m[1] || '', arg: decodeURIComponent(m[2] || '') }
}

async function mostra() {
  const { vista, arg } = rotta()
  document.body.classList.toggle('ospite', vista === 'ascolta')
  if (vista === 'ascolta') {
    // link d'ascolto: niente account, la "libreria" è il progetto condiviso
    if (!S.ospite || S.ospite.chiave !== arg) {
      let d
      try { d = JSON.parse(await decomprimi(arg)) } catch { S.ospite = null; return benvenuto('Questo link d’ascolto non è valido o è incompleto.') }
      // link nuovi: dentro c'è solo l'indirizzo della scheda su Dropbox, che si legge ogni volta (sempre aggiornata)
      let scheda = d
      if (d.m) {
        try { scheda = await leggiScheda(d.m) }
        catch { S.ospite = null; return benvenuto('Questo link d’ascolto non è più attivo: chiedi un link nuovo a chi te l’ha mandato.') }
      }
      S.ospite = { chiave: arg, scheda: d.m || null, lib: libOspite(scheda) }
      S.lib = null; S.coda = []; S.i = -1; S.pann = null
    }
  } else {
    if (S.ospite) { S.ospite = null; S.lib = null; A.pause(); S.coda = []; S.i = -1 }
    if (!Dbx.collegato()) return benvenuto()
    mostraAccount()
  }
  document.body.classList.remove('fuori')
  try { if (!S.lib) await caricaLib() } catch (e) { return sbaglio(e) }
  if (vista !== 'cerca' && $('#cerca').value && document.activeElement !== $('#cerca')) $('#cerca').value = ''
  ridisegna()
  $('#principale').scrollTop = 0
}
window.addEventListener('hashchange', mostra)

function benvenuto(msg = '') {
  document.body.classList.add('fuori')
  $('#principale').innerHTML = `<div class="benvenuto">
    <div class="logo-grande">BOUNCES</div>
    <h1>Tutti i tuoi bounce, in un posto solo.</h1>
    <p>Progetti, versioni, commenti al minuto e link d'ascolto per gli artisti. I file restano nel tuo Dropbox,
      in una cartella tutta per Bounces: l'app non vede nient'altro.</p>
    ${msg ? `<p class="muted">${esc(msg)}</p>` : ''}
    <button class="btn pieno grande" data-az="entra">Collega Dropbox</button></div>`
}

// i dati di un link d'ascolto: {t: titolo, a: artista, s: sfondo, c: cover, b: [[titolo, url, durata, tonalità, bpm], ...]}
function libOspite(d) {
  const ora = Date.now() / 1000
  const brani = (d.b || []).map(([titolo, url, durata, key, bpm, stato, artista, pc], i) => ({ id: i + 10, progetto_id: 1, titolo, artista: artista || '', ordine: i, creato: ora,
    picchi: pc ? [...pc].map(x => +x / 9) : null,
    preferito: 0, versione_id: i + 1000, etichetta: '', stato: stato || null, bpm: bpm || null, tonalita: key || null, durata, audio: 1, nver: 1, ncom: 0, url }))
  const p = { id: 1, titolo: d.t || 'Progetto', artista: d.a || '', nota: '', cover: d.c ? 'condivisa' : null, coverUrl: d.c, sfondo: d.s || 1,
    fissato: 0, cartella_id: null, creato: ora, modificato: ora, n_brani: brani.length, senza_audio: 0,
    durata: brani.reduce((s, b) => s + (b.durata || 0), 0) }
  return { progetti: [p], cartelle: [], brani }
}

let accountMostrato = false
async function mostraAccount() {
  if (accountMostrato) return
  accountMostrato = true
  const b = $('#account')
  let nome = memo.get('bounces-nome')
  if (!nome) {
    try { const a = await Dbx.account(); nome = a.name.display_name; memo.set('bounces-nome', nome) } catch { nome = 'Dropbox' }
  }
  b.hidden = false
  b.textContent = iniziali(nome)
  b.title = nome
  b.style.background = coloreTesto(norm(nome))
}

// --- libreria a sinistra ---
function disegnaLibreria(dove = $('#lib-lista')) {
  const { vista, arg } = rotta()
  const c = S.coda[S.i]
  $$('#lib-chips button').forEach(b => b.classList.toggle('on', b.dataset.filtro === S.filtro))
  let html = ''
  if (S.filtro === 'autori') {
    html = S.autori.map(a => `<a class="voce ${vista === 'autore' && arg === a.chiave ? 'attiva' : ''} ${S.contesto === 'autore:' + a.chiave && c ? 'suona' : ''}" href="#/autore/${encodeURIComponent(a.chiave)}">
      ${avatarHtml(a)}<span class="vt"><b>${esc(a.nome)}</b><small>Autore · ${nBrani(a.brani.length)}</small></span></a>`).join('')
  } else if (S.filtro === 'cartelle') {
    html = S.lib.cartelle.map(f => `<a class="voce ${vista === 'cartella' && +arg === f.id ? 'attiva' : ''}" href="#/cartella/${f.id}">
      <div class="cover cartella">${IC.cartella}</div><span class="vt"><b>${esc(f.titolo)}</b><small>Cartella · ${f.n === 1 ? '1 progetto' : (f.n || 0) + ' progetti'}</small></span></a>`).join('')
      || '<p class="muted" style="padding:8px">Nessuna cartella. Creane una col +.</p>'
  } else {
    const np = preferiti().length, pers = S.lib.ordine === 'personale' && !S.ospite
    html = (S.ospite ? '' : `<button class="lib-ordine" data-az="ordine-lib" title="Ordina per">${esc(ORDINI[S.lib.ordine] || ORDINI.ascoltati)}${IC.ordine}</button>`)
      + `<a class="voce ${vista === 'preferiti' ? 'attiva' : ''} ${S.contesto === 'preferiti' && c ? 'suona' : ''}" href="#/preferiti">
        <div class="cover preferiti">${IC.cuorePieno}</div><span class="vt"><b>Preferiti</b><small>${IC.spillo}Playlist · ${nBrani(np)}</small></span></a>`
      + progettiOrdinati().map(p => `<a class="voce ${vista === 'progetto' && +arg === p.id ? 'attiva' : ''} ${c && c.pid === p.id ? 'suona' : ''} ${p.fissato ? 'fissato' : ''}" href="#/progetto/${p.id}" data-p="${p.id}" ${pers ? 'draggable="false"' : ''}>
        ${coverHtml(p)}<span class="vt"><b>${esc(p.titolo)}</b><small>${p.fissato ? IC.spillo : ''}Progetto · ${esc(p.artista || nBrani(p.n_brani))}</small></span>
        ${c && c.pid === p.id && !A.paused ? `<span class="suono">${IC.volume}</span>` : ''}
        ${pers && !p.fissato ? `<span class="maniglia" data-az="maniglia" title="Trascina per spostare">${IC.maniglia}</span>` : ''}</a>`).join('')
  }
  dove.innerHTML = html
}

// --- schede e tracklist ---
function card(p) {
  const ctx = 'progetto:' + p.id
  return `<a class="card" href="#/progetto/${p.id}"><div class="cw">${coverHtml(p)}
    ${p.n_brani > p.senza_audio ? `<button class="pv ${suonaCtx(ctx) ? 'suona' : ''}" data-suona="${ctx}">${suonaCtx(ctx) ? IC.pausa : IC.play}</button>` : ''}</div>
    <b>${esc(p.titolo)}</b><small>${esc([p.artista, nBrani(p.n_brani)].filter(Boolean).join(' · '))}</small></a>`
}
function cardAutore(a) {
  const ctx = 'autore:' + a.chiave
  return `<a class="card" href="#/autore/${encodeURIComponent(a.chiave)}"><div class="cw">${avatarHtml(a)}
    <button class="pv ${suonaCtx(ctx) ? 'suona' : ''}" data-suona="${esc(ctx)}">${suonaCtx(ctx) ? IC.pausa : IC.play}</button></div>
    <b>${esc(a.nome)}</b><small>Autore · ${nBrani(a.brani.length)}</small></a>`
}
const suonaCtx = ctx => S.contesto === ctx && S.coda[S.i] && !A.paused

function tracklist(brani, { multi = false, ordinabile = false } = {}) {
  if (!brani.length) return ''
  return `<div class="tl ${multi ? 'multi' : ''} ${ordinabile ? 'ordinabile' : ''}">
    <div class="tl-testa"><span>#</span><span>Titolo</span>${multi ? '<span class="prog">Progetto</span>' : ''}<span class="ver">Versione</span><span class="nasc">BPM</span><span class="nasc">Tonalità</span><span class="nasc2">Aggiunto</span><span></span><span class="dx">${IC.orologio}</span><span></span></div>
    ${brani.map((b, i) => rigaBrano(b, i, multi, ordinabile)).join('')}</div>`
}
// rinominare un brano direttamente nella lista: il titolo diventa un campo (Invio salva, Esc annulla)
function rinominaInRiga(bid) {
  const r = $(`.tr[data-b="${bid}"]`), b = S.perBrano.get(bid)
  if (!r || !b || $('input.rinomina', r)) return
  const dove = $('.riga-titolo', r)
  dove.innerHTML = `<input class="campo rinomina" value="${esc(b.titolo)}" spellcheck="false" title="Titolo (gli autori tra parentesi in fondo)">`
  const campo = $('input', dove)
  let fatto = false
  const chiudi = async salva => {
    if (fatto) return
    fatto = true
    const nuovo = campo.value.trim()
    campo.blur()
    if (salva && nuovo && nuovo !== b.titolo) {
      try { await api('PATCH', `/api/brani/${bid}`, { titolo: nuovo }); avviso('Titolo cambiato') } catch (e) { sbaglio(e) }
    }
    ricarica()
  }
  campo.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); chiudi(true) }
    if (e.key === 'Escape') { e.stopPropagation(); chiudi(false) }
  })
  campo.addEventListener('blur', () => chiudi(true))
  campo.focus()
  campo.select()
}

// autori di un brano dal menu ⋯ (25/10, Matteo): stanno tra parentesi in fondo al titolo, come sempre,
// così finiscono da soli nella sezione Autori. Si scrivono separati da virgola; sotto, quelli che ci sono già
function autoriBrano(bid) {
  const b = S.perBrano.get(bid), x = S.info.get(bid)
  if (!b || !x) return
  // il titolo senza le parentesi degli autori (un tag tipo "(Remix)" resta)
  const m = b.titolo.match(/\s*\(([^()]*)\)\s*$/)
  const base = m && !ETICHETTA.test(m[1].trim()) ? b.titolo.slice(0, m.index).trim() : b.titolo.trim()
  const fondo = document.createElement('div')
  fondo.className = 'modale-fondo'
  fondo.innerHTML = `<div class="modale">
    <h3>Autori</h3>
    <p>Di <b>${esc(x.nome)}</b>. Separali con una virgola.</p>
    <div class="nuovo-prog"><input placeholder="Es. Matteo Milita, Trilussa" spellcheck="false" value="${esc(x.autori.join(', '))}"></div>
    ${S.autori.length ? `<div class="sottotitolo">Aggiungi uno che c'è già</div>
      <div class="chips autori-noti">${S.autori.map(a => `<button data-autore="${esc(a.nome)}">${esc(a.nome)}</button>`).join('')}</div>` : ''}
    <div class="fondo-modale"><button class="btn" data-annulla>Annulla</button><button class="btn pieno" data-ok>Salva</button></div></div>`
  document.body.append(fondo)
  const campo = $('input', fondo)
  const lista = () => campo.value.split(',').map(a => a.trim()).filter(Boolean)
  const fine = () => fondo.remove()
  const salva = async () => {
    const visti = new Set(), autori = lista().filter(a => !visti.has(norm(a)) && visti.add(norm(a))).sort(perNome)
    const nuovo = autori.length ? `${base} (${autori.join(', ')})` : base
    fine()
    if (nuovo === b.titolo) return
    try { await api('PATCH', `/api/brani/${bid}`, { titolo: nuovo }); avviso(autori.length ? 'Autori salvati' : 'Autori tolti') } catch (e) { sbaglio(e) }
    ricarica()
  }
  fondo.addEventListener('click', e => {
    const a = e.target.closest('[data-autore]')
    if (a) {
      const l = lista()
      if (!l.some(y => norm(y) === norm(a.dataset.autore))) campo.value = [...l, a.dataset.autore].join(', ')
      return campo.focus()
    }
    if (e.target.closest('[data-ok]')) return salva()
    if (e.target.closest('[data-annulla]') || e.target === fondo) fine()
  })
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') salva(); if (e.key === 'Escape') fine() })
  setTimeout(() => { campo.focus(); campo.setSelectionRange(campo.value.length, campo.value.length) }, 50)
}

// numero di versione scritto a mano: "4", "v4", "V 4" → "V4"; il resto resta com'è
const etichettaVersione = t => { const m = t.trim().match(/^v?\s*(\d{1,3})$/i); return m ? 'V' + +m[1] : t.trim() }

// stato della versione (DEMO ... MASTER): tendina colorata, si cambia al volo
const STATI_UI = ['demo', 'prod', 'rec', 'premix', 'mix', 'master']
// la scritta è uno span (centrata ovunque, anche su Safari); sopra c'è la tendina vera, invisibile
const sceltaStato = (vid, stato) => vid ? `<span class="stato" data-s="${stato || ''}"><span>${stato ? stato.toUpperCase() : '—'}</span><select class="stato-sel" data-stato-v="${vid}" title="Stato">
  <option value="">—</option>${STATI_UI.map(s => `<option value="${s}" ${s === stato ? 'selected' : ''}>${s.toUpperCase()}</option>`).join('')}</select></span>` : ''

function rigaBrano(b, i, multi, ordinabile) {
  const x = S.info.get(b.id), p = S.perId.get(b.progetto_id), c = S.coda[S.i]
  const ora = c && c.bid === b.id, suona = ora && !A.paused
  const sotto = [maiu(b.artista || x.interprete), x.autori.join(', ')].filter(Boolean).join(' · ')
  // il link dell'audio si chiede prima del clic: così il play parte subito (e su iPhone parte davvero)
  if (b.audio && !S.ospite) Dbx.linkSubito(Archivio.percorso(b.versione_id))
  return `<div class="tr ${b.audio ? '' : 'muto'} ${ora ? 'ora' : ''} ${S.scelta === b.id ? 'scelta' : ''}" data-b="${b.id}" ${ordinabile ? 'draggable="true"' : ''}>
    <span class="n">${suona ? '<span class="eq"><i></i><i></i><i></i></span>' : `<i>${i + 1}</i>`}${b.audio ? `<button data-az="suona" title="Riproduci">${suona ? IC.pausa : IC.play}</button>` : ''}</span>
    <span class="tit">${multi ? coverHtml(p, 'mini') : ''}<span class="tt"><span class="riga-titolo"><b>${esc(x.nome)}</b>${S.ospite ? '' : `<button class="matita" data-az="rinomina" title="Rinomina">${IC.matita}</button>`}</span><small>${x.tag ? `<em class="tag">${esc(x.tag)}</em>` : ''}${b.audio ? '' : '<em class="senza">SENZA AUDIO</em>'}${esc(sotto)}</small></span></span>
    ${multi ? `<a class="prog" href="#/progetto/${p.id}">${esc(p.titolo)}</a>` : ''}
    <span class="ver">${S.ospite ? esc(b.etichetta || '') : `<input class="campo ver-num" data-etichetta-v="${b.versione_id}" value="${esc(b.etichetta || '')}" spellcheck="false" title="Numero di versione: scrivi 4 o V4"><span class="ver-et">${esc(b.etichetta || '')}</span>`}${S.ospite ? (b.stato ? ` <em class="stato" data-s="${b.stato}">${b.stato.toUpperCase()}</em>` : '') : sceltaStato(b.versione_id, b.stato)}</span>
    <span class="nasc ${b.bpm ? '' : 'auto'}">${bpmDi(b) ? Math.round(bpmDi(b)) : ''}</span>
    <span class="nasc ${b.tonalita ? '' : 'auto'}">${esc(keyDi(b))}</span>
    <span class="nasc2">${quando(b.creato)}</span>
    <button class="cuore ${b.preferito ? 'on' : ''}" data-az="cuore" title="${b.preferito ? 'Togli dai Preferiti' : 'Aggiungi ai Preferiti'}">${b.preferito ? IC.cuorePieno : IC.cuore}</button>
    <span class="dx">${b.ncom ? `<span class="ncom" title="${b.ncom} commenti">${IC.commento}${b.ncom}</span>` : ''}${b.durata ? tempo(b.durata) : ''}</span>
    <button class="altro" data-az="apri" title="Versioni, note e commenti">${IC.altro}</button>
  </div>`
}

// --- pagine ---
function disegnaPagina() {
  const { vista, arg } = rotta()
  const pag = S.ospite ? pagAscolta : { '': pagHome, cerca: pagCerca, libreria: pagLibreria, progetti: pagProgetti, progetto: pagProgetto,
    autore: pagAutore, preferiti: pagPreferiti, cartella: pagCartella }[vista] || pagHome
  $('#principale').innerHTML = pag(arg)
  $('#vai-home').classList.toggle('on', vista === '')
  $$('#schede a').forEach(a => a.classList.toggle('on', a.dataset.scheda === vista))
}

function saluto() {
  const h = new Date().getHours()
  return h < 5 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
}

function pagHome() {
  const tutti = progettiOrdinati(), recenti = S.lib.progetti.slice(0, 8)
  if (!tutti.length) return `<div class="pagina sopra"><h1 class="saluto">${saluto()}</h1>
    <div class="vuoto"><b>Ancora niente qui</b>Trascina una cartella di bounce per creare il primo progetto:
    i file vanno nel tuo Dropbox, in Applicazioni/Bounces.<br><br>
    <button class="btn pieno" data-az="nuovo-progetto">Nuovo progetto</button></div></div>`
  const fissati = tutti.filter(p => p.fissato)
  const nuovi = S.lib.brani.slice().sort((a, b) => b.creato - a.creato).slice(0, 5)
  return `<div class="sfondo-alto" style="--c:${coloreDi(recenti[0])}"></div>
  <div class="pagina sopra">
    <h1 class="saluto">${saluto()}</h1>
    <div class="scorciatoie">${recenti.map(p => {
      const ctx = 'progetto:' + p.id
      return `<a class="scorciatoia" href="#/progetto/${p.id}">${coverHtml(p)}<b>${esc(p.titolo)}</b>
        ${p.n_brani > p.senza_audio ? `<button class="pv ${suonaCtx(ctx) ? 'suona' : ''}" data-suona="${ctx}">${suonaCtx(ctx) ? IC.pausa : IC.play}</button>` : ''}</a>`
    }).join('')}</div>
    <div class="sezione-t"><h2>Aggiornati di recente</h2><a href="#/progetti">Mostra tutto</a></div>
    <div class="fila"><a class="card nuova" href="#" data-az="nuovo-progetto"><div class="cw"><div class="cover">${IC.piu}</div></div><b>Nuovo progetto</b><small>o trascina qui una cartella di bounce</small></a>${S.lib.progetti.map(card).join('')}</div>
    ${fissati.length ? `<div class="sezione-t"><h2>Fissati</h2></div><div class="fila">${fissati.map(card).join('')}</div>` : ''}
    ${S.autori.length ? `<div class="sezione-t"><h2>I tuoi autori</h2><a href="#/libreria" data-az="filtro" data-arg="autori">Mostra tutto</a></div>
      <div class="fila">${S.autori.map(cardAutore).join('')}</div>` : ''}
    <div class="sezione-t"><h2>Aggiunti di recente</h2></div>
  </div>
  ${tracklist(nuovi, { multi: true })}`
}

function pagProgetti() {
  return `<div class="pagina sopra"><div class="sezione-t"><h2>Tutti i progetti</h2></div>
    <div class="griglia">${S.lib.progetti.map(card).join('')}</div></div>`
}

function pagLibreria() {
  // sul telefono la libreria non sta a lato: è una pagina
  const tmp = document.createElement('div')
  disegnaLibreria(tmp)
  return `<div class="pagina sopra"><div class="sezione-t"><h2>La tua libreria</h2><button class="ic tondo-ic" data-az="crea">${IC.piu}</button></div>
    <button class="zona-auto" data-az="carica-auto">${IC.piuCerchio}<span><b>Carica bounce</b><small>Li metto io nel progetto giusto, leggendo il nome</small></span></button>
    <div class="chips" style="margin-bottom:12px">${['progetti', 'autori', 'cartelle'].map(f =>
      `<button data-az="filtro" data-arg="${f}" class="${S.filtro === f ? 'on' : ''}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
    <nav>${tmp.innerHTML}</nav></div>`
}

function pagCerca() {
  const testo = $('#cerca').value.trim(), q = norm(testo)
  if (!q) {
    return `<div class="pagina sopra"><div class="sezione-t"><h2>Sfoglia tutto</h2></div>
      <div class="sfoglia">${progettiOrdinati().map(p => `<a class="tessera" href="#/progetto/${p.id}" style="--c:${coloreDi(p)}">${esc(p.titolo)}${coverHtml(p)}</a>`).join('')}</div></div>`
  }
  const progetti = S.lib.progetti.filter(p => norm(p.titolo + ' ' + p.artista).includes(q))
  const autori = S.autori.filter(a => norm(a.nome).includes(q))
  const brani = S.lib.brani.filter(b => norm(b.titolo + ' ' + (b.artista || '')).includes(q))
  if (!progetti.length && !autori.length && !brani.length) {
    return `<div class="pagina sopra"><div class="vuoto"><b>Nessun risultato per “${esc(testo)}”</b>Controlla l'ortografia o prova un'altra parola.</div></div>`
  }
  const primo = autori.find(a => norm(a.nome) === q) || progetti[0] || autori[0]
  let alto = ''
  if (primo) {
    const eAutore = !!primo.chiave
    const ctx = eAutore ? 'autore:' + primo.chiave : 'progetto:' + primo.id
    alto = `<a class="principale-ris" href="${eAutore ? '#/autore/' + encodeURIComponent(primo.chiave) : '#/progetto/' + primo.id}">
      ${eAutore ? avatarHtml(primo) : coverHtml(primo)}<b>${esc(eAutore ? primo.nome : primo.titolo)}</b>
      <small>${eAutore ? nBrani(primo.brani.length) : esc(primo.artista || nBrani(primo.n_brani))}<span class="chip">${eAutore ? 'Autore' : 'Progetto'}</span></small>
      <button class="pv" data-suona="${esc(ctx)}">${suonaCtx(ctx) ? IC.pausa : IC.play}</button></a>`
  }
  return `<div class="pagina sopra">
    <div class="risultati-alto">
      ${alto ? `<div><div class="sezione-t"><h2>Risultato principale</h2></div>${alto}</div>` : ''}
      ${brani.length ? `<div><div class="sezione-t"><h2>Brani</h2></div>${tracklist(brani.slice(0, 4), { multi: true })}</div>` : ''}
    </div>
    ${brani.length > 4 ? `<div class="sezione-t"><h2>Tutti i brani</h2></div>${tracklist(brani, { multi: true })}` : ''}
    ${progetti.length ? `<div class="sezione-t"><h2>Progetti</h2></div><div class="fila">${progetti.map(card).join('')}</div>` : ''}
    ${autori.length ? `<div class="sezione-t"><h2>Autori</h2></div><div class="fila">${autori.map(cardAutore).join('')}</div>` : ''}
  </div>`
}

function bottonePlay(ctx, brani) {
  if (!brani.some(b => b.audio)) return ''
  return `<button class="pv grande" data-suona="${esc(ctx)}" title="Riproduci">${suonaCtx(ctx) ? IC.pausa : IC.play}</button>`
}

function pagProgetto(arg) {
  const p = S.perId.get(+arg)
  if (!p) return '<div class="pagina sopra"><div class="vuoto"><b>Progetto non trovato</b></div></div>'
  const brani = braniDi(p.id), ctx = 'progetto:' + p.id, col = coloreDi(p)
  const durata = brani.reduce((s, b) => s + (b.durata || 0), 0)
  const senza = brani.filter(b => !b.audio).length
  return `<section class="testa" style="--c:${col}">
      <div class="${coverClasse(p)} cambiabile" ${coverStile(p)} data-az="cover" title="Cambia copertina (o trascinaci un'immagine)"><span class="cambia">Scegli foto</span></div>
      <div class="info">
        <span class="tipo">Progetto</span>
        <input class="campo titolo-grande" data-progetto="titolo" value="${esc(p.titolo)}" spellcheck="false">
        <div class="meta"><input class="campo" data-progetto="artista" value="${esc(p.artista)}" placeholder="Artista" spellcheck="false">
          <span>• ${new Date(p.creato * 1000).getFullYear()} • ${nBrani(brani.length)}${durata ? ', ' + minuti(durata) : ''}${senza ? ` • ${senza} senza audio` : ''}${p.condivisione?.url ? ' • <b class="condiviso">Condiviso</b>' : ''}</span></div>
      </div>
    </section>
    <div class="dopo-testa" style="--c:${col}">
      <div class="azioni">
        ${bottonePlay(ctx, brani)}
        <button class="ic ${p.fissato ? 'on' : ''}" data-az="fissa" title="${p.fissato ? 'Togli dai fissati' : 'Fissa in alto nella libreria'}">${IC.spillo}</button>
        <button class="ic" data-az="aggiungi" title="Aggiungi brani">${IC.piuCerchio}</button>
        <button class="ic" data-az="menu-progetto" title="Altre opzioni">${IC.altro}</button>
      </div>
      <textarea class="campo nota-progetto" data-progetto="nota" rows="1" placeholder="Note del progetto">${esc(p.nota)}</textarea>
      ${tracklist(brani, { ordinabile: true })}
      <div class="zona-file" data-az="aggiungi">Trascina qui file audio o una cartella per aggiungere brani. Sopra un brano diventa una nuova versione.</div>
    </div>`
}

function pagAscolta() {
  const p = S.lib.progetti[0], brani = braniDi(p.id), col = coloreDi(p)
  return `<section class="testa" style="--c:${col}">${coverHtml(p)}
      <div class="info"><span class="tipo">Ascolto condiviso</span><h1 class="titolo-grande">${esc(p.titolo)}</h1>
        <div class="meta">${p.artista ? `<b>${esc(p.artista)}</b> • ` : ''}<span>${nBrani(brani.length)}${p.durata ? ', ' + minuti(p.durata) : ''}</span></div></div>
    </section>
    <div class="dopo-testa" style="--c:${col}">
      <div class="azioni">${bottonePlay('progetto:' + p.id, brani)}</div>
      ${tracklist(brani)}
      <p class="nota-ospite">Brani inediti condivisi con BOUNCES. Sono qui per l'ascolto: non girare il link.</p>
    </div>`
}

function pagAutore(chiave) {
  const a = S.perAutore.get(chiave)
  if (!a) return '<div class="pagina sopra"><div class="vuoto"><b>Autore non trovato</b></div></div>'
  const ctx = 'autore:' + a.chiave, col = coloreTesto(a.chiave)
  const con = new Map()
  for (const b of a.brani) for (const x of S.info.get(b.id).autori) { const k = norm(x); if (k !== a.chiave) con.set(k, (con.get(k) || 0) + 1) }
  const spesso = [...con].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k]) => S.perAutore.get(k)).filter(Boolean)
  const puo = !S.ospite, haFoto = !!urlFotoAutore(a)
  return `<section class="testa" style="--c:${col}">${puo ? `<div class="avatar-cambia" data-az="foto-autore" title="${haFoto ? 'Cambia foto' : 'Metti una foto'}">${avatarHtml(a, 'cambiabile')}</div>` : avatarHtml(a)}
      <div class="info"><span class="tipo">Autore</span><h1 class="titolo-grande">${esc(a.nome)}</h1>
        <div class="meta"><span>${nBrani(a.brani.length)} in ${a.progetti === 1 ? '1 progetto' : a.progetti + ' progetti'}</span>${puo && haFoto ? '<button class="link-piccolo" data-az="togli-foto-autore">Togli foto</button>' : ''}</div></div>
    </section>
    <div class="dopo-testa" style="--c:${col}">
      <div class="azioni">${bottonePlay(ctx, a.brani)}</div>
      ${tracklist(a.brani, { multi: true })}
      ${spesso.length ? `<div class="pagina"><div class="sezione-t"><h2>Scrive spesso con</h2></div><div class="fila">${spesso.map(cardAutore).join('')}</div></div>` : ''}
    </div>`
}

function pagPreferiti() {
  const brani = preferiti(), col = '#5038a0'
  return `<section class="testa" style="--c:${col}"><div class="cover preferiti">${IC.cuorePieno}</div>
      <div class="info"><span class="tipo">Playlist</span><h1 class="titolo-grande">Preferiti</h1>
        <div class="meta"><span>${nBrani(brani.length)}</span></div></div>
    </section>
    <div class="dopo-testa" style="--c:${col}">
      <div class="azioni">${bottonePlay('preferiti', brani)}</div>
      ${brani.length ? tracklist(brani, { multi: true }) : '<div class="vuoto"><b>I brani che ti piacciono finiscono qui</b>Premi il cuore su un brano.</div>'}
    </div>`
}

function pagCartella(arg) {
  const f = S.lib.cartelle.find(x => x.id === +arg)
  if (!f) return '<div class="pagina sopra"><div class="vuoto"><b>Cartella non trovata</b></div></div>'
  const dentro = progettiOrdinati().filter(p => p.cartella_id === f.id)
  return `<section class="testa" style="--c:#4a4a4a"><div class="cover cartella">${IC.cartella}</div>
      <div class="info"><span class="tipo">Cartella</span>
        <input class="campo titolo-grande" data-cartella="titolo" value="${esc(f.titolo)}" spellcheck="false">
        <div class="meta"><span>${dentro.length === 1 ? '1 progetto' : dentro.length + ' progetti'}</span></div></div>
    </section>
    <div class="dopo-testa" style="--c:#4a4a4a">
      <div class="azioni"><button class="btn pericolo" data-az="elimina-cartella" data-arg="${f.id}">${IC.cestino} Elimina cartella</button></div>
      <div class="pagina">${dentro.length ? `<div class="griglia">${dentro.map(card).join('')}</div>`
        : '<div class="vuoto" style="margin:0"><b>Cartella vuota</b>Apri un progetto e dai “Sposta in” dal menu ⋯</div>'}</div>
    </div>`
}

// --- pannello "in riproduzione" / dettagli del brano ---
async function apriBrano(bid, forza = false) {
  S.schermo = false
  if (S.pann && S.pann.bid === bid && !forza) { S.pann = null; return ridisegna() }
  const b = S.perBrano.get(bid)
  if (!b) return
  try {
    S.pann = { bid, prog: await api('GET', `/api/progetti/${b.progetto_id}`) }
    S.scelta = bid
  } catch (e) { return sbaglio(e) }
  ridisegna()
  $('#pannello').scrollTop = 0
}

function pannello() {
  const el = $('#pannello')
  const b = S.pann && S.pann.prog.brani.find(x => x.id === S.pann.bid)
  document.body.classList.toggle('con-pannello', !!b)
  if (!b) { el.hidden = true; return }
  const p = S.perId.get(b.progetto_id) || S.pann.prog, x = scomponi(b.titolo)
  const v = b.versioni.find(y => y.id === b.versione_attiva) || b.versioni[b.versioni.length - 1]
  const c = S.coda[S.i], suonaQuesta = c && c.vid === v.id
  const lb = S.perBrano.get(b.id) || {}
  el.hidden = false
  const su = el.scrollTop
  el.innerHTML = `
    <div class="pn-testa"><a href="#/progetto/${p.id}">${esc(p.titolo)}</a><button class="ic tondo-ic" data-az="chiudi" title="Chiudi">${IC.chiudi}</button></div>
    ${coverHtml(p, 'pn-cover')}
    <canvas id="onda-pn" data-v="${v.id}" title="${v.audio ? 'Clicca per ascoltare da qui' : ''}"></canvas>
    <div class="pn-tempi"><span id="pn-ora">${suonaQuesta ? tempo(A.currentTime) : '0:00'}</span><span>${tempo(v.durata)}</span></div>
    <div class="pn-titolo"><input class="campo" data-brano="titolo" value="${esc(b.titolo)}" spellcheck="false" title="Titolo (gli autori tra parentesi in fondo)">
      <button class="ic cuore ${lb.preferito ? 'on' : ''}" data-az="cuore" data-arg="${b.id}">${lb.preferito ? IC.cuorePieno : IC.cuore}</button></div>
    <input class="campo pn-artista" data-brano="artista" value="${esc(b.artista || '')}" placeholder="Artista" spellcheck="false">
    <p class="pn-sotto">${[!b.artista && x.interprete && esc(maiu(x.interprete)), ...x.autori.map(a => `<a href="#/autore/${encodeURIComponent(norm(a))}">${esc(a)}</a>`)].filter(Boolean).join(', ') || (b.artista ? '' : esc(p.titolo))}</p>
    <div class="carta"><h3>Info</h3>
      <div class="pn-meta">
        <label>BPM<input class="campo" data-versione="bpm" inputmode="decimal" value="${v.bpm ?? ''}" placeholder="${v.bpm_auto ? Math.round(v.bpm_auto) + ' (auto)' : '—'}"></label>
        <label>Tonalità<input class="campo" data-versione="tonalita" value="${esc(v.tonalita ?? '')}" placeholder="${esc(v.tonalita_auto ? v.tonalita_auto + ' (auto)' : '—')}"></label>
      </div>
      <button class="btn" data-az="analizza" ${v.audio ? '' : 'disabled'} title="Stima BPM e tonalità dall'audio">Analizza l'audio</button>
    </div>
    <div class="carta"><h3>Versioni <button class="btn" data-az="nuova-versione">${IC.piu} Nuova</button></h3>
      <div class="versioni">${b.versioni.slice().reverse().map(y => `
        <div class="ver-riga ${c && c.vid === y.id ? 'in-ascolto' : ''}" data-v="${y.id}">
          ${y.audio ? `<button class="ic" data-az="suona-versione" title="Ascolta questa versione">${c && c.vid === y.id && !A.paused ? IC.pausa : IC.play}</button>` : '<span></span>'}
          <span class="ver-nome"><input class="campo" data-etichetta value="${esc(y.etichetta)}" spellcheck="false">${sceltaStato(y.id, y.stato)}</span>
          <span class="muted">${quando(y.creato)}${y.durata ? ' · ' + tempo(y.durata) : ''}${y.commenti.length ? ' · ' + y.commenti.length + ' comm.' : ''}</span>
          ${y.id === v.id ? '<span class="attiva-tag">attiva</span>' : '<button class="link-btn" data-az="rendi-attiva">Rendi attiva</button>'}
          ${y.audio ? `<button class="ic" data-az="scarica" title="Scarica l'originale">${IC.scarica}</button>` : '<button class="link-btn" data-az="collega">Carica audio</button>'}
          ${b.versioni.length > 1 ? `<button class="ic" data-az="elimina-versione" title="Elimina versione">${IC.cestino}</button>` : '<span></span>'}
        </div>`).join('')}</div>
    </div>
    <div class="carta"><h3>Note e testo</h3>
      <textarea class="campo" data-brano="nota" rows="6" placeholder="Testo, appunti, cose da sistemare...">${esc(b.nota)}</textarea>
    </div>
    <div class="carta"><h3>Commenti · ${esc(v.etichetta)}</h3>
      <div class="commenti">${v.commenti.length ? v.commenti.map(m => `
        <div class="commento" data-c="${m.id}">
          ${m.secondi != null ? `<button class="tempo" data-t="${m.secondi}" title="Vai a questo punto">${tempo(m.secondi)}</button>` : '<span class="tempo senza-t">—</span>'}
          <p>${esc(m.testo)}</p>
          <button class="ic" data-az="elimina-commento" title="Elimina">${IC.chiudi}</button>
          <small>${quando(m.creato)}</small>
        </div>`).join('') : '<p class="muted" style="margin:0 8px 4px">Nessun commento. Mentre ascolti, scrivi qui: resta segnato il minuto.</p>'}</div>
      <form class="nuovo-commento" data-v="${v.id}">
        <label class="chk"><input type="checkbox" name="a_tempo" ${suonaQuesta ? 'checked' : ''} ${v.audio ? '' : 'disabled'}> al minuto <b data-ora-commento>${tempo(suonaQuesta ? A.currentTime : 0)}</b></label>
        <div class="fila-c"><input name="testo" placeholder="Scrivi un commento" autocomplete="off"><button class="btn pieno">Invia</button></div>
      </form>
    </div>
    <div class="pn-fondo"><button class="btn pericolo" data-az="elimina-brano">${IC.cestino} Elimina brano</button></div>`
  el.scrollTop = su
  S.pannOnda = { vid: v.id, picchi: v.picchi, durata: v.durata, commenti: v.commenti, audio: v.audio, bid: b.id }
  disegnaOndaPannello()
}

// --- player ---
// A è il brano che suona. I wav sono pesanti e Dropbox ci mette un attimo a dare il primo pezzo: per far partire
// il play subito si tengono pronti in anticipo (senza toccare la qualità) il brano sotto il mouse e il prossimo della coda
let A = new Audio()
A.preload = 'auto'
const pronti = new Map()  // vid → <audio> già in caricamento
const MAX_PRONTI = 3
// su iPhone un solo <audio> per sempre: se si cambia elemento, o ce ne sono altri carichi, la schermata di blocco
// perde il brano (non lo vede in play e mostra solo ±10 s). Lì si tiene pronto solo il link del prossimo
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// iOS fa suonare un <audio> senza tocco solo se è già stato "acceso" da un tocco: lo si fa al primo, così il play
// funziona anche quando il link arriva dopo un attimo, e a schermo bloccato col brano successivo
if (IOS) document.addEventListener('touchend', function sblocca() {
  document.removeEventListener('touchend', sblocca, true)
  if (!A.getAttribute('src')) A.load()
}, true)

function prepara(vid) {
  if (!vid || pronti.has(vid) || S.coda[S.i]?.vid === vid) return
  if (IOS) { if (!S.ospite && Archivio.percorso(vid)) sorgente(vid).catch(() => {}); return }
  const crea = url => {
    if (!url || pronti.has(vid)) return
    const el = new Audio()
    el.preload = 'auto'
    el.src = url
    el.load()
    pronti.set(vid, el)
    while (pronti.size > MAX_PRONTI) {
      const [vecchio, x] = pronti.entries().next().value
      x.removeAttribute('src'); x.load()
      pronti.delete(vecchio)
    }
  }
  const subito = sorgenteSubito(vid)
  if (subito) crea(subito)
  else if (!S.ospite && Archivio.percorso(vid)) sorgente(vid).then(crea, () => {})
}

// il player passa a un <audio> già pronto: gli ascoltatori di eventi si spostano con lui
const EVENTI = {}
function usa(el) {
  if (el === A) return
  const vecchio = A
  for (const [nome, f] of Object.entries(EVENTI)) { vecchio.removeEventListener(nome, f); el.addEventListener(nome, f) }
  el.volume = vecchio.volume
  el.muted = vecchio.muted
  vecchio.pause()
  vecchio.removeAttribute('src')
  vecchio.load()
  A = el
}
const quandoPronto = f => A.readyState >= 1 ? f() : A.addEventListener('loadedmetadata', f, { once: true })

function voce(b, v) {
  return { pid: b.progetto_id, bid: b.id, vid: v ? v.id : b.versione_id, etichetta: v ? v.etichetta : b.etichetta, stato: v ? v.stato : b.stato, durata: v ? v.durata : b.durata }
}

function suonaContesto(ctx, bid = null) {
  const lista = braniContesto(ctx).filter(b => b.audio)
  if (!lista.length) return avviso('Nessun brano con l’audio qui', true)
  if (!bid && S.contesto === ctx && S.coda[S.i]) return A.paused ? A.play() : A.pause()
  S.contesto = ctx
  S.coda = lista.map(b => voce(b))
  let i = bid ? S.coda.findIndex(x => x.bid === bid) : 0
  if (!bid && S.casuale) i = Math.floor(Math.random() * S.coda.length)
  vai(Math.max(0, i))
  apriPlayer()
}
// premendo play il player si apre da solo (25/10, Matteo): a schermo intero sul telefono, pannello a destra sul PC
function apriPlayer() {
  const c = S.coda[S.i]
  if (!c) return
  if (telefono()) return apriSchermo()
  if (!S.ospite && !(S.pann && S.pann.bid === c.bid)) apriBrano(c.bid, true)
}

// un brano da una lista: la coda diventa quella lista (come su Spotify)
function suonaBrano(bid, vid = null) {
  const c = S.coda[S.i]
  if (c && c.bid === bid && (!vid || c.vid === vid)) return A.paused ? A.play() : A.pause()
  const { vista, arg } = rotta()
  const b = S.perBrano.get(bid)
  let ctx = vista === 'autore' ? 'autore:' + arg : vista === 'preferiti' ? 'preferiti' : 'progetto:' + b.progetto_id
  if (!braniContesto(ctx).some(x => x.id === bid)) ctx = 'progetto:' + b.progetto_id
  // una versione diversa dall'attiva entra in coda al posto dell'attiva
  const v = vid && vid !== b.versione_id && S.pann && S.pann.prog.brani.find(x => x.id === bid)?.versioni.find(x => x.id === vid)
  S.contesto = ctx
  S.coda = braniContesto(ctx).filter(x => x.audio).map(x => (v && x.id === bid ? voce(x, v) : voce(x)))
  if (v && !S.coda.some(x => x.bid === bid)) S.coda.push(voce(b, v))
  vai(Math.max(0, S.coda.findIndex(x => x.bid === bid)))
  apriPlayer()
}

async function vai(i) {
  if (i < 0 || i >= S.coda.length) return
  S.i = i
  const c = S.coda[i]
  segnaAscolto(c.pid)
  S.dett = null
  // a schermo bloccato si resta sullo stesso <audio>: iOS non fa partire quello nuovo e perde i comandi
  const giaPronto = document.hidden || IOS ? null : pronti.get(c.vid), salto = S.saltaDopo
  S.saltaDopo = null
  const parti = () => {
    A.play().catch(() => {})
    if (salto != null) quandoPronto(() => salta(salto))
    S.dopo = S.casuale && S.coda.length > 1 ? aCaso() : null
    const dopo = S.coda[S.dopo ?? i + 1]
    if (dopo) prepara(dopo.vid)  // il prossimo si carica mentre questo suona
  }
  if (giaPronto) {
    pronti.delete(c.vid)
    usa(giaPronto)
    A.currentTime = 0
    parti()
    tempi()
  } else {
    const subito = sorgenteSubito(c.vid)
    if (subito) { A.src = subito; parti() }
    else {
      ridisegna()
      try { A.src = await sorgente(c.vid) } catch (e) { return sbaglio(e) }
      if (S.coda[S.i] !== c) return
      parti()
    }
  }
  ridisegna()
  if (S.ospite) {  // chi ascolta da un link: la waveform viene dalla scheda
    const bo = S.lib.brani.find(x => x.versione_id === c.vid)
    S.dett = bo && bo.picchi ? { id: c.vid, picchi: bo.picchi, commenti: [] } : null
    return disegnaSchermo()
  }
  try { S.dett = await api('GET', `/api/versioni/${c.vid}`) } catch {}
  if (S.coda[S.i] === c) disegnaPunti()
}
// "ultimi ascoltati": il progetto si segna quando parte un suo brano. Se è già il primo e da poco, non si riscrive la libreria
function segnaAscolto(pid) {
  const p = S.perId.get(pid), ora = Date.now() / 1000
  if (S.ospite || !p) return
  const primo = S.lib.progetti.reduce((m, x) => (x.ascoltato || 0) > (m.ascoltato || 0) ? x : m, {})
  if (primo === p && ora - p.ascoltato < 300) return
  p.ascoltato = ora
  api('POST', `/api/progetti/${pid}/ascoltato`).catch(() => {})
}
// da dove si ascolta: link temporaneo di Dropbox, o il link pubblico se è un ascolto condiviso
function sorgenteSubito(vid) {
  if (S.ospite) return S.lib.brani.find(b => b.versione_id === vid)?.url || null
  const path = Archivio.percorso(vid)
  return path ? Dbx.linkSubito(path) : null
}
async function sorgente(vid) {
  const path = Archivio.percorso(vid)
  if (!path) throw new Error('Questo brano non ha ancora l’audio')
  return Dbx.link(path)
}
// in casuale il prossimo si sceglie appena parte un brano, così ha già il link pronto quando serve
function aCaso() {
  let j
  do j = Math.floor(Math.random() * S.coda.length); while (j === S.i)
  return j
}
function prossimo() {
  if (!S.coda.length) return
  if (S.casuale && S.coda.length > 1) return vai(S.dopo != null && S.dopo !== S.i && S.dopo < S.coda.length ? S.dopo : aCaso())
  if (S.i < S.coda.length - 1) vai(S.i + 1)
}

function disegnaPlayer() {
  const c = S.coda[S.i]
  $('#player').classList.toggle('vuoto-pl', !c)
  $('#pl-play').innerHTML = A.paused ? IC.play : IC.pausa
  $('#pl-loop').classList.toggle('on', S.loop)
  $('#pl-casuale').classList.toggle('on', S.casuale)
  $('#pl-pannello').classList.toggle('on', !!S.pann && !!c && S.pann.bid === c.bid)
  if (!c) { document.title = 'Bounces'; S.schermo = false; disegnaSchermo(); return }
  const b = S.perBrano.get(c.bid), p = S.perId.get(c.pid)
  $('#player').style.setProperty('--c', coloreDi(p))
  const x = b ? S.info.get(b.id) : { nome: '', autori: [], interprete: '' }
  const cov = $('#pl-cover')
  cov.className = coverClasse(p)
  const uc = urlCover(p)
  cov.style.backgroundImage = uc ? `url('${uc}')` : ''
  $('#pl-titolo').textContent = x.nome + (b && b.nver > 1 && c.etichetta ? ` (${c.etichetta})` : '')
  $('#pl-titolo').href = `#/progetto/${c.pid}`
  $('#pl-sub').textContent = [maiu((b && b.artista) || x.interprete), ...x.autori].filter(Boolean).join(', ') || (p && p.titolo) || ''
  sessione(c, x, $('#pl-sub').textContent, p, uc)
  const cu = $('#pl-cuore')
  cu.classList.toggle('on', !!(b && b.preferito))
  cu.innerHTML = b && b.preferito ? IC.cuorePieno : IC.cuore
  document.title = `${A.paused ? '' : '▶ '}${x.nome} · Bounces`
  disegnaPunti()
  disegnaSchermo()
  tempi()
}

// --- telefono: player a schermo intero ("In riproduzione"), come nelle app ---
function apriSchermo() {
  if (!S.coda[S.i]) return
  S.schermo = true
  chiudiMenu()
  disegnaSchermo()
}
let schermoDisegnato = ''
function disegnaSchermo() {
  const el = $('#schermo'), c = S.coda[S.i]
  const aperto = !!(S.schermo && c && telefono())
  el.hidden = !aperto
  document.body.classList.toggle('schermo-aperto', aperto)
  if (!aperto) { schermoDisegnato = ''; return }
  const b = S.perBrano.get(c.bid), p = S.perId.get(c.pid), x = b ? S.info.get(b.id) : { nome: '', autori: [], interprete: '' }
  const chiave = [c.vid, A.paused, S.casuale, S.loop, b && b.preferito, p && p.modificato, !!urlCover(p)].join('|')
  if (chiave === schermoDisegnato) return tempiSchermo()  // niente da ridisegnare: solo i tempi
  schermoDisegnato = chiave
  el.style.setProperty('--c', coloreDi(p))
  el.innerHTML = `
    <div class="sc-testa"><button class="ic" data-sc="chiudi" title="Chiudi">${IC.giu}</button>
      <div><small>${S.ospite ? 'In ascolto' : 'In riproduzione da'}</small><b>${esc(p ? p.titolo : '')}</b></div>${S.ospite ? '<span class="sc-vuoto"></span>' : `<button class="ic" data-sc="altro" title="Altro">${IC.altro}</button>`}</div>
    ${coverHtml(p, 'sc-cover')}
    <div class="sc-titolo"><div><b>${esc(x.nome)}</b><span>${esc([maiu((b && b.artista) || x.interprete), ...x.autori].filter(Boolean).join(', ') || (p ? p.titolo : ''))}${b && b.nver > 1 && c.etichetta ? ' · ' + esc(c.etichetta) : ''}</span></div>
      ${S.ospite ? '' : `<button class="ic cuore ${b && b.preferito ? 'on' : ''}" data-sc="cuore">${b && b.preferito ? IC.cuorePieno : IC.cuore}</button>`}</div>
    <div id="sc-barra"><div class="sc-binario"><div class="sc-pieno"></div></div></div>
    <div class="sc-tempi"><span id="sc-ora">0:00</span><span id="sc-tot">0:00</span></div>
    <div class="sc-tasti">
      <button class="ic ${S.casuale ? 'on' : ''}" data-sc="casuale" title="Casuale">${IC.casuale}</button>
      <button class="ic grande" data-sc="prec" title="Precedente">${IC.prec}</button>
      <button class="sc-play" data-sc="play" title="Play / pausa">${A.paused ? IC.play : IC.pausa}</button>
      <button class="ic grande" data-sc="succ" title="Successivo">${IC.succ}</button>
      <button class="ic ${S.loop ? 'on' : ''}" data-sc="loop" title="Ripeti">${IC.loop}</button>
    </div>
    ${S.ospite ? '' : `<button class="sc-dettagli" data-sc="dettagli"><b>Versioni, note e commenti</b>
      <span>${esc([c.etichetta, ((b && b.versione_id === c.vid ? b.stato : c.stato) || '').toUpperCase(), b && b.nver > 1 ? b.nver + ' versioni' : ''].filter(Boolean).join(' · ') || 'Apri il brano')}</span></button>`}`
  tempiSchermo()
}
function tempiSchermo() {
  if (!S.schermo || $('#schermo').hidden) return
  const c = S.coda[S.i], d = A.duration || (c && c.durata) || 0
  const o = $('#sc-ora'), t = $('#sc-tot')
  if (o) o.textContent = tempo(A.currentTime)
  if (t) t.textContent = tempo(d)
  const pieno = $('#sc-barra .sc-pieno')
  if (pieno) pieno.style.width = (d ? Math.min(100, A.currentTime / d * 100) : 0) + '%'
}
$('#schermo').addEventListener('click', e => {
  const t = e.target.closest('[data-sc]'), c = S.coda[S.i]
  if (!t || !c) return
  e.stopPropagation()
  const az = t.dataset.sc
  if (az === 'chiudi') { S.schermo = false; return disegnaSchermo() }
  if (az === 'play') return A.paused ? A.play() : A.pause()
  if (az === 'prec') return indietro()
  if (az === 'succ') return prossimo()
  if (az === 'casuale') return $('#pl-casuale').click()
  if (az === 'loop') return $('#pl-loop').click()
  if (az === 'cuore') return cuore(c.bid)
  if (az === 'altro') return menuBrano(0, 0, c.bid)
  if (az === 'dettagli') { S.schermo = false; disegnaSchermo(); return apriBrano(c.bid, true) }
})
// sulla barra del player grande ci si sposta col dito (come Spotify)
;(() => {
  let giu = false
  const vai = e => { const cv = $('#sc-barra'), c = S.coda[S.i]; if (!cv || !c) return; const r = cv.getBoundingClientRect(); salta(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (A.duration || c.durata || 0)) }
  $('#schermo').addEventListener('pointerdown', e => { if (!e.target.closest('#sc-barra')) return; giu = true; $('#sc-barra').classList.add('giu'); e.target.setPointerCapture(e.pointerId); vai(e) })
  $('#schermo').addEventListener('pointermove', e => { if (giu) vai(e) })
  $('#schermo').addEventListener('pointerup', () => { giu = false; $('#sc-barra')?.classList.remove('giu') })
})()

function disegnaPunti() {
  const c = S.coda[S.i], d = A.duration || (c && c.durata) || 0
  const cm = S.dett && c && S.dett.id === c.vid ? S.dett.commenti : []
  $('#barra-tempo .punti').innerHTML = d ? cm.filter(m => m.secondi != null)
    .map(m => `<i style="left:${Math.min(100, m.secondi / d * 100)}%" title="${tempo(m.secondi)} · ${esc(m.testo)}"></i>`).join('') : ''
}

function tempi() {
  const c = S.coda[S.i], d = A.duration || (c && c.durata) || 0
  $('#pl-ora').textContent = tempo(A.currentTime)
  $('#pl-tot').textContent = tempo(d)
  const f = d ? A.currentTime / d * 100 : 0
  $('#barra-tempo .riempito').style.width = f + '%'
  $('#barra-tempo').style.setProperty('--p', f + '%')
  const pc = $('[data-ora-commento]')
  if (pc && c && +$('.nuovo-commento').dataset.v === c.vid) pc.textContent = tempo(A.currentTime)
  const po = $('#pn-ora')
  if (po && S.pannOnda && c && S.pannOnda.vid === c.vid) po.textContent = tempo(A.currentTime)
  disegnaOndaPannello()
  tempiSchermo()
}

const colore = nome => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
const telefono = () => matchMedia('(max-width: 760px)').matches
function disegnaOndaPannello() {
  const o = S.pannOnda
  if (!o) return
  const c = S.coda[S.i], qui = c && c.vid === o.vid
  const dur = (qui && A.duration) || o.durata || 0
  disegnaBarra($('#onda-pn'), dur, qui && dur ? A.currentTime / dur : 0, o.commenti)
}
// barra sottile col pallino, come Spotify (25/10, al posto della waveform): già ascoltato in bianco (verde mentre suona),
// pallini verdi dei commenti sopra la barra
function disegnaBarra(cv, dur, fatto, commenti = []) {
  if (!cv || !cv.clientWidth) return
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
  const g = cv.getContext('2d')
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const verde = colore('--verde'), r = 6, y = h - r - 2, x0 = r, lung = w - 2 * r, x = x0 + lung * Math.min(1, Math.max(0, fatto))
  const linea = (da, a, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(da, y - 2, Math.max(0, a - da), 4, 2); g.fill() }
  linea(x0, x0 + lung, 'rgba(255,255,255,.3)')
  linea(x0, x, A.paused ? '#fff' : verde)
  if (fatto > 0) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
  if (!dur) return
  g.fillStyle = verde
  for (const m of commenti || []) {
    if (m.secondi == null) continue
    g.beginPath()
    g.arc(x0 + lung * Math.min(1, m.secondi / dur), 4, 3.5, 0, Math.PI * 2)
    g.fill()
  }
}

function giro() {
  tempi()
  if (!A.paused) requestAnimationFrame(giro)
}
Object.assign(EVENTI, {
  play: () => { comandi(); statoSessione(); ridisegna(); requestAnimationFrame(giro) },
  pause: () => { statoSessione(); ridisegna() },
  timeupdate: () => { if (A.paused) tempi() },
  loadedmetadata: () => { tempi(); disegnaPunti(); posizioneSessione() },
  seeked: () => posizioneSessione(),
  ended: () => {
    statoSessione()
    if (S.loop) { A.currentTime = 0; A.play(); return }
    if (S.casuale || S.i < S.coda.length - 1) prossimo()
    else ridisegna()
  },
  error: () => {
    const c = S.coda[S.i]
    if (!c || !A.getAttribute('src')) return
    if (S.ospite || Date.now() - (c.riprovato || 0) < 60e3 || !Archivio.percorso(c.vid)) return avviso('Non riesco a riprodurre questo file', true)
    // dopo una pausa lunga il link di Dropbox (4 ore) scade: se ne chiede uno nuovo e si riparte dallo stesso punto
    c.riprovato = Date.now()
    const dove = A.currentTime
    Dbx.scordaLink(Archivio.percorso(c.vid))
    sorgente(c.vid).then(url => {
      if (S.coda[S.i] !== c) return
      A.src = url
      quandoPronto(() => { salta(dove); A.play().catch(() => {}) })
    }, () => avviso('Non riesco a riprodurre questo file', true))
  },
})
for (const [nome, f] of Object.entries(EVENTI)) A.addEventListener(nome, f)

// schermata di blocco e Centro di controllo (25/10, Matteo): titolo, copertina e tasti brano precedente/successivo.
// iOS di suo mette "-15/+15 secondi": per toglierli non basta non dare quei comandi, bisogna darli e poi toglierli
// (Safari li spegne solo se c'erano). E si ridanno a ogni play: quando l'audio parte iOS rilegge i comandi
function comandi() {
  const MS = navigator.mediaSession
  if (!MS) return
  const az = (nome, f) => { try { MS.setActionHandler(nome, f) } catch {} }
  az('play', () => A.play())
  az('pause', () => A.pause())
  az('previoustrack', indietro)
  az('nexttrack', () => prossimo())
  az('seekto', d => salta(d.seekTime))
  for (const nome of ['seekbackward', 'seekforward']) { az(nome, () => {}); az(nome, null) }
}
comandi()
// i dati del brano si danno solo quando cambia: riscriverli a ogni ridisegno fa ripartire la scheda su iOS
let chiaveSessione = ''
function sessione(c, x, sub, p, uc) {
  const MS = navigator.mediaSession
  if (!MS) return
  const chiave = [c.vid, x.nome, sub, uc].join('|')
  if (chiave === chiaveSessione) return statoSessione()
  chiaveSessione = chiave
  try {
    MS.metadata = new MediaMetadata({ title: x.nome + (c.etichetta ? ` (${c.etichetta})` : ''), artist: sub, album: p ? p.titolo : 'Bounces',
      artwork: [uc ? { src: uc, sizes: '512x512' } : { src: new URL('icona-512.png', location.href).href, sizes: '512x512', type: 'image/png' }] })
  } catch {}
  statoSessione()
}
// play/pausa vanno detti a iOS subito dagli eventi dell'audio: il ridisegno a volte salta (dito sullo schermo)
function statoSessione() {
  try { navigator.mediaSession.playbackState = A.paused ? 'paused' : 'playing' } catch {}
  posizioneSessione()
}
// la barra della schermata di blocco: durata e punto in cui sei
function posizioneSessione() {
  const d = A.duration
  if (navigator.mediaSession?.setPositionState && d && isFinite(d))
    try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(A.currentTime, d), playbackRate: A.playbackRate || 1 }) } catch {}
}

// passando sopra un brano (o toccandolo) il suo audio inizia a caricarsi: al clic parte subito
let attesaPrepara = 0
document.addEventListener('pointerover', e => {
  const r = e.target.closest?.('.tr, [data-suona]')
  if (!r) return
  clearTimeout(attesaPrepara)
  attesaPrepara = setTimeout(() => {
    if (r.dataset.suona) { const b = braniContesto(r.dataset.suona).find(x => x.audio); if (b) prepara(b.versione_id) }
    else { const b = S.lib && S.lib.brani.find(x => x.id === +r.dataset.b); if (b && b.audio) prepara(b.versione_id) }
  }, 120)
})
window.addEventListener('resize', disegnaOndaPannello)

function salta(secondi) {
  if (!S.coda[S.i]) return
  A.currentTime = Math.max(0, Math.min((A.duration || 0) - 0.05, secondi))
  if (A.paused) tempi()
}

// slider alla Spotify (tempo e volume): si clicca o si trascina
function slider(el, al) {
  const f = e => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) }
  el.addEventListener('pointerdown', e => { el.classList.add('giu'); el.setPointerCapture(e.pointerId); al(f(e)) })
  el.addEventListener('pointermove', e => { if (el.classList.contains('giu')) al(f(e)) })
  el.addEventListener('pointerup', () => el.classList.remove('giu'))
}
slider($('#barra-tempo'), x => salta(x * (A.duration || S.coda[S.i]?.durata || 0)))
function volume(x) {
  A.volume = x
  A.muted = false
  $('#barra-volume .riempito').style.width = x * 100 + '%'
  $('#barra-volume').style.setProperty('--p', x * 100 + '%')
  $('#pl-muto').innerHTML = x ? IC.volume : IC.muto
  try { localStorage.setItem('inediti-volume', x) } catch {}
}
slider($('#barra-volume'), volume)

// waveform nel pannello: se il brano suona ci si sposta, se no parte da quel punto
;(() => {
  let giu = false
  const frazione = (cv, e) => { const r = cv.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) }
  document.addEventListener('pointerdown', e => {
    const cv = e.target.closest('#onda-pn')
    if (!cv || !S.pannOnda || !S.pannOnda.audio) return
    const o = S.pannOnda, c = S.coda[S.i], x = frazione(cv, e)
    if (c && c.vid === o.vid) { giu = true; cv.setPointerCapture(e.pointerId); salta(x * (A.duration || o.durata)) }
    else {
      S.saltaDopo = x * (o.durata || 0)
      suonaBrano(o.bid, o.vid)
    }
  })
  document.addEventListener('pointermove', e => {
    const cv = e.target.closest('#onda-pn')
    if (giu && cv) return salta(frazione(cv, e) * (A.duration || 0))
    if (!cv || !S.pannOnda) return
    const o = S.pannOnda, d = o.durata || 0, r = cv.getBoundingClientRect()
    const vicino = d && (o.commenti || []).find(m => m.secondi != null && Math.abs(m.secondi / d * r.width - (e.clientX - r.left)) < 6)
    cv.title = vicino ? `${tempo(vicino.secondi)} · ${vicino.testo}` : (o.audio ? 'Clicca per ascoltare da qui' : '')
  })
  document.addEventListener('pointerup', () => { giu = false })
})()

$('#pl-play').addEventListener('click', () => { if (S.coda[S.i]) A.paused ? A.play() : A.pause() })
// indietro va sempre al brano prima (25/10, Matteo: col "ricomincia dopo 3 s" di Spotify sembrava rotto); dal primo ricomincia
function indietro() { S.i > 0 ? vai(S.i - 1) : salta(0) }
$('#pl-prec').addEventListener('click', indietro)
$('#pl-succ').addEventListener('click', prossimo)
$('#pl-loop').addEventListener('click', () => { S.loop = !S.loop; disegnaPlayer() })
$('#pl-casuale').addEventListener('click', () => {
  S.casuale = !S.casuale
  S.dopo = S.casuale && S.coda.length > 1 ? aCaso() : null  // il nuovo "prossimo" si prepara subito
  const dopo = S.coda[S.dopo ?? S.i + 1]
  if (dopo) prepara(dopo.vid)
  disegnaPlayer()
})
$('#pl-muto').addEventListener('click', () => {
  A.muted = !A.muted
  $('#pl-muto').innerHTML = A.muted || !A.volume ? IC.muto : IC.volume
  $('#barra-volume .riempito').style.width = (A.muted ? 0 : A.volume * 100) + '%'
})
$('#pl-pannello').addEventListener('click', () => {
  const c = S.coda[S.i]
  if (!c) return
  if (S.pann && S.pann.bid === c.bid) { S.pann = null; return ridisegna() }
  apriBrano(c.bid, true)
})
$('#pl-cover').addEventListener('click', () => { const c = S.coda[S.i]; if (c && !telefono()) apriBrano(c.bid, true) })
// sul telefono toccare il mini-player (tranne il play) apre il player a schermo intero
$('#player').addEventListener('click', e => {
  if (!telefono() || e.target.closest('#pl-play')) return
  e.preventDefault()
  e.stopPropagation()
  apriSchermo()
}, true)

// barra in alto sul telefono: freccia Indietro fuori dalle schede principali, ricerca solo nella scheda Cerca
function barraTelefono() {
  const { vista } = rotta()
  const radice = ['', 'cerca', 'libreria'].includes(vista) || S.ospite
  $('#indietro').hidden = radice
  document.body.classList.toggle('su-cerca', vista === 'cerca')
}
$('#indietro').addEventListener('click', () => { if (history.length > 1) history.back(); else location.hash = '#/' })
$('#pl-cuore').addEventListener('click', () => { const c = S.coda[S.i]; if (c) cuore(c.bid) })

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input.campo')) return e.target.blur()
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.code === 'Space') { e.preventDefault(); $('#pl-play').click() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? $('#pl-prec').click() : salta(A.currentTime - 5) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? prossimo() : salta(A.currentTime + 5) }
  else if (e.key === 'Escape') { chiudiMenu(); if (S.schermo) { S.schermo = false; disegnaSchermo() } else if (S.pann) { S.pann = null; ridisegna() } }
})

async function cuore(bid) {
  const b = S.perBrano.get(bid)
  if (!b) return
  try {
    await api('PATCH', `/api/brani/${bid}`, { preferito: b.preferito ? 0 : 1 })
    avviso(b.preferito ? 'Tolto dai Preferiti' : 'Aggiunto ai Preferiti')
    await ricarica()
  } catch (e) { sbaglio(e) }
}

// --- menu a tendina (⋯ del progetto, + della libreria, tasto destro sui brani) ---
function chiudiMenu() { $$('.menu, .foglio-fondo').forEach(m => m.remove()) }
function menu(x, y, voci, contesto = {}) {
  chiudiMenu()
  const m = document.createElement('div')
  m.className = 'menu'
  if (telefono()) {  // sul telefono: foglio dal basso, voci grandi, toccando fuori si chiude e basta
    const fondo = document.createElement('div')
    fondo.className = 'foglio-fondo'
    document.body.append(fondo)
    m.classList.add('foglio')
  }
  m.innerHTML = voci.map(v => v === '-' ? '<hr>' : v.titoletto ? `<div class="titoletto">${esc(v.titoletto)}</div>`
    : `<button data-az="${v.az}" ${v.arg != null ? `data-arg="${esc(v.arg)}"` : ''} class="${v.pericolo ? 'pericolo' : ''} ${v.on ? 'on' : ''}">${esc(v.testo)}</button>`).join('')
  Object.assign(m.dataset, contesto)
  document.body.append(m)
  if (m.classList.contains('foglio')) return
  m.style.left = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px'
  m.style.top = (y + m.offsetHeight > innerHeight - 8 ? Math.max(8, y - m.offsetHeight) : y) + 'px'
}
function menuProgetto(anchor) {
  const p = S.perId.get(+rotta().arg), r = anchor.getBoundingClientRect()
  menu(r.left, r.bottom + 6, [
    ...(p.condivisione?.url
      ? [{ testo: 'Copia link d’ascolto', az: 'condividi' }, { testo: 'Interrompi condivisione', az: 'revoca', pericolo: true }]
      : [{ testo: 'Condividi link d’ascolto', az: 'condividi' }]),
    { testo: 'Aggiungi brani', az: 'aggiungi' },
    ...(p.ordine_manuale ? [{ testo: 'Ordina in ordine alfabetico', az: 'alfabetico' }] : []),
    { testo: p.fissato ? 'Togli dai fissati' : 'Fissa nella libreria', az: 'fissa' },
    '-',
    { testo: 'Scegli copertina', az: 'cover' },
    p.cover ? { testo: 'Togli copertina', az: 'togli-cover' } : { testo: 'Cambia colore', az: 'colore' },
    '-',
    { titoletto: 'Sposta in' },
    ...S.lib.cartelle.map(f => ({ testo: (f.id === p.cartella_id ? '✓ ' : '') + f.titolo, az: 'sposta', arg: f.id })),
    { testo: 'Nuova cartella...', az: 'sposta-nuova' },
    ...(p.cartella_id ? [{ testo: 'Togli dalla cartella', az: 'sposta', arg: '' }] : []),
    '-',
    { testo: 'Elimina progetto', az: 'elimina-progetto', pericolo: true },
  ], { pid: p.id })
}
function menuBrano(x, y, bid) {
  const b = S.perBrano.get(bid)
  menu(x, y, [
    ...(b.audio ? [{ testo: 'Riproduci', az: 'm-suona' }] : [{ testo: 'Carica l’audio', az: 'm-collega' }]),
    { testo: 'Rinomina', az: 'm-rinomina' },
    { testo: 'Autori...', az: 'm-autori' },
    { testo: 'Versioni, note e commenti', az: 'm-apri' },
    { testo: b.preferito ? 'Togli dai Preferiti' : 'Aggiungi ai Preferiti', az: 'm-cuore' },
    { testo: 'Nuova versione...', az: 'm-versione' },
    ...(rotta().vista !== 'progetto' ? [{ testo: 'Vai al progetto', az: 'm-progetto' }] : []),
    ...(b.audio ? [{ testo: 'Scarica', az: 'm-scarica' }] : []),
    '-',
    // se il nome del file è stato letto male, il brano si sposta (con le versioni e la cartella su Dropbox)
    { titoletto: 'Sposta in' },
    ...progettiOrdinati().filter(p => p.id !== b.progetto_id).map(p => ({ testo: p.titolo, az: 'm-sposta', arg: p.id })),
    '-',
    { testo: 'Elimina brano', az: 'm-elimina', pericolo: true },
  ], { bid })
}
document.addEventListener('contextmenu', e => {
  const r = e.target.closest('.tr')
  if (!r || S.ospite) return
  e.preventDefault()
  S.scelta = +r.dataset.b
  $$('.tr').forEach(x => x.classList.toggle('scelta', +x.dataset.b === S.scelta))
  menuBrano(e.clientX, e.clientY, +r.dataset.b)
})

// --- analisi BPM / tonalità (worker), una alla volta per non riempire la memoria ---
const lavoratore = new Worker('analisi.js')
const attese = new Map()
let nAnalisi = 0, filaAnalisi = Promise.resolve()
lavoratore.onmessage = e => { attese.get(e.data.id)?.(e.data); attese.delete(e.data.id) }

function analizza(prendiDati, vid) {
  filaAnalisi = filaAnalisi.then(async () => {
    try {
      const ctx = new OfflineAudioContext(1, 1, 22050)  // decodifica già ricampionata a 22 kHz
      const buf = await ctx.decodeAudioData(await prendiDati())
      const mono = new Float32Array(buf.length)
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c)
        for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels
      }
      const id = ++nAnalisi
      const r = await new Promise(ok => { attese.set(id, ok); lavoratore.postMessage({ id, sr: buf.sampleRate, dati: mono }, [mono.buffer]) })
      if (r.errore) throw new Error(r.errore)
      // in Bounces anche durata e waveform si calcolano qui (non c'è un server)
      await api('PATCH', `/api/versioni/${vid}`, { bpm_auto: r.bpm, tonalita_auto: r.key, picchi: r.picchi, durata: buf.duration })
      return r
    } catch (e) { console.warn('analisi', vid, e) }
  })
  return filaAnalisi
}

// --- caricamenti ---
function rigaCaricamento(nome) {
  const el = document.createElement('div')
  el.className = 'caricamento'
  el.innerHTML = `<div>${esc(nome)}</div><i><b></b></i>`
  $('#caricamenti').append(el)
  return { avanza: x => { $('b', el).style.width = Math.round(x * 100) + '%' }, fine: () => el.remove() }
}
const ordinaFile = files => files.filter(f => AUDIO_EXT.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }))
const chiaveFile = nome => norm(nome.replace(/\.[^.]+$/, '').replace(/_/g, ' '))

// ogni file va al suo posto leggendo il nome ("Dhome - Fuggire da te MASTER V3"): progetto dell'artista, brano, stato, versione.
// pid: dentro un progetto i file restano lì; cartella: nome della cartella trascinata, vale come artista se il file non lo dice
async function caricaBrani(pid, files, cartella = '') {
  files = ordinaFile(files)
  if (!files.length) return avviso('Nessun file audio (wav, aiff, mp3, m4a, flac)', true)
  // i file senza artista nel nome (e senza cartella che lo dica): si chiede dove metterli, una volta per tutti
  const senza = new Set(), lib = Archivio.lib
  if (!pid && !cartella) {
    const noti = [...lib.progetti.flatMap(p => [p.titolo, p.artista]), ...lib.brani.map(b => b.artista)].filter(Boolean)
    for (const f of files) if (!leggiNomeFile(f.name, noti).artista) senza.add(f)
  }
  let destino = null
  if (senza.size) {
    destino = await scegliDestinazione([...senza])
    if (!destino) files = files.filter(f => !senza.has(f))
    if (!files.length) return
  }
  const dove = new Map()
  for (const f of files) {
    const r = rigaCaricamento(f.name)
    try {
      const ris = await caricaBounce(f, { pid: pid || (senza.has(f) ? destino : null), artistaDefault: cartella, progresso: r.avanza })
      dove.set(ris.progetto_id, (dove.get(ris.progetto_id) || 0) + 1)
      await ricarica()  // il brano compare subito; durata, waveform, BPM e tonalità arrivano dall'analisi
      analizza(() => ris.blob.arrayBuffer(), ris.versione_id).then(ricarica)
    } catch (e) { sbaglio(e) }
    r.fine()
  }
  if (!dove.size) return
  const n = [...dove.values()].reduce((a, b) => a + b, 0)
  avviso(`${n === 1 ? 'Brano caricato' : n + ' brani caricati'} in ${[...dove.keys()].map(id => S.perId.get(id)?.titolo).join(', ')}`)
  // caricando fuori da un progetto si va dove sono finiti (se è uno solo)
  if (!pid && dove.size === 1) location.hash = `#/progetto/${[...dove.keys()][0]}`
}

// finestrella "Dove lo metto?": un progetto che c'è già, o uno nuovo col nome che scrivi. Restituisce l'id (null = annulla)
function scegliDestinazione(files) {
  return new Promise(ok => {
    const fondo = document.createElement('div')
    fondo.className = 'modale-fondo'
    const progetti = S.lib.progetti.slice().sort((a, b) => a.titolo.localeCompare(b.titolo, 'it', { sensitivity: 'base' }))
    fondo.innerHTML = `<div class="modale">
      <h3>Dove lo metto?</h3>
      <p>${files.length === 1 ? `Nel nome di <b>${esc(files[0].name)}</b> non c'è l'artista.` : `Questi ${files.length} brani non hanno l'artista nel nome:`}</p>
      ${files.length > 1 ? `<ul>${files.slice(0, 5).map(f => `<li>${esc(f.name)}</li>`).join('')}${files.length > 5 ? `<li>e altri ${files.length - 5}</li>` : ''}</ul>` : ''}
      <div class="nuovo-prog"><input placeholder="Nuovo progetto: nome dell'artista" spellcheck="false"><button class="btn pieno" data-nuovo>Crea</button></div>
      ${progetti.length ? `<div class="sottotitolo">Oppure in un progetto che c'è già</div>
        <div class="scelte">${progetti.map(p => `<button class="scelta-prog" data-pid="${p.id}">${coverHtml(p)}<span>${esc(p.titolo)}</span></button>`).join('')}</div>` : ''}
      <div class="fondo-modale"><button class="btn" data-annulla>Annulla</button></div></div>`
    document.body.append(fondo)
    const campo = $('input', fondo)
    const fine = v => { fondo.remove(); ok(v) }
    const crea = async () => {
      const nome = campo.value.trim()
      if (!nome) return campo.focus()
      try { const r = await api('POST', '/api/progetti', { titolo: nome, artista: nome }); await caricaLib(); fine(r.id) } catch (e) { sbaglio(e) }
    }
    fondo.addEventListener('click', e => {
      const b = e.target.closest('[data-pid]')
      if (b) return fine(+b.dataset.pid)
      if (e.target.closest('[data-nuovo]')) return crea()
      if (e.target.closest('[data-annulla]') || e.target === fondo) fine(null)
    })
    campo.addEventListener('keydown', e => { if (e.key === 'Enter') crea(); if (e.key === 'Escape') fine(null) })
    setTimeout(() => campo.focus(), 50)
  })
}

async function caricaVersione(bid, file, collegaA = null) {
  if (!AUDIO_EXT.test(file.name)) return avviso('Non è un file audio', true)
  const r = rigaCaricamento(file.name)
  try {
    const ris = collegaA ? await collegaAudioDropbox(collegaA, file, r.avanza) : await nuovaVersioneDropbox(bid, file, r.avanza)
    avviso(collegaA ? 'Audio caricato' : 'Nuova versione caricata')
    await ricarica()
    analizza(() => ris.blob.arrayBuffer(), ris.versione_id).then(ricarica)
  } catch (e) { sbaglio(e) }
  r.fine()
}

async function caricaCover(pid, file) {
  if (!file.type.startsWith('image/')) return avviso('Scegli un\u2019immagine (jpg, png, webp)', true)
  let tagliata
  try { tagliata = await ritagliaCover(file) } catch { return avviso('Non riesco ad aprire questa immagine', true) }
  if (!tagliata) return
  try { await copertinaDropbox(pid, new File([tagliata], 'cover.jpg', { type: 'image/jpeg' })); await ricarica() } catch (e) { sbaglio(e) }
}

// prima di caricare la copertina (25/10, Matteo): la foto si ingrandisce e si sposta dentro il quadrato.
// Trascina per spostare, rotella / due dita / cursore per lo zoom. Esce un jpg quadrato da 1200 px (null = annulla)
function ritagliaCover(file, titolo = 'Sistema la copertina') {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file), img = new Image()
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('immagine')) }
    img.onload = () => {
      const fondo = document.createElement('div')
      fondo.className = 'modale-fondo'
      fondo.innerHTML = `<div class="modale ritaglio">
        <h3>${titolo}</h3>
        <p>Trascina per spostarla, usa il cursore (o due dita, o la rotella) per ingrandirla.</p>
        <div class="rt-quadro"><img src="${url}" alt="" draggable="false"></div>
        <input class="rt-zoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
        <div class="fondo-modale"><button class="btn" data-annulla>Annulla</button><button class="btn pieno" data-ok>Usa questa</button></div></div>`
      document.body.append(fondo)
      const quadro = $('.rt-quadro', fondo), foto = $('img', fondo), cursore = $('.rt-zoom', fondo)
      const W = img.naturalWidth, H = img.naturalHeight
      let z = 1, cx = W / 2, cy = H / 2  // zoom (1 = la foto riempie il quadrato) e punto della foto al centro del quadrato
      const lato = () => quadro.clientWidth
      const base = () => lato() / Math.min(W, H)  // px dello schermo per px della foto, a zoom 1
      const disegna = () => {
        const k = base() * z, mezzo = lato() / 2 / k
        cx = Math.min(W - mezzo, Math.max(mezzo, cx))
        cy = Math.min(H - mezzo, Math.max(mezzo, cy))
        foto.style.width = W * k + 'px'
        foto.style.transform = `translate(${lato() / 2 - cx * k}px, ${lato() / 2 - cy * k}px)`
        cursore.value = z
      }
      const zoom = nuovo => { z = Math.min(4, Math.max(1, nuovo)); disegna() }
      // dito o mouse: uno sposta, due fanno lo zoom
      const tocchi = new Map()
      let inizio = null
      quadro.addEventListener('pointerdown', e => { quadro.setPointerCapture(e.pointerId); tocchi.set(e.pointerId, [e.clientX, e.clientY]); inizio = null })
      quadro.addEventListener('pointermove', e => {
        if (!tocchi.has(e.pointerId)) return
        const prima = tocchi.get(e.pointerId)
        tocchi.set(e.pointerId, [e.clientX, e.clientY])
        if (tocchi.size === 1) {
          const k = base() * z
          cx -= (e.clientX - prima[0]) / k
          cy -= (e.clientY - prima[1]) / k
          return disegna()
        }
        const [a, b] = [...tocchi.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1])
        if (!inizio) inizio = { d, z }
        else zoom(inizio.z * d / inizio.d)
      })
      const su = e => { tocchi.delete(e.pointerId); inizio = null }
      quadro.addEventListener('pointerup', su)
      quadro.addEventListener('pointercancel', su)
      quadro.addEventListener('wheel', e => { e.preventDefault(); zoom(z * Math.exp(-e.deltaY / 400)) }, { passive: false })
      cursore.addEventListener('input', () => zoom(+cursore.value))
      const fine = v => { fondo.remove(); URL.revokeObjectURL(url); ok(v) }
      fondo.addEventListener('click', e => {
        if (e.target.closest('[data-annulla]') || e.target === fondo) return fine(null)
        if (!e.target.closest('[data-ok]')) return
        const L = 1200, k = base() * z, taglio = lato() / k
        const cv = document.createElement('canvas')
        cv.width = cv.height = L
        const g = cv.getContext('2d')
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, cx - taglio / 2, cy - taglio / 2, taglio, taglio, 0, 0, L, L)
        cv.toBlob(b => fine(b), 'image/jpeg', 0.9)
      })
      requestAnimationFrame(disegna)
    }
    img.src = url
  })
}

// scaricare l'originale col suo nome ("TITOLO - V2.wav")
async function scaricaVersione(vid) {
  const v = Archivio.lib.versioni.find(x => x.id === vid), b = v && Archivio.lib.brani.find(x => x.id === v.brano_id)
  if (!v || !v.path) return
  const r = rigaCaricamento('Scarico ' + (b ? S.info.get(b.id)?.nome || b.titolo : ''))
  try {
    const blob = await (await Dbx.scarica(v.path)).blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${b ? b.titolo : 'brano'} - ${v.etichetta}${(v.path.match(/\.[^.]+$/) || [''])[0]}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60e3)
  } catch (e) { sbaglio(e) }
  r.fine()
}

// link d'ascolto di un progetto: sempre lo stesso, segue da solo le versioni nuove (la scheda è in archivio.js)
async function condividi(pid) {
  if (!braniDi(pid).some(b => b.audio)) return avviso('Nessun brano con l’audio da condividere', true)
  const r = rigaCaricamento('Preparo il link d’ascolto')
  try { finestraLink(await attivaCondivisione(pid)); await ricarica() } catch (e) { sbaglio(e) }
  r.fine()
}
function finestraLink(link) {
  chiudiMenu()
  const m = document.createElement('div')
  m.className = 'menu finestra'
  if (telefono()) { const fondo = document.createElement('div'); fondo.className = 'foglio-fondo'; document.body.append(fondo) }
  m.innerHTML = `<div class="titoletto">Link d'ascolto</div>
    <p>Chi lo apre ascolta i brani di questo progetto, senza account e senza poterli modificare. Il link resta sempre lo stesso:
      quando carichi una versione nuova o aggiungi brani, chi lo riapre sente gli aggiornamenti. Lo spegni dal menu ⋯ → Interrompi condivisione.</p>
    <input readonly value="${esc(link)}">
    <div class="fila-c"><button class="btn pieno" data-az="copia-link">Copia link</button><button class="btn" data-az="chiudi-menu">Chiudi</button></div>`
  document.body.append(m)
  $('input', m).select()
}

// solo in prova sul Mac (localhost): porta dentro progetti, brani, commenti e audio dall'Inediti locale
async function importaInediti() {
  const BASE = 'http://127.0.0.1:8777'
  let lib
  try { lib = await (await fetch(BASE + '/api/libreria')).json() } catch { return avviso('Inediti non risponde: avvialo sul Mac', true) }
  const gia = new Set(Archivio.lib.progetti.map(p => p.origine).filter(Boolean))
  const nuovi = lib.progetti.filter(p => !gia.has('inediti:' + p.id))
  if (!nuovi.length) return avviso('Da Inediti è già tutto qui')
  if (!confirm(`Porto in Bounces ${nuovi.length} progetti da Inediti? L'audio che c'è va nel tuo Dropbox.`)) return
  const ridotti = p => p && p.length ? Array.from({ length: Math.min(400, p.length) }, (_, i) => {
    const k = p.length / Math.min(400, p.length)
    return Math.round(Math.max(...p.slice(Math.floor(i * k), Math.max(Math.floor(i * k) + 1, Math.floor((i + 1) * k)))) * 100) / 100
  }) : null
  const r = rigaCaricamento('Importo da Inediti')
  let fatti = 0
  try {
    for (const [i, pr] of nuovi.entries()) {
      const d = await (await fetch(`${BASE}/api/progetti/${pr.id}`)).json()
      const pid = nuovoId(), brani = [], versioni = [], commenti = []
      const progetto = { id: pid, titolo: d.titolo, artista: d.artista || '', nota: d.nota || '', cover: null, sfondo: d.sfondo || 1,
        fissato: d.fissato ? 1 : 0, cartella_id: null, creato: d.creato, modificato: d.modificato, origine: 'inediti:' + d.id }
      for (const b of d.brani) {
        const bid = nuovoId(), mappa = new Map()
        for (const v of b.versioni) {
          const vid = nuovoId()
          mappa.set(v.id, vid)
          let path = null
          if (v.audio) {
            const nome = v.nome_file || b.titolo + '.wav'
            const { blob, ext } = await preparaAudio(new File([await (await fetch(`${BASE}/scarica/${v.id}`)).blob()], nome))
            path = (await Dbx.carica(`${cartellaBrano(d.titolo, b.titolo)}/${pulisci(v.etichetta || 'V1')}.${ext}`, blob)).path_display
          }
          versioni.push({ id: vid, brano_id: bid, etichetta: v.etichetta || 'V1', path, nome_file: v.nome_file, durata: v.durata, bpm: v.bpm,
            bpm_auto: v.bpm_auto, tonalita: v.tonalita, tonalita_auto: v.tonalita_auto, picchi: ridotti(v.picchi), dimensione: v.dimensione, creato: v.creato })
          for (const m of v.commenti) commenti.push({ id: nuovoId(), versione_id: vid, secondi: m.secondi, testo: m.testo, creato: m.creato })
        }
        brani.push({ id: bid, progetto_id: pid, titolo: b.titolo, ordine: b.ordine, versione_attiva: mappa.get(b.versione_attiva) || versioni[versioni.length - 1]?.id,
          nota: b.nota || '', creato: b.creato, preferito: b.preferito ? 1 : 0, preferito_il: b.preferito_il || null })
      }
      Archivio.cambia(l => {
        if (l.progetti.some(x => x.origine === progetto.origine)) return
        l.progetti.push(progetto); l.brani.push(...brani); l.versioni.push(...versioni); l.commenti.push(...commenti)
      })
      fatti++
      r.avanza((i + 1) / nuovi.length)
    }
  } catch (e) { sbaglio(e) }
  r.fine()
  avviso(`Importati ${fatti} progetti da Inediti`)
  await ricarica()
}

async function nuovoProgetto(dati = {}) {
  const { vista, arg } = rotta()
  if (vista === 'cartella' && !dati.cartella_id) dati.cartella_id = +arg
  const r = await api('POST', '/api/progetti', dati)
  await caricaLib()
  location.hash = `#/progetto/${r.id}`
  setTimeout(() => { const el = $('[data-progetto=titolo]'); if (el && !dati.titolo) { el.focus(); el.select() } }, 80)
  return r.id
}
async function nuovaCartella(pid = null) {
  const r = await api('POST', '/api/cartelle', { titolo: 'Nuova cartella' })
  if (pid) await api('PATCH', `/api/progetti/${pid}`, { cartella_id: r.id })
  S.filtro = 'cartelle'
  await caricaLib()
  location.hash = `#/cartella/${r.id}`
  setTimeout(() => { const el = $('[data-cartella]'); if (el) { el.focus(); el.select() } }, 80)
}

let dopoScelta = null
function scegliAudio(multipli, cb) {
  const inp = $('#scegli-audio')
  inp.multiple = multipli
  dopoScelta = cb
  inp.value = ''
  inp.click()
}
$('#scegli-audio').addEventListener('change', e => { const f = [...e.target.files]; if (f.length && dopoScelta) dopoScelta(f) })
// foto dell'autore (25/10): stesso ritaglio delle copertine, poi tonda
$('#scegli-foto-autore').addEventListener('change', async e => {
  const f = e.target.files[0], { vista, arg } = rotta()
  if (!f || vista !== 'autore') return
  if (!f.type.startsWith('image/')) return avviso('Scegli un\u2019immagine (jpg, png, webp)', true)
  let tagliata
  try { tagliata = await ritagliaCover(f, 'Sistema la foto') } catch { return avviso('Non riesco ad aprire questa immagine', true) }
  if (!tagliata) return
  try { await fotoAutoreDropbox(arg, new File([tagliata], 'autore.jpg', { type: 'image/jpeg' })); avviso('Foto salvata'); await ricarica() } catch (e) { sbaglio(e) }
})
$('#scegli-cover').addEventListener('change', e => { const f = e.target.files[0], { vista, arg } = rotta(); if (f && vista === 'progetto') caricaCover(+arg, f) })

// --- trascinamento: file dal Finder (progetti, brani, versioni, cover) e righe per riordinare ---
async function fileDaDrop(dt) {
  const voci = [...dt.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean)
  if (!voci.length) return { files: [...dt.files], cartella: null }
  const files = []
  const leggi = async e => {
    if (e.isFile) files.push(await new Promise((ok, ko) => e.file(ok, ko)))
    else if (e.isDirectory) {
      const r = e.createReader()
      let lotto
      do {
        lotto = await new Promise((ok, ko) => r.readEntries(ok, ko))
        for (const x of lotto) await leggi(x)
      } while (lotto.length)
    }
  }
  for (const e of voci) await leggi(e)
  return { files, cartella: voci.length === 1 && voci[0].isDirectory ? voci[0].name : null }
}

const conFile = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files')
let rigaTrascinata = null

document.addEventListener('dragover', e => {
  if (rigaTrascinata || !conFile(e)) return
  e.preventDefault()
  document.body.classList.add('trascina-file')
  $$('.sopra-file').forEach(r => r.classList.remove('sopra-file'))
  e.target.closest?.('.tr, #lato .voce[href^="#/progetto/"], #zona-auto')?.classList.add('sopra-file')
})
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget) { document.body.classList.remove('trascina-file'); $$('.sopra-file').forEach(r => r.classList.remove('sopra-file')) }
})
document.addEventListener('drop', async e => {
  if (rigaTrascinata || !conFile(e)) return
  e.preventDefault()
  document.body.classList.remove('trascina-file')
  $$('.sopra-file').forEach(r => r.classList.remove('sopra-file'))
  const riga = e.target.closest?.('.tr'), suCover = e.target.closest?.('.testa .cover')
  const voceLib = e.target.closest?.('#lato .voce[href^="#/progetto/"]'), inLibreria = e.target.closest?.('#lato')
  const { vista, arg } = rotta()
  const { files, cartella } = await fileDaDrop(e.dataTransfer)
  try {
    // a sinistra: sopra un progetto → in quel progetto; nel resto della libreria (o nel riquadro "Carica bounce") → smistati dal nome
    if (voceLib) return caricaBrani(+voceLib.getAttribute('href').split('/').pop(), files)
    if (inLibreria) return caricaBrani(null, files, cartella || '')
    if (vista === 'progetto' && suCover && files[0] && files[0].type.startsWith('image/')) return caricaCover(+arg, files[0])
    if (riga) {
      const b = S.perBrano.get(+riga.dataset.b), audio = ordinaFile(files)
      if (!audio.length) return avviso('Nessun file audio', true)
      return caricaVersione(b.id, audio[0], b.audio ? null : b.versione_id)
    }
    if (vista === 'progetto') return caricaBrani(+arg, files)
    await caricaBrani(null, files, cartella || '')
  } catch (err) { sbaglio(err) }
})

document.addEventListener('dragstart', e => {
  const r = e.target.closest?.('.tl.ordinabile .tr')
  if (!r) return
  if (document.activeElement && document.activeElement.matches('.tr input')) { e.preventDefault(); return }  // si sta scrivendo la versione
  rigaTrascinata = r
  r.classList.add('trascinata')
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', r.dataset.b)
})
document.addEventListener('dragend', () => {
  rigaTrascinata?.classList.remove('trascinata')
  rigaTrascinata = null
  $$('.linea-sopra, .linea-sotto').forEach(r => r.classList.remove('linea-sopra', 'linea-sotto'))
})
$('#principale').addEventListener('dragover', e => {
  if (!rigaTrascinata) return
  const r = e.target.closest('.tr')
  if (!r || r === rigaTrascinata) return
  e.preventDefault()
  const sotto = e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2
  $$('.linea-sopra, .linea-sotto').forEach(x => x.classList.remove('linea-sopra', 'linea-sotto'))
  r.classList.add(sotto ? 'linea-sotto' : 'linea-sopra')
})
$('#principale').addEventListener('drop', async e => {
  if (!rigaTrascinata) return
  const r = e.target.closest('.tr')
  e.preventDefault()
  if (!r || r === rigaTrascinata) return
  if (r.classList.contains('linea-sotto')) r.after(rigaTrascinata)
  else r.before(rigaTrascinata)
  const ids = $$('.tl.ordinabile .tr').map(x => +x.dataset.b)
  try { await api('POST', `/api/progetti/${rotta().arg}/ordine`, { ids }); await ricarica() } catch (err) { sbaglio(err) }
})

// ordine personalizzato della libreria: si trascina il progetto dalla maniglia, col mouse o col dito (25/10, Matteo)
;(() => {
  let voce = null, lista = null, y = 0, giro = 0
  const sposta = () => {
    const mobili = $$('.voce[data-p]:not(.fissato)', lista)
    const dopo = mobili.find(x => x !== voce && y < x.getBoundingClientRect().top + x.offsetHeight / 2)
    if (dopo) { if (voce.nextElementSibling !== dopo) dopo.before(voce) }
    else if (mobili.at(-1) !== voce) mobili.at(-1).after(voce)
  }
  // vicino al bordo la lista scorre da sola
  const passo = () => {
    const sc = telefono() ? $('#principale') : $('#lib-lista'), r = sc.getBoundingClientRect()
    if (y < r.top + 56) sc.scrollTop -= 8
    else if (y > r.bottom - 56) sc.scrollTop += 8
    sposta()
    giro = requestAnimationFrame(passo)
  }
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('.maniglia')
    if (!h) return
    e.preventDefault()
    voce = h.closest('.voce')
    lista = voce.parentElement
    y = e.clientY
    voce.classList.add('trascinata')
    h.setPointerCapture(e.pointerId)
    giro = requestAnimationFrame(passo)
  })
  document.addEventListener('pointermove', e => { if (voce) y = e.clientY })
  const fine = () => {
    if (!voce) return
    cancelAnimationFrame(giro)
    voce.classList.remove('trascinata')
    const ids = $$('.voce[data-p]', lista).map(x => +x.dataset.p)
    voce = lista = null
    ids.forEach((id, i) => { const p = S.perId.get(id); if (p) p.posizione = i })
    S.lib.ordine = 'personale'
    api('POST', '/api/libreria/ordine', { ids }).catch(sbaglio)
  }
  document.addEventListener('pointerup', fine)
  document.addEventListener('pointercancel', fine)
})()

// --- clic ---
// su una riga: un clic seleziona, doppio clic suona (come Spotify); sul telefono basta un tocco
document.addEventListener('dblclick', e => {
  const r = e.target.closest('.tr')
  if (!r || e.target.closest('button, a, select, input')) return
  const b = S.perBrano.get(+r.dataset.b)
  if (b.audio) suonaBrano(b.id)
  else scegliAudio(false, f => caricaVersione(b.id, f[0], b.versione_id))
})

document.addEventListener('click', async e => {
  const inMenu = e.target.closest('.menu')
  const t = e.target.closest('[data-az], [data-suona], [data-t], .tr')
  if (!inMenu && $('.menu')) { chiudiMenu(); e.preventDefault(); return }
  if (!t) return
  try {
    if (t.dataset.suona) { e.preventDefault(); e.stopPropagation(); return suonaContesto(t.dataset.suona) }
    if (t.dataset.t !== undefined) {
      const o = S.pannOnda, c = S.coda[S.i]
      if (!c || c.vid !== o.vid) { S.saltaDopo = +t.dataset.t; suonaBrano(o.bid, o.vid) }
      else salta(+t.dataset.t)
      return
    }
    const az = t.dataset.az, arg = t.dataset.arg
    const riga = t.closest('.tr'), bRiga = riga && S.perBrano.get(+riga.dataset.b)
    const pb = S.pann && S.pann.prog.brani.find(x => x.id === S.pann.bid)
    const vr = t.closest('.ver-riga'), vid = vr && +vr.dataset.v
    const pid = inMenu ? +inMenu.dataset.pid : +rotta().arg
    const mb = inMenu && inMenu.dataset.bid ? S.perBrano.get(+inMenu.dataset.bid) : null
    const linkInMenu = inMenu && $('input', inMenu)?.value
    if (inMenu) chiudiMenu()
    switch (az) {
      case 'entra': return Dbx.entra()
      case 'condividi': return condividi(pid)
      case 'alfabetico': await api('PATCH', `/api/progetti/${pid}`, { ordine_manuale: 0 }); avviso('Brani in ordine alfabetico'); return ricarica()
      case 'revoca':
        if (!confirm('Interrompere la condivisione? Il link d’ascolto smette di funzionare per tutti quelli a cui l’hai mandato.')) return
        await revocaCondivisione(pid)
        avviso('Condivisione interrotta')
        return ricarica()
      case 'copia-link':
        try { await navigator.clipboard.writeText(linkInMenu); avviso('Link copiato') }
        catch { finestraLink(linkInMenu); avviso('Selezionalo e copialo a mano (Cmd+C)', true) }
        return
      case 'chiudi-menu': return
      case 'scarica': return scaricaVersione(vid)
      case 'importa': return importaInediti()
      case 'esci':
        if (!confirm('Scollegare Dropbox da questo dispositivo? I tuoi file restano dove sono.')) return
        await Dbx.esci()
        location.hash = '#/'
        location.reload()
        return
      case undefined:
        if (riga && !e.target.closest('a')) {
          S.scelta = bRiga.id
          $$('.tr').forEach(x => x.classList.toggle('scelta', +x.dataset.b === S.scelta))
          if (matchMedia('(max-width: 760px)').matches && bRiga.audio) suonaBrano(bRiga.id)
        }
        return
      case 'suona': return suonaBrano(bRiga.id)
      case 'apri': return telefono() ? menuBrano(0, 0, bRiga.id) : apriBrano(bRiga.id)  // sul telefono ⋯ apre le azioni dal basso
      case 'cuore': return cuore(arg ? +arg : bRiga.id)
      case 'chiudi': S.pann = null; return ridisegna()
      case 'nuovo-progetto': e.preventDefault(); return nuovoProgetto()
      case 'crea': {
        const r = t.getBoundingClientRect()
        return menu(r.left, r.bottom + 6, [{ testo: 'Carica brani…', az: 'carica-auto' }, '-', { testo: 'Nuovo progetto', az: 'nuovo-progetto' }, { testo: 'Nuova cartella', az: 'nuova-cartella' }])
      }
      case 'nuova-cartella': return nuovaCartella()
      case 'carica-auto': return scegliAudio(true, f => caricaBrani(null, f))
      case 'filtro': S.filtro = arg; return ridisegna()
      case 'ordine-lib': {
        e.preventDefault()
        const r = t.getBoundingClientRect()
        return menu(r.left, r.bottom + 6, [{ titoletto: 'Ordina per' }, ...Object.entries(ORDINI).map(([k, testo]) => ({ testo, az: 'ordina-lib', arg: k, on: (S.lib.ordine || 'ascoltati') === k }))])
      }
      case 'ordina-lib': {
        // la prima volta il personalizzato parte dall'ordine che si stava guardando
        const ids = arg === 'personale' && !S.lib.progetti.some(p => p.posizione != null) && progettiOrdinati().map(p => p.id)
        if (ids) ids.forEach((id, i) => { S.perId.get(id).posizione = i })
        S.lib.ordine = arg
        ridisegna()  // subito; il salvataggio su Dropbox va dopo
        if (arg === 'personale') avviso('Trascina i progetti dalla maniglia a destra')
        return ids ? api('POST', '/api/libreria/ordine', { ids }) : api('PATCH', '/api/libreria', { ordine: arg })
      }
      case 'maniglia': e.preventDefault(); return  // il tocco sulla maniglia non apre il progetto
      case 'menu-progetto': return menuProgetto(t)
      case 'aggiungi': return scegliAudio(true, f => caricaBrani(pid, f))
      case 'fissa': await api('PATCH', `/api/progetti/${pid}`, { fissato: S.perId.get(pid).fissato ? 0 : 1 }); return ricarica()
      case 'colore': await api('PATCH', `/api/progetti/${pid}`, { sfondo: (S.perId.get(pid).sfondo % 10) + 1 }); return ricarica()
      case 'cover': $('#scegli-cover').value = ''; return $('#scegli-cover').click()
      case 'togli-cover': await api('DELETE', `/api/progetti/${pid}/cover`); return ricarica()
      case 'foto-autore': $('#scegli-foto-autore').value = ''; return $('#scegli-foto-autore').click()
      case 'togli-foto-autore': try { await togliFotoAutore(rotta().arg); avviso('Foto tolta') } catch (e) { sbaglio(e) } return ricarica()
      case 'sposta': await api('PATCH', `/api/progetti/${pid}`, { cartella_id: arg ? +arg : null }); avviso(arg ? 'Spostato' : 'Tolto dalla cartella'); return ricarica()
      case 'sposta-nuova': return nuovaCartella(pid)
      case 'elimina-progetto': {
        const p = S.perId.get(pid)
        if (!confirm(`Eliminare “${p.titolo}” con tutti i brani? I file vanno nel cestino di Bounces su Dropbox (cartella .bounces/cestino).`)) return
        await api('DELETE', `/api/progetti/${pid}`)
        if (S.coda[S.i]?.pid === pid) { A.pause(); A.removeAttribute('src'); S.coda = []; S.i = -1 }
        if (S.pann && S.perBrano.get(S.pann.bid)?.progetto_id === pid) S.pann = null
        await caricaLib()
        location.hash = '#/'
        return
      }
      case 'elimina-cartella':
        if (!confirm('Eliminare la cartella? I progetti dentro restano nella libreria.')) return
        await api('DELETE', `/api/cartelle/${arg}`)
        await caricaLib()
        location.hash = '#/'
        return
      // dal pannello
      case 'nuova-versione': return scegliAudio(false, f => caricaVersione(pb.id, f[0]))
      case 'collega': return scegliAudio(false, f => caricaVersione(pb.id, f[0], vid))
      case 'suona-versione': return suonaBrano(pb.id, vid)
      case 'rendi-attiva': await api('PATCH', `/api/brani/${pb.id}`, { versione_attiva: vid }); return ricarica()
      case 'elimina-versione': {
        const v = pb.versioni.find(x => x.id === vid)
        if (!confirm(`Eliminare la versione ${v.etichetta}${v.commenti.length ? ' e i suoi commenti' : ''}?`)) return
        await api('DELETE', `/api/versioni/${vid}`)
        return ricarica()
      }
      case 'elimina-brano': return eliminaBrano(pb.id)
      case 'elimina-commento': await api('DELETE', `/api/commenti/${+t.closest('.commento').dataset.c}`); return ricarica()
      case 'analizza': {
        const v = pb.versioni.find(x => x.id === pb.versione_attiva)
        t.disabled = true
        t.textContent = 'Analizzo...'
        const r = await analizza(() => Dbx.scarica(v.path).then(x => x.arrayBuffer()), v.id)
        avviso(r ? [r.bpm && r.bpm + ' BPM', r.key].filter(Boolean).join(' · ') || 'Non sono riuscito a stimarli' : 'Analisi non riuscita', !r)
        return ricarica()
      }
      // dal tasto destro su un brano
      case 'm-suona': return suonaBrano(mb.id)
      case 'm-apri': return apriBrano(mb.id, true)
      case 'm-rinomina': return rinominaInRiga(mb.id)
      case 'm-autori': return autoriBrano(mb.id)
      case 'rinomina': return rinominaInRiga(bRiga.id)
      case 'm-cuore': return cuore(mb.id)
      case 'm-versione': return scegliAudio(false, f => caricaVersione(mb.id, f[0]))
      case 'm-collega': return scegliAudio(false, f => caricaVersione(mb.id, f[0], mb.versione_id))
      case 'm-progetto': location.hash = `#/progetto/${mb.progetto_id}`; return
      case 'm-scarica': return scaricaVersione(mb.versione_id)
      case 'm-elimina': return eliminaBrano(mb.id)
      case 'm-sposta': {
        const dest = S.perId.get(+arg)
        await api('PATCH', `/api/brani/${mb.id}`, { progetto_id: +arg })
        avviso(`“${S.info.get(mb.id).nome}” spostato in ${dest.titolo}`)
        return ricarica()
      }
    }
  } catch (err) { sbaglio(err) }
})

async function eliminaBrano(bid) {
  const b = S.perBrano.get(bid)
  if (!confirm(`Eliminare “${S.info.get(bid).nome}” con tutte le versioni?`)) return
  await api('DELETE', `/api/brani/${bid}`)
  if (S.pann && S.pann.bid === bid) S.pann = null
  if (S.coda[S.i]?.bid === bid) { A.pause(); S.coda.splice(S.i, 1); S.i = -1 }
  avviso(`“${S.info.get(b.id).nome}” eliminato`)
  await ricarica()
}

// --- campi modificabili (si salvano quando escono dal fuoco) ---
document.addEventListener('change', async e => {
  const el = e.target
  try {
    if (el.dataset.progetto) {
      const pid = +rotta().arg
      if (el.dataset.progetto === 'titolo' && !el.value.trim()) { el.value = S.perId.get(pid).titolo; return }
      await api('PATCH', `/api/progetti/${pid}`, { [el.dataset.progetto]: el.value })
    } else if (el.dataset.cartella) {
      if (!el.value.trim()) return
      await api('PATCH', `/api/cartelle/${rotta().arg}`, { titolo: el.value.trim() })
    } else if (el.dataset.brano) {
      if (el.dataset.brano === 'titolo' && !el.value.trim()) return
      await api('PATCH', `/api/brani/${S.pann.bid}`, { [el.dataset.brano]: el.value })
    } else if (el.dataset.versione) {
      let val = el.value.trim()
      if (el.dataset.versione === 'bpm') val = val ? parseFloat(val.replace(',', '.')) || null : null
      await api('PATCH', `/api/versioni/${S.pannOnda.vid}`, { [el.dataset.versione]: val || null })
    } else if (el.matches('[data-etichetta], [data-etichetta-v]')) {
      if (!el.value.trim()) return
      const vid = el.dataset.etichettaV ? +el.dataset.etichettaV : +el.closest('.ver-riga').dataset.v
      await api('PATCH', `/api/versioni/${vid}`, { etichetta: etichettaVersione(el.value) })
    } else if (el.dataset.statoV) {
      const w = el.closest('.stato')
      w.dataset.s = el.value
      w.firstElementChild.textContent = el.value ? el.value.toUpperCase() : '—'
      await api('PATCH', `/api/versioni/${+el.dataset.statoV}`, { stato: el.value || null })
      el.blur()
    } else return
    await ricarica()
  } catch (err) { sbaglio(err) }
})

document.addEventListener('submit', async e => {
  if (!e.target.matches('.nuovo-commento')) return
  e.preventDefault()
  const f = e.target, testo = f.testo.value.trim()
  if (!testo) return
  const vid = +f.dataset.v, c = S.coda[S.i]
  const secondi = f.a_tempo.checked ? (c && c.vid === vid ? A.currentTime : 0) : null
  try {
    await api('POST', `/api/versioni/${vid}/commenti`, { testo, secondi })
    f.testo.value = ''
    f.testo.blur()
    await ricarica()
  } catch (err) { sbaglio(err) }
})

// --- barra in alto e libreria ---
let attesaRicerca
$('#cerca').addEventListener('input', () => {
  clearTimeout(attesaRicerca)
  attesaRicerca = setTimeout(() => {
    if (rotta().vista !== 'cerca') location.hash = '#/cerca'
    else { disegnaPagina(); $('#principale').scrollTop = 0 }
  }, 120)
})
$('#cerca').addEventListener('focus', () => { if (rotta().vista !== 'cerca') location.hash = '#/cerca' })
$('#lib-chips').addEventListener('click', e => {
  const b = e.target.closest('button')
  if (!b) return
  S.filtro = b.dataset.filtro
  disegnaLibreria()
})
$('#lib-piu').addEventListener('click', e => {
  e.stopPropagation()
  const r = e.currentTarget.getBoundingClientRect()
  menu(r.left, r.bottom + 6, [{ testo: 'Carica brani…', az: 'carica-auto' }, '-', { testo: 'Nuovo progetto', az: 'nuovo-progetto' }, { testo: 'Nuova cartella', az: 'nuova-cartella' }])
})

// icone statiche
$('#vai-home').innerHTML = IC.casa
$('#ic-cerca').innerHTML = IC.cerca
$('#ic-libreria').innerHTML = IC.libreria
$('#lib-piu').innerHTML = IC.piu
$('#indietro').innerHTML = IC.indietro
$('#ic-carica').innerHTML = IC.piuCerchio
$('#zona-auto').addEventListener('click', () => scegliAudio(true, f => caricaBrani(null, f)))
$('#pl-casuale').innerHTML = IC.casuale
$('#pl-prec').innerHTML = IC.prec
$('#pl-succ').innerHTML = IC.succ
$('#pl-play').innerHTML = IC.play
$('#pl-loop').innerHTML = IC.loop
$('#pl-pannello').innerHTML = IC.pannello
$('#pl-cuore').innerHTML = IC.cuore
const schede = $$('#schede a span')
schede[0].innerHTML = IC.casa
schede[1].innerHTML = IC.cerca
schede[2].innerHTML = IC.libreria
let volIniziale = 1
try { const v = localStorage.getItem('inediti-volume'); if (v !== null) volIniziale = +v } catch {}
volume(volIniziale)

$('#account').addEventListener('click', e => {
  e.stopPropagation()
  const r = e.currentTarget.getBoundingClientRect()
  menu(r.right - 240, r.bottom + 6, [
    { titoletto: memo.get('bounces-nome') || 'Dropbox' },
    ...(location.hostname === 'localhost' ? [{ testo: 'Importa da Inediti (Mac)', az: 'importa' }] : []),
    { testo: 'Scollega Dropbox', az: 'esci' },
  ])
})

// tornando sull'app (altra scheda, telefono riaperto): se un altro dispositivo ha cambiato qualcosa, si ricarica
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) return
  if (S.ospite) return aggiornaOspite()
  if (!Dbx.collegato()) return
  if (await Archivio.cambiataAltrove()) ricarica()
})

async function leggiScheda(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('scheda ' + r.status)
  return r.json()
}
// chi ascolta da un link e torna sulla pagina vede subito le versioni nuove (senza fermare quello che sta suonando)
async function aggiornaOspite() {
  if (!S.ospite || !S.ospite.scheda) return
  let scheda
  try { scheda = await leggiScheda(S.ospite.scheda) } catch { return }
  const lib = libOspite(scheda)
  if (JSON.stringify(lib.brani.map(b => [b.titolo, b.url])) === JSON.stringify(S.ospite.lib.brani.map(b => [b.titolo, b.url]))) return
  S.ospite.lib = lib
  const c = S.coda[S.i]
  await caricaLib()
  if (c) {  // il brano in ascolto resta in coda col suo indirizzo, la coda si rifà sulla lista nuova
    const url = A.currentSrc
    S.coda = S.lib.brani.filter(b => b.audio).map(b => voce(b))
    S.i = Math.max(0, S.lib.brani.findIndex(b => b.url === url))
  }
  ridisegna()
  avviso('Aggiornato: ci sono novità in questo progetto')
}
window.addEventListener('beforeunload', e => {
  if (Archivio.pendenti.length || Archivio.salvando) { e.preventDefault(); e.returnValue = '' }
})

;(async () => {
  try { if (await Dbx.ritorno()) avviso('Dropbox collegato') } catch (e) { sbaglio(e) }
  mostra()
})()
