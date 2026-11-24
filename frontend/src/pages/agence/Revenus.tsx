import { useEffect, useState } from "react";
import { GarageShell } from "../../components/GarageShell";
import { ListeMouvements } from "../../components/ListeMouvements";
import {
  LIBELLES_MOYEN_REVERSEMENT,
  chargerMonAgence,
  chargerMouvements,
  formaterFcfa,
  libelleSolde,
} from "../../lib/agences";
import type { Agence, MouvementAgence, SoldeAgence } from "../../lib/agences";

export function RevenusAgence() {
  const [agence, setAgence] = useState<Agence | null>(null);
  const [solde, setSolde] = useState<SoldeAgence | null>(null);
  const [mouvements, setMouvements] = useState<MouvementAgence[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    chargerMonAgence()
      .then(async ({ agence: a, solde: s }) => {
        setAgence(a);
        setSolde(s);
        setMouvements(await chargerMouvements(a.id, 200));
      })
      .catch((err) => setErreur(err instanceof Error ? err.message : "Chargement impossible"));
  }, []);

  const valeur = solde?.solde ?? 0;

  return (
    <GarageShell
      titre="Revenus & transactions"
      sousTitre={
        agence
          ? `Commission Carentrix : ${agence.tauxCommission} % du prix de location · votre part : ${Math.round((100 - agence.tauxCommission) * 100) / 100} %`
          : undefined
      }
    >
      {erreur && <p className="message-erreur">{erreur}</p>}

      <section className="kc-grille" aria-label="Synthèse financière">
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Paiements en ligne (votre part)</span>
            <span className="kc-valeur">{solde ? formaterFcfa(solde.totalPartsEnLigne) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Commissions sur espèces</span>
            <span className="kc-valeur">{solde ? formaterFcfa(solde.totalCommissionsEspeces) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Déjà reçu de Carentrix</span>
            <span className="kc-valeur">{solde ? formaterFcfa(solde.totalReverse) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Commissions déjà réglées</span>
            <span className="kc-valeur">{solde ? formaterFcfa(solde.totalCommissionsReglees) : "…"}</span>
          </div>
        </div>
      </section>

      {agence && (
        <section className={`garage-panneau${valeur < 0 ? " garage-panneau--alerte" : ""}`}>
          <h2>Solde</h2>
          <p>
            <strong>{libelleSolde(valeur, "agence")}</strong>
          </p>
          <p className="garage-meta">
            {valeur > 0 &&
              (agence.reversementMoyen
                ? `Le reversement sera effectué sur votre compte ${LIBELLES_MOYEN_REVERSEMENT[agence.reversementMoyen]}${
                    agence.reversementNumero ? ` (${agence.reversementNumero})` : ""
                  }.`
                : "Aucun compte de reversement n'est enregistré : communiquez-le à l'administration Carentrix.")}
            {valeur < 0 && "Ce montant correspond aux commissions sur les locations que vous avez encaissées en espèces."}
          </p>
        </section>
      )}

      <section className="garage-panneau">
        <h2>Historique</h2>
        <p className="garage-meta">
          « + » : somme que Carentrix vous doit · « − » : commission due à Carentrix ou reversement déjà reçu.
        </p>
        <ListeMouvements mouvements={mouvements} />
      </section>
    </GarageShell>
  );
}
