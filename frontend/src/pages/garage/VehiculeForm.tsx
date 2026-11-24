import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { GarageShell } from "../../components/GarageShell";
import { useAuth } from "../../context/AuthContext";
import { SUPPLEMENT_CHAUFFEUR_FCFA } from "../../lib/chauffeur";
import { EQUIPEMENTS_DISPONIBLES, LIBELLES_CARBURANT } from "../../lib/equipements";
import { NB_PHOTOS_MAX, uploaderPhotosVehicule, validerFichierPhoto } from "../../lib/photosVehicule";
import { supabase } from "../../lib/supabaseClient";
import type { Carburant, Categorie, Transmission, UniteTarif } from "../../types";

function IconePin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6.5-4.8 6.5-10a6.5 6.5 0 1 0-13 0c0 5.2 6.5 10 6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const VILLES = ["Cotonou", "Abomey-Calavi", "Porto-Novo"];
const CATEGORIES: { valeur: Categorie; libelle: string }[] = [
  { valeur: "CITADINE", libelle: "Citadine" },
  { valeur: "BERLINE", libelle: "Berline" },
  { valeur: "SUV", libelle: "SUV" },
  { valeur: "MINIBUS", libelle: "Minibus" },
  { valeur: "PICKUP", libelle: "Pick-up" },
];

type VehiculeFormGarageProps = {
  mode: "creation" | "edition";
  codePublic?: string;
  /** "agence" : formulaire d'une agence partenaire (pas de champs internes, validation admin requise). */
  espace?: "garage" | "agence";
};

