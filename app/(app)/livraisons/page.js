import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { dateFr } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function Livraisons() {
  await exigerRole(["admin","directeur","commercial","magasinier"]);
  const [liste, aLivrer] = await Promise.all([
    prisma.livraison.findMany({ orderBy:{creeLe:"desc"}, take:100,
      include:{ lignes:true, commande:{ include:{ client:{select:{nom:true}} } } } }),
    prisma.commande.findMany({ where:{ statutLivraison:{not:"livre"}, statut:{not:"annulee"} },
      include:{ client:{select:{nom:true}} }, orderBy:{creeLe:"desc"} }),
  ]);
  return (
    <>
      <h1>🚛 Bordereaux de livraison</h1>
      <p className="soustitre">{liste.length} bordereau(x)</p>
      {aLivrer.length > 0 && (
        <div className="card">
          <h3 style={{marginBottom:10}}>Commandes à livrer</h3>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {aLivrer.map(c => (
              <a key={c.id} className="btn btn-sec" style={{fontSize:13}} href={`/commandes/${c.id}`}>
                {c.numero} — {c.client.nom}{c.statutLivraison==="partielle" && " (partiel)"}
              </a>))}
          </div>
        </div>
      )}
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Numéro</th><th>Commande</th><th>Client</th><th>Articles</th><th>Date</th></tr></thead>
          <tbody>
            {liste.map(b => (
              <tr key={b.id}>
                <td style={{fontWeight:600}}>{b.numero}</td>
                <td><a href={`/commandes/${b.commandeId}`}>{b.commande.numero}</a></td>
                <td>{b.commande.client.nom}</td>
                <td>{b.lignes.reduce((s,l)=>s+l.qteLivree,0)} unité(s) · {b.lignes.length} ligne(s)</td>
                <td>{dateFr(b.creeLe)}</td>
              </tr>))}
            {liste.length===0 && <tr><td colSpan={5} style={{textAlign:"center",color:"var(--text3)",padding:24}}>Aucun bordereau</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
