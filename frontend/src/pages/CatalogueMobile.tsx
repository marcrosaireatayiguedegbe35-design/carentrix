import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { LIBELLES_CATEGORIE } from "../lib/categories";
import { mapperVehicule } from "../lib/mapperVehicule";
import { useNotifications } from "../lib/notifications";
import { supabase } from "../lib/supabaseClient";
import type { Vehicule } from "../types";

const VILLES = ["Cotonou", "Abomey-Calavi", "Porto-Novo"];

function IconeRecherche() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function IconeFiltres() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="15" cy="7" r="2" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="9" cy="17" r="2" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function IconeCloche() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 20.2a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CarteMobile({ vehicule }: { vehicule: Vehicule }) {
  const couverture = vehicule.photos[0];
  const [imageKo, setImageKo] = useState(!couverture);
  const unite = vehicule.uniteTarif === "HEURE" ? "heure" : "jour";

  return (
    <Link to={`/vehicules/${vehicule.codePublic}`} className="cm-carte">
      <div className="cm-carte-media">
        {!imageKo && couverture ? (
          <img
            src={couverture}
            alt={`${vehicule.marque} ${vehicule.modele}`}
            loading="lazy"
            onError={() => setImageKo(true)}
          />
        ) : (
          <span className="cm-carte-vide">
            {vehicule.marque} {vehicule.modele}
          </span>
        )}
        {vehicule.disponible === false && <span className="cm-carte-indispo">Indisponible</span>}
      </div>
      <h3>
        {vehicule.marque} {vehicule.modele}
      </h3>
      <p className="cm-carte-meta">
        {vehicule.annee}
        <span aria-hidden="true">|</span>
        {vehicule.transmission === "AUTOMATIQUE" ? "Automatique" : "Manuelle"}
      </p>
      <p className="cm-carte-prix">
        {vehicule.prixUnitaire.toLocaleString("fr-FR")} FCFA <small>/ {unite}</small>
      </p>
    </Link>
  );
}

