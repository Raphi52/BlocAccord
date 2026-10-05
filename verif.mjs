// Vérification de bout en bout en format téléphone (Edge installé, aucun téléchargement).
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
const url = pathToFileURL(new URL("./index.html", import.meta.url).pathname.replace(/^\/([A-Z]:)/,"$1")).href;
const out = new URL("./captures/", import.meta.url);
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await (await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:"fr-FR" })).newPage();
const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>m.type()==="error"&&errs.push(m.text()));
p.on("dialog",d=>d.accept());
const ok=(c,m)=>{ if(!c){ console.error("ÉCHEC: "+m); process.exitCode=1; } else console.log("OK: "+m); };
const shot=async n=>{await p.waitForTimeout(350);await p.screenshot({path:new URL(n,out).pathname.replace(/^\/([A-Z]:)/,"$1")});};
await p.goto(url); await p.evaluate(()=>localStorage.clear()); await p.reload();
ok(await p.isVisible("[data-testid=fictif]"), "mention données fictives");
await shot("1-planning.png");
// Proposer un créneau avec 2 anesthésistes
await p.click("#fab"); await p.selectOption("[name=label]","Coiffe des rotateurs");
await p.fill("[name=date]", await p.evaluate(()=>S.day)); await p.fill("[name=start]","16:00");
await p.selectOption("[name=site]","Médipôle"); await p.selectOption("[name=room]","Bloc B");
await p.check("[name=an_an2]"); await shot("2-proposer.png");
await p.click("[data-act=create]");
const card=()=>p.locator(".card",{hasText:"Coiffe des rotateurs"});
ok((await card().locator(".pill").innerText())==="En attente","proposition en attente");
// A accepte
await p.click("[data-me=an1]"); await card().click(); await p.click("[data-act=accept]");
ok((await card().locator(".pill").innerText())==="En attente","reste en attente tant que B n'a pas répondu");
// B propose autre chose
await p.click("[data-me=an2]"); await card().click(); await p.click("[data-act=counter]");
await p.fill("[name=start]","17:00"); await p.click("[data-act=sendCtr]");
ok((await card().locator(".pill").innerText())==="Contre-proposition","contre-proposition affichée");
await shot("3-contre-proposition.png");
// Chirurgien accepte la contre-proposition
await p.click("[data-me=chir]"); await card().click(); await shot("4-detail.png"); await p.click("[data-act=acceptCtr]");
// A reconfirme le nouveau créneau
await p.click("[data-me=an1]"); await card().click(); await p.click("[data-act=accept]");
ok((await card().locator(".pill").innerText())==="Validé","créneau validé par tous");
ok((await card().innerText()).includes("17:00"),"nouvel horaire 17:00 appliqué");
await p.click("[data-me=chir]"); await shot("5-valide.png");
// Conflit : même salle, même heure
await p.click("#fab"); await p.fill("[name=start]","08:30");
await p.selectOption("[name=site]","Clinique du Parc"); await p.selectOption("[name=room]","Salle 2");
ok(await p.isVisible("#live .conf"),"alerte conflit dès le formulaire");
await p.click("[data-act=create]");
ok(await p.locator("[data-testid=conflit]").count()>=2,"conflit visible sur les deux cartes");
await shot("6-conflit.png");
// Persistance
const n=await p.locator(".card").count(); await p.reload();
ok(await p.locator(".card").count()===n && await card().count()===1,"données conservées après rechargement");
await p.click("nav [data-tab=lieux]"); await shot("7-salles.png");
// ===== Salles : noms des hôpitaux et ajout d'une opération depuis un créneau =====
{ const h=await p.locator("#main .sec h2").allInnerTexts();
  ok(h.length===2&&h[0].includes("Clinique du Parc")&&h[1].includes("Médipôle"),"page Salles : Clinique du Parc et Médipôle seulement");
  ok(await p.locator("#main .days [data-day]").count()>5,"page Salles : bandeau des jours présent");
  await p.locator("#main [data-pick]").fill("2026-12-15"); await p.waitForTimeout(200);
  ok((await p.locator("[data-testid=salle]").first().innerText()).includes("déc"),"page Salles : choisir une autre date change le jour des salles");
  await p.click("#main .days [data-day]"); await shot("15-salles-dates.png");
  await p.click('[data-room="Médipôle|Bloc A"]'); await shot("9-salle-creneaux.png");
  ok(await p.locator("#sheet [data-testid=creneau]").count()>5,"la salle affiche ses créneaux libres");
  await p.click('#sheet [data-slot="11:30"]');
  ok(await p.inputValue("[name=site]")==="Médipôle"&&await p.inputValue("[name=room]")==="Bloc A"&&await p.inputValue("[name=start]")==="11:30","formulaire pré-rempli : Médipôle, Bloc A, 11:30");
  await p.selectOption("[name=label]","Canal carpien"); await p.fill("[data-testid=patient]","M. Test"); await shot("11-patient.png"); await p.click("[data-act=create]");
  const c=p.locator(".card",{hasText:"Canal carpien"});
  ok(await c.count()===1&&(await c.innerText()).includes("11:30")&&(await c.innerText()).includes("Bloc A"),"opération créée à 11:30 en Bloc A");
  ok((await c.innerText()).includes("M. Test"),"le nom du patient (facultatif) s'affiche sur la carte");
  ok(!(await p.locator(".card",{hasText:"Arthroscopie"}).innerText()).includes("👤"),"sans nom saisi, aucune ligne patient");
  await p.click("nav [data-tab=lieux]"); await p.click('[data-room="Médipôle|Bloc A"]');
  ok(!(await p.isVisible('#sheet [data-slot="11:30"]'))&&await p.locator("#sheet .card",{hasText:"Canal carpien"}).count()===1,"le créneau 11:30 est désormais occupé");
  await p.click("#sheet [data-act=close]");
  await p.click("[data-me=an1]"); await p.click('[data-room="Médipôle|Bloc A"]');
  ok(await p.locator("#sheet [data-testid=creneau]").count()===0,"un anesthésiste voit les créneaux sans pouvoir planifier");
  await p.click("#sheet [data-act=close]"); await p.click("[data-me=chir]");
  // anciennes données d'un téléphone : noms migrés
  await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("blocaccord.v1")); s.ops[0].site="Clinique Saint-Roch"; localStorage.setItem("blocaccord.v1",JSON.stringify(s)); });
  await p.reload(); ok(await p.evaluate(()=>S.ops.every(o=>o.site in SITES)),"anciens noms d'hôpitaux convertis"); }
