/* ASSOMi — ERP supermarché simple et complet (Côte d'Ivoire, FCFA/XOF)
   Taxes A/B/E • Réception contrôlée BL vs BC • Stocks Réserve→Rayons • POS tactile • Temps réel */
const LS_KEY = "erp_supermarche_v1";
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>[...r.querySelectorAll(s)];
const fmtN = n => new Intl.NumberFormat("fr-FR").format(Math.round(n||0)) + " FCFA";
const fmtQ = n => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:3}).format(n||0);
const todayStr = ()=> new Date().toISOString().slice(0,10);
function datePlusJours(jours,base=todayStr()){ const d=new Date(base+"T12:00:00"); d.setDate(d.getDate()+Number(jours||0)); return d.toISOString().slice(0,10); }
function normaliserDLC(v){ const s=String(v||"").trim(); const m=s.match(/^\+(\d+)\s*j$/i); if(m) return datePlusJours(+m[1]); const d=new Date(s); return s&&s!=="—"&&!isNaN(d)?d.toISOString().slice(0,10):s; }
const nowHM = ()=> new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
const uid = p => (p||"ID")+Date.now().toString(36).toUpperCase().slice(-4)+Math.floor(Math.random()*90+10);
const esc = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LOC_RESERVE = "Réserve Centrale";
const RAYON_LOCS = ()=> REFERENTIEL.map(r=>`${r.icone} ${r.nom}`);
const POSTES=["Caissière","Vendeuse","Hôtesse","Chef de rayon","Magasinier","Comptable","Gérant","Administrateur"];
/* Le rôle (droits de base) DÉCOULE du poste occupé — plus de choix manuel */
const POSTE_ROLE={"Caissière":"Vendeur","Vendeuse":"Vendeur","Hôtesse":"Vendeur","Chef de rayon":"Chef de rayon","Magasinier":"Chef de rayon","Comptable":"Comptable","Gérant":"Gérant","Administrateur":"Admin"};
const ROLE_RANK={"Vendeur":1,"Chef de rayon":2,"Comptable":3,"Gérant":4,"Admin":5};
function roleFromPostes(postes){
  let best="Vendeur";
  (postes||[]).forEach(p=>{ const r=POSTE_ROLE[p]; if(r&&ROLE_RANK[r]>ROLE_RANK[best]) best=r; });
  return best;
}
function roleDe(e){ return roleFromPostes((e&&e.postes&&e.postes.length)?e.postes:[e&&e.poste]); }
/* Historique des prix : toute variation d'achat/vente est tracée (date, ancien→nouveau, agent) */
function trackPrix(p, newAchat, newVente, motif){
  p.histPrix=p.histPrix||[];
  if((p.achat||0)!==(newAchat||0)||(p.vente||0)!==(newVente||0)){
    p.histPrix.unshift({date:todayStr(),heure:nowHM(),achat:newAchat,vente:newVente,agent:agent(),motif:motif||"Ajustement"});
    if(p.histPrix.length>30) p.histPrix.length=30;
    return true;
  }
  return false;
}
function prixVarBadge(p){ const h=(p.histPrix||[])[0]; if(!h) return ""; const dA=(p.achat||0)-(h.achat||0), dV=(p.vente||0)-(h.vente||0); if(!dA&&!dV) return ""; return `<span class="badge b-warn">Δ achat ${dA>0?"+"+fmtN(dA):fmtN(dA)} • vente ${dV>0?"+"+fmtN(dV):fmtN(dV)}</span>`; }
/* Rayons/familles/sous-familles créés par le gérant (persistés) */
function applyCustomRef(){ (S.customRef&&S.customRef.rayons||[]).forEach(cr=>{ let r=REFERENTIEL.find(x=>x.code===cr.code); if(!r){ REFERENTIEL.push(JSON.parse(JSON.stringify(cr))); } else { (cr.familles||[]).forEach(cf=>{ let f=r.familles.find(x=>x.code===cf.code); if(!f) r.familles.push(JSON.parse(JSON.stringify(cf))); else (cf.sous||[]).forEach(s=>{ if(!f.sous.includes(s)) f.sous.push(s); }); }); } }); }
function me(){ return S.employes.find(e=>S.session&&e.code===S.session.code)||null; }
function isMagasinier(){ const m=me(); return m&&((m.postes||[]).includes("Magasinier")||m.poste==="Magasinier"); }

/* ---------- Taxes + régime fiscal CI (SIE / RSI / RNI / RME, micro-entreprenant) ---------- */
const REGIMES_FISCAUX={
  MICRO:{code:"MICRO",label:"Micro-entreprenant / Petit commerçant (0–50 M)",seuilMin:0,seuilMax:50000000,collecteTva:false,tse:0,seuilSuivi:true,docTva:"Pas de TVA",baremeTse:0},
  RME:{code:"RME",label:"Microentreprise — RME (50–200 M)",seuilMin:50000000,seuilMax:200000000,collecteTva:false,tse:0.02,seuilSuivi:true,docTva:"Ticket simple, sans TVA",baremeTse:0.02},
  RSI:{code:"RSI",label:"Régime Simplifié d'Imposition — RSI (200–500 M)",seuilMin:200000000,seuilMax:500000000,collecteTva:true,tse:0.001,seuilSuivi:true,docTva:"Ticket conforme",baremeTse:0.001},
  RNI:{code:"RNI",label:"Régime Normal d'Imposition — RNI (>500 M)",seuilMin:500000000,seuilMax:Infinity,collecteTva:true,tse:0.001,seuilSuivi:true,docTva:"Ticket + Facture normalisée",baremeTse:0.001}
};
function regimeFiscal(){ const r=(S.fiscal&&S.fiscal.regimeFiscal)||(S.fiscal&&S.fiscal.regime)||"RSI"; return REGIMES_FISCAUX[r]||REGIMES_FISCAUX.RSI; }
function regimeCode(){ const r=regimeFiscal(); return r.code; }
function regimeLabel(){ const r=regimeFiscal(); return r.label; }
/* ---------- Licence ASSOMi : toute copie sans clé vendeur = version bloquée. Ne pas retirer : contrôle d'intégrité au démarrage. ---------- */
function licenceInfo(){ S.licence=S.licence||{type:"DEMO",installDate:todayStr(),expireDate:"",key:"",client:""}; return S.licence; }
function licenceJoursRestants(){ const L=licenceInfo(); if(L.type==="FULL") return 9999; if(!L.expireDate) return 3; const t=Date.parse(todayStr()+"T00:00:00Z"), e=Date.parse(L.expireDate+"T00:00:00Z"); if(!Number.isFinite(t)||!Number.isFinite(e)) return 0; return Math.ceil((e-t)/86400000); }
function licenceExpiree(){ const L=licenceInfo(); if(L.type==="FULL") return false; return licenceJoursRestants()<0; }
function cleLicenceAttendue(){ const L=licenceInfo(); const base=((L.client||"")+"|"+(L.installDate||"")+"|ASSOMI-CI-2026").toUpperCase().replace(/[^A-Z0-9]/g,""); let h=0; for(let i=0;i<base.length;i++){ h=((h*31)+base.charCodeAt(i))>>>0; } return "ASSOMI-"+h.toString(36).toUpperCase().padStart(6,"0")+"-"+(L.installDate||"").replace(/-/g,""); }
function verrouLicenceHTML(){ const L=licenceInfo(); return `<div class="card" style="max-width:560px;margin:40px auto;text-align:center"><h2>🔒 Démo ASSOMi expirée</h2><div class="alert a-yel">Démo 72h terminée le <b>${esc(L.expireDate||"—")}</b> (installée le ${esc(L.installDate||"—")}). Vos données de test restent visibles après activation.</div><label>Nom du client (boutique)</label><input id="lic_client" value="${esc(L.client||"")}" placeholder="Ex : Supérette Étoile du Plateau"><label>Clé d'activation FULL</label><input id="lic_key" value="" placeholder="Clé fournie par ASSOMi après paiement"><div class="toolbar"><button class="btn btn-p" onclick="activerLicence()">🔓 Activer la licence</button></div><div class="small">Contact vendeur : paiement → clé unique liée au nom + date d'installation. Sans clé valide, encaissement et réceptions bloqués, lecture seule.</div></div>`; }
function activerLicence(){ const L=licenceInfo(); const c=($("#lic_client").value||"").trim(), k=($("#lic_key").value||"").trim().toUpperCase(); if(!c) return alert("Saisissez le nom du client."); L.client=c; const att=cleLicenceAttendue(); if(k!==att){ save(); render(); return alert("Clé invalide — contactez le vendeur ASSOMi avec le nom exact + date d'installation."); } L.type="FULL"; L.key=k; save(); alert("✅ Licence FULL activée pour "+c+". Démo verrouillée levée."); render(); }
function codeVendeur(){ return (S.licence&&S.licence.vcode)||"ASSOMI-2026"; }
function definirCodeVendeur(){ const n=prompt("Nouveau code vendeur (à retenir par vous seul) :", codeVendeur()); if(!n||!n.trim()) return; S.licence=S.licence||{}; S.licence.vcode=n.trim(); save(); alert("✅ Code vendeur mis à jour. Ne le communiquez jamais."); render(); }
function deverrouillerVendeur(){ const c=($("#lic_vcode").value||"").trim(); if(c!==codeVendeur()) return alert("Code vendeur incorrect."); if(c==="ASSOMI-2026"){ if(!confirm("Code vendeur par défaut détecté. Changez-le maintenant par votre code personnel ?")) return; definirCodeVendeur(); return; } $("#lic_vzone").innerHTML=zoneVendeurHTML(); }
function zoneVendeurHTML(){ const L=licenceInfo(); return `<div class="alert a-yel">Client : <b>${esc(L.client||"—")}</b> • Date : <b>${esc(L.installDate||"—")}</b><br>Clé attendue : <b>${cleLicenceAttendue()}</b> — ne la communiquez qu'après paiement.<div class="row2" style="margin-top:8px"><div><label>Nom client</label><input id="lic_client2" value="${esc(L.client||"")}"></div><div><label>Clé FULL</label><input id="lic_key2" value="${esc(L.key||"")}"></div></div><div class="toolbar"><button class="btn btn-p btn-s" onclick="L2Activer()">🔓 Activer</button><button class="btn btn-g btn-s" onclick="if(confirm('Réarmer la démo 72h ?')){S.licence={type:'DEMO',installDate:todayStr(),expireDate:'',key:'',client:''};migrate();save();render();}">♻ Réarmer 72h</button> <button class="btn btn-g btn-s" onclick="definirCodeVendeur()">🔑 Changer mon code vendeur</button></div></div>`; }
function L2Activer(){ const L=licenceInfo(); L.client=($("#lic_client2").value||"").trim(); const k=(($("#lic_key2").value||"").trim()||($("#lic_key")&&$("#lic_key").value)||"").toUpperCase().trim(); if(!L.client) return alert("Nom client obligatoire."); $("#lic_client").value=L.client; $("#lic_key").value=k; activerLicence(); }
function genererCleClient(nom,dateInstall){ const base=(String(nom||"")+"|"+String(dateInstall||"")+"|ASSOMI-CI-2026").toUpperCase().replace(/[^A-Z0-9]/g,""); let h=0; for(let i=0;i<base.length;i++){ h=((h*31)+base.charCodeAt(i))>>>0; } return "ASSOMI-"+h.toString(36).toUpperCase().padStart(6,"0")+"-"+String(dateInstall||"").replace(/-/g,""); }
function collecteTvaActive(){ if(S&&S.fiscal&&S.fiscal.collecteTva===false) return false; if(S&&S.fiscal&&S.fiscal.collecteTva===true) return true; return regimeFiscal().collecteTva!==false; }
function tauxTseActif(){ if(S&&S.fiscal&&Number.isFinite(Number(S.fiscal.tauxTse))) return Number(S.fiscal.tauxTse); return regimeFiscal().tse||0; }
function totalTSE(lignes){ const t=tauxTseActif(); if(!t) return 0; return (lignes||[]).reduce((a,l)=>{ if(l.offert||l.fid) return a; const tt=l.total!=null?l.total:(Number(l.qte||0)*Number(l.pu||0)); return a+tt*t; },0); }
function tauxOf(code){ if(S&&S.fiscal&&collecteTvaActive()===false) return 0; return (TAX_CODES[code]||TAX_CODES.A).taux; }
function codeTvaOf(p){ return p.code_tva || (p.tva===0?"E":(p.tva===9||p.tva===10?"B":"A")); }
/* Prix rayon = TTC. HT = TTC/(1+t), TVA = TTC-HT */
function ttcVentile(ttc, code){ const t=tauxOf(code); const ht=ttc/(1+t/100); return {ht, tva:ttc-ht, ttc, taux:t}; }
function recapTaxes(lignes){
  /* Micro/RME sans collecte : pas de ventilation TVA, ticket simple avec prix TTC brut. */
  if(S&&S.fiscal&&!collecteTvaActive()){ const ttc=(lignes||[]).reduce((a,l)=>a+(l.total!=null?l.total:(Number(l.qte||0)*Number(l.pu||0))),0); return [{code:"—",taux:0,ht:ttc,tva:0,ttc,note:"Régime "+regimeCode()+" : pas de collecte TVA — ticket simple"}]; }
  const r={};
  lignes.forEach(l=>{ const code=l.code_tva||"A"; const ttc=l.total!=null?l.total:(l.qte*l.pu);
    const v=ttcVentile(ttc,code);
    r[code]=r[code]||{code,taux:tauxOf(code),ht:0,tva:0,ttc:0};
    r[code].ht+=v.ht; r[code].tva+=v.tva; r[code].ttc+=v.ttc; });
  return Object.values(r).sort((a,b)=>a.code.localeCompare(b.code));
}

/* ---------- Store — VERSION VIERGE PROSPECT : aucune donnée démo ---------- */
function defaultStore(){
  return {
    produits: [],
    fournisseurs: [],
    employes: [
      {id:"E-GER", nom:"Gérant", poste:"Gérant", role:"Gérant", code:"9999", rayon:"Direction", salaire:0, statut:"Actif"},
      {id:"E-ADM", nom:"Administrateur", poste:"Administrateur", role:"Admin", code:"7777", rayon:"Direction", salaire:0, statut:"Actif"},
    ],
    ventes: [], mouvements: [], bcs: [], bls: [], inventaires: [], demarques: [], dlcMarks: [], lots: [],
    promos:[],
    clients:[],
    caisse:{ouverte:false, fond:0, ouverteLe:"", caissier:""},
    zClotures:[], factures:[], facturesPro:[], pointages:[], conges:[], holds:[],
    compteurSKU:20, session:null,
    licence:{type:"DEMO", installDate:"", expireDate:"", key:"", client:""},
    rolePerms:null,
    fidelite:{ptParF:1000, seuilPts:100, valeurBon:1000, remiseAuto:true},
    promoDLC:{seuilJ:20, remise:30, actif:false},
    trash:{produits:[], bcs:[]},
    params:{magasin:"", adresse:"", tel:"", tvaDefaut:18, seuilAlerteDLC:7, devise:"FCFA (XOF)", paiements:["Espèces","Carte bancaire","Orange Money","MTN MoMo","Wave"], heureOuverture:"08:00", quaiMaxH:4, ncc:"", regime:"", centreImpots:""},
    fiscal:{entrepriseId:"",raisonSociale:"",ncc:"",rccm:"",regimeFiscal:"",regime:"Régime Simplifié d'Imposition — RSI",collecteTva:true,adherentCga:false,devise:"XOF",tauxTse:0.001,suiviSeuilAlerte:true,masquerDetailTvaSurTicket:false,formatFactureNormalisee:true,piedDePageTicket:"Merci de votre fidélité ! RCCM: CI-ABJ-03-2024-B12-04567"},
    seq:{bc:1, facture:1, ticket:1, bl:1, inv:1, facturePro:1}
  };
}
let S;
try{ S = JSON.parse(localStorage.getItem(LS_KEY)) || defaultStore(); }catch(e){ S = defaultStore(); }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(S)); if(typeof SYNC!=='undefined'&&SYNC.on) SYNC.schedule(); }

/* Migration anciennes données v1 -> v2 */
function migrate(){
  let ch=false;
  if(!S.bls) {S.bls=[];ch=true;} if(!S.inventaires){S.inventaires=[];ch=true;}
  if(!S.demarques){S.demarques=[];ch=true;} if(!S.dlcMarks){S.dlcMarks=[];ch=true;} if(!S.seq.bl){S.seq.bl=1;S.seq.inv=1;ch=true;}
  if(!S.seq.ticket){S.seq.ticket=1;ch=true;}
  if(!S.ventes) {S.ventes=[];ch=true;} if(!S.produits) {S.produits=[];ch=true;} if(!S.employes){S.employes=[];ch=true;}
  if(!S.pointages){S.pointages=[];ch=true;}
  if(!S.lots){ S.lots=[]; ch=true; }
  S.produits.forEach((p,i)=>{
    if(!p.histPrix){ p.histPrix=[{date:todayStr(),heure:"08:00",achat:p.achat||0,vente:p.vente||0,agent:"Initial",motif:"Création"}]; ch=true; }
    if(!p.code_tva){ p.code_tva = (p.tva===0?"E":(p.tva===9||p.tva===10?"B":"A")); ch=true; }
    if(p.stockReserve==null){ const r=Math.ceil((p.stock||0)*0.65); p.stockReserve=r; p.stockRayon=(p.stock||0)-r; ch=true; }
    if(p.stockMin==null){ p.stockMin=p.seuil||10; ch=true; }
    if(p.stockMax==null){ p.stockMax=(p.seuil||10)*6; ch=true; }
    if(p.qteReappro==null){ p.qteReappro=Math.max(10,(p.seuil||10)*2); ch=true; }
    if(p.condCarton==null){ p.condCarton=12; ch=true; }
    if(p.lot==null){ p.lot=""; ch=true; }
    if(typeof p.dlc==="string"&&/^\+\d+\s*j$/i.test(p.dlc.trim())){ p.dlc=normaliserDLC(p.dlc); ch=true; }
    p.stock=(p.stockReserve||0)+(p.stockRayon||0);
  });
  S.employes.forEach((e,i)=>{
    if(!e.code){ e.code=String(1001+i); ch=true; }
    if(!e.role){ e.role=e.poste.includes("Caiss")||e.poste.includes("Vende")?"Vendeur":e.poste.includes("Chef")||e.poste.includes("Magasin")?"Chef de rayon":e.poste.includes("Comptable")?"Comptable":"Admin"; ch=true; }
  });
  S.mouvements.forEach(m=>{ if(!m.agent){m.agent="Système";} if(!m.src){m.src="—";} });
  if(!S.rolePerms){ S.rolePerms={"Vendeur":{dashboard:false,pos:true,catalogue:false,stocks:false,achats:false,rh:false,compta:false,admin:false,pointeuse:true},"Chef de rayon":{dashboard:true,pos:false,catalogue:true,stocks:true,achats:true,rh:false,compta:false,admin:false,pointeuse:true},"Comptable":{dashboard:true,pos:false,catalogue:false,stocks:false,achats:true,rh:true,compta:true,admin:false,pointeuse:true},"Admin":{dashboard:true,pos:true,catalogue:true,stocks:true,achats:true,rh:true,compta:true,admin:true,pointeuse:true},"Gérant":{dashboard:true,pos:true,catalogue:true,stocks:true,achats:true,rh:true,compta:true,admin:true,pointeuse:true}}; ch=true; }
  ["Vendeur","Chef de rayon","Comptable","Admin","Gérant"].forEach(r=>{ if(S.rolePerms[r]&&S.rolePerms[r].fne===undefined){ S.rolePerms[r].fne=(r==="Comptable"||r==="Admin"||r==="Gérant"); S.rolePerms[r].corbeille=(r==="Admin"); ch=true; } });
  if(!S.fidelite){ S.fidelite={ptParF:1000, seuilPts:100, valeurBon:1000, remiseAuto:true}; ch=true; }
  if(!S.holds){ S.holds=[]; ch=true; }
  if(!S.facturesPro){ S.facturesPro=[]; ch=true; }
  if(!S.seq.facturePro){ S.seq.facturePro=1; ch=true; }
  if(!S.customRef){ S.customRef={rayons:[]}; ch=true; }
  if(!S.delRequests){ S.delRequests=[]; ch=true; }
  if(!S.promoDLC){ S.promoDLC={seuilJ:20, remise:30, actif:false}; ch=true; }
  if(!S.licence){ S.licence={type:"DEMO", installDate:"", expireDate:"", key:"", client:"", vcode:(S.licence&&S.licence.vcode)||undefined}; ch=true; }
  if(S.licence&&!S.licence.installDate){ S.licence.installDate=todayStr(); try{ const d=new Date(S.licence.installDate+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+3); S.licence.expireDate=d.toISOString().slice(0,10); }catch(e){} ch=true; }
  if(S.licence&&!S.licence.installDate){ S.licence.installDate=todayStr(); ch=true; }
  if(S.licence&&S.licence.type==="DEMO"&&!S.licence.expireDate&&S.licence.installDate){ try{ const d=new Date(S.licence.installDate+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+3); S.licence.expireDate=d.toISOString().slice(0,10); ch=true; }catch(e){} }
  if(!S.fiscal){ S.fiscal={entrepriseId:"btq_civ_94820",raisonSociale:"Supérette Étoile du Plateau",ncc:"2104567 Z",rccm:"CI-ABJ-03-2024-B12-04567",regimeFiscal:"RSI",regime:"Régime Simplifié d'Imposition — RSI",collecteTva:true,adherentCga:false,devise:"XOF",tauxTse:0.001,suiviSeuilAlerte:true,masquerDetailTvaSurTicket:false,formatFactureNormalisee:true,piedDePageTicket:"Merci de votre fidélité ! RCCM: CI-ABJ-03-2024-B12-04567"}; ch=true; }
  if(!S.corbeille){ S.corbeille=[]; ch=true; }
  if(!S.tasksDone){ S.tasksDone=[]; ch=true; }
  if(!S.fne){ S.fne=[]; ch=true; }
  if(S.params&&!S.params.heureOuverture){ S.params.heureOuverture="08:00"; S.params.quaiMaxH=4; S.params.ncc=S.params.ncc||"CI-ABJ-2026-B-0000"; if(!S.params.regime||/SII/.test(S.params.regime)) S.params.regime="Régime fiscal (MICRO/RME/RSI/RNI) — voir carte Régime fiscal"; S.params.centreImpots=S.params.centreImpots||"Centre des Impôts de Cocody"; ch=true; }
  if(!S.params.blAutoH){ S.params.blAutoH=24; ch=true; }
  if(!S.trash){ S.trash={produits:[], bcs:[]}; ch=true; }
  S.employes.forEach(e=>{ if(!e.postes){ e.postes=[e.poste||"Vendeuse"]; ch=true; } if(!e.rayons){ e.rayons=[e.rayon||"Caisses"]; ch=true; } if(!e.modules){ e.modules=[]; ch=true; }
    const r=roleDe(e); if(e.role!==r){ e.role=r; ch=true; } });
  if((S.lots||[]).length===0){ S.produits.forEach(p=>{ const tot=(Number(p.stockReserve||0)+Number(p.stockRayon||0)); if(tot>0){ S.lots.unshift({id:uid("LOT"),sku:p.sku,lot:p.lot||"",dlc:normaliserDLC(p.dlc||"")||"",fournisseur:p.fournisseur||"",qteReserve:Number(p.stockReserve||0),qteRayon:Number(p.stockRayon||0),prixAchat:Number(p.achat||0),dateEntree:todayStr(),heure:nowHM(),blId:"initial"}); } }); if(S.lots.length) ch=true; }
  (S.lots||[]).forEach(l=>{ if(!l.id){l.id=uid("LOT");ch=true;} l.qteReserve=Number(l.qteReserve||0); l.qteRayon=Number(l.qteRayon||0); l.prixAchat=Number(l.prixAchat||0); const n=normaliserDLC(l.dlc||""); if(n!==l.dlc){l.dlc=n;ch=true;} });
  if(ch) save();
}
migrate();

/* ---------- Référentiel ---------- */
function rayonParCode(c){ return REFERENTIEL.find(r=>r.code===c); }
function familleParCode(rc, fc){ const r=rayonParCode(rc); return r? r.familles.find(f=>f.code===fc):null; }
function rayonNom(c){ const r=rayonParCode(c); return r? `${r.icone} ${r.nom}` : c; }
function sousCode(rc,fc,sous){ const f=familleParCode(rc,fc); if(!f) return "00"; const i=f.sous.indexOf(sous); return String((i<0?99:i+1)).padStart(2,"0"); }
function genererSKU(rc,fc,sous){ const n=String(S.compteurSKU++).padStart(4,"0"); return `${rc}${fc}${sousCode(rc,fc,sous)}${n}`; }
function marge(p){ const m=p.vente-p.achat; return {m, tx:p.achat?(m/p.achat*100):0}; }
function dlcJours(dlc){ if(!dlc||dlc==="—") return 9999; const normalized=normaliserDLC(dlc); const t=Date.parse(todayStr()+"T00:00:00Z"), d=Date.parse(normalized+"T00:00:00Z"); return Number.isFinite(d)?Math.ceil((d-t)/86400000):9999; }
function syncStock(p){ p.stock=(+p.stockReserve||0)+(+p.stockRayon||0); }
function agent(){ return (S.session&&S.session.nom)||"Système"; }
function addMouvement(type, sku, qte, motif, ref, src, dst){
  const p=S.produits.find(x=>x.sku===sku);
  S.mouvements.unshift({id:uid("MV"), date:todayStr(), heure:nowHM(), type, sku, nom:p?p.nom:sku, qte, motif:motif||"", ref:ref||"", agent:agent(), src:src||"—", dst:dst||"—"});
  save();
}

/* ---------- Auth, rôles & droits par bouton ---------- */
const ROLES=["Vendeur","Chef de rayon","Comptable","Admin","Gérant"];
/* Main totale Admin/Gérant : chaque rôle voit uniquement ses modules. Ex: caissière (Vendeur) = POS + pointeuse. Modifiable dans Admin. */
const DEFAULT_ROLE_PERMS={
  "Vendeur":{dashboard:false,pos:true,catalogue:false,stocks:false,achats:false,rh:false,compta:false,admin:false,fne:false,corbeille:false,pointeuse:true},
  "Chef de rayon":{dashboard:true,pos:false,catalogue:true,stocks:true,achats:true,rh:false,compta:false,admin:false,fne:false,corbeille:false,pointeuse:true},
  "Comptable":{dashboard:true,pos:false,catalogue:false,stocks:false,achats:true,rh:true,compta:true,admin:false,fne:true,corbeille:false,pointeuse:true},
  "Admin":{dashboard:true,pos:true,catalogue:true,stocks:true,achats:true,rh:true,compta:true,admin:true,fne:true,corbeille:true,pointeuse:true},
  "Gérant":{dashboard:true,pos:true,catalogue:true,stocks:true,achats:true,rh:true,compta:true,admin:true,fne:true,corbeille:false,pointeuse:true}
};
/* Droits fins par bouton (Admin/Gérant peut tout rouvrir) */
const BUTTONS={
  pos_encaisser:{label:"Encaisser", mod:"pos"}, pos_avoir:{label:"Avoir / suppression ticket", mod:"pos"},
  cat_create:{label:"Créer/modifier article", mod:"catalogue"}, cat_delete:{label:"Supprimer article", mod:"catalogue"},
  stock_inv:{label:"Valider inventaire", mod:"stocks"}, stock_dem:{label:"Démarque", mod:"stocks"},
  ach_validate:{label:"Valider BC", mod:"achats"}, ach_pay:{label:"Payer facture", mod:"achats"},
  compta_z:{label:"Clôture Z", mod:"compta"}
};
function rolePerms(){ if(!S.rolePerms) S.rolePerms=JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS)); return S.rolePerms; }
function can(m){ if(!S.session) return false; const emp=me(); if(emp&&(emp.modules||[]).includes(m)) return true; const rp=rolePerms()[S.session.role]; if(rp&&m in rp) return !!rp[m]; const FALLBACK={dashboard:ROLES,pos:ROLES,catalogue:["Chef de rayon","Comptable","Admin","Gérant"],stocks:ROLES,achats:["Chef de rayon","Comptable","Admin","Gérant"],rh:["Comptable","Admin","Gérant"],compta:["Comptable","Admin","Gérant"],admin:["Admin","Gérant"],pointeuse:ROLES}; return (FALLBACK[m]||[]).includes(S.session.role); }
function needRole(m){ if(can(m)) return true; alert("⛔ Module réservé à votre poste.\nVotre rôle : "+(S.session?S.session.role:"—")+" — demandez à l'Admin / Gérant d'élargir vos droits (Admin → Rôles & droits)."); return false; }
function isAdmin(){ return S.session&&(S.session.role==="Admin"||S.session.role==="Gérant"); }
function isGerant(){ return S.session&&S.session.role==="Gérant"; }
function isSuperAdmin(){ return S.session&&S.session.role==="Admin"; }
/* Corbeille : journal anti-vol interne — seul l'Admin (7777) peut la consulter */
function logCorbeille(type, refId, detail, valeur){
  S.corbeille=S.corbeille||[];
  S.corbeille.unshift({id:uid("CB"), date:todayStr(), heure:nowHM(), type, refId:refId||"—", detail:detail||"", valeur:valeur||0, auteur:agent(), poste:(me()&&me().poste)||(S.session?S.session.role:"—")});
  save();
}
/* Code admin / gérant (démo) */
function adminCode(){ const g=S.employes.find(e=>e.role==="Gérant"&&e.statut==="Actif"); const a=S.employes.find(e=>e.role==="Admin"&&e.statut==="Actif"); return (a&&a.code)||(g&&g.code)||"9999"; }
function loginScreen(){
  const opts=S.employes.filter(e=>e.statut==="Actif");
  openModal(`<h3>🔐 Connexion — entrez votre <b>code d'accès</b> personnel</h3>
  <div class="small">Chaque employé possède un code à 4 chiffres + un rôle défini par l'Admin / Gérant (module RH). Toutes les actions en caisse, stock et inventaires sont tracées au nom de l'agent connecté.</div>
  <label>Code d'accès <button class="btn btn-g btn-s" onclick="padShow('loginCode')">🔢 Pavé tactile</button></label><input id="loginCode" type="password" inputmode="numeric" placeholder="Ex : 1001" style="font-size:22px;text-align:center;letter-spacing:6px" onkeydown="if(event.key==='Enter')doLogin()">
  <div class="toolbar"><button class="btn btn-p" onclick="doLogin()">Se connecter</button></div>
  <div class="small">🔑 Codes initiaux (à changer après installation) : Admin <b>7777</b> • Gérant <b>9999</b>. Créez ensuite les codes de chaque employé en RH.</div>
  <hr><div class="small"><b>Codes démo :</b> ${opts.map(e=>`${esc(e.nom)} (${e.role}) → <b>${esc(e.code)}</b>`).join(" • ")}</div>`, true);
  setTimeout(()=>$("#loginCode")&&$("#loginCode").focus(),300);
}
function doLogin(){
  const c=($("#loginCode").value||"").trim();
  const e=S.employes.find(x=>x.code===c&&x.statut==="Actif");
  if(!e) return alert("Code inconnu. Demandez votre code à l'Admin / Gérant.");
  S.session={code:e.code,nom:e.nom,role:roleDe(e),postes:(e.postes||[e.poste]),rayons:(e.rayons||[e.rayon])}; save(); closeModal(); buildNav(); render(); updateUserBadge(); updatePtBadge();
}
function logout(){ S.session=null; save(); buildNav(); render(); updateUserBadge(); updatePtBadge(); loginScreen(); }
function updateUserBadge(){ const b=$("#userBadge"); if(b) b.innerHTML=S.session?`👤 <b>${esc(S.session.nom)}</b> <span class="badge b-info">${esc(S.session.role)}</span> <button class="btn btn-g btn-s" onclick="logout()">Sortir</button>`:`<button class="btn btn-p btn-s" onclick="loginScreen()">🔐 Connexion</button>`; }

/* ---------- Navigation ---------- */
const MODULES=[
 {id:"dashboard", t:"Tableau de bord", s:"Vue du jour, alertes, tâches", icon:"📊"},
 {id:"pos", t:"Caisse", s:"Vendre, encaisser, tickets", icon:"🛒"},
 {id:"catalogue", t:"Articles & prix", s:"Fiches, TVA, étiquettes", icon:"📦"},
 {id:"stocks", t:"Stocks & réception", s:"Réception BL/BC, transferts, inventaire", icon:"🍏"},
 {id:"achats", t:"Achats", s:"Fournisseurs, commandes, factures", icon:"🤝"},
 {id:"rh", t:"Personnel", s:"Agents, postes, codes, congés", icon:"👥"},
 {id:"compta", t:"Comptabilité", s:"Z de caisse, marges, exports", icon:"💶"},
 {id:"admin", t:"Paramétrage", s:"Rôles & droits, taxes, sauvegarde", icon:"⚙️"},
 {id:"fne", t:"FNE (DGI)", s:"Facture normalisée • FCFA", icon:"🇨🇮"},
 {id:"corbeille", t:"Corbeille", s:"Admin uniquement (anti-vol)", icon:"🗑"},
];
let current="dashboard";
function firstAllowed(){ const order=["pos","dashboard","stocks","catalogue","achats","compta","rh","fne","admin","corbeille"]; for(const m of order){ if(can(m)) return m; } return "pos"; }
/* BL non supprimé sous 24h → consolidation auto dans l'historique (statut Consolidé), seulement si la réserve du BL est vide */
function blReserveReste(b){ if(!b) return 0; if((S.lots||[]).length){ const ids=[b.id,b.bcId,b.blFournisseur].filter(Boolean); return (S.lots||[]).filter(l=>ids.includes(l.blId)).reduce((a,l)=>a+Number(l.qteReserve||0),0); } return ((b.lignes||[]).reduce((a,l)=>a+Number(l.qte||0),0)>0)?1:0; }
function consoliderBL(){
  const H=S.params.blAutoH||24; let n=0;
  (S.bls||[]).forEach(b=>{ if(b.statut==="Réserve"&&heuresDepuis(b.date+" "+(b.heure||"00:00"))>=H&&blReserveReste(b)<=0.0001){ b.statut="Consolidé"; n++; addMouvement("BL",b.lignes[0]?b.lignes[0].sku:"—",0,`BL ${b.id} consolidé auto après ${H}h (réserve vide, historique)`,b.id,LOC_RESERVE,"Historique"); } });
  if(n){ save(); }
  return n;
}
/* Rappel pointage : 15 min après l'ouverture si un agent n'a pas badgé */
function rappelPointage(){
  const h=S.params.heureOuverture||"08:00"; const [hh,mm]=h.split(":").map(Number);
  const now=new Date(); const open=new Date(); open.setHours(hh,mm||0,0,0);
  if(now-open<15*60000) return "";
  const missing=S.employes.filter(e=>e.statut==="Actif"&&!(S.pointages||[]).some(p=>p.code===e.code&&p.date===todayStr()));
  if(!missing.length) return "";
  return `<div class="alert a-red">⏱ <b>Rappel pointage (+15 min après ouverture ${h}) :</b> ${missing.slice(0,6).map(e=>esc(e.nom)).join(" • ")}${missing.length>6?" …":""} — badgez avec votre code !</div>`;
}
function buildNav(){
  /* Chaque agent ne voit que les opérations affiliées à son poste */
  const vis=MODULES.filter(m=>!S.session||can(m.id));
  if(S.session&&!can(current)) current=firstAllowed();
  $("#nav").innerHTML=vis.map(m=>`<button data-m="${m.id}" class="${m.id===current?"active":""}"><span class="i">${m.icon}</span><span><b>${m.t}</b><br><small style="opacity:.75">${m.s}</small></span></button>`).join("")+(S.session?`<div class="small" style="padding:8px 12px;opacity:.7">Connecté : <b>${esc(S.session.nom)}</b> (${esc(S.session.role)})<br>Droits définis par Admin/Gérant.</div>`:"");
  $$("#nav button").forEach(b=>b.onclick=()=>{ if(!S.session) return loginScreen(); if(!needRole(b.dataset.m)) return; current=b.dataset.m; buildNav(); render(); });
  const mn=document.getElementById("mnav"); if(mn){ mn.innerHTML=vis.map(m=>`<button data-m="${m.id}" class="${m.id===current?"active":""}">${m.icon}<br><span>${m.id}</span></button>`).join(""); const mbs=(mn.querySelectorAll&&mn.querySelectorAll("button"))||[]; [...mbs].forEach(b=>{b.onclick=()=>{ if(!S.session) return loginScreen(); const mm=b.dataset?b.dataset.m:b.getAttribute&&b.getAttribute("data-m"); if(!needRole(mm)) return; current=mm; buildNav(); render(); };}); }
}
function setTitle(){ const m=MODULES.find(x=>x.id===current); $("#modTitle").textContent=m.icon+"  "+m.t; $("#modSub").textContent=m.s+"  •  "+S.params.magasin; }
function render(){ try{updatePtBadge();}catch(e){} try{SYNC.setBadge();}catch(e){} licenceInfo(); if(licenceExpiree()){ setTitle(); $("#view").innerHTML=verrouLicenceHTML(); updateUserBadge(); try{window.scrollTo(0,0);}catch(e){} return; } if(!S.session){ setTitle(); $("#view").innerHTML=`<div class="card"><h3>🔐 Veuillez vous connecter</h3><p class="small">Saisissez votre code d'accès personnel pour tracer vos actions (caisse, stocks, inventaires).</p><button class="btn btn-p" onclick="loginScreen()">Se connecter</button></div>`; updateUserBadge(); return; } setTitle(); ({dashboard:renderDash,pos:renderPOS,catalogue:renderCat,stocks:renderStocks,achats:renderAchats,rh:renderRH,compta:renderCompta,admin:renderAdmin,corbeille:renderCorbeille,fne:renderFNE})[current](); updateUserBadge(); window.scrollTo(0,0); }
function go(m){ if(!needRole(m)) return; current=m; buildNav(); render(); }

