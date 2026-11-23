import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { kycBloqueActivite } from "../lib/kyc";

function IconeAccueil({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.2 12 4.5l8 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 9.8V18a1 1 0 0 0 1 1h3.2v-4.4a1.8 1.8 0 0 1 1.8-1.8 1.8 1.8 0 0 1 1.8 1.8V19H17a1 1 0 0 0 1-1V9.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeVoiture({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 16.4V12l1.6-4.1A2 2 0 0 1 7.5 6.6h9a2 2 0 0 1 1.9 1.3L20 12v4.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16.4h16M4 16.4v1.8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.8M20 16.4v1.8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.6" cy="13.1" r="0.9" fill="currentColor" />
      <circle cx="16.4" cy="13.1" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconeHorloge({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.6V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeDossier({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.3A1.3 1.3 0 0 1 5.3 6h4l1.6 1.7h7.8A1.3 1.3 0 0 1 20 9v8.7A1.3 1.3 0 0 1 18.7 19H5.3A1.3 1.3 0 0 1 4 17.7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeCompte({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19.2c1.4-2.6 3.7-4 6.5-4s5.1 1.4 6.5 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function lienActif({ isActive }: { isActive: boolean }) {
  return `bottom-nav-item${isActive ? " bottom-nav-item-actif" : ""}`;
}

export function BottomNavMobile() {
  const { utilisateur } = useAuth();
  const estLocataire = utilisateur?.role === "LOCATAIRE";
  const kycBloque = kycBloqueActivite(utilisateur);

  if (utilisateur && !estLocataire) return null;

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {!utilisateur && (
        <NavLink to="/" end className={lienActif}>
          <IconeAccueil className="bottom-nav-icone" />
          <span className="bottom-nav-libelle">Accueil</span>
        </NavLink>
      )}

      <NavLink to="/vehicules" className={lienActif}>
        <IconeVoiture className="bottom-nav-icone" />
        <span className="bottom-nav-libelle">Catalogue</span>
      </NavLink>

      {utilisateur && !kycBloque && (
        <NavLink to="/mes-reservations" className={lienActif}>
          <IconeHorloge className="bottom-nav-icone" />
          <span className="bottom-nav-libelle">Locations</span>
        </NavLink>
      )}

      {utilisateur && (
        <NavLink to="/mon-dossier" className={lienActif}>
          <IconeDossier className="bottom-nav-icone" />
          <span className="bottom-nav-libelle">Dossier</span>
          {kycBloque && <span className="bottom-nav-pastille" aria-hidden="true" />}
        </NavLink>
      )}

      {utilisateur ? (
        <NavLink to="/mes-informations" className={lienActif}>
          <IconeCompte className="bottom-nav-icone" />
          <span className="bottom-nav-libelle">Compte</span>
        </NavLink>
      ) : (
        <NavLink to="/connexion" className={lienActif}>
          <IconeCompte className="bottom-nav-icone" />
          <span className="bottom-nav-libelle">Connexion</span>
        </NavLink>
      )}
    </nav>
  );
}
