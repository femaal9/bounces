// Bounces, server dei commenti di chi ascolta da un link (Cloudflare Pages Functions + database D1 collegato come DB).
// L'audio e la libreria restano nel Dropbox del produttore: qui ci sono solo i commenti degli artisti (testo, secondo, nome).
// Un link d'ascolto è identificato da k = SHA-256 di "bounces:" + indirizzo della sua scheda su Dropbox (lo sa solo chi ha il link).
// Il produttore registra il link con un suo segreto (solo l'impronta sta qui): serve per cancellare i commenti.

export const ORIGINS = ["https://femaal9.github.io", "http://localhost:8790"];
export const MAX_TESTO = 1000;
export const MAX_NOME = 40;
export const MAX_PER_LINK = 3000;
export const K_RE = /^[0-9a-f]{64}$/;
export const SEGRETO_RE = /^[A-Za-z0-9_-]{20,100}$/;

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS links(k TEXT PRIMARY KEY, owner TEXT NOT NULL, created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS commenti(id INTEGER PRIMARY KEY AUTOINCREMENT, k TEXT NOT NULL, v INTEGER NOT NULL, s REAL, t TEXT NOT NULL, n TEXT NOT NULL, chiave TEXT NOT NULL, creato INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS commenti_k ON commenti(k, id)",
  "CREATE TABLE IF NOT EXISTS hits(key TEXT PRIMARY KEY, n INTEGER NOT NULL, hour INTEGER NOT NULL)",
];
let schemaReady = null;
export function ready(db){
  if(!schemaReady) schemaReady = db.batch(SCHEMA.map(s => db.prepare(s))).catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

export function cors(request){
  const o = request.headers.get("Origin"), h = {"Vary": "Origin"};
  if(o && (ORIGINS.includes(o) || o === new URL(request.url).origin)){
    h["Access-Control-Allow-Origin"] = o;
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
export const json = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers: {
  "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}});
export const fail = (code, status) => json({error: code}, status);

const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
export const sha = async s => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
export function rand(bytes){
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// testo su una riga o più, senza caratteri di controllo
export const pulisci = (s, max) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f\u2028\u2029]/g, " ").trim().slice(0, max);

export async function readBody(request, maxBytes){
  const len = Number(request.headers.get("Content-Length") || 0);
  if(len > maxBytes) throw fail("TOO_BIG", 413);
  const text = await request.text();
  if(text.length > maxBytes) throw fail("TOO_BIG", 413);
  let b;
  try{ b = text ? JSON.parse(text) : {}; }catch{ throw fail("BAD_JSON", 400); }
  if(!b || typeof b !== "object" || Array.isArray(b)) throw fail("BAD_JSON", 400);
  return b;
}

// il link esiste? (registrato dal produttore)
export const link = (db, k) => db.prepare("SELECT owner FROM links WHERE k = ?").bind(k).first();
// il segreto è quello del produttore che ha registrato il link?
export async function proprietario(db, k, segreto){
  if(!SEGRETO_RE.test(String(segreto || ""))) return false;
  const row = await link(db, k);
  return !!row && row.owner === await sha("owner:" + segreto);
}

// limite di richieste per rete e per ora; vero = troppe
export async function limited(db, request, action, max){
  const hour = Math.floor(Date.now() / 3600000);
  const key = await sha(`${action}:${request.headers.get("CF-Connecting-IP") || "?"}:${hour}`);
  const row = await db.prepare("INSERT INTO hits(key, n, hour) VALUES(?, 1, ?) ON CONFLICT(key) DO UPDATE SET n = n + 1 RETURNING n")
    .bind(key, hour).first();
  if(Math.random() < 0.02) await db.prepare("DELETE FROM hits WHERE hour < ?").bind(hour - 1).run();
  return (row?.n || 0) > max;
}