/* ---------- Exports CSV (pour TCD Excel) ---------- */
function csvExport(nom, headers, rows){
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const txt="\uFEFF"+headers.map(q).join(";")+"\n"+rows.map(r=>r.map(q).join(";")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"})); a.download=nom; a.click();
}
function periodeFiltre(v, per){
  const t=todayStr();
  if(per==="jour") return v.date===t;
  const d=new Date(v.date), n=new Date(t);
  if(per==="semaine"){ const s=new Date(n); s.setDate(n.getDate()-7); return d>=s&&d<=n; }
  if(per==="mois") return v.date.slice(0,7)===t.slice(0,7);
  if(per==="annee") return v.date.slice(0,4)===t.slice(0,4);
  return true;
}
function exportVentes(per){
  const vs=S.ventes.filter(v=>v.statut!=="Annulé"&&periodeFiltre(v,per));
  const rows=[]; vs.forEach(v=>v.lignes.forEach(l=>rows.push([v.id,v.date,v.heure,v.caissier,l.sku,l.nom,l.qte,l.pu,l.total,l.code_tva||"",v.paiement,v.client||""])));
  csvExport(`ventes_${per}_${todayStr()}.csv`,["Ticket","Date","Heure","Caissier","SKU","Article","Qte","PU_TTC","Total_TTC","CodeTVA","Paiement","Client"],rows);
  alert(`⬇ Export ventes (${per}) : ${rows.length} lignes — ouvrez dans Excel → Insertion → Tableau croisé dynamique.`);
}
function exportProduits(){ csvExport(`produits_${todayStr()}.csv`,["SKU","EAN","Nom","Rayon","Famille","SousFamille","CodeTVA","Taux","Achat","VenteTTC","StockReserve","StockRayon","StockTotal","Min","Max","Fournisseur","DLC","Lot"],S.produits.map(p=>[p.sku,p.ean,p.nom,rayonNom(p.rayon),p.famille,p.sous,codeTvaOf(p),tauxOf(codeTvaOf(p)),p.achat,p.vente,p.stockReserve,p.stockRayon,p.stock,p.stockMin,p.stockMax,p.fournisseur,p.dlc,p.lot||""])); }
function exportMouvements(){ csvExport(`mouvements_${todayStr()}.csv`,["ID","Date","Heure","Type","SKU","Article","Qte","Motif","Ref","Agent","Source","Destination"],S.mouvements.map(m=>[m.id,m.date,m.heure,m.type,m.sku,m.nom,m.qte,m.motif,m.ref,m.agent,m.src||"",m.dst||""])); }
function exportStocks(){ csvExport(`stocks_${todayStr()}.csv`,["SKU","Article","Reserve","Rayon","Total","Min","ValeurAchat"],S.produits.map(p=>[p.sku,p.nom,p.stockReserve,p.stockRayon,p.stock,p.stockMin,(p.stock*p.achat)])); }
function exportLots(){ csvExport(`lots_${todayStr()}.csv`,["LotID","SKU","Article","Lot","DLC","Jours","Fournisseur","Reserve","Rayon","Total","PrixAchat","Valeur","BL"],(S.lots||[]).map(l=>{const p=S.produits.find(x=>x.sku===l.sku);return [l.id,l.sku,p?p.nom:l.sku,l.lot||"",l.dlc||"",dlcJours(l.dlc),l.fournisseur||"",l.qteReserve,l.qteRayon,(Number(l.qteReserve||0)+Number(l.qteRayon||0)),l.prixAchat,((Number(l.qteReserve||0)+Number(l.qteRayon||0))*Number(l.prixAchat||0)),l.blId||""];})); }

/* ---------- Impression : uniquement le document ---------- */
function printHTML(html){
  const z=$("#printZone"); z.innerHTML=html;
  document.body.classList.add("print-mode");
  window.print();
  setTimeout(()=>{document.body.classList.remove("print-mode");},400);
}
function ticketHTML(v){
  const recap=recapTaxes(v.lignes);
  const F=S.fiscal||{}, masqTVA=!!F.masquerDetailTvaSurTicket, sansTVA=!collecteTvaActive(), tse=totalTSE(v.lignes);
  const pied=F.piedDePageTicket||"Merci de votre visite ! 🛒";
  const enteteFiscal=`<br><span style="font-size:10px">${esc(F.raisonSociale||S.params.magasin)} • NCC ${esc(F.ncc||S.params.ncc||"—")}${F.rccm?` • RCCM ${esc(F.rccm)}`:""}<br>Régime : ${esc(F.regimeFiscal||regimeCode())} — ${collecteTvaActive()?"TVA collectée":"Ticket simple, TVA non applicable"}${F.adherentCga?" • Adhérent CGA":""}</span>`;
  return `<div class="ticket">
  <center><b>${esc(S.params.magasin)}</b><br>${esc(S.params.adresse)}<br>Tél ${esc(S.params.tel)}${enteteFiscal}<br>*** TICKET ${v.id} ***<br>${v.date} ${v.heure} — Caissier : ${esc(v.caissier)}${v.client?"<br>Client : "+esc(v.client)+(v.soldeAvant!=null?` (fidélité ${v.soldeAvant} → <b>${v.soldeApres}</b> pts${v.bonUtilise?` • bon -${fmtN(v.bonUtilise)}`:""}${v.ptsGagnes?` • +${v.ptsGagnes} pts`:""})`:""):""}</center><hr>
  ${v.lignes.map((l,i)=>`${String(i+1).padStart(3,"0")}  ${esc(l.nom)}<br>&nbsp;&nbsp;${l.qte} x ${fmtN(l.pu)} = <b>${fmtN(l.total)}</b>${sansTVA?"":`  (${l.code_tva||"A"})`}${l.promoDLC?`<br>&nbsp;&nbsp;🏷 Démarque DLC J-${l.palier} −${l.remisePct}% • Lot ${esc(l.lot||"—")} • DLC ${esc(l.dlc)}`:""}`).join("<br>")}
  ${sansTVA?`<hr><b>TOTAL À PAYER : ${fmtN(v.total)}</b> <span style="font-size:10px">(TVA non applicable — ${esc(F.regimeFiscal||regimeCode())})</span><br>`:masqTVA?`<hr><b>TOTAL NET À PAYER : ${fmtN(v.total)}</b> <span style="font-size:10px">(TVA incluse — détail masqué)</span><br>`:`<hr>--------------------------------------------------<br><b>RÉCAPITULATIF TAXES (F CFA)</b><br>
  <table style="width:100%;font-size:11px"><tr><th>Code</th><th>Taux</th><th>Base HT</th><th>TVA</th><th>TTC</th></tr>
  ${recap.map(r=>`<tr><td>${r.code}</td><td>${r.taux}%</td><td>${fmtN(r.ht)}</td><td>${fmtN(r.tva)}</td><td><b>${fmtN(r.ttc)}</b></td></tr>`).join("")}</table>
  --------------------------------------------------<br><b>TOTAL NET À PAYER : ${fmtN(v.total)}</b><br>`}
  ${tse?`<span style="font-size:10px">dont TSE ${(tauxTseActif()*100).toFixed(2)}% estimée : ${fmtN(Math.round(tse))}</span><br>`:""}
  Paiement : ${esc(v.paiement)}<br>Reçu : ${fmtN(v.recu!=null?v.recu:v.total)} — <b>Rendu : ${fmtN(v.rendu||0)}</b><br>
  <center>${esc(pied)}<br><span style="font-size:10px">${sansTVA?"Prix TTC — TVA non applicable (régime "+esc(F.regimeFiscal||regimeCode())+")":"Prix TTC — TVA calculée : HT = TTC/(1+taux)"}</span></center></div>`;
}

/* ================= DASHBOARD ================= */
function ventesJour(j=todayStr()){ return S.ventes.filter(v=>v.date===j&&v.statut!=="Annulé"); }
/* Alertes-priorités par opérateur : chacun voit ses urgences en haut du tableau de bord */
/* ---- Alertes → tâches à clôturer : affichées sur le poste dès la connexion, à traiter ---- */
function semaineDebut(){ const d=new Date(); const j=(d.getDay()+6)%7; d.setDate(d.getDate()-j); return d.toISOString().slice(0,10); }
function heuresDepuis(dt){ const t=new Date(String(dt).replace(" ","T")); if(isNaN(t)) return 0; return (Date.now()-t.getTime())/3600000; }
function isTaskDone(id){ return (S.tasksDone||[]).includes(id+"|"+todayStr()); }
function toggleTask(id){ S.tasksDone=S.tasksDone||[]; const k=id+"|"+todayStr(); if(S.tasksDone.includes(k)) S.tasksDone=S.tasksDone.filter(x=>x!==k); else S.tasksDone.push(k); save(); renderDash(); }
function buildTasks(){
  if((S.produits||[]).length===0&&(S.ventes||[]).length===0) return [{id:"INSTALL",poste:"Tous",crit:"haute",titre:"⚙️ Boutique à configurer",detail:"Magasin + régime fiscal + employés + articles.",action:"go('admin')"}];
  const T=[];
  const mk=(id,poste,crit,titre,detail,action)=>({id,poste,crit,titre,detail,action});
  const rupt=S.produits.filter(p=>p.stock<=0), bas=S.produits.filter(p=>p.stock>0&&p.stock<=p.stockMin);
  const appr=S.produits.filter(p=>p.stockRayon<=Math.max(1,(p.stockMin||10)/2)&&(p.stockReserve||0)>0);
  const cmd=S.produits.filter(p=>p.stock<=p.stockMin);
  const qm={}; (S.mouvements||[]).forEach(m=>{ if(m.type==="VENTE"&&m.date>=semaineDebut()) qm[m.sku]=(qm[m.sku]||0)+Math.abs(m.qte); });
  const dorm=S.produits.filter(p=>p.stock>2*(p.stockMin||10)&&!(qm[p.sku]>0));
  const blQ=(S.bls||[]).filter(b=>(b.statut==="Réserve"||b.statut==="Quai")&&blReserveReste(b)>0.0001);
  const oldQ=blQ.filter(b=>heuresDepuis(b.date+" "+(b.heure||"00:00"))>(S.params.quaiMaxH||4));
  const lit=(S.bcs||[]).filter(b=>b.statut==="Litige");
  const annul=S.ventes.filter(v=>v.statut==="Annulé"&&v.date===todayStr());
  const fact=(S.factures||[]).filter(f=>!f.payee);
  const holds=S.holds||[];
  const noPt=S.employes.filter(e=>e.statut==="Actif"&&!(S.pointages||[]).some(p=>p.code===e.code&&p.date===todayStr()));
  rupt.slice(0,8).forEach(p=>T.push(mk("R-"+p.sku,"Chef de rayon","critique","🔴 Rupture : "+p.nom,`Stock 0 — ventes perdues.`,`go('achats')`)));
  bas.slice(0,8).forEach(p=>T.push(mk("B-"+p.sku,"Chef de rayon","haute","🟠 Stock critique : "+p.nom,`Reste ${fmtQ(p.stock)} (Min ${p.stockMin}).`,`go('achats')`)));
  dorm.slice(0,6).forEach(p=>T.push(mk("D-"+p.sku,"Chef de rayon","moyenne","💤 Stock dormant : "+p.nom,`${fmtQ(p.stock)} en stock, 0 vente cette semaine.`,`go('stocks')`)));
  lit.forEach(b=>T.push(mk("L-"+b.id,"Chef de rayon","haute","⚠️ Écart réception "+b.id,`${esc(b.fournisseur)} — ${esc(b.litige||"litige")}.`,`go('achats')`)));
  appr.slice(0,6).forEach(p=>T.push(mk("A-"+p.sku,"Chef de rayon","haute","🗂️ Approvisionner : "+p.nom,`Rayon ${fmtQ(p.stockRayon)} bas, réserve ${fmtQ(p.stockRayon)} / R ${fmtQ(p.stockReserve)}.`,`go('stocks')`)));
  const seuilDLC=(S.promoDLC||{}).seuilJ||20;
  S.produits.filter(p=>{const j=dlcJours(p.dlc);return j>=0&&j<=20&&Math.max(0,(p.stockRayon||0)-dlcReserveSKU(p.sku))>0;}).slice(0,8).forEach(p=>{const j=dlcJours(p.dlc),stage=dlcStage(j);T.push(mk("P-"+p.sku,"Gérant","haute","🏷 DLC J-"+stage+" : "+p.nom,`DLC dans ${j} j — quantité en rayon à marquer au prix choisi par le gérant.`,`openDLCMark('${p.sku}')`));});
  oldQ.slice(0,6).forEach(b=>T.push(mk("Q-"+b.id,"Magasinier","haute","📦 BL "+b.id+" au quai depuis +"+(S.params.quaiMaxH||4)+"h",`${esc(b.fournisseur)} — à scanner/intégrer.`,`go('stocks')`)));
  blQ.filter(b=>!oldQ.includes(b)).slice(0,6).forEach(b=>T.push(mk("Q-"+b.id,"Magasinier","moyenne","📥 BL "+b.id+" à mettre en stock",`${esc(b.fournisseur)}.`,`go('stocks')`)));
  if(annul.length>=3) T.push(mk("C-ANNUL","Hôtesse","haute",annul.length+" annulations caisse aujourd'hui","Taux anormal — erreurs ou fraude possible.",`go('pos')`));
  else if(annul.length>0) T.push(mk("C-ANNUL","Hôtesse","moyenne",annul.length+" annulation(s) caisse","À surveiller.",`go('pos')`));
  if(!(S.zClotures||[]).some(z=>z.date===todayStr())) T.push(mk("C-Z","Comptable","haute","🧾 Z de caisse du jour manquant","À clôturer ce soir.",`go('compta')`));
  fact.slice(0,6).forEach(f=>T.push(mk("F-"+f.id,"Comptable","moyenne","💳 Facture "+f.id+" à payer",`${esc(f.fournisseur)} — ${fmtN(f.montant)}.`,`go('compta')`)));
  if(holds.length) T.push(mk("V-HOLD","Vendeur","moyenne",holds.length+" vente(s) en attente","À reprendre en caisse.",`go('pos')`));
  if(!S.caisse.ouverte) T.push(mk("V-OPEN","Vendeur","haute","🛒 Caisse fermée","Ouvrez la session (fond + caissier).",`go('pos')`));
  noPt.slice(0,8).forEach(e=>T.push(mk("PT-"+e.id,"Gérant","moyenne","⏱ "+e.nom+" non pointé","Rappel de pointage.",`go('rh')`)));
  if(!T.length) T.push(mk("OK","Tous","basse","✅ Rien d'urgent","Belle journée !","go('dashboard')"));
  return T;
}
function prioritesRole(rupt,bas,dlc,vj){
  const tasks=buildTasks();
  const m=me(); const postes=(m&&m.postes&&m.postes.length?m.postes:[(m&&m.poste)||(S.session?S.session.role:"")]);
  const role=S.session?S.session.role:"";
  const mine=tasks.filter(t=>postes.includes(t.poste)||t.poste==="Tous"||["Gérant","Admin","Administrateur"].includes(role));
  const open=mine.filter(t=>!isTaskDone(t.id));
  if(!mine.length) return `<div class="alert a-green">✅ Rien d'urgent — belle journée !</div>`;
  return `<div class="small">${open.length} tâche(s) à clôturer — cochez ✅ Traité ou 👁 vérification terrain.</div>`+open.slice(0,10).map(t=>`<div class="task-card"><b>[${t.crit.toUpperCase()}] ${esc(t.titre)}</b><br><span class="small">${t.detail} • Poste : ${t.poste}</span><br><button class="btn btn-p btn-s" onclick="toggleTask('${t.id}')">✅ Traité</button> <button class="btn btn-b btn-s" onclick="${t.action}">👁 Vérifier</button></div>`).join("");
}
function bandeauLicence(){ const L=licenceInfo(); if(L.type==="FULL") return `<div class="alert a-green">✅ Licence FULL — ${esc(L.client||"")} (clé ${esc(L.key||"")})</div>`; const j=licenceJoursRestants(); return `<div class="alert ${j<0?"a-red":"a-yel"}">⏳ Démo ASSOMi : <b>${j<0?0:j} jour(s) restant(s)</b> (expire ${esc(L.expireDate||"—")}) — après 72h : lecture seule, encaissement bloqué. <button class="btn btn-p btn-s" onclick="openModal(verrouLicenceHTML());">🔓 Activer</button></div>`; }
function renderDash(){
  const vj=ventesJour(), ca=vj.reduce((a,v)=>a+v.total,0), panier=vj.length?ca/vj.length:0;
  const rupt=S.produits.filter(p=>p.stock<=0), bas=S.produits.filter(p=>p.stock>0&&p.stock<=p.stockMin);
  const dlc=S.produits.filter(p=>dlcJours(p.dlc)<=S.params.seuilAlerteDLC);
  const lotsActifs=(S.lots||[]).filter(l=>((Number(l.qteReserve||0)+Number(l.qteRayon||0))>0));
  const dlcUrgents=lotsActifs.map(l=>({p:S.produits.find(x=>x.sku===l.sku)||{nom:l.sku,sku:l.sku,stockRayon:0},lot:l,j:dlcJours(l.dlc)})).filter(x=>x.j>=0&&x.j<=20).sort((a,b)=>a.j-b.j);
  const dlcPerimes=lotsActifs.map(l=>({p:S.produits.find(x=>x.sku===l.sku)||{nom:l.sku,sku:l.sku},lot:l,j:dlcJours(l.dlc)})).filter(x=>x.j<0);
  const agg={}; S.ventes.filter(v=>v.statut!=="Annulé").forEach(v=>v.lignes.forEach(l=>{agg[l.nom]=(agg[l.nom]||0)+l.qte;}));
  const top=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,10); const maxTop=top.length?top[0][1]:1;
  const labels=[],vals=[];
  for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const ds=d.toISOString().slice(0,10); labels.push(ds.slice(5)); vals.push(S.ventes.filter(v=>v.date===ds&&v.statut!=="Annulé").reduce((a,v)=>a+v.total,0)); }
  const perRay={}; S.ventes.filter(v=>v.statut!=="Annulé").forEach(v=>v.lignes.forEach(l=>{ if(l.offert||l.fid) return; const p=S.produits.find(x=>x.sku===l.sku); const r=p?rayonNom(p.rayon):(l.sku==="FID"?"💳 Fidélité (bons)":"⚙️ Autres / lignes spéciales"); perRay[r]=(perRay[r]||0)+l.total;}));
  const pr=Object.entries(perRay).sort((a,b)=>b[1]-a[1]); const maxR=pr.length?pr[0][1]:1;
  const perC={}; vj.forEach(v=>{perC[v.caissier]=(perC[v.caissier]||0)+v.total;});
  const payJ={}; vj.forEach(v=>payJ[v.paiement]=(payJ[v.paiement]||0)+v.total);
  const payJrows=Object.entries(payJ).map(([k,v])=>`<tr><td>${esc(k)}</td><td><b>${fmtN(v)}</b></td><td>${ca?Math.round(v/ca*100):0}%</td></tr>`).join("");
  const moisCA=S.ventes.filter(v=>v.statut!=="Annulé"&&v.date.slice(0,7)===todayStr().slice(0,7)).reduce((a,v)=>a+v.total,0);
  const anneeCA=S.ventes.filter(v=>v.statut!=="Annulé"&&v.date.slice(0,4)===todayStr().slice(0,4)).reduce((a,v)=>a+v.total,0);
  const coutJ=vj.reduce((a,v)=>a+v.lignes.reduce((x,l)=>{ if(l.offert||l.fid) return x; if(Number.isFinite(Number(l.cout))) return x+Number(l.cout); const p=S.produits.find(pp=>pp.sku===l.sku);return x+(p?p.achat*l.qte:0);},0),0);
  const lotsVal=valeurStockLots();
  const stockVal=lotsVal!=null?lotsVal:S.produits.reduce((a,p)=>a+p.stock*p.achat,0), resVal=S.produits.reduce((a,p)=>a+p.stockReserve*p.achat,0), rayVal=S.produits.reduce((a,p)=>a+p.stockRayon*p.achat,0);
  const demVal=S.demarques.reduce((a,d)=>a+(d.valeurAchat||0),0);
  const remiseDLC=(S.demarques||[]).filter(d=>d.famille==="DLC commerciale").reduce((a,d)=>a+(Number(d.qteVendue||0)*Math.max(0,Number(d.prixBase||0)-Number(d.prixDLC||0))),0);
  const qmW={}; (S.mouvements||[]).forEach(m=>{ if(m.type==="VENTE"&&m.date>=semaineDebut()) qmW[m.sku]=(qmW[m.sku]||0)+Math.abs(m.qte); });
  const dorms=S.produits.filter(p=>p.stock>2*(p.stockMin||10)&&!(qmW[p.sku]>0)).slice(0,5);
  const dormRows=dorms.length?dorms.map(p=>`<div class="small">💤 <b>${esc(p.nom)}</b> — ${fmtQ(p.stock)} en stock, 0 vente/sem.</div>`).join(""):"<span class='small'>Aucun dormant ✅</span>";
  const oldQ=(S.bls||[]).filter(b=>((b.statut==="Réserve"||b.statut==="Quai")&&blReserveReste(b)>0.0001)&&heuresDepuis(b.date+" "+(b.heure||"00:00"))>(S.params.quaiMaxH||4)).length;
  const litN=(S.bcs||[]).filter(b=>b.statut==="Litige").length, factN=(S.factures||[]).filter(f=>!f.payee).length;
  let othersTasks=""; try{ const all=buildTasks(); const m0=me(); const pp=(m0&&m0.postes&&m0.postes.length?m0.postes:[(m0&&m0.poste)||""]); othersTasks=all.filter(t=>!pp.includes(t.poste)&&t.poste!=="Tous"&&!["Gérant","Admin","Administrateur"].includes(S.session.role)).slice(0,14).map(t=>`<div class="alert ${t.crit==="critique"?"a-red":"a-yel"}"><b>[${t.poste}]</b> ${esc(t.titre)} — <span class="small">${t.detail}</span></div>`).join(""); }catch(e){}
  const prio=prioritesRole(rupt,bas,dlc,vj);
  let rap=""; try{ const nc=consoliderBL(); rap=rappelPointage(); if(nc) rap+=`<div class="alert a-yel">🧾 ${nc} BL de +${S.params.blAutoH||24}h consolidé(s) dans l'historique.</div>`; }catch(e){}
  const estVierge=(S.produits||[]).length===0&&(S.ventes||[]).length===0;
  const blocVierge=estVierge?`<div class="alert a-yel"><b>👋 Nouvelle boutique — installation en 10 min :</b> 1) Admin → 🏪 Magasin (nom, adresse, tél) 2) 🇨🇮 Régime fiscal (NCC, RCCM, MICRO/RME/RSI/RNI) 3) RH → créez vos employés et codes 4) Catalogue → créez vos articles 5) Stocks → réception avec lots + DLC. <button class="btn btn-p btn-s" onclick="go('admin')">⚙️ Commencer</button></div>`:"";
  $("#view").innerHTML=`
  ${bandeauLicence()}
  ${blocVierge}
  ${rap}
  <div class="card quickbar"><h3>⚡ Actions rapides</h3><div class="quick-grid">
    <button class="quick" onclick="go('pos')"><span>🛒</span>Vendre</button>
    <button class="quick" onclick="go('stocks');stockTab='flux';renderStocks()"><span>📥</span>Réceptionner</button>
    ${can('catalogue')?`<button class="quick" onclick="go('catalogue');setTimeout(()=>modalProduit(),80)"><span>📦</span>Nouvel article</button>`:""}
    ${can('achats')?`<button class="quick" onclick="go('achats')"><span>🧾</span>Commander</button>`:""}
    ${can('stocks')?`<button class="quick" onclick="go('stocks');stockTab='inv';renderStocks()"><span>📋</span>Inventaire</button>`:""}
    <button class="quick" onclick="modalPointage()"><span>⏱</span>Pointer</button>
  </div></div>
  <div class="card" style="margin-bottom:14px;border-left:6px solid #f59e0b"><h3>🔔 Mes priorités du jour — ${esc(S.session.nom)} (${esc(S.session.role)})</h3>${prio}</div>
  <div class="grid g4">
    <div class="kpi" style="--c:#16a34a"><div class="lbl">CA du jour (${todayStr()})</div><div class="val">${fmtN(ca)}</div><div class="hint">${vj.length} tickets • Panier ${fmtN(panier)}</div></div>
    <div class="kpi" style="--c:#2563eb"><div class="lbl">Passages en caisse</div><div class="val">${vj.length}</div><div class="hint">Tickets du jour</div></div>
    <div class="kpi" style="--c:#f59e0b"><div class="lbl">Panier moyen</div><div class="val">${fmtN(panier)}</div><div class="hint">Toutes caisses</div></div>
    <div class="kpi" style="--c:#dc2626"><div class="lbl">Alertes</div><div class="val">${rupt.length+bas.length+dlc.length}</div><div class="hint">${rupt.length} ruptures • ${bas.length} bas • ${dlc.length} DLC</div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>🚨 Alertes immédiates</h3>
      ${!vj.length?`<div class="alert a-yel">Aucune vente validée aujourd'hui : le CA du jour est à 0, aucun chiffre fictif n'est ajouté.</div>`:""}
      ${rupt.length?`<div class="alert a-red"><b>Ruptures (${rupt.length}) :</b> ${rupt.slice(0,5).map(p=>esc(p.nom)).join(" • ")}</div>`:`<div class="alert a-green">Aucune rupture ✅</div>`}
      ${bas.length?`<div class="alert a-yel"><b>Stocks bas :</b> ${bas.slice(0,5).map(p=>`${esc(p.nom)} (${p.stock})`).join(" • ")}</div>`:""}
      ${dlc.length?`<div class="alert a-yel"><b>DLC à surveiller (${dlc.length}) :</b> ${dlc.slice(0,5).map(p=>`${esc(p.nom)} [${esc(p.dlc)}]`).join(" • ")}</div>`:`<div class="alert a-green">RAS DLC au seuil configuré ✅</div>`}
      ${dlcUrgents.length?`<hr><b>🏷 Lots à examiner — paliers J-20 / J-10 / J-5 / J-1 (FEFO par lot)</b>${dlcUrgents.slice(0,8).map(({p,j,lot})=>{const stage=dlcStage(j),q=Number(lot.qteRayon||0);const r=Number(lot.qteReserve||0);return `<div class="alert ${j<=1?"a-red":"a-yel"}"><b>${esc(p.nom)}</b> • lot ${esc(lot.lot||"—")} • DLC ${esc(lot.dlc)} (J-${j}) • ${esc(lot.fournisseur||"")} • Rayon ${fmtQ(q)} / Réserve ${fmtQ(r)} @ ${fmtN(lot.prixAchat)} ${q>0&&isAdmin()?`<button class="btn btn-p btn-s" onclick="openDLCMark('${p.sku}')">🏷 Marquer J-${stage}</button>`:""}</div>`;}).join("")}`:""}
      ${dlcPerimes.length?`<div class="alert a-red"><b>Lots au-delà de leur DLC (${dlcPerimes.length}) :</b> ${dlcPerimes.slice(0,5).map(x=>`${esc(x.p.nom)} lot ${esc(x.lot.lot||"—")} (${Math.abs(x.j)} j dépassé)`).join(" • ")} — vérifier et retirer du rayon.</div>`:""}
      <div class="toolbar no-print"><button class="btn btn-p btn-s" onclick="go('stocks')">Stocks</button><button class="btn btn-g btn-s" onclick="go('achats')">Commander</button></div></div>
    <div class="card"><h3>📈 CA — 14 derniers jours</h3><canvas id="chCA" height="150"></canvas>
      <div class="small">Total 14j : <b>${fmtN(vals.reduce((a,b)=>a+b,0))}</b></div>
      <div class="toolbar"><button class="btn btn-g btn-s" onclick="modalExport('ventes')">⬇ Export ventes : choisir dates (TCD)</button><button class="btn btn-g btn-s" onclick="exportVentes('jour')">Jour</button><button class="btn btn-g btn-s" onclick="exportVentes('mois')">Mois</button></div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>🏆 Top 10 articles</h3>${top.map(([n,q])=>`<div style="margin:7px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(n)}</b><span>${q}</span></div><div class="bar"><i style="width:${Math.round(q/maxTop*100)}%"></i></div></div>`).join("")}</div>
    <div class="card"><h3>🗂️ Performance rayons</h3>${pr.map(([n,v])=>`<div style="margin:7px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(n)}</b><span>${fmtN(v)}</span></div><div class="bar"><i style="width:${Math.round(v/maxR*100)}%"></i></div></div>`).join("")}
    <hr><h3>🧑‍💼 Caissiers (jour)</h3><table><tr><th>Caissier</th><th>Tickets</th><th>CA</th></tr>${Object.entries(perC).map(([n,v])=>`<tr><td>${esc(n)}</td><td>${vj.filter(x=>x.caissier===n).length}</td><td><b>${fmtN(v)}</b></td></tr>`).join("")||"<tr><td colspan=3>—</td></tr>"}</table></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>💳 Encaissements du jour (par mode)</h3><table><tr><th>Mode</th><th>Montant</th><th>%</th></tr>${payJrows||"<tr><td colspan=3>—</td></tr>"}</table><div class="small">Mois : <b>${fmtN(moisCA)}</b> • Année : <b>${fmtN(anneeCA)}</b> • Marge brute jour (au lot FEFO) : <b>${fmtN(ca-coutJ)}</b></div></div>
    <div class="card"><h3>📦 Stocks : valeur & dormants</h3><div class="small">Valeur stock (achat au lot) : <b>${fmtN(stockVal)}</b>${lotsVal!=null?" • calculée sur les lots (prix fournisseurs réels)":""} • Réserve ${fmtN(resVal)} • Rayons ${fmtN(rayVal)}</div>${dormRows}<hr><div class="small">Pertes connues/inconnues (achat) : <b>${fmtN(demVal)}</b> • Remises DLC réalisées : <b>${fmtN(remiseDLC)}</b> • BL en réserve non transférés : <b>${oldQ}</b> • Litiges : <b>${litN}</b> • Factures à payer : <b>${factN}</b></div><div class="small">💡 Un BL reste en « Réserve » après réception : c'est normal, le stock est en réserve. Transférez vers le rayon (bouton 🔀 ou Assistant FEFO). Après ${S.params.blAutoH||24}h il passe en « Consolidé » (historique).</div></div>
  </div>`;
  drawLine("chCA",labels,vals);
}
function drawLine(id,labels,vals){ const c=document.getElementById(id); if(!c) return; const ctx=c.getContext("2d"); const W=c.width=c.offsetWidth*2,H=c.height=300; ctx.clearRect(0,0,W,H); const max=Math.max(...vals,1),st=W/(vals.length-1||1); ctx.strokeStyle="#e2e8f0"; for(let g=0;g<4;g++){const y=20+g*(H-50)/3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();} ctx.beginPath(); vals.forEach((v,i)=>{const x=i*st,y=H-30-(v/max)*(H-60); i?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.strokeStyle="#16a34a"; ctx.lineWidth=5; ctx.stroke(); ctx.fillStyle="#16a34a"; vals.forEach((v,i)=>{const x=i*st,y=H-30-(v/max)*(H-60);ctx.beginPath();ctx.arc(x,y,7,0,7);ctx.fill();}); ctx.fillStyle="#64748b"; ctx.font="20px sans-serif"; labels.forEach((l,i)=>{if(i%2===0)ctx.fillText(l,i*st-10,H-5);}); }

/* ================= POS ================= */
let cart=[];
function renderPOS(){
  const c=S.caisse;
  $("#view").innerHTML=`
  <div class="card" style="margin-bottom:14px"><h3>💰 Session de caisse — Agent : <b>${esc(agent())}</b> • Fond : <b>${fmtN(c.fond)}</b> • ${c.ouverte?'<span class="badge b-ok">OUVERTE</span>':'<span class="badge b-bad">FERMÉE</span>'} ${c.ouverte?`<span class="small">depuis ${esc(c.ouverteLe)} par ${esc(c.caissier)}</span>`:""}</h3>
    <div class="toolbar no-print">
      ${c.ouverte?`<button class="btn btn-d btn-s" onclick="fermerCaisse()">🔒 Fermer + Z</button><button class="btn btn-o btn-s" onclick="ticketFinCaisse()">🧾 Mon ticket de fin de caisse (Z caissier)</button>`:`<label style="display:inline">Fond (F) <input id="fondIn" type="number" value="50000" style="width:130px;display:inline"></label><button class="btn btn-p btn-s" onclick="ouvrirCaisse()">🔓 Ouvrir la caisse (${esc(agent())})</button>`}
      <button class="btn btn-g btn-s" onclick="voirTickets()">🧾 Historique tickets (clic = détail + suppression motif)</button>
    </div></div>
  <div class="toolbar no-print"><button class="btn ${window._tact?"btn-p":"btn-g"} btn-s" onclick="toggleTact()">${window._tact?"🖥 Mode classique":"📱 Mode caisse tactile"}</button>${window._tact?"<span class='badge b-ok'>TACTILE : grosses touches</span>":""}</div>
  <div class="pos-layout">
    <div class="card"><h3>🔎 Articles — ${window._tact?"TOUCHEZ un produit":"cliquer pour ajouter"} (prix TTC, lettre TVA)</h3>
      <div class="toolbar"><input id="posSearch" placeholder="Nom, SKU, EAN…" oninput="renderPOSTiles()"><select id="posRayon" onchange="renderPOSTiles()"><option value="">Tous rayons</option>${REFERENTIEL.map(r=>`<option value="${r.code}">${r.icone} ${esc(r.nom)}</option>`).join("")}</select><button class="btn btn-b btn-s" onclick="scanCode('pos')" title="Scanner avec le smartphone">📷 Scanner</button></div>
      <div class="prod-grid" id="posGrid"></div></div>
    <div class="card"><h3>🧺 Panier en cours</h3>
      <label>Client fidélité (points → réduction au seuil gérant : ${S.fidelite.seuilPts} pts = ${fmtN(S.fidelite.valeurBon)})</label><div style="display:flex;gap:6px"><select id="posClient" style="flex:1" onchange="renderCart()"><option value="">— Comptant —</option>${S.clients.map(cl=>`<option value="${cl.id}">${esc(cl.nom)} (${cl.points} pts)</option>`).join("")}</select><button class="btn btn-g btn-s" onclick="modalClient()">+ Client</button></div><div id="fidBox"></div>
      <div id="cartBox" style="margin-top:8px"></div><hr><div id="cartTot"></div>
      <label>Mode de paiement</label><select id="posPay">${S.params.paiements.map(p=>`<option>${p}</option>`).join("")}</select>
      <label>Montant reçu (F) <button class="btn btn-g btn-s" onclick="padShow('posRecu')">🔢 Pavé tactile</button></label><div style="display:flex;gap:6px"><input id="posRecu" type="number" placeholder="Ex : 10000" oninput="liveRendu()" style="flex:1"></div>
      ${window._tact?`<div class="pad-grid" style="margin-top:8px">${["1000","2000","5000","10000","20000"].map(m=>`<button class="pad-k" onclick="tactMoney(${m})">${m}</button>`).join("")}<button class="pad-k" onclick="tactExact()">Appoint</button></div><div class="pad-grid">${["1","2","3","4","5","6","7","8","9","C","0","⌫"].map(k=>`<button class="pad-k" onclick="tactNum('${k}')">${k}</button>`).join("")}</div>`:""}
      <div id="renduLive" class="rendu-big">Rendu : —</div>
      <div class="toolbar"><button class="btn btn-p" onclick="encaisser()">✅ Encaisser (F9)</button><button class="btn btn-o" onclick="holdSale()">⏸ Vente en attente</button><button class="btn btn-g" onclick="viderPanier()">🗑 Vider</button></div>
      <div class="card" style="margin-top:8px"><h3>⏸ Ventes en attente (${S.holds.length})</h3><div id="holdsBox"></div></div>
      <div id="ticketBox"></div>
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h3>🎁 Promos actives (appliquées auto)</h3>
    <table><tr><th>Offre</th><th>Cible</th><th></th></tr>${S.promos.map(p=>`<tr><td><b>${esc(p.nom)}</b></td><td>${esc(p.cible||"—")}</td><td>${p.actif?'<span class="badge b-ok">Active</span>':'<span class="badge b-grey">Off</span>'} <button class="btn btn-g btn-s" onclick="togglePromo('${p.id}')">On/Off</button> ${isAdmin()?`<button class="btn btn-g btn-s" onclick="modalPromoEdit('${p.id}')">✏️ Rectifier</button><button class="btn btn-d btn-s" onclick="delPromo('${p.id}')">🗑</button>`:""}</td></tr>`).join("")}</table>
    <div class="small">🎫 Promotions générales : appliquées selon leur configuration. Les démarques DLC sont limitées au lot et à la quantité marqués par le Gérant; le prix normal des autres unités reste inchangé.</div>
    <div class="small">Fidélité : 1 pt / 1 000 F • 100 pts = bon 1 000 F.</div></div>`;
  renderPOSTiles(); renderCart(); renderHolds();
  { const m=me(); const today=(S.pointages||[]).filter(p=>m&&p.code===m.code&&p.date===todayStr());
    const dv=document.createElement('div'); dv.className='card'; dv.style.marginTop='14px';
    dv.innerHTML=`<h3>⏱ Mon pointage — ${esc(agent())} (code ${m?esc(m.code):"—"})</h3><div class="small">Le pointage sort sur la page de chaque agent dès qu'il met son code d'accès. Multi-supports : PC, tablette, smartphone (mêmes données synchronisées).</div><div class="toolbar"><button class="btn btn-p" onclick="quickPoint('debut')">▶ Début de service</button><button class="btn btn-d" onclick="quickPoint('fin')">⏹ Fin de service</button></div>${today.map(p=>`<div class="small">${p.date} : ${p.debut||"—"} → ${p.fin||"<b>en service</b>"} ${p.duree?"(<b>"+p.duree+"</b>)":""}</div>`).join("")||"<span class='small'>Pas encore pointé aujourd'hui.</span>"}`; $("#view").appendChild(dv); }
}
function quickPoint(sens){ const me=S.employes.find(e=>e.nom===agent()); if(!me) return alert('Agent inconnu.'); if(sens==='debut'){ if(S.pointages.find(p=>p.code===me.code&&p.date===todayStr()&&!p.fin)) return alert('Service déjà ouvert.'); S.pointages.unshift({id:uid('PT'),code:me.code,nom:me.nom,date:todayStr(),debut:nowHM(),fin:'',duree:''}); } else { const o=S.pointages.find(p=>p.code===me.code&&!p.fin); if(!o) return alert('Aucun service ouvert.'); o.fin=nowHM(); const[a,b]=o.debut.split(':').map(Number),[c,d]=o.fin.split(':').map(Number); let m=(c*60+d)-(a*60+b); if(m<0)m+=1440; o.duree=Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'); } save(); alert(sens==='debut'?'▶ Début pointé '+nowHM():'⏹ Fin pointée '+nowHM()); }
function posFiltres(){ const q=($("#posSearch")?.value||"").toLowerCase(), r=$("#posRayon")?.value||""; return S.produits.filter(p=>(!r||p.rayon===r)&&(!q||(p.nom+p.sku+p.ean).toLowerCase().includes(q))); }
/* Promos : AUCUNE promo auto. Après alerte DLC, seul le gérant tamponne la promo (manuellement). */
function dlcPromo(p){ return null; }
function dlcAlerte(p){ const r=S.promoDLC||{seuilJ:20,remise:30,actif:false}; const j=dlcJours(p.dlc); if(j<=r.seuilJ) return {remise:r.remise,jours:j,seuil:r.seuilJ}; return null; }
function promoPrix(p){ const dp=dlcPromo(p); if(dp) return {prix:Math.round(p.vente*(1-dp.remise/100)),badge:`<span class="badge b-ok" title="DLC J-${dp.jours} : promo gérant -${dp.remise}%">PROMO DLC -${dp.remise}%</span>`}; const pr=S.promos.find(x=>x.actif&&x.cible===p.ean); if(!pr) return {prix:p.vente,badge:""}; if(pr.type==="%") return {prix:Math.round(p.vente*(1-pr.valeur/100)),badge:`<span class="badge b-ok">-${pr.valeur}%</span>`}; if(pr.type==="1+1") return {prix:p.vente,badge:`<span class="badge b-info">1+1</span>`}; return {prix:p.vente,badge:""}; }
function qteCartSKU(sku){ return cart.filter(l=>l.sku===sku).reduce((a,l)=>a+Number(l.qte||0),0)+(S.holds||[]).flatMap(h=>h.cart||[]).filter(l=>l.sku===sku).reduce((a,l)=>a+Number(l.qte||0),0); }
function qteCartMark(id){ return cart.filter(l=>l.markdownId===id).reduce((a,l)=>a+Number(l.qte||0),0)+(S.holds||[]).flatMap(h=>h.cart||[]).filter(l=>l.markdownId===id).reduce((a,l)=>a+Number(l.qte||0),0); }
function renderPOSTiles(){ const g=$("#posGrid"); if(!g) return; g.innerHTML=posFiltres().slice(0,120).map(p=>{const pr=promoPrix(p),hp=hasPromo(p),marks=dlcMarksSKU(p.sku); const markBtns=marks.map(m=>{const j=dlcJours(m.dlc),left=Math.max(0,Number(m.qteRestante)-qteCartMark(m.id));return j<0?`<button class="btn btn-d btn-s" disabled>⛔ Lot DLC dépassé — retrait requis (${fmtQ(m.qteRestante)})</button>`:`<button class="btn btn-o btn-s" ${left<=0?"disabled":""} onclick="event.stopPropagation();addCartDLC('${m.id}')">🏷 DLC J-${m.palier} −${m.remisePct}% • ${fmtQ(left)} dispo • ${fmtN(m.prixDLC)}</button>`;}).join("");return `<div class="prod-tile" onclick="addCart('${p.sku}')">${hp?`<div class="promo-stamp">🎫 PROMO</div>`:""}<b>${esc(p.nom)}</b><div class="small">${p.sku} • Rayon: ${fmtQ(p.stockRayon)} <span class="badge b-grey">${codeTvaOf(p)}</span></div><div class="p">Prix normal ${fmtN(pr.prix)} TTC ${pr.badge}</div>${markBtns?`<div style="display:grid;gap:4px;margin-top:6px">${markBtns}</div>`:""}<div class="small">EAN ${esc(p.ean)}${isAdmin()?` <button class="btn btn-o btn-s" onclick="event.stopPropagation();stampPromo('${p.sku}')" title="Promo générale">🎫</button>`:""}</div></div>`;}).join("")||"<span class='small'>Aucun article.</span>"; }
function addCart(sku){ if(!S.caisse.ouverte) return alert("⚠️ Ouvrez d'abord la caisse."); const p=S.produits.find(x=>x.sku===sku); if(!p) return; const heldRegular=(S.holds||[]).flatMap(h=>h.cart||[]).filter(x=>x.sku===sku&&!x.markdownId).reduce((a,x)=>a+x.qte,0),regularAvailable=Math.max(0,Number(p.stockRayon||0)-dlcReserveSKU(sku)), currentRegular=cart.filter(x=>x.sku===sku&&!x.markdownId).reduce((a,x)=>a+x.qte,0)+heldRegular; if(currentRegular+1>regularAvailable||qteCartSKU(sku)+1>Number(p.stockRayon||0)) return alert(`Stock au prix normal insuffisant pour ${p.nom}. ${fmtQ(regularAvailable-currentRegular)} unité(s) disponible(s) hors quantité déjà réservée en démarque DLC.`); const l=cart.find(x=>x.sku===sku&&!x.markdownId); if(l) l.qte++; else cart.push({sku,nom:p.nom,qte:1,pu:promoPrix(p).prix,code_tva:codeTvaOf(p)}); renderCart(); }
function addCartDLC(id){ if(!S.caisse.ouverte) return alert("⚠️ Ouvrez d'abord la caisse."); const m=(S.dlcMarks||[]).find(x=>x.id===id&&x.statut==="Active"&&Number(x.qteRestante)>0); if(!m) return alert("Démarque DLC épuisée ou inactive."); const j=dlcJours(m.dlc); if(j<0) return alert("⛔ DLC dépassée : vente bloquée."); const p=S.produits.find(x=>x.sku===m.sku); if(!p) return alert("Article introuvable."); if(qteCartMark(id)+1>Number(m.qteRestante)) return alert("La quantité marquée restante ne suffit pas."); if(qteCartSKU(m.sku)+1>Number(p.stockRayon||0)) return alert("Stock rayon insuffisant."); const l=cart.find(x=>x.markdownId===id); if(l) l.qte++; else cart.push({sku:m.sku,nom:p.nom,qte:1,pu:Number(m.prixDLC),code_tva:codeTvaOf(p),markdownId:m.id,promoDLC:true,remisePct:m.remisePct,lot:m.lot,dlc:m.dlc,palier:m.palier}); renderCart(); }
function chQte(i,d){ const l=cart[i],p=S.produits.find(x=>x.sku===l.sku); if(!p) return; const nq=l.qte+d; if(nq<=0) return rmLigne(i); if(qteCartSKU(l.sku)-l.qte+nq>Number(p.stockRayon||0)) return alert("Stock rayon insuffisant."); if(l.markdownId){const m=(S.dlcMarks||[]).find(x=>x.id===l.markdownId&&x.statut==="Active");if(!m||nq>Number(m.qteRestante)) return alert("Quantité supérieure au solde de ce lot démarqué."); if(dlcJours(m.dlc)<0) return alert("DLC dépassée : vente bloquée.");}else{const avail=Math.max(0,Number(p.stockRayon||0)-dlcReserveSKU(l.sku)),heldRegular=(S.holds||[]).flatMap(h=>h.cart||[]).filter(x=>x.sku===l.sku&&!x.markdownId).reduce((a,x)=>a+x.qte,0),other=cart.filter(x=>x.sku===l.sku&&!x.markdownId&&x!==l).reduce((a,x)=>a+x.qte,0)+heldRegular;if(other+nq>avail)return alert("Stock au prix normal insuffisant : une partie est réservée aux unités démarquées DLC.");} l.qte=nq; renderCart(); }
function rmLigne(i){ cart.splice(i,1); renderCart(); }
function viderPanier(){ cart=[]; renderCart(); const t=$("#ticketBox"); if(t) t.innerHTML=""; }
function cartTotal(){ return cart.reduce((a,l)=>a+l.qte*l.pu,0); }
function fideliteRemise(){ const cid=$("#posClient")?.value; if(!cid||!S.fidelite.remiseAuto) return {remise:0,pts:0}; const cl=S.clients.find(c=>c.id===cid); if(!cl||cl.points<S.fidelite.seuilPts) return {remise:0,pts:0}; const n=Math.floor(cl.points/S.fidelite.seuilPts); const rem=Math.min(n*S.fidelite.valeurBon, cartTotal()); return {remise:rem, pts:n*S.fidelite.seuilPts, bons:n}; }
function renderCart(){
  const box=$("#cartBox"); if(!box) return;
  box.innerHTML=cart.map((l,i)=>`<div class="cart-line"><span><b>${esc(l.nom)}</b> <span class="badge b-grey">${l.code_tva}</span><br><span class="small">${fmtN(l.pu)} TTC /u ${l.promoDLC?`• 🏷 DLC J-${l.palier} −${l.remisePct}% • lot ${esc(l.lot||"—")} • ${esc(l.dlc)}`:""}</span></span><span class="qty"><button onclick="chQte(${i},-1)">−</button><b>${l.qte}</b><button onclick="chQte(${i},1)">+</button><button class="btn btn-g btn-s" title="Retrait : gérant ou hôtesse (code)" onclick="rmLigneAuth(${i})">✕ 🔒</button></span></span></div>`).join("")||"<span class='small'>Panier vide.</span>";
  const fid=fideliteRemise();
  $("#cartTot").innerHTML=`<div style="display:flex;justify-content:space-between;font-size:13px"><span>Sous-total TTC</span><span>${fmtN(cartTotal())}</span></div>${fid.remise?`<div style="display:flex;justify-content:space-between;font-size:13px;color:#15803d"><span>🎁 Bon fidélité (${fid.pts} pts)</span><span>−${fmtN(fid.remise)}</span></div>`:""}<div style="display:flex;justify-content:space-between;font-size:16px"><b>Total TTC</b><b style="color:var(--primary-d)">${fmtN(cartTotal()-fid.remise)}</b></div><div class="small">Articles : ${cart.reduce((a,l)=>a+l.qte,0)} • TVA incluse</div>`;
  const fb=$("#fidBox"); if(fb){ const cid=$("#posClient")?.value; const cl=S.clients.find(c=>c.id===cid); fb.innerHTML=cl?`<div class="small">💳 ${esc(cl.nom)} : solde <b>${cl.points} pts</b> ${cl.points>=S.fidelite.seuilPts?`• <span class="badge b-ok">Bon ${fmtN(S.fidelite.valeurBon)} applicable auto</span>`:`• Plus que ${S.fidelite.seuilPts-cl.points} pts avant bon ${fmtN(S.fidelite.valeurBon)}`} (1 pt / ${fmtN(S.fidelite.ptParF)})<br><span class="small">Après encaissement, le solde se met à jour auto (avant → après sur le ticket).</span></div>`:""; }
  liveRendu();
}
function liveRendu(){ const el=$("#renduLive"); if(!el) return; const tot=cartTotal()-(typeof fideliteRemise==="function"?fideliteRemise().remise:0); const recu=+($("#posRecu")?.value||0); if(!recu){el.textContent="Rendu : — (saisissez le montant reçu)";el.className="rendu-big";return;} const r=recu-tot; el.innerHTML=`Reçu ${fmtN(recu)} − Total ${fmtN(tot)} = <b>Rendu : ${fmtN(r)}</b>`; el.className="rendu-big "+(r<0?"neg":"ok"); }
function ouvrirCaisse(){ S.caisse.ouverte=true; S.caisse.fond=+($("#fondIn").value||0); S.caisse.caissier=agent(); S.caisse.ouverteLe=todayStr()+" "+nowHM(); save(); renderPOS(); }
function fermerCaisse(){
  const vj=S.ventes.filter(v=>v.date===todayStr()&&v.caissier===S.caisse.caissier&&v.statut!=="Annulé");
  const total=vj.reduce((a,v)=>a+v.total,0); const parPay={}; vj.forEach(v=>parPay[v.paiement]=(parPay[v.paiement]||0)+v.total);
  const recap=recapTaxes(vj.flatMap(v=>v.lignes));
  const z={id:"Z"+(S.zClotures.length+1).toString().padStart(4,"0"), date:todayStr(), heure:nowHM(), caissier:S.caisse.caissier, fond:S.caisse.fond, tickets:vj.length, total, detail:parPay, taxes:recap};
  S.zClotures.unshift(z); S.caisse.ouverte=false; save();
  printHTML(`<div class="ticket"><center><b>${esc(S.params.magasin)}</b><br>*** Z DE CAISSE ${z.id} ***<br>${z.date} ${z.heure}<br>Caissier : ${esc(z.caissier)}</center><hr>Fond : ${fmtN(z.fond)}<br>Tickets : ${z.tickets}<br>TOTAL : <b>${fmtN(z.total)}</b><br>${Object.entries(parPay).map(([k,v])=>`${esc(k)} : ${fmtN(v)}`).join("<br>")}<hr><b>VENTILATION TVA</b><br>${recap.map(r=>`${r.code} ${r.taux}% — HT ${fmtN(r.ht)} — TVA ${fmtN(r.tva)} — TTC ${fmtN(r.ttc)}`).join("<br>")}<center>Signature : __________</center></div>`);
  current="compta"; buildNav(); render();
}
function ticketFinCaisse(){
  const name=S.caisse.caissier||agent();
  const vj=S.ventes.filter(v=>v.date===todayStr()&&v.caissier===name&&v.statut!=="Annulé");
  if(!vj.length) return alert("Aucune vente pour "+name+" aujourd'hui.");
  const total=vj.reduce((a,v)=>a+v.total,0); const parPay={}; vj.forEach(v=>parPay[v.paiement]=(parPay[v.paiement]||0)+v.total);
  const recap=recapTaxes(vj.flatMap(v=>v.lignes));
  printHTML(`<div class="ticket"><center><b>${esc(S.params.magasin)}</b><br>*** TICKET FIN DE CAISSE (individuel) ***<br>${todayStr()} ${nowHM()}<br>Caissier : <b>${esc(name)}</b></center><hr>
  ${vj.map(v=>`${v.id} ${v.heure} — ${fmtN(v.total)} (${esc(v.paiement)})`).join("<br>")}<hr>
  Tickets : <b>${vj.length}</b> • TOTAL : <b>${fmtN(total)}</b><br>${Object.entries(parPay).map(([k,v])=>`${esc(k)} : ${fmtN(v)}`).join("<br>")}<hr>
  <b>TVA :</b><br>${recap.map(r=>`${r.code} ${r.taux}% HT ${fmtN(r.ht)} TVA ${fmtN(r.tva)} TTC ${fmtN(r.ttc)}`).join("<br>")}<center>Signature caissier : ______</center></div>`);
}
function encaisser(){
  if(licenceExpiree()){ render(); return alert("🔒 Démo expirée : encaissement bloqué. Activez la licence FULL."); }
  if(!S.caisse.ouverte) return alert("Ouvrez la caisse d'abord.");
  if(!cart.length) return alert("Panier vide.");
  const pay=$("#posPay").value, recu=+($("#posRecu").value||0);
  let lignes=cart.map(l=>({...l,total:l.qte*l.pu}));
  S.promos.filter(p=>p.actif&&p.type==="1+1").forEach(pr=>{ const prod=S.produits.find(x=>x.ean===pr.cible); if(!prod) return; const l=lignes.find(x=>x.sku===prod.sku); if(l) lignes.push({sku:prod.sku,nom:prod.nom+" (OFFERT 1+1)",qte:l.qte,pu:0,total:0,code_tva:codeTvaOf(prod),offert:true}); });
  let total=lignes.reduce((a,l)=>a+l.total,0);
  const fid=fideliteRemise();
  if(fid.remise>0){ lignes.push({sku:"FID",nom:`Bon fidélité −${fmtN(fid.remise)} (${fid.bons} bon(s))`,qte:1,pu:-fid.remise,total:-fid.remise,code_tva:"E",fid:true}); total-=fid.remise; }
  if(pay==="Espèces"&&recu&&recu<total) return alert("Montant reçu insuffisant.");
  const dec={},markdownDec={};
  for(const l of lignes){ if(l.offert||l.fid) continue; const p=S.produits.find(x=>x.sku===l.sku); if(!p) return alert("Article introuvable : "+l.sku); dec[l.sku]=(dec[l.sku]||0)+Number(l.qte||0);
    if(l.markdownId){ const m=(S.dlcMarks||[]).find(x=>x.id===l.markdownId&&x.statut==="Active"); if(!m||m.sku!==l.sku||Number(m.prixDLC)!==Number(l.pu)) return alert("La démarque DLC a changé ou n'est plus active : actualisez la caisse."); if(dlcJours(m.dlc)<0) return alert("DLC dépassée : vente bloquée."); markdownDec[m.id]=(markdownDec[m.id]||0)+Number(l.qte||0); if(markdownDec[m.id]>Number(m.qteRestante)) return alert("Quantité supérieure au solde du lot démarqué."); }
  }
  for(const [sku,q] of Object.entries(dec)){const p=S.produits.find(x=>x.sku===sku);if(!p||(Number(p.stockRayon)||0)<q)return alert("Stock RAYON insuffisant : "+(p?p.nom:sku)+" — disponible "+fmtQ(p?p.stockRayon:0)+" (v"+(typeof SYNC!=="undefined"?SYNC.ver:"?")+").");const lotsR=(S.lots||[]).filter(l=>l.sku===sku).reduce((a,l)=>a+Number(l.qteRayon||0),0);if((S.lots||[]).some(l=>l.sku===sku)&&lotsR<q)return alert("Stock lots rayon insuffisant pour "+p.nom+" : "+fmtQ(lotsR)+" (FEFO par DLC). Transférez depuis la réserve.");}
  /* Coût au lot (FEFO) pour la marge : chaque ligne garde son coût d'achat réel. */
  const previewCost=(sku,q,lotId)=>{ let r=Number(q||0),c=0; const pool=(S.lots||[]).filter(l=>l.sku===sku&&Number(l.qteRayon)>0).sort((a,b)=>(lotId&&a.id===lotId?-1:0)-(lotId&&b.id===lotId?-1:0)||dlcJours(a.dlc)-dlcJours(b.dlc)); for(const l of pool){ if(r<=0) break; const m=Math.min(r,Number(l.qteRayon)); c+=m*Number(l.prixAchat||0); r-=m; } if(r>0){ const p=S.produits.find(x=>x.sku===sku); c+=r*Number(p?p.achat||0:0); } return Math.round(c); };
  lignes.forEach(l=>{ if(l.offert||l.fid) return; const m=l.markdownId?(S.dlcMarks||[]).find(x=>x.id===l.markdownId):null; l.cout=previewCost(l.sku,l.qte,m&&m.lotId?m.lotId:""); });
  const id="T"+String(S.seq.ticket++).padStart(5,"0");
  const vente={id, date:todayStr(), heure:nowHM(), caissier:S.caisse.caissier||agent(), lignes, total, paiement:pay, recu:recu||total, rendu:Math.max(0,(recu||total)-total), statut:"Validé", motif:""};
  const cid=$("#posClient").value;
  let ptsInfo=null;
  if(cid){ const cl=S.clients.find(c=>c.id===cid); const avant=cl.points; if(fid.remise>0) cl.points-=fid.pts; const pts=Math.floor(total/(S.fidelite.ptParF||1000)); cl.points=Math.max(0,cl.points)+pts; cl.achats++; vente.client=cl.nom; vente.ptsGagnes=pts; vente.bonUtilise=fid.remise||0; vente.soldeAvant=avant; vente.soldeApres=cl.points; ptsInfo={clientId:cid,used:fid.pts||0,earned:pts}; }
  /* Mode multi-postes : vente ATOMIQUE serveur (données exactes sur tous les postes) */
  if(typeof SYNC!=="undefined"&&SYNC.on){
    const mvs=Object.entries(dec).map(([sku,q])=>{const p=S.produits.find(x=>x.sku===sku);return {id:uid("MV"),date:todayStr(),heure:nowHM(),type:"VENTE",sku,nom:p?p.nom:sku,qte:-q,motif:"Vente ticket (rayon)",ref:"FEFO",agent:vente.caissier,src:p?(p.sous||"Rayon"):"Rayon",dst:"Caisse"};});
    SYNC.opSale({sale:vente,dec,markdownDec,movements:mvs,pts:ptsInfo}).then(()=>{ showTicket(vente); }).catch(err=>{
      if(err&&err.error==="STOCK"){ alert(`⛔ Stock insuffisant en temps réel : ${err.nom||err.sku} (reste ${err.dispo}) — un autre poste vient de vendre. Données réactualisées.`); SYNC.pullForce(); }
      else if(err&&err.error){ alert("⛔ Vente refusée : "+(err.message||"le stock ou la démarque a changé; actualisez la caisse.")); SYNC.pullForce(); }
      else { /* Repli local uniquement si le serveur est injoignable. */ lignes.forEach(l=>{ if(l.offert||l.fid) return; const p=S.produits.find(x=>x.sku===l.sku); const mk=l.markdownId?(S.dlcMarks||[]).find(x=>x.id===l.markdownId):null; const cs=consumeLotRayon(l.sku,l.qte,mk&&mk.lotId?mk.lotId:""); l.lotsDetail=cs.conso; l.cout=cs.cout||l.cout||Math.round(l.qte*(p?p.achat:0)); p.stockRayon-=l.qte; syncStock(p); if(l.markdownId){const m=(S.dlcMarks||[]).find(x=>x.id===l.markdownId);if(m){m.qteRestante=Math.max(0,Number(m.qteRestante)-l.qte);m.qteVendue=Number(m.qteVendue||0)+l.qte;if(!m.qteRestante)m.statut="Épuisée";const dm=(S.demarques||[]).find(d=>d.dlcMarkId===m.id);if(dm){dm.qteRestante=m.qteRestante;dm.qteVendue=m.qteVendue;dm.statut=m.statut;}}} addMouvement("VENTE",p.sku,-l.qte,"Vente ticket (rayon) — lots "+(cs.conso||[]).map(c=>`${c.lot||"—"} ${c.dlc||""} x${fmtQ(c.qte)} @${fmtN(c.prixAchat)}`).join(" | ")||"FEFO","FEFO",p.sous||"Rayon","Caisse"); }); S.ventes.unshift(vente); save(); showTicket(vente); }
    });
    return;
  }
  lignes.forEach(l=>{ if(l.offert||l.fid) return; const p=S.produits.find(x=>x.sku===l.sku); const mk=l.markdownId?(S.dlcMarks||[]).find(x=>x.id===l.markdownId):null; const cs=consumeLotRayon(l.sku,l.qte,mk&&mk.lotId?mk.lotId:""); l.lotsDetail=cs.conso; l.cout=cs.cout||l.cout||Math.round(l.qte*(p?p.achat:0)); p.stockRayon-=l.qte; syncStock(p); if(l.markdownId){const m=(S.dlcMarks||[]).find(x=>x.id===l.markdownId);if(m){m.qteRestante=Math.max(0,Number(m.qteRestante)-l.qte);m.qteVendue=Number(m.qteVendue||0)+l.qte;if(!m.qteRestante)m.statut="Épuisée";const dm=(S.demarques||[]).find(d=>d.dlcMarkId===m.id);if(dm){dm.qteRestante=m.qteRestante;dm.qteVendue=m.qteVendue;dm.statut=m.statut;}}} addMouvement("VENTE",p.sku,-l.qte,"Vente ticket (rayon) — "+(cs.conso||[]).map(c=>`${c.lot||"—"} ${c.dlc||""} x${fmtQ(c.qte)}`).join(" | ")||"FEFO","FEFO",p.sous||"Rayon","Caisse"); });
  S.ventes.unshift(vente); save();
  showTicket(vente);
}
function showTicket(vente){
  $("#ticketBox").innerHTML=ticketHTML(vente)+`<div class="rendu-big ok">💵 Monnaie rendue au client : <b>${fmtN(vente.rendu)}</b> (Reçu ${fmtN(vente.recu)})</div>
  <div class="toolbar"><button class="btn btn-p btn-s" onclick='printHTML(document.querySelector("#ticketBox .ticket").outerHTML)'>🖨 Imprimer le ticket (ticket seul)</button><button class="btn btn-g btn-s" onclick="detailTicket('${vente.id}')">👁 Détail</button><button class="btn btn-b btn-s" onclick="facturePro('${vente.id}')">🧾 Facture PRO + TVA</button></div>`;
  cart=[]; renderCart(); renderPOSTiles();
  $("#posRecu").value="";
}
/* Historique : clic numéro -> détail + suppression avec motif */
function voirTickets(){
  const list=[...S.ventes].slice(0,80);
  openModal(`<h3>🧾 Historique tickets — cliquez un N° pour détail / suppression avec motif</h3>
  <div class="toolbar"><button class="btn btn-p btn-s" onclick="modalExport('ventes')">📤 Export ventes : 1 ou plusieurs dates (TCD)</button></div>
  <div style="overflow:auto;max-height:55vh"><table><tr><th>N°</th><th>Date</th><th>Caissier</th><th>Total</th><th>Paiement</th><th>Statut</th></tr>
  ${list.map(v=>`<tr><td><a href="#" onclick="detailTicket('${v.id}');return false"><b>${v.id}</b></a></td><td>${v.date} ${v.heure}</td><td>${esc(v.caissier)}</td><td><b>${fmtN(v.total)}</b></td><td>${esc(v.paiement)}</td><td>${v.statut==="Annulé"?`<span class="badge b-bad">Supprimé (${esc(v.motif||"")})</span>`:'<span class="badge b-ok">Validé</span>'}</td></tr>`).join("")}</table></div>`);
}
function detailTicket(id){
  const v=S.ventes.find(x=>x.id===id); if(!v) return;
  openModal(`<h3>🧾 Détail ${v.id} — ${v.statut}</h3>${ticketHTML(v)}
  <div class="toolbar">${v.statut!=="Annulé"?`<button class="btn btn-p btn-s" onclick='printHTML(document.querySelector("#modalBox .ticket").outerHTML)'>🖨 Imprimer (seul)</button><button class="btn btn-b btn-s" onclick="facturePro('${v.id}')">🧾 Facture PRO + TVA</button><button class="btn btn-b btn-s" onclick="fneDepuisTicket('${v.id}')">🇨🇮 FNE</button><button class="btn btn-d btn-s" onclick="supprimerVente('${v.id}')">🗑 Supprimer (gérant)</button>`:`<span class="badge b-bad">Supprimé : ${esc(v.motif||"")}</span>`}<button class="btn btn-g btn-s" onclick="voirTickets()">← Retour liste</button></div>`);
}
function supprimerVente(id){
  if(!isGerant()){ alert("⛔ Suppression d'un ticket de vente : réservée au GÉRANT, sur son poste.\nVotre rôle : "+(S.session?S.session.role:"—")); try{logCorbeille("TENTATIVE_SUPPR_TICKET", id, "Tentative refusée", 0);}catch(e){} return; }
  const v=S.ventes.find(x=>x.id===id); if(!v||v.statut==="Annulé") return;
  const motif=prompt(`GÉRANT — supprimer ${id} (${fmtN(v.total)}) ?\nMotif obligatoire (tracé en corbeille) :\n- Erreur de caisse (mauvais scan)\n- Retour client\n- etc.`,"Erreur de caisse — mauvais article scanné");
  if(!motif) return;
  v.statut="Annulé"; v.motif=motif+" — par "+agent()+" (Gérant) le "+todayStr()+" "+nowHM();
  v.lignes.forEach(l=>{ if(l.offert||l.fid) return; const p=S.produits.find(x=>x.sku===l.sku); if(p){p.stockRayon+=l.qte; syncStock(p); try{ if(l.lotsDetail&&l.lotsDetail.length) restoreLotRayon(l.sku,l.lotsDetail); else { const ls=lotsSKU(l.sku); if(ls.length){ ls[0].qteRayon=Number(ls[0].qteRayon||0)+Number(l.qte||0); syncProduitDLC(l.sku); } } }catch(e){} if(l.markdownId){const m=(S.dlcMarks||[]).find(x=>x.id===l.markdownId);if(m){m.qteRestante=Number(m.qteRestante||0)+Number(l.qte||0);m.qteVendue=Math.max(0,Number(m.qteVendue||0)-Number(l.qte||0));m.statut="Active";const dm=(S.demarques||[]).find(d=>d.dlcMarkId===m.id);if(dm){dm.qteRestante=m.qteRestante;dm.qteVendue=m.qteVendue;dm.statut="Active";}}} addMouvement("RETOUR",p.sku,l.qte,"Retour/suppression "+id+" : "+motif,id,"Caisse","Rayon");} });
  try{logCorbeille("SUPPR_TICKET", id, motif, v.total);}catch(e){}
  save(); alert("Vente supprimée par le gérant (tracée en corbeille Admin)."); voirTickets();
}
/* Retrait d'un article du panier en cours : caissière INTERDITE — gérant ou hôtesse (code/scan) */
function rmLigneAuth(i){
  if(isGerant()||((me()||{}).postes||[]).includes("Hôtesse")||me().poste==="Hôtesse"){ rmLigne(i); return; }
  const code=prompt("⛔ Retrait interdit à la caissière.\nGérant ou hôtesse : tapez/scanez votre CODE pour autoriser le retrait :","");
  if(code==null) return;
  const e=S.employes.find(x=>x.code===String(code).trim()&&x.statut==="Actif");
  if(!e||(e.role!=="Gérant"&&e.role!=="Admin"&&!((e.postes||[]).includes("Hôtesse")||e.poste==="Hôtesse"&&e.role==="Vendeur")&&!((e.postes||[]).includes("Hôtesse")))){ alert("Code non autorisé (gérant ou hôtesse requis)."); try{logCorbeille("TENTATIVE_RETRAIT_PANIER","panier", "Code "+String(code).trim()+" refusé", 0);}catch(e2){} return; }
  const okHot=(e.postes||[]).includes("Hôtesse")||e.poste==="Hôtesse"||e.role==="Gérant"||e.role==="Admin";
  if(!okHot){ alert("Code non autorisé."); return; }
  try{logCorbeille("RETRAIT_PANIER_AUTORISE", "panier", cart[i]?cart[i].nom+" x"+cart[i].qte+" — autorisé par "+e.nom:"—", 0);}catch(e2){}
  rmLigne(i);
}
function togglePromo(id){ const p=S.promos.find(x=>x.id===id); p.actif=!p.actif; save(); renderPOS(); }

/* ================= CATALOGUE ================= */
let catQ="", catR="";
function renderCat(){
  if(!needRole("catalogue")){current="dashboard";buildNav();render();return;}
  $("#view").innerHTML=`
  <div class="card"><h3>📦 Base articles — ${S.produits.length} réf. • SKU <b>RRFFSS+nnnn</b> • TVA : <span class="badge b-info">A 18%</span> <span class="badge b-info">B 9%</span> <span class="badge b-ok">E 0%</span></h3>
    <div class="toolbar"><input id="catQ" placeholder="Nom / SKU / EAN…" value="${esc(catQ)}" oninput="catQ=this.value;renderCatTable()">
    <select onchange="catR=this.value;renderCatTable()"><option value="">Tous rayons</option>${REFERENTIEL.map(r=>`<option value="${r.code}" ${catR===r.code?"selected":""}>${r.icone} ${esc(r.nom)}</option>`).join("")}</select>
    <button class="btn btn-p btn-s" onclick="modalProduit()">+ Nouvel article</button>
    <button class="btn btn-g btn-s" onclick="exportProduits()">⬇ Export produits (TCD)</button>
    <button class="btn btn-o btn-s" onclick="modalEtiquettes()">🏷 Étiquettes (code-barres + prix + rayon)</button></div>
    <div id="catTable"></div></div>
  <div class="card" style="margin-top:14px"><h3>🗂️ Arborescence Rayon ➔ Famille ➔ Sous-famille</h3>
    <div class="tabs">${REFERENTIEL.map((r,i)=>`<button onclick="catArbo(${i})">${r.icone} ${r.code} — ${esc(r.nom)}</button>`).join("")}</div><div id="arboBox"></div></div>`;
  catArbo(window._arbo||2); renderCatTable();
}
function catArbo(i){ window._arbo=i; $$("#view .tabs button").forEach((b,j)=>b.classList.toggle("active",j===i)); const r=REFERENTIEL[i];
  $("#arboBox").innerHTML=`<table><tr><th>Famille</th><th>Sous-familles</th><th>Articles</th></tr>${r.familles.map(f=>`<tr><td><b>${r.code}${f.code}</b> — ${esc(f.nom)}</td><td>${f.sous.map((s,k)=>`<span class="badge b-grey">${r.code}${f.code}${String(k+1).padStart(2,"0")} ${esc(s)}</span>`).join(" ")}</td><td>${S.produits.filter(p=>p.rayon===r.code&&p.famille===f.code).length}</td></tr>`).join("")}</table>`; }
function renderCatTable(){
  const q=(catQ||"").toLowerCase();
  const rows=S.produits.filter(p=>(!catR||p.rayon===catR)&&(!q||(p.nom+p.sku+p.ean).toLowerCase().includes(q)));
  $("#catTable").innerHTML=`<div class="small">${rows.length} article(s) — stock affiché : Réserve / Rayon / Total</div>
  <div style="overflow:auto"><table><tr><th>SKU / EAN</th><th>Libellé + TVA</th><th>Prix TTC / Marge</th><th>Stocks R/R/T</th><th>Min/Max</th><th></th></tr>
  ${rows.map(p=>{const m=marge(p);const c=codeTvaOf(p);const hp=hasPromo(p);return `<tr><td><b>${p.sku}</b><br><span class="small">${esc(p.ean)}</span></td>
  <td><b>${esc(p.nom)}</b> <span class="badge ${c==="E"?"b-ok":"b-info"}">${c} ${tauxOf(c)}%</span>${hp?` <span class="badge b-ok">🎫 ${esc(hp.txt.slice(0,26))}</span>`:""}<br><span class="small">${esc(p.fournisseur||"")} • ${esc(p.unite||"pcs")}${p.condCarton?` • Carton de ${p.condCarton}`:""} • DLC ${esc(p.dlc||"—")} ${p.lot?`• Lot ${esc(p.lot)}`:""}</span></td>
  <td><b>${fmtN(p.vente)}</b> <span class="small">/ achat ${fmtN(p.achat)}</span><br><span class="badge ${m.tx>=30?"b-ok":m.tx>=15?"b-info":"b-warn"}">+${m.tx.toFixed(0)}%</span><br>${prixVarBadge(p)}<br><span class="small">Hist: ${((p.histPrix||[])[0]?((p.histPrix||[])[0].date+" "+fmtN((p.histPrix||[])[0].achat)+"/"+fmtN((p.histPrix||[])[0].vente)):"—")}</span></td>
  <td>${p.stockReserve} / ${p.stockRayon} / <b>${p.stock}</b>${p.stock<=0?' <span class="badge b-bad">Rupture</span>':p.stock<=p.stockMin?' <span class="badge b-warn">Bas</span>':""}</td>
  <td><span class="small">${p.stockMin} / ${p.stockMax}<br>Réappro ${p.qteReappro}</span></td>
  <td><button class="btn btn-g btn-s" onclick="modalProduit('${p.sku}')">✏️</button> <button class="btn btn-g btn-s" onclick="modalPrix('${p.sku}')" title="Changer prix avec historique">💲</button> <button class="btn btn-g btn-s" onclick="delProduit('${p.sku}')">🗑</button>${isAdmin()?` <button class="btn btn-o btn-s" onclick="stampPromo('${p.sku}')" title="Tamponner une promo (gérant)">🎫</button>`:""}</td></tr>`;}).join("")}</table></div>`;
}
/* ---- Étiquettes rayon : code-barres (EAN-13 dessinée) + prix + rayon ---- */
function eanBars(ean){ const d=String(ean||"").replace(/\D/g,""); let s=""; for(let i=0;i<d.length;i++){ const n=+d[i]; s+=`<i style="width:${1+(n%4)}px"></i>`; } return `<div class="cbars">${s}</div><div class="small" style="letter-spacing:3px">${esc(d)}</div>`; }
function modalEtiquettes(){
  openModal(`<h3>🏷 Étiquettes — code-barres + prix + rayon</h3>
  <div class="row2"><div><label>Rayon</label><select id="et_ray" onchange="etRefresh()"><option value="">Tous</option>${REFERENTIEL.map(r=>`<option value="${r.code}">${r.icone} ${esc(r.nom)}</option>`).join("")}</select></div><div><label>Recherche</label><input id="et_q" placeholder="Nom / EAN…" oninput="etRefresh()"></div></div>
  <div id="et_list" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-height:50vh;overflow:auto;margin-top:8px"></div>
  <div class="toolbar"><button class="btn btn-p" onclick="printEtiquettes()">🖨 Imprimer les étiquettes</button><button class="btn btn-g" onclick="closeModal()">Fermer</button></div>`);
  etRefresh();
}
function etList(){
  const r=($("#et_ray")||{}).value||"", q=((($("#et_q")||{}).value)||"").toLowerCase();
  return S.produits.filter(p=>(!r||p.rayon===r)&&(!q||(p.nom+(p.ean||"")).toLowerCase().includes(q))).slice(0,60);
}
function etRefresh(){
  $("#et_list").innerHTML=etList().map(p=>{const hp=hasPromo(p);return `<label class="et-card"><input type="checkbox" class="et_cb" value="${p.sku}" checked><b>${esc(p.nom)}</b>${hp?" <span class='badge b-ok'>🎫 PROMO</span>":""}<div class="et-price">${fmtN(p.vente)}</div><div class="small">${esc(rayonNom(p.rayon))} • ${esc(p.sous||"")}</div>${eanBars(p.ean)}</label>`;}).join("")||"<span class='small'>Aucun article.</span>";
}
function printEtiquettes(){
  const sel=$$(".et_cb").filter(c=>c.checked).map(c=>c.value);
  if(!sel.length) return alert("Cochez au moins une étiquette.");
  printHTML(`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-family:Arial">${sel.map(sku=>{const p=S.produits.find(x=>x.sku===sku);const hp=hasPromo(p);return `<div class="et-print">${hp?"<div class='promo-stamp'>🎫 PROMO</div>":""}<b>${esc(p.nom)}</b><div style="font-size:20px;font-weight:800">${fmtN(p.vente)}</div><div class="small">${esc(rayonNom(p.rayon))} • ${esc(p.sous||"")} • TVA ${codeTvaOf(p)}</div>${eanBars(p.ean)}</div>`;}).join("")}</div>`);
}
function hasPromo(p){ const pr=S.promos.find(x=>x.actif&&x.cible===p.ean); if(pr) return {txt:pr.nom}; return null; }
function delProduit(sku){ if(!isGerant()){ alert("⛔ Suppression d'article : réservée au GÉRANT."); try{logCorbeille("TENTATIVE_SUPPR_ARTICLE", sku, "Tentative refusée", 0);}catch(e){} return; } const p=S.produits.find(x=>x.sku===sku); if(!confirm("GÉRANT — supprimer l'article "+(p?p.nom:sku)+" ? (tracé en corbeille)")) return; const motif=prompt("Motif de suppression (obligatoire) :","Article retiré de l'assortiment"); if(!motif) return; S.produits=S.produits.filter(x=>x.sku!==sku); S.trash=S.trash||{produits:[],bcs:[]}; if(!S.trash.produits.includes(sku)) S.trash.produits.push(sku); try{logCorbeille("SUPPR_ARTICLE", sku, (p?p.nom:sku)+" — "+motif, (p?(p.stock*(p.achat||0)):0));}catch(e){} save(); renderCat(); }
function modalProduit(sku){
  const p=sku?S.produits.find(x=>x.sku===sku):{rayon:"03",famille:"01",sous:"Café (Grain, Moulu, Capsules)",achat:0,vente:0,code_tva:"A",stockReserve:0,stockRayon:0,stockMin:10,stockMax:60,qteReappro:20,condCarton:12,unite:"pcs",dlc:"+30j",lot:"",ean:"618"+String(Math.floor(Math.random()*89999999+10000000))};
  const c=codeTvaOf(p);
  openModal(`<h3>${sku?"✏️ Modifier":"➕ Nouvel"} article ${sku?`<span class="badge b-info">${p.sku}</span>`:`<span class="small">(SKU auto RRFFSS+nnnn)</span>`}</h3>
  <div class="row2"><div><label>Libellé *</label><input id="f_nom" value="${esc(p.nom||"")}"></div><div><label>EAN</label><input id="f_ean" value="${esc(p.ean||"")}"></div></div>
  <div class="alert a-green" id="skuPrev" style="margin:6px 0"></div>
  <div class="row2"><div><label>Rayon (auto → famille / sous-famille / TVA)</label><select id="f_rayon" onchange="cascadeFam()">${REFERENTIEL.map(r=>`<option value="${r.code}" ${p.rayon===r.code?"selected":""}>${r.icone} ${esc(r.nom)}</option>`).join("")}</select></div><div><label>Famille</label><select id="f_fam"></select></div></div>
  <div class="row2"><div><label>Sous-famille</label><select id="f_sous" onchange="refreshProduitAuto()"></select></div><div><label>Code TVA * (auto suggéré, modifiable)</label><select id="f_ctva" onchange="this.dataset.touched='1'"><option value="A" ${c==="A"?"selected":""}>A — Normal 18%</option><option value="B" ${c==="B"?"selected":""}>B — Réduit 9%</option><option value="E" ${c==="E"?"selected":""}>E — Exonéré 0%</option></select></div></div>
  <div class="row2"><div><label>Prix achat (F)</label><input id="f_achat" type="number" value="${p.achat}"></div><div><label>Prix vente TTC (F) — affichage rayon</label><input id="f_vente" type="number" value="${p.vente}"></div></div>
  <div class="row2"><div><label>Unité</label><select id="f_unite"><option ${p.unite==="pcs"?"selected":""}>pcs</option><option ${p.unite==="kg"?"selected":""}>kg</option><option ${p.unite==="L"?"selected":""}>L</option><option ${p.unite==="lot"?"selected":""}>lot</option></select></div><div><label>Conditionnement (carton = X unités ; 1 carton lait = 12 briques)</label><input id="f_cond" type="number" value="${p.condCarton||12}"></div></div>
  <div class="row2"><div><label>Stock Min (alerte)</label><input id="f_min" type="number" value="${p.stockMin}"></div><div><label>Stock Max (anti-encombrement)</label><input id="f_max" type="number" value="${p.stockMax}"></div></div>
  <div class="row2"><div><label>Qté réappro auto</label><input id="f_reap" type="number" value="${p.qteReappro}"></div><div><label>DLC / Lot (obligatoire frais : crèmerie, boucherie, poissonnerie)</label><input id="f_dlc" value="${esc(p.dlc||"")}" placeholder="+30j ou date"></div></div>
  <div class="row2"><div><label>N° Lot (lot principal — les lots multiples se gèrent en réception, voir 📦 Lots)</label><input id="f_lot" value="${esc(p.lot||"")}"></div><div><label>Fournisseur</label><select id="f_four">${S.fournisseurs.map(f=>`<option ${p.fournisseur===f.nom?"selected":""}>${esc(f.nom)}</option>`).join("")}</select></div></div>
  ${sku?`<div class="alert a-yel">📦 <b>${lotsSKU(sku).length} lot(s) en stock</b> — ${lotsSKU(sku).slice(0,3).map(l=>`${esc(l.lot||"—")} ${esc(l.dlc||"—")} (J-${dlcJours(l.dlc)}) : R ${fmtQ(l.qteReserve)} / Rayon ${fmtQ(l.qteRayon)} @ ${fmtN(l.prixAchat)}`).join(" • ")||"aucun détail"} <button class="btn btn-o btn-s" onclick="modalLots('${sku}')">Voir lots</button></div>`:""}
  <div class="toolbar"><button class="btn btn-p" onclick="saveProduit('${sku||""}')">💾 Enregistrer</button><button class="btn btn-g" onclick="closeModal()">Annuler</button></div>`);
  cascadeFam(p.famille,p.sous); refreshProduitAuto(); if(sku){const s=$("#f_ctva"); if(s){s.value=codeTvaOf(p); s.dataset.touched='1';}}
}
function updateSous(selS){ const rcEl=$("#f_rayon"), fcEl=$("#f_fam"), sEl=$("#f_sous"); const rc=(rcEl&&rcEl.value)||((REFERENTIEL[0]||{}).code); let fc=fcEl&&fcEl.value; const r=rayonParCode(rc)||REFERENTIEL[0]; const fams=(r&&r.familles)||[]; if(!fams.some(f=>f.code===fc)) fc=fams[0]&&fams[0].code; if(fcEl&&!fcEl.value) fcEl.value=fc; const f=familleParCode(rc,fc)||fams[0]; const sous=((f&&f.sous)||[]); if(sEl){ sEl.innerHTML=sous.map(s=>`<option ${s===selS?"selected":""}>${esc(s)}</option>`).join(""); if(selS&&sous.includes(selS)) sEl.value=selS; else if(sous.length&&!sEl.value) sEl.value=sous[0]; } if(typeof refreshProduitAuto==="function"){ try{refreshProduitAuto();}catch(e){} } }
function cascadeFam(selF,selS){ const rcEl=$("#f_rayon"); const rc=(rcEl&&rcEl.value)||((REFERENTIEL[0]||{}).code); const r=rayonParCode(rc)||REFERENTIEL[0]; const fams=r.familles||[]; const keep=fams.some(f=>f.code===selF)?selF:(fams[0]&&fams[0].code); const fEl=$("#f_fam"); if(fEl){ fEl.innerHTML=fams.map(f=>`<option value="${f.code}" ${f.code===keep?"selected":""}>${esc(f.nom)}</option>`).join(""); fEl.value=keep; } const fr=$("#f_rayon"); if(fr&&!fr.dataset.wired){ fr.dataset.wired="1"; fr.addEventListener("change",()=>cascadeFam()); } const ff=$("#f_fam"); if(ff){ ff.onchange=()=>updateSous(); } updateSous(selS); }
function saveProduit(sku){
  const nom=$("#f_nom").value.trim(); if(!nom) return alert("Libellé obligatoire.");
  const frais=["01"].includes($("#f_rayon").value);
  if(frais&&!$("#f_dlc").value) return alert("DLC obligatoire pour le rayon Frais (traçabilité CI).");
  const data={nom, ean:$("#f_ean").value.trim(), rayon:$("#f_rayon").value, famille:$("#f_fam").value, sous:$("#f_sous").value, code_tva:$("#f_ctva").value, tva:tauxOf($("#f_ctva").value), unite:$("#f_unite").value, condCarton:+$("#f_cond").value||1, achat:+$("#f_achat").value||0, vente:+$("#f_vente").value||0, stockMin:+$("#f_min").value||0, stockMax:+$("#f_max").value||9999, qteReappro:+$("#f_reap").value||0, dlc:normaliserDLC($("#f_dlc").value||"—"), lot:$("#f_lot").value||"", fournisseur:$("#f_four").value};
  if(sku){ const p=S.produits.find(x=>x.sku===sku); const chPrix=trackPrix(p,data.achat,data.vente,"Fiche article"); Object.assign(p,data); p.seuil=p.stockMin; syncStock(p); if(chPrix) addMouvement("PRIX",p.sku,0,`Prix ${fmtN(p.histPrix[1]?p.histPrix[1].achat:p.achat)}→${fmtN(p.achat)} / ${fmtN(p.histPrix[1]?p.histPrix[1].vente:p.vente)}→${fmtN(p.vente)} (fiche)`,"Prix",agent(),"Fiche"); }
  else{ const nsku=genererSKU(data.rayon,data.famille,data.sous); S.produits.unshift({sku:nsku,stockReserve:0,stockRayon:0,stock:0,seuil:data.stockMin,histPrix:[{date:todayStr(),heure:nowHM(),achat:data.achat,vente:data.vente,agent:agent(),motif:"Création"}],...data}); addMouvement("RECEPTION",nsku,0,"Création article","Stock initial",LOC_RESERVE,LOC_RESERVE); }
  save(); closeModal(); renderCat();
}
/* Changement de prix rapide (caisse/catalogue) avec motif + historique */
function modalPrix(sku){
  const p=S.produits.find(x=>x.sku===sku); if(!p) return;
  openModal(`<h3>💲 Prix — ${esc(p.nom)}</h3><div class="small">Actuel : achat <b>${fmtN(p.achat)}</b> • vente TTC <b>${fmtN(p.vente)}</b> • marge ${marge(p).tx.toFixed(0)}%</div>
  <div class="row2"><div><label>Nouveau prix d'achat (F)</label><input id="px_a" type="number" value="${p.achat}"></div><div><label>Nouveau prix de vente TTC (F)</label><input id="px_v" type="number" value="${p.vente}"></div></div>
  <label>Motif (obligatoire — tracé dans l'historique)</label><input id="px_m" placeholder="Ex : hausse fournisseur, promo, alignement concurrent…">
  ${(p.histPrix||[]).length?`<div class="small">Historique : ${p.histPrix.slice(0,4).map(h=>`${h.date} ${h.heure||""} ${fmtN(h.achat)}/${fmtN(h.vente)} (${esc(h.agent||"")})`).join(" • ")}</div>`:""}
  <div class="toolbar"><button class="btn btn-p" onclick="savePrix('${sku}')">💾 Appliquer (ticket + étiquettes suivent)</button></div>`);
}
function savePrix(sku){
  const p=S.produits.find(x=>x.sku===sku); const na=+$("#px_a").value||0, nv=+$("#px_v").value||0, motif=$("#px_m").value.trim();
  if(!motif) return alert("Motif obligatoire.");
  if(!trackPrix(p,na,nv,motif)) { closeModal(); return alert("Aucun changement de prix."); }
  addMouvement("PRIX",p.sku,0,`Prix achat ${fmtN(p.achat)}→${fmtN(na)} • vente ${fmtN(p.vente)}→${fmtN(nv)} — ${motif}`,"Prix",agent(),"Tous postes");
  p.achat=na; p.vente=nv; save(); closeModal(); render();
  alert(`💲 Prix mis à jour sur tous les postes (temps réel) : ${p.nom} → ${fmtN(nv)} TTC.`);
}

