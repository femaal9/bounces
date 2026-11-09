// Bounces: copia leggera per l'ascolto (09/11, Matteo: in macchina col Bluetooth andava a scatti).
// Il WAV originale resta su Dropbox com'è; questa è una copia MP3 a 320 kbps (circa 4,5 volte più piccola) che il player
// usa sul telefono, offline e nei link d'ascolto. Codifica in un worker con lamejs (lame.min.js, LGPL), così l'app non si blocca.
importScripts('lame.min.js')

onmessage = e => {
  const { id, sr, canali } = e.data
  try {
    const n = Math.min(2, canali.length)
    const enc = new lamejs.Mp3Encoder(n, sr, 320)
    const pcm = canali.slice(0, n).map(c => {
      const out = new Int16Array(c.length)
      for (let i = 0; i < c.length; i++) { const x = Math.max(-1, Math.min(1, c[i])); out[i] = x < 0 ? x * 0x8000 : x * 0x7fff }
      return out
    })
    const pezzi = [], PASSO = 1152 * 20
    for (let i = 0; i < pcm[0].length; i += PASSO) {
      const sx = pcm[0].subarray(i, i + PASSO)
      const b = n === 2 ? enc.encodeBuffer(sx, pcm[1].subarray(i, i + PASSO)) : enc.encodeBuffer(sx)
      if (b.length) pezzi.push(new Uint8Array(b))
    }
    const fine = enc.flush()
    if (fine.length) pezzi.push(new Uint8Array(fine))
    postMessage({ id, blob: new Blob(pezzi, { type: 'audio/mpeg' }) })
  } catch (err) { postMessage({ id, errore: String(err && err.message || err) }) }
}
