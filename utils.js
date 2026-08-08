import { prisma } from "./db";

export const fcfa = (n) =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

export const dateFr = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export async function genererNumero(prefixe, modele) {
  const annee = new Date().getFullYear();
  const dernier = await prisma[modele].findFirst({
    where: { numero: { startsWith: `${prefixe}-${annee}-` } },
    orderBy: { id: "desc" }, select: { numero: true },
  });
  const n = dernier ? parseInt(dernier.numero.slice(-4)) + 1 : 1;
  return `${prefixe}-${annee}-${String(n).padStart(4, "0")}`;
}

export function statutAuto(stock, seuil, statutActuel) {
  if (["stock_permanent", "sur_commande", "inactif"].includes(statutActuel)) return statutActuel;
  if (stock <= 0) return "rupture";
  if (stock < seuil) return "stock_faible";
  return "disponible";
}

/** Mouvement de stock avec garde anti-négatif */
export async function mouvementStock({ produitId, type, quantite, note, reference }) {
  const p = await prisma.produit.findUnique({ where: { id: produitId } });
  if (!p) throw new Error("Produit introuvable.");
  if (type === "sortie") {
    if (!["sur_commande", "stock_permanent"].includes(p.statut) && p.stock < quantite)
      throw new Error(`Stock insuffisant pour « ${p.nom} » (disponible : ${p.stock}, demandé : ${quantite}).`);
  }
  const nouveauStock = type === "ajustement" ? quantite
    : type === "entree" ? p.stock + quantite : p.stock - quantite;

  await prisma.$transaction([
    prisma.produit.update({
      where: { id: produitId },
      data: { stock: nouveauStock, statut: statutAuto(nouveauStock, p.seuilAlerte, p.statut) },
    }),
    prisma.mouvementStock.create({
      data: { produitId, type, quantite, note: note || null, reference: reference || null },
    }),
  ]);
}

export async function param(cle, defaut = "") {
  const p = await prisma.parametre.findUnique({ where: { cle } });
  return p?.valeur ?? defaut;
}