/* ================= STOCKS : 4 sous-onglets ================= */
let stockTab="flux";
function renderStocks(){
  const bas=S.produits.filter(p=>p.stock<=p.stockMin);
  const tabs=[["fiches","📇 1. Fiches Articles"],["flux","📥 2. Réception & mouvements"],["inv","📋 3. Inventaires & Démarques"],["kpi","📊 4. KPI"]];
  $("#view").innerHTML=`
  <div class="grid g4">
    <div class="kpi" style="--c:#16a34a"><div class="lbl">Valeur stock (achat)</div><div class="val">${fmtN(S.produits.reduce((a,p)=>a+p.stock*p.achat,0))}</div><div class="hint">Réserve ${fmtN(S.produits.reduce((a,p)=>a+p.stockReserve*p.achat,0))} • Rayons ${fmtN(S.produits.reduce((a,p)=>a+p.stockRayon*p.achat,0))}</div></div>
    <div class="kpi" style="--c:#dc2626"><div class="lbl">Sous Min / Ruptures</div><div class="val">${bas.length}</div><div class="hint">Seuil réappro atteint</div></div>
    <div class="kpi" style="--c:#f59e0b"><div class="lbl">DLC ≤ ${S.params.seuilAlerteDLC}j</div><div class="val">${S.produits.filter(p=>dlcJours(p.dlc)<=S.params.seuilAlerteDLC).length}</div><div class="hint">FEFO + sticker -50%</div></div>
    <div class="kpi" style="--c:#2563eb"><div class="lbl">Mouvements tracés</div><div class="val">${S.mouvements.length}</div><div class="hint">Avec nom de l'agent</div></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="tabs">${tabs.map(([id,t])=>`<button class="${stockTab===id?"active":""}" onclick="stockTab='${id}';renderStocks()">${t}</button>`).join("")}</div><div id="stockBody"></div></div>`;
  ({fiches:stFiches,flux:stFlux,inv:stInv,kpi:stKpi})[stockTab]();
}
const DEM_CONNUE=["Péremption (DLC/DLUO)","Casse et destruction","Vol constaté","Dons aux associations","Autoconsommation magasin","Retours / rappels fournisseurs"];
const DEM_INCONNUE=["Vol invisible","Erreur de réception","Erreur d'encaissement","Coulage / perte de poids (chaleur)"];
function stFiches(){
  $("#stockBody").innerHTML=`<div class="toolbar"><input placeholder="Filtrer…" oninput="filterTable('fichTbl',this.value)"><button class="btn btn-g btn-s" onclick="exportStocks()">⬇ Export stocks</button><button class="btn btn-b btn-s" onclick="exportLots()">⬇ Export lots (DLC + prix fournisseurs)</button><button class="btn btn-p btn-s" onclick="modalProduit()">+ Article</button></div>
  <div class="small">Flux : <b>Entrée Fournisseur (BL + lot + DLC par article) → [Réserve] → Transfert FEFO → [Rayon] → Vente (ticket, marge au lot)</b> • 1 carton = X unités (conversion auto à la réception). Un article peut avoir <b>plusieurs lots / DLC / prix fournisseurs</b> : voir bouton Lots.</div><div style="overflow:auto;max-height:480px"><table id="fichTbl"><tr><th>Article / TVA</th><th>Cond.</th><th>Réserve</th><th>Rayon</th><th>Total</th><th>Min/Max/Réappro</th><th>Lots / DLC</th><th></th></tr>
  ${S.produits.map(p=>{const ls=lotsSKU(p.sku);const totL=ls.reduce((a,l)=>a+Number(l.qteReserve||0)+Number(l.qteRayon||0),0);const plusProche=ls[0];return `<tr><td><b>${esc(p.nom)}</b> <span class="badge ${codeTvaOf(p)==="E"?"b-ok":"b-info"}">${codeTvaOf(p)}</span><br><span class="small">${p.sku}</span></td><td><span class="small">1 carton=${p.condCarton} ${esc(p.unite||"")}</span></td><td>${fmtQ(p.stockReserve)}</td><td><b>${fmtQ(p.stockRayon)}</b></td><td><b>${fmtQ(p.stock)}</b></td><td><span class="small">${p.stockMin}/${p.stockMax}/${p.qteReappro}</span></td><td><span class="small">${ls.length?`${ls.length} lot(s) • proche ${esc(plusProche.dlc||"—")} (J-${dlcJours(plusProche.dlc)}) • stock lots ${fmtQ(totL)}`:`${esc(p.dlc)} ${p.lot?`• `+esc(p.lot):""}`}</span><br><button class="btn btn-o btn-s" onclick="modalLots('${p.sku}')">📦 Lots</button></td><td><button class="btn btn-g btn-s" onclick="modalProduit('${p.sku}')">✏️</button></td></tr>`;}).join("")}</table></div>`;
}
function modalLots(sku){
  const p=S.produits.find(x=>x.sku===sku); if(!p) return;
  const ls=(S.lots||[]).filter(l=>l.sku===sku).sort((a,b)=>dlcJours(a.dlc)-dlcJours(b.dlc));
  openModal(`<h3>📦 Lots — ${esc(p.nom)} <span class="small">${sku}</span></h3><div class="small">Chaque réception crée un lot avec son prix fournisseur, son lot et sa DLC. La vente sort le lot le plus proche d'abord (FEFO) et la marge est calculée au prix réel du lot. Pour ajouter un lot : passez par <b>Réception</b>, pas par la fiche.</div><div style="max-height:45vh;overflow:auto"><table><tr><th>Lot</th><th>DLC (J)</th><th>Fournisseur</th><th>Réserve</th><th>Rayon</th><th>P.Achat</th><th>BL</th></tr>${ls.map(l=>`<tr><td>${esc(l.lot||"—")}</td><td>${esc(l.dlc||"—")} (J-${dlcJours(l.dlc)})</td><td><span class="small">${esc(l.fournisseur||"—")}</span></td><td>${fmtQ(l.qteReserve)}</td><td><b>${fmtQ(l.qteRayon)}</b></td><td>${fmtN(l.prixAchat)}</td><td><span class="small">${esc(l.blId||"")}</span></td></tr>`).join("")||"<tr><td colspan=7>Aucun lot détaillé — stock global uniquement.</td></tr>"}</table></div><div class="toolbar"><button class="btn btn-g" onclick="closeModal()">Fermer</button></div>`);
}
function stFlux(){
  const bcsValides=S.bcs.filter(b=>b.statut==="Validé");
  $("#stockBody").innerHTML=`
  <div class="grid g2">
    <div class="card"><h3>📥 Réception fournisseur — contrôle des quantités BL / BC</h3>
      <label>Bon de commande à réceptionner</label>
      <select id="rec_bc" onchange="recRender()">
        <option value="">— Choisir un BC validé —</option>
        ${bcsValides.map(b=>`<option value="${b.id}">${b.id} • ${esc(b.fournisseur)} • ${fmtN(b.lignes.reduce((a,l)=>a+l.qte*l.pu,0))}</option>`).join("")}
        <option value="LIBRE">➕ Entrée libre (retour client, réintégration) — sans BC</option>
      </select>
      <div id="rec_body" style="margin-top:10px"></div>
    </div>
    <div class="card"><h3>🔀 Transferts & mouvements</h3>
      <h3 style="font-size:14px">Réserve → Rayon</h3>
      <div class="row2"><div><label>Article</label><select id="mv_sku">${S.produits.map(p=>`<option value="${p.sku}">${esc(p.nom)} (R:${fmtQ(p.stockReserve)}/Rayon:${fmtQ(p.stockRayon)})</option>`).join("")}</select></div><div><label>Qté</label><input id="tr_qte" type="number" step="0.001" value="10"></div></div>
      <div class="row2"><div><label>Rayon destinataire</label><select id="tr_dst">${RAYON_LOCS().map(r=>`<option>${esc(r)}</option>`).join("")}</select></div><div><label>&nbsp;</label><button class="btn btn-b" style="width:100%" onclick="doTransfert()">🔀 Transférer</button></div></div>
      <div class="toolbar"><button class="btn btn-p btn-s" onclick="modalFIFO()">⏩ Assistant FEFO (DLC les plus proches d'abord)</button></div>
      <hr>
      <h3 style="font-size:14px">Rayon → Rayon (avec motif)</h3>
      <div class="row2"><div><label>Source</label><select id="tr_src">${RAYON_LOCS().map(r=>`<option>${esc(r)}</option>`).join("")}</select></div><div><label>Destination</label><select id="tr_dst2">${RAYON_LOCS().map(r=>`<option>${esc(r)}</option>`).join("")}</select></div></div>
      <div class="row2"><div><label>Qté</label><input id="tr_qte2" type="number" step="0.001" value="5"></div><div><label>Motif</label><input id="tr_motif2" placeholder="Rééquilibrage…"></div></div>
      <div class="toolbar"><button class="btn btn-b btn-s" onclick="doTransfertRayon()">🔀 Transférer</button></div>
      <hr>
      <h3 style="font-size:14px">🏷 Démarque connue</h3>
      <div class="small">La <b>DLC commerciale</b> conserve le stock : seuls les articles marqués passent au prix réduit en caisse. Casse, vol et dons restent des sorties de stock.</div>
      <div class="row2"><div><label>Article</label><select id="dm_sku">${S.produits.map(p=>`<option value="${p.sku}">${esc(p.nom)}</option>`).join("")}</select></div><div><label>Qté concernée</label><input id="dm_qte" type="number" step="0.001" value="1"></div></div>
      <div class="row2"><div><label>Motif</label><select id="dm_motif">${DEM_CONNUE.map(m=>`<option>${m}</option>`).join("")}</select></div><div><label>Commentaire</label><input id="dm_c" placeholder="Détails…"></div></div>
      <div class="toolbar"><button class="btn btn-o btn-s" onclick="doDemarqueConnue()">Valider la démarque</button></div>
    </div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h3>📒 Journal des mouvements (agent tracé)</h3>
      <div class="toolbar"><input placeholder="Filtrer…" oninput="filterTable('mvTbl',this.value)"><button class="btn btn-g btn-s" onclick="exportMouvements()">⬇ Export</button></div>
      <div style="overflow:auto;max-height:420px"><table id="mvTbl"><tr><th>Date</th><th>Type</th><th>Article</th><th>Qté</th><th>Agent</th></tr>
      ${S.mouvements.slice(0,100).map(m=>`<tr><td><span class="small">${m.date}<br>${m.heure}</span></td><td><span class="badge ${m.type==="RECEPTION"?"b-ok":m.type==="VENTE"?"b-info":"b-warn"}">${esc(m.type)}</span><br><span class="small">${esc(m.motif||"")}</span></td><td>${esc(m.nom)}<br><span class="small">${m.sku}</span></td><td><b>${fmtQ(m.qte)}</b></td><td>${esc(m.agent||"—")}</td></tr>`).join("")}</table></div></div>
    <div class="card"><h3>🧾 Bons de Livraison (${S.bls.length})</h3>
      ${S.bls.slice(0,10).map(b => {
  // Un BL en réserve avec stock restant est protégé ; vide, il passe en historique.
  const reste=blReserveReste(b);
  const estVerrouille = (b.statut === "Réserve"|| b.statut === "Consolidé");

  return `<div class="alert ${b.statut==="Supprimé"?"a-red":b.statut==="Consolidé"?"a-green":"a-yel"}">
    <b>${esc(b.id)}</b> — ${esc(b.fournisseur)} le ${esc(b.date)} • <b>${esc(b.statut)}</b>${b.statut==="Réserve"&&reste<=0.0001?" • réserve vide — historique":""}<br>
    <span class="small">${(b.lignes||[]).map(l=>`${esc(l.nom)} × ${fmtQ(l.qte)}`).join(" • ")}${(S.lots||[]).length?` • <span class="small">réserve restante du BL : ${fmtQ(reste)}</span>`:""}</span><br>
    <button class="btn btn-g btn-s" onclick="printBL('${b.id}')">🖨 BL</button>
    ${b.statut !== "Supprimé" ? (estVerrouille ?
      `<button class="btn btn-s" disabled title="Un BL en réserve ou consolidé ne peut pas être supprimé" style="background-color:#ccc;color:#666;cursor:not-allowed;font-weight:bold">🔒 Archivé (bloqué)</button>` :
      `<button class="btn btn-d btn-s" onclick="askDelBL('${b.id}')">🗑 Demander suppression</button>`
    ) : ""}
  </div>`;
}).join("")||"<span class='small'>Aucun BL.</span>"
}
      ${(S.delRequests||[]).filter(d=>d.statut==="En attente").length?`<hr><h3>🗑 Demandes en attente (gérant valide)</h3>${S.delRequests.filter(d=>d.statut==="En attente").slice(0,5).map(d=>`<div class="alert a-yel"><b>${d.refId}</b> • ${esc(d.motif)} • ${esc(d.demandePar)} ${isGerant()?`<button class="btn btn-p btn-s" onclick="validDelBL('${d.id}',true)">✅ Valider</button>`:""}</div>`).join("")}`:""}
    </div>
  </div>`;
  recRender();
}
/* --- Réception unique : contrôle conformité BL vs BC --- */
function recRender(){
  const sel=$("#rec_bc"); const box=$("#rec_body"); if(!sel||!box) return;
  const id=sel.value;
  if(!id){ box.innerHTML="<div class='small'>Choisissez un BC validé pour contrôler la livraison, ou « Entrée libre ».</div>"; return; }
  if(id==="LIBRE"){
    box.innerHTML=`<div class="alert a-yel">Entrée libre : retour client / réintégration (pas de BC à contrôler).</div>
    <label>Article</label><select id="lv_sku">${S.produits.map(p=>`<option value="${p.sku}">${esc(p.nom)}</option>`).join("")}</select>
    <div class="row2"><div><label>Quantité</label><input id="lv_qte" type="number" step="0.001" value="1"></div><div><label>Motif</label><select id="lv_type"><option value="RETOUR">Retour client</option><option value="REINTEGRATION">Réintégration inventaire</option></select></div></div>
    <div class="row2"><div><label>Lot (ex : L2401)</label><input id="lv_lot" placeholder="N° lot"></div><div><label>Date de péremption (DLC)</label><input id="lv_dlc" type="date"></div></div>
    <div class="toolbar"><button class="btn btn-p" onclick="recLibre()">📥 Entrer en réserve</button></div>`;
    return;
  }
  const b=S.bcs.find(x=>x.id===id); if(!b){ box.innerHTML=""; return; }
  box.innerHTML=`<div class="small">Fournisseur <b>${esc(b.fournisseur)}</b> — ${b.lignes.length} ligne(s). Saisissez la quantité <b>réellement livrée</b> + <b>lot et DLC de chaque article</b>. En cas d'écart, vous pourrez valider les quantités réelles avec un motif, ou déclarer un litige.</div>
  <label>N° BL fournisseur</label><input id="rec_bl" placeholder="Ex : BL-F-2026-118">
  <div style="max-height:34vh;overflow:auto;margin-top:8px"><table><tr><th>Article</th><th>Qté BC</th><th>Qté reçue</th><th>PU achat</th><th>Lot</th><th>DLC</th></tr>
  ${b.lignes.map((l,i)=>{const p=S.produits.find(x=>x.sku===l.sku)||{};const dlcD=normaliserDLC(p.dlc||"");const dlcV=/^\d{4}-\d{2}-\d{2}$/.test(dlcD)?dlcD:"";return `<tr><td><b>${esc(l.nom)}</b><br><span class="small">${l.sku}</span></td><td><b>${fmtQ(l.qte)}</b></td><td><input type="number" step="0.001" id="rq_${i}" value="${l.qte}" style="width:80px" oninput="recCheck()"></td><td><input type="number" id="rp_${i}" value="${l.pu}" style="width:80px"></td><td><input id="rl_${i}" value="${esc(p.lot||"")}" placeholder="Lot" style="width:80px"></td><td><input id="rd_${i}" type="date" value="${dlcV}" style="width:130px"></td></tr>`;}).join("")}</table></div>
  <div id="rec_statut" class="alert a-green" style="margin-top:8px">✅ Prêt à contrôler.</div>
  <div class="toolbar"><button class="btn btn-p" onclick="recValider('${b.id}')">✅ CONTRÔLER & VALIDER LA RÉCEPTION</button><button class="btn btn-g" onclick="recLitige('${b.id}')">⚠️ Déclarer un écart (litige)</button></div>`;
}
function recCheck(){
  const sel=$("#rec_bc"); const b=sel&&S.bcs.find(x=>x.id===sel.value); if(!b) return;
  const ecarts=[];
  b.lignes.forEach((l,i)=>{ const el=document.getElementById("rq_"+i); if(!el) return; const q=Number(el.value); if(!Number.isFinite(q)||q<0) ecarts.push(`${l.nom} : quantité invalide`); else if(q!==Number(l.qte)) ecarts.push(`${l.nom} : BC ${fmtQ(l.qte)} / reçu ${fmtQ(q)}`); });
  const st=$("#rec_statut"); if(!st) return;
  if(ecarts.length){ st.className="alert a-yel"; st.innerHTML=`⚠️ <b>Écart constaté :</b><br>${ecarts.map(esc).join("<br>")}<br><span class="small">Vous pouvez valider les quantités réellement reçues avec un motif obligatoire, ou déclarer un litige. Aucun stock ne bouge avant validation.</span>`; }
  else { st.className="alert a-green"; st.innerHTML="✅ BL conforme au BC — vous pouvez valider."; }
}
function recValider(id){
  if(licenceExpiree()){ render(); return alert("🔒 Démo expirée : réception bloquée. Activez la licence FULL."); }
  const b=S.bcs.find(x=>x.id===id); if(!b) return;
  if(b.statut!=="Validé") return alert("Ce BC n'est plus en statut Validé.");
  if(S.bls.some(x=>x.bcId===id)) return alert("Une réception existe déjà pour ce BC : aucune double entrée en stock n'est autorisée.");
  const blN=$("#rec_bl")?.value.trim()||("BL-"+id), lignes=[], ecarts=[]; let erreur="";
  b.lignes.forEach((l,i)=>{
    const qEl=document.getElementById("rq_"+i), pEl=document.getElementById("rp_"+i), lotEl=document.getElementById("rl_"+i), dlcEl=document.getElementById("rd_"+i);
    const q=qEl?Number(qEl.value):Number(l.qte), pu=pEl?Number(pEl.value):Number(l.pu);
    const lot=lotEl?lotEl.value.trim():"", dlcRaw=dlcEl?dlcEl.value:"";
    const dlc=dlcRaw?normaliserDLC(dlcRaw):"";
    if(!Number.isFinite(q)||q<0){ erreur=`Quantité invalide pour ${l.nom}.`; return; }
    if(!Number.isFinite(pu)||pu<=0){ erreur=`Prix d'achat invalide pour ${l.nom}.`; return; }
    if(!S.produits.some(p=>p.sku===l.sku)){ erreur=`Article absent du catalogue : ${l.nom}.`; return; }
    if(q!==Number(l.qte)) ecarts.push({sku:l.sku,nom:l.nom,commandee:Number(l.qte),recue:q});
    lignes.push({sku:l.sku,nom:l.nom,qte:q,pu,lot,dlc});
  });
  if(erreur) return alert(erreur);
  if(!lignes.length) return alert("Le BC ne contient aucune ligne valide.");
  if(!lignes.some(l=>l.qte>0)) return alert("Aucune quantité reçue : déclarez un litige plutôt que de clôturer le BC.");
  let motif="";
  if(ecarts.length){ motif=prompt("Écart entre le BC et la quantité réellement livrée. Décrivez/justifiez l'ajustement (obligatoire) :", "Quantité BL fournisseur constatée au quai"); if(!motif||!motif.trim()) return alert("Réception annulée : un motif est obligatoire pour valider un écart."); motif=motif.trim(); }
  // Toutes les validations sont faites avant de toucher au stock.
  lignes.forEach((l,i)=>{
    const bcLine=b.lignes[i]; if(bcLine){ bcLine.qteRecue=l.qte; bcLine.puReception=l.pu; bcLine.lot=l.lot||""; bcLine.dlc=l.dlc||""; }
    const p=S.produits.find(x=>x.sku===l.sku); const ancienAchat=Number(p.achat)||0;
    if(l.pu!==ancienAchat){ trackPrix(p,l.pu,p.vente,`Réception ${id} — tarif BL`); addMouvement("PRIX",p.sku,0,`Prix achat ${fmtN(ancienAchat)}→${fmtN(l.pu)} (${id})`,"Prix",agent(),b.fournisseur); p.achat=l.pu; }
    if(l.qte>0){ p.stockReserve=(Number(p.stockReserve)||0)+l.qte; syncStock(p); upsertLot({sku:l.sku,lot:l.lot||"",dlc:l.dlc||p.dlc||"",fournisseur:b.fournisseur,prixAchat:l.pu,qte:l.qte,blId:blN}); syncProduitDLC(l.sku); addMouvement("RECEPTION",p.sku,l.qte,`Réception ${id}${ecarts.length?" ajustée":" conforme"} — BL ${blN}`+(l.lot?" • lot "+l.lot:"")+(l.dlc?" • DLC "+l.dlc:""),"BL",b.fournisseur,LOC_RESERVE); }
  });
  const bl="BL"+String(S.seq.bl++).padStart(4,"0"), montant=lignes.reduce((a,l)=>a+l.qte*l.pu,0);
  S.bls.unshift({id:bl,date:todayStr(),heure:nowHM(),fournisseur:b.fournisseur,bcId:b.id,blFournisseur:blN,agent:agent(),lignes,statut:"Réserve",motifAjustement:motif||""});
  b.statut="Réceptionné"; b.dateReception=todayStr();
  if(ecarts.length){ b.ecartsReception=ecarts; b.motifAjustementReception=motif; b.agentAjustementReception=agent(); }
  const fac=S.factures.find(f=>f.bc===b.id);
  if(fac) fac.montant=montant;
  else S.factures.unshift({id:"FA"+String(S.seq.facture++).padStart(4,"0"),fournisseur:b.fournisseur,montant,echeance:todayStr(),payee:false,bc:b.id});
  save(); printBL(bl); renderStocks();
  alert(`✅ Réception ${ecarts.length?"ajustée":"conforme"} validée (${b.id}).\nStock en RÉSERVE • BL ${bl} • Facture ${fmtN(montant)} F créée/mise à jour.`);
}
function recLitige(id){
  const b=S.bcs.find(x=>x.id===id); if(!b) return;
  const m=prompt("Décrivez l'écart constaté (quantité, produit abîmé…) :","Écart de quantité constaté à la livraison");
  if(!m) return;
  b.statut="Litige"; b.litige=m; save(); renderStocks(); alert("⚠️ BC marqué en litige — aucune entrée en stock. Le gérant peut le traiter dans Achats.");
}
function recLibre(){
  const sku=$("#lv_sku").value, q=+($("#lv_qte").value||0), type=$("#lv_type").value, lot=($("#lv_lot")?.value||"").trim(), dlcRaw=$("#lv_dlc")?.value||"";
  const dlc=dlcRaw?normaliserDLC(dlcRaw):"";
  const p=S.produits.find(x=>x.sku===sku); if(!q||q<=0) return alert("Quantité invalide.");
  p.stockReserve+=q; syncStock(p); upsertLot({sku,lot,dlc:dlc||p.dlc||"",fournisseur:p.fournisseur||"",prixAchat:p.achat,qte:q,blId:"LIBRE"}); syncProduitDLC(sku);
  addMouvement(type,sku,q,(type==="RETOUR"?"Retour client":"Réintégration")+(lot?" • lot "+lot:"")+(dlc?" • DLC "+dlc:""),"Libre",type==="RETOUR"?"Caisse":LOC_RESERVE,LOC_RESERVE);
  const id="BL"+String(S.seq.bl++).padStart(4,"0");
  S.bls.unshift({id,date:todayStr(),heure:nowHM(),fournisseur:type==="RETOUR"?"Retour client":"Réintégration",bcId:"—",agent:agent(),lignes:[{sku,nom:p.nom,qte:q,lot,dlc}],statut:"Réserve"});
  save(); recRender(); alert("✅ Entrée libre enregistrée en réserve.");
}
function convCarton(){ const sku=$("#mv_sku").value; const p=S.produits.find(x=>x.sku===sku); $("#cx").textContent=p.condCarton||1; const c=+($("#mv_cart").value||0); if(c>0) $("#mv_qte").value=(c*(p.condCarton||1)); }
/* Réception groupée : plusieurs articles du même fournisseur en un seul BL */
function modalReceptionGroupee(){
  const f0=S.fournisseurs[0]?S.fournisseurs[0].nom:"";
  openModal(`<h3>📥 Réception groupée — plusieurs articles, même fournisseur, un seul BL</h3>
  <label>Fournisseur</label><select id="rg_f" onchange="rgRefresh()">${S.fournisseurs.map(f=>`<option ${f.nom===f0?"selected":""}>${esc(f.nom)}</option>`).join("")}</select>
  <div class="row2"><div><label>N° BL fournisseur</label><input id="rg_bl" placeholder="Ex : BL-F-2026-118"></div><div><label>Lot/DLC global (frais)</label><input id="rg_lot" placeholder="L2401 / +30j"></div></div>
  <div id="rg_list" style="max-height:40vh;overflow:auto"></div>
  <div class="small">Saisissez pour chaque article la quantité, le nouveau prix d'achat, le lot et la DLC du BL.</div>
  <div class="toolbar"><button class="btn btn-p" onclick="saveReceptionGroupee()">📥 Valider la réception → Réserve + BL unique</button><button class="btn btn-g" onclick="closeModal()">Annuler</button></div>`);
  rgRefresh();
}
function rgRefresh(){
  const f=$("#rg_f").value; const arts=S.produits.filter(p=>p.fournisseur===f);
  $("#rg_list").innerHTML=`<table><tr><th></th><th>Article</th><th>Qté</th><th>P.Achat</th><th>Lot</th><th>DLC</th></tr>${arts.map(p=>{const dv=normaliserDLC(p.dlc||"");const vv=(dv&&dv.length===10&&dv[4]==="-"&&dv[7]==="-")?dv:"";return `<tr><td><input type="checkbox" id="rg_${p.sku}" checked></td><td><b>${esc(p.nom)}</b><br><span class="small">${p.sku} • R ${fmtQ(p.stockReserve)} • achat ${fmtN(p.achat)}</span></td><td><input type="number" step="0.001" id="rgq_${p.sku}" value="${p.qteReappro||10}" style="width:70px"></td><td><input type="number" id="rgp_${p.sku}" value="${p.achat}" style="width:80px"></td><td><input id="rgl_${p.sku}" value="${esc(p.lot||"")}" style="width:70px" placeholder="Lot"></td><td><input id="rgd_${p.sku}" type="date" value="${vv}" style="width:125px"></td></tr>`;}).join("")||"<tr><td colspan=6>Aucun article pour ce fournisseur.</td></tr>"}</table>`;
}
function saveReceptionGroupee(){
  if(licenceExpiree()){ render(); return alert("🔒 Démo expirée : réception bloquée. Activez la licence FULL."); }
  const f=$("#rg_f").value, blN=$("#rg_bl").value||("BL-F-"+todayStr());
  const lignes=S.produits.filter(p=>p.fournisseur===f&&$("#rg_"+p.sku)&&$("#rg_"+p.sku).checked).map(p=>({sku:p.sku,nom:p.nom,qte:+($("#rgq_"+p.sku).value||0),lot:($("#rgl_"+p.sku)?.value||"").trim(),dlc:($("#rgd_"+p.sku)?.value||"")}));
  const okL=lignes.filter(l=>l.qte>0);
  if(!okL.length) return alert("Aucune quantité saisie.");
  okL.forEach(l=>{ const p=S.produits.find(x=>x.sku===l.sku); const elP=document.getElementById("rgp_"+p.sku); const newA=elP?+elP.value||p.achat:p.achat; if(newA!==p.achat){ trackPrix(p,newA,p.vente,`BL ${blN} — nouveau tarif fournisseur`); addMouvement("PRIX",p.sku,0,`Prix achat ${fmtN(p.achat)}→${fmtN(newA)} (BL ${blN})`,"Prix",agent(),f); p.achat=newA; } p.stockReserve+=l.qte; syncStock(p); const dlcN=l.dlc?normaliserDLC(l.dlc):(p.dlc||""); upsertLot({sku:l.sku,lot:l.lot||"",dlc:dlcN,fournisseur:f,prixAchat:p.achat,qte:l.qte,blId:blN}); syncProduitDLC(l.sku); addMouvement("RECEPTION",p.sku,l.qte,`Réception groupée ${blN} @ ${fmtN(p.achat)}`+(l.lot?` • lot ${l.lot}`:"")+(dlcN?` • DLC ${dlcN}`:""),"BL",f,LOC_RESERVE); });
  const id="BL"+String(S.seq.bl++).padStart(4,"0");
  S.bls.unshift({id,date:todayStr(),heure:nowHM(),fournisseur:f,bcId:blN,agent:agent(),lignes:okL,statut:"Réserve"});
  const bc=S.bcs.find(b=>b.fournisseur===f&&(b.statut==="Validé"||b.statut==="Brouillon")); if(bc){ bc.statut="Réceptionné"; }
  save(); closeModal(); printBL(id); renderStocks();
}
function doEntree(){
  if(licenceExpiree()){ render(); return alert("🔒 Démo expirée : entrée bloquée. Activez la licence FULL."); }
  const sku=$("#mv_sku").value, q=+($("#mv_qte").value||0), type=$("#mv_type").value, motif=$("#mv_motif").value, lot=$("#mv_lot").value;
  const p=S.produits.find(x=>x.sku===sku); if(!q||q<=0) return alert("Quantité invalide.");
  if(p.rayon==="01"&&!lot) return alert("Lot + DLC obligatoires pour le Frais (traçabilité).");
  const newPxEl=$("#mv_prix"); const newPx=newPxEl&&newPxEl.value!==""?+newPxEl.value:p.achat;
  if(newPx!==p.achat){ trackPrix(p,newPx,p.vente,"BL "+(motif||"manuel")+" — tarif variable"); addMouvement("PRIX",p.sku,0,`Prix achat ${fmtN(p.achat)}→${fmtN(newPx)} (réception)`,"Prix",agent(),p.fournisseur||"Fournisseur"); p.achat=newPx; }
  p.stockReserve+=q; if(lot) p.lot=lot; syncStock(p);
  addMouvement(type,sku,q,(motif||type)+(lot?" • "+lot:""),"BL",p.fournisseur||"Fournisseur",LOC_RESERVE);
  const id="BL"+String(S.seq.bl++).padStart(4,"0");
  S.bls.unshift({id,date:todayStr(),heure:nowHM(),fournisseur:p.fournisseur||"—",bcId:motif||"—",agent:agent(),lignes:[{sku,nom:p.nom,qte:q,lot}],statut:"Réserve"});
  const bc=S.bcs.find(b=>b.fournisseur===(p.fournisseur||"—")&&(b.statut==="Validé"||b.statut==="Brouillon")); if(bc){ bc.statut="Réceptionné"; }
  save();
  printBL(id); renderStocks();
}
function printBL(id){ const b=S.bls.find(x=>x.id===id); if(!b) return;
  printHTML(`<div class="ticket"><center><b>${esc(S.params.magasin)}</b><br>*** BON DE LIVRAISON ${b.id} ***<br>${b.date} ${b.heure||""}<br>Fournisseur : ${esc(b.fournisseur)}<br>BC : ${esc(b.bcId)} • Agent : ${esc(b.agent)}</center><hr>${b.lignes.map(l=>`${esc(l.nom)}<br>Qté : <b>${fmtQ(l.qte)}</b> ${l.lot?"• lot "+esc(l.lot):""} ${l.dlc?"• DLC "+esc(l.dlc):""} ${l.pu?"• @ "+fmtN(l.pu):""}`).join("<br>")}<hr>Localisation : <b>${LOC_RESERVE}</b> (puis transfert FEFO vers rayons)<br><center>Visa quai : ______ • Visa réserve : ______</center></div>`); }
