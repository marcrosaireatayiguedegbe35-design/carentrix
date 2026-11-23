import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CarteVehicule } from "../components/CarteVehicule";
import { Reveal } from "../components/Reveal";
import { CATEGORIES_VITRINE } from "../lib/categories";
import { supabase } from "../lib/supabaseClient";
import type { Vehicule } from "../types";

const HERO_IMAGE = "/hero/hero-blanc.png";
const HERO_IMAGE_MOBILE = "/hero/hero-blanc.png";

const MARQUES_HERO = [
  { nom: "Toyota", slug: "toyota", domaine: "toyota.com" },
  { nom: "Hyundai", slug: "hyundai", domaine: "hyundai.com" },
  { nom: "Kia", slug: "kia", domaine: "kia.com" },
  { nom: "Mercedes-Benz", slug: "mercedes", domaine: "mercedes-benz.com" },
  { nom: "Peugeot", slug: "peugeot", domaine: "peugeot.com" },
  { nom: "Renault", slug: "renault", domaine: "renault.com" },
  { nom: "Suzuki", slug: "suzuki", domaine: "suzuki.com" },
  { nom: "Nissan", slug: "nissan", domaine: "nissan.com" },
  { nom: "Volkswagen", slug: "volkswagen", domaine: "volkswagen.com" },
  { nom: "BMW", slug: "bmw", domaine: "bmw.com" },
  { nom: "Ford", slug: "ford", domaine: "ford.com" },
  { nom: "Honda", slug: "honda", domaine: "honda.com" },
] as const;

function mapperVehicule(v: Record<string, unknown>): Vehicule {
  return {
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
    zonePriseEnCharge: (v.zone_prise_en_charge as string | null) ?? null,
    zoneIncluse: (v.zone_incluse as string | null) ?? null,
    nombrePlaces: (v.nombre_places as number | null) ?? null,
    nombrePortes: (v.nombre_portes as number | null) ?? null,
    carburant: (v.carburant as Vehicule["carburant"]) ?? null,
    equipements: (v.equipements as string[] | null) ?? [],
    chauffeurObligatoire: (v.chauffeur_obligatoire as boolean) ?? true,
  };
}

