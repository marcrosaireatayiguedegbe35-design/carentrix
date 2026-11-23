import { useEffect, useState } from "react";
import { GarageShell } from "../../components/GarageShell";
import {
  commentairesRecentsGarage,
  masquerCommentaire,
  performanceVehicules,
  type CommentaireGarage,
  type PerformanceVehicule,
} from "../../lib/reactions";

function formaterDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function PerformanceGarage() {
  const [vehicules, setVehicules] = useState<PerformanceVehicule[]>([]);
  const [commentaires, setCommentaires] = useState<CommentaireGarage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const [perf, comm] = await Promise.all([performanceVehicules(), commentairesRecentsGarage()]);
      setVehicules(perf);
      setCommentaires(comm);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void charger();
  }, []);

  async function basculerMasque(c: CommentaireGarage) {
    setEnCours(c.id);
    try {
      await masquerCommentaire(c.id, !c.masque);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setEnCours(null);
    }
  }

  const total = vehicules.reduce(
    (t, v) => ({
      likes: t.likes + v.likes,
      coeurs: t.coeurs + v.coeurs,
      commentaires: t.commentaires + v.commentaires,
      reservations: t.reservations + v.reservations,
    }),
    { likes: 0, coeurs: 0, commentaires: 0, reservations: 0 }
  );

  return (
    <GarageShell
      titre="Performance"
      sousTitre="J'aime, cœurs, commentaires et réservations par véhicule."
      actions={
        <button type="button" className="garage-btn garage-btn--fantome" onClick={() => void charger()}>
          Actualiser
        </button>
      }
    >
      {chargement && <p className="garage-etat">Chargement…</p>}
      {erreur && <p className="garage-etat gp-erreur">{erreur}</p>}

      {!chargement && !erreur && (
        <>
          <div className="gp-totaux" aria-label="Totaux">
            <div>
              <strong>{total.likes}</strong>
              <span>J&apos;aime</span>
            </div>
            <div>
              <strong>{total.coeurs}</strong>
              <span>Cœurs</span>
            </div>
            <div>
              <strong>{total.commentaires}</strong>
              <span>Commentaires</span>
            </div>
            <div>
              <strong>{total.reservations}</strong>
              <span>Réservations</span>
            </div>
          </div>

          <h2 className="gp-titre">Par véhicule</h2>
          {vehicules.length === 0 ? (
            <div className="garage-vide">
              <p>Aucun véhicule pour le moment.</p>
            </div>
          ) : (
            <div className="gp-tableau-zone">
              <table className="gp-tableau">
                <thead>
                  <tr>
                    <th scope="col">Véhicule</th>
                    <th scope="col">J&apos;aime</th>
                    <th scope="col">Cœurs</th>
                    <th scope="col">Comm.</th>
                    <th scope="col">Réserv.</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicules.map((v) => (
                    <tr key={v.code}>
                      <th scope="row">
                        <span className="gp-nom">
                          {v.marque} {v.modele}
                        </span>
                        <span className="gp-meta">
                          {v.ville} · {v.code}
                        </span>
                      </th>
                      <td>{v.likes}</td>
                      <td>{v.coeurs}</td>
                      <td>{v.commentaires}</td>
                      <td>{v.reservations}</td>
                      <td>{v.noteMoyenne == null ? "—" : `${v.noteMoyenne} (${v.nbAvis})`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="gp-titre">Derniers commentaires</h2>
          {commentaires.length === 0 ? (
            <div className="garage-vide">
              <p>Aucun commentaire pour le moment.</p>
            </div>
          ) : (
            <ul className="garage-liste">
              {commentaires.map((c) => (
                <li key={c.id} className="garage-dossier">
                  <div className="garage-ligne-principal">
                    <strong>{c.vehicule}</strong>
                    {c.masque && <span className="garage-badge garage-badge--rejete">Masqué</span>}
                  </div>
                  <p className="garage-meta">
                    {c.auteur} · {formaterDate(c.date)}
                  </p>
                  <p className="gp-commentaire">{c.contenu}</p>
                  <button
                    type="button"
                    className="garage-btn garage-btn--fantome"
                    disabled={enCours === c.id}
                    onClick={() => void basculerMasque(c)}
                  >
                    {c.masque ? "Afficher à nouveau" : "Masquer"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </GarageShell>
  );
}
