import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  documentsRequisPourRole,
  LIBELLES_DOCUMENT,
  mesDocuments,
  uploaderDocument,
  urlSigneeDocument,
} from "../lib/documentsKyc";
import { libelleStatutKyc } from "../lib/kyc";
import { supabase } from "../lib/supabaseClient";
import type { DocumentKyc, TypeDocumentKyc } from "../types";

function IconeCarteIdentite({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.8 15.6c.5-1.4 1.6-2.1 2.7-2.1s2.2.7 2.7 2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 9.4h4.2M14 12.2h4.2M14 15h2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconePermis({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.3" cy="11.3" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 9.3h4.2M14 12h4.2M6.1 15.4h4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconeMaison({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.2 12 4.5l8 6.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 9.8V18a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeDocumentGenerique({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7l4 4V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V7a1 1 0 0 0 1 1h3.4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.3 12h7.4M8.3 15.2h7.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconePortrait({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10.6" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.3 16.3c.9-1.9 2.6-2.9 4.7-2.9s3.8 1 4.7 2.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const ICONES_DOCUMENT: Record<TypeDocumentKyc, (props: { className?: string }) => ReactElement> = {
  PIECE_IDENTITE: IconeCarteIdentite,
  PERMIS_CONDUIRE: IconePermis,
  JUSTIFICATIF_PROPRIETE: IconeDocumentGenerique,
  JUSTIFICATIF_RESIDENCE: IconeMaison,
  PHOTO_PROFIL: IconePortrait,
};

function IconeCheckCercle({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12.3l2.6 2.6L16.3 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeHorlogeCercle({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeCroixCercle({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function IconeBouclier({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 19 6v5.3c0 4.4-3 7.6-7 9.2-4-1.6-7-4.8-7-9.2V6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONES_STATUT: Record<string, (props: { className?: string }) => ReactElement> = {
  VERIFIE: IconeCheckCercle,
  EN_ATTENTE: IconeHorlogeCercle,
  REJETE: IconeCroixCercle,
};

function IconeTeleversement() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function IconeRetour() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CompleterDossier() {
  const { utilisateur, rafraichirProfil } = useAuth();
  const location = useLocation();
  const depuisBlocage = Boolean(
    (location.state as { depuisBlocage?: boolean } | null)?.depuisBlocage
  );

  const [documents, setDocuments] = useState<DocumentKyc[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<TypeDocumentKyc | null>(null);
  const [soumission, setSoumission] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const typesRequis = utilisateur ? documentsRequisPourRole(utilisateur.role) : [];
  const dossierComplet = useMemo(
    () => typesRequis.every((type) => documents.some((d) => d.type === type)),
    [documents, typesRequis]
  );
  const estLocataire = utilisateur?.role === "LOCATAIRE";
  const certifie = utilisateur?.statutKyc === "VERIFIE";

  async function charger() {
    if (!utilisateur) return;
    setChargement(true);
    setDocuments(await mesDocuments(utilisateur.id));
    setChargement(false);
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur?.id]);

  async function soumettrePourVerification() {
    setErreur(null);
    setInfo(null);
    setSoumission(true);
    try {
      const { error } = await supabase.rpc("soumettre_dossier_verification");
      if (error) throw new Error(error.message);
      await rafraichirProfil();
      setInfo("Dossier transmis au garage. Vous serez notifié une fois la validation effectuée.");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Impossible de soumettre le dossier.");
    } finally {
      setSoumission(false);
    }
  }

  async function surChangementFichier(type: TypeDocumentKyc, fichier: File | undefined) {
    if (!fichier || !utilisateur) return;
    setErreur(null);
    setInfo(null);
    setEnCours(type);
    try {
      await uploaderDocument(utilisateur.id, type, fichier);
      const docs = await mesDocuments(utilisateur.id);
      setDocuments(docs);

      const complet = typesRequis.every((t) => docs.some((d) => d.type === t));
      if (complet && utilisateur.statutKyc !== "VERIFIE" && utilisateur.statutKyc !== "EN_ATTENTE") {
        const { error } = await supabase.rpc("soumettre_dossier_verification");
        if (error) throw new Error(error.message);
        await rafraichirProfil();
        setInfo("Tous les documents sont déposés. Le garage va vérifier votre dossier.");
      } else if (complet && utilisateur.statutKyc === "REJETE") {
        const { error } = await supabase.rpc("soumettre_dossier_verification");
        if (error) throw new Error(error.message);
        await rafraichirProfil();
        setInfo("Nouveau dossier transmis au garage pour re-vérification.");
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Le dépôt du document a échoué.");
    } finally {
      setEnCours(null);
    }
  }

  async function voirDocument(chemin: string) {
    const url = await urlSigneeDocument(chemin);
    if (url) window.open(url, "_blank");
  }

  if (!utilisateur) return null;

  const IconeStatut = ICONES_STATUT[utilisateur.statutKyc] ?? IconeBouclier;
  const total = typesRequis.length;
  const deposes = typesRequis.filter((type) => documents.some((doc) => doc.type === type)).length;
  const pourcentage = total === 0 ? 0 : Math.round((deposes / total) * 100);
  const statut = utilisateur.statutKyc.toLowerCase();

  return (
    <div className="pd-page">
      <header className="pd-barre">
        <Link to="/vehicules" className="pd-retour" aria-label="Retour au catalogue">
          <IconeRetour />
        </Link>
        <h1 className="pd-titre-page">Mon dossier</h1>
        <Link to="/" aria-label="Accueil Carentrix">
          <img src="/logo-carentrix.png" alt="Carentrix" className="pd-logo" />
        </Link>
      </header>

      <section className={`pd-resume pd-resume--${statut}${depuisBlocage ? " pd-resume--bloque" : ""}`} role="status">
        <div className="pd-resume-tete">
          <span className="pd-resume-icone" aria-hidden="true">
            <IconeStatut />
          </span>
          <p className="pd-resume-etat">{libelleStatutKyc(utilisateur.statutKyc)}</p>
          {total > 0 && (
            <p className="pd-compte">
              {deposes}/{total}
            </p>
          )}
        </div>
        {total > 0 && (
          <div
            className="pd-progression"
            role="progressbar"
            aria-label="Documents déposés"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={deposes}
          >
            <span style={{ width: `${pourcentage}%` }} />
          </div>
        )}
      </section>

      {info && <p className="pd-message pd-message--info">{info}</p>}
      {erreur && <p className="pd-message pd-message--erreur">{erreur}</p>}

      <section className="pd-carte" aria-label="Documents à fournir">
        {chargement ? (
          <div className="pd-squelette" aria-hidden="true">
            {typesRequis.map((type) => (
              <span key={type} />
            ))}
          </div>
        ) : (
          <ul className="pd-docs">
            {typesRequis.map((type) => {
              const document = documents.find((d) => d.type === type);
              const IconeDoc = ICONES_DOCUMENT[type];
              const envoiEnCours = enCours === type;
              return (
                <li key={type} className="pd-doc">
                  <span className="pd-doc-icone" aria-hidden="true">
                    <IconeDoc />
                  </span>
                  <div className="pd-doc-texte">
                    <strong>{LIBELLES_DOCUMENT[type]}</strong>
                    {document ? (
                      <small>
                        Déposé le {new Date(document.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                        <button type="button" className="pd-voir" onClick={() => voirDocument(document.cheminFichier)}>
                          Voir
                        </button>
                      </small>
                    ) : null}
                  </div>
                  <label
                    className={`pd-depot${document ? " pd-depot--fait" : ""}${
                      utilisateur.statutKyc === "EN_ATTENTE" ? " pd-depot--bloque" : ""
                    }`}
                  >
                    {document ? <IconeCheckCercle /> : <IconeTeleversement />}
                    <span>{envoiEnCours ? "Envoi..." : document ? "Remplacer" : "Déposer"}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      hidden
                      disabled={envoiEnCours || utilisateur.statutKyc === "EN_ATTENTE"}
                      onChange={(e) => surChangementFichier(type, e.target.files?.[0])}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="pd-actions">
        {dossierComplet && (utilisateur.statutKyc === "NON_VERIFIE" || utilisateur.statutKyc === "REJETE") && (
          <button type="button" className="pd-bouton-rouge" disabled={soumission} onClick={soumettrePourVerification}>
            {soumission ? "Envoi…" : "Soumettre pour certification"}
          </button>
        )}
        {estLocataire && (
          <Link to="/vehicules" className={certifie ? "pd-bouton-rouge" : "pd-bouton-contour"}>
            {certifie ? "Voir le catalogue" : "Continuer vers le catalogue"}
          </Link>
        )}
      </div>
    </div>
  );
}
