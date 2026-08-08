import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();

const CATEGORIES = [
  { id: 1, nom: "Matériel d'entretien", prefixeSku: "ENT", ordre: 1, sous: [
    "Balayage & sols","Vitres & surfaces","Seaux & contenants","Éponges & brosses","Produits nettoyants",
    "Savons & hygiène","Désodorisation","Sacs poubelle","Papier hygiénique","Protection personnel"] },
  { id: 2, nom: "Bureautique", prefixeSku: "BUR", ordre: 2, sous: [
    "Papier & impression","Registres & cahiers","Écriture","Classement & archivage","Enveloppes & courrier","Petit matériel"] },
  { id: 3, nom: "Informatique & électronique", prefixeSku: "INF", ordre: 3, sous: [
    "Ordinateurs & écrans","Imprimantes & scanners","Consommables","Stockage","Périphériques",
    "Téléphonie & mobile","Accessoires & entretien"] },
  { id: 4, nom: "Équipement réseau", prefixeSku: "RES", ordre: 4, sous: [
    "Routeurs & switches","Câblage & connectique","Wi-Fi & antennes","Baies & armoires","Onduleurs & énergie"] },
  { id: 5, nom: "Logiciels & services", prefixeSku: "LOG", ordre: 5, sous: [
    "Licences logicielles","Services cloud","Abonnements","Prestations"] },
];

const PARAMETRES = {
  nom_entreprise: "ETS GOTECHCAM",
  rc: "RC/DLA/2022/A/5580",
  niu: "P0693183329172T",
  telephone: "+237 655 93 10 27 | 679 34 93 27",
  email: "contact@gotechcam.com",
  ville: "Douala & Kribi, Cameroun",
  site_web: "gotechcam.com",
  retenue_pct: "2.2",
  conditions_paiement: "Paiement à la livraison",
  pied_page: "ETS GOTECHCAM | +237 655 93 10 27 | contact@gotechcam.com | Douala & Kribi, Cameroun",
};

async function main() {
  for (const c of CATEGORIES) {
    await prisma.categorie.upsert({
      where: { id: c.id },
      update: { nom: c.nom, prefixeSku: c.prefixeSku, ordre: c.ordre },
      create: { id: c.id, nom: c.nom, prefixeSku: c.prefixeSku, ordre: c.ordre },
    });
    for (const s of c.sous) {
      const existe = await prisma.sousCategorie.findFirst({ where: { nom: s, categorieId: c.id } });
      if (!existe) await prisma.sousCategorie.create({ data: { nom: s, categorieId: c.id } });
    }
  }
  console.log("✓ Catégories et sous-catégories");

  const produits = JSON.parse(readFileSync(new URL("./produits.json", import.meta.url)));
  let n = 0;
  for (const p of produits) {
    const existe = await prisma.produit.findUnique({ where: { sku: p.sku } });
    if (!existe) { await prisma.produit.create({ data: p }); n++; }
  }
  console.log(`✓ ${n} produits importés (${produits.length - n} déjà présents)`);

  for (const [cle, valeur] of Object.entries(PARAMETRES))
    await prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } });
  console.log("✓ Paramètres entreprise");

  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Categorie"','id'), COALESCE((SELECT MAX(id) FROM "Categorie"), 1))`);
  console.log("Terminé.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
