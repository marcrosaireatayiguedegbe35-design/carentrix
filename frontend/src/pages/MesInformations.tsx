import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { libelleStatutKyc } from "../lib/kyc";
import {
  supprimerPhotoProfil,
  uploaderPhotoProfil,
  urlPhotoProfil,
  validerFichierPhotoProfil,
} from "../lib/photoProfil";
import { supabase } from "../lib/supabaseClient";
import type { Role } from "../types";

const LIBELLES_ROLE: Record<Role, string> = {
  LOCATAIRE: "Locataire",
  PROPRIETAIRE: "Propriétaire",
  GARAGE: "Garage",
  CHAUFFEUR: "Chauffeur",
};

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

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

const IconeUtilisateur = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 19.2c1.4-2.6 3.7-4 6.5-4s5.1 1.4 6.5 4" />
  </svg>
);
const IconeDossier = () => (
  <svg {...base}>
    <path d="M4 7.3A1.3 1.3 0 0 1 5.3 6h4l1.6 1.7h7.8A1.3 1.3 0 0 1 20 9v8.7A1.3 1.3 0 0 1 18.7 19H5.3A1.3 1.3 0 0 1 4 17.7Z" />
  </svg>
);
const IconeCalendrier = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const IconeCloche = () => (
  <svg {...base}>
    <path d="M6 10.5a6 6 0 0 1 12 0v3.3l1.4 2.4H4.6L6 13.8Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);
const IconeAide = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.5a2.4 2.4 0 1 1 3.5 2.1c-.8.5-1.1 1-1.1 1.9" />
    <circle cx="12" cy="16.8" r="0.6" fill="currentColor" />
  </svg>
);
const IconeAppareilPhoto = () => (
  <svg {...base} width={16} height={16}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);
