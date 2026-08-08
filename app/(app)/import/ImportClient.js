"use client";
import { useState } from "react";
import { creerProforma } from "@/app/actions/proformas";

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function similarite(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const wa = a.split(" ").filter(w => w.length > 2);
  const wb = new Set(b.split(" ").filter(w => w.length > 2));
  if (!wa.length || !wb.size) return 0;
  return wa.filter(w => wb.has(w)).length / Math.max(wa.length, wb.size);
}

export default function ImportClient({ clients, produits }) {
  const [lignes, setLignes] = useState([]);
  const [clientId, setClientId] = useState("");
  const [chargement, setChargement] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  function matcher(libelle) {
    let best = null, score = 0;
    for (const p of produits) {
      const s = similarite(libelle, p.nom);
      if (s > score) { score = s; best = p; }
    }
    return score >= 0.35 ? { p: best, score } : null;
  }

  function appliquer(detectees) {
    if (!detectees.length) { setErreur("Aucune ligne exploitable détectée. Vérifiez le fichier ou saisissez manuellement."); return; }
    setErreur("");
    setLignes(detectees.map(d => {
      const m = matcher(d.libelle);
      return {
        inclure: true,
        nomProduit: d.libelle,
        produitId: m ? m.p.id : "",
        unite: m ? m.p.unite : (d.unite || "pièce"),
        quantite: d.quantite || 1,
        prixUnit: m ? m.p.prixVente : (d.prix || 0),
        score: m ? Math.round(m.score * 100) : 0,
        stock: m ? m.p.stock : null,
      };
    }));
  }

  async function lireFichier(file) {
    if (!file) return;
    setErreur(""); setChargement("Lecture du fichier...");
    const ext = file.name.split(".").pop().toLowerCase();
    try {
      if (ext === "pdf") await lirePDF(file);
      else if (ext === "xlsx" || ext === "xls" || ext === "csv") await lireExcel(file);
      else { setErreur("Format non pris en charge. Utilisez PDF, XLSX ou CSV."); }
    } catch (e) {
      setErreur("Erreur de lecture : " + (e.message || e));
    }
    setChargement("");
  }

  async function charger(src, test) {
    if (test()) return;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Téléchargement impossible — vérifiez votre connexion."));
      document.head.appendChild(s);
    });
  }

  async function lireExcel(file) {
    await charger("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => window.XLSX);
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });
    const detectees = [];
    for (const nomFeuille of wb.SheetNames) {
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[nomFeuille], { header: 1, defval: "" });
      for (const r of rows) {
        const cells = r.map(c => String(c ?? "").trim());
        // Chercher : un libellé texte + au moins un nombre (quantité)
        const iLib = cells.findIndex(c => c.length > 3 && /[a-zA-ZÀ-ÿ]{3,}/.test(c) && !/^(n°|total|libell|unit|quantit|prix|designation)/i.test(c));
        if (iLib === -1) continue;
        const nums = cells.slice(iLib + 1)
          .map(c => parseFloat(String(c).replace(/[^\d.,]/g, "").replace(",", ".")))
          .filter(n => !isNaN(n) && n > 0);
        if (!nums.length) continue;
        const unite = cells[iLib + 1] && /^[a-zA-ZÀ-ÿ]{2,10}$/.test(cells[iLib + 1]) ? cells[iLib + 1] : "pièce";
        detectees.push({ libelle: cells[iLib], unite, quantite: Math.round(nums[0]), prix: nums.length > 1 ? Math.round(nums[1]) : 0 });
      }
    }
    appliquer(detectees);
  }

  async function lirePDF(file) {
    await charger("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", () => window.pdfjsLib);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const items = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      tc.items.forEach(it => {
        if (it.str.trim()) items.push({ t: it.str.trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) + i * 10000 });
      });
    }
    if (items.length < 5) {
      if (confirm("Ce PDF semble être un scan. Lancer la reconnaissance OCR ? (1 à 2 minutes)")) return lancerOCR(pdf);
      return;
    }
    const groupes = {};
    items.forEach(it => { const k = Math.round(it.y / 5) * 5; (groupes[k] = groupes[k] || []).push(it); });
    const rows = Object.keys(groupes).sort((a, b) => b - a)
      .map(k => groupes[k].sort((a, b) => a.x - b.x).map(i => i.t));
    const detectees = [];
    rows.forEach(cols => {
      if (cols.length < 3) return;
      if (!/^\d{1,3}$/.test(cols[0])) return;
      const libelle = cols[1];
      if (!libelle || libelle.length < 3 || /total|libell/i.test(libelle)) return;
      let unite = "pièce", quantite = 1, prix = 0;
      if (cols.length >= 5) { unite = cols[2]; quantite = parseInt(String(cols[3]).replace(/\s/g, "")) || 1; prix = parseInt(String(cols[4]).replace(/[\s.,]/g, "")) || 0; }
      else if (cols.length >= 4) { unite = cols[2]; quantite = parseInt(String(cols[3]).replace(/\s/g, "")) || 1; }
      detectees.push({ libelle, unite, quantite, prix });
    });
    appliquer(detectees);
  }

  async function lancerOCR(pdf) {
    setChargement("OCR en cours...");
    await charger("https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js", () => window.Tesseract);
    const worker = await window.Tesseract.createWorker("fra", 1, {
      logger: m => { if (m.status === "recognizing text") setChargement("OCR : " + Math.round(m.progress * 100) + "%"); },
    });
    let texte = "";
    const max = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width; canvas.height = vp.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const r = await worker.recognize(canvas.toDataURL("image/png"));
      texte += r.data.text + "\n";
    }
    await worker.terminate();
    const detectees = [];
    texte.split("\n").forEach(l => {
      l = l.trim();
      if (l.length < 5 || /total|montant|somme|signature/i.test(l)) return;
      let m = l.match(/^(?:\d{1,3}[\s.):|-]+)?(.+?)\s+(\d{1,4})\s+([\d\s.,]{3,})\s*$/);
      if (m && m[1].length > 3) { detectees.push({ libelle: m[1].trim(), quantite: parseInt(m[2]) || 1, prix: parseInt(m[3].replace(/[\s.,]/g, "")) || 0 }); return; }
      m = l.match(/^(?:\d{1,3}[\s.):|-]+)?([A-Za-zÀ-ÿ].{3,}?)\s+(\d{1,4})\s*$/);
      if (m) detectees.push({ libelle: m[1].trim(), quantite: parseInt(m[2]) || 1, prix: 0 });
    });
    setChargement("");
    appliquer(detectees);
  }

  function maj(i, champ, val) {
    setLignes(ls => ls.map((l, j) => {
      if (j !== i) return l;
      const n = { ...l, [champ]: val };
      if (champ === "produitId") {
        const p = produits.find(x => String(x.id) === String(val));
        if (p) { n.prixUnit = p.prixVente; n.unite = p.unite; n.stock = p.stock; n.score = 100; }
        else { n.stock = null; n.score = 0; }
      }
      return n;
    }));
  }

  async function valider() {
    setErreur("");
    if (!clientId) { setErreur("Sélectionnez un client."); return; }
    const retenues = lignes.filter(l => l.inclure && l.nomProduit.trim());
    if (!retenues.length) { setErreur("Aucune ligne sélectionnée."); return; }
    setEnvoi(true);
    const r = await creerProforma({
      clientId: Number(clientId),
      note: "Importé depuis un fichier client",
      lignes: retenues.map(l => ({
        produitId: l.produitId ? Number(l.produitId) : null,
        nomProduit: l.nomProduit.trim(),
        unite: l.unite || "pièce",
        quantite: Number(l.quantite) || 1,
        prixUnit: Number(l.prixUnit) || 0,
      })),
    });
    setEnvoi(false);
    if (r?.erreur) setErreur(r.erreur);
  }

  const total = lignes.filter(l => l.inclure).reduce((s, l) => s + (Number(l.prixUnit) || 0) * (Number(l.quantite) || 1), 0);

  return (
    <>
      <div className="card">
        <label style={{ display: "block", border: "2px dashed var(--border)", borderRadius: 14, padding: "34px 20px", textAlign: "center", cursor: "pointer", background: "var(--bg3)" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Choisir le fichier de commande du client</div>
          <div style={{ fontSize: 13, color: "var(--text2)" }}>PDF, Excel (.xlsx) ou CSV — les PDF scannés passent par l'OCR</div>
          <input type="file" accept=".pdf,.xlsx,.xls,.csv" style={{ display: "none" }}
            onChange={e => lireFichier(e.target.files[0])} />
        </label>
        {chargement && <p style={{ textAlign: "center", color: "var(--text2)", marginTop: 12 }}>⏳ {chargement}</p>}
        {erreur && <div className="alerte-err" style={{ marginTop: 12 }}>{erreur}</div>}
      </div>

      {lignes.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Vérifiez les correspondances</h3>
          <div style={{ maxWidth: 420, marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: "var(--text2)" }}>Client *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}{c.ville ? " — " + c.ville : ""}</option>)}
            </select>
          </div>
          <div className="scroll-x">
            <table>
              <thead><tr><th>✓</th><th>Libellé détecté</th><th>Qté</th><th>Produit du catalogue</th><th>Dispo</th><th>Prix vente</th></tr></thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td><input type="checkbox" checked={l.inclure} onChange={e => maj(i, "inclure", e.target.checked)} style={{ width: "auto" }} /></td>
                    <td>
                      <input value={l.nomProduit} onChange={e => maj(i, "nomProduit", e.target.value)} style={{ minWidth: 170 }} />
                      <div style={{ fontSize: 11, color: l.score >= 60 ? "var(--green)" : l.score > 0 ? "var(--gold)" : "var(--red)" }}>
                        {l.score > 0 ? `Correspondance ${l.score}%` : "Produit non trouvé — libellé libre"}
                      </div>
                    </td>
                    <td><input type="number" min="1" value={l.quantite} onChange={e => maj(i, "quantite", e.target.value)} style={{ width: 70 }} /></td>
                    <td>
                      <select value={l.produitId} onChange={e => maj(i, "produitId", e.target.value)} style={{ minWidth: 200 }}>
                        <option value="">— Libellé libre —</option>
                        {produits.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.nom}</option>)}
                      </select>
                    </td>
                    <td>
                      {l.stock === null ? "—" :
                        <span className={`badge ${l.stock >= l.quantite ? "b-vert" : "b-rouge"}`}>{l.stock}</span>}
                    </td>
                    <td><input type="number" min="0" value={l.prixUnit} onChange={e => maj(i, "prixUnit", e.target.value)} style={{ width: 105 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
            <b style={{ color: "var(--gold)", fontSize: 17 }}>Total : {total.toLocaleString("fr-FR")} FCFA</b>
            <button onClick={valider} disabled={envoi}>{envoi ? "Création..." : "✓ Créer la proforma"}</button>
          </div>
        </div>
      )}
    </>
  );
}
