"use client";
import { useState } from "react";
import { creerProforma } from "@/app/actions/proformas";

export default function FormProforma({ clients, produits }) {
  const [clientId, setClientId] = useState("");
  const [lignes, setLignes] = useState([{ produitId:"", nomProduit:"", unite:"pièce", quantite:1, prixUnit:0 }]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const client = clients.find(c => String(c.id) === clientId);
  const prixPour = (p) => {
    if (client?.typeClient === "revendeur" && p.prixRevendeur) return p.prixRevendeur;
    if (client?.typeClient === "grossiste" && p.prixGrossiste) return p.prixGrossiste;
    return p.prixVente;
  };

  const maj = (i, champ, val) => {
    const copie = [...lignes];
    copie[i][champ] = val;
    if (champ === "produitId" && val) {
      const p = produits.find(x => String(x.id) === String(val));
      if (p) { copie[i].nomProduit = p.nom; copie[i].unite = p.unite; copie[i].prixUnit = prixPour(p); }
    }
    setLignes(copie);
  };

  const total = lignes.reduce((s,l) => s + (Number(l.prixUnit)||0) * (Number(l.quantite)||0), 0);

  async function envoyer() {
    setErreur(""); setEnvoi(true);
    const valides = lignes.filter(l => l.nomProduit.trim());
    const r = await creerProforma({
      clientId: Number(clientId),
      note: "",
      lignes: valides.map(l => ({ ...l, produitId: l.produitId ? Number(l.produitId) : null,
        quantite: Number(l.quantite)||1, prixUnit: Number(l.prixUnit)||0 })),
    });
    if (r?.erreur) { setErreur(r.erreur); setEnvoi(false); }
  }

  return (
    <details className="card">
      <summary style={{cursor:"pointer",fontWeight:600}}>+ Nouvelle proforma</summary>
      <div style={{marginTop:14}}>
        {erreur && <div className="err">{erreur}</div>}
        <label className="label">Client *</label>
        <select value={clientId} onChange={e => setClientId(e.target.value)} style={{marginBottom:14,maxWidth:400}}>
          <option value="">— Sélectionner —</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>

        <label className="label">Lignes</label>
        {lignes.map((l,i) => (
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 70px 110px 36px",gap:8,marginBottom:8}}>
            <div>
              <select value={l.produitId} onChange={e => maj(i,"produitId",e.target.value)}>
                <option value="">— Libellé libre —</option>
                {produits.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.nom} (stock {p.stock})</option>)}
              </select>
              <input value={l.nomProduit} onChange={e => maj(i,"nomProduit",e.target.value)}
                placeholder="Désignation" style={{marginTop:5}}/>
            </div>
            <input type="number" min="1" value={l.quantite} onChange={e => maj(i,"quantite",e.target.value)}/>
            <input type="number" min="0" value={l.prixUnit} onChange={e => maj(i,"prixUnit",e.target.value)}/>
            <button type="button" className="btn-danger" style={{padding:4,minHeight:0}}
              onClick={() => setLignes(lignes.filter((_,j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="btn-sec" style={{fontSize:13}}
          onClick={() => setLignes([...lignes,{produitId:"",nomProduit:"",unite:"pièce",quantite:1,prixUnit:0}])}>
          + Ajouter une ligne
        </button>

        <div style={{textAlign:"right",fontWeight:700,color:"var(--gold)",fontSize:17,margin:"12px 0"}}>
          Total : {new Intl.NumberFormat("fr-FR").format(total)} FCFA
        </div>
        <button type="button" onClick={envoyer} disabled={envoi || !clientId}>
          {envoi ? "Création..." : "Créer la proforma"}
        </button>
      </div>
    </details>
  );
}
