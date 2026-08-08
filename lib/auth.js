import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-a-changer");
const COOKIE = "gtc_session";

export async function creerSession(userId) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export function detruireSession() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function utilisateurCourant() {
  const jeton = cookies().get(COOKIE)?.value;
  if (!jeton) return null;
  try {
    const { payload } = await jwtVerify(jeton, secret());
    const u = await prisma.utilisateur.findUnique({ where: { id: payload.uid } });
    return u?.actif ? u : null;
  } catch { return null; }
}

export async function exigerConnexion() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  return u;
}

export async function exigerRole(roles) {
  const u = await exigerConnexion();
  if (!roles.includes(u.role)) redirect("/dashboard?refus=1");
  return u;
}

export const peutVoirPrixAchat = (u) =>
  ["admin", "directeur", "comptable", "commercial"].includes(u.role);
