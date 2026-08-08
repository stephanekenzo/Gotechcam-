"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { genererNumero } from "@/lib/utils";

export async function creerProforma({ clientId, lignes, note }) {
  const u = await exigerRole(["admin", "directeur", "commercial"]);
  if (!clientId || !lignes?.length) return { erreur: "Client et au moins une ligne requis." };
  const propres = lignes.filter(l => l.nomProduit?.trim());
  if (!propres.length) return { erreur: "Aucune ligne valide." };
  const total = propres.reduce((s, l) => s + l.prixUnit * l.quantite, 0);
  const numero = await genererNumero("PRO", "proforma");
  const p = await prisma.proforma.create({
    data: {
      numero, clientId, total, note: note || null, creeParId: u.id,
      lignes: { create: propres.map(l => ({
        produitId: l.produitId || null, nomProduit: l.nomProduit,
        unite: l.unite || "pièce", quantite: l.quantite, prixUnit: l.prixUnit })) },
    },
  });
  revalidatePath("/proformas");
  redirect(`/proformas/${p.id}`);
}
