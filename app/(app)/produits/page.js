import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigerConnexion, exigerRole, peutVoirPrixAchat } from "@/lib/auth";
import { fcfa, mouvementStock } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BADGES = { disponible:"b-vert", stock_faible:"b-or", rupture:"b-rouge",
  sur_commande:"b-bleu", stock_permanent:"b-bleu", inactif:"b-gris" };

export default async function Produits({ searchParams }) {
  const u = await exigerConnexion();
  const voirPa = peutVoirPrixAchat(u);
  const q = (searchParams?.q || "").trim();
  const cat = Number(searchParams?.cat) || 0;

  const [produits, categories] = await Promise.all([
    prisma.produit.findMany({
      where: {
        statut: { not: "inactif" },
        ...(cat ? { categorieId: cat } : {}),
        ...(q ? { OR: [{nom:{contains:q,mode:"insensitive"}},{sku:{contains:q,mode:"insensitive"}},{marque:{contains:q,mode:"insensitive"}}] } : {}),
      },
      include: { categorie: { select: { nom: true } } },
      orderBy: { sku: "asc" },
    }),
    prisma.categorie.findMany({ orderBy: { ordre: "asc" } }),
  ]);

  async function creerProduit(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial","magasinier"]);
    const nom = String(formData.get("nom") || "").trim();
    const categorieId = Number(formData.get("categorieId"));
    if (!nom || !categorieId) return;
    const c = await prisma.categorie.findUnique({ where: { id: categorieId } });
    const dernier = await prisma.produit.findFirst({
      where: { sku: { startsWith: c.prefixeSku + "-" } }, orderBy: { id: "desc" }, select: { sku: true } });
    const n = dernier ? parseInt(dernier.sku.split("-")[1]) + 1 : 1;
    const stock = Number(formData.get("stock")) || 0;
    const p = await prisma.produit.create({ data: {
      sku: `${c.prefixeSku}-${String(n).padStart(3,"0")}`,
      nom, categorieId,
      marque: formData.get("marque") || null,
      unite: formData.get("unite") || "pièce",
      prixAchat: formData.get("prixAchat") ? Number(formData.get("prixAchat")) : null,
      prixVente: Number(formData.get("prixVente")) || 0,
      seuilAlerte: Number(formData.get("seuilAlerte")) || 5,
      stock: 0,
    }});
    if (stock > 0) await mouvementStock({ produitId: p.id, type: "entree", quantite: stock, note: "Stock initial" });
    revalidatePath("/produits");
  }

  async function faireMouvement(formData) {
    "use server";
    await exigerRole(["admin","directeur","commercial","magasinier"]);
    try {
      await mouvementStock({
        produitId: Number(formData.get("produitId")),
        type: String(formData.get("type")),
        quantite: Number(formData.get("quantite")),
        note: formData.get("note") || "Mouvement manuel",
      });
    } catch (e) { /* l'erreur est visible via le stock inchangé */ }
    revalidatePath("/produits");
  }

  return (
    <>
      <h1>Produits & Stock</h1>
      <p className="soustitre">{produits.length} produit(s)</p>

      <form style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <select name="cat" defaultValue={cat} style={{maxWidth:220}}>
          <option value="0">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Nom, SKU, marque..." style={{maxWidth:260}}/>
        <button className="btn-sec" type="submit">Filtrer</button>
      </form>

      <details className="card">
        <summary style={{cursor:"pointer",fontWeight:600}}>+ Nouveau produit</summary>
        <form action={creerProduit} style={{marginTop:14}}>
          <div className="grille" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
            <div style={{gridColumn:"1/-1"}}><label className="label">Désignation *</label><input name="nom" required/></div>
            <div><label className="label">Catégorie *</label>
              <select name="categorieId" required>{categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
            <div><label className="label">Marque</label><input name="marque"/></div>
            <div><label className="label">Unité</label><input name="unite" defaultValue="pièce"/></div>
            {voirPa && <div><label className="label">Prix d&apos;achat</label><input type="number" name="prixAchat" placeholder="Si connu"/></div>}
            <div><label className="label">Prix de vente *</label><input type="number" name="prixVente" required/></div>
            <div><label className="label">Stock initial</label><input type="number" name="stock" defaultValue="0"/></div>
            <div><label className="label">Seuil d&apos;alerte</label><input type="number" name="seuilAlerte" defaultValue="5"/></div>
          </div>
          <button type="submit" style={{marginTop:14}}>Enregistrer</button>
        </form>
      </details>

      <div className="card scroll-x">
        <table>
          <thead><tr><th>SKU</th><th>Produit</th><th>Catégorie</th>{voirPa && <th>P. achat</th>}{voirPa && <th>Marge</th>}<th>P. vente</th><th>Stock</th><th>Statut</th><th>Mouvement</th></tr></thead>
          <tbody>
            {produits.map(p => (
              <tr key={p.id}>
                <td style={{color:"var(--text3)",fontSize:12}}>{p.sku}</td>
                <td><b>{p.nom}</b>{p.marque && <div style={{fontSize:11,color:"var(--text3)"}}>{p.marque}</div>}</td>
                <td style={{fontSize:13}}>{p.categorie.nom}</td>
                {voirPa && <td style={{color:"var(--text2)"}}>{p.prixAchat ? fcfa(p.prixAchat) : "—"}</td>}
                {voirPa && <td style={{color:"var(--green)",fontWeight:600}}>
                  {p.prixAchat && p.prixVente ? `${fcfa(p.prixVente - p.prixAchat)} (${Math.round((p.prixVente - p.prixAchat) / p.prixAchat * 100)}%)` : "—"}
                </td>}
                <td style={{color:"var(--gold)",fontWeight:600}}>{fcfa(p.prixVente)}</td>
                <td style={{fontWeight:700,textAlign:"center",
                  color:p.stock<=0?"var(--red)":p.stock<p.seuilAlerte?"var(--gold)":"var(--green)"}}>{p.stock}</td>
                <td><span className={"badge " + BADGES[p.statut]}>{p.statut.replace("_"," ")}</span></td>
                <td>
                  <form action={faireMouvement} style={{display:"flex",gap:4}}>
                    <input type="hidden" name="produitId" value={p.id}/>
                    <select name="type" style={{width:75,padding:"5px 6px",fontSize:12}}>
                      <option value="entree">+</option><option value="sortie">−</option><option value="ajustement">=</option>
                    </select>
                    <input type="number" name="quantite" min="0" defaultValue="1" style={{width:65,padding:"5px 6px",fontSize:12}}/>
                    <button className="btn-sec" style={{padding:"5px 9px",fontSize:12,minHeight:0}}>OK</button>
                  </form>
                </td>
              </tr>
            ))}
            {produits.length === 0 && <tr><td colSpan={8} style={{textAlign:"center",color:"var(--text3)",padding:24}}>Aucun produit</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
