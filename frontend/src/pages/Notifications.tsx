import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useNotifications, type NotificationClient } from "../lib/notifications";

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const IconeRetour = () => (
  <svg {...base} width={20} height={20} strokeWidth={2}>
    <path d="M15 6 9 12l6 6" />
  </svg>
);
const IconeVoiture = () => (
  <svg {...base}>
    <path d="M4 16.4V12l1.6-4.1A2 2 0 0 1 7.5 6.6h9a2 2 0 0 1 1.9 1.3L20 12v4.4" />
    <path d="M4 16.4h16M4 16.4v1.8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.8M20 16.4v1.8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1.8" />
    <circle cx="7.6" cy="13.1" r="0.9" fill="currentColor" />
    <circle cx="16.4" cy="13.1" r="0.9" fill="currentColor" />
  </svg>
);
const IconeValide = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.3l2.6 2.6L16.3 9" />
  </svg>
);
const IconeRefus = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </svg>
);
const IconeCloche = () => (
  <svg {...base} width={30} height={30}>
    <path d="M6 10.5a6 6 0 0 1 12 0v3.3l1.4 2.4H4.6L6 13.8Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);
const IconeChevron = () => (
  <svg {...base} width={18} height={18} strokeWidth={2}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

function icone(n: NotificationClient): ReactNode {
  if (n.type === "VEHICULE") return <IconeVoiture />;
  return n.tonalite === "succes" ? <IconeValide /> : <IconeRefus />;
}

function depuis(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function Notifications() {
  const { items, chargement, marquerToutLu } = useNotifications();
  // Les nouvelles notifications restent mises en évidence pendant cette visite, puis passent en « lues ».
  const nonLuesAuxDebut = useRef<Set<string> | null>(null);
  if (nonLuesAuxDebut.current === null && !chargement) {
    nonLuesAuxDebut.current = new Set(items.filter((n) => !n.lu).map((n) => n.id));
  }

  useEffect(() => {
    if (chargement) return;
    marquerToutLu();
  }, [chargement, marquerToutLu]);

  return (
    <div className="nt-page">
      <header className="nt-barre">
        <Link to="/vehicules" className="nt-retour" aria-label="Retour au catalogue">
          <IconeRetour />
        </Link>
        <h1 className="nt-titre">Notifications</h1>
        <Link to="/" aria-label="Accueil Carentrix">
          <img src="/logo-carentrix.png" alt="Carentrix" className="nt-logo" />
        </Link>
      </header>

      {chargement && items.length === 0 && <p className="nt-etat">Chargement…</p>}

      {!chargement && items.length === 0 && (
        <div className="nt-vide">
          <span className="nt-vide-icone" aria-hidden="true">
            <IconeCloche />
          </span>
          <p className="nt-vide-titre">Aucune notification</p>
          <Link to="/vehicules" className="nt-bouton">
            Voir le catalogue
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <ul className="nt-liste">
          {items.map((n) => {
            const nouvelle = nonLuesAuxDebut.current?.has(n.id) ?? false;
            return (
              <li key={n.id}>
                <Link
                  to={n.lien}
                  className={`nt-item nt-item--${n.tonalite}${nouvelle ? " nt-item--nouvelle" : ""}`}
                >
                  <span className="nt-icone">{icone(n)}</span>
                  <span className="nt-texte">
                    <strong>{n.titre}</strong>
                    <span className="nt-detail">{n.detail}</span>
                    <small>{depuis(n.date)}</small>
                  </span>
                  {nouvelle && <span className="nt-point" aria-label="Nouveau" />}
                  <IconeChevron />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
