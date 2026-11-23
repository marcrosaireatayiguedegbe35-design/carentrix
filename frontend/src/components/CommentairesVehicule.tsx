import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ajouterCommentaire,
  chargerCommentaires,
  supprimerMonCommentaire,
  type Commentaire,
} from "../lib/reactions";

const MAX = 500;

function formaterDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Commentaires des clients sur un véhicule (pseudo uniquement ; le garage peut masquer). */
export function CommentairesVehicule({ code }: { code: string }) {
  const { utilisateur } = useAuth();
  const location = useLocation();
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      setCommentaires(await chargerCommentaires(code));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, [code]);

  useEffect(() => {
    void recharger();
  }, [recharger, utilisateur]);

  async function publier(e: FormEvent) {
    e.preventDefault();
    const contenu = texte.trim();
    if (!contenu) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await ajouterCommentaire(code, contenu);
      setTexte("");
      await recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Publication impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer(id: string) {
    setErreur(null);
    try {
      await supprimerMonCommentaire(id);
      await recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Suppression impossible.");
    }
  }

  return (
    <section className="cv" id="commentaires" aria-labelledby="cv-titre">
      <h2 id="cv-titre" className="cv-titre">
        Commentaires {commentaires.length > 0 ? `(${commentaires.length})` : ""}
      </h2>

      {utilisateur ? (
        <form className="cv-form" onSubmit={publier}>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value.slice(0, MAX))}
            placeholder="Votre commentaire sur ce véhicule"
            rows={2}
            maxLength={MAX}
            aria-label="Votre commentaire"
          />
          <div className="cv-form-pied">
            <span className="cv-compteur">
              {texte.length}/{MAX}
            </span>
            <button type="submit" className="cv-publier" disabled={envoi || texte.trim().length === 0}>
              {envoi ? "Envoi…" : "Publier"}
            </button>
          </div>
        </form>
      ) : (
        <Link to="/connexion" state={{ retourApres: `${location.pathname}${location.search}` }} className="cv-connexion">
          Connectez-vous pour commenter
        </Link>
      )}

      {erreur && <p className="cv-erreur">{erreur}</p>}

      {chargement && commentaires.length === 0 && !erreur && <p className="cv-vide">Chargement…</p>}
      {!chargement && commentaires.length === 0 && !erreur && <p className="cv-vide">Aucun commentaire pour l&apos;instant.</p>}

      {commentaires.length > 0 && (
        <ul className="cv-liste">
          {commentaires.map((c) => (
            <li key={c.id} className="cv-item">
              <div className="cv-entete">
                <strong>{c.auteur}</strong>
                <span>{formaterDate(c.date)}</span>
              </div>
              <p className="cv-contenu">{c.contenu}</p>
              {c.estLeMien && (
                <button type="button" className="cv-supprimer" onClick={() => void retirer(c.id)}>
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