/** Accueil mobile du catalogue (maquette) : titre, recherche, catégories, grille 2 colonnes. */
export function CatalogueMobile() {
  const { nonLues } = useNotifications();
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [categorie, setCategorie] = useState("");
  const [texte, setTexte] = useState("");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [ville, setVille] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [periode, setPeriode] = useState({ debut: "", fin: "" });
  const [alerte, setAlerte] = useState<string | null>(null);
  const requeteId = useRef(0);

  useEffect(() => {
    const id = ++requeteId.current;
    setChargement(true);
    setErreur(null);
    supabase
      .rpc("rechercher_vehicules", {
        p_ville: ville || null,
        p_categorie: categorie || null,
        p_transmission: null,
        p_date_debut: periode.debut && periode.fin ? periode.debut : null,
        p_date_fin: periode.debut && periode.fin ? periode.fin : null,
      })
      .then(({ data, error }) => {
        if (id !== requeteId.current) return;
        if (error) {
          setErreur(error.message || "Impossible de charger les véhicules pour le moment.");
          setVehicules([]);
        } else {
          setVehicules((data ?? []).map((v: Record<string, unknown>) => mapperVehicule(v)));
        }
        setChargement(false);
      });
  }, [ville, categorie, periode]);

  function appliquerPeriode(e: FormEvent) {
    e.preventDefault();
    if ((dateDebut && !dateFin) || (!dateDebut && dateFin)) {
      setAlerte("Indiquez une date de début et une date de fin.");
      return;
    }
    if (dateDebut && dateFin && dateFin < dateDebut) {
      setAlerte("La date de fin doit être postérieure à la date de début.");
      return;
    }
    setAlerte(null);
    setPeriode({ debut: dateDebut, fin: dateFin });
    setFiltresOuverts(false);
  }

  function reinitialiser() {
    setVille("");
    setDateDebut("");
    setDateFin("");
    setPeriode({ debut: "", fin: "" });
    setAlerte(null);
  }

  const t = texte.trim().toLowerCase();
  const visibles = t
    ? vehicules.filter((v) => `${v.marque} ${v.modele} ${v.ville}`.toLowerCase().includes(t))
    : vehicules;
  const libelleCompte = visibles.length === 1 ? "1 véhicule" : `${visibles.length} véhicules`;

  return (
    <div className="cm-page">
      <header className="cm-haut">
        <Link to="/" aria-label="Accueil Carentrix">
          <img src="/logo-carentrix.png" alt="Carentrix" className="cm-logo" />
        </Link>
        <Link
          to="/notifications"
          className="cm-cloche"
          aria-label={nonLues > 0 ? `Notifications, ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
        >
          <IconeCloche />
          {nonLues > 0 && <span className="cm-cloche-badge">{nonLues > 9 ? "9+" : nonLues}</span>}
        </Link>
      </header>

      <h1 className="cm-titre">Bienvenue !</h1>
      <p className="cm-sous-titre">Trouvez et réservez le véhicule qu&apos;il vous faut.</p>

      <div className="cm-recherche-ligne">
        <label className="cm-recherche">
          <IconeRecherche />
          <input
            type="search"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Chercher marque, modèle ou ville"
            aria-label="Rechercher un véhicule"
          />
        </label>
        <button
          type="button"
          className="cm-filtres-bouton"
          aria-expanded={filtresOuverts}
          aria-controls="cm-filtres"
          aria-label="Filtres"
          onClick={() => setFiltresOuverts((o) => !o)}
        >
          <IconeFiltres />
        </button>
      </div>

      {filtresOuverts && (
        <form id="cm-filtres" className="cm-filtres" onSubmit={appliquerPeriode}>
          <div className="cm-champ">
            <label htmlFor="cm-ville">Ville</label>
            <select id="cm-ville" value={ville} onChange={(e) => setVille(e.target.value)}>
              <option value="">Toutes les villes</option>
              {VILLES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="cm-champs-dates">
            <div className="cm-champ">
              <label htmlFor="cm-du">Du</label>
              <input id="cm-du" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </div>
            <div className="cm-champ">
              <label htmlFor="cm-au">Au</label>
              <input id="cm-au" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </div>
          </div>
          {alerte && <p className="cm-alerte">{alerte}</p>}
          <div className="cm-filtres-actions">
            <button type="submit" className="cm-bouton-rouge">
              Appliquer
            </button>
            <button type="button" className="cm-lien" onClick={reinitialiser}>
              Réinitialiser
            </button>
          </div>
        </form>
      )}

      <div className="cm-categories" role="tablist" aria-label="Catégories">
        <button
          type="button"
          role="tab"
          aria-selected={categorie === ""}
          className={`cm-categorie${categorie === "" ? " cm-categorie-active" : ""}`}
          onClick={() => setCategorie("")}
        >
          Tous
        </button>
        {Object.entries(LIBELLES_CATEGORIE).map(([code, libelle]) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={categorie === code}
            className={`cm-categorie${categorie === code ? " cm-categorie-active" : ""}`}
            onClick={() => setCategorie(code)}
          >
            {libelle}
          </button>
        ))}
      </div>

      <div className="cm-section-tete">
        <h2>{ville ? `Véhicules à ${ville}` : "Véhicules disponibles"}</h2>
        {!erreur && !chargement && <span className="cm-compte">{libelleCompte}</span>}
      </div>

      {erreur && (
        <p className="cm-etat cm-etat-erreur" role="alert">
          {erreur}
        </p>
      )}
      {!erreur && chargement && visibles.length === 0 && <p className="cm-etat">Chargement du catalogue...</p>}
      {!erreur && !chargement && visibles.length === 0 && (
        <p className="cm-etat">Aucun véhicule trouvé. Essayez d&apos;autres critères.</p>
      )}
      {!erreur && visibles.length > 0 && (
        <div className="cm-grille">
          {visibles.map((v) => (
            <CarteMobile key={v.codePublic} vehicule={v} />
          ))}
        </div>
      )}
    </div>
  );
}