export function Accueil() {
  const [derniers, setDerniers] = useState<Vehicule[]>([]);
  const [chargementDerniers, setChargementDerniers] = useState(true);

  useEffect(() => {
    let annule = false;

    async function chargerDerniers() {
      setChargementDerniers(true);
      try {
        const { data, error } = await supabase.rpc("derniers_vehicules", { p_limite: 10 });

        if (!error && data) {
          if (!annule) setDerniers((data as Record<string, unknown>[]).map(mapperVehicule));
          return;
        }

        const fallback = await supabase.rpc("rechercher_vehicules", {
          p_ville: null,
          p_categorie: null,
          p_transmission: null,
          p_date_debut: null,
          p_date_fin: null,
        });

        if (!annule) {
          setDerniers(
            ((fallback.data ?? []) as Record<string, unknown>[]).map(mapperVehicule).slice(0, 10)
          );
        }
      } catch (e) {
        console.error(e);
        if (!annule) setDerniers([]);
      } finally {
        if (!annule) setChargementDerniers(false);
      }
    }

    void chargerDerniers();
    return () => {
      annule = true;
    };
  }, []);

  return (
    <div className="landing">
      <section className="landing-hero" aria-label="Accueil">
        <div className="landing-hero-contenu">
          <div className="landing-hero-bloc">
            <h1 className="landing-hero-item" style={{ "--hero-delay": "80ms" } as CSSProperties}>
              <span className="landing-hero-ligne">La plus grande marketplace</span>
              <span className="landing-hero-ligne">de location de voiture au Bénin</span>
            </h1>

            <p
              className="landing-accroche landing-hero-item"
              style={{ "--hero-delay": "180ms" } as CSSProperties}
            >
              <span className="landing-accroche-ligne">Louez une voiture,</span>{" "}
              <span className="landing-accroche-ligne">on s&apos;occupe du reste.</span>
            </p>

            <div
              className="landing-cta landing-hero-item"
              style={{ "--hero-delay": "280ms" } as CSSProperties}
            >
              <Link to="/vehicules" className="landing-bouton landing-bouton-principal">
                Voir les véhicules
                <span className="landing-bouton-fleche" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>

            <div className="landing-hero-media landing-hero-item" aria-hidden="true" style={{ "--hero-delay": "340ms" } as CSSProperties}>
              <picture>
                <source media="(max-width: 720px)" srcSet={HERO_IMAGE_MOBILE} />
                <img
                  src={HERO_IMAGE}
                  alt=""
                  width={1920}
                  height={1080}
                  className="landing-hero-voiture"
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </div>

        <div className="landing-hero-marques" aria-label="Marques disponibles">
          <div className="landing-hero-marques-piste">
            {[0, 1].map((copie) => (
              <ul
                key={copie}
                className="landing-hero-marques-set"
                aria-hidden={copie > 0 ? true : undefined}
              >
                {MARQUES_HERO.map((marque) => (
                  <li key={`${copie}-${marque.nom}`} className="landing-hero-marque">
                    <img
                      src={`/marques/${marque.slug}.svg`}
                      alt={copie === 0 ? marque.nom : ""}
                      width={160}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                    <span className="landing-hero-marque-nom">{marque.nom}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        <div className="landing-hero-vague" aria-hidden="true">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
            <path d="M0,80 C240,20 480,20 720,55 C960,90 1200,90 1440,40 L1440,120 L0,120 Z" />
          </svg>
        </div>
      </section>

      <section className="landing-section landing-categories" aria-labelledby="landing-categories-titre">
        <div className="landing-section-inner">
          <Reveal className="landing-eyebrow" as="p">
            Catalogue
          </Reveal>
          <Reveal as="h2" delayMs={60} id="landing-categories-titre">
            Découvrir nos catégories
          </Reveal>
          <Reveal className="landing-section-texte" as="p" delayMs={120}>
            Citadine, berline, SUV ou utilitaire — trouvez le véhicule adapté à votre trajet.
          </Reveal>
        </div>

        <div className="landing-categories-rail" role="region" aria-label="Catégories de véhicules">
          <div className="landing-categories-track">
            {[0, 1, 2].map((copie) => (
              <ul
                key={copie}
                className="landing-categories-set"
                aria-hidden={copie > 0 ? true : undefined}
              >
                {CATEGORIES_VITRINE.map((cat) => (
                  <li key={`${copie}-${cat.code}`} className="landing-categories-item">
                    <Link
                      to={`/vehicules?categorie=${cat.code}`}
                      className="landing-categorie-carte"
                      aria-label={`Voir les ${cat.libelle} dans le catalogue`}
                      tabIndex={copie > 0 ? -1 : undefined}
                    >
                      <span className="landing-categorie-media">
                        <img
                          src={cat.image}
                          alt=""
                          width={640}
                          height={400}
                          loading={copie === 0 ? "eager" : "lazy"}
                          decoding="async"
                          draggable={false}
                        />
                      </span>
                      <span className="landing-categorie-nom">{cat.libelle}</span>
                      <span className="landing-categorie-fleche" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-derniers" aria-labelledby="landing-derniers-titre">
        <div className="landing-derniers-intro">
          <Reveal className="landing-eyebrow" as="p">
            Sélection
          </Reveal>
          <Reveal as="h2" delayMs={60} id="landing-derniers-titre">
            Nouveautés du parc
          </Reveal>
          <Reveal className="landing-section-texte" as="p" delayMs={120}>
            Une sélection des véhicules venant d&apos;être mis en location.
          </Reveal>
        </div>

        {chargementDerniers && derniers.length === 0 && (
          <div className="landing-derniers-etat" role="status">
            <div className="etat-page-pulse" aria-hidden="true" />
            <span>Chargement des véhicules…</span>
          </div>
        )}

        {!chargementDerniers && derniers.length === 0 && (
          <p className="landing-derniers-etat">Aucun véhicule disponible pour le moment.</p>
        )}

        {derniers.length > 0 && (
          <div className="landing-derniers-grille grille-vehicules">
            {derniers.map((v) => (
              <CarteVehicule key={v.codePublic} vehicule={v} />
            ))}
          </div>
        )}

        <div className="landing-derniers-pied">
          <Reveal className="landing-derniers-cta" delayMs={80}>
            <Link to="/vehicules" className="landing-bouton landing-bouton-principal">
              Voir tout le catalogue
              <span className="landing-bouton-fleche" aria-hidden="true">
                →
              </span>
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
