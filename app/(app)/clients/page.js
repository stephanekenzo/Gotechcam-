import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUTS = {
  prospect:{l:"Prospect",c:"b-or"}, nouveau:{l:"Nouveau",c:"b-bleu"},
  actif:{l:"Actif",c:"b-vert"}, inactif:{l:"Inactif",c:"b-gris"}, a_relancer:{l:"À relancer",c:"b-rouge"},
};

export default async function Clients({ searchParams }) {
  await exigerRole(["admin","directeur","commercial","comptable"]);
  const q = (searchParams?.q || "").trim();
  const clients = await prisma.client.findMany({
    where: q ? { OR: [{nom:{contains:q,mode:"insensitive"}},{ville:{contains:q,mode:"insensitive"}},{contact:{contains:q,mode:"insensitive"}}] } : {},
    orderBy: { nom: "asc" },
    include: { _count: { select: { proformas: true, besoins: true } } },
  });

  async function creerClient(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial"]);
    const nom = String(formData.get("nom") || "").trim();
    if (!nom) return;
    await prisma.client.create({ data: {
      nom,
      typeClient: formData.get("typeClient") || "standard",
      statutCommercial: formData.get("statutCommercial") || "nouveau",
      secteur: formData.get("secteur") || null,
      contact: formData.get("contact") || null,
      telephone: formData.get("telephone") || null,
      email: formData.get("email") || null,
      ville: formData.get("ville") || null,
      rc: formData.get("rc") || null,
      niu: formData.get("niu") || null,
    }});
    revalidatePath("/clients");
  }

  return (
    <>
      <h1>Clients & CRM</h1>
      <p className="soustitre">{clients.length} client(s)</p>

      <form style={{display:"flex",gap:8,marginBottom:16,maxWidth:400}}>
        <input name="q" defaultValue={q} placeholder="Rechercher un client..."/>
        <button className="btn-sec" type="submit">🔍</button>
      </form>

      <details className="card">
        <summary style={{cursor:"pointer",fontWeight:600}}>+ Nouveau client</summary>
        <form action={creerClient} style={{marginTop:14}}>
          <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))"}}>
            <div style={{gridColumn:"1/-1"}}><label className="label">Nom / Raison sociale *</label><input name="nom" required/></div>
            <div><label className="label">Secteur</label><input name="secteur" placeholder="Hôtel, Entreprise, École..."/></div>
            <div><label className="label">Type de tarif</label>
              <select name="typeClient"><option value="standard">Standard</option><option value="revendeur">Revendeur</option><option value="grossiste">Grossiste</option></select></div>
            <div><label className="label">Statut commercial</label>
              <select name="statutCommercial" defaultValue="nouveau">
                {Object.entries(STATUTS).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
              </select></div>
            <div><label className="label">Contact</label><input name="contact"/></div>
            <div><label className="label">Téléphone / WhatsApp</label><input name="telephone"/></div>
            <div><label className="label">Email</label><input type="email" name="email"/></div>
            <div><label className="label">Ville</label><input name="ville"/></div>
            <div><label className="label">RC</label><input name="rc"/></div>
            <div><label className="label">NIU</label><input name="niu"/></div>
          </div>
          <button type="submit" style={{marginTop:14}}>Enregistrer</button>
        </form>
      </details>

      <div className="card scroll-x">
        <table>
          <thead><tr><th>Client</th><th>Secteur</th><th>Contact</th><th>Statut</th><th>Suivi</th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td><a href={`/clients/${c.id}`} style={{fontWeight:600}}>{c.nom}</a>
                  <div style={{fontSize:11,color:"var(--text3)"}}>{c.ville}</div></td>
                <td style={{fontSize:13}}>{c.secteur || "—"}</td>
                <td style={{fontSize:13}}>{c.contact}<div style={{color:"var(--text3)"}}>{c.telephone}</div></td>
                <td><span className={"badge " + (STATUTS[c.statutCommercial]?.c || "b-gris")}>{STATUTS[c.statutCommercial]?.l}</span></td>
                <td style={{fontSize:13,color:"var(--text2)"}}>{c._count.proformas} proforma(s)<br/>{c._count.besoins} besoin(s)</td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={5} style={{textAlign:"center",color:"var(--text3)",padding:24}}>Aucun client</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