function doTransfert(){
  const sku=$("#mv_sku").value, q=+($("#tr_qte").value||0), dst=$("#tr_dst").value;
  const p=S.produits.find(x=>x.sku===sku); if(!q||q<=0) return alert("Quantité invalide.");
  if(q>(p.stockReserve||0)) return alert(`Réserve insuffisante (${fmtQ(p.stockReserve)} dispo).`);
  const moved=moveLotReserveToRayon(sku,q);
  p.stockReserve-=q; p.stockRayon+=q; syncStock(p);
  addMouvement("TRANSFERT",sku,q,`Transfert FEFO vers ${dst} — lots les plus proches d'abord (${fmtQ(moved)} via lots)`,"Interne",LOC_RESERVE,dst); save(); renderStocks();
}
function doTransfertRayon(){
  const sku=$("#mv_sku").value, q=+($("#tr_qte2").value||0), src=$("#tr_src").value, dst=$("#tr_dst2").value, motif=$("#tr_motif2").value.trim();
  if(!q||q<=0) return alert("Quantité invalide."); if(src===dst) return alert("Source et destination identiques."); if(!motif) return alert("Motif obligatoire pour un transfert Rayon → Rayon.");
  const p=S.produits.find(x=>x.sku===sku);
  addMouvement("TRANSFERT",sku,q,`Rayon → Rayon : ${src} → ${dst} — Motif : ${motif}`,"Interne",src,dst); save(); renderStocks();
  alert(`🔀 ${fmtQ(q)} × ${p.nom} : ${src} → ${dst}\nMotif : ${motif} (total rayon inchangé, traçabilité assurée).`);
}
/* Assistant FEFO : la réserve sort en priorité les DLC les plus proches */
function modalFIFO(){
  const list=S.produits.filter(p=>(p.stockReserve||0)>0).sort((a,b)=>dlcJours(a.dlc)-dlcJours(b.dlc));
  if(!list.length) return alert("Réserve vide.");
  openModal(`<h3>⏩ Assistant FEFO — Réserve → Rayon (DLC les plus proches d'abord)</h3><div class="small">Agent : <b>${esc(agent())}</b> • Règle FEFO : les lots dont la DLC est la plus proche sortent en premier vers le rayon.</div>
  <div style="max-height:50vh;overflow:auto"><table><tr><th>#</th><th>Article (DLC)</th><th>Réserve</th><th>Qté →</th><th>Rayon dest.</th></tr>
  ${list.slice(0,40).map((p,i)=>`<tr><td>${i+1}</td><td><b>${esc(p.nom)}</b><br><span class="small">DLC ${esc(p.dlc)} ${dlcJours(p.dlc)<=7?"⚠️":""}</span></td><td><b>${fmtQ(p.stockReserve)}</b></td><td><input type="number" step="0.001" id="ff_${p.sku}" value="0" style="width:90px"></td><td><select id="ffd_${p.sku}">${RAYON_LOCS().map(r=>`<option ${r===rayonNom(p.rayon)?"selected":""}>${esc(r)}</option>`).join("")}</select></td></tr>`).join("")}</table></div>
  <div class="toolbar"><button class="btn btn-p" onclick="doFIFO()">⏩ Exécuter les transferts FIFO</button><button class="btn btn-g" onclick="closeModal()">Fermer</button></div>`);
}
function doFIFO(){
  let n=0; S.produits.filter(p=>(p.stockReserve||0)>0).forEach(p=>{ const el=document.getElementById("ff_"+p.sku); if(!el) return; const q=+el.value||0; if(q<=0) return; if(q>(p.stockReserve||0)) return alert(`Réserve insuffisante : ${p.nom}`); const dst=document.getElementById("ffd_"+p.sku).value; moveLotReserveToRayon(p.sku,q); p.stockReserve-=q; p.stockRayon+=q; syncStock(p); addMouvement("TRANSFERT",p.sku,q,"Transfert FIFO vers "+dst+" (FEFO par DLC)","Interne",LOC_RESERVE,dst); n++; });
  save(); closeModal(); renderStocks(); alert(n?`⏩ ${n} transfert(s) FIFO exécuté(s).`:`Aucune quantité saisie.`);
}
/* Erreur réception : demande (magasinier) → validation (gérant) */
function askDelBL(id){
  if(!isMagasinier()&&!isAdmin()) return alert("⛔ Demande réservée au MAGASINIER (ou Admin/Gérant). Votre poste : "+((me()||{}).poste||"—"));
  const motif=prompt(`Demander la suppression du BL ${id} (erreur de réception) ?\nMotif obligatoire :`,"Quantités non conformes au quai"); if(!motif) return;
  S.delRequests.unshift({id:uid("DEL"), refId:id, motif, demandePar:agent(), date:todayStr()+" "+nowHM(), statut:"En attente"}); save(); renderStocks(); alert("Demande envoyée au gérant pour validation.");
}
function validDelBL(did,ok){
  if(!isGerant()) return alert("⛔ Validation réservée au GÉRANT (pas l'admin)." );
  const d=S.delRequests.find(x=>x.id===did); if(!d||d.statut!=="En attente") return;
  if(!ok){ d.statut="Refusée"; save(); renderStocks(); return; }
  const b=S.bls.find(x=>x.id===d.refId);
  if(b&&b.statut!=="Supprimé"){ b.lignes.forEach(l=>{ const p=S.produits.find(x=>x.sku===l.sku); if(p){ const r=Math.min(l.qte,p.stockReserve||0); p.stockReserve-=r; const rest=l.qte-r; if(rest>0) p.stockRayon=Math.max(0,(p.stockRayon||0)-rest); syncStock(p); /* Retire aussi les lots du BL */ try{(S.lots||[]).filter(x=>x.sku===l.sku&&(x.blId===b.id||x.blId===b.bcId||x.blId===b.blFournisseur)).sort((a,c)=>((Number(c.qteReserve||0)+Number(c.qteRayon||0))-((Number(a.qteReserve||0)+Number(a.qteRayon||0))))).forEach(x=>{ let rem=l.qte; const tr=Math.min(rem,Number(x.qteReserve||0)); x.qteReserve-=tr; rem-=tr; const tr2=Math.min(rem,Number(x.qteRayon||0)); x.qteRayon-=tr2; }); S.lots=(S.lots||[]).filter(x=>((Number(x.qteReserve||0)+Number(x.qteRayon||0))>0)||!x.blId); syncProduitDLC(l.sku);}catch(e){} addMouvement("RETOUR",p.sku,-l.qte,"Annulation BL "+b.id+" validée ("+d.motif+")",b.id,LOC_RESERVE,"Fournisseur"); } }); b.statut="Supprimé"; }
  d.statut="Validée"; save(); renderStocks(); alert("BL "+d.refId+" supprimé et stocks réintégrés (validation gérant).");
}
function doDemarqueConnue(){
  const sku=$("#dm_sku").value, q=Number($("#dm_qte").value||0), motif=$("#dm_motif").value, c=$("#dm_c").value;
  const p=S.produits.find(x=>x.sku===sku); if(!p) return alert("Article introuvable.");
  if(!Number.isFinite(q)||q<=0) return alert("Quantité invalide.");
  if(motif==="Péremption (DLC/DLUO)") return openDLCMark(sku,q);
  const dispo=(p.stockRayon||0)+(p.stockReserve||0); if(q>dispo) return alert("Stock insuffisant.");
  /* Sortie FEFO par lots : casse/vol/dons retirent les DLC les plus proches d'abord, au prix réel. */
  let r=q, val=0; const det=[];
  const pool=lotsSKU(sku).filter(l=>((Number(l.qteRayon||0)+Number(l.qteReserve||0))>0));
  for(const l of pool){ if(r<=0) break; let take=Math.min(r,Number(l.qteRayon||0)); if(take>0){ l.qteRayon-=take; r-=take; val+=take*Number(l.prixAchat||0); det.push(`${l.lot||"—"} ${l.dlc||""} x${fmtQ(take)}`); continue; } take=Math.min(r,Number(l.qteReserve||0)); if(take>0){ l.qteReserve-=take; r-=take; val+=take*Number(l.prixAchat||0); det.push(`${l.lot||"—"} ${l.dlc||""} x${fmtQ(take)} (réserve)`); } }
  if(r>0.0001){ const pp=S.produits.find(x=>x.sku===sku); val+=r*Number(pp?pp.achat:0); }
  const fromRayon=Math.min(q,Number(p.stockRayon||0)); p.stockRayon=Number(p.stockRayon||0)-fromRayon; p.stockReserve=Math.max(0,Number(p.stockReserve||0)-(q-fromRayon)); syncStock(p); syncProduitDLC(sku);
  S.demarques.unshift({id:uid("DM"),date:todayStr(),article:p.nom,sku,qte:q,valeurAchat:Math.round(val),famille:"Connue",motif,comment:(c?c+" | ":"")+det.join(" | "),agent:agent()});
  addMouvement("DEMARQUE_CONNUE",sku,-q,motif+(c?" — "+c:""),"Démarque","Rayon","Perte"); save(); alert(`Démarque connue enregistrée : -${fmtQ(q)} • Perte ${fmtN(val)} (prix d'achat HT).`); renderStocks();
}
function dlcStage(j){ if(j<0||j>20) return null; if(j<=1) return 1; if(j<=5) return 5; if(j<=10) return 10; return 20; }
/* ============ LOTS multi-DLC / multi-fournisseurs (FEFO + marge au lot) ============ */
function parseLotDLC(txt){ const s=String(txt||"").trim(); if(!s) return {lot:"",dlc:""}; const parts=s.split(/[|;/]+/).map(x=>x.trim()).filter(Boolean);
  let lot="",dlc=""; parts.forEach(pt=>{ const n=normaliserDLC(pt); if(/^\d{4}-\d{2}-\d{2}$/.test(n)) dlc=n; else if(/^\+\d+\s*j$/i.test(pt)) dlc=n; else if(!lot) lot=pt; });
  if(!dlc&&parts.length===1){ const n=normaliserDLC(parts[0]); if(/^\d{4}-\d{2}-\d{2}$/.test(n)) dlc=n; else lot=parts[0]; } return {lot,dlc}; }