// ===== Cas limites =====
await p.click("nav [data-tab=planning]"); await p.click("[data-me=chir]");
await p.evaluate(()=>window.scrollTo(0,1e6)); await p.waitForTimeout(200);
{ const fab=await p.locator("#fab").boundingBox(); const last=await p.locator(".card").last().boundingBox();
  ok(last.y+last.height<=fab.y,"le bouton Proposer ne recouvre pas la dernière carte"); }
const nb=()=>p.locator(".card").count();
const essai=async(remplir,msg)=>{ const avant=await nb(); await p.click("#fab"); await p.check("[name=an_an1]"); await remplir();
  await p.click("[data-act=create]"); await p.waitForTimeout(150);
  const refuse=await p.isVisible("#sheetBg.open [data-act=create]");
  ok(refuse && (await nb())===avant, msg);
  if(refuse) await p.click("#sheet [data-act=close]"); };
await essai(()=>p.fill("[name=date]",""),"refus sans date");
await essai(()=>p.fill("[name=start]",""),"refus sans heure");
await essai(async()=>{ await p.fill("[name=start]","23:30"); await p.selectOption("[name=dur]","180"); },"refus d'une fin après minuit");
{ const avant=await p.evaluate(()=>S.ops.length); await p.click("#fab"); await p.check("[name=an_an1]"); await p.fill("[name=start]","07:00");
  await p.evaluate(()=>{ const b=document.querySelector("[data-act=create]"); b.click(); b.click(); });
  ok((await p.evaluate(()=>S.ops.length))===avant+1,"double appui : une seule intervention"); }
