import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/utils";
import FormProforma from "./FormProforma";

export const dynamic = "force-dynamic";

export default async function Proformas() {
  const u = await exigerRole(["admin","directeur","commercial","comptable"]);
  const [liste, clients, produits] = await Promise.all([
    prisma.proforma.findMany({ orderBy: { creeLe: "desc" }, take: 100, include: { client: { select: { nom: true } } } }),
    prisma.client.findMany({ orderBy: { nom: "asc" }, select: { id:true, nom:true, typeClient:true } }),
    prisma.produit.findMany({ where: { statut: { not: "inactif" } }, orderBy: { nom: "asc" },
      select: { id:true, sku:true, nom:true, unite:true, prixVente:true, prixRevendeur:true, prixGrossiste:true, stock:true } }),
  ]);

  async function supprimerProforma(formData) {
    "use server";
    await exigerRole(["admin","directeur"]);
    const id = Number(formData.get("id"));
    const nb = await prisma.commande.count({ where: { proformaId: id } });
    if (nb === 0) await prisma.proforma.delete({ where: { id } });
    revalidatePath("/proformas");
  }

  return (
    <>
      <h1>Proformas</h1>
      <p className="soustitre">{liste.length} proforma(s)</p>
      <FormProforma clients={clients} produits={produits}/>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Total</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {liste.map(p => (
              <tr key={p.id}>
                <td><a href={`/proformas/${p.id}`} style={{fontWeight:600}}>{p.numero}</a></td>
                <td>{p.client.nom}</td>
                <td>{dateFr(p.creeLe)}</td>
                <td style={{color:"var(--gold)",fontWeight:600}}>{fcfa(p.total)}</td>
                <td><span className="badge b-bleu">{p.statut}</span></td>
                <td>{["admin","directeur"].includes(u.role) && (
                  <form action={supprimerProforma}><input type="hidden" name="id" value={p.id}/>
                    <button className="btn-danger" style={{padding:"4px 10px",fontSize:12,minHeight:0}}>🗑</button></form>)}</td>
              </tr>
            ))}
            {liste.length === 0 && <tr><td colSpan={6} style={{textAlign:"center",color:"var(--text3)",padding:24}}>Aucune proforma</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