function lotsSKU(sku){ return (S.lots||[]).filter(l=>l.sku===sku&&(Number(l.qteReserve||0)+Number(l.qteRayon||0))>0).sort((a,b)=>dlcJours(a.dlc)-dlcJours(b.dlc)); }
function lotStockReserve(l){ return Number(l.qteReserve||0); }
function lotStockRayon(l){ return Number(l.qteRayon||0); }
function upsertLot(o){ S.lots=S.lots||[]; const dlc=normaliserDLC(o.dlc||"")||""; const lot=String(o.lot||"").trim();
  let f=S.lots.find(x=>x.sku===o.sku&&String(x.lot||"")===lot&&String(x.dlc||"")===dlc&&String(x.fournisseur||"")===String(o.fournisseur||""));
  if(!f){ f={id:uid("LOT"),sku:o.sku,lot,dlc,fournisseur:o.fournisseur||"",qteReserve:0,qteRayon:0,prixAchat:Number(o.prixAchat)||0,dateEntree:todayStr(),heure:nowHM(),blId:o.blId||""}; S.lots.unshift(f); }
  if(o.prixAchat>0) f.prixAchat=Number(o.prixAchat);
  if(o.blId&&!f.blId) f.blId=o.blId;
  if(o.versRayon) f.qteRayon=Number(f.qteRayon||0)+Number(o.qte||0); else f.qteReserve=Number(f.qteReserve||0)+Number(o.qte||0);
  syncProduitDLC(o.sku); return f; }
function syncProduitDLC(sku){ const p=S.produits.find(x=>x.sku===sku); if(!p) return; const ls=lotsSKU(sku);
  if(ls.length){ p.dlc=ls[0].dlc||p.dlc; p.lot=ls[0].lot||p.lot; if(!p.fournisseur&&ls[0].fournisseur) p.fournisseur=ls[0].fournisseur; } }
function moveLotReserveToRayon(sku,qte){ let r=Number(qte||0); const ls=lotsSKU(sku).filter(l=>lotStockReserve(l)>0); for(const l of ls){ if(r<=0) break; const m=Math.min(r,lotStockReserve(l)); l.qteReserve-=m; l.qteRayon=(Number(l.qteRayon||0))+m; r-=m; } return Number(qte||0)-r; }
function consumeLotRayon(sku,qte,lotId){ let r=Number(qte||0); const conso=[]; let pool=lotsSKU(sku).filter(l=>lotStockRayon(l)>0);
  if(lotId){ pool=pool.sort((a,b)=>(a.id===lotId?-1:0)-(b.id===lotId?-1:0)); }
  for(const l of pool){ if(r<=0) break; const m=Math.min(r,lotStockRayon(l)); l.qteRayon-=m; r-=m; conso.push({lotId:l.id,lot:l.lot,dlc:l.dlc,qte:m,prixAchat:Number(l.prixAchat)||0}); }
  const manque=r; return {conso,manque,cout:conso.reduce((a,c)=>a+c.qte*c.prixAchat,0)}; }
