import type { ReactNode } from "react";
import { Link } from "react-router-dom";

function IconeRetour() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type EnteteEspaceProps = {
  titre: string;
  sousTitre?: string;
  /** Pastille ou avatar affiché à gauche du titre. */
  avatar?: ReactNode;
  /** Élément sous le sous-titre (pastille de statut, bouton…). */
  accessoire?: ReactNode;
};

/** En-tête commun des pages « Mes réservations », « Mon dossier » et « Mes informations ». */
export function EnteteEspace({ titre, sousTitre, avatar, accessoire }: EnteteEspaceProps) {
  return (
    <header className="ee">
      <div className="ee-haut">
        <Link to="/vehicules" className="ee-retour" aria-label="Retour au catalogue">
          <IconeRetour />
        </Link>
        <Link to="/" aria-label="Accueil Carentrix">
          <img src="/logo-carentrix.png" alt="Carentrix" className="ee-logo" />
        </Link>
      </div>

      <div className="ee-titre-ligne">
        {avatar}
        <div>
          <h1 className="ee-titre">{titre}</h1>
          {sousTitre && <p className="ee-sous">{sousTitre}</p>}
        </div>
      </div>

      {accessoire}
    </header>
  );
}
