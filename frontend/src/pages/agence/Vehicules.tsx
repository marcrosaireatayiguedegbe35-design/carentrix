import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import { VehiculeFormGarage } from "../garage/VehiculeForm";

type VehiculeAgence = {
  codePublic: string;
  marque: string;
  modele: string;
  annee: number;
  ville: string;
  prixUnitaire: number;
  uniteTarif: "HEURE" | "JOUR";
  photos: string[];
  disponible: boolean;
  valide: boolean;
};

export function VehiculesAgence() {
  const [vehicules, setVehicules] = useState<VehiculeAgence[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  async function charger() {
    setChargement(true);
    const { data } = await supabase
      .from("vehicules")
      .select("code_public, marque, modele, annee, ville, prix_unitaire, unite_tarif, photos, disponible, controle_technique_ok")
      .order("created_at", { ascending: false });
    setVehicules(
      (data ?? []).map((v: Record<string, unknown>) => ({
        codePublic: v.code_public as string,
        marque: v.marque as string,
        modele: v.modele as string,
        annee: v.annee as number,
        ville: v.ville as string,
        prixUnitaire: v.prix_unitaire as number,
        uniteTarif: v.unite_tarif as "HEURE" | "JOUR",
        photos: (v.photos as string[] | null) ?? [],
        disponible: v.disponible as boolean,
        valide: v.controle_technique_ok as boolean,
      }))
    );
    setChargement(false);
  }

  useEffect(() => {
    void charger();
  }, []);

  async function basculer(codePublic: string, disponible: boolean) {
    setEnCours(codePublic);
    setErreurs((e) => ({ ...e, [codePublic]: "" }));
    const { error } = await supabase.from("vehicules").update({ disponible }).eq("code_public", codePublic);
    setEnCours(null);
    if (error) setErreurs((e) => ({ ...e, [codePublic]: error.message }));
    void charger();
  }

  function statut(v: VehiculeAgence) {
    if (!v.disponible) return { libelle: "Archivé", on: false };
    if (!v.valide) return { libelle: "En attente de validation", on: false };
    return { libelle: "En ligne", on: true };
  }

  return (
    <GarageShell
      titre="Mes véhicules"
      sousTitre="Chaque nouveau véhicule est vérifié par Carentrix avant d'apparaître au catalogue."
      actions={
        <Link to="/agence/vehicules/nouveau" className="garage-btn garage-btn--principal">
          Ajouter
        </Link>
      }
    >
      {chargement && <p className="garage-etat">Chargement…</p>}
      {!chargement && vehicules.length === 0 && (
        <div className="garage-vide">
          <p>Vous n'avez encore aucun véhicule.</p>
          <Link to="/agence/vehicules/nouveau" className="garage-btn garage-btn--principal">
            Ajouter un véhicule
          </Link>
        </div>
      )}

      <div className="garage-grille-vehicules">
        {vehicules.map((v) => {
          const s = statut(v);
          return (
            <article key={v.codePublic} className="garage-carte-vehicule">
              <div className="garage-carte-vehicule-media">
                {v.photos[0] && <img src={v.photos[0]} alt="" />}
                <span className={`garage-pastille ${s.on ? "is-on" : "is-off"}`}>{s.libelle}</span>
              </div>
              <div className="garage-carte-vehicule-corps">
                <h2>
                  {v.marque} {v.modele}
                </h2>
                <p className="garage-meta">
                  {v.codePublic} · {v.annee} · {v.ville}
                </p>
                <p className="garage-prix">
                  {v.prixUnitaire.toLocaleString("fr-FR")} FCFA / {v.uniteTarif === "HEURE" ? "h" : "jour"}
                </p>
                <div className="garage-carte-actions">
                  {v.disponible ? (
                    <button
                      type="button"
                      className="garage-btn garage-btn--fantome"
                      disabled={enCours === v.codePublic}
                      onClick={() => void basculer(v.codePublic, false)}
                    >
                      {v.valide ? "Rendre indisponible" : "Archiver"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="garage-btn garage-btn--principal"
                      disabled={enCours === v.codePublic}
                      onClick={() => void basculer(v.codePublic, true)}
                    >
                      Rendre disponible
                    </button>
                  )}
                  {s.on && (
                    <Link to={`/vehicules/${v.codePublic}`} className="garage-btn garage-btn--fantome">
                      Annonce
                    </Link>
                  )}
                  <Link to={`/agence/vehicules/${v.codePublic}/modifier`} className="garage-btn garage-btn--fantome">
                    Modifier
                  </Link>
                </div>
                {erreurs[v.codePublic] && <p className="message-erreur">{erreurs[v.codePublic]}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </GarageShell>
  );
}

export function NouveauVehiculeAgence() {
  return <VehiculeFormGarage mode="creation" espace="agence" />;
}

export function ModifierVehiculeAgence() {
  const { code } = useParams<{ code: string }>();
  if (!code) return null;
  return <VehiculeFormGarage mode="edition" codePublic={code} espace="agence" />;
}