function restoreLotRayon(sku,detail){ (detail||[]).forEach(c=>{ const l=(S.lots||[]).find(x=>x.id===c.lotId); if(l) l.qteRayon=Number(l.qteRayon||0)+Number(c.qte||0); }); syncProduitDLC(sku); }
function valeurStockLots(){ if(!(S.lots||[]).length) return null; return S.lots.reduce((a,l)=>a+(Number(l.qteReserve||0)+Number(l.qteRayon||0))*Number(l.prixAchat||0),0); }
function dlcMarksSKU(sku){ return (S.dlcMarks||[]).filter(m=>m.sku===sku&&m.statut==="Active"&&Number(m.qteRestante)>0); }
function dlcReserveSKU(sku){ return dlcMarksSKU(sku).reduce((a,m)=>a+Number(m.qteRestante||0),0); }
function openDLCMark(sku,qteDef=1){
  if(!isAdmin()) return alert("La démarque commerciale DLC est réservée au Gérant/Admin.");
  const p=S.produits.find(x=>x.sku===sku); if(!p) return alert("Article introuvable.");
  const dispo=Math.max(0,Number(p.stockRayon||0)-dlcReserveSKU(sku));
  if(dispo<=0) return alert("Aucune unité non déjà démarquée en rayon. Transférez d'abord les produits depuis la réserve, si nécessaire.");
  const date=normaliserDLC(p.dlc), dateValue=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:"";
  openModal(`<h3>🏷 Démarque commerciale DLC — ${esc(p.nom)}</h3>
    <div class="alert a-yel">Cette action ne retire pas les unités du stock. Le tarif réduit ne s'appliquera qu'à la quantité marquée et vendue depuis le bouton DLC en caisse.</div>
    <div class="row2"><div><label>Lot</label><input id="dlcm_lot" value="${esc(p.lot||"")}" placeholder="N° du lot"></div><div><label>Date de péremption réelle</label><input id="dlcm_date" type="date" value="${dateValue}" onchange="updateDLCStage()"></div></div>
    <div id="dlcm_stage" class="small">Saisissez la date pour déterminer le palier J-20 / J-10 / J-5 / J-1.</div>
    <div class="row2"><div><label>Quantité à marquer (rayon disponible : ${fmtQ(dispo)})</label><input id="dlcm_qte" type="number" step="0.001" min="0.001" max="${dispo}" value="${Math.min(dispo,Number(qteDef)||1)}"></div><div><label>Réduction choisie par le gérant (%) — obligatoire 1 à 99</label><input id="dlcm_pct" type="number" min="1" max="99" value="${(S.promoDLC&&S.promoDLC.remise)||30}"></div></div>
    <div class="toolbar"><button class="btn btn-p" onclick="saveDLCMark('${p.sku}')">✅ Marquer cette quantité au prix réduit</button><button class="btn btn-g" onclick="closeModal()">Annuler</button></div>`);
  updateDLCStage();
}
function updateDLCStage(){
  const dlc=$("#dlcm_date"), box=$("#dlcm_stage"); if(!dlc||!box) return;
  if(!dlc.value){ box.className="small"; box.textContent="Saisissez la date pour déterminer le palier J-20 / J-10 / J-5 / J-1."; return; }
  const days=dlcJours(dlc.value), stage=dlcStage(days);
  box.className=days<0?"alert a-red":stage?"alert a-yel":"alert a-green";
  box.textContent=days<0?`⛔ Date dépassée de ${Math.abs(days)} jour(s) : ne pas remettre en vente.`:stage?`📅 DLC dans ${days} jour(s) — palier de démarque J-${stage}.`:`✅ DLC dans ${days} jour(s) — pas encore au seuil J-20.`;
}
async function saveDLCMark(sku){
  if(!isAdmin()) return alert("La démarque DLC est réservée au Gérant/Admin.");
  const p=S.produits.find(x=>x.sku===sku); if(!p) return alert("Article introuvable.");
  const dlc=$("#dlcm_date").value, days=dlcJours(dlc), stage=dlcStage(days), q=Number($("#dlcm_qte").value), pct=Number($("#dlcm_pct").value), lot=$("#dlcm_lot").value.trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dlc)) return alert("Saisissez une date de péremption valide.");
  if(days<0) return alert("Cette DLC est déjà dépassée : la vente de ce lot doit être bloquée.");
  if(!stage) return alert("La démarque commerciale est proposée à partir du palier J-20.");
  if(!Number.isFinite(q)||q<=0||!Number.isFinite(pct)||pct<=0||pct>=100) return alert("Saisissez une quantité positive et une réduction entre 1 % et 99 %.");
  const dispo=Math.max(0,Number(p.stockRayon||0)-dlcReserveSKU(sku)); if(q>dispo) return alert(`Quantité supérieure au stock non marqué en rayon (${fmtQ(dispo)}).`);
  const prixBase=Number(promoPrix(p).prix)||Number(p.vente)||0, prixDLC=Math.max(0,Math.round(prixBase*(1-pct/100))), id=uid("DLC"), demarqueId=uid("DM");
  /* Lie la démarque à un vrai lot : même lot+DLC en rayon, sinon le plus proche. */
  S.lots=S.lots||[]; let lotRef=(S.lots||[]).filter(x=>x.sku===sku&&Number(x.qteRayon)>0).sort((a,b)=>dlcJours(a.dlc)-dlcJours(b.dlc)).find(x=>String(x.lot||"")===lot&&String(x.dlc||"")===dlc)||(S.lots||[]).filter(x=>x.sku===sku&&Number(x.qteRayon)>0).sort((a,b)=>dlcJours(a.dlc)-dlcJours(b.dlc))[0];
  if(!lotRef&&Number(p.stockRayon||0)>0){ lotRef=upsertLot({sku,lot:lot||p.lot||"",dlc:dlc||p.dlc||"",fournisseur:p.fournisseur||"",prixAchat:Number(p.achat||0),qte:0}); lotRef.qteRayon=Number(p.stockRayon||0); }
  const mark={id,demarqueId,sku,nom:p.nom,lot,dlc,joursAuMarquage:days,palier:stage,qteInitiale:q,qteRestante:q,qteVendue:0,remisePct:pct,prixBase,prixDLC,lotId:lotRef?lotRef.id:"",date:todayStr(),heure:nowHM(),agent:agent(),statut:"Active"};
  S.dlcMarks=S.dlcMarks||[]; S.dlcMarks.unshift(mark);
  S.demarques=S.demarques||[]; S.demarques.unshift({id:demarqueId,dlcMarkId:id,date:todayStr(),article:p.nom,sku,qte:q,qteVendue:0,qteRestante:q,valeurAchat:0,valeurRemisePotentielle:(prixBase-prixDLC)*q,prixBase,prixDLC,remisePct:pct,palier:stage,lot,dlc,famille:"DLC commerciale",motif:`DLC J-${stage} — remise ${pct}%`,comment:`Lot ${lot||"—"} • DLC ${dlc} • ${fmtN(prixBase)} → ${fmtN(prixDLC)} TTC`,agent:agent(),statut:"Active"});
  addMouvement("DEMARQUE_DLC",sku,0,`Lot ${lot||"—"} • DLC ${dlc} • ${fmtQ(q)} u • J-${stage} • -${pct}% (${fmtN(prixDLC)} TTC)` ,id,"Rayon","Caisse");
  save();
  closeModal(); if(current==="stocks") renderStocks(); else if(current==="dashboard") renderDash(); else renderPOSTiles();
  alert(`✅ Démarque DLC activée : ${fmtQ(q)} × ${p.nom} à ${fmtN(prixDLC)} TTC (${pct}% de remise, palier J-${stage}). Les autres unités gardent leur prix normal.`);
  if(typeof SYNC!=="undefined"&&SYNC.on){ try{SYNC.push(true).then(()=>SYNC.pullForce()).catch(()=>{});}catch(e){} }
}
function annulerDLCMark(id){
  if(!isAdmin()) return alert("Annulation de démarque réservée au Gérant/Admin.");
  const m=(S.dlcMarks||[]).find(x=>x.id===id&&x.statut==="Active"&&Number(x.qteRestante)>0); if(!m) return alert("Démarque inactive ou introuvable.");
  const restant=Number(m.qteRestante)||0; if(!confirm(`Annuler le solde restant de ${fmtQ(restant)} unité(s) ? Le stock reste en rayon et redevient vendable au prix normal.`)) return;
  m.statut="Annulée"; const dm=(S.demarques||[]).find(x=>x.dlcMarkId===id); if(dm){dm.statut="Annulée";dm.qteRestante=0;}
  addMouvement("ANNULATION_DEMARQUE_DLC",m.sku,0,`DLC ${m.dlc} • solde ${fmtQ(restant)} remis au prix normal`,id,"Caisse","Rayon"); save(); renderStocks();
}
/* --- Sous-onglet 3 : inventaires + démarques --- */
function stInv(){
  const marksActifs=(S.dlcMarks||[]).filter(m=>m.statut==="Active"&&Number(m.qteRestante)>0);
  $("#stockBody").innerHTML=`
  <div class="grid g2">
    <div class="card"><h3>📋 Inventaire tournant — le périmètre liste les articles un à un (système vs compté)</h3>
      <div class="row2"><div><label>Périmètre (rayon / catégorie)</label><select id="inv_per"><option value="">Magasin entier</option>${REFERENTIEL.map(r=>`<option value="${r.code}">${r.icone} ${r.nom}</option>`).join("")}</select></div>
      <div><label>Fréquence</label><select id="inv_freq"><option>Journalier</option><option>Hebdomadaire</option><option>Mensuel</option><option>Annuel</option></select></div></div>
      <div class="toolbar"><button class="btn btn-p btn-s" onclick="startInventaire()">▶ Démarrer le comptage</button></div>
      <div class="small">Ex : rayon Boissons le lundi matin sans bloquer le magasin. Chaque ligne affiche la quantité système ; l'agent saisit la quantité comptée. Les écarts créent automatiquement des <b>démarques inconnues</b> valorisées à l'achat HT.</div>
      <hr><h3>Sessions (${S.inventaires.length})</h3>
      ${S.inventaires.slice(0,5).map(i=>`<div class="alert ${i.ecartVal===0?"a-green":"a-yel"}"><b>${i.id}</b> — ${esc(i.perimetre)} (${esc(i.freq)}) le ${i.date} par ${esc(i.agent)} • ${i.lignes.length} lignes • Écart <b>${fmtN(i.ecartVal)}</b> <button class="btn btn-p btn-s" onclick="printInvPV('${i.id}')">🖨 PV PDF (A4)</button></div>`).join("")||"<span class='small'>Aucune session.</span>"}</div>
    <div class="card"><h3>🏷 Démarques & DLC — comptabilité + unités réservées</h3>
      <div class="toolbar"><button class="btn btn-g btn-s" onclick="exportDemarques()">⬇ Export démarques</button></div>
      <div class="small"><b>Perte connue</b> = casse, vol, dons, autoconsommation. <b>Perte inconnue</b> = écart inventaire. <b>DLC commerciale</b> = les unités restent en stock et se vendent au prix marqué uniquement.</div>
      <hr><b>Démarques DLC actives (${marksActifs.length})</b>
      ${marksActifs.map(m=>`<div class="alert a-yel"><b>${esc(m.nom)}</b> • lot ${esc(m.lot||"—")} • DLC ${esc(m.dlc)} • J-${m.palier} • -${m.remisePct}% • ${fmtQ(m.qteRestante)} restante(s) à ${fmtN(m.prixDLC)} <span class="small">(marqué par ${esc(m.agent)})</span> ${isAdmin()?`<button class="btn btn-g btn-s" onclick="annulerDLCMark('${m.id}')">Annuler solde</button>`:""}</div>`).join("")||"<div class='small'>Aucune démarque DLC active.</div>"}
      <hr><b>Historique des démarques</b>
      <div style="max-height:360px;overflow:auto;margin-top:8px">${S.demarques.slice(0,30).map(d=>`<div class="alert ${d.famille==="Connue"?"a-yel":d.famille==="DLC commerciale"?"a-green":"a-red"}"><b>${esc(d.article)}</b> — ${d.famille==="DLC commerciale"?`vendu ${fmtQ(d.qteVendue||0)} / ${fmtQ(d.qte)} • reste ${fmtQ(d.qteRestante)} • remise potentielle ${fmtN(d.valeurRemisePotentielle||0)}`:`−${fmtQ(d.qte)} • perte ${fmtN(d.valeurAchat||0)}`} • <span class="badge ${d.famille==="Inconnue"?"b-bad":"b-warn"}">${esc(d.famille)}</span> ${esc(d.motif)} • ${esc(d.agent||"")} <span class="small">${d.date} ${esc(d.comment||"")}</span></div>`).join("")||"<span class='small'>Aucune démarque.</span>"}</div></div>
  </div>`;
}
function startInventaire(){
  const per=$("#inv_per").value, freq=$("#inv_freq").value;
  const arts=S.produits.filter(p=>!per||p.rayon===per);
  if(!arts.length) return alert("Aucun article dans ce périmètre.");
  openModal(`<h3>📋 Comptage — ${per?rayonNom(per):"Magasin entier"} (${freq}) • ${arts.length} articles un à un</h3>
  <div class="small">Agent : <b>${esc(agent())}</b> • <b>Réserve et Rayon séparés</b> : le système rappelle les 2 quantités, vous comptez les 2 cases. Le PV détaillé s'imprime auto après validation.</div>
  <div style="max-height:55vh;overflow:auto;margin-top:8px"><table><tr><th>#</th><th>Article</th><th>Syst. Réserve</th><th>Compté Réserve</th><th>Syst. Rayon</th><th>Compté Rayon</th></tr>
  ${arts.map((p,i)=>`<tr><td>${i+1}</td><td><b>${esc(p.nom)}</b><br><span class="small">${p.sku}</span></td><td><b>${fmtQ(p.stockReserve)}</b></td><td><input type="number" step="0.001" id="cptR_${p.sku}" value="${p.stockReserve}" style="width:95px"></td><td><b>${fmtQ(p.stockRayon)}</b></td><td><input type="number" step="0.001" id="cptM_${p.sku}" value="${p.stockRayon}" style="width:95px"></td></tr>`).join("")}</table></div>
  <div class="toolbar"><button class="btn btn-p" onclick="validInventaire('${per}','${freq}')">✅ Valider + démarques inconnues + PV détaillé auto</button><button class="btn btn-g" onclick="closeModal()">Annuler</button></div>`);
}
function validInventaire(per,freq){
  const arts=S.produits.filter(p=>!per||p.rayon===per);
  const lignes=[]; let ecartVal=0;
  const motif=prompt("Cause probable des écarts (démarque INCONNUE) ?\n1 Vol invisible\n2 Erreur de réception\n3 Erreur d'encaissement\n4 Coulage / perte de poids\nTapez le motif :","Coulage / perte de poids (chaleur)");
  if(motif==null) return;
  arts.forEach(p=>{ const elR=document.getElementById("cptR_"+p.sku), elM=document.getElementById("cptM_"+p.sku); if(!elR||!elM) return;
    const cR=+elR.value||0, cM=+elM.value||0; const oldR=p.stockReserve||0, oldM=p.stockRayon||0; const eR=cR-oldR, eM=cM-oldM; const ecart=eR+eM;
    if(ecart!==0){ const val=Math.abs(ecart)*p.achat; ecartVal+=ecart<0?-val:0;
      S.demarques.unshift({id:uid("DM"),date:todayStr(),article:p.nom,sku:p.sku,qte:Math.abs(ecart),valeurAchat:ecart<0?val:0,famille:"Inconnue",motif:motif||"Écart inventaire",comment:`Réserve ${fmtQ(p.stockReserve)}→${fmtQ(cR)} • Rayon ${fmtQ(p.stockRayon)}→${fmtQ(cM)}`,agent:agent()});
      if(eR!==0) addMouvement("INVENTAIRE",p.sku,eR,`Ajustement inventaire Réserve (${freq}) : ${motif}`,"INV","Système","Réserve");
      if(eM!==0) addMouvement("INVENTAIRE",p.sku,eM,`Ajustement inventaire Rayon (${freq}) : ${motif}`,"INV","Système","Rayon");
      p.stockReserve=cR; p.stockRayon=cM; syncStock(p);
    }
    lignes.push({sku:p.sku,nom:p.nom,theo:oldR+oldM,compte:cR+cM,ecart,theoR:oldR,compteR:cR,theoM:oldM,compteM:cM}); });
  const id="INV"+String(S.seq.inv++).padStart(4,"0");
  S.inventaires.unshift({id,date:todayStr(),heure:nowHM(),perimetre:per?rayonNom(per):"Magasin entier",freq,agent:agent(),lignes,ecartVal});
  save(); closeModal(); renderStocks();
  printInvPV(id);
  alert(`Inventaire ${id} validé : ${lignes.filter(l=>l.ecart!==0).length} écarts • Perte ${fmtN(Math.abs(ecartVal))} • PV détaillé envoyé à l'impression.`);
}
function printInv(id){ const i=S.inventaires.find(x=>x.id===id); if(!i) return;
  printHTML(`<div class="ticket"><center><b>${esc(S.params.magasin)}</b><br>*** PV INVENTAIRE ${i.id} ***<br>${i.date} • ${esc(i.perimetre)} (${esc(i.freq)})<br>Agent : ${esc(i.agent)}</center><hr>${i.lignes.filter(l=>l.ecart!==0).map(l=>`${esc(l.nom)}<br>Théo ${fmtQ(l.theo)} → Compté ${fmtQ(l.compte)} = <b>${fmtQ(l.ecart)}</b>`).join("<br>")||"Aucun écart ✅"}<hr>Valorisation perte : <b>${fmtN(Math.abs(i.ecartVal))}</b><center>Visa : ______</center></div>`); }
function exportDemarques(){ csvExport(`demarques_${todayStr()}.csv`,["ID","Date","Article","SKU","Qte","ValeurAchat","Famille","Motif","Agent","Comment","QteVendue","QteRestante","RemisePct","PrixBase","PrixDLC","Lot","DLC"],S.demarques.map(d=>[d.id,d.date,d.article,d.sku,d.qte,d.valeurAchat,d.famille,d.motif,d.agent,d.comment||"",d.qteVendue||0,d.qteRestante??"",d.remisePct||"",d.prixBase||"",d.prixDLC||"",d.lot||"",d.dlc||""])); }
function stKpi(){
  const ca30=S.ventes.filter(v=>{const d=new Date(v.date),n=new Date();n.setDate(n.getDate()-30);return d>=n&&v.statut!=="Annulé";}).reduce((a,v)=>a+v.total,0);
  const lotsV=valeurStockLots();
  const stockVal=lotsV!=null?lotsV:S.produits.reduce((a,p)=>a+p.stock*p.achat,0);
  const qVendues30={}; S.ventes.forEach(v=>{const d=new Date(v.date),n=new Date();n.setDate(n.getDate()-30); if(d>=n&&v.statut!=="Annulé") v.lignes.forEach(l=>qVendues30[l.sku]=(qVendues30[l.sku]||0)+l.qte);});
  const rows=S.produits.map(p=>{ const qm=(qVendues30[p.sku]||0)/30; const rot=(p.stock?(qVendues30[p.sku]||0)/p.stock:0); const couv=qm>0?p.stock/qm:999; return {p,rot,couv,qm}; }).sort((a,b)=>a.rot-b.rot);
  const demVal=S.demarques.reduce((a,d)=>a+(d.valeurAchat||0),0);
  const txDem=ca30?demVal/ca30*100:0;
  const perim=(S.lots||[]).filter(l=>((Number(l.qteReserve||0)+Number(l.qteRayon||0))>0)&&dlcJours(l.dlc)>=0&&dlcJours(l.dlc)<=3);
  const perimes=(S.lots||[]).filter(l=>((Number(l.qteReserve||0)+Number(l.qteRayon||0))>0)&&dlcJours(l.dlc)<0);
  $("#stockBody").innerHTML=`
  <div class="grid g4">
    <div class="kpi" style="--c:#2563eb"><div class="lbl">Taux de démarque</div><div class="val">${txDem.toFixed(2)}%</div><div class="hint">Objectif &lt; 2% • Perte ${fmtN(demVal)} / CA30j ${fmtN(ca30)}</div></div>
    <div class="kpi" style="--c:#dc2626"><div class="lbl">DLC ≤ 3j</div><div class="val">${perim.length}</div><div class="hint">Démarque gérant ou retrait si dépassée</div></div>
    <div class="kpi" style="--c:#16a34a"><div class="lbl">Valeur stock</div><div class="val">${fmtN(stockVal)}</div><div class="hint">Coût d'achat</div></div>
    <div class="kpi" style="--c:#f59e0b"><div class="lbl">Produits dormants</div><div class="val">${rows.filter(r=>r.rot<0.2).length}</div><div class="hint">Rotation &lt; 0,2</div></div>
  </div>
  <div class="toolbar"><button class="btn btn-g btn-s" onclick="exportStocks()">⬇ Export KPI stocks</button></div>
  <div style="overflow:auto;max-height:420px"><table><tr><th>Article</th><th>Rotation (ventes/stock)</th><th>Couverture (jours)</th><th>Vente moy/j</th><th>Stock</th><th>Statut</th></tr>
  ${rows.map(r=>`<tr><td><b>${esc(r.p.nom)}</b></td><td>${r.rot.toFixed(2)}</td><td>${r.couv>365?"—":r.couv.toFixed(0)+" j"}</td><td>${fmtQ(r.qm)}</td><td>${fmtQ(r.p.stock)}</td><td>${r.rot<0.2?'<span class="badge b-bad">Dormant</span>':r.couv<7?'<span class="badge b-warn">Couverture faible</span>':'<span class="badge b-ok">OK</span>'}</td></tr>`).join("")}</table></div>
  ${perim.length?`<div class="alert a-yel" style="margin-top:10px"><b>Lots DLC ≤ 3j :</b> ${perim.slice(0,12).map(l=>{const pp=S.produits.find(x=>x.sku===l.sku);return esc(pp?pp.nom:l.sku)+" lot "+esc(l.lot||"—")+" ["+esc(l.dlc)+"]";}).join(" • ")}</div>`:""}
  ${perimes.length?`<div class="alert a-red" style="margin-top:10px"><b>Lots DLC dépassée — retirer du rayon :</b> ${perimes.slice(0,12).map(l=>{const pp=S.produits.find(x=>x.sku===l.sku);return esc(pp?pp.nom:l.sku)+" lot "+esc(l.lot||"—")+" ["+esc(l.dlc)+"]";}).join(" • ")}</div>`:""}`;
}
function filterTable(id,q){ q=q.toLowerCase(); $$("#"+id+" tr").forEach((tr,i)=>{ if(!i) return; tr.style.display=tr.textContent.toLowerCase().includes(q)?"":"none"; }); }

/* ================= ACHATS ================= */
function renderAchats(){
  if(!needRole("achats")){current="dashboard";buildNav();render();return;}
  const brouillons=S.bcs.filter(b=>b.statut==="Brouillon").length;
  $("#view").innerHTML=`
  <div class="grid g2"><div class="card"><h3>🤝 Fournisseurs (${S.fournisseurs.length}) — cliquez pour voir ses articles</h3>
    <table><tr><th>Fournisseur</th><th>Articles liés</th><th></th></tr>
    ${S.fournisseurs.map(f=>{const arts=S.produits.filter(p=>p.fournisseur===f.nom);return `<tr><td><b>${esc(f.nom)}</b><br><span class="small">${esc(f.contact)} • ${esc(f.tel)} • ${esc(f.delai)} • ${esc(f.paiement)}</span></td><td><span class="small">${arts.map(a=>esc(a.nom)).join(" • ")||"—"}</span></td><td><button class="btn btn-p btn-s" onclick="modalBC('${esc(f.nom)}')">Commander</button> <button class="btn btn-g btn-s" onclick="modalFournisseur('${f.id}')">✏️</button></td></tr>`;}).join("")}</table>
    <div class="toolbar"><button class="btn btn-p btn-s" onclick="modalFournisseur()">+ Fournisseur</button><button class="btn btn-o btn-s" onclick="genererCommandesAuto()">⚡ Commandes auto (sous Min → brouillons)</button></div>
    <div class="small">Les commandes auto créent des <b>brouillons</b> : ouvrez → ajustez → validez → imprimez.</div></div>
  <div class="card"><h3>📝 Bons de commande (${S.bcs.length}, dont ${brouillons} brouillons)</h3>
    ${S.bcs.slice(0,12).map(b=>`<div class="alert ${b.statut==="Réceptionné"?"a-green":b.statut==="Validé"?"a-yel":""}"><b>${b.id}</b> — ${esc(b.fournisseur)} le ${b.date} • <b>${fmtN(b.lignes.reduce((a,l)=>a+l.qte*l.pu,0))}</b> • <span class="badge ${b.statut==="Réceptionné"?"b-ok":b.statut==="Validé"?"b-info":"b-grey"}">${esc(b.statut)}</span> <span class="small">par ${esc(b.agent||"")}</span><br><span class="small">${b.lignes.map(l=>`${esc(l.nom)} x${fmtQ(l.qte)}`).join(" • ")}</span><br>
    <button class="btn btn-g btn-s" onclick="ouvrirBC('${b.id}')">📂 Ouvrir</button> ${b.statut==="Brouillon"?`<button class="btn btn-p btn-s" onclick="validerBC('${b.id}')">✅ Valider</button><button class="btn btn-d btn-s" onclick="delBC('${b.id}')">🗑 Supprimer</button>`:""} ${b.statut==="Validé"?`<span class="badge b-info">📥 À réceptionner (module Stocks → Réception)</span>`:""} <button class="btn btn-g btn-s" onclick="printBC('${b.id}')">🖨 Imprimer BC</button> ${b.litige?`<span class="badge b-bad">${esc(b.litige)}</span>`:""}</div>`).join("")||"<span class='small'>Aucun BC.</span>"}</div></div>
  <div class="card" style="margin-top:14px"><h3>💳 Factures fournisseurs (${S.factures.length})</h3>
    <table><tr><th>N°</th><th>Fournisseur</th><th>Montant</th><th>Statut</th><th></th></tr>
    ${S.factures.slice(0,12).map(f=>`<tr><td><b>${f.id}</b></td><td>${esc(f.fournisseur)}</td><td><b>${fmtN(f.montant)}</b></td><td>${f.payee?'<span class="badge b-ok">Payée</span>':'<span class="badge b-warn">À payer</span>'}</td><td>${!f.payee?`<button class="btn btn-p btn-s" onclick="payerFacture('${f.id}')">Payer</button>`:""}</td></tr>`).join("")||"<tr><td colspan=5>—</td></tr>"}</table></div>`;
}
function artsFournisseur(nom){ return S.produits.filter(p=>p.fournisseur===nom); }
function modalFournisseur(id){
  const f=id?S.fournisseurs.find(x=>x.id===id):{id:"F"+String(S.fournisseurs.length+1).padStart(3,"0"),nom:"",contact:"",tel:"",email:"",delai:"48h",franco:"100 000 F",paiement:"30 jours"};
  openModal(`<h3>Fournisseur ${f.id}</h3><div class="row2"><div><label>Nom *</label><input id="fo_nom" value="${esc(f.nom)}"></div><div><label>Contact</label><input id="fo_ct" value="${esc(f.contact)}"></div></div>
  <div class="row2"><div><label>Tél</label><input id="fo_tel" value="${esc(f.tel)}"></div><div><label>Email</label><input id="fo_mail" value="${esc(f.email)}"></div></div>
  <div class="row2"><div><label>Délai</label><input id="fo_del" value="${esc(f.delai)}"></div><div><label>Paiement</label><input id="fo_pay" value="${esc(f.paiement)}"></div></div>
  <div class="toolbar"><button class="btn btn-p" onclick="saveFournisseur('${id||""}')">💾 Enregistrer</button></div>`);
}
function saveFournisseur(id){ const d={nom:$("#fo_nom").value.trim(),contact:$("#fo_ct").value,tel:$("#fo_tel").value,email:$("#fo_mail").value,delai:$("#fo_del").value,franco:"—",paiement:$("#fo_pay").value}; if(!d.nom) return alert("Nom obligatoire."); if(id) Object.assign(S.fournisseurs.find(f=>f.id===id),d); else S.fournisseurs.push({id:"F"+String(S.fournisseurs.length+1).padStart(3,"0"),...d}); save(); closeModal(); renderAchats(); }
function genererCommandesAuto(){
  const bas=S.produits.filter(p=>p.stock<=p.stockMin); if(!bas.length) return alert("Aucun article sous Min 🎉");
  const parF={}; bas.forEach(p=>{(parF[p.fournisseur||S.fournisseurs[0].nom]=parF[p.fournisseur||S.fournisseurs[0].nom]||[]).push(p);});
  Object.entries(parF).forEach(([f,arts])=>{ const id="BC"+String(S.seq.bc++).padStart(4,"0");
    S.bcs.unshift({id,date:todayStr(),fournisseur:f,agent:agent(),lignes:arts.map(p=>({sku:p.sku,nom:p.nom,qte:p.qteReappro||Math.max(10,(p.stockMax||50)-p.stock),pu:p.achat})),statut:"Brouillon"}); });
  save(); renderAchats(); alert(`⚡ Brouillons créés : ${Object.keys(parF).length} BC pour ${bas.length} articles. Ouvrez chaque brouillon pour valider.`);
}
function modalBC(fnom){
  const f=fnom||S.fournisseurs[0].nom; const arts=artsFournisseur(f);
  openModal(`<h3>🧾 Nouveau BC — ${esc(f)}</h3><label>Fournisseur</label><select id="bc_f" onchange="modalBC(this.value)">${S.fournisseurs.map(x=>`<option ${x.nom===f?"selected":""}>${esc(x.nom)}</option>`).join("")}</select>
  <div class="small">Articles de ce fournisseur — cochez + quantités (conversion carton : 1 carton = X unités fiche article).</div>
  <div class="small">Prix fournisseur variables : ajustez le PU si le tarif a changé (historisé auto).</div>
  <div style="max-height:40vh;overflow:auto"><table><tr><th></th><th>Article</th><th>Qté</th><th>PU achat (modifiable)</th></tr>${arts.map(p=>`<tr><td><input type="checkbox" id="ck_${p.sku}" checked></td><td><b>${esc(p.nom)}</b><br><span class="small">Stock ${fmtQ(p.stock)} (Min ${p.stockMin}) • Carton de ${p.condCarton}</span></td><td><input type="number" id="qq_${p.sku}" value="${p.qteReappro||20}" style="width:80px"></td><td><input type="number" id="pp_${p.sku}" value="${p.achat}" style="width:100px"></td></tr>`).join("")||"<tr><td colspan=4>Aucun article lié — ajoutez des articles à ce fournisseur dans le Catalogue.</td></tr>"}</table></div>
  <div class="toolbar"><button class="btn btn-p" onclick="saveBC2('${esc(f)}')">Créer le brouillon</button></div>`);
}
function saveBC2(f){
  const arts=artsFournisseur(f).filter(p=>$("#ck_"+p.sku)&&$("#ck_"+p.sku).checked).map(p=>({sku:p.sku,nom:p.nom,qte:+($("#qq_"+p.sku).value||0),pu:+($("#pp_"+p.sku)!==null&&$("#pp_"+p.sku).value!==""?+($("#pp_"+p.sku).value):p.achat)}));
  arts.forEach(l=>{ const p=S.produits.find(x=>x.sku===l.sku); if(p&&l.pu!==p.achat){ trackPrix(p,l.pu,p.vente,`BC fournisseur ${f} — nouveau tarif`); addMouvement("PRIX",p.sku,0,`Prix achat ${fmtN(p.achat)}→${fmtN(l.pu)} (BC)`,"Prix",agent(),f); p.achat=l.pu; } });
  if(!arts.length) return alert("Sélectionnez au moins un article.");
  const id="BC"+String(S.seq.bc++).padStart(4,"0");
  S.bcs.unshift({id,date:todayStr(),fournisseur:f,agent:agent(),lignes:arts,statut:"Brouillon"}); save(); closeModal(); renderAchats();
}
function ouvrirBC(id){
  const b=S.bcs.find(x=>x.id===id);
  const estModifiable = (b.statut === "Brouillon" || b.statut === "Litige");

  openModal(`<h3>📂 ${b.id} — ${esc(b.fournisseur)} (${b.statut})</h3>
  ${b.litige ? `<div class="alert a-red" style="margin-bottom:10px;"><b>Motif du litige :</b> ${esc(b.litige)}</div>` : ""}
  <table><tr><th>Article</th><th>Qté commandée${b.statut==="Réceptionné"?" / reçue":""}</th><th>PU achat (modifiable si tarif variable)</th><th>Total BC</th></tr>${b.lignes.map((l,i)=>`<tr><td>${esc(l.nom)}</td><td>${estModifiable?`<input type="number" id="bl_${i}" value="${l.qte}" style="width:90px">`:fmtQ(l.qte)}${l.qteRecue!==undefined?`<div class="small">Reçue : <b>${fmtQ(l.qteRecue)}</b></div>`:""}</td><td>${estModifiable?`<input type="number" id="bp_${i}" value="${l.pu}" style="width:100px">`:fmtN(l.pu)}${l.puReception!==undefined?`<div class="small">PU BL : ${fmtN(l.puReception)}</div>`:""}</td><td>${fmtN(l.qte*l.pu)}</td></tr>`).join("")}</table>
  <div class="toolbar">
    ${estModifiable?`<button class="btn btn-p btn-s" onclick="saveBCEdit('${id}')">💾 Enregistrer les corrections</button>`:""}
    ${b.statut==="Brouillon"?`<button class="btn btn-p btn-s" onclick="validerBC('${id}')">✅ Valider</button>`:""}
    ${b.statut==="Litige"?`<button class="btn btn-p btn-s" onclick="validerLitigeCorrige('${id}')">✅ Résoudre et Valider sur cette nouvelle base</button>`:""}
    <button class="btn btn-g btn-s" onclick="printBC('${id}')">🖨 Imprimer</button>
    <button class="btn btn-g btn-s" onclick="closeModal()">Fermer</button>
  </div>`);
}
function validerLitigeCorrige(id){
  const b=S.bcs.find(x=>x.id===id); if(!b||b.statut!=="Litige") return alert("Ce BC n'est pas en litige.");
  if(S.bls.some(x=>x.bcId===id)) return alert("Un BL existe déjà pour ce BC : vérifiez l'historique avant toute nouvelle entrée en stock.");
  const lignes=[], erreurs=[];
  b.lignes.forEach((l,i)=>{
    const qEl=document.getElementById("bl_"+i), pEl=document.getElementById("bp_"+i);
    const q=qEl?Number(qEl.value):Number(l.qte), pu=pEl?Number(pEl.value):Number(l.pu);
    if(!Number.isFinite(q)||q<0) erreurs.push(`Quantité invalide : ${l.nom}`);
    else if(!Number.isFinite(pu)||pu<=0) erreurs.push(`Prix invalide : ${l.nom}`);
    else if(!S.produits.some(p=>p.sku===l.sku)) erreurs.push(`Article introuvable : ${l.nom}`);
    else lignes.push({sku:l.sku,nom:l.nom,qte:q,pu,lot:l.lot||""});
  });
  if(erreurs.length) return alert("Correction impossible :\n"+erreurs.join("\n"));
  if(!lignes.some(l=>l.qte>0)) return alert("Aucune quantité reçue. Le litige ne peut pas être clôturé comme réceptionné.");
  const motif=(prompt("Motif de résolution du litige (obligatoire) :",b.litige||"Quantités et prix confirmés sur le BL")||"").trim();
  if(!motif) return alert("Résolution annulée : le motif est obligatoire.");
  const lignesOriginales=b.lignes.map(l=>({sku:l.sku,nom:l.nom,qte:l.qte,pu:l.pu}));
  lignes.forEach((l,i)=>{
    const bcLine=b.lignes[i]; if(bcLine){ bcLine.qteRecue=l.qte; bcLine.puReception=l.pu; }
    const p=S.produits.find(x=>x.sku===l.sku), ancienAchat=Number(p.achat)||0;
    if(l.pu!==ancienAchat){ trackPrix(p,l.pu,p.vente,`Résolution litige ${id}`); addMouvement("PRIX",p.sku,0,`Prix achat ${fmtN(ancienAchat)}→${fmtN(l.pu)} (${id})`,"Prix",agent(),b.fournisseur); p.achat=l.pu; }
    if(l.qte>0){ p.stockReserve=(Number(p.stockReserve)||0)+l.qte; if(l.lot) p.lot=l.lot; syncStock(p); addMouvement("RECEPTION",p.sku,l.qte,`Réception après résolution du litige ${id} — ${motif}`,"BL",b.fournisseur,LOC_RESERVE); }
  });
  b.lignes.forEach((l,i)=>{ l.qteRecue=lignes[i].qte; l.puReception=lignes[i].pu; });
  const bl="BL"+String(S.seq.bl++).padStart(4,"0"), montant=lignes.reduce((a,l)=>a+l.qte*l.pu,0);
  S.bls.unshift({id:bl,date:todayStr(),heure:nowHM(),fournisseur:b.fournisseur,bcId:b.id,blFournisseur:`BL-LITIGE-${b.id}`,agent:agent(),lignes,statut:"Réserve",motifAjustement:motif});
  const fac=S.factures.find(f=>f.bc===b.id);
  if(fac) fac.montant=montant;
  else S.factures.unshift({id:"FA"+String(S.seq.facture++).padStart(4,"0"),fournisseur:b.fournisseur,montant,echeance:todayStr(),payee:false,bc:b.id});
  b.ajustementLitige={date:todayStr()+" "+nowHM(),agent:agent(),motif,avant:lignesOriginales,apres:lignes};
  b.statut="Réceptionné"; b.dateReception=todayStr(); b.litigeResolu=motif;
  save(); closeModal(); printBL(bl); renderAchats();
  alert(`✅ Litige résolu et réception enregistrée.\nStock en réserve • BL ${bl} • Facture ${fmtN(montant)} F.`);
}
function saveBCEdit(id){
  const b=S.bcs.find(x=>x.id===id); if(!b||!(b.statut==="Brouillon"||b.statut==="Litige")) return alert("Ce BC n'est pas modifiable.");
  const corrections=[]; let erreur="";
  b.lignes.forEach((l,i)=>{ const el=document.getElementById("bl_"+i), ep=document.getElementById("bp_"+i); const q=el?Number(el.value):Number(l.qte), pu=ep?Number(ep.value):Number(l.pu);
    if(!Number.isFinite(q)||q<0) erreur=`Quantité invalide : ${l.nom}`;
    else if(!Number.isFinite(pu)||pu<=0) erreur=`Prix invalide : ${l.nom}`;
    else corrections.push({q,pu});
  });
  if(erreur) return alert(erreur);
  b.lignes.forEach((l,i)=>{ l.qte=corrections[i].q; l.pu=corrections[i].pu; });
  save(); ouvrirBC(id); renderAchats();
}
function validerBC(id){ const b=S.bcs.find(x=>x.id===id); if(!b||b.statut!=="Brouillon") return alert("Seul un brouillon peut être validé."); if(!b.lignes.some(l=>Number(l.qte)>0)) return alert("Le BC doit contenir au moins une quantité."); b.statut="Validé"; save(); closeModal(); renderAchats(); }
function delBC(id){ const b=S.bcs.find(x=>x.id===id); if(!b||b.statut!=="Brouillon") return alert("Seul un brouillon peut être supprimé."); if(!confirm(`Supprimer le brouillon ${id} ?`)) return; S.bcs=S.bcs.filter(x=>x.id!==id); S.trash=S.trash||{produits:[],bcs:[]}; if(!S.trash.bcs.includes(id)) S.trash.bcs.push(id); try{logCorbeille("SUPPR_BC", id, b.fournisseur+" — "+b.lignes.length+" lignes", b.lignes.reduce((a,l)=>a+l.qte*l.pu,0));}catch(e){} save(); closeModal(); renderAchats(); }
function printBC(id){ const b=S.bcs.find(x=>x.id===id); if(!b) return;
  printHTML(`<div class="ticket"><center><b>${esc(S.params.magasin)}</b><br>*** BON DE COMMANDE ${b.id} ***<br>${b.date}<br>Fournisseur : ${esc(b.fournisseur)}<br>Statut : ${b.statut} • Demandé par ${esc(b.agent||"")}</center><hr>${b.lignes.map(l=>`${esc(l.nom)}<br>${fmtQ(l.qte)} x ${fmtN(l.pu)} = <b>${fmtN(l.qte*l.pu)}</b>`).join("<br>")}<hr>TOTAL : <b>${fmtN(b.lignes.reduce((a,l)=>a+l.qte*l.pu,0))}</b><center>Signature : ______</center></div>`); }
function payerFacture(id){ S.factures.find(f=>f.id===id).payee=true; save(); renderAchats(); }

