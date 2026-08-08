import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function DetailFacture({ params }) {
  const u = await exigerRole(["admin","directeur","commercial","comptable"]);
  const id = Number(params.id);
  const f = await prisma.facture.findUnique({ where:{id},
    include:{ client:true, lignes:true, paiements:{orderBy:{creeLe:"desc"}},
      commande:{ select:{ id:true, numero:true, proforma:{select:{id:true,numero:true}} } } } });
  if (!f) return <p>Facture introuvable.</p>;

  const retenue = Math.round(f.total * f.retenuePct / 100);
  const net = f.total - retenue;
  const reste = Math.max(0, net - f.montantPaye);

  async function ajouterPaiement(formData) {
    "use server";
    await exigerRole(["admin","directeur","comptable"]);
    const montant = Number(formData.get("montant"));
    if (!montant || montant <= 0) return;
    await prisma.paiement.create({ data:{ factureId:id, montant,
      mode: formData.get("mode") || "especes", reference: formData.get("reference") || null }});
    const tot = await prisma.paiement.aggregate({ where:{factureId:id}, _sum:{montant:true} });
    const paye = tot._sum.montant || 0;
    await prisma.facture.update({ where:{id}, data:{ montantPaye:paye,
      statutPaiement: paye <= 0 ? "impayee" : paye >= net - 1 ? "payee" : "partielle" }});
    revalidatePath(`/factures/${id}`);
  }

  async function supprimerPaiement(formData) {
    "use server";
    await exigerRole(["admin","directeur","comptable"]);
    await prisma.paiement.delete({ where:{ id: Number(formData.get("pid")) } });
    const tot = await prisma.paiement.aggregate({ where:{factureId:id}, _sum:{montant:true} });
    const paye = tot._sum.montant || 0;
    await prisma.facture.update({ where:{id}, data:{ montantPaye:paye,
      statutPaiement: paye <= 0 ? "impayee" : paye >= net - 1 ? "payee" : "partielle" }});
    revalidatePath(`/factures/${id}`);
  }

  async function supprimerFacture() {
    "use server";
    await exigerRole(["admin","directeur"]);
    await prisma.facture.delete({ where:{id} });   // paiements en cascade
    redirect("/factures");
  }

  return (
    <>
      <a href="/factures" style={{fontSize:13}}>← Retour</a>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginTop:8}}>
        <div><h1>{f.numero}</h1>
          <p className="soustitre">{f.client.nom} · {dateFr(f.creeLe)} ·{" "}
            <span className={"badge " + (f.statutPaiement==="payee"?"b-vert":f.statutPaiement==="partielle"?"b-or":"b-rouge")}>
              {f.statutPaiement}</span></p></div>
        {["admin","directeur"].includes(u.role) && (
          <form action={supprimerFacture}>
            <button className="btn-danger">🗑 Supprimer{f.montantPaye > 0 ? " (et ses paiements)" : ""}</button>
          </form>)}
      </div>

      <div className="card">
        <h3 style={{marginBottom:10}}>📁 Dossier {f.commande?.proforma?.numero || f.numero}</h3>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {f.commande?.proforma && <a className="btn btn-sec" style={{fontSize:13}} href={`/proformas/${f.commande.proforma.id}`}>📄 {f.commande.proforma.numero}</a>}
          {f.commande && <a className="btn btn-sec" style={{fontSize:13}} href={`/commandes/${f.commande.id}`}>🧾 {f.commande.numero}</a>}
        </div>
      </div>

      <div className="card scroll-x">
        <table>
          <thead><tr><th>N°</th><th>Désignation</th><th>Unité</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
          <tbody>
            {f.lignes.map((l,i) => (
              <tr key={l.id}><td>{i+1}</td><td>{l.nomProduit}</td><td>{l.unite}</td>
                <td style={{textAlign:"center"}}>{l.quantite}</td>
                <td style={{textAlign:"right"}}>{fcfa(l.prixUnit)}</td>
                <td style={{textAlign:"right",fontWeight:600}}>{fcfa(l.prixUnit*l.quantite)}</td></tr>))}
            <tr><td colSpan={5} style={{textAlign:"right",fontWeight:700}}>TOTAL</td><td style={{textAlign:"right",fontWeight:700}}>{fcfa(f.total)}</td></tr>
            <tr><td colSpan={5} style={{textAlign:"right",color:"var(--red)"}}>Retenue {f.retenuePct}%</td><td style={{textAlign:"right",color:"var(--red)"}}>{fcfa(retenue)}</td></tr>
            <tr><td colSpan={5} style={{textAlign:"right",fontWeight:700,color:"var(--gold)"}}>NET À PAYER</td><td style={{textAlign:"right",fontWeight:700,color:"var(--gold)"}}>{fcfa(net)}</td></tr>
            <tr><td colSpan={5} style={{textAlign:"right",color:"var(--green)"}}>Payé</td><td style={{textAlign:"right",color:"var(--green)"}}>{fcfa(f.montantPaye)}</td></tr>
            <tr><td colSpan={5} style={{textAlign:"right",fontWeight:700,color:reste>0?"var(--red)":"var(--green)"}}>RESTE</td>
              <td style={{textAlign:"right",fontWeight:700,color:reste>0?"var(--red)":"var(--green)"}}>{fcfa(reste)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))"}}>
        {reste > 0 && ["admin","directeur","comptable"].includes(u.role) && (
          <div className="card">
            <h3 style={{marginBottom:10}}>Enregistrer un paiement</h3>
            <form action={ajouterPaiement}>
              <div className="grille" style={{gridTemplateColumns:"1fr 1fr"}}>
                <div><label className="label">Montant</label><input type="number" name="montant" defaultValue={reste} required/></div>
                <div><label className="label">Mode</label>
                  <select name="mode"><option value="especes">Espèces</option><option value="virement">Virement</option>
                    <option value="cheque">Chèque</option><option value="mobile_money">Mobile Money</option></select></div>
                <div style={{gridColumn:"1/-1"}}><label className="label">Référence</label><input name="reference"/></div>
              </div>
              <button style={{marginTop:12}}>💰 Enregistrer</button>
            </form>
          </div>
        )}
        <div className="card">
          <h3 style={{marginBottom:10}}>Historique des paiements</h3>
          {f.paiements.length === 0 ? <p style={{color:"var(--text3)",padding:12}}>Aucun paiement</p> : (
            <table><thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th></th></tr></thead>
              <tbody>{f.paiements.map(p => (
                <tr key={p.id}><td>{dateFr(p.creeLe)}</td>
                  <td style={{color:"var(--green)",fontWeight:600}}>{fcfa(p.montant)}</td>
                  <td>{p.mode.replace("_"," ")}</td>
                  <td>{["admin","directeur","comptable"].includes(u.role) && (
                    <form action={supprimerPaiement}><input type="hidden" name="pid" value={p.id}/>
                      <button className="btn-danger" style={{padding:"4px 10px",fontSize:12,minHeight:0}}>🗑</button></form>)}</td>
                </tr>))}
              </tbody></table>
          )}
        </div>
      </div>
    </>
  );
}
