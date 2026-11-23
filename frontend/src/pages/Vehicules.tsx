import { useEffect, useRef, useState, type ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { BanniereSecurite } from "../components/BanniereSecurite";
import { CarteVehicule } from "../components/CarteVehicule";
import { LIBELLES_CATEGORIE, categorieDepuisParam } from "../lib/categories";
import type { Vehicule } from "../types";

const VILLES = ["Cotonou", "Abomey-Calavi", "Porto-Novo"];
const CATEGORIES = LIBELLES_CATEGORIE;

type Filtres = {
  ville: string;
  categorie: string;
  dateDebut: string;
  dateFin: string;
};

function IconeLocalisation() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconeCategorie() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7.5h16M4 12h10M4 16.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="m15 14 2.2-2.2a2 2 0 0 1 2.8 0L21 13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="18.5" cy="16.5" r="2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconeCalendrier() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconeRecherche() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconeChevronBas({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeToutesCategories() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.75 12h16.5M12 3.75c2.15 2.3 3.35 5.2 3.35 8.25S14.15 17.95 12 20.25c-2.15-2.3-3.35-5.2-3.35-8.25S9.85 6.05 12 3.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconeCitadine() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 15.5v-2.1l1.1-2.6a1.5 1.5 0 0 1 1.4-.9h7l1.4.9 1.1 2.6v2.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6 15.5h12M6 15.5v1.3a.7.7 0 0 0 .7.7h.7a.7.7 0 0 0 .7-.7v-1.3M15.9 15.5v1.3a.7.7 0 0 0 .7.7h.7a.7.7 0 0 0 .7-.7v-1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="9" cy="15.5" r="0.7" fill="currentColor" />
      <circle cx="15" cy="15.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

function IconeBerline() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 15.8v-2l1.5-1 1.3-2.9a1.4 1.4 0 0 1 1.3-.85h8.8a1.4 1.4 0 0 1 1.3.85l1.3 2.9 1.5 1v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 15.8h17M3.5 15.8v1.15a.65.65 0 0 0 .65.65h.75a.65.65 0 0 0 .65-.65V15.8M18.45 15.8v1.15a.65.65 0 0 0 .65.65h.75a.65.65 0 0 0 .65-.65V15.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7.7" cy="15.8" r="0.65" fill="currentColor" />
      <circle cx="16.3" cy="15.8" r="0.65" fill="currentColor" />
    </svg>
  );
}

function IconeSuv() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 16v-4.3l1.3-3a1.6 1.6 0 0 1 1.5-1h8.4a1.6 1.6 0 0 1 1.5 1l1.3 3V16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M5 16h14M5 16v1.4a.7.7 0 0 0 .7.7h.8a.7.7 0 0 0 .7-.7V16M16.8 16v1.4a.7.7 0 0 0 .7.7h.8a.7.7 0 0 0 .7-.7V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.7 11.7h8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.7" cy="16" r="0.75" fill="currentColor" />
      <circle cx="15.3" cy="16" r="0.75" fill="currentColor" />
    </svg>
  );
}

function IconeMinibus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="7" width="15" height="8.6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 15.6h15M8.4 7v8.6M13.2 7v8.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 15.6v1.4a.7.7 0 0 0 .7.7h.7a.7.7 0 0 0 .7-.7v-1.4M17.1 15.6v1.4a.7.7 0 0 0 .7.7h.7a.7.7 0 0 0 .7-.7v-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7.2" cy="15.6" r="0.7" fill="currentColor" />
      <circle cx="16.8" cy="15.6" r="0.7" fill="currentColor" />
    </svg>
  );
}

function IconePickup() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 15.5v-3.1l1.2-2.6a1.4 1.4 0 0 1 1.3-.8h4.4v6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10.4 15.5h9.1v-4.9h-5.6l-3.5 1.9v3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3.5 15.5h16M3.5 15.5v1.3a.7.7 0 0 0 .7.7h.6a.7.7 0 0 0 .7-.7v-1.3M16.6 15.5v1.3a.7.7 0 0 0 .7.7h.6a.7.7 0 0 0 .7-.7v-1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="6.9" cy="15.5" r="0.75" fill="currentColor" />
      <circle cx="17.1" cy="15.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

const ICONES_CATEGORIE: Record<string, () => ReactElement> = {
  CITADINE: IconeCitadine,
  BERLINE: IconeBerline,
  SUV: IconeSuv,
  MINIBUS: IconeMinibus,
  PICKUP: IconePickup,
};

