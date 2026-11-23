import { Link } from "react-router-dom";

function IconeRetour() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RetourCatalogue() {
  return (
    <Link to="/vehicules" className="detail-retour">
      <IconeRetour />
      Retour au catalogue
    </Link>
  );
}
