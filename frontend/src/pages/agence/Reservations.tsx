import { useEffect, useState } from "react";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import { STATUTS_ACTIFS, chargerReservationsAgence, formaterFcfa } from "../../lib/agences";
import type { ReservationAgence } from "../../lib/agences";

const LIBELLES_STATUT: Record<string, string> = {
  EN_ATTENTE: "En attente de paiement",
  EN_ATTENTE_PAIEMENT: "En attente de paiement",
  CONFIRMEE: "Confirmée — à remettre",
  VEHICULE_REMIS: "Véhicule remis",
  EN_LOCATION: "En location",
  RETOURNE: "Retourné",
  INSPECTION: "Inspection",
  LITIGE: "Litige",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée",
};

const LIBELLES_MOYEN: Record<string, string> = {
  CASH: "Espèces",
  FEDAPAY: "En ligne",
  MTN_MOMO: "MTN MoMo",
  MOOV_MONEY: "Moov Money",
  CARTE: "Carte",
};

type Filtre = "toutes" | "actives" | "a_encaisser";

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function ReservationsAgence() {
  const [reservations, setReservations] = useState<ReservationAgence[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function charger() {
    chargerReservationsAgence()
      .then(setReservations)
      .catch((err) => setErreur(err instanceof Error ? err.message : "Chargement impossible"));
  }

  useEffect(charger, []);

  const aEncaisser = (r: ReservationAgence) =>
    r.paiementMoyen === "CASH" && r.paiementStatut === "EN_ATTENTE" && r.statut !== "ANNULEE";

  async function encaisser(r: ReservationAgence) {
    const ok = window.confirm(
      `Confirmer avoir reçu ${formaterFcfa(r.montantTotal + r.caution)} en espèces pour ${r.codePublic} ?\n\n` +
        `La commission Carentrix (${formaterFcfa(r.montantCommission)}) sera ajoutée à votre solde à régler.`
    );
    if (!ok) return;
    setEnCours(r.codePublic);
    setErreurs((e) => ({ ...e, [r.codePublic]: "" }));
    const { error } = await supabase.rpc("agence_encaisser_paiement_cash", { p_code_reservation: r.codePublic });
    setEnCours(null);
    if (error) setErreurs((e) => ({ ...e, [r.codePublic]: error.message }));
    charger();
  }

  const liste = (reservations ?? []).filter((r) => {
    if (filtre === "actives") return STATUTS_ACTIFS.includes(r.statut);
    if (filtre === "a_encaisser") return aEncaisser(r);
    return true;
  });

  return (
    <GarageShell titre="Réservations" sousTitre="Les commandes reçues sur vos véhicules.">
      <div className="garage-onglets" role="tablist" aria-label="Filtrer les réservations">
        {(
          [
            ["toutes", "Toutes"],
            ["actives", "En cours"],
            ["a_encaisser", "Espèces à encaisser"],
          ] as const
        ).map(([id, libelle]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filtre === id}
            className={`garage-onglet${filtre === id ? " is-actif" : ""}`}
            onClick={() => setFiltre(id)}
          >
            {libelle}
          </button>
        ))}
      </div>

      {erreur && <p className="message-erreur">{erreur}</p>}
      {!reservations && !erreur && <p className="garage-etat">Chargement…</p>}
      {reservations && liste.length === 0 && (
        <div className="garage-vide">
          <p>Aucune réservation dans ce filtre.</p>
        </div>
      )}

      <ul className="garage-liste">
        {liste.map((r) => (
          <li key={r.codePublic} className="garage-dossier">
            <div className="garage-ligne-principal">
              <strong>
                {r.codePublic} · {r.marque} {r.modele}
              </strong>
              <span className={`garage-badge garage-badge--${r.statut.toLowerCase()}`}>
                {LIBELLES_STATUT[r.statut] ?? r.statut}
              </span>
            </div>
            <p className="garage-meta">
              Du {formaterDate(r.dateDebut)} au {formaterDate(r.dateFin)}
            </p>
            <p className="garage-meta">
              Location {formaterFcfa(r.montantTotal)} · commission {r.tauxCommission} % ({formaterFcfa(r.montantCommission)}) ·{" "}
              <strong>votre part {formaterFcfa(r.montantAgence)}</strong>
              {r.caution ? ` · caution ${formaterFcfa(r.caution)}` : ""}
            </p>
            <p className="garage-meta">
              Paiement : {r.paiementMoyen ? LIBELLES_MOYEN[r.paiementMoyen] ?? r.paiementMoyen : "aucun"}
              {r.paiementStatut ? ` · ${r.paiementStatut === "REUSSI" ? "reçu" : r.paiementStatut.toLowerCase().replace("_", " ")}` : ""}
            </p>
            {r.clientNom ? (
              <p className="garage-meta">
                Client : <strong>{r.clientNom}</strong>
                {r.clientTelephone ? ` · ${r.clientTelephone}` : ""}
              </p>
            ) : (
              <p className="garage-meta">Coordonnées du client communiquées après confirmation.</p>
            )}
            {aEncaisser(r) && (
              <div className="garage-carte-actions">
                <button
                  type="button"
                  className="garage-btn garage-btn--principal"
                  disabled={enCours === r.codePublic}
                  onClick={() => void encaisser(r)}
                >
                  J'ai reçu le paiement en espèces
                </button>
              </div>
            )}
            {erreurs[r.codePublic] && <p className="message-erreur">{erreurs[r.codePublic]}</p>}
          </li>
        ))}
      </ul>
    </GarageShell>
  );
}
