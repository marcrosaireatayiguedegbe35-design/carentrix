import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import type { VehiculeGarage } from "../../types";

const LIBELLES_CATEGORIE: Record<string, string> = {
  CITADINE: "Citadine",
  BERLINE: "Berline",
  SUV: "SUV",
  MINIBUS: "Minibus",
  PICKUP: "Pick-up",
};

export function VehiculesGarage() {
  const [vehicules, setVehicules] = useState<VehiculeGarage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "a_valider" | "en_ligne" | "hors_ligne">("tous");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  async function charger() {
    setChargement(true);
    const { data, error } = await supabase
      .from("vehicules")
      .select("*, agences(nom, est_plateforme)")
      .order("created_at", { ascending: false });
    if (!error) {
      setVehicules(
        (data ?? []).map((v: Record<string, unknown>) => ({
          codePublic: v.code_public as string,
          proprietaireId: v.proprietaire_id as string,
          marque: v.marque as string,
          modele: v.modele as string,
          annee: v.annee as number,
          transmission: v.transmission as VehiculeGarage["transmission"],
          categorie: v.categorie as VehiculeGarage["categorie"],
          ville: v.ville as string,
          prixUnitaire: v.prix_unitaire as number,
          uniteTarif: v.unite_tarif as VehiculeGarage["uniteTarif"],
          photos: (v.photos as string[] | null) ?? [],
          disponible: v.disponible as boolean,
          controleTechniqueOk: v.controle_technique_ok as boolean,
          agenceNom: (() => {
            const a = v.agences as { nom: string; est_plateforme: boolean } | null;
            return a && !a.est_plateforme ? a.nom : null;
          })(),
          entrepriseProvenance: (v.entreprise_provenance as string | null) ?? null,
          coutUnitaire: (v.cout_unitaire as number | null) ?? null,
          zonePriseEnCharge: (v.zone_prise_en_charge as string | null) ?? null,
          zoneIncluse: (v.zone_incluse as string | null) ?? null,
          nombrePlaces: (v.nombre_places as number | null) ?? null,
          nombrePortes: (v.nombre_portes as number | null) ?? null,
          carburant: (v.carburant as VehiculeGarage["carburant"]) ?? null,
          equipements: (v.equipements as string[] | null) ?? [],
          chauffeurObligatoire: (v.chauffeur_obligatoire as boolean) ?? true,
        }))
      );
    }
    setChargement(false);
  }

  useEffect(() => {
    void charger();
  }, []);

  async function basculerDisponible(codePublic: string, valeur: boolean) {
    setEnCours(codePublic);
    await supabase
      .from("vehicules")
      .update({ disponible: valeur, controle_technique_ok: true })
      .eq("code_public", codePublic);
    setEnCours(null);
    void charger();
  }

  async function supprimerVehicule(codePublic: string, libelle: string) {
    const ok = window.confirm(
      `Supprimer définitivement ${libelle} (${codePublic}) du catalogue ? Cette action est irréversible.`
    );
    if (!ok) return;
    setEnCours(codePublic);
    setErreurs((e) => ({ ...e, [codePublic]: "" }));
    const { error } = await supabase.rpc("garage_supprimer_vehicule", {
      p_code_public: codePublic,
    });
    setEnCours(null);
    if (error) {
      setErreurs((e) => ({ ...e, [codePublic]: error.message }));
    } else {
      void charger();
    }
  }

  const enLigne = (v: VehiculeGarage) => v.disponible && v.controleTechniqueOk;
  const aValider = (v: VehiculeGarage) => v.disponible && !v.controleTechniqueOk;
  const nbAValider = vehicules.filter(aValider).length;

  const listes = vehicules.filter((v) => {
    if (filtre === "a_valider") return aValider(v);
    if (filtre === "en_ligne") return enLigne(v);
    if (filtre === "hors_ligne") return !v.disponible;
    return true;
  });

  return (
    <GarageShell
      titre="Parc"
      sousTitre="Publiez et mettez en ligne les véhicules de l’agence."
      actions={
        <Link to="/garage/vehicules/nouveau" className="garage-btn garage-btn--principal">
          Publier
        </Link>
      }
    >
      <div className="garage-onglets" role="tablist" aria-label="Filtrer le parc">
        {(
          [
            ["tous", "Tous"],
            ["a_valider", nbAValider > 0 ? `À valider (${nbAValider})` : "À valider"],
            ["en_ligne", "En ligne"],
            ["hors_ligne", "Hors ligne"],
          ] as const
        ).map(([id, libelle]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filtre === id}
            className={`garage-onglet${filtre === id ? " is-actif" : ""}`}
            onClick={() => setFiltre(id)}
          >
            {libelle}
          </button>
        ))}
      </div>

      {chargement && <p className="garage-etat">Chargement du parc…</p>}
      {!chargement && listes.length === 0 && (
        <div className="garage-vide">
          <p>Aucun véhicule dans ce filtre.</p>
          <Link to="/garage/vehicules/nouveau" className="garage-btn garage-btn--principal">
            Publier un véhicule
          </Link>
        </div>
      )}

      <div className="garage-grille-vehicules">
        {listes.map((v) => (
          <article key={v.codePublic} className="garage-carte-vehicule">
            <div className="garage-carte-vehicule-media">
              <img src={v.photos[0]} alt="" />
              <span className={`garage-pastille ${enLigne(v) ? "is-on" : "is-off"}`}>
                {enLigne(v) ? "En ligne" : aValider(v) ? "À valider" : "Hors ligne"}
              </span>
              {v.photos.length > 1 && (
                <span className="carte-vehicule-nb-photos">{v.photos.length} photos</span>
              )}
            </div>
            <div className="garage-carte-vehicule-corps">
              <h2>
                {v.marque} {v.modele}
              </h2>
              <p className="garage-meta">
                {v.codePublic} · {LIBELLES_CATEGORIE[v.categorie]} · {v.annee} · {v.ville}
              </p>
              {v.agenceNom && <p className="garage-meta garage-meta--interne">Agence · {v.agenceNom}</p>}
              <p className="garage-prix">
                {v.prixUnitaire.toLocaleString("fr-FR")} FCFA / {v.uniteTarif === "HEURE" ? "h" : "jour"}
              </p>
              {v.entrepriseProvenance && (
                <p className="garage-meta garage-meta--interne">
                  Provenance · {v.entrepriseProvenance}
                </p>
              )}
              {v.coutUnitaire != null && (
                <p className="garage-meta garage-meta--interne">
                  Coût {v.coutUnitaire.toLocaleString("fr-FR")} FCFA · marge{" "}
                  {(v.prixUnitaire - v.coutUnitaire).toLocaleString("fr-FR")} FCFA / {v.uniteTarif === "HEURE" ? "h" : "jour"}
                </p>
              )}
              <div className="garage-carte-actions">
                {aValider(v) ? (
                  <button
                    type="button"
                    className="garage-btn garage-btn--principal"
                    disabled={enCours === v.codePublic}
                    onClick={() => void basculerDisponible(v.codePublic, true)}
                  >
                    Valider et publier
                  </button>
                ) : v.disponible ? (
                  <button
                    type="button"
                    className="garage-btn garage-btn--fantome"
                    disabled={enCours === v.codePublic}
                    onClick={() => void basculerDisponible(v.codePublic, false)}
                  >
                    Retirer
                  </button>
                ) : (
                  <button
                    type="button"
                    className="garage-btn garage-btn--principal"
                    disabled={enCours === v.codePublic}
                    onClick={() => void basculerDisponible(v.codePublic, true)}
                  >
                    Mettre en ligne
                  </button>
                )}
                <Link to={`/vehicules/${v.codePublic}`} className="garage-btn garage-btn--fantome">
                  Annonce
                </Link>
                <Link
                  to={`/garage/vehicules/${v.codePublic}/modifier`}
                  className="garage-btn garage-btn--fantome"
                >
                  Modifier
                </Link>
                <button
                  type="button"
                  className="garage-btn garage-btn--danger"
                  disabled={enCours === v.codePublic}
                  onClick={() => void supprimerVehicule(v.codePublic, `${v.marque} ${v.modele}`)}
                >
                  Supprimer
                </button>
              </div>
              {erreurs[v.codePublic] && <p className="message-erreur">{erreurs[v.codePublic]}</p>}
            </div>
          </article>
        ))}
      </div>
    </GarageShell>
  );
}
