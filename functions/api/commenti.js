import {json, fail, sha, rand, limited, readBody, link, pulisci, K_RE, MAX_TESTO, MAX_NOME, MAX_PER_LINK} from "../_lib.js";

// GET /api/commenti?k=...  → {commenti: [{id, v, s, t, n, c}]} (tutti quelli del link, dal più vecchio)
export async function onRequestGet({request, env}){
  const db = env.DB, k = new URL(request.url).searchParams.get("k") || "";
  if(!K_RE.test(k)) return fail("BAD", 400);
  if(await limited(db, request, "leggi", 1200)) return fail("RATE", 429);
  if(!await link(db, k)) return fail("NO_LINK", 404);
  const r = await db.prepare("SELECT id, v, s, t, n, creato AS c FROM commenti WHERE k = ? ORDER BY id LIMIT ?").bind(k, MAX_PER_LINK).all();
  return json({commenti: r.results || []});
}

// POST /api/commenti {k, v: versione, s: secondo (o null), t: testo, n: nome} → {id, chiave}
// la chiave resta a chi ha scritto, per poter cancellare il suo commento
export async function onRequestPost({request, env}){
  const db = env.DB, b = await readBody(request, 8000);
  const k = String(b.k || ""), v = Number(b.v), t = pulisci(b.t, MAX_TESTO), n = pulisci(b.n, MAX_NOME).replace(/\s+/g, " ")
  const s = b.s == null || b.s === "" ? null : Number(b.s);
  if(!K_RE.test(k) || !Number.isSafeInteger(v) || v < 0 || !t || !n || (s != null && !(s >= 0 && s < 86400))) return fail("BAD", 400);
  if(await limited(db, request, "scrivi", 120)) return fail("RATE", 429);
  if(!await link(db, k)) return fail("NO_LINK", 404);
  const quanti = await db.prepare("SELECT COUNT(*) AS n FROM commenti WHERE k = ?").bind(k).first();
  if((quanti?.n || 0) >= MAX_PER_LINK) return fail("FULL", 409);
  const chiave = rand(18), creato = Math.floor(Date.now() / 1000);
  const r = await db.prepare("INSERT INTO commenti(k, v, s, t, n, chiave, creato) VALUES(?, ?, ?, ?, ?, ?, ?) RETURNING id")
    .bind(k, v, s == null ? null : Math.round(s * 10) / 10, t, n, await sha("c:" + chiave), creato).first();
  return json({id: r.id, chiave, creato});
}
