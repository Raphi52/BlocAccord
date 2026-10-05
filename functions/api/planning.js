// Planning commun de l'équipe, hébergé sur Cloudflare Pages (gratuit, sans crédits).
// Un seul enregistrement { v, ops, users, config } dans une base D1 liée sous le nom DB.
// Écriture refusée (409) si quelqu'un a modifié entre-temps : personne n'écrase un collègue sans le savoir.
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function lire(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS planning (id INTEGER PRIMARY KEY, v INTEGER NOT NULL, data TEXT NOT NULL)").run();
  const row = await db.prepare("SELECT v, data FROM planning WHERE id = 1").first();
  return row ? JSON.parse(row.data) : null;
}

export async function onRequest({ request, env }) {
  const db = env.DB;
  const lu = await lire(db);
  const cur = lu || { v: 0, ops: null };
  if (request.method === "GET") return json(200, cur);
  if (request.method !== "PUT") return json(405, { error: "méthode" });
  const texte = await request.text();
  if (texte.length > 500000) return json(413, { error: "trop gros" });
  let b; try { b = JSON.parse(texte); } catch { return json(400, { error: "json" }); }
  if (!Array.isArray(b.ops) || typeof b.v !== "number") return json(400, { error: "format" });
  if (b.v !== cur.v) return json(409, cur);
  if (b.users !== undefined && !Array.isArray(b.users)) return json(400, { error: "format" });
  const neuf = { v: cur.v + 1, ops: b.ops, users: b.users || cur.users || null, config: (b.config && typeof b.config === "object") ? b.config : (cur.config || null), at: new Date().toISOString() };
  // Écriture conditionnelle atomique : ne passe que si la version n'a pas bougé.
  const r = lu
    ? await db.prepare("UPDATE planning SET v = ?1, data = ?2 WHERE id = 1 AND v = ?3").bind(neuf.v, JSON.stringify(neuf), cur.v).run()
    : await db.prepare("INSERT OR IGNORE INTO planning (id, v, data) VALUES (1, ?1, ?2)").bind(neuf.v, JSON.stringify(neuf)).run();
  if (!r.meta.changes) return json(409, (await lire(db)) || cur);
  return json(200, { v: neuf.v });
}