// contre-proposition sans heure
await p.click("[data-me=an1]"); await p.click("nav [data-tab=planning]");
{ const c=p.locator(".card",{hasText:"07:00"}).first(); await c.click(); await p.click("[data-act=counter]"); await p.fill("[name=start]","");
  await p.click("[data-act=sendCtr]"); await p.waitForTimeout(150);
  ok(await p.isVisible("#sheetBg.open [data-act=sendCtr]"),"contre-proposition refusée sans heure");
  if(await p.isVisible("#sheetBg.open [data-act=close]")) await p.click("#sheet [data-act=close]"); }
// Lien patient + QR vers l'assistant (onglet Préparation) : seulement prep, clinique, date
{ const QR=(await import("qrcode")).default;
  const textes=["https://exemple.fr/?prep=1&date=2026-11-03","https://assistant-chirurgien.netlify.app/?prep=1&clinique=medipole&date=2027-01-15"+"x".repeat(60),"é"+"a".repeat(150)];
  let diff=0, n=0;
  for(const t of textes) for(let m=0;m<8;m++){ const mine=await p.evaluate(([t,m])=>qrMatrix(t,m).flat().map(Number).join(""),[t,m]);
    const v=(Math.sqrt(mine.length)-17)/4;
    const ref2=QR.create([{data:t,mode:"byte"}],{errorCorrectionLevel:"M",maskPattern:m,version:v}); n++; if(Array.from(ref2.modules.data).join("")!==mine) diff++; }
  ok(diff===0,"QR identique à la bibliothèque qrcode ("+n+" cas, "+diff+" écart)");
  await p.click("[data-me=chir]"); await p.click("nav [data-tab=planning]");
  const v=p.locator(".card",{has:p.locator(".pill",{hasText:"Validé"})}).first(); await v.click();
  ok(await p.isVisible("#sheet [data-act=lien]"),"bouton Lien patient sur un créneau validé");
  await p.click("#sheet [data-act=lien]");
  ok(!(await p.isVisible("[data-testid=qr]")),"pas de QR tant que l'adresse de l'assistant manque");
  await p.fill("[name=lienBase]","https://assistant.exemple.fr/?x=1#h"); await p.selectOption("[name=lienClin]","parc"); await p.click("#sheet [data-act=lienSave]");
  const lien=await p.inputValue("[data-testid=lien-url]"), u=new URL(lien), op=await p.evaluate(()=>S.ops.find(o=>o.id===$("#sheet").dataset.op));
  ok([...u.searchParams.keys()].sort().join()==="clinique,date,prep" && u.searchParams.get("clinique")==="parc" && u.searchParams.get("date")===op.date && !u.hash,"lien = prep, clinique, date seulement : "+lien);
  ok(!lien.includes(encodeURIComponent(op.label).slice(0,8)) && !/patient|nom|room|salle/i.test(u.search),"aucune donnée de l'intervention dans le lien");
  ok(await p.isVisible("[data-testid=qr]"),"QR affiché"); await shot("9-lien-patient.png");
  await p.reload(); await v.click(); await p.click("#sheet [data-act=lien]");
  ok((await p.inputValue("[data-testid=lien-url]"))===lien,"réglages du lien conservés après rechargement");
  await p.click("#sheet [data-act=close]");
  const enAttente=p.locator(".card",{has:p.locator(".pill",{hasText:"En attente"})}).first();
  if(await enAttente.count()){ await enAttente.click(); ok(!(await p.isVisible("#sheet [data-act=lien]")),"pas de lien patient tant que le créneau n'est pas validé"); await p.click("#sheet [data-act=close]"); } }
for (const bad of ["{pas du json", "{\"x\":1}", "null"]) {
  const e0=errs.length; await p.evaluate(v=>localStorage.setItem("blocaccord.v1",v),bad); await p.reload(); await p.waitForTimeout(200);
  ok((await nb())>0 && errs.length===e0,"données corrompues "+bad+" : la démo se recharge"); }
ok(errs.length===0,"aucune erreur console "+JSON.stringify(errs));
await b.close();
