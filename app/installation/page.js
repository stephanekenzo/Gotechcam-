import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export default async function Installation({ searchParams }) {
  const nb = await prisma.utilisateur.count().catch(() => -1);

  async function creerAdmin(formData) {
    "use server";
    if ((await prisma.utilisateur.count()) > 0) redirect("/connexion");
    const mdp = String(formData.get("motDePasse") || "");
    if (mdp.length < 8) redirect("/installation?e=court");
    await prisma.utilisateur.create({
      data: {
        nom: String(formData.get("nom") || "Administrateur"),
        email: String(formData.get("email") || "").trim().toLowerCase(),
        motDePasse: await bcrypt.hash(mdp, 12),
        role: "admin",
      },
    });
    redirect("/connexion");
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="card" style={{maxWidth:400,width:"100%"}}>
        <h1 style={{marginBottom:6}}>Installation</h1>
        <p className="soustitre">Création du compte administrateur</p>
        {nb === -1 && <div className="err">Base inaccessible — vérifiez DATABASE_URL.</div>}
        {nb > 0 && <div className="err">Un compte existe déjà. <a href="/connexion">Se connecter</a></div>}
        {searchParams?.e === "court" && <div className="err">Mot de passe : 8 caractères minimum.</div>}
        {nb === 0 && (
          <form action={creerAdmin}>
            <label className="label">Nom</label>
            <input name="nom" defaultValue="Stéphane Eteme" required style={{marginBottom:12}}/>
            <label className="label">Email</label>
            <input type="email" name="email" defaultValue="admin@gotechcam.com" required style={{marginBottom:12}}/>
            <label className="label">Mot de passe (8 caractères minimum)</label>
            <input type="password" name="motDePasse" required style={{marginBottom:18}}/>
            <button type="submit" style={{width:"100%"}}>Créer le compte</button>
          </form>
        )}
      </div>
    </div>
  );
}
