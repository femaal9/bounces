import {json, fail, sha, limited, readBody, link, proprietario, K_RE, SEGRETO_RE} from "../_lib.js";

// il produttore registra il suo link d'ascolto: {k, segreto}. Si può ripetere (stesso segreto = ok).
// {k, segreto, via: true}: interrompe la condivisione, cancella il link e tutti i suoi commenti.
export async function onRequestPost({request, env}){
  const db = env.DB, b = await readBody(request, 2000);
  if(await limited(db, request, "link", 120)) return fail("RATE", 429);
  const k = String(b.k || ""), segreto = String(b.segreto || "");
  if(!K_RE.test(k) || !SEGRETO_RE.test(segreto)) return fail("BAD", 400);
  const esiste = await link(db, k);
  if(b.via){
    if(!esiste) return json({ok: true});
    if(!await proprietario(db, k, segreto)) return fail("FORBIDDEN", 403);
    await db.batch([
      db.prepare("DELETE FROM commenti WHERE k = ?").bind(k),
      db.prepare("DELETE FROM links WHERE k = ?").bind(k),
    ]);
    return json({ok: true});
  }
  if(esiste) return await proprietario(db, k, segreto) ? json({ok: true}) : fail("FORBIDDEN", 403);
  await db.prepare("INSERT INTO links(k, owner, created) VALUES(?, ?, ?)").bind(k, await sha("owner:" + segreto), Date.now()).run();
  return json({ok: true});
}
