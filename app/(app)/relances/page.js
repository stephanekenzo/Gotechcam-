import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/utils";
export const dynamic = "force-dynamic";

export default async function Relances() {
  await exigerRole(["admin","directeur","commercial","comptable"]);
  const [relances, proformas, factures] = await Promise.all([
    prisma.relance.findMany({ where:{fait:false}, orderBy:{datePrevue:"asc"},
      include:{ client:{select:{id:true,nom:true,telephone:true}} } }),
    prisma.proforma.findMany({ where:{statut:"envoyee"}, orderBy:{creeLe:"asc"},
      include:{ client:{select:{nom:true,telephone:true}} } }),
    prisma.facture.findMany({ where:{statutPaiement:{not:"payee"}}, orderBy:{creeLe:"asc"},
      include:{ client:{select:{nom:true,telephone:true}} } }),
  ]);
  const auj = new Date();
  const jours = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);

  async function marquerFait(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial","comptable"]);
    await prisma.relance.update({ where:{id:Number(formData.get("id"))}, data:{fait:true} });
    revalidatePath("/relances");
  }

  const wa = (tel, texte) => `https://wa.me/${(tel||"").replace(/[^0-9]/g,"")}?text=${encodeURIComponent(texte)}`;

  return (
    <>
      <h1>🔔 Relances</h1>
      <p className="soustitre">Relances planifiées, proformas en attente et factures impayées</p>

      <div className="card scroll-x">
        <h3 style={{marginBottom:10}}>Relances planifiées</h3>
        <table>
          <thead><tr><th>Date</th><th>Client</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {relances.map(r => {
              const retard = new Date(r.datePrevue) < auj;
              return (<tr key={r.id}>
                <td><span className={"badge " + (retard?"b-rouge":"b-bleu")}>{dateFr(r.datePrevue)}{retard && " ⚠"}</span></td>
                <td><a href={`/clients/${r.clientId}`}>{r.client.nom}</a></td>
                <td style={{fontSize:13}}>{r.note}</td>
                <td style={{whiteSpace:"nowrap"}}>
                  {r.client.telephone && <a className="btn btn-sec" style={{padding:"4px 9px",fontSize:12}} target="_blank" rel="noreferrer"
                    href={wa(r.client.telephone, "Bonjour, nous revenons vers vous concernant notre offre. ETS GOTECHCAM")}>💬</a>}
                  <form action={marquerFait} style={{display:"inline"}}><input type="hidden" name="id" value={r.id}/>
                    <button className="btn-sec" style={{padding:"4px 9px",fontSize:12,minHeight:0}}>✓ Fait</button></form>
                </td></tr>);
            })}
            {relances.length===0 && <tr><td colSpan={4} style={{textAlign:"center",color:"var(--text3)",padding:16}}>Aucune relance planifiée</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))"}}>
        <div className="card scroll-x">
          <h3 style={{marginBottom:10}}>Proformas en attente</h3>
          <table><thead><tr><th>N°</th><th>Client</th><th>Total</th><th>Depuis</th></tr></thead>
            <tbody>{proformas.map(p => (
              <tr key={p.id}><td><a href={`/proformas/${p.id}`}>{p.numero}</a></td>
                <td>{p.client.nom}</td><td>{fcfa(p.total)}</td><td>{jours(p.creeLe)} j</td></tr>))}
              {proformas.length===0 && <tr><td colSpan={4} style={{textAlign:"center",color:"var(--text3)",padding:16}}>Aucune</td></tr>}
            </tbody></table>
        </div>
        <div className="card scroll-x">
          <h3 style={{marginBottom:10}}>Factures impayées</h3>
          <table><thead><tr><th>N°</th><th>Client</th><th>Reste dû</th><th>Depuis</th></tr></thead>
            <tbody>{factures.map(f => (
              <tr key={f.id}><td><a href={`/factures/${f.id}`}>{f.numero}</a></td>
                <td>{f.client.nom}</td>
                <td style={{color:"var(--red)",fontWeight:600}}>{fcfa(Math.max(0, f.total*(1-f.retenuePct/100)-f.montantPaye))}</td>
                <td>{jours(f.creeLe)} j</td></tr>))}
              {factures.length===0 && <tr><td colSpan={4} style={{textAlign:"center",color:"var(--text3)",padding:16}}>Aucune</td></tr>}
            </tbody></table>
        </div>
      </div>
    </>
  );
}
