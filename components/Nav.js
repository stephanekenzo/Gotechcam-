"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";

const MENU = [
  { h: "/dashboard", i: "⬡", l: "Tableau de bord", r: ["admin","directeur","commercial","magasinier","comptable"] },
  { h: "/clients",   i: "👥", l: "Clients & CRM",   r: ["admin","directeur","commercial","comptable"] },
  { h: "/besoins",   i: "🔁", l: "Besoins récurrents", r: ["admin","directeur","commercial"] },
  { h: "/produits",  i: "📦", l: "Produits & Stock", r: ["admin","directeur","commercial","magasinier","comptable"] },
  { h: "/import",    i: "📥", l: "Import commande", r: ["admin","directeur","commercial","magasinier"] },
  { h: "/proformas", i: "📄", l: "Proformas",       r: ["admin","directeur","commercial","comptable"] },
  { h: "/commandes", i: "🧾", l: "Bons de commande", r: ["admin","directeur","commercial","magasinier","comptable"] },
  { h: "/factures",  i: "💰", l: "Factures",        r: ["admin","directeur","commercial","comptable"] },
  { h: "/livraisons",i: "🚛", l: "Livraisons",      r: ["admin","directeur","commercial","magasinier"] },
  { h: "/relances",  i: "🔔", l: "Relances",        r: ["admin","directeur","commercial","comptable"] },
];

export default function Nav({ user }) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();
  const items = MENU.filter((m) => m.r.includes(user.role));

  return (
    <>
      <div className="topbar">
        <span className="logo-p"><img src="/logo.png" alt="GOTECHCAM"/></span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14}}>GOTECHCAM</div>
          <div style={{fontSize:11,color:"var(--text3)"}}>Gestion commerciale</div>
        </div>
        <span className="nom-user" style={{fontSize:13,color:"var(--text2)"}}>
          {user.nom} · {user.role}
        </span>
        <a href="/deconnexion" className="btn btn-sec" style={{padding:"6px 12px",fontSize:12}}>Quitter</a>
        <button className="btn-menu" onClick={() => setOuvert(!ouvert)} aria-label="Menu">☰</button>
      </div>
      {ouvert && <div className="overlay" onClick={() => setOuvert(false)}/>}
      <nav className={"sidenav" + (ouvert ? " ouvert" : "")}>
        {items.map((m) => (
          <a key={m.h} href={m.h} className={chemin.startsWith(m.h) ? "actif" : ""} onClick={() => setOuvert(false)}>
            <span>{m.i}</span> {m.l}
          </a>
        ))}
      </nav>
    </>
  );
}
