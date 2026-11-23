import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { estAppNative } from "../lib/native";

type AuthClairProps = {
  titre: ReactNode;
  sousTitre?: ReactNode;
  children: ReactNode;
  pied?: ReactNode;
};

function IconeFermer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Cadre clair des pages d'authentification : logo centré, titre, champs en pilule. */
export function AuthClair({ titre, sousTitre, children, pied }: AuthClairProps) {
  const natif = estAppNative();

  return (
    <div className="ac-page">
      <Link to={natif ? "/vehicules" : "/"} className="ac-fermer" aria-label="Fermer">
        <IconeFermer />
      </Link>

      <main className="ac-colonne">
        <img src="/logo-carentrix.png" alt="Carentrix" className="ac-logo" />
        <h1 className="ac-titre">{titre}</h1>
        {sousTitre && <p className="ac-sous-titre">{sousTitre}</p>}

        {children}

        {pied && <p className="ac-pied">{pied}</p>}
      </main>
    </div>
  );
}
