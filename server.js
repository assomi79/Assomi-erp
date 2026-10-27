/* ASSOMi — Serveur temps réel multi-postes (zéro dépendance, Node.js natif)
   Lancement :  node server.js  [PORT]
   - Héberge l'ERP (http://IP-DU-PC:8000) pour caisses, PC, tablettes, smartphones, PDA (même WiFi/réseau)
   - Base centrale db.json + versions : chaque opération d'un agent est poussée au serveur
     et redescendue sur tous les postes en ~2-3 s (données exactes partout)
   - Ventes caisse via /api/op/sale ATOMIQUE (anti double-vente du même stock)
*/
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = +(process.argv[2] || process.env.PORT || 8000);
const ROOT = __dirname;
const DBF = path.join(ROOT, "db.json");

let DB = { version: 0, state: null };
try {
  if (fs.existsSync(DBF)) DB = JSON.parse(fs.readFileSync(DBF, "utf8"));
  if (typeof DB.version !== "number") DB.version = 0;
} catch (e) { console.log("DB illisible, on repart à zéro."); DB = { version: 0, state: null }; }

const EPHEMERAL = process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.KOYEB;
function persist() {
  try { fs.writeFileSync(DBF, JSON.stringify(DB)); }
  catch (e) { if(!EPHEMERAL) console.log("Ecriture db.json impossible:", e.message); }
}

/* Listes à fusion par id (ajouts des deux côtés conservés ; même id = dernier écrivain gagne) */
const APPEND = ["ventes","mouvements","bcs","bls","inventaires","demarques","dlcMarks","lots","zClotures",
  "factures","facturesPro","pointages","conges","delRequests","corbeille","fne","tasksDone"];
const KEYED = [["produits","sku"],["fournisseurs","id"],["employes","id"],["clients","id"],["promos","id"]];

function unionById(serverArr, inArr) {
  const m = new Map();
  (serverArr || []).forEach(o => { if (o && o.id !== undefined) m.set(o.id, o); });
  (inArr || []).forEach(o => { if (o && o.id !== undefined) m.set(o.id, o); });
  return [...m.values()];
}
function unionByKey(serverArr, inArr, key) {
  const m = new Map();
  (serverArr || []).forEach(o => { if (o && o[key] !== undefined) m.set(o[key], o); });
  (inArr || []).forEach(o => { if (o && o[key] !== undefined) m.set(o[key], o); });
  return [...m.values()];
}
function maxSeq(a, b) {
  const o = Object.assign({}, a);
  Object.keys(b || {}).forEach(k => { o[k] = Math.max(+a?.[k] || 0, +b?.[k] || 0); });
  return o;
}
function mergeCustom(a, b) {
  const out = { rayons: [] };
  const m = new Map();
  (a?.rayons || []).forEach(r => m.set(r.code, JSON.parse(JSON.stringify(r))));
  (b?.rayons || []).forEach(r => {
    if (!m.has(r.code)) m.set(r.code, JSON.parse(JSON.stringify(r)));
    else {
      const cur = m.get(r.code);
      (r.familles || []).forEach(f => {
        let cf = cur.familles.find(x => x.code === f.code);
        if (!cf) cur.familles.push(JSON.parse(JSON.stringify(f)));
        else (f.sous || []).forEach(s => { if (!cf.sous.includes(s)) cf.sous.push(s); });
      });
    }
  });
  out.rayons = [...m.values()];
  return out;
}

