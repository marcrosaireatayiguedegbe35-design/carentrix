import type { ReactNode } from "react";

type IconeProps = { taille?: number };

function Svg({ taille = 19, children }: IconeProps & { children: ReactNode }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconeTableauDeBord({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}

export function IconeVoiture({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <path
        d="M4.5 16v-3.2l1.9-4.6A2 2 0 0 1 8.25 7h7.5a2 2 0 0 1 1.85 1.2l1.9 4.6V16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M4.5 16h15v2.2a1 1 0 0 1-1 1h-1.2a1 1 0 0 1-1-1V17H7.7v1.2a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="7.75" cy="13.25" r="1" fill="currentColor" />
      <circle cx="16.25" cy="13.25" r="1" fill="currentColor" />
    </Svg>
  );
}

export function IconeCalendrier({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <rect x="3.75" y="5" width="16.5" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.75 9.5h16.5M8 3v3.4M16 3v3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconePieces({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <circle cx="9" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.5 13.5a5.25 5.25 0 1 0-8.4 4.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 11a5.25 5.25 0 1 1 0 8.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 6.8v4.5M6.9 9h4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconeUtilisateurs({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c1.1-3 3-4.6 5.5-4.6s4.4 1.6 5.5 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 6a3 3 0 0 1 0 5.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 14.9c1.8.6 3.1 2 3.9 4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconeEquipe({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c1-2.8 2.7-4.3 5-4.3s4 1.5 5 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 6.3a2.8 2.8 0 0 1 0 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 15.2c1.6.6 2.8 1.9 3.5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.5 4v3.5M17.75 5.75h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconePerformance({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="5.5" y="11" width="3" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="10.5" y="6.5" width="3" height="11" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="15.5" y="9" width="3" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}

export function IconeDeconnexion({ taille = 17 }: IconeProps) {
  return (
    <Svg taille={taille}>
      <path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 8.5 18.5 12l-4 3.5M18 12H9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Icône associée à une page de l'espace garage (selon son URL). */
export function IconeAgence({ taille }: IconeProps) {
  return (
    <Svg taille={taille}>
      <path d="M4 20.5V8.5l8-5 8 5v12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M2.5 20.5h19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="9.5" y="13.5" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="9.5" r="1.3" fill="currentColor" />
    </Svg>
  );
}

export function iconePourChemin(chemin: string) {
  const sousChemin = chemin.replace(/^\/(garage|agence)/, "");
  if (sousChemin.startsWith("/vehicules")) return IconeVoiture;
  if (sousChemin.startsWith("/reservations")) return IconeCalendrier;
  if (sousChemin.startsWith("/performance") || sousChemin.startsWith("/revenus")) return IconePerformance;
  if (sousChemin.startsWith("/journal")) return IconePieces;
  if (sousChemin.startsWith("/utilisateurs")) return IconeUtilisateurs;
  if (sousChemin.startsWith("/equipe")) return IconeEquipe;
  if (sousChemin.startsWith("/agences") || sousChemin.startsWith("/profil")) return IconeAgence;
  return IconeTableauDeBord;
}
