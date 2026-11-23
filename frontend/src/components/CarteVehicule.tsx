import { useState } from "react";
import { Link } from "react-router-dom";
import { LIBELLES_CARBURANT } from "../lib/equipements";
import type { Vehicule } from "../types";

const LIBELLES_CATEGORIE: Record<string, string> = {
  CITADINE: "Citadine",
  BERLINE: "Berline",
  SUV: "SUV",
  MINIBUS: "Minibus",
  PICKUP: "Pick-up",
};

function IconePin() {
  return (
    <svg className="carte-vehicule-pin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconeFleche() {
  return (
    <span className="carte-vehicule-fleche" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function IconePhoto() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6.5" width="18" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 6.5 9.6 4h4.8L16 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconeEtoilePleine() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5l2.62 5.94 6.38.65-4.8 4.4 1.32 6.51L12 17.9l-5.52 3.1 1.32-6.51-4.8-4.4 6.38-.65L12 3.5Z"
        fill="#d4a017"
      />
    </svg>
  );
}

export function CarteVehicule({ vehicule }: { vehicule: Vehicule }) {
  const couverture = vehicule.photos[0];
  const [imageKo, setImageKo] = useState(!couverture);

  const libelleUnite = vehicule.uniteTarif === "HEURE" ? "heure" : "jour";
  const libelleCategorie = LIBELLES_CATEGORIE[vehicule.categorie] ?? vehicule.categorie;

  return (
    <Link to={`/vehicules/${vehicule.codePublic}`} className="carte-vehicule">
      <div className="carte-vehicule-media">
        {!imageKo && couverture ? (
          <img
            src={couverture}
            alt={`${vehicule.marque} ${vehicule.modele}`}
            loading="lazy"
            onError={() => setImageKo(true)}
          />
        ) : (
          <div className="carte-vehicule-fallback" aria-hidden="true">
            <span>
              {vehicule.marque} {vehicule.modele}
            </span>
          </div>
        )}
        <span className="carte-vehicule-chip">{libelleCategorie}</span>
        {vehicule.photos.length > 1 && (
          <span className="carte-vehicule-nb-photos">
            <IconePhoto />
            {vehicule.photos.length}
          </span>
        )}
        {vehicule.disponible === false && <span className="carte-vehicule-badge">Indisponible</span>}
      </div>
      <p
        className={`carte-vehicule-bandeau${vehicule.disponible === false ? " carte-vehicule-bandeau--indispo" : ""}`}
      >
        {vehicule.disponible === false ? "Indisponible" : "Disponible à la location"}
      </p>
      <div className="carte-vehicule-corps">
        <h3>
          {vehicule.marque} {vehicule.modele}
        </h3>
        <ul className="carte-vehicule-puces">
          <li>{vehicule.annee}</li>
          <li>{vehicule.transmission === "AUTOMATIQUE" ? "Automatique" : "Manuelle"}</li>
          {vehicule.carburant && <li>{LIBELLES_CARBURANT[vehicule.carburant]}</li>}
        </ul>
        <p className="carte-vehicule-meta">
          <IconePin />
          {vehicule.ville} · {vehicule.annee}
        </p>
        <div className="carte-vehicule-pied">
          <p className="carte-vehicule-prix">
            {vehicule.prixUnitaire.toLocaleString("fr-FR")} FCFA
            <span className="carte-vehicule-unite"> / {libelleUnite}</span>
          </p>
          {!!vehicule.nbAvis && (
            <span className="carte-vehicule-note">
              <IconeEtoilePleine />
              {vehicule.noteMoyenne}
            </span>
          )}
          <IconeFleche />
        </div>
      </div>
    </Link>
  );
}
