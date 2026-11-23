import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthSombre } from "../components/AuthSombre";
import { IconeOeil, IconeOeilBarre } from "../components/IconesAuth";
import { useAuth } from "../context/AuthContext";
import { effacerInscriptionEnCours } from "../lib/inscriptionEnCours";
import { kycBloqueActivite } from "../lib/kyc";
import type { Utilisateur } from "../types";

function destinationApresConnexion(profil: Utilisateur) {
  if (profil.doitChangerMotDePasse) return "/changer-mot-de-passe";
  if (profil.role === "GARAGE") return "/garage/tableau-de-bord";
  if (profil.role === "LOCATAIRE") return "/vehicules";
  if (kycBloqueActivite(profil)) return "/mon-dossier";
  return "/vehicules";
}

export function Connexion() {
  const { connexion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [voirMdp, setVoirMdp] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const profil = await connexion(email, motDePasse);
      if (!profil) return;
      effacerInscriptionEnCours();
      const retourApres = (location.state as { retourApres?: string } | null)?.retourApres;
      const destination =
        !profil.doitChangerMotDePasse && retourApres ? retourApres : destinationApresConnexion(profil);
      navigate(destination, {
        state: kycBloqueActivite(profil) ? { depuisBlocage: true } : undefined,
      });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  return (
    <AuthSombre onglet="connexion">
      <form className="as-form" onSubmit={soumettre}>
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

        <label className="as-champ">
          <span className="as-sr">Mot de passe</span>
          <input
            type={voirMdp ? "text" : "password"}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Mot de passe"
          />
          <button
            type="button"
            className="as-oeil"
            onClick={() => setVoirMdp((v) => !v)}
            aria-pressed={voirMdp}
            aria-label={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {voirMdp ? <IconeOeil /> : <IconeOeilBarre />}
          </button>
        </label>

        <p className="as-oublie">
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>

        {erreur && <p className="as-erreur">{erreur}</p>}

        <button type="submit" className="as-bouton" disabled={chargement} aria-busy={chargement}>
          {chargement ? "Connexion..." : "Se connecter"}
        </button>

        <Link to="/vehicules" className="as-lien-catalogue">
          Continuer vers le catalogue
        </Link>
      </form>
    </AuthSombre>
  );
}
