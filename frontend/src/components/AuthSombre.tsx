import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { estAppNative } from "../lib/native";

type AuthSombreProps = {
  onglet: "connexion" | "inscription";
  /** Petit titre affiché sous les onglets (ex. étape « Vérifier votre email »). */
  titreEtape?: string;
  sousTitre?: string;
  children: ReactNode;
};

function IconeFermer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Cadre sombre des pages de connexion et d'inscription (photo en fond, panneau translucide, onglets). */
export function AuthSombre({ onglet, titreEtape, sousTitre, children }: AuthSombreProps) {
  const natif = estAppNative();

  return (
    <div className="as-page">
      <img className="as-fond" src="/hero/hero-02.jpg" alt="" />
      <div className="as-voile" aria-hidden="true" />

      <div className="as-colonne">
        <div className="as-haut">
          <Link to={natif ? "/vehicules" : "/"} className="as-fermer" aria-label="Fermer">
            <IconeFermer />
          </Link>
          <img src="/logo-carentrix-blanc.png" alt="Carentrix" className="as-logo" />
          <p className="as-bienvenue">Bienvenue</p>
        </div>

        <section className="as-panneau">
          <nav className="as-onglets" aria-label="Connexion ou inscription">
            <Link
              to="/connexion"
              className={`as-onglet${onglet === "connexion" ? " as-onglet-actif" : ""}`}
              aria-current={onglet === "connexion" ? "page" : undefined}
            >
              Se connecter
            </Link>
            <Link
              to="/inscription"
              className={`as-onglet${onglet === "inscription" ? " as-onglet-actif" : ""}`}
              aria-current={onglet === "inscription" ? "page" : undefined}
            >
              S&apos;inscrire
            </Link>
          </nav>

          {titreEtape && <h1 className="as-titre-etape">{titreEtape}</h1>}
          {sousTitre && <p className="as-sous-titre">{sousTitre}</p>}

          {children}
        </section>
      </div>
    </div>
  );
}
