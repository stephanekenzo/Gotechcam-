import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }) {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  const user = { id: u.id, nom: u.nom, role: u.role };
  return (
    <>
      <Nav user={user}/>
      <main className="contenu">{children}</main>
    </>
  );
}