/* Fusionne l'état entrant dans l'état central. Jamais de perte d'écritures : union + LWW. */
function mergeState(cur, inc) {
  if (!cur) return inc;
  if (!inc) return cur;
  const out = Object.assign({}, cur);
  APPEND.forEach(k => { out[k] = unionById(cur[k], inc[k]); });
  KEYED.forEach(([k, key]) => { out[k] = unionByKey(cur[k], inc[k], key); });
  // suppressions (corbeilles)
  const trash = inc.trash || {};
  if ((trash.produits || []).length) out.produits = (out.produits || []).filter(p => !trash.produits.includes(p.sku));
  if ((trash.bcs || []).length) out.bcs = (out.bcs || []).filter(b => !trash.bcs.includes(b.id));
  out.trash = { produits: [...new Set([...(cur.trash?.produits || []), ...(trash.produits || [])])],
                bcs: [...new Set([...(cur.trash?.bcs || []), ...(trash.bcs || [])])] };
  // réglages / référentiel : dernier écrivain gagne, compteurs = max
  ["params","fiscal","rolePerms","fidelite","promoDLC","customRef"].forEach(k => { if (inc[k] !== undefined) out[k] = inc[k]; });
  if (inc.customRef || cur.customRef) out.customRef = mergeCustom(cur.customRef, inc.customRef);
  out.compteurSKU = Math.max(+cur.compteurSKU || 0, +inc.compteurSKU || 0);
  out.seq = maxSeq(cur.seq, inc.seq);
  // caisse / session / holds = locaux à chaque poste, jamais synchronisés
  out.caisse = cur.caisse;
  delete out.session; delete out.holds;
  return out;
}

