import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
export default async function Accueil() {
  const u = await utilisateurCourant();
  redirect(u ? "/dashboard" : "/connexion");
}
