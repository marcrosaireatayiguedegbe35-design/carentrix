import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CarteReservation } from "../components/CarteReservation";
import { EnteteEspace } from "../components/EnteteEspace";
import { Etoiles, SaisieEtoiles } from "../components/Etoiles";
import { supabase } from "../lib/supabaseClient";
import type { Reservation } from "../types";

function IconeVoiture() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 16.4V12l1.6-4.1A2 2 0 0 1 7.5 6.6h9a2 2 0 0 1 1.9 1.3L20 12v4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16.4h16M4 16.4v1.8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.8M20 16.4v1.8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.6" cy="13.1" r="1" fill="currentColor" />
      <circle cx="16.4" cy="13.1" r="1" fill="currentColor" />
    </svg>
  );
}

function IconeChevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeVoitureVide({ className }: { className?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 16.4V12l1.6-4.1A2 2 0 0 1 7.5 6.6h9a2 2 0 0 1 1.9 1.3L20 12v4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16.4h16M4 16.4v1.8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.8M20 16.4v1.8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.6" cy="13.1" r="0.9" fill="currentColor" />
      <circle cx="16.4" cy="13.1" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function MesReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enAnnulation, setEnAnnulation] = useState<string | null>(null);
  const [erreurAnnulation, setErreurAnnulation] = useState<string | null>(null);
  const [noteBrouillon, setNoteBrouillon] = useState<Record<string, number>>({});
  const [commentaireBrouillon, setCommentaireBrouillon] = useState<Record<string, string>>({});
  const [envoiAvis, setEnvoiAvis] = useState<string | null>(null);
  const [erreurAvis, setErreurAvis] = useState<Record<string, string>>({});

  async function charger() {
    setChargement(true);
    const { data, error } = await supabase
      .from("mes_reservations")
      .select("*")
      .order("date_debut", { ascending: false });
    if (error) {
      setErreur("Impossible de charger vos réservations.");
    } else {
      setReservations(
        (data ?? []).map((r: any) => ({
          codePublic: r.code_public,
          statut: r.statut,
          dateDebut: r.date_debut,
          dateFin: r.date_fin,
          montantTotal: r.montant_total,
          caution: r.caution,
          montantChauffeur: r.montant_chauffeur ?? 0,
          chauffeurPseudo: r.chauffeur_pseudo ?? null,
          avisNote: r.avis_note ?? null,
          avisCommentaire: r.avis_commentaire ?? null,
          vehicule: {
            codePublic: r.vehicule_code,
            marque: r.marque,
            modele: r.modele,
            ville: r.ville,
            photos: r.photos ?? [],
          },
        }))
      );
    }
    setChargement(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function annuler(codePublic: string) {
    setEnAnnulation(codePublic);
    setErreurAnnulation(null);
    const { error } = await supabase.rpc("annuler_reservation", { p_code_reservation: codePublic });
    setEnAnnulation(null);
    if (error) {
      setErreurAnnulation(error.message);
      return;
    }
    charger();
  }

  async function envoyerAvis(codePublic: string) {
    const note = noteBrouillon[codePublic] ?? 0;
    if (note < 1) {
      setErreurAvis((e) => ({ ...e, [codePublic]: "Choisissez une note." }));
      return;
    }
    setEnvoiAvis(codePublic);
    setErreurAvis((e) => ({ ...e, [codePublic]: "" }));
    const { error } = await supabase.rpc("laisser_avis", {
      p_code_reservation: codePublic,
      p_note: note,
      p_commentaire: commentaireBrouillon[codePublic] || null,
    });
    setEnvoiAvis(null);
    if (error) {
      setErreurAvis((e) => ({ ...e, [codePublic]: error.message }));
    } else {
      charger();
    }
  }

  return (
    <div className="page-espace page-reservations espace-refonte">
      <EnteteEspace
        titre="Mes réservations"
        sousTitre="Suivez vos demandes, payez et retrouvez vos locations."
        accessoire={
          <Link to="/vehicules" className="ee-lien-catalogue">
            <IconeVoiture />
            <span>Parcourir le catalogue</span>
            <IconeChevron />
          </Link>
        }
      />

      {chargement && (
        <div className="reservation-squelette" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="reservation-squelette-carte" />
          ))}
        </div>
      )}
      {erreur && (
        <div className="resa-erreur" role="alert">
          <p className="message-erreur">{erreur}</p>
          <button type="button" className="resa-bouton resa-bouton--details" onClick={() => void charger()}>
            Réessayer
          </button>
        </div>
      )}
      {erreurAnnulation && <p className="message-erreur resa-erreur-annulation">{erreurAnnulation}</p>}

      {!chargement && !erreur && reservations.length === 0 && (
        <div className="espace-vide reservation-vide">
          <span className="reservation-vide-icone" aria-hidden="true">
            <IconeVoitureVide />
          </span>
          <p>
            <strong>Aucune réservation</strong>
            <br />
            Vous n&apos;avez pas encore effectué de réservation.
          </p>
          <Link to="/vehicules" className="espace-cta">
            Parcourir le catalogue
          </Link>
        </div>
      )}

      <div className="resa-liste">
        {reservations.map((r) => (
          <CarteReservation
            key={r.codePublic}
            reservation={r}
            enAnnulation={enAnnulation === r.codePublic}
            onAnnuler={() => annuler(r.codePublic)}
          >
            {r.statut === "CLOTUREE" && (
              <div className="espace-avis">
                {r.avisNote != null ? (
                  <div className="espace-avis-envoye">
                    <p className="espace-avis-titre">Votre avis</p>
                    <Etoiles note={r.avisNote} />
                    {r.avisCommentaire && <p className="espace-avis-commentaire">{r.avisCommentaire}</p>}
                  </div>
                ) : (
                  <div className="espace-avis-formulaire">
                    <p className="espace-avis-titre">Laisser un avis sur cette location</p>
                    <SaisieEtoiles
                      valeur={noteBrouillon[r.codePublic] ?? 0}
                      onChange={(note) => setNoteBrouillon((n) => ({ ...n, [r.codePublic]: note }))}
                    />
                    <textarea
                      value={commentaireBrouillon[r.codePublic] ?? ""}
                      onChange={(e) =>
                        setCommentaireBrouillon((c) => ({ ...c, [r.codePublic]: e.target.value }))
                      }
                      placeholder="Votre commentaire (optionnel)"
                      rows={2}
                    />
                    {erreurAvis[r.codePublic] && <p className="message-erreur">{erreurAvis[r.codePublic]}</p>}
                    <button
                      type="button"
                      className="espace-action-secondaire"
                      disabled={envoiAvis === r.codePublic}
                      onClick={() => envoyerAvis(r.codePublic)}
                    >
                      {envoiAvis === r.codePublic ? "Envoi..." : "Envoyer mon avis"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </CarteReservation>
        ))}
      </div>
    </div>
  );
}
