import { prisma } from "@/lib/db";
import { exigerConnexion } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function Commandes() {
  await exigerConnexion();
  const liste = await prisma.commande.findMany({ orderBy:{creeLe:"desc"}, take:100,
    include:{ client:{select:{nom:true}} } });
  return (
    <>
      <h1>Bons de commande</h1>
      <p className="soustitre">{liste.length} commande(s) — créées depuis les proformas acceptées</p>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Total</th><th>Statut</th><th>Livraison</th></tr></thead>
          <tbody>
            {liste.map(c => (
              <tr key={c.id}>
                <td><a href={`/commandes/${c.id}`} style={{fontWeight:600}}>{c.numero}</a></td>
                <td>{c.client.nom}</td><td>{dateFr(c.creeLe)}</td>
                <td style={{color:"var(--gold)",fontWeight:600}}>{fcfa(c.total)}</td>
                <td><span className="badge b-bleu">{c.statut}</span></td>
                <td><span className={"badge " + (c.statutLivraison==="livre"?"b-vert":c.statutLivraison==="partielle"?"b-or":"b-gris")}>
                  {c.statutLivraison.replace("_"," ")}</span></td>
              </tr>
            ))}
            {liste.length===0 && <tr><td colSpan={6} style={{textAlign:"center",color:"var(--text3)",padding:24}}>Aucune commande</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