/* ================= RH ================= */
function renderRH(){
  if(!can("rh")&&!can("pointeuse")){current=firstAllowed();buildNav();render();return;}
  if(!can("rh")){ const me=S.employes.find(e=>e.nom===agent()); const mine=S.pointages.filter(p=>!me||p.code===me.code).slice(0,15);
    $("#view").innerHTML=`<div class="card"><h3>⏱ Mon planning & pointeuse — ${esc(agent())} (${esc(S.session.role)})</h3><div class="small">Votre poste ne donne accès qu'au POS + pointeuse (droits définis par Admin/Gérant).</div><div class="toolbar"><button class="btn btn-p" onclick="quickPoint('debut')">▶ Début de service</button><button class="btn btn-d" onclick="quickPoint('fin')">⏹ Fin de service</button><button class="btn btn-g" onclick="go('pos')">🛒 Aller en caisse</button></div><table><tr><th>Date</th><th>Début</th><th>Fin</th><th>Temps</th></tr>${mine.map(p=>`<tr><td>${p.date}</td><td>${p.debut||"—"}</td><td>${p.fin||"En service"}</td><td><b>${p.duree||"—"}</b></td></tr>`).join("")||"<tr><td colspan=4>—</td></tr>"}</table></div>`; return; }
  const canAdmin=can("admin");
  $("#view").innerHTML=`
  <div class="grid g3">
    <div class="kpi" style="--c:#16a34a"><div class="lbl">Effectif actif</div><div class="val">${S.employes.filter(e=>e.statut==="Actif").length}</div><div class="hint">Codes d'accès personnels</div></div>
    <div class="kpi" style="--c:#2563eb"><div class="lbl">En service (badge en haut)</div><div class="val">${S.pointages.filter(p=>p.date===todayStr()&&!p.fin).length}</div><div class="hint">Pointage géré par le badge ⏱</div></div>
    <div class="kpi" style="--c:#f59e0b"><div class="lbl">Congés en attente</div><div class="val">${S.conges.filter(c=>c.statut==="En attente").length}</div><div class="hint">À valider</div></div>
  </div>
  <div class="alert a-green" style="margin-top:14px">✅ <b>Le rôle de chaque agent découle automatiquement de ses postes occupés.</b> Les <b>rôles & droits par poste</b> se règlent dans <b>Paramétrage → Rôles & droits</b>. ${canAdmin?`<button class="btn btn-g btn-s" onclick="go('admin')">⚙️ Ouvrir Paramétrage</button>`:""}</div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>👥 Employés — postes occupés = rôle ${canAdmin?`(modifiable : Admin/Gérant)`:`(lecture)`}</h3>
      <table><tr><th>ID</th><th>Nom / Postes</th><th>Code 🔑</th><th>Rôle (auto)</th><th></th></tr>
      ${S.employes.map(e=>`<tr><td>${e.id}</td><td><b>${esc(e.nom)}</b><br><span class="small">${(e.postes||[e.poste]).map(esc).join(" + ")} • ${(e.rayons||[e.rayon]).join(", ")} • ${fmtN(e.salaire)}</span></td><td><b>${esc(e.code)}</b></td><td><span class="badge ${roleDe(e)==="Admin"?"b-bad":roleDe(e)==="Gérant"?"b-ok":"b-info"}">${esc(roleDe(e))}</span></td><td>${canAdmin?`<button class="btn btn-g btn-s" onclick="modalEmploye('${e.id}')">✏️ Modifier</button>`:""}</td></tr>`).join("")}</table>
      <div class="toolbar">${canAdmin?`<button class="btn btn-p btn-s" onclick="modalEmploye()">+ Embaucher</button>`:""}<button class="btn btn-g btn-s" onclick="modalConge()">+ Congé</button></div>
      <div class="small"><b>Correspondance :</b> Caissière/Vendeuse/Hôtesse → Vendeur • Chef de rayon/Magasinier → Chef de rayon • Comptable → Comptable • Gérant → Gérant • Administrateur → Admin.</div></div>
    <div class="card"><h3>🕒 Pointages du jour (lecture — badge en haut de l'écran)</h3>
      <div class="small">La pointage se fait par l'agent lui-même avec son code (bouton ⏱ en haut). Aucune saisie ici.</div>
      <div style="max-height:300px;overflow:auto;margin-top:8px"><table><tr><th>Agent</th><th>Début</th><th>Fin</th><th>Temps</th></tr>
      ${S.pointages.filter(p=>p.date===todayStr()).map(p=>`<tr><td><b>${esc(p.nom)}</b></td><td>${p.debut||"—"}</td><td>${p.fin||"<span class='badge b-warn'>En service</span>"}</td><td><b>${p.duree||"—"}</b></td></tr>`).join("")||"<tr><td colspan=4>Personne n'a encore pointé aujourd'hui.</td></tr>"}</table></div>
      <hr><h3>🏖 Congés</h3>${S.conges.slice(0,6).map(c=>`<div class="alert ${c.statut==="Validé"?"a-green":"a-yel"}"><b>${esc(c.nom)}</b> : ${c.du} → ${c.au} • ${esc(c.statut)} ${c.statut==="En attente"&&canAdmin?`<button class="btn btn-p btn-s" onclick="validerConge('${c.id}')">Valider</button>`:""}</div>`).join("")||"<span class='small'>—</span>"}</div>
  </div>`;
}
function pointer(sens){
  const c=($("#pt_code").value||"").trim(); const e=S.employes.find(x=>x.code===c&&x.statut==="Actif");
  if(!e) return alert("Code inconnu.");
  if(sens==="debut"){ const open=S.pointages.find(p=>p.code===c&&p.date===todayStr()&&!p.fin); if(open) return alert(e.nom+" a déjà un service ouvert ("+open.debut+").");
    S.pointages.unshift({id:uid("PT"),code:c,nom:e.nom,date:todayStr(),debut:nowHM(),fin:"",duree:""}); }
  else{ const open=S.pointages.find(p=>p.code===c&&!p.fin); if(!open) return alert("Aucun début de service ouvert pour ce code.");
    open.fin=nowHM(); const [h1,m1]=open.debut.split(":").map(Number),[h2,m2]=open.fin.split(":").map(Number);
    let min=(h2*60+m2)-(h1*60+m1); if(min<0)min+=24*60; open.duree=Math.floor(min/60)+"h"+String(min%60).padStart(2,"0"); }
  save(); renderRH();
}
function modalEmploye(id){
  const e=id?S.employes.find(x=>x.id===id):{id:"E"+String(S.employes.length+1).padStart(3,"0"),nom:"",poste:"Vendeuse",postes:["Vendeuse"],code:String(1000+S.employes.length+1),rayon:"Caisses",rayons:["Caisses"],modules:[],salaire:170000,statut:"Actif"};
  e.postes=e.postes||[e.poste]; e.rayons=e.rayons||[e.rayon]; e.modules=e.modules||[];
  const rayOpts=["Caisses","Réserve / Logistique",...RAYON_LOCS()];
  openModal(`<h3>${id?"✏️ Modifier l'agent":"＋ Nouvel agent"} — ${e.id}</h3>
  <div class="small">Cochez le ou les <b>postes occupés</b> : le <b>rôle et les droits de base en découlent automatiquement</b> (multi-tâches possible). Le code sert à la connexion + pointage.</div>
  <div class="row2"><div><label>Nom</label><input id="e_nom" value="${esc(e.nom)}"></div><div><label>🔑 Code d'accès (4 chiffres)</label><input id="e_code" value="${esc(e.code)}"></div></div>
  <label>Postes occupés (plusieurs = multi-tâches)</label><div class="toolbar">${POSTES.map(p=>`<label style="display:inline;font-weight:400"><input type="checkbox" class="e_poste_cb" value="${p}" ${e.postes.includes(p)?"checked":""} onchange="majRoleApercu()" style="width:auto"> ${esc(p)}</label>`).join("")}</div>
  <div class="alert a-green">🎭 Rôle (droits de base) calculé : <b id="e_roleApercu">${esc(roleDe(e))}</b></div>
  <label>Rayons affectés (plusieurs possibles)</label><div class="toolbar">${rayOpts.map(r=>`<label style="display:inline;font-weight:400"><input type="checkbox" class="e_ray_cb" value="${esc(r)}" ${e.rayons.includes(r)?"checked":""} style="width:auto"> ${esc(r)}</label>`).join("")}</div>
  <details style="margin-top:8px"><summary class="small" style="cursor:pointer">Droits supplémentaires (optionnel — en plus du rôle)</summary><div class="toolbar">${MODULES.map(m=>`<label style="display:inline;font-weight:400"><input type="checkbox" class="e_mod_cb" value="${m.id}" ${e.modules.includes(m.id)?"checked":""} style="width:auto"> ${m.icon} ${m.id}</label>`).join("")}</div></details>
  <div class="row2"><div><label>Salaire</label><input id="e_sal" type="number" value="${e.salaire}"></div><div><label>Statut</label><select id="e_stat"><option ${e.statut==="Actif"?"selected":""}>Actif</option><option ${e.statut!=="Actif"?"selected":""}>Inactif</option></select></div></div>
  <div class="toolbar"><button class="btn btn-p" onclick="saveEmploye('${id||""}')">Enregistrer</button></div>`);
}
function majRoleApercu(){ const postes=$$(".e_poste_cb").filter(c=>c.checked).map(c=>c.value); const el=$("#e_roleApercu"); if(el) el.textContent=roleFromPostes(postes); }
function saveEmploye(id){
  const postes=$$(".e_poste_cb").filter(c=>c.checked).map(c=>c.value); const rayons=$$(".e_ray_cb").filter(c=>c.checked).map(c=>c.value); const modules=$$(".e_mod_cb").filter(c=>c.checked).map(c=>c.value);
  if(!postes.length) return alert("Cochez au moins un poste occupé.");
  const d={nom:$("#e_nom").value.trim(),postes,poste:postes[0],code:$("#e_code").value.trim(),role:roleFromPostes(postes),rayon:(rayons[0]||"Caisses"),rayons:rayons.length?rayons:["Caisses"],modules,salaire:+$("#e_sal").value||0,statut:$("#e_stat").value};
  if(!d.nom||!d.code) return alert("Nom + code obligatoires.");
  if(S.employes.some(e=>e.code===d.code&&e.id!==id)) return alert("Ce code est déjà attribué !");
  if(id) Object.assign(S.employes.find(e=>e.id===id),d); else S.employes.push({id:"E"+String(S.employes.length+1).padStart(3,"0"),statut:"Actif",...d});
  save(); closeModal(); renderRH();
}
function modalConge(){ openModal(`<h3>Congé</h3><label>Employé</label><select id="c_nom">${S.employes.map(e=>`<option>${esc(e.nom)}</option>`).join("")}</select><div class="row2"><div><label>Du</label><input id="c_du" type="date" value="${todayStr()}"></div><div><label>Au</label><input id="c_au" type="date" value="${todayStr()}"></div></div><div class="toolbar"><button class="btn btn-p" onclick="saveConge()">Envoyer</button></div>`); }
function saveConge(){ S.conges.unshift({id:uid("CG"),nom:$("#c_nom").value,du:$("#c_du").value,au:$("#c_au").value,statut:"En attente"}); save(); closeModal(); renderRH(); }
function validerConge(id){ S.conges.find(c=>c.id===id).statut="Validé"; save(); renderRH(); }

/* ================= COMPTA ================= */
function renderCompta(){
  if(!needRole("compta")){current="dashboard";buildNav();render();return;}
  const vj=ventesJour(), caJ=vj.reduce((a,v)=>a+v.total,0);
  const recapJ=recapTaxes(vj.flatMap(v=>v.lignes));
  const coutJ=vj.reduce((a,v)=>a+v.lignes.reduce((x,l)=>{ if(l.offert||l.fid) return x; if(Number.isFinite(Number(l.cout))) return x+Number(l.cout); const p=S.produits.find(pp=>pp.sku===l.sku);return x+(p?p.achat*l.qte:0);},0),0);
  const marges={}; S.ventes.filter(v=>v.statut!=="Annulé").forEach(v=>v.lignes.forEach(l=>{ if(l.offert||l.fid) return; const p=S.produits.find(pp=>pp.sku===l.sku); if(!p) return; const r=rayonNom(p.rayon); marges[r]=marges[r]||{ca:0,marge:0}; const coutL=Number.isFinite(Number(l.cout))?Number(l.cout):(p.achat*l.qte); marges[r].ca+=l.total; marges[r].marge+=(l.total-coutL);}));
  const impayes=S.factures.filter(f=>!f.payee).reduce((a,f)=>a+f.montant,0);
  $("#view").innerHTML=`
  <div class="grid g4">
    <div class="kpi" style="--c:#16a34a"><div class="lbl">CA jour</div><div class="val">${fmtN(caJ)}</div><div class="hint">${vj.length} tickets</div></div>
    <div class="kpi" style="--c:#2563eb"><div class="lbl">Marge brute jour</div><div class="val">${fmtN(caJ-coutJ)}</div><div class="hint">${(caJ?(caJ-coutJ)/caJ*100:0).toFixed(1)}%</div></div>
    <div class="kpi" style="--c:#dc2626"><div class="lbl">Dettes fournisseurs</div><div class="val">${fmtN(impayes)}</div><div class="hint">À payer</div></div>
    <div class="kpi" style="--c:#f59e0b"><div class="lbl">Z archivés</div><div class="val">${S.zClotures.length}</div><div class="hint">Audit caisse</div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>🧾 Ventilation TVA du jour (TTC → HT, pour audit Z)</h3>
  <table><tr><th>Code</th><th>Taux</th><th>Base HT</th><th>TVA</th><th>TTC</th></tr>${recapJ.map(r=>`<tr><td><b>${r.code}</b></td><td>${r.taux}%</td><td>${fmtN(r.ht)}</td><td>${fmtN(r.tva)}</td><td><b>${fmtN(r.ttc)}</b></td></tr>`).join("")||"<tr><td colspan=5>—</td></tr>"}</table></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>🧾 Clôtures Z (imprimables)</h3>${S.zClotures.slice(0,8).map(z=>`<div class="alert a-green"><b>${z.id}</b> — ${z.date} ${z.heure} • ${esc(z.caissier)} • ${z.tickets} tickets • <b>${fmtN(z.total)}</b><br><span class="small">${Object.entries(z.detail||{}).map(([k,v])=>`${k}: ${fmtN(v)}`).join(" • ")}</span><br><button class="btn btn-g btn-s" onclick='printHTML(${JSON.stringify(`<div class="ticket"><center><b>${S.params.magasin}</b><br>*** Z ${z.id} ***<br>${z.date} ${z.heure}<br>${z.caissier}</center><hr>Tickets:${z.tickets} TOTAL:<b>${fmtN(z.total)}</b></div>`).replace(/</g,"\\u003c")})'>🖨 Réimprimer</button></div>`).join("")||"<span class='small'>Fermez la caisse (POS) pour générer le Z.</span>"}</div>
    <div class="card"><h3>📊 Marges par rayon</h3><table><tr><th>Rayon</th><th>CA</th><th>Marge</th><th>Tx</th></tr>${Object.entries(marges).map(([r,d])=>`<tr><td>${esc(r)}</td><td>${fmtN(d.ca)}</td><td><b>${fmtN(d.marge)}</b></td><td>${(d.ca?d.marge/d.ca*100:0).toFixed(1)}%</td></tr>`).join("")||"<tr><td colspan=4>—</td></tr>"}</table>
    <div class="toolbar"><button class="btn btn-g btn-s" onclick="exportVentes('mois')">⬇ Ventes mois</button><button class="btn btn-g btn-s" onclick="exportVentes('annee')">⬇ Ventes année</button></div></div>
  </div>`;
}

/* ================= ADMIN ================= */
function renderAdmin(){
  if(!needRole("admin")){current="dashboard";buildNav();render();return;}
  $("#view").innerHTML=`
  <div class="grid g2">
    <div class="card"><h3>🏪 Magasin — 🇨🇮 Côte d'Ivoire / FCFA (XOF)</h3><label>Nom</label><input id="a_mag" value="${esc(S.params.magasin)}">
      <div class="row2"><div><label>Adresse</label><input id="a_adr" value="${esc(S.params.adresse)}"></div><div><label>Tél</label><input id="a_tel" value="${esc(S.params.tel)}"></div></div>
      <div class="row2"><div><label>NCC (FNE / DGI)</label><input id="a_ncc" value="${esc(S.params.ncc||"")}"></div><div><label>Heure d'ouverture (rappel pointage)</label><input id="a_h" type="time" value="${S.params.heureOuverture||"08:00"}"></div></div>
      <div class="row2"><div><label>Seuil DLC (j)</label><input id="a_dlc" type="number" value="${S.params.seuilAlerteDLC}"></div><div><label>Quai max (h) avant alerte</label><input id="a_quai" type="number" value="${S.params.quaiMaxH||4}"></div></div>
      <label>Paiements (,)</label><input id="a_pay" value="${esc(S.params.paiements.join(", "))}">
      <div class="toolbar"><button class="btn btn-p btn-s" onclick="saveParams()">💾 Enregistrer</button></div></div>
    <div class="card"><h3>🇨🇮 Régime fiscal de la boutique — taxes appliquées ou non</h3>
      <div class="small">Chaque boutique choisit son régime au paramétrage admin. Le ticket, la TVA et les exports suivent automatiquement : <b>MICRO/RME = pas de TVA</b> (ticket simple), <b>RSI/RNI = TVA collectée</b> A 18% / B 9% / E 0% + Facture normalisée possible.</div>
      <label>Raison sociale</label><input id="fx_nom" value="${esc((S.fiscal||{}).raisonSociale||S.params.magasin)}">
      <div class="row2"><div><label>Identifiant interne (entrepriseId)</label><input id="fx_id" value="${esc((S.fiscal||{}).entrepriseId||"")}"></div><div><label>NCC</label><input id="fx_ncc" value="${esc((S.fiscal||{}).ncc||S.params.ncc||"")}"></div></div>
      <div class="row2"><div><label>RCCM</label><input id="fx_rccm" value="${esc((S.fiscal||{}).rccm||"")}"></div><div><label>Régime fiscal (DGI CI)</label><select id="fx_reg">${Object.values(REGIMES_FISCAUX).map(r=>`<option value="${r.code}" ${(S.fiscal&&((S.fiscal.regimeFiscal||S.fiscal.regime)===r.code))?"selected":""}>${r.code} — ${esc(r.label)}</option>`).join("")}</select></div></div>
      <div class="row2"><div><label>Collecte TVA ?</label><select id="fx_tva"><option value="1" ${(S.fiscal&&collecteTvaActive())?"selected":""}>Oui — TVA A/B/E sur ticket</option><option value="0" ${(S.fiscal&&!collecteTvaActive())?"selected":""}>Non — ticket simple sans TVA</option></select></div><div><label>Taux TSE (ex : 0.001 = 0,1%)</label><input id="fx_tse" type="number" step="0.0001" value="${(S.fiscal&&S.fiscal.tauxTse)??regimeFiscal().tse}"></div></div>
      <div class="row2"><div><label><input type="checkbox" id="fx_cga" ${(S.fiscal&&S.fiscal.adherentCga)?"checked":""} style="width:18px;height:18px"> Adhérent CGA</label></div><div><label><input type="checkbox" id="fx_masq" ${(S.fiscal&&S.fiscal.masquerDetailTvaSurTicket)?"checked":""} style="width:18px;height:18px"> Masquer le détail TVA sur ticket</label></div></div>
      <label>Pied de page ticket</label><input id="fx_pied" value="${esc((S.fiscal||{}).piedDePageTicket||"")}">
      <div class="small">Régime actif : <b>${regimeCode()} — ${esc(regimeLabel())}</b> • TVA : <b>${collecteTvaActive()?"collectée":"NON collectée"}</b> • TSE : <b>${(tauxTseActif()*100).toFixed(2)}%</b> • CGA : <b>${(S.fiscal&&S.fiscal.adherentCga)?"oui":"non"}</b></div>
      <table><tr><th>Code</th><th>Nom</th><th>Taux</th><th>Exemples</th></tr>${Object.values(TAX_CODES).map(t=>`<tr><td><span class="badge b-info">${t.code}</span></td><td>${esc(t.nom)}</td><td><b>${collecteTvaActive()?t.taux+"%":"— (non collectée)"}</b></td><td><span class="small">${esc(t.exemples)}</span></td></tr>`).join("")}</table>
      <div class="small">Calcul : HT = TTC/(1+taux) • TVA = TTC − HT. Chaque article possède <b>code_tva</b> obligatoire.</div>
      <div class="toolbar"><button class="btn btn-p btn-s" onclick="saveFiscal()">💾 Enregistrer le régime fiscal</button></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>🔑 Licence & activation</h3>
    <div class="small">Type : <b>${licenceInfo().type}</b> • Installée : <b>${esc(licenceInfo().installDate||"—")}</b> • Expire : <b>${esc(licenceInfo().expireDate||"—")}</b> • Reste : <b>${licenceJoursRestants()<0?0:licenceJoursRestants()} j</b></div>
    <div class="small">Démo 72h : après expiration, encaissement et réceptions bloqués. Contactez votre vendeur ASSOMi pour la clé FULL.</div>
    <div class="toolbar"><button class="btn btn-p btn-s" onclick="openModal(verrouLicenceHTML())">🔓 Activer ma licence</button></div>
    <details><summary class="small" style="cursor:pointer">🔧 Outils vendeur (code requis)</summary><div class="row2"><div><label>Code vendeur</label><input id="lic_vcode" type="password" placeholder="Code vendeur"></div><div><label>&nbsp;</label><button class="btn btn-g btn-s" style="width:100%" onclick="deverrouillerVendeur()">Afficher</button></div></div><div id="lic_vzone"></div></details></div>
  <div class="card" style="margin-top:14px"><h3>🎭 Rôles & droits par poste — main totale Admin / Gérant (code admin : <b>${adminCode()}</b>)</h3>
    <div class="small">Cochez les modules visibles pour chaque poste. Ex : Caissière (Vendeur) = <b>POS + Pointeuse uniquement</b>. Appliqué immédiatement : l'agent ne voit que ses opérations.</div>
    <div style="overflow:auto"><table><tr><th>Poste / Rôle</th>${MODULES.map(m=>`<th>${m.icon}<br><span class="small">${m.id}</span></th>`).join("")}<th>⏱<br><span class="small">pointeuse</span></th></tr>
    ${ROLES.map(r=>`<tr><td><b>${r}</b></td>${MODULES.map(m=>`<td style="text-align:center"><input type="checkbox" ${rolePerms()[r][m.id]?"checked":""} onchange="setPerm('${r}','${m.id}',this.checked)" style="width:20px;height:20px"></td>`).join("")}<td style="text-align:center"><input type="checkbox" ${rolePerms()[r].pointeuse?"checked":""} onchange="setPerm('${r}','pointeuse',this.checked)" style="width:20px;height:20px"></td></tr>`).join("")}</table></div>
    <div class="toolbar"><button class="btn btn-g btn-s" onclick="if(confirm('Remettre les droits par défaut ? Caissière = POS seule. Vos réglages actuels seront écrasés.'))resetPerms()">↩ Droits par défaut (caissière = POS seule)</button></div><div class="small">Secours : si vous avez bloqué un poste par erreur, ce bouton remet les droits d'origine.</div></div>
  <div class="card" style="margin-top:14px"><h3>🏷 Promo DLC manuelle — remise proposée par le Gérant (zéro auto)</h3>
    <div class="row2"><div><label>Seuil d'alerte (jours avant péremption)</label><input id="pd_seuil" type="number" value="${(S.promoDLC||{}).seuilJ||20}"></div><div><label>Remise % proposée au tamponnage</label><input id="pd_rem" type="number" value="${(S.promoDLC||{}).remise||30}"></div></div>
    <div class="toolbar"><button class="btn btn-p btn-s" onclick="savePromoDLC()">💾 Enregistrer</button></div>
    <div class="small">Après l'alerte DLC, <b>seul le gérant tamponne 🎫</b> la promo article par article (catalogue ou caisse). Les autres agents la voient ensuite sur leur tableau de bord et en caisse. Aucune promo automatique.</div></div>
  <div class="card" style="margin-top:14px"><h3>💳 Fidélité — seuils définis par le Gérant (remise auto en caisse)</h3>
    <div class="row2"><div><label>1 point tous les X F</label><input id="fd_pt" type="number" value="${S.fidelite.ptParF}"></div><div><label>Seuil (pts) → bon</label><input id="fd_seuil" type="number" value="${S.fidelite.seuilPts}"></div></div>
    <div class="row2"><div><label>Valeur du bon (F)</label><input id="fd_val" type="number" value="${S.fidelite.valeurBon}"></div><div><label>Remise auto en caisse</label><select id="fd_auto"><option value="1" ${S.fidelite.remiseAuto?"selected":""}>Oui</option><option value="0" ${!S.fidelite.remiseAuto?"selected":""}>Non</option></select></div></div>
    <div class="toolbar"><button class="btn btn-p btn-s" onclick="saveFidelite()">💾 Enregistrer seuils</button></div></div>
  <div class="card" style="margin-top:14px"><h3>📤 Exports avec plage de dates (1 ou plusieurs dates → TCD approfondi)</h3>
    <div class="toolbar">
      <button class="btn btn-p btn-s" onclick="modalExport('ventes')">Ventes (dates au choix)</button>
      <button class="btn btn-g btn-s" onclick="modalExport('mouvements')">Mouvements</button>
      <button class="btn btn-g btn-s" onclick="modalExport('demarques')">Démarques</button>
      <button class="btn btn-g btn-s" onclick="modalExport('bl')">Bons de livraison</button>
      <button class="btn btn-g btn-s" onclick="exportProduits()">Produits</button><button class="btn btn-g btn-s" onclick="exportStocks()">Stocks</button>
    </div>
    <div class="small">Factures PRO émises : ${S.facturesPro.length} • PV d'inventaire : bouton 🖨 PV PDF (A4) dans Stocks → Inventaires.</div></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>🇨🇮 Marché ivoirien — zone CFA (XOF) + Factures</h3><div class="toolbar"><button class="btn btn-b btn-s" onclick="go('fne')">🧾 Ouvrir les factures</button></div><div class="small">Devise : <b>FCFA (XOF)</b> • TVA A 18% / B 9% / E 0% si collectée • Régime choisi en carte <b>🇨🇮 Régime fiscal de la boutique</b> : MICRO/RME = ticket simple, RSI/RNI = TVA + facture. NCC et centre des impôts ci-dessus.</div></div>
    <div class="card"><h3>🖨 Périphériques</h3><table>${["Imprimante tickets (ticket seul)","Scanner EAN","Tiroir-caisse","Balance kg","Terminal Mobile Money"].map((m,i)=>`<tr><td>${m}</td><td><span class="badge ${i<3?"b-ok":"b-warn"}">${i<3?"Connecté":"À configurer"}</span></td><td><button class="btn btn-g btn-s" onclick="alert('Test OK ✅')">Tester</button></td></tr>`).join("")}</table></div>
    <div class="card"><h3>🗂️ Référentiel (rayons/familles) + 📱 Multi-appareils</h3><div class="toolbar"><button class="btn btn-p btn-s" onclick="modalRef()">➕ Rayon / Famille / Sous-famille</button><button class="btn btn-b btn-s" onclick="syncExport()">📤 Sync → autre appareil</button><button class="btn btn-g btn-s" onclick="syncImport()">📥 Importer sync</button></div><div class="small">PC + tablettes + smartphones : même dossier hébergé (<b>http://IP-DU-PC:8000</b>, même WiFi) ou sync par code/fichier. Le pointage de chaque agent suit son code sur tous les supports.</div></div>
    <div class="card"><h3>💾 Sauvegarde</h3><div class="toolbar"><button class="btn btn-p btn-s" onclick="exportJSON()">⬇ Export JSON</button><button class="btn btn-g btn-s" onclick="document.getElementById('imp').click()">⬆ Restaurer</button><input type="file" id="imp" accept=".json" style="display:none" onchange="importJSON(this)"><button class="btn btn-d btn-s" onclick="resetERP()">♻ Reset démo</button></div>
    <div class="small">${Math.round((localStorage.getItem(LS_KEY)||"").length/1024)} Ko • ${S.produits.length} art • ${S.ventes.length} tickets</div>
    <div class="toolbar"><button class="btn btn-o btn-s" onclick="modalPromo()">+ Promo</button><button class="btn btn-g btn-s" onclick="modalClient()">+ Fidélité</button></div></div>
  </div>`;
}
/* ---- Corbeille (Admin 7777 seul) : historique anti-vol des suppressions ---- */
function renderCorbeille(){
  if(!isSuperAdmin()){ alert("⛔ Corbeille réservée à l'ADMINISTRATEUR (code 7777) — ni gérant ni autres."); current="dashboard"; buildNav(); render(); return; }
  const rows=(S.corbeille||[]).slice(0,200);
  $("#view").innerHTML=`<div class="card"><h3>🗑 Corbeille — historique des suppressions (anti-vol interne) — Admin seul</h3>
  <div class="small">Tentatives + suppressions effectives : tickets, articles, promos, BC — avec auteur, poste, date et valeur. Exportable pour audit.</div>
  <div class="toolbar"><input placeholder="Filtrer (type, auteur, réf)…" oninput="filterTable('cbTbl',this.value)"><button class="btn btn-g btn-s" onclick="csvExport('corbeille_${todayStr()}.csv',['ID','Date','Heure','Type','Ref','Detail','Valeur','Auteur','Poste'],(S.corbeille||[]).map(c=>[c.id,c.date,c.heure,c.type,c.refId,c.detail,c.valeur,c.auteur,c.poste]))">⬇ Export corbeille</button></div>
  <div style="overflow:auto;max-height:60vh"><table id="cbTbl"><tr><th>Date</th><th>Type</th><th>Réf</th><th>Détail</th><th>Valeur</th><th>Auteur</th></tr>
  ${rows.map(c=>`<tr><td><span class="small">${c.date}<br>${c.heure}</span></td><td><span class="badge ${String(c.type).startsWith("TENTATIVE")?"b-bad":"b-warn"}">${esc(c.type)}</span></td><td><b>${esc(c.refId)}</b></td><td>${esc(c.detail)}<br><span class="small">${esc(c.auteur)} (${esc(c.poste)})</span></td><td><b>${fmtN(c.valeur||0)}</b></td><td>${esc(c.auteur)}</td></tr>`).join("")||"<tr><td colspan=6>Aucune suppression tracée ✅</td></tr>"}</table></div></div>`;
}
/* ---- FNE Côte d'Ivoire : espace facture normalisée (NCC, régime, TVA A/B/E, XOF) ---- */
function renderFNE(){
  if(!needRole("fne")){current="dashboard";buildNav();render();return;}
  const rows=(S.fne||[]).slice(0,30);
  $("#view").innerHTML=`<div class="card"><h3>🇨🇮 FNE — Facture Normalisée Électronique (DGI Côte d'Ivoire)</h3>
  <div class="small">Vendeur : <b>${esc(S.params.magasin)}</b> • NCC <b>${esc(S.params.ncc||"—")}</b> • ${esc(S.params.regime||"")} • ${esc(S.params.centreImpots||"")} • Devise <b>${esc(S.params.devise||"FCFA (XOF)")}</b> • TVA lettres A/B/E sur chaque ligne.</div>
  <div class="row2"><div><label>NCC vendeur</label><input id="fne_ncc" value="${esc(S.params.ncc||"")}"></div><div><label>Régime / Centre</label><input id="fne_reg" value="${esc((S.params.regime||"")+" — "+(S.params.centreImpots||""))}" placeholder="Régime — Centre"></div></div>
  <div class="toolbar"><button class="btn btn-p btn-s" onclick="S.params.ncc=$('#fne_ncc').value;save();alert('NCC enregistré');">💾 NCC</button><button class="btn btn-g btn-s" onclick="modalExport('ventes')">📤 Export ventes (base FNE)</button></div></div>
  <div class="card" style="margin-top:14px"><h3>🧾 Factures FNE émises (${(S.fne||[]).length}) — depuis un ticket (bouton FNE sur le détail)</h3>
  ${rows.map(f=>`<div class="alert a-green"><b>${f.id}</b> — Ticket ${f.ticket} • ${esc(f.client)} (NCC ${esc(f.nccCli||"—")}) • <b>${fmtN(f.total)}</b> • ${f.date} ${f.heure||""} <button class="btn btn-g btn-s" onclick='printHTML(${JSON.stringify(f.html||"").replace(/</g,"\\u003c")})'>🖨 Réimprimer</button></div>`).join("")||"<span class='small'>Aucune FNE. Ouvrez un ticket → 🧾 Facture PRO → 🇨🇮 FNE.</span>"}</div>`;
}
function fneDepuisTicket(id){
  const v=S.ventes.find(x=>x.id===id); if(!v) return;
  const cli=prompt("Client FNE (raison sociale) :", v.client||"ETS Client"); if(cli==null) return;
  const ncc=prompt("NCC client :", "CI-ABJ-2026-B-0000"); if(ncc==null) return;
  const num="FNE-"+todayStr().replace(/-/g,"")+"-"+String((S.fne||[]).length+1).padStart(4,"0");
  const recap=recapTaxes(v.lignes);
  const html=`<div class="ticket" style="font-size:12px"><center><b>${esc(S.params.magasin)}</b><br>${esc(S.params.adresse)} — ${esc(S.params.tel)}<br>NCC Vendeur : <b>${esc(S.params.ncc||"—")}</b><br>${esc(S.params.regime||"")} — ${esc(S.params.centreImpots||"")}<br><b>FACTURE NORMALISÉE ÉLECTRONIQUE ${num}</b><br>(Ticket ${v.id} du ${v.date} ${v.heure})</center><hr>Client : <b>${esc(cli)}</b><br>NCC client : ${esc(ncc)}<br>Caissier : ${esc(v.caissier)}<hr>${v.lignes.map((l,i)=>`${String(i+1).padStart(3,"0")} ${esc(l.nom)} (${l.code_tva})<br>${l.qte} x ${fmtN(l.pu)} = <b>${fmtN(l.total)}</b>`).join("<br>")}<hr><b>TVA (TTC, zone CFA — XOF)</b><table style="width:100%;font-size:11px"><tr><th>Code</th><th>Taux</th><th>Base HT</th><th>TVA</th><th>TTC</th></tr>${recap.map(r=>`<tr><td>${r.code}</td><td>${r.taux}%</td><td>${fmtN(r.ht)}</td><td>${fmtN(r.tva)}</td><td><b>${fmtN(r.ttc)}</b></td></tr>`).join("")}</table><hr><b>NET À PAYER : ${fmtN(v.total)} FCFA (XOF)</b><br><center>Document FNE — Signature & cachet : ______</center></div>`;
  S.fne.unshift({id:num,ticket:id,date:todayStr(),heure:nowHM(),client:cli,nccCli:ncc,total:v.total,agent:agent(),html}); save(); printHTML(html);
  alert(`🇨🇮 FNE ${num} émise (DGI CI, XOF).`);
}
/* ---- Scan code-barres smartphone (caméra) ---- */
function scanCode(target){
  openModal(`<h3>📷 Scanner code-barres (smartphone / tablette)</h3><div class="small">Pointez le code EAN dans le cadre. Compatible BarcodeDetector (Chrome/Android) + saisie manuelle / scanner USB.</div>
  <video id="scanVid" style="width:100%;border-radius:12px;background:#000" autoplay playsinline muted></video>
  <label>Code détecté / saisie manuelle (EAN, SKU)</label><input id="scanOut" placeholder="Ex : 6180303020079" onkeydown="if(event.key==='Enter')scanUse('${target}')">
  <div class="toolbar"><button class="btn btn-p" onclick="scanUse('${target}')">✅ Utiliser</button><button class="btn btn-g" onclick="scanStop();closeModal()">Fermer</button></div>`);
  scanStart(target);
}
function scanStop(){ try{ if(window._scanStream){ window._scanStream.getTracks().forEach(t=>t.stop()); window._scanStream=null; } }catch(e){} }
async function scanStart(target){
  try{
    if(!("BarcodeDetector" in window)) { const v=$("#scanVid"); if(v) v.outerHTML="<div class='alert a-yel'>Caméra auto non supportée ici — utilisez la saisie manuelle ou un scanner USB.</div>"; return; }
    const det=new BarcodeDetector({formats:["ean_13","ean_8","code_128","upc_a","qr_code"]});
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    window._scanStream=stream; const vid=$("#scanVid"); if(!vid) return; vid.srcObject=stream;
    const loop=async()=>{ if(!window._scanStream) return; try{ const b=await det.detect(vid); if(b&&b.length){ $("#scanOut").value=b[0].rawValue; scanStop(); scanUse(target); return; } }catch(e){} setTimeout(loop,400); };
    loop();
  }catch(e){ const v=$("#scanVid"); if(v) v.outerHTML="<div class='alert a-yel'>Caméra indisponible — saisie manuelle.</div>"; }
}
function choisirArticleScanne(sku){
  const p=S.produits.find(x=>x.sku===sku); if(!p) return;
  const marks=dlcMarksSKU(sku).filter(m=>dlcJours(m.dlc)>=0&&Number(m.qteRestante)>qteCartMark(m.id));
  const heldRegular=(S.holds||[]).flatMap(h=>h.cart||[]).filter(l=>l.sku===sku&&!l.markdownId).reduce((a,l)=>a+l.qte,0);
  const regular=Math.max(0,Number(p.stockRayon||0)-dlcReserveSKU(sku)-cart.filter(l=>l.sku===sku&&!l.markdownId).reduce((a,l)=>a+l.qte,0)-heldRegular);
  if(!marks.length){ if(regular>0) return addCart(sku); return alert("Aucune unité au prix normal disponible; vérifiez les lots DLC réservés ou périmés."); }
  if(marks.length===1&&regular<=0) return addCartDLC(marks[0].id);
  openModal(`<h3>🛒 ${esc(p.nom)} — choisir la variante</h3><div class="small">Le code-barres identifie l'article, mais choisissez le prix correspondant à l'étiquette de l'unité.</div>
    ${regular>0?`<button class="btn btn-p" style="width:100%;margin:6px 0" onclick="closeModal();addCart('${sku}')">Prix normal — ${fmtN(promoPrix(p).prix)} • ${fmtQ(regular)} unité(s)</button>`:""}
    ${marks.map(m=>`<button class="btn btn-o" style="width:100%;margin:6px 0" onclick="closeModal();addCartDLC('${m.id}')">🏷 DLC J-${m.palier} −${m.remisePct}% — ${fmtN(m.prixDLC)} • lot ${esc(m.lot||"—")} • ${fmtQ(Number(m.qteRestante)-qteCartMark(m.id))} unité(s)</button>`).join("")}
    <button class="btn btn-g" onclick="closeModal()">Annuler</button>`);
}
function scanUse(target){
  const val=($("#scanOut").value||"").trim(); if(!val) return alert("Scannez ou saisissez un code.");
  scanStop(); closeModal();
  const p=S.produits.find(x=>x.ean===val||x.sku===val);
  if(target==="pos"){ if(!p) return alert("Article inconnu : "+val); if($("#posSearch")){ $("#posSearch").value=p.nom; renderPOSTiles(); } choisirArticleScanne(p.sku); }
  else if(target==="mv"){ if(!p) return alert("Article inconnu."); $("#mv_sku").value=p.sku; }
  else if(target==="login"){ const e=S.employes.find(x=>x.code===val); if(e){ $("#loginCode").value=val; doLogin(); } else alert("Badge inconnu."); }
  else alert("Code : "+val+(p?" → "+p.nom:""));
}
function saveFiscal(){ if(!isAdmin()) return alert("⛔ Réservé Admin/Gérant."); S.fiscal=S.fiscal||{};
  const code=$("#fx_reg").value, R=REGIMES_FISCAUX[code]||REGIMES_FISCAUX.RSI;
  S.fiscal.entrepriseId=$("#fx_id").value.trim(); S.fiscal.raisonSociale=$("#fx_nom").value.trim()||S.params.magasin;
  S.fiscal.ncc=$("#fx_ncc").value.trim(); S.params.ncc=S.fiscal.ncc||S.params.ncc;
  S.fiscal.rccm=$("#fx_rccm").value.trim(); S.fiscal.regimeFiscal=code; S.fiscal.regime=R.label;
  const wantTVA=$("#fx_tva").value==="1"; S.fiscal.collecteTva=wantTVA;
  if(wantTVA&&R.collecteTva===false){ if(!confirm("Attention : le régime "+code+" ne collecte pas la TVA en principe. Forcer quand même la collecte ?")) S.fiscal.collecteTva=false; }
  const tse=Number($("#fx_tse").value); S.fiscal.tauxTse=Number.isFinite(tse)&&tse>=0?tse:R.tse;
  S.fiscal.adherentCga=!!$("#fx_cga").checked; S.fiscal.masquerDetailTvaSurTicket=!!$("#fx_masq").checked;
  S.fiscal.piedDePageTicket=$("#fx_pied").value; S.fiscal.devise="XOF";
  save(); alert("✅ Régime fiscal enregistré : "+code+" — "+(S.fiscal.collecteTva?"TVA collectée":"ticket simple sans TVA")+"."); render(); }
