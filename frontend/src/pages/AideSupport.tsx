import { Link } from "react-router-dom";
import { IconeCasque, IconeTelephone, IconeWhatsApp, NUMEROS_CONTACT } from "../components/ContactDirect";

function IconeRetour() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AideSupport() {
  return (
    <div className="pa-page">
      <header className="pa-barre">
        <Link to="/vehicules" className="pa-retour" aria-label="Retour au catalogue">
          <IconeRetour />
        </Link>
        <h1 className="pa-titre-page">Aide et support</h1>
        <Link to="/" aria-label="Accueil Carentrix">
          <img src="/logo-carentrix.png" alt="Carentrix" className="pa-logo" />
        </Link>
      </header>

      <section className="pa-accroche">
        <span className="pa-casque" aria-hidden="true">
          <IconeCasque />
        </span>
        <p className="pa-question">Besoin d&apos;aide ?</p>
        <p className="pa-horaires">Du lundi au samedi</p>
      </section>

      <ul className="pa-contacts">
        {NUMEROS_CONTACT.map((n) => (
          <li key={n.numero} className="pa-contact">
            <p className="pa-numero">{n.affichage}</p>
            <div className="pa-boutons">
              <a
                href={`https://wa.me/${n.numero}`}
                target="_blank"
                rel="noreferrer"
                className="pa-bouton pa-bouton--rouge"
              >
                <IconeWhatsApp />
                WhatsApp
              </a>
              <a href={`tel:+${n.numero}`} className="pa-bouton pa-bouton--contour">
                <IconeTelephone />
                Appeler
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
