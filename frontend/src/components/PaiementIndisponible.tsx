type PaiementIndisponibleProps = {
  message: string;
  onVoirReservations: () => void;
};

function IllustrationCalendrier() {
  return (
    <svg
      className="indispo-illustration"
      viewBox="0 0 320 250"
      role="img"
      aria-label="Calendrier avec une croix : réservation indisponible"
    >
      <path
        d="M34 150C14 90 66 38 138 48c68-36 150 4 150 76 8 70-62 104-130 92-68 20-112-14-124-66Z"
        fill="#fde3e6"
      />
      <circle cx="58" cy="62" r="10" fill="#fbcfd4" />
      <circle cx="286" cy="200" r="7" fill="#fbcfd4" />
      <ellipse cx="170" cy="222" rx="92" ry="12" fill="#f3c9cf" opacity="0.55" />

      <g transform="rotate(-5 160 120)">
        <rect x="92" y="58" width="136" height="136" rx="18" fill="#ffffff" stroke="#f1e0e3" strokeWidth="2" />
        <path d="M92 76c0-10 8-18 18-18h100c10 0 18 8 18 18v22H92V76Z" fill="#e63946" />
        <rect x="126" y="38" width="12" height="32" rx="6" fill="#1f2a44" />
        <rect x="182" y="38" width="12" height="32" rx="6" fill="#1f2a44" />
        <g fill="#d8dae3">
          <rect x="108" y="112" width="24" height="20" rx="5" />
          <rect x="140" y="112" width="24" height="20" rx="5" />
          <rect x="172" y="112" width="24" height="20" rx="5" />
          <rect x="108" y="142" width="24" height="20" rx="5" />
          <rect x="140" y="142" width="24" height="20" rx="5" />
          <rect x="108" y="170" width="24" height="16" rx="5" />
        </g>
      </g>

      <circle cx="226" cy="168" r="36" fill="#e63946" opacity="0.14" />
      <circle cx="226" cy="168" r="29" fill="#e63946" />
      <path d="m214 156 24 24M238 156l-24 24" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />

      <g strokeLinecap="round" strokeWidth="4" stroke="#e63946">
        <path d="M262 92l14-8" />
        <path d="M266 108l18-2" />
        <path d="M258 76l6-14" />
      </g>

      <path d="M52 186h36l-4 28a6 6 0 0 1-6 5H62a6 6 0 0 1-6-5l-4-28Z" fill="#f4b8c0" />
      <ellipse cx="70" cy="168" rx="11" ry="26" transform="rotate(-28 70 168)" fill="#2f9e5b" />
      <ellipse cx="86" cy="164" rx="10" ry="24" transform="rotate(26 86 164)" fill="#57b97b" />
      <ellipse cx="62" cy="150" rx="9" ry="20" transform="rotate(-50 62 150)" fill="#46ad6b" />
    </svg>
  );
}

function IconeAlerte() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#e63946" />
      <path d="M12 6.5v6.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="1.4" fill="#fff" />
    </svg>
  );
}

function IconeCalendrier() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconeFleche() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaiementIndisponible({ message, onVoirReservations }: PaiementIndisponibleProps) {
  return (
    <div className="page-paiement page-paiement--indispo">
      <span className="indispo-deco indispo-deco--haut" aria-hidden="true" />
      <span className="indispo-deco indispo-deco--bas" aria-hidden="true" />

      <div className="indispo-contenu">
        <IllustrationCalendrier />

        <section className="indispo-carte" aria-labelledby="indispo-titre">
          <p className="indispo-badge">
            <IconeAlerte />
            Réservation
          </p>
          <h1 id="indispo-titre" className="indispo-titre">
            Paiement non disponible
          </h1>
          <p className="indispo-message">{message}</p>
          <button type="button" className="indispo-bouton" onClick={onVoirReservations}>
            <span className="indispo-bouton-icone">
              <IconeCalendrier />
            </span>
            <span className="indispo-bouton-texte">Voir mes réservations</span>
            <IconeFleche />
          </button>
        </section>
      </div>
    </div>
  );
}