export function VehiculeFormGarage({ mode, codePublic, espace = "garage" }: VehiculeFormGarageProps) {
  const estAgence = espace === "agence";
  const cheminListe = estAgence ? "/agence/vehicules" : "/garage/vehicules";
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const inputPhotoRef = useRef<HTMLInputElement>(null);

  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [transmission, setTransmission] = useState<Transmission>("MANUELLE");
  const [categorie, setCategorie] = useState<Categorie>("CITADINE");
  const [ville, setVille] = useState(VILLES[0]);
  const [zonePriseEnCharge, setZonePriseEnCharge] = useState("");
  const [zoneIncluse, setZoneIncluse] = useState("");
  const [nombrePlaces, setNombrePlaces] = useState<number | "">(5);
  const [nombrePortes, setNombrePortes] = useState<number | "">(4);
  const [carburant, setCarburant] = useState<Carburant>("ESSENCE");
  const [equipements, setEquipements] = useState<string[]>([]);
  const [chauffeurObligatoire, setChauffeurObligatoire] = useState(true);
  const [entrepriseProvenance, setEntrepriseProvenance] = useState("");
  const [coutUnitaire, setCoutUnitaire] = useState<number | "">("");
  const [uniteTarif, setUniteTarif] = useState<UniteTarif>("JOUR");
  const [prixUnitaire, setPrixUnitaire] = useState(25000);
  const [photosExistantes, setPhotosExistantes] = useState<string[]>([]);
  const [fichiersPhotos, setFichiersPhotos] = useState<File[]>([]);
  const [apercuPhotos, setApercuPhotos] = useState<string[]>([]);
  const [chargement, setChargement] = useState(false);
  const [chargementInitial, setChargementInitial] = useState(mode === "edition");
  const [erreur, setErreur] = useState<string | null>(null);
  const [glisseDessus, setGlisseDessus] = useState(false);

  const apercuPhotosRef = useRef<string[]>([]);
  const totalPhotos = photosExistantes.length + apercuPhotos.length;

  useEffect(() => {
    apercuPhotosRef.current = apercuPhotos;
  }, [apercuPhotos]);

  useEffect(() => {
    return () => {
      apercuPhotosRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (mode !== "edition" || !codePublic) return;
    let annule = false;
    setChargementInitial(true);
    supabase
      .from("vehicules")
      .select("*")
      .eq("code_public", codePublic)
      .single()
      .then(({ data, error }) => {
        if (annule) return;
        if (error || !data) {
          setErreur("Impossible de charger ce véhicule.");
          setChargementInitial(false);
          return;
        }
        setMarque(data.marque ?? "");
        setModele(data.modele ?? "");
        setAnnee(data.annee ?? new Date().getFullYear());
        setTransmission(data.transmission ?? "MANUELLE");
        setCategorie(data.categorie ?? "CITADINE");
        setVille(data.ville ?? VILLES[0]);
        setZonePriseEnCharge(data.zone_prise_en_charge ?? "");
        setZoneIncluse(data.zone_incluse ?? "");
        setNombrePlaces(data.nombre_places ?? "");
        setNombrePortes(data.nombre_portes ?? "");
        setCarburant(data.carburant ?? "ESSENCE");
        setEquipements(data.equipements ?? []);
        setChauffeurObligatoire(data.chauffeur_obligatoire ?? true);
        setEntrepriseProvenance(data.entreprise_provenance ?? "");
        setCoutUnitaire(data.cout_unitaire ?? "");
        setUniteTarif(data.unite_tarif ?? "JOUR");
        setPrixUnitaire(data.prix_unitaire ?? 25000);
        setPhotosExistantes(data.photos ?? []);
        setChargementInitial(false);
      });
    return () => {
      annule = true;
    };
  }, [mode, codePublic]);

  function ajouterPhotos(fichiers: FileList | File[] | null | undefined) {
    if (!fichiers) return;
    const liste = Array.from(fichiers);
    if (liste.length === 0) return;

    const espaceRestant = NB_PHOTOS_MAX - totalPhotos;
    if (espaceRestant <= 0) {
      setErreur(`Vous avez déjà atteint le maximum de ${NB_PHOTOS_MAX} photos.`);
      return;
    }

    const retenus = liste.slice(0, espaceRestant);
    let messageErreur: string | null =
      liste.length > retenus.length
        ? `Seules les ${espaceRestant} premières photos ont été ajoutées (maximum ${NB_PHOTOS_MAX}).`
        : null;

    const nouveauxFichiers: File[] = [];
    const nouveauxApercus: string[] = [];
    for (const fichier of retenus) {
      const erreurFichier = validerFichierPhoto(fichier);
      if (erreurFichier) {
        messageErreur = erreurFichier;
        continue;
      }
      nouveauxFichiers.push(fichier);
      nouveauxApercus.push(URL.createObjectURL(fichier));
    }

    setErreur(messageErreur);
    if (nouveauxFichiers.length > 0) {
      setFichiersPhotos((f) => [...f, ...nouveauxFichiers]);
      setApercuPhotos((a) => [...a, ...nouveauxApercus]);
    }
  }

  function retirerPhotoExistante(index: number) {
    setPhotosExistantes((p) => p.filter((_, i) => i !== index));
  }

  function retirerPhoto(index: number) {
    setApercuPhotos((a) => {
      URL.revokeObjectURL(a[index]);
      return a.filter((_, i) => i !== index);
    });
    setFichiersPhotos((f) => f.filter((_, i) => i !== index));
  }

  function basculerEquipement(code: string) {
    setEquipements((liste) =>
      liste.includes(code) ? liste.filter((c) => c !== code) : [...liste, code]
    );
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (!utilisateur) {
      setErreur("Vous devez être connecté.");
      return;
    }
    if (totalPhotos === 0) {
      setErreur("Ajoutez au moins une photo du véhicule.");
      return;
    }
    if (!zonePriseEnCharge.trim() || !zoneIncluse.trim()) {
      setErreur("Renseignez la zone de prise en charge et la zone incluse.");
      return;
    }
    setChargement(true);
    try {
      const urlsNouvelles =
        fichiersPhotos.length > 0 ? await uploaderPhotosVehicule(utilisateur.id, fichiersPhotos) : [];
      const photosFinales = [...photosExistantes, ...urlsNouvelles];

      const champs = {
        marque: marque.trim(),
        modele: modele.trim(),
        annee,
        transmission,
        categorie,
        ville,
        zone_prise_en_charge: zonePriseEnCharge.trim(),
        zone_incluse: zoneIncluse.trim(),
        nombre_places: nombrePlaces === "" ? null : nombrePlaces,
        nombre_portes: nombrePortes === "" ? null : nombrePortes,
        carburant,
        equipements,
        chauffeur_obligatoire: chauffeurObligatoire,
        ...(estAgence
          ? {}
          : {
              entreprise_provenance: entrepriseProvenance.trim() || null,
              cout_unitaire: coutUnitaire === "" ? null : coutUnitaire,
            }),
        unite_tarif: uniteTarif,
        prix_unitaire: prixUnitaire,
        photos: photosFinales,
      };

      if (mode === "edition" && codePublic) {
        const { error } = await supabase.from("vehicules").update(champs).eq("code_public", codePublic);
        if (error) {
          throw new Error("Impossible de modifier ce véhicule. " + error.message);
        }
      } else {
        // Agence : le serveur rattache le véhicule à l'agence et le met en attente de validation.
        const { error } = await supabase
          .from("vehicules")
          .insert(estAgence ? { ...champs, disponible: true } : { ...champs, controle_technique_ok: true, disponible: true });
        if (error) {
          throw new Error("Impossible d'enregistrer ce véhicule. " + error.message);
        }
      }
      navigate(cheminListe);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  if (chargementInitial) {
    return (
      <GarageShell
        titre="Modifier le véhicule"
        retour={{ to: cheminListe, libelle: estAgence ? "Mes véhicules" : "Parc" }}
      >
        <p className="garage-etat">Chargement du véhicule…</p>
      </GarageShell>
    );
  }

  return (
    <GarageShell
      titre={mode === "edition" ? "Modifier le véhicule" : estAgence ? "Ajouter un véhicule" : "Publier un véhicule"}
      sousTitre={
        estAgence
          ? "Le véhicule apparaîtra au catalogue une fois validé par l'administration Carentrix."
          : "Tarif tout compris — véhicule livré avec chauffeur."
      }
      retour={{ to: cheminListe, libelle: estAgence ? "Mes véhicules" : "Parc" }}
    >
      <form className="depot-layout" onSubmit={soumettre}>
        <div className="depot-col-champs">
          <section className="depot-section">
            <p className="depot-col-titre">1 · Photos</p>
            <div
              className={`depot-upload${glisseDessus ? " est-survolee" : ""}${totalPhotos ? " a-apercu" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setGlisseDessus(true);
              }}
              onDragLeave={() => setGlisseDessus(false)}
              onDrop={(e) => {
                e.preventDefault();
                setGlisseDessus(false);
                ajouterPhotos(e.dataTransfer.files);
              }}
            >
              {totalPhotos > 0 ? (
                <div className="depot-photos-grille">
                  {photosExistantes.map((url, i) => (
                    <div key={`existante-${url}`} className="depot-photo-vignette">
                      <img src={url} alt="" />
                      {i === 0 && <span className="depot-photo-couverture">Couverture</span>}
                      <button
                        type="button"
                        className="depot-photo-retirer"
                        onClick={() => retirerPhotoExistante(i)}
                        aria-label="Retirer cette photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {apercuPhotos.map((url, i) => (
                    <div key={`nouvelle-${url}`} className="depot-photo-vignette">
                      <img src={url} alt="" />
                      {photosExistantes.length === 0 && i === 0 && (
                        <span className="depot-photo-couverture">Couverture</span>
                      )}
                      <button
                        type="button"
                        className="depot-photo-retirer"
                        onClick={() => retirerPhoto(i)}
                        aria-label="Retirer cette photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {totalPhotos < NB_PHOTOS_MAX && (
                    <label className="depot-photo-ajouter">
                      <span aria-hidden="true">＋</span>
                      Ajouter
                      <input
                        ref={inputPhotoRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        hidden
                        onChange={(e) => {
                          ajouterPhotos(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <label className="depot-placeholder">
                  <span className="espace-upload-icone" aria-hidden="true">
                    ＋
                  </span>
                  <span className="espace-upload-titre">Ajouter des photos</span>
                  <span className="espace-upload-aide">
                    Glisser-déposer ou parcourir · JPG, PNG, WebP · 5 Mo max · {NB_PHOTOS_MAX} photos maximum
                  </span>
                  <input
                    ref={inputPhotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    hidden
                    onChange={(e) => {
                      ajouterPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </section>

          <section className="depot-section">
            <p className="depot-col-titre">2 · Identité</p>
            <div className="depot-champs">
              <label className="depot-champ depot-champ--large">
                Marque
                <input
                  value={marque}
                  onChange={(e) => setMarque(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Toyota"
                  autoComplete="off"
                />
              </label>
              <label className="depot-champ depot-champ--large">
                Modèle
                <input
                  value={modele}
                  onChange={(e) => setModele(e.target.value)}
                  required
                  minLength={1}
                  placeholder="Corolla"
                  autoComplete="off"
                />
              </label>
              <label className="depot-champ">
                Année
                <input
                  type="number"
                  value={annee}
                  onChange={(e) => setAnnee(Number(e.target.value))}
                  required
                  min={1990}
                  max={new Date().getFullYear() + 1}
                />
              </label>
              <label className="depot-champ">
                Transmission
                <select
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value as Transmission)}
                >
                  <option value="MANUELLE">Manuelle</option>
                  <option value="AUTOMATIQUE">Automatique</option>
                </select>
              </label>
              <label className="depot-champ">
                Catégorie
                <select value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.valeur} value={c.valeur}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="depot-champ">
                Ville
                <select value={ville} onChange={(e) => setVille(e.target.value)}>
                  {VILLES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="depot-champ">
                Nombre de places
                <input
                  type="number"
                  value={nombrePlaces}
                  onChange={(e) => setNombrePlaces(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  min={1}
                />
              </label>
              <label className="depot-champ">
                Nombre de portes
                <input
                  type="number"
                  value={nombrePortes}
                  onChange={(e) => setNombrePortes(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                  min={1}
                />
              </label>
              <label className="depot-champ">
                Carburant
                <select value={carburant} onChange={(e) => setCarburant(e.target.value as Carburant)}>
                  {(Object.keys(LIBELLES_CARBURANT) as Carburant[]).map((c) => (
                    <option key={c} value={c}>
                      {LIBELLES_CARBURANT[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="depot-section">
            <p className="depot-col-titre">3 · Zone & équipements</p>
            <div className="depot-champs">
              <label className="depot-champ depot-champ--large">
                Zone de prise en charge
                <textarea
                  value={zonePriseEnCharge}
                  onChange={(e) => setZonePriseEnCharge(e.target.value)}
                  required
                  rows={2}
                  placeholder="Ex. Cotonou, quartier Fidjrossè"
                />
              </label>
              <label className="depot-champ depot-champ--large">
                Zone incluse dans le tarif
                <textarea
                  value={zoneIncluse}
                  onChange={(e) => setZoneIncluse(e.target.value)}
                  required
                  rows={2}
                  placeholder="Ex. Cotonou et Abomey-Calavi, rayon 15 km"
                />
              </label>
            </div>

            <p className="depot-col-titre" style={{ marginTop: "1.25rem" }}>
              Équipements
            </p>
            <div className="depot-equipements" role="group" aria-label="Équipements du véhicule">
              {EQUIPEMENTS_DISPONIBLES.map((eq) => (
                <label key={eq.code} className="depot-equipement">
                  <input
                    type="checkbox"
                    checked={equipements.includes(eq.code)}
                    onChange={() => basculerEquipement(eq.code)}
                  />
                  {eq.libelle}
                </label>
              ))}
            </div>

            <p className="depot-col-titre" style={{ marginTop: "1.25rem" }}>
              Chauffeur
            </p>
            <div className="depot-tarif-unites" role="group" aria-label="Chauffeur obligatoire ou facultatif">
              <button
                type="button"
                className={chauffeurObligatoire ? "est-actif" : ""}
                onClick={() => setChauffeurObligatoire(true)}
              >
                Obligatoire
              </button>
              <button
                type="button"
                className={!chauffeurObligatoire ? "est-actif" : ""}
                onClick={() => setChauffeurObligatoire(false)}
              >
                Facultatif
              </button>
            </div>
            {!chauffeurObligatoire && (
              <p className="texte-secondaire" style={{ marginTop: "0.75rem" }}>
                Le client pourra choisir d'ajouter un chauffeur à la réservation moyennant un supplément
                de {SUPPLEMENT_CHAUFFEUR_FCFA.toLocaleString("fr-FR")} FCFA par jour (ou par heure sur un
                véhicule tarifé à l'heure), payé avec le reste.
              </p>
            )}
          </section>

          {!estAgence && (
          <section className="depot-section">
            <p className="depot-col-titre">
              4 · Interne <span className="depot-badge-interne">Visible garage uniquement</span>
            </p>
            <div className="depot-champs">
              <label className="depot-champ depot-champ--large">
                Entreprise de provenance
                <input
                  value={entrepriseProvenance}
                  onChange={(e) => setEntrepriseProvenance(e.target.value)}
                  placeholder="Ex. Loueur Cotonou Auto"
                  autoComplete="off"
                />
              </label>
              <label className="depot-champ">
                Coût fournisseur (FCFA / {uniteTarif === "HEURE" ? "h" : "jour"})
                <input
                  type="number"
                  value={coutUnitaire}
                  onChange={(e) => setCoutUnitaire(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Ex. 18000"
                  min={0}
                />
              </label>
            </div>
            <p className="texte-secondaire" style={{ marginTop: "0.5rem" }}>
              Jamais affiché aux clients — réservé au suivi interne du garage. Le coût fournisseur sert à calculer
              votre bénéfice réel sur chaque location de ce véhicule.
            </p>
          </section>
          )}

          <section className="depot-section">
            <p className="depot-col-titre">
              {estAgence ? 4 : 5} · Tarif {chauffeurObligatoire ? "(chauffeur inclus)" : "(véhicule seul)"}
            </p>
            <div className="depot-tarif">
              <div className="depot-tarif-unites" role="group" aria-label="Unité de tarification">
                <button
                  type="button"
                  className={uniteTarif === "JOUR" ? "est-actif" : ""}
                  onClick={() => setUniteTarif("JOUR")}
                >
                  Par jour
                </button>
                <button
                  type="button"
                  className={uniteTarif === "HEURE" ? "est-actif" : ""}
                  onClick={() => setUniteTarif("HEURE")}
                >
                  Par heure
                </button>
              </div>
              <label className="depot-champ depot-champ--prix">
                Montant (FCFA)
                <input
                  type="number"
                  value={prixUnitaire}
                  onChange={(e) => setPrixUnitaire(Number(e.target.value))}
                  required
                  min={uniteTarif === "HEURE" ? 500 : 1000}
                  step={uniteTarif === "HEURE" ? 100 : 500}
                />
              </label>
            </div>
            <p className="texte-secondaire" style={{ marginTop: "0.75rem" }}>
              {chauffeurObligatoire
                ? "Le tarif affiché inclut le véhicule livré avec chauffeur."
                : "Le tarif affiché correspond au véhicule seul. Le chauffeur est en option (supplément défini ci-dessus)."}
            </p>
          </section>

          {erreur && <p className="message-erreur">{erreur}</p>}

          <button type="submit" className="garage-btn garage-btn--principal depot-submit" disabled={chargement}>
            {chargement
              ? mode === "edition"
                ? "Enregistrement…"
                : "Publication…"
              : mode === "edition"
                ? "Enregistrer les modifications"
                : estAgence
                  ? "Soumettre à validation"
                  : "Publier ce véhicule"}
          </button>
        </div>

        <aside className="depot-col-apercu">
          <p className="depot-col-titre">Aperçu de l’annonce</p>
          <div className="carte-vehicule depot-apercu-carte" aria-hidden="true">
            <div className="carte-vehicule-media">
              {(photosExistantes[0] ?? apercuPhotos[0]) ? (
                <img src={photosExistantes[0] ?? apercuPhotos[0]} alt="" />
              ) : (
                <div className="carte-vehicule-fallback">
                  <span>
                    {marque || "Marque"} {modele || "Modèle"}
                  </span>
                </div>
              )}
              <span className="carte-vehicule-chip">
                {CATEGORIES.find((c) => c.valeur === categorie)?.libelle}
              </span>
            </div>
            <div className="carte-vehicule-corps">
              <div className="carte-vehicule-haut">
                <h3>
                  {marque || "Marque"} {modele || "Modèle"}
                </h3>
                <p className="carte-vehicule-meta">
                  {transmission === "AUTOMATIQUE" ? "Automatique" : "Manuelle"} · {annee}
                </p>
                <p className="carte-vehicule-ville">
                  <IconePin />
                  <span>{ville}</span>
                </p>
              </div>
              <div className="carte-vehicule-pied">
                <p className="carte-vehicule-prix">{prixUnitaire.toLocaleString("fr-FR")} FCFA</p>
                <span className="carte-vehicule-unite">/ {uniteTarif === "HEURE" ? "heure" : "jour"}</span>
              </div>
            </div>
          </div>
          <p className="texte-secondaire depot-apercu-note">
            Ce que verront les locataires dans le catalogue — l’entreprise de provenance n’y apparaît jamais.
          </p>
        </aside>
      </form>
    </GarageShell>
  );
}
