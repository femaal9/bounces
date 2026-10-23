// Worker: stima BPM (flusso spettrale + autocorrelazione a pettine) e tonalità (cromagramma + profili di Krumhansl).
// Riceve {id, sr, dati: Float32Array mono}, risponde {id, bpm, key}. È una stima: nel pannello si corregge a mano.
'use strict'
const NOMI = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MAGGIORE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINORE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1
    for (; j & b; b >>= 1) j ^= b
    j ^= b
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), meta = len >> 1
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < meta; k++) {
        const a = i + k, b = a + meta
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t
      }
    }
  }
}

// chiama cb(magnitudini) per ogni finestra (Hann) di n campioni, ogni hop
function spettri(x, n, hop, cb) {
  const hann = new Float64Array(n).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n))
  const re = new Float64Array(n), im = new Float64Array(n), mag = new Float64Array(n >> 1)
  for (let s = 0; s + n <= x.length; s += hop) {
    for (let i = 0; i < n; i++) { re[i] = x[s + i] * hann[i]; im[i] = 0 }
    fft(re, im)
    for (let k = 0; k < mag.length; k++) mag[k] = Math.hypot(re[k], im[k])
    cb(mag)
  }
}

function stimaBpm(x, sr) {
  const n = 1024, hop = 256, fps = sr / hop
  const flusso = []
  let prec = null
  spettri(x, n, hop, mag => {
    const ora = mag.map(m => Math.log1p(100 * m))
    let s = 0
    if (prec) for (let k = 0; k < ora.length; k++) { const d = ora[k] - prec[k]; if (d > 0) s += d }
    flusso.push(s)
    prec = ora
  })
  // via la media locale (~1 s): restano gli attacchi
  const w = Math.round(fps / 2), o = new Float64Array(flusso.length)
  for (let i = 0; i < flusso.length; i++) {
    let m = 0, c = 0
    for (let j = Math.max(0, i - w); j <= Math.min(flusso.length - 1, i + w); j++) { m += flusso[j]; c++ }
    o[i] = Math.max(0, flusso[i] - m / c)
  }
  const maxLag = Math.ceil(60 * fps / 60) * 4 + 2
  if (o.length < maxLag * 2) return null
  const ac = new Float64Array(maxLag + 1)
  for (let l = 1; l <= maxLag; l++) {
    let s = 0
    for (let i = l; i < o.length; i++) s += o[i] * o[i - l]
    ac[l] = s / (o.length - l)
  }
  const acf = l => { const a = Math.floor(l), f = l - a; return a + 1 > maxLag ? 0 : ac[a] * (1 - f) + ac[a + 1] * f }
  let migliore = null, top = -Infinity
  for (let b = 60; b <= 200; b += 0.1) {
    const periodo = 60 * fps / b
    let s = 0
    for (let k = 1; k <= 4; k++) s += acf(k * periodo) / k
    const prior = Math.exp(-0.5 * (Math.log2(b / 120) / 0.9) ** 2)  // ambiguità doppio/metà: preferisce l'intorno di 120
    if (s * prior > top) { top = s * prior; migliore = b }
  }
  return migliore && Math.round(migliore)
}

function stimaTonalita(x, sr) {
  const n = 8192, croma = new Float64Array(12), classe = new Int8Array(n >> 1).fill(-1)
  for (let k = 1; k < classe.length; k++) {
    const f = k * sr / n
    if (f >= 80 && f <= 5000) classe[k] = ((Math.round(12 * Math.log2(f / 440)) + 9) % 12 + 12) % 12
  }
  spettri(x, n, n, mag => {
    const fr = new Float64Array(12)
    for (let k = 0; k < mag.length; k++) if (classe[k] >= 0) fr[classe[k]] += mag[k]
    const tot = fr.reduce((a, b) => a + b, 0)
    if (tot > 0) for (let i = 0; i < 12; i++) croma[i] += fr[i] / tot  // ogni finestra pesa uguale
  })
  const corr = (a, b) => {
    const ma = a.reduce((s, v) => s + v, 0) / 12, mb = b.reduce((s, v) => s + v, 0) / 12
    let num = 0, da = 0, db = 0
    for (let i = 0; i < 12; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2 }
    return num / Math.sqrt(da * db || 1)
  }
  let migliore = null, top = -Infinity
  for (let t = 0; t < 12; t++) {
    const ruotato = Array.from({ length: 12 }, (_, i) => croma[(i + t) % 12])
    for (const [profilo, modo] of [[MAGGIORE, 'major'], [MINORE, 'minor']]) {
      const r = corr(ruotato, profilo)
      if (r > top) { top = r; migliore = `${NOMI[t]} ${modo}` }
    }
  }
  return croma.some(v => v > 0) ? migliore : null
}

// waveform: 400 picchi da 0 a 1 (in Bounces non c'è un server che la calcola)
function picchi(x, n = 400) {
  const passo = Math.max(1, Math.floor(x.length / n)), out = []
  let top = 0
  for (let i = 0; i + passo <= x.length && out.length < n; i += passo) {
    let m = 0
    for (let j = i; j < i + passo; j++) { const a = Math.abs(x[j]); if (a > m) m = a }
    out.push(m)
    if (m > top) top = m
  }
  return out.map(v => Math.round(v / (top || 1) * 100) / 100)
}

onmessage = e => {
  const { id, sr, dati } = e.data
  try {
    // al massimo due minuti presi dal centro del brano
    const max = 120 * sr, inizio = Math.max(0, Math.floor((dati.length - max) / 2))
    const x = dati.subarray(inizio, inizio + max)
    postMessage({ id, bpm: stimaBpm(x, sr), key: stimaTonalita(x, sr), picchi: picchi(dati) })
  } catch (err) {
    postMessage({ id, errore: String(err) })
  }
}