function stripLocal(state) {
  if (!state || typeof state !== "object") return state;
  const s = Object.assign({}, state);
  delete s.session; delete s.holds;
  delete s.caisse;
  return s;
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(body);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".ico": "image/x-icon" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");

  /* ---------- API ---------- */
  if (url.pathname === "/api/health") return send(res, 200, { ok: true, version: DB.version, time: new Date().toISOString() });

  if (url.pathname === "/api/state" && req.method === "GET")
    return send(res, 200, { version: DB.version, state: DB.state });

  if (url.pathname === "/api/save" && req.method === "POST") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 25 * 1024 * 1024) req.destroy(); });
    req.on("end", () => {
      try {
        const inc = JSON.parse(body);
        const clean = stripLocal(inc.state);
        DB.state = mergeState(DB.state, clean);
        DB.version++;
        persist();
        send(res, 200, { ok: true, version: DB.version });
      } catch (e) { send(res, 400, { error: "JSON invalide" }); }
    });
    return;
  }

  /* Vente atomique : stock article + quotas DLC débités dans une seule transaction */
  if (url.pathname === "/api/op/sale" && req.method === "POST") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 5 * 1024 * 1024) req.destroy(); });
    req.on("end", () => {
      try {
        const { sale, dec, movements, pts, markdownDec = {} } = JSON.parse(body);
        if (!DB.state) return send(res, 409, { error: "EMPTY", message: "Base vide, synchronisez d'abord." });
        const st = DB.state;
        if (sale && sale.id && (st.ventes || []).some(v => v.id === sale.id))
          return send(res, 200, { ok: true, duplicate: true, version: DB.version });

        const marks = st.dlcMarks || [];
        const lineMarks = {};
        for (const l of (sale && sale.lignes) || []) {
          if (!l.markdownId) continue;
          lineMarks[l.markdownId] = (lineMarks[l.markdownId] || 0) + (+l.qte || 0);
          const mark = marks.find(m => m.id === l.markdownId);
          if (!mark || mark.statut !== "Active") return send(res, 409, { error: "DLC_MARK_INACTIVE", message: "Cette démarque DLC n'est plus active." });
          if (mark.sku !== l.sku || Number(mark.prixDLC) !== Number(l.pu)) return send(res, 409, { error: "DLC_PRICE_MISMATCH", message: "Le prix ou l'article de la démarque a changé. Actualisez la caisse." });
          if (Number(mark.qteRestante) < lineMarks[l.markdownId]) return send(res, 409, { error: "DLC_MARK_STOCK", message: "Quantité démarquée insuffisante; actualisez la caisse." });
          const expiry = Date.parse(String(mark.dlc || "") + "T00:00:00Z");
          if (Number.isFinite(expiry) && expiry < Date.parse(new Date().toISOString().slice(0,10) + "T00:00:00Z"))
            return send(res, 409, { error: "DLC_EXPIRED", message: "Lot périmé : la vente est bloquée." });
        }
        for (const [id, q] of Object.entries(markdownDec || {})) {
          if (!Number.isFinite(+q) || +q <= 0 || Number(lineMarks[id] || 0) !== +q)
            return send(res, 409, { error: "DLC_MARK_MISMATCH", message: "Les quantités démarquées du panier ne correspondent pas." });
        }
        if (Object.keys(lineMarks).length !== Object.keys(markdownDec || {}).length)
          return send(res, 409, { error: "DLC_MARK_MISMATCH", message: "La référence d'une démarque du panier est absente." });

        for (const [sku, q0] of Object.entries(dec || {})) {
          const q = Number(q0), p = (st.produits || []).find(x => x.sku === sku);
          if (!Number.isFinite(q) || q <= 0) return send(res, 400, { error: "BAD_QUANTITY", sku });
          if (!p) return send(res, 409, { error: "UNKNOWN", sku });
          if ((+p.stockRayon || 0) < q) return send(res, 409, { error: "STOCK", sku, nom: p.nom, dispo: +p.stockRayon || 0 });
        }
        for (const [sku, q] of Object.entries(dec || {})) {
          const p = st.produits.find(x => x.sku === sku);
          p.stockRayon = +(+p.stockRayon - q).toFixed(3);
          p.stock = +((+p.stockReserve || 0) + (+p.stockRayon || 0)).toFixed(3);
          /* Lots FEFO : décrémente les lots rayon les plus proches d'abord (marge au lot conservée côté client). */
          try{
            st.lots = st.lots || [];
            let r = Number(q)||0;
            const pool = st.lots.filter(l=>l.sku===sku&&(Number(l.qteRayon)||0)>0).sort((a,b)=>String(a.dlc||"").localeCompare(String(b.dlc||"")));
            for(const l of pool){ if(r<=0) break; const m=Math.min(r,Number(l.qteRayon)||0); l.qteRayon=+((Number(l.qteRayon)||0)-m).toFixed(3); r-=m; }
          }catch(e){}
        }
        for (const [id, q0] of Object.entries(markdownDec || {})) {
          const mark = marks.find(m => m.id === id), q = Number(q0);
          mark.qteRestante = Math.max(0, +(Number(mark.qteRestante) - q).toFixed(3));
          mark.qteVendue = +(Number(mark.qteVendue || 0) + q).toFixed(3);
          if (mark.qteRestante <= 0) mark.statut = "Épuisée";
          const dm = (st.demarques || []).find(d => d.dlcMarkId === id);
          if (dm) { dm.qteRestante = mark.qteRestante; dm.qteVendue = mark.qteVendue; dm.statut = mark.statut; }
        }
        if (sale) { (st.ventes = st.ventes || []).unshift(sale); }
        (movements || []).forEach(m => { if (!(st.mouvements || []).some(x => x.id === m.id)) (st.mouvements = st.mouvements || []).unshift(m); });
        if (pts && pts.clientId) {
          const cl = (st.clients || []).find(c => c.id === pts.clientId);
          if (cl) { cl.points = Math.max(0, (cl.points || 0) - (pts.used || 0) + (pts.earned || 0)); cl.achats = (cl.achats || 0) + 1; }
        }
        if (sale && sale.id) {
          const n = parseInt(String(sale.id).replace(/\D/g, ""), 10);
          if (!isNaN(n) && st.seq) st.seq.ticket = Math.max(+st.seq.ticket || 1, n + 1);
        }
        DB.version++;
        persist();
        send(res, 200, { ok: true, version: DB.version });
      } catch (e) { send(res, 400, { error: "JSON invalide" }); }
    });
    return;
  }

  /* ---------- Statique ---------- */
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  let p = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || p.includes("db.json")) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Introuvable"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": path.extname(file) === ".js" ? "no-store" : "public, max-age=3600" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("==================================================");
  console.log("  ASSOMi — serveur temps réel multi-postes");
  console.log("  Local   : http://localhost:" + PORT);
  console.log("  Réseau  : http://<IP-DU-PC>:" + PORT + "  (caisses, tablettes, smartphones, PDA)");
  console.log("  Version base : " + DB.version);
  console.log("==================================================");
});
