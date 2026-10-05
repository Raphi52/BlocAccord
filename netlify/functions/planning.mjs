// Planning commun de l'équipe : un seul objet { v, ops } dans Netlify Blobs.
// Écriture refusée (409) si quelqu'un a modifié entre-temps : personne n'écrase un collègue sans le savoir.
import { getStore } from "@netlify/blobs";
const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export default async (req) => {
  // Démo : planning ouvert à tous ceux qui ont le lien (de vrais comptes viendront après la démo).
  const store = getStore({ name: "bloc-accord", consistency: "strong" });
  const lu = await store.getWithMetadata("planning", { type: "json" });
  const cur = lu?.data || { v: 0, ops: null };
  if (req.method === "GET") return json(200, cur);
  if (req.method !== "PUT") return json(405, { error: "méthode" });
  const texte = await req.text();
  if (texte.length > 500000) return json(413, { error: "trop gros" });
  let b; try { b = JSON.parse(texte); } catch { return json(400, { error: "json" }); }
  if (!Array.isArray(b.ops) || typeof b.v !== "number") return json(400, { error: "format" });
  if (b.v !== cur.v) return json(409, cur);
  if (b.users !== undefined && !Array.isArray(b.users)) return json(400, { error: "format" });
  const neuf = { v: cur.v + 1, ops: b.ops, users: b.users || cur.users || null, config: (b.config && typeof b.config === "object") ? b.config : (cur.config || null), at: new Date().toISOString() };
  const r = lu ? await store.setJSON("planning", neuf, { onlyIfMatch: lu.etag }) : await store.setJSON("planning", neuf, { onlyIfNew: true });
  if (r && r.modified === false) { const d = await store.get("planning", { type: "json", consistency: "strong" }); return json(409, d || cur); }
  return json(200, { v: neuf.v });
};
export const config = { path: "/api/planning" };
