import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { creerSession, utilisateurCourant } from "@/lib/auth";

export default async function Connexion({ searchParams }) {
  if (await utilisateurCourant()) redirect("/dashboard");
  const nbUsers = await prisma.utilisateur.count().catch(() => -1);

  async function seConnecter(formData) {
    "use server";
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const mdp = String(formData.get("motDePasse") || "");
    const u = await prisma.utilisateur.findUnique({ where: { email } });
    if (!u || !u.actif || !(await bcrypt.compare(mdp, u.motDePasse)))
      redirect("/connexion?e=1");
    await creerSession(u.id);
    redirect("/dashboard");
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:26}}>
          <span className="logo-p" style={{display:"inline-flex",padding:"12px 18px",borderRadius:14}}>
            <img src="/logo.png" alt="GOTECHCAM" style={{height:44}}/>
          </span>
          <h1 style={{fontSize:21,marginTop:14}}>GOTECHCAM</h1>
          <p style={{color:"var(--text2)",fontSize:13,marginTop:4}}>Gestion commerciale</p>
        </div>
        <div className="card">
          {searchParams?.e && <div className="err">Email ou mot de passe incorrect.</div>}
          {nbUsers === 0 && <div className="ok">Aucun compte. <a href="/installation">Créer le compte administrateur</a></div>}
          {nbUsers === -1 && <div className="err">Base de données inaccessible. Vérifiez DATABASE_URL sur Vercel.</div>}
          <form action={seConnecter}>
            <label className="label">Email</label>
            <input type="email" name="email" required autoFocus style={{marginBottom:14}}/>
            <label className="label">Mot de passe</label>
            <input type="password" name="motDePasse" required style={{marginBottom:18}}/>
            <button type="submit" style={{width:"100%"}}>Se connecter</button>
          </form>
        </div>
      </div>
    </div>
  );
}
