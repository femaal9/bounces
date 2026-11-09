// Bounces: fa aprire l'app anche senza rete (09/11, offline). Tiene solo i file dell'app, mai l'audio
// (quello lo salva offline.js) e non tocca le richieste a Dropbox.
// - js/css con ?v=... (messo da pubblica.sh): non cambiano mai, prima la copia salvata
// - il resto (index.html, worker, icone): prima la rete, e senza rete (o dopo 4 s) la copia salvata
const CACHE = 'bounces-app'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url)
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/__offline/')) return
  e.respondWith(u.searchParams.has('v') ? primaCache(r) : primaRete(r))
})

const chiave = r => r.mode === 'navigate' ? new Request(new URL('./', location.href)) : r
async function salva(r, risposta) {
  if (risposta.ok && risposta.type === 'basic') {
    const c = await caches.open(CACHE), u = new URL(r.url)
    // della stessa js/css si tiene solo l'ultima versione
    if (u.searchParams.has('v')) for (const k of await c.keys()) { const x = new URL(k.url); if (x.pathname === u.pathname && x.search !== u.search) await c.delete(k) }
    await c.put(chiave(r), risposta.clone())
  }
  return risposta
}
async function primaCache(r) {
  return (await (await caches.open(CACHE)).match(r)) || salva(r, await fetch(r))
}
async function primaRete(r) {
  const c = await caches.open(CACHE)
  const rete = fetch(r).then(x => salva(r, x))
  rete.catch(() => {})
  const tempo = new Promise(ok => setTimeout(ok, 4000))
  try {
    const x = await Promise.race([rete, tempo])
    if (x) return x
    return (await c.match(chiave(r), { ignoreSearch: true })) || await rete
  } catch {
    const x = await c.match(chiave(r), { ignoreSearch: true })
    if (x) return x
    throw new Error('offline')
  }
}
