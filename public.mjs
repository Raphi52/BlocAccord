// Met l'appli en ligne TEMPORAIREMENT pour la montrer sur un téléphone.
// Petit serveur local + tunnel https Cloudflare (gratuit, sans compte), réutilisé depuis AssistantChirurgien.
// Usage : node public.mjs   — Ctrl+C coupe le lien. Le lien change à chaque lancement.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url"; import QR from "qrcode";
const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT || 8790);
const FILES = { "/": "index.html", "/index.html": "index.html", "/manifest.json": "manifest.json", "/sw.js": "sw.js", "/icon.svg": "icon.svg" };
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/manifest+json", ".js": "text/javascript", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const f = FILES[new URL(req.url, "http://x").pathname];
  if (!f) { res.writeHead(404); return res.end("introuvable"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)], "cache-control": "no-cache" });
  fs.createReadStream(path.join(root, f)).pipe(res);
});
server.listen(PORT, "127.0.0.1", () => console.log(`Serveur local : http://localhost:${PORT}`));
const exe = [path.join(root, "..", "AssistantChirurgien", "bin", "cloudflared.exe")].find(fs.existsSync) || "cloudflared";
const tunnel = spawn(exe, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
let shown = false;
const watch = async d => {
  const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!m || shown) return; shown = true;
  fs.writeFileSync(path.join(root, "lien.txt"), m[0] + "\n");
  fs.writeFileSync(path.join(root, "qr-bloc-accord.svg"), await QR.toString(m[0], { type: "svg", margin: 2 }));
  console.log(`\n==============================================\n Ouvre sur le téléphone : ${m[0]}\n QR code : qr-bloc-accord.svg\n (puis « Ajouter à l'écran d'accueil »)\n==============================================\n`);
};
tunnel.stdout.on("data", watch); tunnel.stderr.on("data", watch);
tunnel.on("exit", c => { console.error(`[tunnel] arrêté (code ${c})`); server.close(); process.exit(c || 1); });
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { tunnel.kill(); server.close(); process.exit(0); });
