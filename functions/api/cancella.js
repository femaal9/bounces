import {json, fail, sha, limited, readBody, proprietario, K_RE} from "../_lib.js";

// POST /api/cancella {k, id, chiave} (chi l'ha scritto) oppure {k, id, segreto} (il produttore)
export async function onRequestPost({request, env}){
  const db = env.DB, b = await readBody(request, 2000);
  const k = String(b.k || ""), id = Number(b.id);
  if(!K_RE.test(k) || !Number.isSafeInteger(id)) return fail("BAD", 400);
  if(await limited(db, request, "cancella", 300)) return fail("RATE", 429);
  if(b.segreto != null){
    if(!await proprietario(db, k, b.segreto)) return fail("FORBIDDEN", 403);
    await db.prepare("DELETE FROM commenti WHERE k = ? AND id = ?").bind(k, id).run();
    return json({ok: true});
  }
  const chiave = String(b.chiave || "");
  if(!/^[A-Za-z0-9_-]{10,60}$/.test(chiave)) return fail("BAD", 400);
  const r = await db.prepare("DELETE FROM commenti WHERE k = ? AND id = ? AND chiave = ?").bind(k, id, await sha("c:" + chiave)).run();
  return r.meta?.changes ? json({ok: true}) : fail("FORBIDDEN", 403);
}
