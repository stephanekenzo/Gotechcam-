import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function Factures() {
  await exigerRole(["admin","directeur","commercial","comptable"]);
  const liste = await prisma.facture.findMany({ orderBy:{creeLe:"desc"}, take:100,
    include:{ client:{select:{nom:true}} } });
  return (
    <>
      <h1>Factures</h1>
      <p className="soustitre">{liste.length} facture(s)</p>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Net à payer</th><th>Payé</th><th>Statut</th></tr></thead>
          <tbody>
            {liste.map(f => (
              <tr key={f.id}>
                <td><a href={`/factures/${f.id}`} style={{fontWeight:600}}>{f.numero}</a></td>
                <td>{f.client.nom}</td><td>{dateFr(f.creeLe)}</td>
                <td style={{color:"var(--gold)",fontWeight:600}}>{fcfa(f.total*(1-f.retenuePct/100))}</td>
                <td style={{color:"var(--green)"}}>{fcfa(f.montantPaye)}</td>
                <td><span className={"badge " + (f.statutPaiement==="payee"?"b-vert":f.statutPaiement==="partielle"?"b-or":"b-rouge")}>
                  {f.statutPaiement}</span></td>
              </tr>
            ))}
            {liste.length===0 && <tr><td colSpan={6} style={{textAlign:"center",color:"var(--text3)",padding:24}}>Aucune facture</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
