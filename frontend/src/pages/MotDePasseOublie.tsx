import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

type Etape = "email" | "code";

export function MotDePasseOublie() {
  const { demanderCodeReinitialisation, verifierCodeInscription } = useAuth();
  const navigate = useNavigate();

  const [etape, setEtape] = useState<Etape>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function envoyerCode(e?: FormEvent) {
    e?.preventDefault();
    setErreur(null);
    setInfo(null);
    setChargement(true);
    try {
      await demanderCodeReinitialisation(email);
      if (etape === "email") {
        setEtape("code");
      } else {
        setInfo("Un nouveau code a été envoyé par email.");
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  async function validerCode(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setInfo(null);
    setChargement(true);
    try {
      await verifierCodeInscription(email, code);
      navigate("/changer-mot-de-passe", { state: { reinitialisation: true } });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChargement(false);
    }
  }

  if (etape === "code") {
    return (
      <AuthShell
        titre="Vérifier votre email"
        sousTitre={`Un code à 6 chiffres a été envoyé à ${email}.`}
        image="/hero/hero-01.jpg"
      >
        <form className="auth-form" onSubmit={validerCode}>
          <label className="auth-champ">
            <span>Code reçu</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
            />
          </label>
          {info && <p className="texte-secondaire">{info}</p>}
          {erreur && <p className="message-erreur auth-erreur">{erreur}</p>}
          <button type="submit" className="auth-submit" disabled={chargement || code.length < 6}>
            {chargement ? "Vérification…" : "Valider le code"}
          </button>
          <p className="auth-pied">
            <button type="button" className="bouton-lien" onClick={() => void envoyerCode()} disabled={chargement}>
              Renvoyer le code
            </button>
            {" · "}
            <button
              type="button"
              className="bouton-lien"
              onClick={() => {
                setEtape("email");
                setCode("");
                setErreur(null);
                setInfo(null);
              }}
            >
              Modifier l&apos;email
            </button>
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titre="Mot de passe oublié"
      sousTitre="Saisissez votre email : nous vous envoyons un code pour choisir un nouveau mot de passe."
      image="/hero/hero-01.jpg"
    >
      <form className="auth-form" onSubmit={envoyerCode}>
        <label className="auth-champ">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="vous@exemple.com"
          />
        </label>

        {erreur && <p className="message-erreur auth-erreur">{erreur}</p>}

        <button type="submit" className="auth-submit" disabled={chargement}>
          {chargement ? "Envoi du code..." : "Recevoir le code"}
        </button>

        <p className="auth-pied">
          <Link to="/connexion">Retour à la connexion</Link>
        </p>
      </form>
    </AuthShell>
  );
}
