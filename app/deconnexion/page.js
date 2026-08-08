import { redirect } from "next/navigation";
import { detruireSession } from "@/lib/auth";
export default function Deconnexion() {
  detruireSession();
  redirect("/connexion");
}
