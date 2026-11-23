import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import type { ReservationGarage, StatutReservation } from "../../types";

const LIBELLES_STATUT: Record<StatutReservation, string> = {
  DEMANDEE: "Nouvelle demande",
  EN_ATTENTE_PAIEMENT: "En attente paiement",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée",
  EN_ATTENTE: "En attente",
  CONFIRMEE: "À remettre",
  VEHICULE_REMIS: "Remis",
  EN_LOCATION: "En location",
  RETOURNE: "Retourné",
  INSPECTION: "Inspection",
  LITIGE: "Litige",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
};

type Filtre = "toutes" | "actives" | "demandes" | "attente" | "litige";

export function ReservationsGarage() {
  const [reservations, setReservations] = useState<ReservationGarage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("reservations")
      .select("code_public, statut, date_debut, date_fin, montant_total, created_at, vehicules(code_public, marque, modele)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) {
          setReservations(
            (data ?? []).map((r: Record<string, unknown>) => {
              const v = r.vehicules as {
                code_public?: string;
                marque?: string;
                modele?: string;
              } | null;
              return {
                codePublic: r.code_public as string,
                statut: r.statut as StatutReservation,
                dateDebut: r.date_debut as string,
                dateFin: r.date_fin as string,
                montantTotal: r.montant_total as number,
                vehiculeCode: v?.code_public ?? "",
                marque: v?.marque ?? "",
                modele: v?.modele ?? "",
              };
            })
          );
        }
        setChargement(false);
      });
  }, []);

  function rechercherCode(e: FormEvent) {
    e.preventDefault();
    if (recherche.trim()) {
      navigate(`/garage/reservations/${recherche.trim().toUpperCase()}`);
    }
  }

  const listes = useMemo(() => {
    return reservations.filter((r) => {
      if (filtre === "actives") {
        return ["CONFIRMEE", "VEHICULE_REMIS", "EN_LOCATION", "INSPECTION"].includes(r.statut);
      }
      if (filtre === "demandes") return r.statut === "DEMANDEE";
      if (filtre === "attente") return r.statut === "EN_ATTENTE_PAIEMENT";
      if (filtre === "litige") return r.statut === "LITIGE";
      return true;
    });
  }, [reservations, filtre]);

  return (
    <GarageShell titre="Réservations" sousTitre="Suivi des locations, remises et retours.">
      <form className="garage-recherche" onSubmit={rechercherCode}>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Code réservation (ex. RES-1234)"
          aria-label="Rechercher une réservation"
        />
        <button type="submit" className="garage-btn garage-btn--principal">
          Ouvrir
        </button>
      </form>

      <div className="garage-onglets" role="tablist">
        {(
          [
            ["toutes", "Toutes"],
            ["demandes", "Nouvelles demandes"],
            ["actives", "Actives"],
            ["attente", "En attente paiement"],
            ["litige", "Litiges"],
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

      {chargement && <p className="garage-etat">Chargement…</p>}
      {!chargement && listes.length === 0 && (
        <div className="garage-vide">
          <p>Aucune réservation dans ce filtre.</p>
        </div>
      )}

      <ul className="garage-liste">
        {listes.map((r) => (
          <li key={r.codePublic}>
            <Link to={`/garage/reservations/${r.codePublic}`} className="garage-ligne">
              <div className="garage-ligne-principal">
                <strong>{r.codePublic}</strong>
                <span className={`garage-badge garage-badge--${r.statut.toLowerCase()}`}>
                  {LIBELLES_STATUT[r.statut]}
                </span>
              </div>
              <p className="garage-meta">
                {r.marque} {r.modele} ({r.vehiculeCode})
              </p>
              <p className="garage-meta">
                {new Date(r.dateDebut).toLocaleString("fr-FR")} →{" "}
                {new Date(r.dateFin).toLocaleString("fr-FR")}
              </p>
              {!["EN_ATTENTE", "DEMANDEE", "EN_ATTENTE_PAIEMENT", "REFUSEE", "EXPIREE", "ANNULEE"].includes(r.statut) && (
                <p className="garage-ligne-montant">
                  Bénéfice · {r.montantTotal.toLocaleString("fr-FR")} FCFA
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </GarageShell>
  );
}
