import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconeCalendrier,
  IconeAgence,
  IconeDeconnexion,
  IconeEquipe,
  IconePerformance,
  IconePieces,
  IconeTableauDeBord,
  IconeUtilisateurs,
  IconeVoiture,
} from "./GarageIcones";

type GroupeNav = {
  titre: string;
  liens: { to: string; libelle: string; icone: typeof IconeVoiture }[];
};

const GROUPES_NAV_GARAGE: GroupeNav[] = [
  {
    titre: "Exploitation",
    liens: [
      { to: "/garage/tableau-de-bord", libelle: "Tableau de bord", icone: IconeTableauDeBord },
      { to: "/garage/vehicules", libelle: "Véhicules", icone: IconeVoiture },
      { to: "/garage/reservations", libelle: "Réservations", icone: IconeCalendrier },
    ],
  },
  {
    titre: "Suivi",
    liens: [
      { to: "/garage/performance", libelle: "Performance", icone: IconePerformance },
      { to: "/garage/journal", libelle: "Journal", icone: IconePieces },
    ],
  },
  {
    titre: "Gestion",
    liens: [
      { to: "/garage/agences", libelle: "Agences", icone: IconeAgence },
      { to: "/garage/utilisateurs", libelle: "Clients", icone: IconeUtilisateurs },
      { to: "/garage/equipe", libelle: "Équipe", icone: IconeEquipe },
    ],
  },
];

const GROUPES_NAV_AGENCE: GroupeNav[] = [
  {
    titre: "Activité",
    liens: [
      { to: "/agence/tableau-de-bord", libelle: "Tableau de bord", icone: IconeTableauDeBord },
      { to: "/agence/vehicules", libelle: "Mes véhicules", icone: IconeVoiture },
      { to: "/agence/reservations", libelle: "Réservations", icone: IconeCalendrier },
    ],
  },
  {
    titre: "Finances",
    liens: [{ to: "/agence/revenus", libelle: "Revenus & transactions", icone: IconePerformance }],
  },
  {
    titre: "Compte",
    liens: [{ to: "/agence/profil", libelle: "Profil de l'agence", icone: IconeAgence }],
  },
];

export function GarageLayout({ espace = "garage" }: { espace?: "garage" | "agence" }) {
  const estAgence = espace === "agence";
  const groupesNav = estAgence ? GROUPES_NAV_AGENCE : GROUPES_NAV_GARAGE;
  const libelleRole = estAgence ? "Agence partenaire" : "Administration";
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    setMenuOuvert(false);
  }, [location.pathname]);

  const initiale = (utilisateur?.pseudo || "G").trim().charAt(0).toUpperCase();
  const dateDuJour = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="garage-app">
      <aside className={`garage-sidebar${menuOuvert ? " est-ouverte" : ""}`}>
        <div className="garage-sidebar-marque">
          <img src="/logo-carentrix.png" alt="Carentrix" className="garage-sidebar-logo" />
          <span>
            <strong>Carentrix</strong>
            <small>{estAgence ? "Espace agence" : "Administration"}</small>
          </span>
        </div>

        <nav className="garage-sidebar-nav" aria-label={estAgence ? "Navigation agence" : "Navigation administration"}>
          {groupesNav.map((groupe) => (
            <div key={groupe.titre} className="garage-sidebar-groupe">
              <p className="garage-sidebar-groupe-titre">{groupe.titre}</p>
              {groupe.liens.map(({ to, libelle, icone: Icone }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `garage-sidebar-lien${isActive ? " est-actif" : ""}`
                  }
                >
                  <Icone />
                  {libelle}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="garage-sidebar-pied">
          <div className="garage-sidebar-utilisateur">
            <span className="garage-sidebar-avatar" aria-hidden="true">
              {initiale}
            </span>
            <div className="garage-sidebar-utilisateur-texte">
              <strong>{utilisateur?.pseudo ?? "Agence"}</strong>
              <span>{libelleRole}</span>
            </div>
          </div>
          <button
            type="button"
            className="garage-sidebar-deconnexion"
            onClick={() => {
              void deconnexion();
              navigate("/connexion");
            }}
          >
            <IconeDeconnexion />
            Se déconnecter
          </button>
        </div>
      </aside>

      {menuOuvert && (
        <button
          type="button"
          className="garage-sidebar-fond"
          aria-label="Fermer le menu"
          onClick={() => setMenuOuvert(false)}
        />
      )}

      <div className="garage-zone">
        <header className="garage-topbar">
          <button
            type="button"
            className={`garage-burger${menuOuvert ? " est-ouvert" : ""}`}
            aria-expanded={menuOuvert}
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOuvert((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <img src="/logo-carentrix.png" alt="Carentrix" className="garage-topbar-logo" />
          <span className="garage-topbar-date">
            <IconeCalendrier taille={18} />
            {dateDuJour}
          </span>
          <div className="garage-topbar-utilisateur">
            <span className="garage-topbar-avatar" aria-hidden="true">
              {initiale}
            </span>
            <span className="garage-topbar-utilisateur-texte">
              <strong>{utilisateur?.pseudo ?? "Agence"}</strong>
              <small>{libelleRole}</small>
            </span>
          </div>
        </header>

        <main className="garage-contenu">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
