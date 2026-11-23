import { Link } from "react-router-dom";

/**
 * Première page mobile (appli et site) : le visiteur est invité à découvrir le catalogue.
 * La connexion n'est demandée que plus tard (par exemple au moment de réserver).
 */
export function BienvenueMobile() {
  return (
    <div className="bv-page">
      <header className="bv-haut">
        <img src="/logo-carentrix.png" alt="Carentrix" className="bv-logo" />
      </header>

      <h1 className="bv-titre">
        Débloquez la liberté
        <br />
        de la route
      </h1>

      <div className="bv-scene">
        <img className="bv-voiture" src="/hero/hero-blanc.png" alt="Véhicule de location Carentrix" />
      </div>

      <div className="bv-bas">
        <p className="bv-texte">
          Des locations sans effort, des possibilités infinies. Prenez le volant et explorez la ville comme jamais.
        </p>
        <div className="bv-actions">
          <Link to="/vehicules" className="bv-bouton bv-bouton-clair">
            Visiter le catalogue
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
