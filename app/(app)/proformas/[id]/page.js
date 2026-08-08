import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { fcfa, dateFr, genererNumero } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DetailProforma({ params }) {
  const u = await exigerRole(["admin","directeur","commercial","comptable"]);
  const id = Number(params.id);
  const p = await prisma.proforma.findUnique({
    where: { id }, include: { client: true, lignes: true, commandes: true } });
  if (!p) return <p>Proforma introuvable.</p>;

  const retenue = Math.round(p.total * p.retenuePct / 100);
  const net = p.total - retenue;

  async function changerStatut(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial"]);
    await prisma.proforma.update({ where: { id }, data: { statut: formData.get("statut") } });
    revalidatePath(`/proformas/${id}`);
  }

  async function convertir() {
    "use server";
    await exigerRole(["admin","directeur","commercial"]);
    const pr = await prisma.proforma.findUnique({ where: { id }, include: { lignes: true } });
    if (!pr || pr.statut === "convertie") return;
    const numero = await genererNumero("BC", "commande");
    const c = await prisma.commande.create({ data: {
      numero, proformaId: id, clientId: pr.clientId, statut: "confirmee", total: pr.total,
      lignes: { create: pr.lignes.map(l => ({ produitId:l.produitId, nomProduit:l.nomProduit,
        unite:l.unite, quantite:l.quantite, prixUnit:l.prixUnit })) },
    }});
    await prisma.proforma.update({ where: { id }, data: { statut: "convertie" } });
    redirect(`/commandes/${c.id}`);
  }

  async function planifierRelance(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial"]);
    await prisma.relance.create({ data: {
      clientId: p.clientId, typeDoc: "proforma", docId: id,
      datePrevue: new Date(String(formData.get("datePrevue"))),
      note: formData.get("note") || null }});
    revalidatePath("/relances");
    revalidatePath(`/proformas/${id}`);
  }

  return (
    <>
      <a href="/proformas" style={{fontSize:13}}>← Retour</a>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginTop:8}}>
        <div>
          <h1>{p.numero}</h1>
          <p className="soustitre">{p.client.nom} · {dateFr(p.creeLe)} · <span className="badge b-bleu">{p.statut}</span></p>
        </div>
        {p.statut === "acceptee" && (
          <form action={convertir}><button>→ Convertir en bon de commande</button></form>
        )}
      </div>

      <div className="card scroll-x">
        <table>
          <thead><tr><th>N°</th><th>Désignation</th><th>Unité</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
          <tbody>
            {p.lignes.map((l,i) => (
              <tr key={l.id}><td>{i+1}</td><td>{l.nomProduit}</td><td>{l.unite}</td>
                <td style={{textAlign:"center"}}>{l.quantite}</td>
                <td style={{textAlign:"right"}}>{fcfa(l.prixUnit)}</td>
                <td style={{textAlign:"right",fontWeight:600}}>{fcfa(l.prixUnit*l.quantite)}</td></tr>
            ))}
            <tr><td colSpan={5} style={{textAlign:"right",fontWeight:700}}>TOTAL</td>
              <td style={{textAlign:"right",fontWeight:700}}>{fcfa(p.total)}</td></tr>
            <tr><td colSpan={5} style={{textAlign:"right",color:"var(--red)"}}>Retenue {p.retenuePct}%</td>
              <td style={{textAlign:"right",color:"var(--red)"}}>{fcfa(retenue)}</td></tr>
            <tr><td colSpan={5} style={{textAlign:"right",fontWeight:700,color:"var(--gold)"}}>GRAND TOTAL</td>
              <td style={{textAlign:"right",fontWeight:700,color:"var(--gold)"}}>{fcfa(net)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))"}}>
        <div className="card">
          <h3 style={{marginBottom:10}}>Statut</h3>
          <form action={changerStatut} style={{display:"flex",gap:8}}>
            <select name="statut" defaultValue={p.statut}>
              {["brouillon","envoyee","acceptee","refusee","expiree"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button>OK</button>
          </form>
        </div>
        <div className="card">
          <h3 style={{marginBottom:10}}>Planifier une relance</h3>
          <form action={planifierRelance} style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input type="date" name="datePrevue" required style={{maxWidth:170}}/>
            <input name="note" placeholder="Note" style={{flex:1,minWidth:130}}/>
            <button>Planifier</button>
          </form>
        </div>
      </div>
    </>
  );
}