const IconeChevron = () => (
  <svg {...base} width={18} height={18} strokeWidth={2}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const IconeSortie = () => (
  <svg {...base} width={20} height={20}>
    <path d="M14 4.5H7.5A1.5 1.5 0 0 0 6 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
    <path d="M11 12h9M17 8.5 20.5 12 17 15.5" />
  </svg>
);

function Rangee({
  vers,
  onClick,
  icone,
  libelle,
  valeur,
  pastille,
}: {
  vers?: string;
  onClick?: () => void;
  icone: ReactNode;
  libelle: string;
  valeur?: string;
  pastille?: { texte: string; classe: string };
}) {
  const contenu = (
    <>
      <span className="mc-rangee-icone">{icone}</span>
      <span className="mc-rangee-texte">
        <strong>{libelle}</strong>
        {valeur && <small>{valeur}</small>}
      </span>
      {pastille && <span className={`mc-pastille ${pastille.classe}`}>{pastille.texte}</span>}
      <IconeChevron />
    </>
  );
  return (
    <li>
      {vers ? (
        <Link to={vers} className="mc-rangee">
          {contenu}
        </Link>
      ) : (
        <button type="button" className="mc-rangee" onClick={onClick}>
          {contenu}
        </button>
      )}
    </li>
  );
}

export function MesInformations() {
  const { utilisateur, rafraichirProfil, supprimerMonCompte, deconnexion } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [nom, setNom] = useState(utilisateur?.nom ?? "");
  const [telephone, setTelephone] = useState(utilisateur?.telephone ?? "");
  const [edition, setEdition] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const estLocataire = utilisateur?.role === "LOCATAIRE";
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const champPhoto = useRef<HTMLInputElement | null>(null);
  const idUtilisateur = utilisateur?.id;

  useEffect(() => {
    if (!idUtilisateur) return;
    let annule = false;
    urlPhotoProfil(idUtilisateur).then((url) => {
      if (!annule) setPhotoUrl(url);
    });
    return () => {
      annule = true;
    };
  }, [idUtilisateur]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!utilisateur) return;
    setNom(utilisateur.nom);
    setTelephone(utilisateur.telephone);
  }, [utilisateur]);

  useEffect(() => {
    if (!edition) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") annulerEdition();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!utilisateur) return;
    setErreur(null);
    setSucces(null);
    setChargement(true);

    const { error } = await supabase
      .from("profiles")
      .update({ nom: nom.trim(), telephone: telephone.trim() })
      .eq("id", utilisateur.id);

    setChargement(false);

    if (error) {
      setErreur(
        error.code === "23505"
          ? "Ce numéro de téléphone est déjà utilisé par un autre compte."
          : "Impossible d'enregistrer vos informations. " + error.message
      );
      return;
    }

    setSucces("Informations mises à jour.");
    setEdition(false);
    await rafraichirProfil();
  }

  async function choisirPhoto(fichier: File | undefined) {
    if (!fichier || !idUtilisateur) return;
    const probleme = validerFichierPhotoProfil(fichier);
    if (probleme) {
      setErreurPhoto(probleme);
      return;
    }
    setErreurPhoto(null);
    setEnvoiPhoto(true);
    try {
      await uploaderPhotoProfil(idUtilisateur, fichier);
      setPhotoUrl(await urlPhotoProfil(idUtilisateur));
    } catch (e) {
      setErreurPhoto(e instanceof Error ? e.message : "Impossible d'enregistrer la photo.");
    } finally {
      setEnvoiPhoto(false);
      if (champPhoto.current) champPhoto.current.value = "";
    }
  }

  async function retirerPhoto() {
    if (!idUtilisateur) return;
    setErreurPhoto(null);
    setEnvoiPhoto(true);
    try {
      await supprimerPhotoProfil(idUtilisateur);
      setPhotoUrl(null);
    } catch (e) {
      setErreurPhoto(e instanceof Error ? e.message : "Impossible de supprimer la photo.");
    } finally {
      setEnvoiPhoto(false);
    }
  }

  function annulerEdition() {
    if (utilisateur) {
      setNom(utilisateur.nom);
      setTelephone(utilisateur.telephone);
    }
    setErreur(null);
    setEdition(false);
  }

  async function confirmerSuppressionCompte() {
    const ok = window.confirm(
      "Supprimer définitivement votre compte ? Cette action est irréversible : profil, dossier et historique seront effacés."
    );
    if (!ok) return;
    setErreurSuppression(null);
    setSuppression(true);
    try {
      await supprimerMonCompte();
      navigate("/", { replace: true });
    } catch (e) {
      setErreurSuppression(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setSuppression(false);
    }
  }

  if (!utilisateur) return null;

  return (
    <div className="mc-page">
      <header className="mc-entete">
        <h1 className="mc-titre">Mon compte</h1>
        <Link to="/" aria-label="Accueil Carentrix">
          <img src="/logo-carentrix.png" alt="Carentrix" className="mc-logo" />
        </Link>
      </header>

      <section className="mc-profil" aria-label="Profil">
        <button
          type="button"
          className="mc-avatar-bouton"
          onClick={() => champPhoto.current?.click()}
          disabled={envoiPhoto}
          aria-label={photoUrl ? "Changer la photo de profil" : "Ajouter une photo de profil"}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="mc-avatar mc-avatar-image" onError={() => setPhotoUrl(null)} />
          ) : (
            <span className="mc-avatar" aria-hidden="true">
              {initiales(utilisateur.nom)}
            </span>
          )}
          <span className="mc-camera" aria-hidden="true">
            <IconeAppareilPhoto />
          </span>
        </button>
        <input
          ref={champPhoto}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void choisirPhoto(e.target.files?.[0])}
        />
        <div className="mc-profil-texte">
          <p className="mc-nom">{utilisateur.nom}</p>
          <p className="mc-email">{email ?? LIBELLES_ROLE[utilisateur.role]}</p>
          {envoiPhoto && <p className="mc-photo-etat">Envoi de la photo…</p>}
          {!envoiPhoto && photoUrl && (
            <button type="button" className="mc-lien mc-lien--danger" onClick={() => void retirerPhoto()}>
              Supprimer la photo
            </button>
          )}
        </div>
      </section>
      {erreurPhoto && <p className="mc-message mc-message--erreur">{erreurPhoto}</p>}
      {succes && (
        <p className="mc-message mc-message--succes" role="status">
          {succes}
        </p>
      )}

      <ul className="mc-liste">
        <Rangee
          onClick={() => setEdition(true)}
          icone={<IconeUtilisateur />}
          libelle="Informations personnelles"
          valeur={utilisateur.telephone}
        />
        {estLocataire && (
          <Rangee
            vers="/mon-dossier"
            icone={<IconeDossier />}
            libelle="Mon dossier"
            pastille={{
              texte: libelleStatutKyc(utilisateur.statutKyc),
              classe: `mc-pastille--${utilisateur.statutKyc.toLowerCase()}`,
            }}
          />
        )}
        {estLocataire && <Rangee vers="/mes-reservations" icone={<IconeCalendrier />} libelle="Mes réservations" />}
        <Rangee vers="/notifications" icone={<IconeCloche />} libelle="Notifications" />
        <Rangee vers="/aide-support" icone={<IconeAide />} libelle="Aide et support" />
      </ul>

      <button
        type="button"
        className="mc-deconnexion"
        onClick={() => {
          void deconnexion();
          navigate("/connexion");
        }}
      >
        <IconeSortie />
        Se déconnecter
      </button>

      {estLocataire && (
        <div className="mc-suppression">
          <button
            type="button"
            className="mc-lien mc-lien--danger"
            disabled={suppression}
            onClick={() => void confirmerSuppressionCompte()}
          >
            {suppression ? "Suppression…" : "Supprimer mon compte"}
          </button>
          {erreurSuppression && <p className="mc-message mc-message--erreur">{erreurSuppression}</p>}
        </div>
      )}

      {edition && (
        <div className="mc-voile" onClick={annulerEdition}>
          <form
            className="mc-feuille"
            role="dialog"
            aria-modal="true"
            aria-label="Informations personnelles"
            onClick={(e) => e.stopPropagation()}
            onSubmit={soumettre}
          >
            <span className="mc-poignee" aria-hidden="true" />
            <label className="mc-champ">
              <span>Nom complet</span>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                minLength={2}
                autoComplete="name"
                autoFocus
              />
            </label>
            <label className="mc-champ">
              <span>Téléphone</span>
              <input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                required
                minLength={8}
                autoComplete="tel"
              />
            </label>
            <label className="mc-champ">
              <span>E-mail</span>
              <input value={email ?? ""} readOnly disabled />
            </label>

            {erreur && <p className="mc-message mc-message--erreur">{erreur}</p>}

            <div className="mc-feuille-actions">
              <button type="submit" className="mc-bouton-rouge" disabled={chargement}>
                {chargement ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button type="button" className="mc-lien" onClick={annulerEdition}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
