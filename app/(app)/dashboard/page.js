import { prisma } from "@/lib/db";
import { utilisateurCourant, peutVoirPrixAchat } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const u = await utilisateurCourant();
  const voirPa = peutVoirPrixAchat(u);
  const auj = new Date();

  const [produits, alertes, proformasAttente, factures, besoinsDus, activitesRecentes] = await Promise.all([
    prisma.produit.findMany({ where: { statut: { not: "inactif" } },
      select: { stock: true, prixVente: true, prixAchat: true, statut: true } }),
    prisma.produit.findMany({ where: { statut: { in: ["rupture", "stock_faible"] } },
      orderBy: { stock: "asc" }, take: 8, select: { sku: true, nom: true, stock: true, seuilAlerte: true } }),
    prisma.proforma.count({ where: { statut: "envoyee" } }),
    prisma.facture.findMany({ select: { total: true, retenuePct: true, montantPaye: true, statutPaiement: true } }),
    prisma.besoinClient.findMany({
      where: { actif: true, prochainRappel: { lte: auj } },
      include: { client: { select: { nom: true, telephone: true } } }, take: 8, orderBy: { prochainRappel: "asc" } }),
    prisma.activiteCrm.findMany({ take: 6, orderBy: { creeLe: "desc" },
      include: { client: { select: { id: true, nom: true } } } }),
  ]);

  const valVente = produits.reduce((s, p) => s + p.stock * p.prixVente, 0);
  const valAchat = produits.reduce((s, p) => s + p.stock * (p.prixAchat || 0), 0);
  const caEncaisse = factures.reduce((s, f) => s + (f.statutPaiement === "payee"
    ? f.total * (1 - f.retenuePct / 100) : f.montantPaye), 0);
  const impaye = factures.reduce((s, f) => s + (f.statutPaiement !== "payee"
    ? Math.max(0, f.total * (1 - f.retenuePct / 100) - f.montantPaye) : 0), 0);

  const Carte = ({ titre, valeur, sous, couleur }) => (
    <div className="card">
      <div style={{fontSize:11,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".08em"}}>{titre}</div>
      <div style={{fontSize:22,fontWeight:700,color:couleur,marginTop:6}}>{valeur}</div>
      {sous && <div style={{fontSize:12,color:"var(--text2)",marginTop:4}}>{sous}</div>}
    </div>
  );

  return (
    <>
      <h1>Bonjour {u.nom.split(" ")[0]}</h1>
      <p className="soustitre">{auj.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>

      <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))"}}>
        <Carte titre="Références actives" valeur={produits.length} couleur="var(--blue3)"
          sous={`${produits.filter(p=>p.statut==="rupture").length} ruptures · ${produits.filter(p=>p.statut==="stock_faible").length} stock faible`}/>
        <Carte titre="Valeur du stock" valeur={fcfa(valVente)} couleur="var(--gold)"
          sous={voirPa ? `Marge potentielle : ${fcfa(valVente - valAchat)}` : null}/>
        <Carte titre="CA encaissé" valeur={fcfa(caEncaisse)} couleur="var(--green)"
          sous={`Impayés : ${fcfa(impaye)}`}/>
        <Carte titre="À suivre" valeur={`${proformasAttente} proformas`} couleur="var(--blue3)"
          sous={`${besoinsDus.length} réassort(s) à proposer`}/>
      </div>

      {besoinsDus.length > 0 && (
        <div className="card">
          <h3 style={{marginBottom:10}}>🔁 Réassorts à proposer</h3>
          <div className="scroll-x">
            <table>
              <thead><tr><th>Client</th><th>Produit habituel</th><th>Qté</th><th>Prévu</th><th></th></tr></thead>
              <tbody>{besoinsDus.map(b => (
                <tr key={b.id}>
                  <td><a href={`/clients/${b.clientId}`}>{b.client.nom}</a></td>
                  <td>{b.libelle}</td>
                  <td>{b.quantiteTypique}</td>
                  <td><span className="badge b-or">{dateFr(b.prochainRappel)}</span></td>
                  <td>{b.client.telephone && (
                    <a className="btn btn-sec" style={{padding:"4px 10px",fontSize:12}} target="_blank" rel="noreferrer"
                      href={`https://wa.me/${b.client.telephone.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(
                        `Bonjour, souhaitez-vous renouveler votre commande de ${b.libelle} ? ETS GOTECHCAM`)}`}>💬</a>
                  )}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))"}}>
        <div className="card">
          <h3 style={{marginBottom:10}}>⚠ Alertes stock</h3>
          {alertes.length === 0 ? <p style={{color:"var(--text3)",padding:"12px 0"}}>Aucune alerte</p> : (
            <table><tbody>{alertes.map((a,i) => (
              <tr key={i}><td style={{color:"var(--text3)",fontSize:12}}>{a.sku}</td><td>{a.nom}</td>
              <td><span className={"badge " + (a.stock<=0?"b-rouge":"b-or")}>{a.stock}</span></td></tr>))}
            </tbody></table>
          )}
        </div>
        <div className="card">
          <h3 style={{marginBottom:10}}>Dernières activités clients</h3>
          {activitesRecentes.length === 0 ? <p style={{color:"var(--text3)",padding:"12px 0"}}>Aucune activité</p> :
            activitesRecentes.map(a => (
              <div key={a.id} style={{padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                <a href={`/clients/${a.clientId}`}><b>{a.client.nom}</b></a> — {a.type} : {a.commentaire}
                <div style={{color:"var(--text3)",fontSize:11}}>{dateFr(a.creeLe)}</div>
              </div>))}
        </div>
      </div>
    </>
  );
}
