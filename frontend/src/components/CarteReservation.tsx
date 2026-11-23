import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Reservation, StatutReservation } from "../types";

type Ton = "vert" | "orange" | "rouge" | "gris";

const STATUTS: Record<
  StatutReservation,
  { badge: string; ton: Ton; libelle: string; explication: string }
> = {
  DEMANDEE: {
    badge: "En attente",
    ton: "orange",
    libelle: "Demande envoyée — en attente validation garage",
    explication: "Nous vous informons dès que votre demande est traitée.",
  },
  EN_ATTENTE_PAIEMENT: {
    badge: "À payer",
    ton: "orange",
    libelle: "Validée par le garage — à payer",
    explication: "Votre demande est acceptée : vous pouvez payer quand vous le souhaitez.",
  },
  REFUSEE: {
    badge: "Refusée",
    ton: "rouge",
    libelle: "Refusée par le garage",
    explication: "Le garage n'a pas pu accepter cette demande.",
  },
  EXPIREE: {
    badge: "Expirée",
    ton: "rouge",
    libelle: "Expirée",
    explication: "Cette réservation n'est plus valable.",
  },
  EN_ATTENTE: {
    badge: "À payer",
    ton: "orange",
    libelle: "En attente de paiement",
    explication: "Finalisez le paiement pour confirmer votre réservation.",
  },
  CONFIRMEE: {
    badge: "Réservation active",
    ton: "vert",
    libelle: "Confirmée",
    explication: "Le garage prépare la remise de votre véhicule.",
  },
  VEHICULE_REMIS: {
    badge: "En cours",
    ton: "vert",
    libelle: "Véhicule remis",
    explication: "Le véhicule vous a été remis. Bonne route !",
  },
  EN_LOCATION: {
    badge: "En cours",
    ton: "vert",
    libelle: "En cours de location",
    explication: "Votre location est en cours.",
  },
  RETOURNE: {
    badge: "Retourné",
    ton: "orange",
    libelle: "Retourné",
    explication: "Le véhicule a été rendu, l'inspection va suivre.",
  },
  INSPECTION: {
    badge: "Inspection",
    ton: "orange",
    libelle: "En inspection",
    explication: "Le garage inspecte le véhicule.",
  },
  LITIGE: {
    badge: "Litige",
    ton: "rouge",
    libelle: "Litige en cours",
    explication: "Un litige est en cours : le garage vous contactera.",
  },
  CLOTUREE: {
    badge: "Terminée",
    ton: "gris",
    libelle: "Clôturée",
    explication: "Location terminée. Merci d'avoir choisi Carentrix.",
  },
  ANNULEE: {
    badge: "Annulée",
    ton: "rouge",
    libelle: "Annulée",
    explication: "Cette réservation a été annulée.",
  },
};

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconeHorloge = () => (
  <Icone>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2.2" />
  </Icone>
);
const IconeCheck = () => (
  <Icone>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.3 2.6 2.6L16.3 9" />
  </Icone>
);
const IconeCroix = () => (
  <Icone>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Icone>
);
const IconeAlerte = () => (
  <Icone>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <circle cx="12" cy="16.3" r="0.6" fill="currentColor" />
  </Icone>
);
const IconeDocument = () => (
  <Icone>
    <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
    <path d="M14 3.5V8h4M9 12.5h6M9 16h6" />
  </Icone>
);
const IconeCalendrier = () => (
  <Icone>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icone>
);
const IconeEtiquette = () => (
  <Icone>
    <path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-6.7 6.7a1.5 1.5 0 0 1-2.12 0l-7.3-7.3a1.5 1.5 0 0 1-.44-1.06Z" />
    <circle cx="8" cy="8" r="1.1" fill="currentColor" />
  </Icone>
);
const IconeOeil = () => (
  <Icone>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icone>
);
const IconeChevron = () => (
  <Icone>
    <path d="m9 6 6 6-6 6" />
  </Icone>
);
const IconeFleche = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const ICONE_TON: Record<Ton, () => ReactNode> = {
  vert: IconeCheck,
  orange: IconeHorloge,
  rouge: IconeCroix,
  gris: IconeAlerte,
};

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR")}`;
}

type CarteReservationProps = {
  reservation: Reservation;
  enAnnulation: boolean;
  onAnnuler: () => void;
  /** Contenu additionnel en bas de carte (ex. avis sur une location clôturée). */
  children?: ReactNode;
};

export function CarteReservation({ reservation: r, enAnnulation, onAnnuler, children }: CarteReservationProps) {
  const statut = STATUTS[r.statut];
  const Statut = ICONE_TON[statut.ton];
  const photo = r.vehicule.photos[0];
  const nom = `${r.vehicule.marque} ${r.vehicule.modele}`;
  const aPayer = r.statut === "EN_ATTENTE_PAIEMENT" || r.statut === "EN_ATTENTE";
  const annulable = r.statut === "DEMANDEE" || aPayer || r.statut === "CONFIRMEE";
  const libelleAnnuler = r.statut === "DEMANDEE" ? "Annuler la demande" : "Annuler";

  return (
    <article className="resa-carte">
      <div className="resa-media">
        {photo ? (
          <img src={photo} alt={nom} loading="lazy" />
        ) : (
          <div className="resa-media-vide" aria-hidden="true">
            {nom}
          </div>
        )}
        <span className={`resa-badge resa-badge--${statut.ton}`}>
          <i aria-hidden="true" />
          {statut.badge}
        </span>
      </div>

      <div className="resa-corps">
        <div className="resa-titre">
          <h2>{nom}</h2>
          <p>
            {r.vehicule.ville}
            {r.chauffeurPseudo ? ` • Chauffeur ${r.chauffeurPseudo}` : ""}
          </p>
        </div>

        <div className={`resa-statut resa-statut--${statut.ton}`}>
          <span className="resa-statut-icone">
            <Statut />
          </span>
          <div>
            <strong>{statut.libelle}</strong>
            <small>{statut.explication}</small>
          </div>
        </div>

        <ul className="resa-infos">
          <li>
            <IconeDocument />
            <span>{r.codePublic}</span>
          </li>
          <li>
            <IconeCalendrier />
            <span>
              {formaterDate(r.dateDebut)} <IconeFleche /> {formaterDate(r.dateFin)}
            </span>
          </li>
        </ul>

        <div className="resa-prix">
          <span className="resa-prix-icone">
            <IconeEtiquette />
          </span>
          <div>
            <strong>{(r.montantTotal + r.caution).toLocaleString("fr-FR")} FCFA</strong>
            <span>Montant total (caution incluse)</span>
          </div>
        </div>

        <div className="resa-actions">
          {aPayer && (
            <Link to={`/paiement/${r.codePublic}`} className="resa-bouton resa-bouton--principal">
              Payer maintenant
              <IconeChevron />
            </Link>
          )}
          <Link to={`/vehicules/${r.vehicule.codePublic}`} className="resa-bouton resa-bouton--details">
            <IconeOeil />
            <span>Voir les détails</span>
            <IconeChevron />
          </Link>
          {annulable && (
            <button type="button" className="resa-bouton resa-bouton--annuler" disabled={enAnnulation} onClick={onAnnuler}>
              {enAnnulation ? "Annulation..." : libelleAnnuler}
            </button>
          )}
        </div>

        {children}
      </div>
    </article>
  );
}