function formatDateCourte(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const FILTRES_VIDES: Filtres = { ville: "", categorie: "", dateDebut: "", dateFin: "" };

export function Vehicules() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [alerteFiltres, setAlerteFiltres] = useState<string | null>(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  const [ville, setVille] = useState("");
  const [categorie, setCategorie] = useState(() => categorieDepuisParam(searchParams.get("categorie")));
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const requeteId = useRef(0);

  async function rechercher(filtres: Filtres) {
    const uneDateSeule =
      (Boolean(filtres.dateDebut) && !filtres.dateFin) ||
      (!filtres.dateDebut && Boolean(filtres.dateFin));

    if (uneDateSeule) {
      setAlerteFiltres("Indiquez une date de début et une date de fin pour filtrer la période.");
    } else if (
      filtres.dateDebut &&
      filtres.dateFin &&
      filtres.dateFin < filtres.dateDebut
    ) {
      setAlerteFiltres("La date de fin doit être postérieure à la date de début.");
      return;
    } else {
      setAlerteFiltres(null);
    }

    const id = ++requeteId.current;
    setChargement(true);
    setErreur(null);

    try {
      const { data, error } = await supabase.rpc("rechercher_vehicules", {
        p_ville: filtres.ville || null,
        p_categorie: filtres.categorie || null,
        p_transmission: null,
        // Les deux dates sont requises pour activer le filtre de disponibilité côté SQL
        p_date_debut: !uneDateSeule && filtres.dateDebut ? filtres.dateDebut : null,
        p_date_fin: !uneDateSeule && filtres.dateFin ? filtres.dateFin : null,
      });

      if (id !== requeteId.current) return;

      if (error) {
        console.error("rechercher_vehicules:", error);
        setErreur(error.message || "Impossible de charger les véhicules pour le moment.");
        setVehicules([]);
      } else {
        setVehicules(
          (data ?? []).map((v: Record<string, unknown>) => ({
            codePublic: v.code_public as string,
            marque: v.marque as string,
            modele: v.modele as string,
            annee: v.annee as number,
            transmission: v.transmission as Vehicule["transmission"],
            categorie: v.categorie as Vehicule["categorie"],
            ville: v.ville as string,
            prixUnitaire: v.prix_unitaire as number,
            uniteTarif: v.unite_tarif as Vehicule["uniteTarif"],
            photos: (v.photos as string[] | null) ?? [],
            disponible: v.disponible as boolean,
            noteMoyenne: Number(v.note_moyenne) || 0,
            nbAvis: Number(v.nb_avis) || 0,
          }))
        );
      }
    } catch (e) {
      if (id !== requeteId.current) return;
      console.error(e);
      setErreur("Impossible de charger les véhicules pour le moment.");
      setVehicules([]);
    } finally {
      if (id === requeteId.current) setChargement(false);
    }
  }

  useEffect(() => {
    const depuisUrl = categorieDepuisParam(searchParams.get("categorie"));
    setCategorie((actuelle) => (actuelle === depuisUrl ? actuelle : depuisUrl));
  }, [searchParams]);

  useEffect(() => {
    rechercher({ ville, categorie, dateDebut, dateFin });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ville, categorie]);

  function appliquerCategorie(valeur: string) {
    const code = categorieDepuisParam(valeur);
    setCategorie(code);
    const suivants = new URLSearchParams(searchParams);
    if (code) suivants.set("categorie", code);
    else suivants.delete("categorie");
    setSearchParams(suivants, { replace: true });
  }

  function soumettreRecherche(e: React.FormEvent) {
    e.preventDefault();
    rechercher({ ville, categorie, dateDebut, dateFin });
    setFiltresOuverts(false);
  }

  function reinitialiserFiltres() {
    setVille("");
    setCategorie("");
    setDateDebut("");
    setDateFin("");
    setAlerteFiltres(null);
    setSearchParams({}, { replace: true });
    rechercher(FILTRES_VIDES);
  }

  return (
    <div className="page-vehicules">
      <header className="resa-hero catalogue-hero">
        <img src="/logo-carentrix-blanc.png" alt="Carentrix" className="catalogue-hero-logo" />
        <p className="resa-hero-eyebrow">Catalogue</p>
        <h1 className="resa-hero-titre">Nos véhicules</h1>
        <p className="dossier-hero-sous">
          Découvrez notre sélection de véhicules pour tous vos déplacements.
        </p>
      </header>

      <header className="catalogue-entete">
        <img src="/logo-carentrix.png" alt="Carentrix" className="catalogue-logo" />
        <div>
          <p className="catalogue-eyebrow">Carentrix</p>
          <h1 className="catalogue-titre">Catalogue</h1>
        </div>
        {!erreur && (
          <p className="catalogue-compteur" aria-live="polite">
            {chargement
              ? "Recherche..."
              : vehicules.length === 0
                ? "Aucun véhicule"
                : vehicules.length === 1
                  ? "1 véhicule"
                  : `${vehicules.length} véhicules`}
          </p>
        )}
      </header>

      <div className="catalogue-corps">
      <aside className="catalogue-filtres">
      <div className="recherche-zone">
        <button
          type="button"
          className="recherche-pill"
          onClick={() => setFiltresOuverts((v) => !v)}
          aria-expanded={filtresOuverts}
          aria-controls="panneau-filtres"
        >
          <span className="recherche-pill-icone">
            <IconeRecherche />
          </span>
          <span className="recherche-pill-texte">
            <strong>{ville || "Toutes les villes"}</strong>
            <span>
              {dateDebut && dateFin
                ? `${formatDateCourte(dateDebut)} → ${formatDateCourte(dateFin)}`
                : "Ajouter des dates"}
            </span>
          </span>
          <IconeChevronBas
            className={`recherche-pill-chevron${filtresOuverts ? " recherche-pill-chevron-ouvert" : ""}`}
          />
        </button>

        <form
          id="panneau-filtres"
          className={`barre-filtres${filtresOuverts ? " barre-filtres-ouverte" : ""}`}
          onSubmit={soumettreRecherche}
        >
          <label className="filtre-segment">
            <span className="filtre-libelle">Ville</span>
            <span className="filtre-ligne">
              <span className="filtre-icone">
                <IconeLocalisation />
              </span>
              <select
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                aria-label="Ville"
              >
                <option value="">Toutes les villes</option>
                {VILLES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <span className="filtre-separateur" aria-hidden="true" />

          <div className="filtre-segment-categorie-wrap">
            <label className="filtre-segment">
              <span className="filtre-libelle">Catégorie</span>
              <span className="filtre-ligne">
                <span className="filtre-icone">
                  <IconeCategorie />
                </span>
                <select
                  value={categorie}
                  onChange={(e) => appliquerCategorie(e.target.value)}
                  aria-label="Catégorie"
                >
                  <option value="">Toutes catégories</option>
                  {Object.entries(CATEGORIES).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <span className="filtre-separateur" aria-hidden="true" />
          </div>

          <div className="filtre-segment filtre-segment-dates" role="group" aria-label="Période de location">
            <span className="filtre-libelle">Période</span>
            <span className="filtre-ligne filtre-dates">
              <span className="filtre-icone">
                <IconeCalendrier />
              </span>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                aria-label="Date de début"
              />
              <span className="filtre-dates-separateur" aria-hidden="true">
                →
              </span>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                aria-label="Date de fin"
              />
            </span>
          </div>

          <button type="submit" className="bouton-rechercher" disabled={chargement}>
            <IconeRecherche />
            <span>{chargement ? "Recherche..." : "Rechercher"}</span>
          </button>
          <button type="button" className="filtres-reinitialiser" onClick={reinitialiserFiltres}>
            Réinitialiser les filtres
          </button>
        </form>
      </div>
      </aside>

      <section className="catalogue-resultats" aria-label="Résultats">
      <div className="categories-rail" role="tablist" aria-label="Catégories de véhicules">
        <button
          type="button"
          role="tab"
          aria-selected={categorie === ""}
          className={`categorie-pill${categorie === "" ? " categorie-pill-active" : ""}`}
          onClick={() => appliquerCategorie("")}
        >
          <span className="categorie-pill-icone">
            <IconeToutesCategories />
          </span>
          <span className="categorie-pill-libelle">Toutes</span>
        </button>
        {Object.entries(CATEGORIES).map(([valeur, libelle]) => {
          const Icone = ICONES_CATEGORIE[valeur] ?? IconeToutesCategories;
          return (
            <button
              key={valeur}
              type="button"
              role="tab"
              aria-selected={categorie === valeur}
              className={`categorie-pill${categorie === valeur ? " categorie-pill-active" : ""}`}
              onClick={() => appliquerCategorie(valeur)}
            >
              <span className="categorie-pill-icone">
                <Icone />
              </span>
              <span className="categorie-pill-libelle">{libelle}</span>
            </button>
          );
        })}
      </div>

      {alerteFiltres && <p className="catalogue-alerte">{alerteFiltres}</p>}

      {erreur && (
        <div className="etat-page etat-page-erreur" role="alert">
          <p>{erreur}</p>
          <button type="button" onClick={() => rechercher({ ville, categorie, dateDebut, dateFin })}>
            Réessayer
          </button>
        </div>
      )}

      {!erreur && chargement && vehicules.length === 0 && (
        <div className="etat-page" role="status">
          <div className="etat-page-pulse" aria-hidden="true" />
          <p>Chargement du catalogue...</p>
        </div>
      )}

      {!erreur && !chargement && vehicules.length === 0 && (
        <div className="etat-page">
          <p className="etat-page-titre">Aucun véhicule trouvé</p>
          <p className="texte-secondaire">Essayez de modifier vos critères de recherche.</p>
          <button type="button" className="bouton-secondaire" onClick={reinitialiserFiltres}>
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {!erreur && vehicules.length > 0 && (
        <div className={`grille-vehicules${chargement ? " grille-vehicules-chargement" : ""}`}>
          {vehicules.map((v) => (
            <CarteVehicule key={v.codePublic} vehicule={v} />
          ))}
        </div>
      )}

      </section>
      </div>

      <div className="catalogue-securite">
        <BanniereSecurite />
      </div>
    </div>
  );
}
