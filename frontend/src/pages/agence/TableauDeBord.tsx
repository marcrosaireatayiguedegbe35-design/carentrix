import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import {
  LIBELLES_STATUT_AGENCE,
  STATUTS_ACTIFS,
  STATUTS_ENGAGES,
  chargerMonAgence,
  chargerReservationsAgence,
  formaterFcfa,
  libelleSolde,
} from "../../lib/agences";
import type { Agence, ReservationAgence, SoldeAgence } from "../../lib/agences";

type Etat = {
  agence: Agence;
  solde: SoldeAgence | null;
  reservations: ReservationAgence[];
  vehiculesEnLigne: number;
  vehiculesAValider: number;
};

export function TableauDeBordAgence() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      chargerMonAgence(),
      chargerReservationsAgence(),
      supabase.from("vehicules").select("disponible, controle_technique_ok"),
    ])
      .then(([{ agence, solde }, reservations, resVehicules]) => {
        const vehicules = (resVehicules.data ?? []) as { disponible: boolean; controle_technique_ok: boolean }[];
        setEtat({
          agence,
          solde,
          reservations,
          vehiculesEnLigne: vehicules.filter((v) => v.disponible && v.controle_technique_ok).length,
          vehiculesAValider: vehicules.filter((v) => v.disponible && !v.controle_technique_ok).length,
        });
      })
      .catch((err) => setErreur(err instanceof Error ? err.message : "Chargement impossible"));
  }, []);

  if (erreur) {
    return (
      <GarageShell titre="Tableau de bord">
        <p className="message-erreur">{erreur}</p>
      </GarageShell>
    );
  }

  const engagees = etat?.reservations.filter((r) => STATUTS_ENGAGES.includes(r.statut)) ?? [];
  const chiffreAffaires = engagees.reduce((t, r) => t + r.montantTotal, 0);
  const revenusAgence = engagees.reduce((t, r) => t + r.montantAgence, 0);
  const commissions = engagees.reduce((t, r) => t + r.montantCommission, 0);
  const actives = etat?.reservations.filter((r) => STATUTS_ACTIFS.includes(r.statut)).length ?? 0;

  return (
    <GarageShell
      titre={etat ? etat.agence.nom : "Tableau de bord"}
      sousTitre={
        etat
          ? `Partenariat ${LIBELLES_STATUT_AGENCE[etat.agence.statut].toLowerCase()} · commission Carentrix ${etat.agence.tauxCommission} %`
          : "Chargement…"
      }
      actions={
        <Link to="/agence/vehicules/nouveau" className="garage-btn garage-btn--principal">
          Ajouter un véhicule
        </Link>
      }
    >
      {etat && etat.agence.statut !== "ACTIF" && (
        <section className="garage-panneau garage-panneau--alerte">
          <p>
            Votre partenariat est <strong>{LIBELLES_STATUT_AGENCE[etat.agence.statut].toLowerCase()}</strong> : vos
            véhicules ne sont pas visibles au catalogue. Contactez l'administration Carentrix.
          </p>
        </section>
      )}

      <section className="kc-grille" aria-label="Indicateurs">
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Vos revenus (part agence)</span>
            <span className="kc-valeur">{etat ? formaterFcfa(revenusAgence) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Chiffre d'affaires généré</span>
            <span className="kc-valeur">{etat ? formaterFcfa(chiffreAffaires) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Commissions Carentrix</span>
            <span className="kc-valeur">{etat ? formaterFcfa(commissions) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Locations confirmées</span>
            <span className="kc-valeur">{etat ? engagees.length : "…"}</span>
          </div>
        </div>
      </section>

      {etat && (
        <section className="garage-panneau">
          <h2>Solde</h2>
          <p className="garage-meta">
            <strong>{libelleSolde(etat.solde?.solde ?? 0, "agence")}</strong>
          </p>
          <Link to="/agence/revenus" className="garage-btn garage-btn--fantome">
            Voir les transactions
          </Link>
        </section>
      )}

      {etat && (
        <section className="tb-activite" aria-label="Activité en cours">
          <Link to="/agence/reservations" className="tb-puce">
            <strong>{actives}</strong> location{actives > 1 ? "s" : ""} en cours
          </Link>
          <Link to="/agence/vehicules" className="tb-puce">
            <strong>{etat.vehiculesEnLigne}</strong> véhicule{etat.vehiculesEnLigne > 1 ? "s" : ""} en ligne
          </Link>
          {etat.vehiculesAValider > 0 && (
            <Link to="/agence/vehicules" className="tb-puce tb-puce--alerte">
              <strong>{etat.vehiculesAValider}</strong> en attente de validation
            </Link>
          )}
        </section>
      )}
    </GarageShell>
  );
}
