import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { dateFr } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function Besoins() {
  await exigerRole(["admin","directeur","commercial"]);
  const besoins = await prisma.besoinClient.findMany({
    where:{ actif:true }, orderBy:[{prochainRappel:"asc"},{clientId:"asc"}],
    include:{ client:{select:{id:true,nom:true,telephone:true,secteur:true}},
      produit:{select:{stock:true,statut:true}} } });

  const auj = new Date();
  const dus = besoins.filter(b => b.prochainRappel && new Date(b.prochainRappel) <= auj);
  const autres = besoins.filter(b => !dus.includes(b));

  async function marquerCommande(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial"]);
    const id = Number(formData.get("id"));
    const b = await prisma.besoinClient.findUnique({ where:{id} });
    await prisma.besoinClient.update({ where:{id}, data:{
      dernierAchat: new Date(),
      prochainRappel: b.frequenceJours ? new Date(Date.now() + b.frequenceJours*86400000) : null }});
    revalidatePath("/besoins");
  }

  async function desactiver(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial"]);
    await prisma.besoinClient.update({ where:{id:Number(formData.get("id"))}, data:{actif:false} });
    revalidatePath("/besoins");
  }

  const Ligne = ({ b, du }) => (
    <tr key={b.id}>
      <td><a href={`/clients/${b.clientId}`} style={{fontWeight:600}}>{b.client.nom}</a>
        <div style={{fontSize:11,color:"var(--text3)"}}>{b.client.secteur}</div></td>
      <td>{b.libelle}<div style={{fontSize:11,color:"var(--text3)"}}>habituellement {b.quantiteTypique}</div></td>
      <td>{b.produit ? (b.produit.stock > 0
        ? <span className="badge b-vert">{b.produit.stock} en stock</span>
        : <span className="badge b-rouge">rupture</span>) : <span style={{color:"var(--text3)"}}>—</span>}</td>
      <td>{b.frequenceJours ? `${b.frequenceJours} j` : "—"}</td>
      <td>{b.prochainRappel ? <span className={"badge " + (du?"b-or":"b-bleu")}>{dateFr(b.prochainRappel)}</span> : "—"}</td>
      <td style={{whiteSpace:"nowrap"}}>
        {b.client.telephone && (
          <a className="btn btn-sec" style={{padding:"4px 9px",fontSize:12}} target="_blank" rel="noreferrer"
            href={`https://wa.me/${b.client.telephone.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(
              `Bonjour, souhaitez-vous renouveler votre commande de ${b.libelle} (${b.quantiteTypique}) ? ETS GOTECHCAM`)}`}>💬</a>)}
        <form action={marquerCommande} style={{display:"inline"}}>
          <input type="hidden" name="id" value={b.id}/>
          <button className="btn-sec" style={{padding:"4px 9px",fontSize:12,minHeight:0}}>✓ Commandé</button></form>
        <form action={desactiver} style={{display:"inline"}}>
          <input type="hidden" name="id" value={b.id}/>
          <button className="btn-danger" style={{padding:"4px 9px",fontSize:12,minHeight:0}}>×</button></form>
      </td>
    </tr>
  );

  const Tableau = ({ items, du }) => (
    <div className="card scroll-x">
      <table>
        <thead><tr><th>Client</th><th>Produit habituel</th><th>Stock</th><th>Fréquence</th><th>Prochain rappel</th><th></th></tr></thead>
        <tbody>{items.map(b => <Ligne key={b.id} b={b} du={du}/>)}</tbody>
      </table>
    </div>
  );

  return (
    <>
      <h1>🔁 Besoins récurrents</h1>
      <p className="soustitre">
        Ce que chaque client commande habituellement — pour proposer un réassort sans attendre sa demande.
        Ajoutez un besoin depuis la fiche d&apos;un client.
      </p>
      {dus.length > 0 && (<>
        <h3 style={{marginBottom:8}}>À relancer maintenant ({dus.length})</h3>
        <Tableau items={dus} du/>
      </>)}
      <h3 style={{margin:"18px 0 8px"}}>Tous les besoins suivis ({autres.length})</h3>
      {autres.length ? <Tableau items={autres}/> :
        <div className="card"><p style={{color:"var(--text3)",textAlign:"center",padding:16}}>
          Aucun besoin enregistré — ouvrez une fiche client pour en ajouter.</p></div>}
    </>
  );
}
