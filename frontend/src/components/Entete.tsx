import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { estAppNative } from "../lib/native";
import { kycBloqueActivite } from "../lib/kyc";

function IconeVolant({ className }: { className?: string }) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4.5v5.3M7.2 18.2 10.4 13M16.8 18.2 13.6 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconeUser({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19.2c1.4-2.6 3.7-4 6.5-4s5.1 1.4 6.5 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeVoiture({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.6V12l3 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeDossier({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.3A1.3 1.3 0 0 1 5.3 6h4l1.6 1.7h7.8A1.3 1.3 0 0 1 20 9v8.7A1.3 1.3 0 0 1 18.7 19H5.3A1.3 1.3 0 0 1 4 17.7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeCloche({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 10a6 6 0 1 1 12 0c0 3.1 1 4.5 1.6 5.2H4.4C5 14.5 6 13.1 6 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 18.4a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconeAide({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.7 9.4a2.3 2.3 0 1 1 3.4 2c-.9.55-1.1.9-1.1 1.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16.6" r="1" fill="currentColor" />
    </svg>
  );
}

function IconeDeconnexionMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h6.4A1.8 1.8 0 0 1 19 5.8v12.4A1.8 1.8 0 0 1 17.2 20h-6.4A1.8 1.8 0 0 1 9 18.2V17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 12H4M4 12l3-3M4 12l3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeFermerMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconeAccueilMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.2 12 4.5l8 6.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 9.8V18a1 1 0 0 0 1 1h3.2v-4.4a1.8 1.8 0 0 1 1.8-1.8 1.8 1.8 0 0 1 1.8 1.8V19H17a1 1 0 0 0 1-1V9.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeChevronMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function lienActif({ isActive }: { isActive: boolean }) {
  return isActive ? "entete-lien entete-lien-actif" : "entete-lien";
}

function lienDrawerActif({ isActive }: { isActive: boolean }) {
  return isActive ? "drawer-item drawer-item-actif" : "drawer-item";
}

function IconeRepereMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" fill="currentColor" />
      <circle cx="12" cy="10" r="2.4" fill="#ffffff" />
    </svg>
  );
}

function IconeBouclierMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 12 2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ItemDrawerProps = {
  to: string;
  Icone: ComponentType<{ className?: string }>;
  titre: string;
  description?: string;
  fin?: ReactNode;
  end?: boolean;
};

function ItemDrawer({ to, Icone, titre, description, fin, end }: ItemDrawerProps) {
  return (
    <NavLink to={to} className={lienDrawerActif} end={end}>
      <span className="drawer-item-pastille">
        <Icone className="drawer-item-icone" />
      </span>
      <span className="drawer-item-texte">
        <strong>{titre}</strong>
        {description && <small>{description}</small>}
      </span>
      {fin ?? <IconeChevronMenu className="drawer-item-chevron" />}
    </NavLink>
  );
}

function TitreSectionDrawer({ Icone, children }: { Icone: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <p className="drawer-section-titre">
      <span className="drawer-section-icone">
        <Icone />
      </span>
      {children}
      <span className="drawer-section-ligne" aria-hidden="true" />
    </p>
  );
}

export function Entete() {
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [menuCache, setMenuCache] = useState(false);
  const natif = estAppNative();

  const role = utilisateur?.role;
  const estLocataire = role === "LOCATAIRE";
  const kycBloque = kycBloqueActivite(utilisateur);
  const estCatalogue =
    location.pathname === "/vehicules" || location.pathname.startsWith("/vehicules/");
  const estAccueil = location.pathname === "/";
  const estCarte = !utilisateur || (estLocataire && Boolean(utilisateur));

  const lienLogo = kycBloque
    ? "/mon-dossier"
    : estLocataire || natif
      ? "/vehicules"
      : "/";

  useEffect(() => {
    setMenuOuvert(false);
    setMenuCache(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOuvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOuvert(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOuvert]);

  useEffect(() => {
    let dernierY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - dernierY;

        if (menuOuvert || y < 24) {
          setMenuCache(false);
        } else if (delta > 6) {
          setMenuCache(true);
        } else if (delta < -6) {
          setMenuCache(false);
        }

        dernierY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOuvert, location.pathname]);

  return (
    <header
      className={`entete${estLocataire ? " entete--locataire" : ""}${natif ? " entete--natif" : ""}${estCatalogue ? " entete--catalogue" : ""}${estAccueil ? " entete--accueil" : ""}${menuCache ? " entete--cache" : ""}`}
    >
      <div className="entete-shell">
        <div className={`entete-barre${estLocataire ? " entete-barre--locataire" : ""}`}>
          <Link to={lienLogo} className="entete-logo">
            <img
              src="/logo-carentrix.png"
              alt="Carentrix"
              className="entete-logo-img"
              width={160}
              height={80}
            />
          </Link>

          <nav
            id="entete-nav"
            className={`entete-nav${menuOuvert ? " entete-nav-ouvert" : ""}${estLocataire ? " entete-nav--locataire" : ""}${estCarte ? " entete-nav--drawer-carte" : ""}${estCarte && !utilisateur ? " entete-nav--drawer-invite" : ""}`}
          >
            {estCarte && (
              <div className="drawer-locataire">
                <div className="drawer-hero">
                  <div className="drawer-haut">
                    <img src="/logo-carentrix-blanc.png" alt="Carentrix" className="drawer-logo" />
                    <button
                      type="button"
                      className="drawer-fermer"
                      aria-label="Fermer le menu"
                      onClick={() => setMenuOuvert(false)}
                    >
                      <IconeFermerMenu />
                      <span>Fermer</span>
                    </button>
                  </div>

                  {utilisateur && (
                    <NavLink to="/mes-informations" className="drawer-profil">
                      <span className="drawer-avatar" aria-hidden="true">
                        <IconeUser />
                      </span>
                      <div className="drawer-profil-texte">
                        <p className="drawer-profil-role">Locataire</p>
                        <p className="drawer-profil-code">{utilisateur.pseudo}</p>
                      </div>
                      <IconeChevronMenu className="drawer-profil-chevron" />
                    </NavLink>
                  )}
                </div>

                <div className="drawer-corps">
                  {utilisateur ? (
                    <>
                      <div className="drawer-section">
                        <TitreSectionDrawer Icone={IconeRepereMenu}>Espace locataire</TitreSectionDrawer>
                        {kycBloque ? (
                          <>
                            <ItemDrawer to="/vehicules" Icone={IconeVoiture} titre="Catalogue" description="Découvrez nos véhicules" />
                            <ItemDrawer
                              to="/mon-dossier"
                              Icone={IconeDossier}
                              titre="Mon dossier"
                              description="Vos documents et informations"
                              fin={<span className="entete-badge-kyc">Requis</span>}
                            />
                          </>
                        ) : (
                          <>
                            <ItemDrawer to="/vehicules" Icone={IconeVoiture} titre="Catalogue" description="Découvrez nos véhicules" />
                            <ItemDrawer to="/mes-reservations" Icone={IconeHorloge} titre="Mes locations" description="Voir vos réservations" />
                            <ItemDrawer to="/mon-dossier" Icone={IconeDossier} titre="Mon dossier" description="Vos documents et informations" />
                          </>
                        )}
                      </div>

                      <div className="drawer-section">
                        <TitreSectionDrawer Icone={IconeDossier}>Compte</TitreSectionDrawer>
                        <ItemDrawer to="/mes-informations" Icone={IconeUser} titre="Mes informations" description="Gérer vos données personnelles" />
                        <ItemDrawer to="/notifications" Icone={IconeCloche} titre="Notifications" description="Vos alertes et messages" />
                        <ItemDrawer to="/aide-support" Icone={IconeAide} titre="Aide & support" description="Nous sommes là pour vous" />
                      </div>

                      <button
                        type="button"
                        className="drawer-deconnexion"
                        onClick={() => {
                          deconnexion();
                          navigate("/connexion");
                        }}
                      >
                        <IconeDeconnexionMenu />
                        Déconnexion
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="drawer-section">
                        <TitreSectionDrawer Icone={IconeRepereMenu}>Menu</TitreSectionDrawer>
                        {!natif && (
                          <ItemDrawer to="/" Icone={IconeAccueilMenu} titre="Accueil" description="Retour à la page d'accueil" end />
                        )}
                        <ItemDrawer to="/vehicules" Icone={IconeVoiture} titre="Catalogue" description="Découvrez nos véhicules" />
                      </div>

                      <div className="entete-nav-mobile-actions">
                        <NavLink to="/connexion" className="entete-cta-ghost">
                          <IconeUser />
                          Connexion
                        </NavLink>
                        <Link to="/inscription" className="entete-cta-plein">
                          S&apos;inscrire
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </>
                  )}

                  <div className="drawer-securite">
                    <IconeBouclierMenu className="drawer-securite-icone" />
                    <span>Votre sécurité, notre priorité</span>
                    <span className="drawer-securite-traits" aria-hidden="true" />
                  </div>
                </div>
              </div>
            )}

            <div className={`entete-nav-legacy${estCarte ? " entete-nav-legacy--mobile-hidden" : ""}`}>
            <div className="entete-nav-pilule">
              {!utilisateur && (
                <>
                  {!natif && (
                    <NavLink to="/" className={lienActif} end>
                      Accueil
                    </NavLink>
                  )}
                  <NavLink to="/vehicules" className={lienActif}>
                    Catalogue
                  </NavLink>
                  <NavLink to="/inscription" className={lienActif}>
                    Inscription
                  </NavLink>
                </>
              )}

              {estLocataire && (
                <>
                  <span className="entete-badge-role" aria-hidden="true">
                    <IconeVolant />
                    Locataire
                  </span>
                  {kycBloque ? (
                    <>
                      <NavLink to="/vehicules" className={lienActif}>
                        Catalogue
                      </NavLink>
                      <NavLink to="/mon-dossier" className={lienActif}>
                        Mon dossier
                        <span className="entete-badge-kyc">Requis</span>
                      </NavLink>
                    </>
                  ) : (
                    <>
                      <NavLink to="/vehicules" className={lienActif}>
                        Catalogue
                      </NavLink>
                      <NavLink to="/mes-reservations" className={lienActif}>
                        Mes locations
                      </NavLink>
                      <NavLink to="/mon-dossier" className={lienActif}>
                        Mon dossier
                      </NavLink>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="entete-nav-mobile-actions">
              {utilisateur ? (
                <>
                  <span className="entete-utilisateur">{utilisateur.pseudo}</span>
                  <button
                    className="bouton-lien entete-deconnexion"
                    type="button"
                    onClick={() => {
                      deconnexion();
                      navigate("/connexion");
                    }}
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/connexion" className="entete-cta-ghost">
                    <IconeUser />
                    Connexion
                  </NavLink>
                  <Link to="/inscription" className="entete-cta-plein">
                    S&apos;inscrire
                    <span aria-hidden="true">→</span>
                  </Link>
                </>
              )}
            </div>
            </div>
          </nav>

          <div className="entete-actions">
            {!utilisateur ? (
              <>
                <NavLink to="/connexion" className="entete-cta-ghost">
                  <IconeUser />
                  Connexion
                </NavLink>
                <Link to="/inscription" className="entete-cta-plein">
                  S&apos;inscrire
                  <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <>
                <span className="entete-utilisateur-compact" title={utilisateur.pseudo}>
                  {utilisateur.pseudo}
                </span>
                <button
                  className="entete-cta-ghost"
                  type="button"
                  onClick={() => {
                    deconnexion();
                    navigate("/connexion");
                  }}
                >
                  Déconnexion
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className={`entete-burger${menuOuvert ? " entete-burger-ouvert" : ""}${estCarte && menuOuvert ? " entete-burger--masque" : ""}`}
            aria-expanded={menuOuvert}
            aria-controls="entete-nav"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOuvert((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {menuOuvert && (
          <button
            type="button"
            className="entete-fond"
            aria-label="Fermer le menu"
            onClick={() => setMenuOuvert(false)}
          />
        )}
      </div>
    </header>
  );
}
