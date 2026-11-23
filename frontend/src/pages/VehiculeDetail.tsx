import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CommentairesVehicule } from "../components/CommentairesVehicule";
import { Etoiles } from "../components/Etoiles";
import { ReactionsVehicule } from "../components/ReactionsVehicule";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { kycBloqueActivite, locataireStatutASignaler, messageBlocageKyc } from "../lib/kyc";
import { SUPPLEMENT_CHAUFFEUR_FCFA } from "../lib/chauffeur";
import { EQUIPEMENTS_DISPONIBLES, LIBELLES_CARBURANT } from "../lib/equipements";
import { useEstMobile } from "../lib/estMobile";
import type { AvisPublic, Vehicule } from "../types";

const LIBELLES_EQUIPEMENT: Record<string, string> = Object.fromEntries(
  EQUIPEMENTS_DISPONIBLES.map((eq) => [eq.code, eq.libelle])
);

const LIBELLES_CATEGORIE: Record<string, string> = {
  CITADINE: "Citadine",
  BERLINE: "Berline",
  SUV: "SUV",
  MINIBUS: "Minibus",
  PICKUP: "Pick-up",
};

function IconeRetour() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconePin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6.5-4.8 6.5-10a6.5 6.5 0 1 0-13 0c0 5.2 6.5 10 6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconeCalendrierReservation() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9 14h2M13 14h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconeFlecheReservation() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeGrille({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconeSieges({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7.3" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19c1.3-3.2 3.6-4.8 6.5-4.8s5.2 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeTransmission({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.6v2.5M12 17.9v2.5M20.4 12h-2.5M6.1 12H3.6M17.6 6.4l-1.8 1.8M8.2 15.8l-1.8 1.8M17.6 17.6l-1.8-1.8M8.2 8.2 6.4 6.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconeCarburant({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5h5A1.5 1.5 0 0 1 13 6.5V20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M4 20h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M13 9.3h1.7l2.3 2.3V17a1.3 1.3 0 0 0 2.6 0v-4.35c0-.5-.2-.98-.55-1.34L17 9.15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 8h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconePorte({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="3.5" width="12" height="17" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="14.3" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function IconePartage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function IconeCheckCercle({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.3 12.3l2.5 2.5 5-5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VehiculeDetail() {
  const { code } = useParams<{ code: string }>();
  const { utilisateur } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = useEstMobile();

  const [indexPhoto, setIndexPhoto] = useState(0);
  const [lienCopie, setLienCopie] = useState(false);
  const galerieRef = useRef<HTMLDivElement | null>(null);
  const indexPhotoRef = useRef(0);
  const defilementAuto = useRef(true);
  const [vehicule, setVehicule] = useState<Vehicule | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [photoActive, setPhotoActive] = useState(0);
  const [photosEnErreur, setPhotosEnErreur] = useState<Set<number>>(new Set());
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [erreurReservation, setErreurReservation] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [avis, setAvis] = useState<AvisPublic[]>([]);
  const [avecChauffeur, setAvecChauffeur] = useState(false);
  const [bandeVisible, setBandeVisible] = useState(false);
  const boutonReserverRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!code) return;
    supabase
      .from("vehicules_publics")
      .select("*")
      .eq("code_public", code)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setErreur("Ce véhicule est introuvable.");
          return;
        }
        setVehicule({
          codePublic: data.code_public,
          marque: data.marque,
          modele: data.modele,
          annee: data.annee,
          transmission: data.transmission,
          categorie: data.categorie,
          ville: data.ville,
          prixUnitaire: data.prix_unitaire,
          uniteTarif: data.unite_tarif,
          photos: data.photos ?? [],
          disponible: data.disponible,
          noteMoyenne: Number(data.note_moyenne) || 0,
          nbAvis: Number(data.nb_avis) || 0,
          zonePriseEnCharge: data.zone_prise_en_charge ?? null,
          zoneIncluse: data.zone_incluse ?? null,
          nombrePlaces: data.nombre_places ?? null,
          nombrePortes: data.nombre_portes ?? null,
          carburant: data.carburant ?? null,
          equipements: data.equipements ?? [],
          chauffeurObligatoire: data.chauffeur_obligatoire ?? true,
        });
        setPhotoActive(0);
        setPhotosEnErreur(new Set());
        setAvecChauffeur(false);
      });

    supabase
      .from("avis_publics")
      .select("*")
      .eq("vehicule_code", code)
      .then(({ data }) => {
        setAvis(
          (data ?? []).map((a: Record<string, unknown>) => ({
            id: a.id as string,
            vehiculeCode: a.vehicule_code as string,
            note: a.note as number,
            commentaire: a.commentaire as string | null,
            createdAt: a.created_at as string,
            auteurPseudo: a.auteur_pseudo as string,
          }))
        );
      });
  }, [code]);

  useEffect(() => {
    const bouton = boutonReserverRef.current;
    if (!bouton) {
      setBandeVisible(false);
      return;
    }
    // La bande suit le défilement : visible dès que le vrai bouton "Réserver"
    // sort de l'écran (avant ou après), masquée quand il redevient visible.
    const observateur = new IntersectionObserver(
      ([entree]) => setBandeVisible(!entree.isIntersecting),
      { rootMargin: "0px 0px -10% 0px" }
    );
    observateur.observe(bouton);
    return () => observateur.disconnect();
  }, [vehicule]);


  function allerALaPhoto(i: number) {
    const el = galerieRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  // Défilement automatique des photos sur mobile, arrêté dès que l'utilisateur touche la galerie.
  const nbPhotos = vehicule?.photos.length ?? 0;
  useEffect(() => {
    if (!mobile || nbPhotos < 2) return;
    defilementAuto.current = true;
    const minuteur = window.setInterval(() => {
      if (!defilementAuto.current) return;
      const suivante = (indexPhotoRef.current + 1) % nbPhotos;
      const el = galerieRef.current;
      if (el) el.scrollTo({ left: suivante * el.clientWidth, behavior: "smooth" });
    }, 4000);
    return () => window.clearInterval(minuteur);
  }, [mobile, nbPhotos]);

  const auHeure = vehicule?.uniteTarif === "HEURE";
  const libelleUnite = auHeure ? "heure" : "jour";
  const libelleUnites = auHeure ? "heure" : "nuit";

  const unites =
    dateDebut && dateFin
      ? Math.max(
          0,
          Math.ceil(
            (new Date(dateFin).getTime() - new Date(dateDebut).getTime()) /
              (1000 * 60 * 60 * (auHeure ? 1 : 24))
          )
        )
      : 0;
  const montantVehicule = vehicule && unites > 0 ? unites * vehicule.prixUnitaire : 0;
  const chauffeurChoisi = !vehicule?.chauffeurObligatoire && avecChauffeur;
  const montantChauffeur = chauffeurChoisi && unites > 0 ? SUPPLEMENT_CHAUFFEUR_FCFA * unites : 0;

  const montantEstime = montantVehicule + montantChauffeur;

  async function reserver(e: FormEvent) {
    e.preventDefault();
    setErreurReservation(null);

    if (!utilisateur) {
      navigate("/connexion", { state: { retourApres: `${location.pathname}${location.search}` } });
      return;
    }
    if (kycBloqueActivite(utilisateur)) {
      navigate("/mon-dossier", { state: { depuisBlocage: true } });
      return;
    }
    if (!dateDebut || !dateFin) {
      setErreurReservation("Veuillez choisir une date de début et de fin.");
      return;
    }
    setChargement(true);
    const { data, error } = await supabase
      .rpc("creer_reservation", {
        p_code_vehicule: code,
        p_date_debut: new Date(dateDebut).toISOString(),
        p_date_fin: new Date(dateFin).toISOString(),
        p_avec_chauffeur: chauffeurChoisi,
      })
      .single();
    setChargement(false);

    if (error || !data) {
      setErreurReservation(error?.message || "Impossible de créer la réservation.");
      return;
    }
    navigate(`/paiement/${(data as { code_public: string }).code_public}`);
  }

  async function partager() {
    const url = window.location.href;
    const titre = vehicule ? `${vehicule.marque} ${vehicule.modele}` : "Carentrix";
    try {
      if (navigator.share) {
        await navigator.share({ title: titre, url });
      } else {
        await navigator.clipboard.writeText(url);
        setLienCopie(true);
        window.setTimeout(() => setLienCopie(false), 2000);
      }
    } catch {
      // Partage annulé par l'utilisateur : rien à faire.
    }
  }

  const reservationBloquee = kycBloqueActivite(utilisateur);
  const rappelPieces = locataireStatutASignaler(utilisateur);

  if (erreur) {
    return (
      <div className="page-detail">
        <Link to="/vehicules" className="detail-retour">
          <IconeRetour />
          Retour au catalogue
        </Link>
        <div className="etat-page etat-page-erreur">
          <p>{erreur}</p>
          <Link to="/vehicules" className="landing-bouton landing-bouton-principal">
            Voir le catalogue
          </Link>
        </div>
      </div>
    );
  }

  if (!vehicule) {
    return (
      <div className="page-detail">
        <div className="etat-page" role="status">
          <div className="etat-page-pulse" aria-hidden="true" />
          <p>Chargement du véhicule...</p>
        </div>
      </div>
    );
  }

  const imageKoActive = !vehicule.photos[photoActive] || photosEnErreur.has(photoActive);

  const tuiles: { cle: string; icone: ReactNode; valeur: string; libelle: string }[] = [
    { cle: "annee", icone: <IconeCalendrierReservation />, valeur: String(vehicule.annee), libelle: "Année" },
    {
      cle: "transmission",
      icone: <IconeTransmission />,
      valeur: vehicule.transmission === "AUTOMATIQUE" ? "Automatique" : "Manuelle",
      libelle: "Transmission",
    },
  ];
  if (vehicule.carburant) {
    tuiles.push({ cle: "carburant", icone: <IconeCarburant />, valeur: LIBELLES_CARBURANT[vehicule.carburant], libelle: "Carburant" });
  }
  if (vehicule.nombrePlaces) {
    tuiles.push({ cle: "places", icone: <IconeSieges />, valeur: String(vehicule.nombrePlaces), libelle: "Places" });
  }
  if (vehicule.nombrePortes) {
    tuiles.push({ cle: "portes", icone: <IconePorte />, valeur: String(vehicule.nombrePortes), libelle: "Portes" });
  }
  tuiles.push({ cle: "categorie", icone: <IconeGrille />, valeur: LIBELLES_CATEGORIE[vehicule.categorie], libelle: "Catégorie" });

  const nbPhotosFiche = vehicule.photos.length;
  const photoPrecedente = () => setPhotoActive((i) => (i - 1 + nbPhotosFiche) % nbPhotosFiche);
  const photoSuivante = () => setPhotoActive((i) => (i + 1) % nbPhotosFiche);

  const asideReservation = (
        <aside className="detail-reservation">
          <div className="detail-reservation-prix">
            <span className="detail-prix">
              {vehicule.prixUnitaire.toLocaleString("fr-FR")} FCFA
            </span>
            <span className="detail-prix-unite">/ {libelleUnite}</span>
          </div>

          {reservationBloquee ? (
            <div className="kyc-alerte kyc-alerte--detail">
              <p>{messageBlocageKyc(utilisateur!.statutKyc, utilisateur!.role)}</p>
              <Link
                to="/mon-dossier"
                state={{ depuisBlocage: true }}
                className="landing-bouton landing-bouton-principal"
              >
                Compléter mon dossier
              </Link>
            </div>
          ) : (
            <form className="formulaire-reservation" onSubmit={reserver}>
              {rappelPieces && (
                <p className="detail-rappel-pieces" role="note">
                  {messageBlocageKyc(utilisateur!.statutKyc, utilisateur!.role)}
                </p>
              )}
              <div className="formulaire-dates">
                <label>
                  Du
                  <input
                    type={auHeure ? "datetime-local" : "date"}
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Au
                  <input
                    type={auHeure ? "datetime-local" : "date"}
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    required
                  />
                </label>
              </div>

              {vehicule.chauffeurObligatoire ? (
                <p className="detail-chauffeur-inclus" role="note">
                  Livré avec chauffeur Carentrix — inclus dans le tarif.
                </p>
              ) : (
                <label className="detail-chauffeur-choix" role="note">
                  <input
                    type="checkbox"
                    checked={avecChauffeur}
                    onChange={(e) => setAvecChauffeur(e.target.checked)}
                  />
                  Je souhaite un chauffeur (+{SUPPLEMENT_CHAUFFEUR_FCFA.toLocaleString("fr-FR")} FCFA /{" "}
                  {libelleUnite})
                </label>
              )}

              {unites > 0 && (
                <div className="detail-recap">
                  <div>
                    <span>
                      Véhicule · {unites} {libelleUnites}
                      {unites > 1 ? "s" : ""}
                    </span>
                    <strong>{montantVehicule.toLocaleString("fr-FR")} FCFA</strong>
                  </div>
                  {chauffeurChoisi && (
                    <div>
                      <span>
                        Chauffeur · {unites} {libelleUnites}
                        {unites > 1 ? "s" : ""}
                      </span>
                      <strong>{montantChauffeur.toLocaleString("fr-FR")} FCFA</strong>
                    </div>
                  )}
                  <div className="detail-recap-total">
                    <span>Total estimé</span>
                    <strong>{montantEstime.toLocaleString("fr-FR")} FCFA</strong>
                  </div>
                  <p className="texte-secondaire">Caution calculée à la réservation</p>
                </div>
              )}

              {erreurReservation && <p className="message-erreur">{erreurReservation}</p>}

              <button
                ref={boutonReserverRef}
                type="submit"
                disabled={chargement || vehicule.disponible === false}
              >
                {chargement
                  ? "Réservation en cours..."
                  : vehicule.disponible === false
                    ? "Véhicule indisponible"
                    : "Réserver ce véhicule"}
              </button>

              {!utilisateur && (
                <p className="texte-secondaire detail-connexion-hint">
                  Connexion requise pour finaliser la réservation.
                </p>
              )}

              {rappelPieces && (
                <Link to="/mon-dossier" className="detail-lien-dossier">
                  Déposer mes pièces
                </Link>
              )}
            </form>
          )}
        </aside>
  );

  return (
    <div className={`page-detail${mobile ? " page-detail--mobile" : ""}`}>
      {mobile && (
        <>
          <div className="dm-hero">
            <div
              ref={galerieRef}
              className="dm-galerie"
              onPointerDown={() => {
                defilementAuto.current = false;
              }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
                indexPhotoRef.current = i;
                setIndexPhoto(i);
              }}
            >
              {vehicule.photos.length > 0 ? (
                vehicule.photos.map((url, i) => (
                  <img
                    key={url + i}
                    src={url}
                    alt={`${vehicule.marque} ${vehicule.modele} — photo ${i + 1}`}
                    className="dm-photo"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                ))
              ) : (
                <div className="dm-photo dm-photo-vide">
                  {vehicule.marque} {vehicule.modele}
                </div>
              )}
            </div>
            <Link to="/vehicules" className="dm-bouton dm-retour" aria-label="Retour au catalogue">
              <IconeRetour />
            </Link>
            <button type="button" className="dm-bouton dm-partager" aria-label="Partager" onClick={() => void partager()}>
              <IconePartage />
            </button>
            {lienCopie && <span className="dm-copie">Lien copié</span>}
            {vehicule.photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="dm-fleche dm-fleche-gauche"
                  aria-label="Photo précédente"
                  onClick={() => {
                    defilementAuto.current = false;
                    allerALaPhoto((indexPhoto - 1 + vehicule.photos.length) % vehicule.photos.length);
                  }}
                >
                  <IconeRetour />
                </button>
                <button
                  type="button"
                  className="dm-fleche dm-fleche-droite"
                  aria-label="Photo suivante"
                  onClick={() => {
                    defilementAuto.current = false;
                    allerALaPhoto((indexPhoto + 1) % vehicule.photos.length);
                  }}
                >
                  <IconeRetour />
                </button>
                <span className="dm-compteur">
                  {Math.min(indexPhoto + 1, vehicule.photos.length)} / {vehicule.photos.length}
                </span>
              </>
            )}
          </div>

          <div className="dm-feuille">
            <div className="dm-titre-ligne">
              <div>
                <h1>
                  {vehicule.marque} {vehicule.modele}
                </h1>
                <p className="dm-sous">
                  {vehicule.annee} · {vehicule.ville}
                </p>
              </div>
              <p className="dm-prix">
                {vehicule.prixUnitaire.toLocaleString("fr-FR")} FCFA
                <small>/ {libelleUnite}</small>
              </p>
            </div>
            {!!vehicule.nbAvis && (
              <p className="detail-note">
                <Etoiles note={vehicule.noteMoyenne ?? 0} />
                <span>
                  {vehicule.noteMoyenne} · {vehicule.nbAvis} avis
                </span>
              </p>
            )}
            {vehicule.disponible === false && <p className="dm-indispo">Ce véhicule est indisponible.</p>}
            <ReactionsVehicule code={vehicule.codePublic} />
            <div className="dm-tuiles">
              {tuiles.map((t) => (
                <div key={t.cle} className="dm-tuile">
                  <span className="dm-tuile-icone">{t.icone}</span>
                  <strong>{t.valeur}</strong>
                  <span>{t.libelle}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!mobile && (
        <>
          <nav className="dd-fil" aria-label="Fil d'Ariane">
            <Link to="/vehicules">Catalogue</Link>
            <span aria-hidden="true">›</span>
            <span>
              {vehicule.marque} {vehicule.modele}
            </span>
          </nav>

          <div className="dd-haut">
            <div className="dd-gauche">
              <div className="detail-media">
                {!imageKoActive ? (
                  <img
                    src={vehicule.photos[photoActive]}
                    alt={`${vehicule.marque} ${vehicule.modele}`}
                    onError={() => setPhotosEnErreur((s) => new Set(s).add(photoActive))}
                  />
                ) : (
                  <div className="detail-media-fallback" aria-hidden="true">
                    <span>
                      {vehicule.marque} {vehicule.modele}
                    </span>
                  </div>
                )}
                <span className="detail-chip">{LIBELLES_CATEGORIE[vehicule.categorie]}</span>
                {vehicule.disponible === false && <span className="detail-badge-dispo">Indisponible</span>}
                {vehicule.photos.length > 1 && (
                  <>
                    <button type="button" className="dd-fleche dd-fleche--gauche" aria-label="Photo précédente" onClick={photoPrecedente}>
                      <IconeRetour />
                    </button>
                    <button type="button" className="dd-fleche dd-fleche--droite" aria-label="Photo suivante" onClick={photoSuivante}>
                      <IconeRetour />
                    </button>
                    <span className="dd-compteur">
                      {photoActive + 1} / {vehicule.photos.length}
                    </span>
                  </>
                )}
              </div>
      {vehicule.photos.length > 1 && (
        <div className="detail-media-miniatures" role="tablist" aria-label="Photos du véhicule">
          {vehicule.photos.map((url, i) => (
            <button
              key={url + i}
              type="button"
              role="tab"
              aria-selected={i === photoActive}
              className={`detail-media-miniature${i === photoActive ? " est-active" : ""}`}
              onClick={() => setPhotoActive(i)}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}
            </div>

            <div className="dd-droite">
        <div className="detail-entete">
          <p className="detail-eyebrow">{vehicule.codePublic}</p>
          <h1>
            {vehicule.marque} {vehicule.modele} <span className="detail-annee">({vehicule.annee})</span>
          </h1>
          <p className="detail-ville">
            <IconePin />
            {vehicule.ville}
          </p>

          {!!vehicule.nbAvis && (
            <p className="detail-note">
              <Etoiles note={vehicule.noteMoyenne ?? 0} />
              <span>
                {vehicule.noteMoyenne} · {vehicule.nbAvis} avis
              </span>
            </p>
          )}
          <ReactionsVehicule code={vehicule.codePublic} />
        </div>
              {asideReservation}
            </div>
          </div>

          <nav className="dd-ancres" aria-label="Sections de la fiche">
            <a href="#caracteristiques">Caractéristiques</a>
            {vehicule.equipements.length > 0 && <a href="#equipements">Équipements</a>}
            <a href="#avis">Avis</a>
            <a href="#commentaires">Commentaires</a>
          </nav>
        </>
      )}

      <div className="detail-grille">

        <section className="detail-infos">
          {!mobile && (
          <div className="detail-carte-essentielles" id="caracteristiques">
            <p className="detail-section-titre">
              <IconeGrille />
              Caractéristiques essentielles
            </p>
            <div className="detail-essentielles-grille">
              {!!vehicule.nombrePlaces && (
                <div className="detail-essentiel-item">
                  <span className="detail-essentiel-icone">
                    <IconeSieges />
                  </span>
                  <strong>{vehicule.nombrePlaces}</strong>
                  <span>Places</span>
                </div>
              )}
              <div className="detail-essentiel-item">
                <span className="detail-essentiel-icone">
                  <IconeTransmission />
                </span>
                <strong>{vehicule.transmission === "AUTOMATIQUE" ? "Automatique" : "Manuelle"}</strong>
                <span>Transmission</span>
              </div>
              {vehicule.carburant && (
                <div className="detail-essentiel-item">
                  <span className="detail-essentiel-icone">
                    <IconeCarburant />
                  </span>
                  <strong>{LIBELLES_CARBURANT[vehicule.carburant]}</strong>
                  <span>Carburant</span>
                </div>
              )}
              {!!vehicule.nombrePortes && (
                <div className="detail-essentiel-item">
                  <span className="detail-essentiel-icone">
                    <IconePorte />
                  </span>
                  <strong>{vehicule.nombrePortes}</strong>
                  <span>Portes</span>
                </div>
              )}
            </div>
          </div>
          )}

          {vehicule.zonePriseEnCharge && (
            <div className="detail-bloc-info">
              <p className="detail-section-titre">
                <IconePin />
                Zone de prise en charge
              </p>
              <div className="detail-bloc-info-contenu">{vehicule.zonePriseEnCharge}</div>
            </div>
          )}

          {vehicule.zoneIncluse && (
            <div className="detail-bloc-info">
              <p className="detail-section-titre">Zone incluse dans le tarif</p>
              <div className="detail-bloc-info-contenu">{vehicule.zoneIncluse}</div>
            </div>
          )}

          {vehicule.equipements.length > 0 && (
            <div className="detail-equipements" id="equipements">
              <p className="detail-section-titre">
                <IconeCheckCercle />
                Équipements inclus
              </p>
              <ul className="detail-equipements-liste">
                {vehicule.equipements.map((code) => (
                  <li key={code}>
                    <IconeCheckCercle className="detail-equipement-coche" />
                    {LIBELLES_EQUIPEMENT[code] ?? code}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {mobile && asideReservation}
      </div>

      <section className="detail-avis" id="avis">
        <h2>
          Avis clients {vehicule.nbAvis ? `(${vehicule.nbAvis})` : ""}
        </h2>
        {avis.length === 0 ? (
          <p className="texte-secondaire">Aucun avis pour le moment sur ce véhicule.</p>
        ) : (
          <ul className="detail-avis-liste">
            {avis.map((a) => (
              <li key={a.id} className="detail-avis-item">
                <div className="detail-avis-entete">
                  <Etoiles note={a.note} />
                  <span className="detail-avis-auteur">{a.auteurPseudo}</span>
                  <span className="detail-avis-date">
                    {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {a.commentaire && <p className="detail-avis-commentaire">{a.commentaire}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommentairesVehicule code={vehicule.codePublic} />

      {(bandeVisible || mobile) && !reservationBloquee && vehicule.disponible !== false && (
        <div className="detail-bande-reservation" role="note">
          <div className="detail-bande-prix">
            <strong>{vehicule.prixUnitaire.toLocaleString("fr-FR")} FCFA</strong>
            <span> / {libelleUnite}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              boutonReserverRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          >
            <IconeCalendrierReservation />
            Réserver ce véhicule
            <IconeFlecheReservation />
          </button>
        </div>
      )}
    </div>
  );
}
