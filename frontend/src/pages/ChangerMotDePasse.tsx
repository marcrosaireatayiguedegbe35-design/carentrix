import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { kycBloqueActivite } from "../lib/kyc";

export function ChangerMotDePasse() {
  const { changerMotDePasse, utilisateur } = useAuth();
  const navigate = useNavigate();
  const reinitialisation =
    (useLocation().state as { reinitialisation?: boolean } | null)?.reinitialisation === true;
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [voirMdp, setVoirMdp] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (nouveauMotDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setChargement(true);
    try {
      await changerMotDePasse(nouveauMotDePasse);
      if (!utilisateur || utilisateur.role === "LOCATAIRE") {
        navigate("/vehicules");
      } else if (utilisateur.role === "GARAGE") {
        navigate("/garage/tableau-de-bord");
      } else if (utilisateur.role === "AGENCE") {
        navigate("/agence/tableau-de-bord");
      } else if (kycBloqueActivite(utilisateur)) {
        navigate("/mon-dossier");
      } else {
        navigate("/vehicules");
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  return (
    <AuthShell
      titre={reinitialisation ? "Nouveau mot de passe" : "Créez votre mot de passe"}
      sousTitre={
        reinitialisation
          ? "Choisissez le nouveau mot de passe de votre compte."
          : "Choisissez un mot de passe personnel pour sécuriser votre espace."
      }
      image="/hero/hero-08.jpg"
    >
      <form className="auth-form" onSubmit={soumettre}>
        <label className="auth-champ">
          <span>Nouveau mot de passe</span>
          <div className="auth-champ-mdp">
            <input
              type={voirMdp ? "text" : "password"}
              value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Au moins 6 caractères"
            />
            <button type="button" className="auth-toggle-mdp" onClick={() => setVoirMdp((v) => !v)}>
              {voirMdp ? "Masquer" : "Afficher"}
            </button>
          </div>
        </label>
        <label className="auth-champ">
          <span>Confirmer le mot de passe</span>
          <input
            type={voirMdp ? "text" : "password"}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Retapez le mot de passe"
          />
        </label>

        {erreur && <p className="message-erreur auth-erreur">{erreur}</p>}

        <button type="submit" className="auth-submit" disabled={chargement}>
          {chargement ? "Enregistrement..." : "Valider mon mot de passe"}
        </button>
      </form>
    </AuthShell>
  );
}
