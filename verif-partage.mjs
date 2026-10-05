// Deux téléphones sur le site en ligne : une acceptation chez l'un apparaît chez l'autre.
import { chromium } from "playwright-core";
const URL_ = process.env.URL || "https://bloc-accord.netlify.app/", CODE = process.env.CODE;
const b = await chromium.launch({ channel: "msedge", headless: true });
const tel = async () => { const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, locale:"fr-FR" }); await c.addInitScript(k=>localStorage.setItem("blocaccord.code",k), CODE); const p = await c.newPage(); p.on("dialog",d=>d.accept()); await p.goto(URL_); await p.waitForTimeout(2500); return p; };
const ok=(c,m)=>{ console.log((c?"OK: ":"ÉCHEC: ")+m); if(!c) process.exitCode=1; };
const A = await tel(), B = await tel();
const etiquette = "Test partage " + Date.now().toString(36);
// A (chirurgien) crée une intervention
await A.evaluate(l=>{ const o=JSON.parse(JSON.stringify(S.ops[0])); o.id="t"+Date.now(); o.label=l; o.log=[]; S.ops.push(o); render(); }, etiquette);
await A.waitForTimeout(2500);
await B.evaluate(()=>Partage.tirer()); await B.waitForTimeout(2000);
ok(await B.evaluate(l=>S.ops.some(o=>o.label===l), etiquette), "B voit l'intervention créée par A");
// Écritures croisées : B écrit, puis A écrit sans avoir relu -> A doit être prévenu, pas écraser
await B.evaluate(l=>{ S.ops.find(o=>o.label===l).dur=111; render(); }, etiquette); await B.waitForTimeout(2500);
await A.evaluate(l=>{ S.ops.find(o=>o.label===l).dur=222; render(); }, etiquette); await A.waitForTimeout(3000);
ok(await A.evaluate(l=>S.ops.find(o=>o.label===l).dur, etiquette)===111, "A reçoit la version de B au lieu de l'écraser (conflit détecté)");
// Nettoyage
await A.evaluate(l=>{ S.ops=S.ops.filter(o=>o.label!==l); render(); }, etiquette); await A.waitForTimeout(2500);
await B.evaluate(()=>Partage.tirer()); await B.waitForTimeout(2000);
ok(!(await B.evaluate(l=>S.ops.some(o=>o.label===l), etiquette)), "suppression propagée (nettoyage)");
await b.close();
