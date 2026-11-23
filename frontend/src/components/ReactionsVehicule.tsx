import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  basculerReaction,
  chargerEngagement,
  EVENEMENT_ENGAGEMENT,
  mesReactions,
  type Engagement,
  type TypeReaction,
} from "../lib/reactions";

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function IconePouce({ plein }: { plein: boolean }) {
  return (
    <svg {...base} fill={plein ? "currentColor" : "none"} stroke="currentColor">
      <path d="M7 11v8.5H4.5a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1H7Z" />
      <path d="M7 11l3.2-6.2a1.6 1.6 0 0 1 3 .9L12.6 9h5.2a1.9 1.9 0 0 1 1.85 2.3l-1.3 6.3a2 2 0 0 1-1.95 1.6H7" />
    </svg>
  );
}

function IconeCoeur({ plein }: { plein: boolean }) {
  return (
    <svg {...base} fill={plein ? "currentColor" : "none"} stroke="currentColor">
      <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}

function IconeBulle() {
  return (
    <svg {...base} fill="none" stroke="currentColor">
      <path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8A1.5 1.5 0 0 1 19 16.5H10l-4.5 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />
    </svg>
  );
}

/** Barre « J'aime », « Cœur » et nombre de commentaires d'un véhicule. */
export function ReactionsVehicule({ code }: { code: string }) {
  const { utilisateur } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<Engagement>({ likes: 0, coeurs: 0, commentaires: 0 });
  const [miennes, setMiennes] = useState<TypeReaction[]>([]);
  const [enCours, setEnCours] = useState<TypeReaction | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      setStats(await chargerEngagement(code));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, [code]);

  useEffect(() => {
    void recharger();
    window.addEventListener(EVENEMENT_ENGAGEMENT, recharger);
    return () => window.removeEventListener(EVENEMENT_ENGAGEMENT, recharger);
  }, [recharger]);

  useEffect(() => {
    if (!utilisateur) {
      setMiennes([]);
      return;
    }
    let annule = false;
    mesReactions(code)
      .then((r) => {
        if (!annule) setMiennes(r);
      })
      .catch(() => {
        if (!annule) setMiennes([]);
      });
    return () => {
      annule = true;
    };
  }, [code, utilisateur]);

  async function reagir(type: TypeReaction) {
    if (!utilisateur) {
      navigate("/connexion", { state: { retourApres: `${location.pathname}${location.search}` } });
      return;
    }
    setEnCours(type);
    setErreur(null);
    try {
      const r = await basculerReaction(code, type);
      setStats((s) => ({ ...s, likes: r.likes, coeurs: r.coeurs }));
      setMiennes((m) => (r.actif ? [...m.filter((t) => t !== type), type] : m.filter((t) => t !== type)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  const aimeLike = miennes.includes("LIKE");
  const aimeCoeur = miennes.includes("COEUR");

  return (
    <div className="rv" role="group" aria-label="Réactions">
      <div className="rv-barre">
        <button
          type="button"
          className={`rv-bouton${aimeLike ? " rv-bouton--actif" : ""}`}
          aria-pressed={aimeLike}
          aria-label={`J'aime, ${stats.likes}`}
          disabled={enCours !== null}
          onClick={() => void reagir("LIKE")}
        >
          <IconePouce plein={aimeLike} />
          <span>{stats.likes}</span>
        </button>
        <button
          type="button"
          className={`rv-bouton rv-bouton--coeur${aimeCoeur ? " rv-bouton--actif" : ""}`}
          aria-pressed={aimeCoeur}
          aria-label={`Cœur, ${stats.coeurs}`}
          disabled={enCours !== null}
          onClick={() => void reagir("COEUR")}
        >
          <IconeCoeur plein={aimeCoeur} />
          <span>{stats.coeurs}</span>
        </button>
        <a href="#commentaires" className="rv-commentaires" aria-label={`${stats.commentaires} commentaires`}>
          <IconeBulle />
          <span>{stats.commentaires}</span>
        </a>
      </div>
      {erreur && <p className="rv-erreur">{erreur}</p>}
    </div>
  );
}