function saveParams(){ S.params.magasin=$("#a_mag").value; S.params.adresse=$("#a_adr").value; S.params.tel=$("#a_tel").value; S.params.NCC; S.params.ncc=$("#a_ncc")? $("#a_ncc").value:S.params.ncc; S.params.seuilAlerteDLC=+$("#a_dlc").value||7; S.params.paiements=$("#a_pay").value.split(",").map(s=>s.trim()).filter(Boolean); S.params.heureOuverture=$("#a_h")? $("#a_h").value:S.params.heureOuverture; S.params.quaiMaxH=+$("#a_quai")? +$("#a_quai").value:S.params.quaiMaxH; save(); alert("✅ Enregistré"); render(); }
function setPerm(role,mod,val){ if(!isAdmin()) return alert("⛔ Réservé Admin/Gérant."); S.rolePerms[role][mod]=!!val; save(); buildNav(); render(); }
function resetPerms(){ if(!isAdmin()) return alert("⛔ Réservé Admin/Gérant."); S.rolePerms=JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS)); save(); buildNav(); render(); }
function savePromoDLC(){ if(!isGerant()) return alert("⛔ Réservé au GÉRANT."); S.promoDLC={seuilJ:+$("#pd_seuil").value||20, remise:+$("#pd_rem").value||0, actif:false}; save(); alert("✅ Seuil + remise enregistrés (tamponnage manuel par vous)."); render(); }
function saveFidelite(){ if(!isAdmin()) return alert("⛔ Seuils définis par le Gérant uniquement."); S.fidelite={ptParF:+$("#fd_pt").value||1000, seuilPts:+$("#fd_seuil").value||100, valeurBon:+$("#fd_val").value||1000, remiseAuto:$("#fd_auto").value==="1"}; save(); alert("✅ Seuils fidélité enregistrés."); render(); }
/* Création rayon / famille / sous-famille par le gérant */
function modalRef(){
  openModal(`<h3>➕ Nouveau Rayon / Famille / Sous-famille</h3><div class="small">Ajouté au référentiel et proposé partout (catalogue, inventaires, transferts). Existant : ${REFERENTIEL.length} rayons.</div>
  <div class="row2"><div><label>Rayon (existant ou nouveau)</label><select id="rf_ray">${REFERENTIEL.map(r=>`<option value="${r.code}">${r.code} — ${esc(r.nom)}</option>`).join("")}<option value="NEW">＋ Nouveau rayon…</option></select></div><div><label>Nom nouveau rayon (si +)</label><input id="rf_raynew" placeholder="Ex : Papeterie Pro"></div></div>
  <div class="row2"><div><label>Famille (existante ou nouvelle)</label><input id="rf_fam" placeholder="Ex : Fournitures bureau" list="famList"><datalist id="famList">${REFERENTIEL.flatMap(r=>r.familles.map(f=>`<option value="${esc(f.nom)}">`)).join("")}</datalist></div><div><label>Sous-famille (nouvelle)</label><input id="rf_sous" placeholder="Ex : Ramettes A4"></div></div>
  <div class="toolbar"><button class="btn btn-p" onclick="saveRef()">Créer</button></div>`);
}
function saveRef(){
  if(!isAdmin()) return alert("⛔ Réservé Gérant/Admin.");
  let code=$("#rf_ray").value; const newName=$("#rf_raynew").value.trim();
  if(code==="NEW"){ if(!newName) return alert("Nom du nouveau rayon obligatoire."); code=String(REFERENTIEL.length+1).padStart(2,"0"); const cr={code,nom:newName,icone:"📁",familles:[]}; REFERENTIEL.push(cr); S.customRef.rayons.push(JSON.parse(JSON.stringify(cr))); }
  const r=REFERENTIEL.find(x=>x.code===code);
  const famN=$("#rf_fam").value.trim(), sousN=$("#rf_sous").value.trim();
  if(famN){ let f=r.familles.find(x=>x.nom.toLowerCase()===famN.toLowerCase()); if(!f){ f={code:String(r.familles.length+1).padStart(2,"0"),nom:famN,sous:[]}; r.familles.push(f); } if(sousN&&!f.sous.includes(sousN)) f.sous.push(sousN); }
  const cr=S.customRef.rayons.find(x=>x.code===code); if(cr) Object.assign(cr,JSON.parse(JSON.stringify(r))); else S.customRef.rayons.push(JSON.parse(JSON.stringify(r)));
  save(); closeModal(); alert("✅ Référentiel enrichi : rayon "+r.nom); render();
}
/* Sync multi-appareils : code texte à copier */
function syncExport(){ const txt=btoa(unescape(encodeURIComponent(JSON.stringify(S)))); openModal(`<h3>📤 Sync multi-appareils — envoyer vers PC / tablette / smartphone</h3><div class="small">1) Copiez ce code<br>2) Sur l'autre appareil : Admin → 📥 Importer sync → collez → Valider.<br>Pour du temps réel : hébergez ce dossier sur le PC-caisse (<b>python -m http.server</b>) et ouvrez <b>http://IP-DU-PC:8000</b> sur tablettes/smartphones du même WiFi.</div><textarea id="syncTxt" rows="6" readonly>${txt.slice(0,4000)}${txt.length>4000?"…(+copie complète via Export JSON pour les grosses bases)":""}</textarea><div class="toolbar"><button class="btn btn-g btn-s" onclick="document.getElementById('syncTxt').select();document.execCommand('copy')">📋 Copier</button><button class="btn btn-p btn-s" onclick="exportJSON()">⬇ Plutôt fichier JSON (recommandé si base lourde)</button></div>`); S._syncFull=txt; }
function syncImport(){ openModal(`<h3>📥 Importer sync (depuis un autre appareil)</h3><textarea id="syncIn" rows="6" placeholder="Collez le code sync…"></textarea><div class="toolbar"><button class="btn btn-p" onclick="doSyncImport()">Valider & remplacer</button></div>`); }
function doSyncImport(){ try{ const t=$("#syncIn").value.trim(); const o=JSON.parse(decodeURIComponent(escape(atob(t)))); if(!o.produits) throw 0; if(!confirm("Remplacer les données de CET appareil par celles reçues ?")) return; S=o; try{applyCustomRef();}catch(e){} migrate(); save(); closeModal(); location.reload(); }catch(e){ alert("Code invalide."); } }
function exportJSON(){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([localStorage.getItem(LS_KEY)],{type:"application/json"})); a.download="sauvegarde-assomi-"+todayStr()+".json"; a.click(); }
function importJSON(inp){ const f=inp.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{S=JSON.parse(r.result); migrate(); save(); alert("✅ Restauré"); render();}catch(e){alert("Fichier invalide.");} }; r.readAsText(f); }
function resetERP(){ if(!confirm("Réinitialiser les données locales ? Les données synchronisées du serveur ne sont pas supprimées.")) return; localStorage.removeItem(LS_KEY); S=defaultStore(); save(); location.reload(); }

/* ---------- Modales ---------- */
function openModal(html, lock){ $("#modalBox").innerHTML=html; $("#modalBg").classList.add("open"); $("#modalBg").dataset.lock=lock?"1":""; }
function closeModal(){ if($("#modalBg").dataset.lock==="1"&&!S.session) return; $("#modalBg").classList.remove("open"); }
function modalPromo(){ openModal(`<h3>🎁 Promo</h3><label>Nom</label><input id="pr_nom"><div class="row2"><div><label>Type</label><select id="pr_type"><option value="%">Remise %</option><option value="1+1">1+1 offert</option></select></div><div><label>Valeur %</label><input id="pr_val" type="number" value="10"></div></div><label>Article (EAN)</label><select id="pr_cib">${S.produits.map(p=>`<option value="${p.ean}">${esc(p.nom)}</option>`).join("")}</select><div class="toolbar"><button class="btn btn-o" onclick="savePromo()">Créer</button></div>`); }
function savePromo(){ S.promos.push({id:"PROMO"+(S.promos.length+1),nom:$("#pr_nom").value||"Promo",type:$("#pr_type").value,valeur:+$("#pr_val").value||0,cible:$("#pr_cib").value,debut:todayStr(),fin:"2099-12-31",actif:true}); save(); closeModal(); render(); }
function modalClient(){ openModal(`<h3>💳 Fidélité</h3><div class="row2"><div><label>Nom</label><input id="cl_nom"></div><div><label>Tél</label><input id="cl_tel"></div></div><div class="toolbar"><button class="btn btn-p" onclick="saveClient()">Créer</button></div>`); }
function saveClient(){ const n=$("#cl_nom").value.trim(); if(!n) return alert("Nom obligatoire."); S.clients.push({id:"C"+String(S.clients.length+1).padStart(3,"0"),nom:n,tel:$("#cl_tel").value,points:0,achats:0}); save(); closeModal(); render(); }

/* ---------- Pavé tactile (caisse + codes + quantités) ---------- */
let padTarget=null;
function padShow(targetId){ padTarget=targetId; const el=document.getElementById(targetId); openModal(`<h3>🔢 Pavé tactile</h3><input id="padView" value="${el?esc(el.value||""):""}" readonly style="font-size:24px;text-align:center;letter-spacing:2px">
<div class="pad-grid">${["1","2","3","4","5","6","7","8","9","00","0","."].map(k=>`<button class="pad-k" onclick="padKey('${k}')">${k}</button>`).join("")}</div>
<div class="toolbar"><button class="btn btn-g" onclick="padKey('C')">C</button><button class="btn btn-g" onclick="padKey('B')">⌫</button><button class="btn btn-p" onclick="padOk()">OK ✓</button></div>
<div class="toolbar">${[500,1000,2000,5000,10000].map(m=>`<button class="btn btn-g btn-s" onclick="padSet(${m})">${m}</button>`).join("")}<button class="btn btn-o btn-s" onclick="padExact()">Appoint</button></div>`); }
function padKey(k){ const v=$("#padView"); if(k==="C") v.value=""; else if(k==="B") v.value=v.value.slice(0,-1); else v.value+=k; }
function padSet(m){ $("#padView").value=m; }
function padExact(){ if(typeof cartTotal==="function") $("#padView").value=cartTotal(); }
function padOk(){ if(padTarget){ const el=document.getElementById(padTarget); if(el){ el.value=$("#padView").value; el.dispatchEvent(new Event("input")); } } padTarget=null; closeModal(); }
/* Caisse tactile : grosses touches intégrées */
function toggleTact(){ window._tact=!window._tact; renderPOS(); }
function tactNum(k){ const el=document.getElementById('posRecu'); if(!el) return; if(k==='C') el.value=''; else if(k==='⌫') el.value=String(el.value).slice(0,-1); else el.value=String(el.value||'')+k; liveRendu(); }
function tactMoney(m){ const el=document.getElementById('posRecu'); if(el){ el.value=m; liveRendu(); } }
function tactExact(){ const el=document.getElementById('posRecu'); if(el){ el.value=cartTotal()-(typeof fideliteRemise==="function"?fideliteRemise().remise:0); liveRendu(); } }
/* ---------- Exports avec plage de dates (TCD approfondi) ---------- */
function modalExport(kind){
  openModal(`<h3>📤 Export ${esc(kind)} — choisir période (une ou plusieurs dates)</h3>
  <div class="row2"><div><label>Du</label><input id="ex_du" type="date" value="${todayStr().slice(0,8)}01"></div><div><label>Au</label><input id="ex_au" type="date" value="${todayStr()}"></div></div>
  <div class="small">Astuce TCD : gardez les colonnes Date / Caissier / CodeTVA / Paiement / Article pour croiser jour × rayon × TVA.</div>
  <div class="toolbar"><button class="btn btn-p" onclick="doExportDates('${kind}')">⬇ Exporter CSV</button><button class="btn btn-g" onclick="closeModal()">Annuler</button></div>`);
}
function inRange(d,a,b){ return (!a||d>=a)&&(!b||d<=b); }
function doExportDates(kind){
  const a=$("#ex_du").value, b=$("#ex_au").value;
  if(kind==="ventes"){ const rows=[]; S.ventes.filter(v=>v.statut!=="Annulé"&&inRange(v.date,a,b)).forEach(v=>v.lignes.forEach(l=>{const p=S.produits.find(x=>x.sku===l.sku);rows.push([v.id,v.date,v.heure,v.caissier,l.sku,l.nom,p?rayonNom(p.rayon):"",l.qte,l.pu,l.total,collecteTvaActive()?(l.code_tva||""):"—",v.paiement,v.client||"",regimeCode(),(S.fiscal&&S.fiscal.ncc)||S.params.ncc||"",Number.isFinite(Number(l.cout))?l.cout:""]);})); csvExport(`ventes_${a}_${b}.csv`,["Ticket","Date","Heure","Caissier","SKU","Article","Rayon","Qte","PU_TTC","Total_TTC","CodeTVA","Paiement","Client","Regime","NCC_Vendeur","CoutLot"],rows); }
  if(kind==="mouvements"){ const rows=S.mouvements.filter(m=>inRange(m.date,a,b)).map(m=>[m.id,m.date,m.heure,m.type,m.sku,m.nom,m.qte,m.motif,m.ref,m.agent,m.src||"",m.dst||""]); csvExport(`mouvements_${a}_${b}.csv`,["ID","Date","Heure","Type","SKU","Article","Qte","Motif","Ref","Agent","Source","Destination"],rows); }
  if(kind==="demarques"){ const rows=S.demarques.filter(m=>inRange(m.date,a,b)).map(d=>[d.id,d.date,d.article,d.sku,d.qte,d.valeurAchat,d.famille,d.motif,d.agent,d.comment||""]); csvExport(`demarques_${a}_${b}.csv`,["ID","Date","Article","SKU","Qte","ValeurAchat","Famille","Motif","Agent","Comment"],rows); }
  if(kind==="bl"){ const rows=[]; S.bls.filter(x=>inRange(x.date,a,b)).forEach(bl=>bl.lignes.forEach(l=>rows.push([bl.id,bl.date,bl.fournisseur,bl.bcId,bl.agent,l.sku,l.nom,l.qte]))); csvExport(`bl_${a}_${b}.csv`,["BL","Date","Fournisseur","BC","Agent","SKU","Article","Qte"],rows); }
  closeModal(); alert("⬇ Export prêt — analysez via Tableau croisé dynamique.");
}
/* ---------- Facture PRO avec TVA ---------- */
function facturePro(id){
  const v=S.ventes.find(x=>x.id===id); if(!v) return;
  const cli=prompt("Raison sociale du client PRO :", v.client||"ETS Client Pro"); if(cli==null) return;
  const ncc=prompt("NCC / Registre de commerce :", "CI-ABJ-2026-B-0000"); if(ncc==null) return;
  const num="FP"+String(S.seq.facturePro++).padStart(5,"0");
  const recap=recapTaxes(v.lignes);
  const tse=totalTSE(v.lignes);
  S.facturesPro.unshift({id:num, ticket:id, date:todayStr(), client:cli, ncc, total:v.total, tse:Math.round(tse), regime:(S.fiscal&&S.fiscal.regimeFiscal)||regimeCode(), lignes:v.lignes, agent:agent()}); save();
  printHTML(`<div class="ticket" style="font-size:13px"><center><b>${esc(S.params.magasin)}</b><br>${esc(S.params.adresse)} — ${esc(S.params.tel)}<br><b>FACTURE PRO ${num}</b> (Ticket ${v.id} du ${v.date} ${v.heure})</center><hr>Client : <b>${esc(cli)}</b><br>NCC : ${esc(ncc)}<br>Caissier : ${esc(v.caissier)}<hr>${v.lignes.map((l,i)=>`${String(i+1).padStart(3,"0")} ${esc(l.nom)} (${l.code_tva})<br>${l.qte} x ${fmtN(l.pu)} = <b>${fmtN(l.total)}</b>`).join("<br>")}<hr><b>DÉTAIL TVA (prix TTC)</b><table style="width:100%;font-size:12px"><tr><th>Code</th><th>Taux</th><th>HT</th><th>TVA</th><th>TTC</th></tr>${recap.map(r=>`<tr><td>${r.code}</td><td>${r.taux}%</td><td>${fmtN(r.ht)}</td><td>${fmtN(r.tva)}</td><td><b>${fmtN(r.ttc)}</b></td></tr>`).join("")}</table><hr><b>NET À PAYER : ${fmtN(v.total)}</b><br><center>Arrêtée la présente facture — Signature & cachet : ______</center></div>`);
  if(current==="compta") render(); else renderPOS();
}
/* ---------- Ventes en attente (caisse) ---------- */
function holdSale(){ if(!cart.length) return alert("Panier vide."); const cli=$("#posClient")?($("#posClient").selectedOptions[0].text||""):""; S.holds.unshift({id:"H"+Date.now().toString(36).toUpperCase(), heure:nowHM(), agent:agent(), client:cli, cart:JSON.parse(JSON.stringify(cart))}); cart=[]; save(); renderCart(); renderHolds(); }
function renderHolds(){ const box=$("#holdsBox"); if(!box) return; box.innerHTML=S.holds.length?S.holds.map(h=>`<div class="cart-line"><span><b>${h.id}</b> ${h.heure} • ${esc(h.agent)}<br><span class="small">${esc(h.client||"Comptant")} • ${h.cart.reduce((a,l)=>a+l.qte,0)} art • ${fmtN(h.cart.reduce((a,l)=>a+l.qte*l.pu,0))}</span></span><span><button class="btn btn-p btn-s" onclick="resumeHold('${h.id}')">↩ Reprendre</button> <button class="btn btn-g btn-s" onclick="delHold('${h.id}')">✕</button></span></div>`).join(""):"<span class='small'>Aucune vente en attente.</span>"; }
function resumeHold(id){ const h=S.holds.find(x=>x.id===id); if(!h) return; if(cart.length&&!confirm("Remplacer le panier en cours par la vente "+id+" ?")) return; cart=h.cart; S.holds=S.holds.filter(x=>x.id!==id); save(); renderCart(); renderHolds(); }
function delHold(id){ S.holds=S.holds.filter(x=>x.id!==id); save(); renderHolds(); }
/* ---------- TVA automatique à la création article ---------- */
function tvaAuto(rc,famCode,sous){ const fam=(familleParCode(rc,famCode)||{}).nom||""; const s=(sous||"")+" "+fam;
  if(/fruit|légume|legume|agrume|viande|porc|volaille|poulet|poisson|boeuf|bovine|riz local|pain/i.test(s)) return "E";
  if(/lait|beurre|crème|creme|yaourt|huile.*raffin|table.*raffin|croquette|pâtée|patee|litière|litiere|aliment.*bébé/i.test(s)) return "B";
  return "A"; }
function refreshProduitAuto(){ const rc=$("#f_rayon").value, fc=$("#f_fam").value, ss=$("#f_sous").value; const sug=tvaAuto(rc,fc,ss); const sel=$("#f_ctva"); if(sel&&!sel.dataset.touched) sel.value=sug; const prev=$("#skuPrev"); if(prev) prev.innerHTML=`Chemin : <b>${rc} / ${fc} / ${sousCode(rc,fc,ss)}</b> (${esc(rayonNom(rc))} → ${esc((familleParCode(rc,fc)||{}).nom||"")} → ${esc(ss)}) • TVA suggérée : <b>${sug} ${tauxOf(sug)}%</b> • SKU final : <b>${rc}${fc}${sousCode(rc,fc,ss)}XXXX</b>`; }
/* ---------- PV inventaire détaillé (Réserve + Rayon séparés, auto-imprimé à validation) ---------- */
function printInvPV(id){ const i=S.inventaires.find(x=>x.id===id); if(!i) return;
  const ecarts=i.lignes.filter(l=>(l.ecart||0)!==0);
  printHTML(`<div style="font-family:Arial;font-size:12px;max-width:760px;margin:auto"><center><b style="font-size:17px">${esc(S.params.magasin)}</b><br>${esc(S.params.adresse)} — ${esc(S.params.tel)}<br><h2>PROCÈS-VERBAL D'INVENTAIRE ${i.id}</h2></center><table style="width:100%;border-collapse:collapse" border="1" cellpadding="6"><tr><td><b>Date :</b> ${i.date}</td><td><b>Périmètre :</b> ${esc(i.perimetre)}</td></tr><tr><td><b>Fréquence :</b> ${esc(i.freq)}</td><td><b>Agent :</b> ${esc(i.agent)}</td></tr></table><br><table style="width:100%;border-collapse:collapse;font-size:11px" border="1" cellpadding="4"><tr><th>#</th><th>Article / SKU</th><th>Syst. Réserve</th><th>Cpt. Réserve</th><th>Syst. Rayon</th><th>Cpt. Rayon</th><th>Écart total</th><th>Valeur (achat HT)</th></tr>${i.lignes.map((l,k)=>{const p=S.produits.find(x=>x.sku===l.sku);const val=(p?p.achat:0)*Math.abs(l.ecart||0);const tR=l.theoR??l.theo,cR=l.compteR??l.compte,tM=l.theoM??0,cM=l.compteM??0;return `<tr><td>${k+1}</td><td>${esc(l.nom)}<br><small>${l.sku}</small></td><td>${fmtQ(tR)}</td><td><b>${fmtQ(cR)}</b></td><td>${fmtQ(tM)}</td><td><b>${fmtQ(cM)}</b></td><td><b>${fmtQ(l.ecart)}</b></td><td>${(l.ecart||0)<0?"-"+fmtN(val):fmtN(0)}</td></tr>`;}).join("")}</table><br><b>Lignes en écart : ${ecarts.length}/${i.lignes.length} — Perte valorisée : ${fmtN(Math.abs(i.ecartVal))}</b><br><br><table style="width:100%" border="0"><tr><td>Agent : ______<br>Date/heure : ______</td><td>Chef de rayon : ______</td><td>Gérant (cachet) : ______</td></tr></table><center><small>Document généré par l'ERP — Imprimer → Enregistrer en PDF.</small></center></div>`); }
/* ================= SYNC TEMPS RÉEL MULTI-POSTES =================
   Chaque opération pousse au serveur (même origine) ; chaque poste tire
   les nouveautés toutes les 3 s. Ventes caisse = opération ATOMIQUE serveur.
   Sans serveur (fichier local) : mode local, sync par code/fichier (Admin). */
var SYNC={on:false,ver:0,pushing:false,base:""};
SYNC.q=s=>encodeURIComponent(s);
SYNC.setBadge=function(){
  const b=document.getElementById("syncBadge"); if(!b) return;
  b.innerHTML=SYNC.on?`<span class="badge b-ok">🟢 Temps réel • v${SYNC.ver}</span>`:`<span class="badge b-grey">🔴 Local (1 poste)</span>`;
};
SYNC.boot=async function(){
  try{
    const r=await fetch("api/state",{cache:"no-store"});
    if(!r.ok) throw 0;
    const j=await r.json();
    SYNC.on=true; SYNC.ver=j.version||0;
    if(j.state&&j.state.produits){ const sess=S.session, holds=S.holds, caisse=S.caisse;
      S=j.state; S.session=sess; S.holds=holds||[]; S.caisse=caisse||S.caisse;
      try{applyCustomRef();}catch(e){} migrate();
      localStorage.setItem(LS_KEY,JSON.stringify(Object.assign({},S,{session:null}))); buildNav(); render();
    } else { await SYNC.push(true); }
    SYNC.setBadge();
    SYNC.pollT=setInterval(SYNC.pull,3000);
  }catch(e){ SYNC.on=false; SYNC.setBadge(); }
};
SYNC.schedule=function(){ if(!SYNC.on||SYNC.pushing) return; clearTimeout(SYNC.pushT); SYNC.pushT=setTimeout(()=>SYNC.push(false),900); };
SYNC.push=async function(force){
  if(!SYNC.on||SYNC.pushing) return;
  SYNC.pushing=true;
  try{
    const lite=Object.assign({},S,{session:null,holds:[],caisse:undefined});
    const r=await fetch("api/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({baseVersion:SYNC.ver,state:lite,agent:agent()})});
    const j=await r.json();
    if(j.version) SYNC.ver=j.version;
  }catch(e){}
  SYNC.pushing=false; SYNC.setBadge();
};
SYNC.pull=async function(){
  if(!SYNC.on||SYNC.pushing) return;
  try{
    const r=await fetch("api/state",{cache:"no-store"}); if(!r.ok) return;
    const j=await r.json();
    if((j.version||0)>SYNC.ver&&j.state&&j.state.produits){
      const sess=S.session, holds=S.holds, caisse=S.caisse;
      const modalOpen=document.getElementById("modalBg").classList.contains("open");
      S=j.state; S.session=sess; S.holds=holds||[]; S.caisse=caisse||S.caisse;
      try{applyCustomRef();}catch(e){}
      localStorage.setItem(LS_KEY,JSON.stringify(Object.assign({},S,{session:null})));
      SYNC.ver=j.version; SYNC.setBadge();
      if(!modalOpen){ try{buildNav(); render();}catch(e){} }
      else { const t=document.getElementById("syncBadge"); if(t) t.title="Données actualisées"; }
    }
  }catch(e){}
};
SYNC.opSale=async function(payload){
  const r=await fetch("api/op/sale",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const j=await r.json();
  if(!r.ok) throw j;
  SYNC.ver=j.version; SYNC.setBadge(); await SYNC.pullForce(); return j;
};
SYNC.pullForce=async function(){
  try{ const r=await fetch("api/state",{cache:"no-store"}); const j=await r.json();
    if(j.state&&j.state.produits){ const sess=S.session,holds=S.holds,caisse=S.caisse; S=j.state; S.session=sess; S.holds=holds||[]; S.caisse=caisse||S.caisse; try{applyCustomRef();}catch(e){} localStorage.setItem(LS_KEY,JSON.stringify(Object.assign({},S,{session:null}))); SYNC.ver=j.version; }
  }catch(e){}
};
/* ---------- Promos gérant : rectifier / supprimer / tamponner ---------- */
function modalPromoEdit(id){
  if(!isAdmin()) return alert("⛔ Promos gérées par le Gérant / Admin.");
  const p=S.promos.find(x=>x.id===id); if(!p) return;
  openModal(`<h3>🎁 Rectifier la promo ${p.id}</h3><label>Nom</label><input id="pe_nom" value="${esc(p.nom)}">
  <div class="row2"><div><label>Type</label><select id="pe_type"><option value="%" ${p.type==="%"?"selected":""}>Remise %</option><option value="1+1" ${p.type==="1+1"?"selected":""}>1 acheté = 1 offert</option></select></div><div><label>Valeur %</label><input id="pe_val" type="number" value="${p.valeur||0}"></div></div>
  <label>Article ciblé (EAN)</label><select id="pe_cib">${S.produits.map(x=>`<option value="${x.ean}" ${x.ean===p.cible?"selected":""}>${esc(x.nom)} — ${x.ean}</option>`).join("")}</select>
  <div class="row2"><div><label>Début</label><input id="pe_d" type="date" value="${p.debut}"></div><div><label>Fin</label><input id="pe_f" type="date" value="${p.fin}"></div></div>
  <div class="toolbar"><button class="btn btn-p" onclick="savePromoEdit('${id}')">💾 Rectifier</button><button class="btn btn-d" onclick="delPromo('${id}')">🗑 Supprimer</button></div>`);
}
function savePromoEdit(id){ const p=S.promos.find(x=>x.id===id); Object.assign(p,{nom:$("#pe_nom").value,type:$("#pe_type").value,valeur:+$("#pe_val").value||0,cible:$("#pe_cib").value,debut:$("#pe_d").value,fin:$("#pe_f").value}); save(); closeModal(); render(); }
function delPromo(id){ if(!isGerant()) return alert("⛔ Suppression promo : réservée au GÉRANT."); const p=S.promos.find(x=>x.id===id); if(!confirm("GÉRANT — supprimer cette promo ?")) return; S.promos=S.promos.filter(x=>x.id!==id); try{logCorbeille("SUPPR_PROMO", id, p?p.nom:"", 0);}catch(e){} save(); closeModal(); render(); }
/* Tampon promo : le gérant clique l'article et tamponne la promo */
function stampPromo(sku){
  if(!isAdmin()) return alert("⛔ Tampon promo réservé au Gérant / Admin.");
  const p=S.produits.find(x=>x.sku===sku); if(!p) return;
  const type=prompt(`Tamponner PROMO sur « ${p.nom} » (${fmtN(p.vente)} TTC) :\nTapez "%" pour remise % ou "1" pour 1+1 :`,"%"); if(type==null) return;
  let val=0;
  if(type.trim()==="1"){ S.promos.push({id:"PROMO"+(S.promos.length+1),nom:"1+1 — "+p.nom,type:"1+1",valeur:0,cible:p.ean,debut:todayStr(),fin:"2099-12-31",actif:true}); }
  else{ val=+prompt("Pourcentage de remise :","20"); if(!val) return; S.promos.push({id:"PROMO"+(S.promos.length+1),nom:`-${val}% — `+p.nom,type:"%",valeur:val,cible:p.ean,debut:todayStr(),fin:"2099-12-31",actif:true}); }
  save(); alert(`🎫 Tampon PROMO apposé sur ${p.nom} — visible en caisse (badge) et tickets.`); render();
}
/* ---------- Pointage permanent en haut (tous modules) ---------- */
function ptStatus(){
  const m=me(); if(!m) return {txt:"—",open:null};
  const open=S.pointages.find(p=>p.code===m.code&&!p.fin);
  const today=S.pointages.filter(p=>p.code===m.code&&p.date===todayStr());
  return {open,today,txt:open?`En service depuis ${open.debut}`:(today.length?`${today.length} service(s) • dernier ${today[0].fin||"…"}`:"Non pointé")};
}
function updatePtBadge(){
  const b=document.getElementById("ptBadge"); if(!b) return;
  if(!S.session){ b.innerHTML=""; return; }
  const st=ptStatus();
  b.innerHTML=`<button class="btn ${st.open?"btn-p":"btn-o"} btn-s" onclick="modalPointage()" title="Pointage ${esc(S.session.nom)}">⏱ ${st.open?"🟢 "+esc(st.open.debut):"🔴 Pointer"} <span class="small">${esc(st.txt.slice(0,34))}</span></button>`;
}
function modalPointage(){
  const m=me(); const code=m?m.code:"";
  const today=(S.pointages||[]).filter(p=>m&&p.code===m.code&&p.date===todayStr());
  openModal(`<h3>⏱ Pointage — ${esc(agent())}</h3><div class="small">Votre code d'accès : <b>${esc(code)}</b> • Affiché en haut sur tous vos écrans (caisse, stocks, inventaires…).</div>
  <label>Code agent <button class="btn btn-g btn-s" onclick="padShow('pt_code2')">🔢 Pavé</button></label><input id="pt_code2" value="${esc(code)}">
  <div class="toolbar"><button class="btn btn-p" onclick="doPointageModal('debut')">▶ Début de service</button><button class="btn btn-d" onclick="doPointageModal('fin')">⏹ Fin de service</button></div>
  ${today.map(p=>`<div class="small">${p.date} : ${p.debut||"—"} → ${p.fin||"<b>en service</b>"} ${p.duree?"(<b>"+p.duree+"</b>)":""}</div>`).join("")||"<span class='small'>Pas encore pointé aujourd'hui.</span>"}`);
}
function doPointageModal(sens){
  const c=($("#pt_code2").value||"").trim(); const e=S.employes.find(x=>x.code===c&&x.statut==="Actif");
  if(!e) return alert("Code inconnu.");
  if(sens==="debut"){ if(S.pointages.find(p=>p.code===c&&p.date===todayStr()&&!p.fin)) return alert("Service déjà ouvert."); S.pointages.unshift({id:uid("PT"),code:c,nom:e.nom,date:todayStr(),debut:nowHM(),fin:"",duree:""}); }
  else{ const o=S.pointages.find(p=>p.code===c&&!p.fin); if(!o) return alert("Aucun service ouvert."); o.fin=nowHM(); const[a,b]=o.debut.split(":").map(Number),[cc,dd]=o.fin.split(":").map(Number); let mm=(cc*60+dd)-(a*60+b); if(mm<0)mm+=1440; o.duree=Math.floor(mm/60)+"h"+String(mm%60).padStart(2,"0"); }
  save(); updatePtBadge(); modalPointage(); try{render();}catch(e){}
}
/* ---------- Init ---------- */
document.addEventListener("keydown",e=>{ if(e.key==="F9"&&current==="pos"){e.preventDefault();encaisser();} if(e.key==="Escape")closeModal(); });
$("#modalBg").addEventListener("click",e=>{ if(e.target.id==="modalBg")closeModal(); });
try{ applyCustomRef(); }catch(e){}
buildNav(); render(); updatePtBadge(); SYNC.setBadge();
SYNC.boot();
if(!S.session) loginScreen();
