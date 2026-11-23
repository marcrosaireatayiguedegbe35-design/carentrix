import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSombre } from "../components/AuthSombre";
import { useAuth } from "../context/AuthContext";
import {
  effacerInscriptionEnCours,
  lireInscriptionEnCours,
  memoriserInscriptionEnCours,
} from "../lib/inscriptionEnCours";

type Etape = "formulaire" | "code";

export function Inscription() {
  const { demanderCodeInscription, verifierCodeInscription, renvoyerCodeInscription } = useAuth();
  const navigate = useNavigate();

  // Inscription commencée puis interrompue : retour direct à l'écran du code.
  const [enCours] = useState(lireInscriptionEnCours);
  const [etape, setEtape] = useState<Etape>(enCours ? "code" : "formulaire");
  const [nom, setNom] = useState(enCours?.nom ?? "");
  const [telephone, setTelephone] = useState(enCours?.telephone ?? "");
  const [email, setEmail] = useState(enCours?.email ?? "");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [infoRenvoi, setInfoRenvoi] = useState<string | null>(null);

  async function soumettreFormulaire(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setInfoRenvoi(null);
    setChargement(true);
    try {
      await demanderCodeInscription(nom, telephone, email, "LOCATAIRE");
      memoriserInscriptionEnCours({ email: email.trim(), nom, telephone });
      setEtape("code");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  async function soumettreCode(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setInfoRenvoi(null);
    setChargement(true);
    try {
      await verifierCodeInscription(email, code);
      effacerInscriptionEnCours();
      navigate("/changer-mot-de-passe");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  async function renvoyer() {
    setErreur(null);
    setInfoRenvoi(null);
    setChargement(true);
    try {
      await renvoyerCodeInscription(email);
      setInfoRenvoi("Un nouveau code a été envoyé par email.");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  if (etape === "code") {
    return (
      <AuthSombre
        onglet="inscription"
        titreEtape="Vérifier votre email"
        sousTitre={`Un code à 6 chiffres a été envoyé à ${email}.`}
      >
        <form className="as-form" onSubmit={soumettreCode}>
          <label className="as-champ">
            <span className="as-sr">Code reçu</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code à 6 chiffres"
              maxLength={6}
            />
          </label>

          {infoRenvoi && <p className="as-info">{infoRenvoi}</p>}
          {erreur && <p className="as-erreur">{erreur}</p>}

          <button type="submit" className="as-bouton" disabled={chargement || code.length < 6}>
            {chargement ? "Vérification…" : "Valider le code"}
          </button>

          <p className="as-actions-texte">
            <button type="button" onClick={() => void renvoyer()} disabled={chargement}>
              Renvoyer le code
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                effacerInscriptionEnCours();
                setEtape("formulaire");
                setCode("");
                setErreur(null);
              }}
            >
              Modifier l&apos;email
            </button>
          </p>
        </form>
      </AuthSombre>
    );
  }

  return (
    <AuthSombre onglet="inscription">
      <form className="as-form" onSubmit={soumettreFormulaire}>
        <label className="as-champ">
          <span className="as-sr">Nom complet</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            minLength={2}
            autoComplete="name"
            placeholder="Nom complet"
          />
        </label>

        <label className="as-champ">
          <span className="as-sr">Téléphone</span>
          <input
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            required
            autoComplete="tel"
            placeholder="Téléphone"
          />
        </label>

        <label className="as-champ">
          <span className="as-sr">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="E-mail"
          />
        </label>

        {erreur && <p className="as-erreur">{erreur}</p>}

        <button type="submit" className="as-bouton" disabled={chargement}>
          {chargement ? "Envoi du code..." : "Recevoir le code"}
        </button>

        <Link to="/vehicules" className="as-lien-catalogue">
          Continuer vers le catalogue
        </Link>
      </form>
    </AuthSombre>
  );
}
