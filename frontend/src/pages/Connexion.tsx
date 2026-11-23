import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthClair } from "../components/AuthClair";
import { IconeCadenas, IconeEmail, IconeOeil, IconeOeilBarre } from "../components/IconesAuth";
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
    <AuthClair
      titre={
        <>
          Content de vous revoir
          <br />
          Prenez le volant
        </>
      }
      pied={
        <>
          Pas encore de compte ? <Link to="/inscription">S&apos;inscrire</Link>
        </>
      }
    >
      <form className="ac-form" onSubmit={soumettre}>
        <label className="ac-champ">
          <IconeEmail className="ac-icone" />
          <span className="ac-sr">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="E-mail"
          />
        </label>

        <label className="ac-champ">
          <IconeCadenas className="ac-icone" />
          <span className="ac-sr">Mot de passe</span>
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
            className="ac-oeil"
            onClick={() => setVoirMdp((v) => !v)}
            aria-pressed={voirMdp}
            aria-label={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {voirMdp ? <IconeOeil /> : <IconeOeilBarre />}
          </button>
        </label>

        <p className="ac-oublie">
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>

        {erreur && (
          <p className="ac-erreur" role="alert">
            {erreur}
          </p>
        )}

        <button type="submit" className="ac-bouton" disabled={chargement} aria-busy={chargement}>
          {chargement ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </AuthClair>
  );
}
