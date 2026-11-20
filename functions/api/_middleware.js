import {cors, fail, ready} from "../_lib.js";

// per tutte le richieste a /api: CORS, database pronto, errori sempre in JSON
export async function onRequest(ctx){
  const h = cors(ctx.request);
  if(ctx.request.method === "OPTIONS") return new Response(null, {status: 204, headers: h});
  let res;
  try{
    if(!ctx.env.DB) res = fail("NO_DB", 503);
    else{ await ready(ctx.env.DB); res = await ctx.next(); }
  }catch(e){ res = e instanceof Response ? e : fail("SERVER", 500); }
  res = new Response(res.body, res);
  for(const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}
