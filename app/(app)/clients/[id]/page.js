import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICONES = { appel:"📞", whatsapp:"💬", email:"✉", rdv:"📅", relance:"🔔", note:"📝" };

export default async function FicheClient({ params }) {
  const u = await exigerRole(["admin","directeur","commercial","comptable"]);
  const id = Number(params.id);

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      proformas: { orderBy: { creeLe: "desc" } },
      commandes: { orderBy: { creeLe: "desc" } },
      factures:  { orderBy: { creeLe: "desc" } },
      besoins:   { where: { actif: true }, orderBy: { prochainRappel: "asc" } },
      activites: { orderBy: { creeLe: "desc" }, take: 25, include: { faitPar: { select: { nom: true } } } },
    },
  });
  if (!client) return <p>Client introuvable.</p>;

  const ca = client.factures.reduce((s,f) => s + (f.statutPaiement==="payee" ? f.total*(1-f.retenuePct/100) : f.montantPaye), 0);
  const du = client.factures.reduce((s,f) => s + (f.statutPaiement!=="payee" ? Math.max(0, f.total*(1-f.retenuePct/100)-f.montantPaye) : 0), 0);

  async function ajouterActivite(formData) {
    "use server";
    const uu = await exigerRole(["admin","directeur","commercial","comptable"]);
    const commentaire = String(formData.get("commentaire") || "").trim();
    if (!commentaire) return;
    await prisma.activiteCrm.create({ data: {
      clientId: id, type: formData.get("type") || "note", commentaire, faitParId: uu.id }});
    await prisma.client.update({ where: { id }, data: { statutCommercial: "actif" } });
    revalidatePath(`/clients/${id}`);
  }

  async function ajouterBesoin(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial"]);
    const libelle = String(formData.get("libelle") || "").trim();
    if (!libelle) return;
    const freq = Number(formData.get("frequenceJours")) || null;
    await prisma.besoinClient.create({ data: {
      clientId: id, libelle,
      quantiteTypique: Number(formData.get("quantiteTypique")) || 1,
      frequenceJours: freq,
      prochainRappel: freq ? new Date(Date.now() + freq*86400000) : null,
      notes: formData.get("notes") || null,
    }});
    revalidatePath(`/clients/${id}`);
  }

  const tel = (client.whatsapp || client.telephone || "").replace(/[^0-9]/g, "");

  return (
    <>
      <a href="/clients" style={{fontSize:13}}>← Retour</a>
      <h1 style={{marginTop:8}}>{client.nom}</h1>
      <p className="soustitre">
        {client.secteur && `${client.secteur} · `}{client.typeClient}
        {client.ville && ` · ${client.ville}`}{client.rc && ` · RC ${client.rc}`}{client.niu && ` · NIU ${client.niu}`}
      </p>

      <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
        <div className="card">
          <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase"}}>Contact</div>
          <div style={{fontSize:14,marginTop:6}}>{client.contact || "—"}<br/>{client.telephone}<br/>{client.email}</div>
          {tel && <a className="btn btn-sec" style={{marginTop:8,fontSize:13}} target="_blank" rel="noreferrer"
            href={`https://wa.me/${tel}`}>💬 WhatsApp</a>}
        </div>
        <div className="card"><div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase"}}>CA encaissé</div>
          <div style={{fontSize:20,fontWeight:700,color:"var(--green)",marginTop:6}}>{fcfa(ca)}</div></div>
        <div className="card"><div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase"}}>Restant dû</div>
          <div style={{fontSize:20,fontWeight:700,color:du>0?"var(--red)":"var(--text2)",marginTop:6}}>{fcfa(du)}</div></div>
        <div className="card"><div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase"}}>Documents</div>
          <div style={{fontSize:14,marginTop:6}}>{client.proformas.length} proformas<br/>{client.commandes.length} commandes<br/>{client.factures.length} factures</div></div>
      </div>

      <div className="card">
        <h3 style={{marginBottom:10}}>🔁 Besoins récurrents</h3>
        <p style={{fontSize:12,color:"var(--text2)",marginBottom:12}}>
          Ce que ce client commande habituellement — sert à proposer un réassort sans attendre sa demande.
        </p>
        {client.besoins.length > 0 && (
          <div className="scroll-x"><table>
            <thead><tr><th>Produit</th><th>Qté</th><th>Fréquence</th><th>Prochain rappel</th></tr></thead>
            <tbody>{client.besoins.map(b => (
              <tr key={b.id}><td>{b.libelle}{b.notes && <div style={{fontSize:11,color:"var(--text3)"}}>{b.notes}</div>}</td>
                <td>{b.quantiteTypique}</td>
                <td>{b.frequenceJours ? `tous les ${b.frequenceJours} j` : "—"}</td>
                <td>{b.prochainRappel ? <span className={"badge " + (new Date(b.prochainRappel) <= new Date() ? "b-or":"b-bleu")}>{dateFr(b.prochainRappel)}</span> : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        <form action={ajouterBesoin} style={{marginTop:12,display:"grid",gap:8,gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))"}}>
          <input name="libelle" placeholder="Produit habituel *" required/>
          <input type="number" name="quantiteTypique" min="1" defaultValue="1" placeholder="Qté"/>
          <input type="number" name="frequenceJours" min="1" placeholder="Tous les X jours"/>
          <input name="notes" placeholder="Note"/>
          <button type="submit">+ Ajouter</button>
        </form>
      </div>

      <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))"}}>
        <div className="card">
          <h3 style={{marginBottom:10}}>Historique documents</h3>
          <div className="scroll-x"><table>
            <thead><tr><th>N°</th><th>Type</th><th>Total</th><th>Statut</th></tr></thead>
            <tbody>
              {client.proformas.map(p => <tr key={"p"+p.id}><td><a href={`/proformas/${p.id}`}>{p.numero}</a></td><td>Proforma</td><td>{fcfa(p.total)}</td><td><span className="badge b-bleu">{p.statut}</span></td></tr>)}
              {client.commandes.map(c => <tr key={"c"+c.id}><td>{c.numero}</td><td>Commande</td><td>{fcfa(c.total)}</td><td><span className="badge b-bleu">{c.statut}</span></td></tr>)}
              {client.factures.map(f => <tr key={"f"+f.id}><td>{f.numero}</td><td>Facture</td><td>{fcfa(f.total)}</td><td><span className="badge b-bleu">{f.statutPaiement}</span></td></tr>)}
              {client.proformas.length+client.commandes.length+client.factures.length === 0 &&
                <tr><td colSpan={4} style={{textAlign:"center",color:"var(--text3)",padding:16}}>Aucun document</td></tr>}
            </tbody>
          </table></div>
        </div>

        <div className="card">
          <h3 style={{marginBottom:10}}>Suivi CRM</h3>
          <form action={ajouterActivite} style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <select name="type" style={{maxWidth:140}}>
              {Object.entries(ICONES).map(([k,v]) => <option key={k} value={k}>{v} {k}</option>)}
            </select>
            <input name="commentaire" placeholder="Commentaire..." required style={{flex:1,minWidth:150}}/>
            <button type="submit">+</button>
          </form>
          {client.activites.map(a => (
            <div key={a.id} style={{padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
              <b>{ICONES[a.type]} {a.type}</b> — {a.commentaire}
              <div style={{color:"var(--text3)",fontSize:11}}>{dateFr(a.creeLe)}{a.faitPar && ` · ${a.faitPar.nom}`}</div>
            </div>
          ))}
          {client.activites.length === 0 && <p style={{color:"var(--text3)",textAlign:"center",padding:12}}>Aucune activité</p>}
        </div>
      </div>
    </>
  );
}
