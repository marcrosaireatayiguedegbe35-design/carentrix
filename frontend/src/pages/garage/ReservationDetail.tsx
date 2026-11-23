import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import type { DetailReservationGarage, StatutReservation } from "../../types";

const LIBELLES_STATUT: Record<StatutReservation, string> = {
  DEMANDEE: "Nouvelle demande — à valider ou refuser",
  EN_ATTENTE_PAIEMENT: "Validée — en attente de paiement",
  REFUSEE: "Refusée par le garage",
  EXPIREE: "Expirée",
  EN_ATTENTE: "En attente de paiement",
  CONFIRMEE: "Confirmée — prête pour la remise",
  VEHICULE_REMIS: "Véhicule remis",
  EN_LOCATION: "En cours de location",
  RETOURNE: "Retourné",
  INSPECTION: "En inspection",
  LITIGE: "Litige en cours",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
};

export function ReservationDetailGarage() {
  const { code } = useParams<{ code: string }>();
  const [detail, setDetail] = useState<DetailReservationGarage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState(false);
  const [refus, setRefus] = useState(false);
  const [notes, setNotes] = useState("");
  const [descriptionLitige, setDescriptionLitige] = useState("");
  const [montantPreleve, setMontantPreleve] = useState<number | "">("");
  const [resolution, setResolution] = useState("");
  const [motifRefus, setMotifRefus] = useState("");

  async function charger() {
    if (!code) return;
    setChargement(true);
    const { data, error } = await supabase.rpc("garage_details_reservation", {
      p_code_reservation: code,
    });
    if (error) {
      setErreur(error.message);
    } else {
      setDetail(data as DetailReservationGarage);
      setErreur(null);
    }
    setChargement(false);
  }

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function validerDemande() {
    if (action) return;
    const ok = window.confirm(
      "Valider cette demande de réservation ? Le client pourra alors payer."
    );
    if (!ok) return;
    setAction(true);
    const { error } = await supabase.rpc("garage_valider_demande", {
      p_code_reservation: code,
    });
    setAction(false);
    if (!error) {
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  async function refuserDemande() {
    if (!motifRefus.trim()) {
      setErreur("Merci d'indiquer un motif de refus.");
      return;
    }
    if (refus) return;
    setRefus(true);
    const { error } = await supabase.rpc("garage_refuser_demande", {
      p_code_reservation: code,
      p_motif: motifRefus,
    });
    setRefus(false);
    if (!error) {
      setMotifRefus("");
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  async function refuserLocation() {
    if (refus) return;
    const ok = window.confirm(
      "Refuser cette location ? La réservation sera annulée."
    );
    if (!ok) return;
    setRefus(true);
    const { error } = await supabase.rpc("proprietaire_refuser_location", {
      p_code_reservation: code,
    });
    setRefus(false);
    if (!error) {
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  async function remettre() {
    setAction(true);
    const { error } = await supabase.rpc("garage_remettre_vehicule", {
      p_code_reservation: code,
      p_notes: notes || null,
    });
    setAction(false);
    if (!error) {
      setNotes("");
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  async function retourner() {
    setAction(true);
    const { error } = await supabase.rpc("garage_retourner_vehicule", {
      p_code_reservation: code,
      p_notes: notes || null,
    });
    setAction(false);
    if (!error) {
      setNotes("");
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  async function terminerInspection(litige: boolean) {
    setAction(true);
    const { error } = await supabase.rpc("garage_terminer_inspection", {
      p_code_reservation: code,
      p_litige: litige,
      p_description: litige ? descriptionLitige : null,
      p_montant_preleve: litige && montantPreleve !== "" ? montantPreleve : null,
    });
    setAction(false);
    if (!error) {
      setDescriptionLitige("");
      setMontantPreleve("");
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  async function encaisserCash() {
    setAction(true);
    const { error } = await supabase.rpc("garage_encaisser_paiement_cash", {
      p_code_reservation: code,
    });
    setAction(false);
    if (!error) {
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  async function resoudreLitige() {
    setAction(true);
    const { error } = await supabase.rpc("garage_resoudre_litige", {
      p_code_reservation: code,
      p_resolution: resolution,
      p_montant_preleve: montantPreleve !== "" ? montantPreleve : null,
    });
    setAction(false);
    if (!error) {
      setResolution("");
      setMontantPreleve("");
      void charger();
    } else {
      setErreur(error.message);
    }
  }

  if (chargement) {
    return (
      <GarageShell titre={code ?? "Réservation"} retour={{ to: "/garage/reservations", libelle: "Réservations" }}>
        <p className="garage-etat">Chargement…</p>
      </GarageShell>
    );
  }

  if (erreur && !detail) {
    return (
      <GarageShell titre={code ?? "Réservation"} retour={{ to: "/garage/reservations", libelle: "Réservations" }}>
        <p className="message-erreur">{erreur}</p>
      </GarageShell>
    );
  }

  if (!detail) return null;

  const { reservation, vehicule, locataire, paiements, etatsDesLieux, litige } = detail;
  const locataireCertifie = locataire.statutKyc === "VERIFIE";
  const paiementCashEnAttente = paiements.some(
    (p) => p.moyen === "CASH" && p.statut === "EN_ATTENTE"
  );
  const libelleKyc = (statut: string) =>
    statut === "VERIFIE"
      ? "Certifié"
      : statut === "EN_ATTENTE"
        ? "En attente"
        : statut === "REJETE"
          ? "Rejeté"
          : "Non certifié";

  return (
    <GarageShell
      titre={reservation.codePublic}
      sousTitre={LIBELLES_STATUT[reservation.statut]}
      retour={{ to: "/garage/reservations", libelle: "Réservations" }}
    >
      <div className="garage-detail-grille">
        <section className="garage-panneau">
          <h2>Véhicule</h2>
          <p className="garage-panneau-titre">
            {vehicule.marque} {vehicule.modele}
          </p>
          <p className="garage-meta">
            {vehicule.codePublic} · {vehicule.ville}
          </p>
          <p className="garage-meta">
            {new Date(reservation.dateDebut).toLocaleString("fr-FR")} →{" "}
            {new Date(reservation.dateFin).toLocaleString("fr-FR")}
          </p>
          <p className="garage-ligne-montant">
            Bénéfice · {reservation.montantTotal.toLocaleString("fr-FR")} FCFA
          </p>
          <p className="garage-meta">Caution · {reservation.caution.toLocaleString("fr-FR")} FCFA</p>
          <Link to={`/vehicules/${vehicule.codePublic}`} className="garage-lien">
            Voir l’annonce →
          </Link>
        </section>

        <section className="garage-panneau">
          <h2>Client</h2>
          <p className="garage-panneau-titre">{locataire.nom}</p>
          <p className="garage-meta">{locataire.telephone}</p>
          <span className={`garage-badge garage-badge--${locataire.statutKyc.toLowerCase()}`}>
            {libelleKyc(locataire.statutKyc)}
          </span>
        </section>

        <section className="garage-panneau">
          <h2>Paiements</h2>
          {paiements.length === 0 && <p className="garage-meta">Aucun paiement.</p>}
          {paiements.map((p) => (
            <p key={p.reference} className="garage-meta">
              {p.montant.toLocaleString("fr-FR")} FCFA ·{" "}
              {p.moyen === "CASH" ? "Espèces" : p.moyen} ·{" "}
              {p.moyen === "CASH" && p.statut === "EN_ATTENTE" ? "À encaisser" : p.statut}
            </p>
          ))}
          {paiementCashEnAttente && (
            <button
              type="button"
              className="garage-btn garage-btn--principal garage-panneau-paiements-action"
              disabled={action}
              onClick={() => void encaisserCash()}
            >
              {action ? "En cours…" : "Confirmer le paiement en espèces reçu"}
            </button>
          )}
        </section>
      </div>

      {etatsDesLieux.length > 0 && (
        <section className="garage-panneau">
          <h2>États des lieux</h2>
          {etatsDesLieux.map((e, i) => (
            <p key={i} className="garage-meta">
              {e.type === "REMISE" ? "Remise" : "Retour"} —{" "}
              {new Date(e.horodatage).toLocaleString("fr-FR")}
              {e.notes ? ` — ${e.notes}` : ""}
            </p>
          ))}
        </section>
      )}

      {litige && (
        <section className="garage-panneau garage-panneau--alerte">
          <h2>Litige</h2>
          <p>{litige.description}</p>
          {litige.resolution && <p className="garage-meta">Résolution : {litige.resolution}</p>}
          {litige.montantPreleve != null && (
            <p className="garage-meta">
              Prélevé : {litige.montantPreleve.toLocaleString("fr-FR")} FCFA
            </p>
          )}
        </section>
      )}

      {erreur && <p className="message-erreur">{erreur}</p>}

      {reservation.statut === "DEMANDEE" && (
        <section className="garage-panneau garage-panneau--action garage-panneau--demande">
          <h2>Nouvelle demande de réservation</h2>
          <p className="garage-meta">
            Le client souhaite réserver ce véhicule du{" "}
            {new Date(reservation.dateDebut).toLocaleString("fr-FR")} au{" "}
            {new Date(reservation.dateFin).toLocaleString("fr-FR")}.
          </p>
          {!locataireCertifie && (
            <p className="message-erreur" role="alert">
              Attention : le client n'est pas encore certifié (KYC).
            </p>
          )}
          <label className="garage-champ">
            Motif de refus (obligatoire pour refuser)
            <textarea
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              rows={3}
              placeholder="Ex: Véhicule indisponible, client non certifié..."
            />
          </label>
          <div className="garage-carte-actions">
            <button
              type="button"
              className="garage-btn garage-btn--principal"
              disabled={action}
              onClick={() => void validerDemande()}
            >
              {action ? "Validation…" : "✓ Valider la demande"}
            </button>
            <button
              type="button"
              className="garage-btn garage-btn--danger"
              disabled={refus}
              onClick={() => void refuserDemande()}
            >
              {refus ? "Refus…" : "✗ Refuser la demande"}
            </button>
          </div>
        </section>
      )}

      {reservation.statut === "EN_ATTENTE_PAIEMENT" && (
        <section className="garage-panneau garage-panneau--action garage-panneau--attente">
          <h2>Demande validée — en attente de paiement</h2>
          <p className="garage-meta">
            Le client a été notifié. Il peut effectuer le paiement quand il le souhaite.
          </p>
          {!locataireCertifie && (
            <p className="message-erreur" role="alert">
              Attention : le client n'est pas encore certifié (KYC).
            </p>
          )}
        </section>
      )}

      {reservation.statut === "REFUSEE" && (
        <section className="garage-panneau garage-panneau--action garage-panneau--refusee">
          <h2>Demande refusée</h2>
          <p className="garage-meta">
            Cette demande a été refusée par le garage. Le client a été notifié.
          </p>
        </section>
      )}

      {reservation.statut === "EXPIREE" && (
        <section className="garage-panneau garage-panneau--action garage-panneau--expiree">
          <h2>Réservation expirée</h2>
          <p className="garage-meta">
            Cette réservation a expiré.
          </p>
        </section>
      )}

      {reservation.statut === "CONFIRMEE" && (
        <section className="garage-panneau garage-panneau--action">
          <h2>Remettre le véhicule</h2>
          {!locataireCertifie && (
            <p className="message-erreur" role="alert">
              Remise bloquée : le client n’est pas certifié.
            </p>
          )}
          <label className="garage-champ">
            Notes (optionnel)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>
          <div className="garage-carte-actions">
            <button
              type="button"
              className="garage-btn garage-btn--principal"
              disabled={action || !locataireCertifie}
              onClick={() => void remettre()}
            >
              {action ? "En cours…" : "Confirmer la remise"}
            </button>
            <button
              type="button"
              className="garage-btn garage-btn--fantome"
              disabled={refus}
              onClick={() => void refuserLocation()}
            >
              {refus ? "Refus…" : "Refuser la location"}
            </button>
          </div>
        </section>
      )}

      {reservation.statut === "EN_LOCATION" && (
        <section className="garage-panneau garage-panneau--action">
          <h2>Marquer le retour</h2>
          <label className="garage-champ">
            Notes (optionnel)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>
          <button
            type="button"
            className="garage-btn garage-btn--principal"
            disabled={action}
            onClick={() => void retourner()}
          >
            {action ? "En cours…" : "Confirmer le retour"}
          </button>
        </section>
      )}

      {reservation.statut === "INSPECTION" && (
        <section className="garage-panneau garage-panneau--action">
          <h2>Terminer l’inspection</h2>
          <label className="garage-champ">
            Description d’un éventuel litige
            <textarea
              value={descriptionLitige}
              onChange={(e) => setDescriptionLitige(e.target.value)}
              rows={3}
            />
          </label>
          <label className="garage-champ">
            Montant à prélever sur la caution (FCFA)
            <input
              type="number"
              value={montantPreleve}
              onChange={(e) => setMontantPreleve(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
            />
          </label>
          <div className="garage-carte-actions">
            <button
              type="button"
              className="garage-btn garage-btn--principal"
              disabled={action}
              onClick={() => void terminerInspection(false)}
            >
              Clôturer sans litige
            </button>
            <button
              type="button"
              className="garage-btn garage-btn--fantome"
              disabled={action || !descriptionLitige}
              onClick={() => void terminerInspection(true)}
            >
              Ouvrir un litige
            </button>
          </div>
        </section>
      )}

      {reservation.statut === "LITIGE" && (
        <section className="garage-panneau garage-panneau--action">
          <h2>Résoudre le litige</h2>
          <label className="garage-champ">
            Résolution
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              required
            />
          </label>
          <label className="garage-champ">
            Montant prélevé (FCFA)
            <input
              type="number"
              value={montantPreleve}
              onChange={(e) => setMontantPreleve(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
            />
          </label>
          <button
            type="button"
            className="garage-btn garage-btn--principal"
            disabled={action || !resolution}
            onClick={() => void resoudreLitige()}
          >
            {action ? "En cours…" : "Clôturer le litige"}
          </button>
        </section>
      )}
    </GarageShell>
  );
}
