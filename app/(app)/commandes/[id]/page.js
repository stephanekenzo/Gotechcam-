import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigerConnexion, exigerRole } from "@/lib/auth";
import { fcfa, dateFr, genererNumero, mouvementStock } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function DetailCommande({ params, searchParams }) {
  const u = await exigerConnexion();
  const id = Number(params.id);
  const c = await prisma.commande.findUnique({ where:{id},
    include:{ client:true, lignes:true, proforma:{select:{numero:true,id:true}},
      factures:{select:{id:true,numero:true}}, livraisons:{ include:{lignes:true}, orderBy:{creeLe:"asc"} } } });
  if (!c) return <p>Commande introuvable.</p>;

  // Quantités déjà livrées par ligne
  const dejaLivre = {};
  c.livraisons.forEach(bl => bl.lignes.forEach(l => {
    const k = `${l.produitId}|${l.nomProduit}`;
    dejaLivre[k] = (dejaLivre[k] || 0) + l.qteLivree;
  }));

  async function facturer() {
    "use server";
    await exigerRole(["admin","directeur","commercial","comptable"]);
    const cc = await prisma.commande.findUnique({ where:{id}, include:{lignes:true, factures:true} });
    if (!cc || cc.factures.length) return;
    const numero = await genererNumero("FAC","facture");
    const f = await prisma.facture.create({ data:{
      numero, commandeId:id, clientId:cc.clientId, total:cc.total,
      lignes:{ create: cc.lignes.map(l => ({ produitId:l.produitId, nomProduit:l.nomProduit,
        unite:l.unite, quantite:l.quantite, prixUnit:l.prixUnit })) } }});
    redirect(`/factures/${f.id}`);
  }

  async function creerBL(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial","magasinier"]);
    const cc = await prisma.commande.findUnique({ where:{id}, include:{lignes:true, livraisons:{include:{lignes:true}}} });
    const aLivrer = [];
    for (const l of cc.lignes) {
      const q = Number(formData.get(`q_${l.id}`)) || 0;
      if (q > 0) aLivrer.push({ ligne: l, qte: q });
    }
    if (!aLivrer.length) return redirect(`/commandes/${id}?e=vide`);
    try {
      const numero = await genererNumero("BL","livraison");
      await prisma.livraison.create({ data:{
        numero, commandeId:id, note: formData.get("note") || null,
        lignes:{ create: aLivrer.map(a => ({ produitId:a.ligne.produitId, nomProduit:a.ligne.nomProduit,
          unite:a.ligne.unite, qteCommandee:a.ligne.quantite, qteLivree:a.qte })) } }});
      for (const a of aLivrer) {
        if (a.ligne.produitId)
          await mouvementStock({ produitId:a.ligne.produitId, type:"sortie", quantite:a.qte,
            note:"Livraison "+numero, reference:numero });
      }
      // Recalcul du statut de livraison
      const maj = await prisma.commande.findUnique({ where:{id}, include:{lignes:true, livraisons:{include:{lignes:true}}} });
      const tot = {};
      maj.livraisons.forEach(bl => bl.lignes.forEach(l => {
        const k = `${l.produitId}|${l.nomProduit}`; tot[k] = (tot[k]||0) + l.qteLivree; }));
      let tout = true, rien = true;
      maj.lignes.forEach(l => { const q = tot[`${l.produitId}|${l.nomProduit}`] || 0;
        if (q > 0) rien = false; if (q < l.quantite) tout = false; });
      await prisma.commande.update({ where:{id}, data:{
        statutLivraison: tout ? "livre" : rien ? "non_livre" : "partielle",
        statut: tout ? "livree" : maj.statut }});
    } catch (e) {
      return redirect(`/commandes/${id}?e=${encodeURIComponent(e.message)}`);
    }
    revalidatePath(`/commandes/${id}`);
  }

  async function supprimer() {
    "use server";
    await exigerRole(["admin","directeur"]);
    const cc = await prisma.commande.findUnique({ where:{id},
      include:{ factures:true, livraisons:{include:{lignes:true}} } });
    // Restituer le stock de tous les bordereaux
    for (const bl of cc.livraisons)
      for (const l of bl.lignes)
        if (l.produitId && l.qteLivree > 0)
          await mouvementStock({ produitId:l.produitId, type:"entree", quantite:l.qteLivree,
            note:"Annulation "+bl.numero, reference:bl.numero });
    await prisma.commande.delete({ where:{id} });  // factures/BL/paiements en cascade
    if (cc.proformaId) await prisma.proforma.update({ where:{id:cc.proformaId}, data:{statut:"acceptee"} });
    redirect("/commandes");
  }

  const peutSuppr = ["admin","directeur"].includes(u.role);

  return (
    <>
      <a href="/commandes" style={{fontSize:13}}>← Retour</a>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginTop:8}}>
        <div><h1>{c.numero}</h1>
          <p className="soustitre">{c.client.nom} · {dateFr(c.creeLe)} ·{" "}
            <span className="badge b-bleu">{c.statut}</span>{" "}
            <span className={"badge " + (c.statutLivraison==="livre"?"b-vert":c.statutLivraison==="partielle"?"b-or":"b-gris")}>
              {c.statutLivraison.replace("_"," ")}</span></p></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!c.factures.length && <form action={facturer}><button>→ Facturer</button></form>}
          {peutSuppr && <form action={supprimer}><button className="btn-danger">🗑 Supprimer le dossier</button></form>}
        </div>
      </div>

      {searchParams?.e && <div className="err">{decodeURIComponent(searchParams.e)}</div>}

      <div className="card">
        <h3 style={{marginBottom:10}}>📁 Dossier {c.proforma?.numero || c.numero}</h3>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {c.proforma && <a className="btn btn-sec" style={{fontSize:13}} href={`/proformas/${c.proforma.id}`}>📄 {c.proforma.numero}</a>}
          {c.factures.map(f => <a key={f.id} className="btn btn-sec" style={{fontSize:13}} href={`/factures/${f.id}`}>💰 {f.numero}</a>)}
          {c.livraisons.map(b => <span key={b.id} className="btn btn-sec" style={{fontSize:13}}>🚛 {b.numero}</span>)}
        </div>
      </div>

      <form action={creerBL}>
        <div className="card scroll-x">
          <h3 style={{marginBottom:10}}>Lignes & livraison</h3>
          <p style={{fontSize:12,color:"var(--text2)",marginBottom:12}}>
            Saisissez les quantités réellement livrées puis validez : le stock sera décrémenté et un bordereau créé.
          </p>
          <table>
            <thead><tr><th>Désignation</th><th>Unité</th><th>Commandé</th><th>Déjà livré</th><th>PU</th><th>Total</th><th>À livrer</th></tr></thead>
            <tbody>
              {c.lignes.map(l => {
                const dj = dejaLivre[`${l.produitId}|${l.nomProduit}`] || 0;
                const reste = Math.max(0, l.quantite - dj);
                return (
                  <tr key={l.id}>
                    <td>{l.nomProduit}</td><td>{l.unite}</td>
                    <td style={{textAlign:"center"}}>{l.quantite}</td>
                    <td style={{textAlign:"center",color:"var(--text2)"}}>{dj}</td>
                    <td style={{textAlign:"right"}}>{fcfa(l.prixUnit)}</td>
                    <td style={{textAlign:"right",fontWeight:600}}>{fcfa(l.prixUnit*l.quantite)}</td>
                    <td><input type="number" name={`q_${l.id}`} min="0" max={reste} defaultValue={reste} style={{width:80,textAlign:"center"}}/></td>
                  </tr>
                );
              })}
              <tr><td colSpan={5} style={{textAlign:"right",fontWeight:700}}>TOTAL</td>
                <td style={{textAlign:"right",fontWeight:700,color:"var(--gold)"}}>{fcfa(c.total)}</td><td></td></tr>
            </tbody>
          </table>
          {c.statutLivraison !== "livre" && (
            <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap",alignItems:"center"}}>
              <input name="note" placeholder="Note (chauffeur, véhicule...)" style={{flex:1,minWidth:160}}/>
              <button type="submit">🚛 Valider la livraison</button>
            </div>
          )}
        </div>
      </form>
    </>
  );
}
