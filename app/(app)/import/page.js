import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import ImportClient from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await exigerRole(["admin", "directeur", "commercial", "magasinier"]);
  const [clients, produits] = await Promise.all([
    prisma.client.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, ville: true } }),
    prisma.produit.findMany({
      where: { statut: { not: "inactif" } },
      orderBy: { nom: "asc" },
      select: { id: true, sku: true, nom: true, unite: true, prixVente: true, prixAchat: true, stock: true, statut: true },
    }),
  ]);
  return (
    <>
      <h1>📥 Import de commande client</h1>
      <p className="soustitre">
        Importez la demande du client (PDF, Excel ou texte). Les produits sont rapprochés
        automatiquement de votre catalogue — vous validez avant de générer la proforma.
      </p>
      <ImportClient clients={clients} produits={produits} />
    </>
  );
}
