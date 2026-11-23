import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconeCalendrier,
  IconePerformance,
  IconePieces,
  IconeTableauDeBord,
} from "../../components/GarageIcones";
import { GarageShell } from "../../components/GarageShell";
import { BarresCommandes, CourbeFinances } from "../../components/GraphiquesTableauDeBord";
import type { MoisFinance } from "../../components/GraphiquesTableauDeBord";
import { montantEffectif, STATUTS_COMPTABILISES } from "../../lib/comptabilite";
import { supabase } from "../../lib/supabaseClient";

interface Etat {
  beneficeNetTotal: number;
  chiffreAffairesTotal: number;
  margeTotale: number | null;
  commandesTotal: number;
  mois: MoisFinance[];
  reservationsActives: number;
  vehiculesEnLigne: number;
  kycEnAttente: number;
  litigesOuverts: number;
}

function formaterFcfa(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function sixDerniersMois() {
  const maintenant = new Date();
  const tranches: { debut: Date; fin: Date; libelle: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() - i + 1, 1);
    tranches.push({
      debut,
      fin,
      libelle: debut.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
    });
  }
  return tranches;
}

export function TableauDeBordGarage() {
  const [etat, setEtat] = useState<Etat | null>(null);

  useEffect(() => {
    async function charger() {
      const [kyc, enLigne, actives, litiges, cloturees] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .neq("role", "GARAGE")
          .in("statut_kyc", ["NON_VERIFIE", "EN_ATTENTE"]),
        supabase.from("vehicules").select("id", { count: "exact", head: true }).eq("disponible", true),
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .in("statut", ["CONFIRMEE", "VEHICULE_REMIS", "EN_LOCATION", "INSPECTION"]),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("statut", "LITIGE"),
        supabase
          .from("reservations")
          .select("montant_total, cout_total, date_debut, litiges(montant_preleve)")
          .in("statut", STATUTS_COMPTABILISES),
      ]);

      const commandes = ((cloturees.data ?? []) as unknown as {
        montant_total: number;
        cout_total: number | null;
        date_debut: string;
        litiges: { montant_preleve: number | null } | { montant_preleve: number | null }[] | null;
      }[]).map((c) => {
        const litige = Array.isArray(c.litiges) ? (c.litiges[0] ?? null) : c.litiges;
        return {
          montant: montantEffectif(c.montant_total, litige?.montant_preleve),
          coutTotal: c.cout_total,
          dateDebut: c.date_debut,
        };
      });
      const connues = commandes.filter((c) => c.coutTotal != null);

      const chiffreAffairesTotal = commandes.reduce((s, c) => s + c.montant, 0);
      const caConnuTotal = connues.reduce((s, c) => s + c.montant, 0);
      const beneficeNetTotal = connues.reduce((s, c) => s + (c.montant - (c.coutTotal ?? 0)), 0);

      const tranches = sixDerniersMois();
      const mois: MoisFinance[] = tranches.map(({ debut, fin, libelle }) => {
        const duMois = commandes.filter((c) => {
          const d = new Date(c.dateDebut);
          return d >= debut && d < fin;
        });
        const duMoisConnues = duMois.filter((c) => c.coutTotal != null);
        return {
          libelle,
          chiffreAffaires: duMois.reduce((s, c) => s + c.montant, 0),
          beneficeNet: duMoisConnues.reduce((s, c) => s + (c.montant - (c.coutTotal ?? 0)), 0),
          commandes: duMois.length,
        };
      });

      setEtat({
        beneficeNetTotal,
        chiffreAffairesTotal,
        margeTotale: caConnuTotal > 0 ? Math.round((beneficeNetTotal / caConnuTotal) * 100) : null,
        commandesTotal: commandes.length,
        mois,
        reservationsActives: actives.count ?? 0,
        vehiculesEnLigne: enLigne.count ?? 0,
        kycEnAttente: kyc.count ?? 0,
        litigesOuverts: litiges.count ?? 0,
      });
    }
    void charger();
  }, []);

  return (
    <GarageShell
      titre="Pilotage"
      sousTitre="Vue d’ensemble de votre activité."
      actions={
        <Link to="/garage/vehicules/nouveau" className="garage-btn garage-btn--principal">
          Publier un véhicule
        </Link>
      }
    >
      <section className="kc-grille" aria-label="Indicateurs">
        <div className="kc">
          <span className="kc-ico kc-ico--rouge">
            <IconePerformance taille={26} />
          </span>
          <div className="kc-corps">
            <span className="kc-label">Bénéfice net total</span>
            <span className="kc-valeur">{etat ? formaterFcfa(etat.beneficeNetTotal) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <span className="kc-ico kc-ico--noir">
            <IconePieces taille={26} />
          </span>
          <div className="kc-corps">
            <span className="kc-label">Chiffre d’affaires</span>
            <span className="kc-valeur">{etat ? formaterFcfa(etat.chiffreAffairesTotal) : "…"}</span>
          </div>
        </div>
        <div className="kc">
          <span className="kc-ico kc-ico--ambre">
            <IconeTableauDeBord taille={26} />
          </span>
          <div className="kc-corps">
            <span className="kc-label">Marge</span>
            <span className="kc-valeur">
              {etat && etat.margeTotale !== null ? `${etat.margeTotale} %` : "…"}
            </span>
          </div>
        </div>
        <div className="kc">
          <span className="kc-ico kc-ico--gris">
            <IconeCalendrier taille={26} />
          </span>
          <div className="kc-corps">
            <span className="kc-label">Commandes effectuées</span>
            <span className="kc-valeur">{etat?.commandesTotal ?? "…"}</span>
          </div>
        </div>
      </section>

      {etat && (
        <section className="tb-graphiques" aria-label="Graphiques">
          <CourbeFinances mois={etat.mois} />
          <BarresCommandes mois={etat.mois} />
        </section>
      )}

      {etat && (
        <section className="tb-activite" aria-label="Activité en cours">
          <Link to="/garage/reservations" className="tb-puce">
            <strong>{etat.reservationsActives}</strong> location{etat.reservationsActives > 1 ? "s" : ""} active
            {etat.reservationsActives > 1 ? "s" : ""}
          </Link>
          <Link to="/garage/vehicules" className="tb-puce">
            <strong>{etat.vehiculesEnLigne}</strong> véhicule{etat.vehiculesEnLigne > 1 ? "s" : ""} en ligne
          </Link>
          <Link to="/garage/utilisateurs" className="tb-puce">
            <strong>{etat.kycEnAttente}</strong> dossier{etat.kycEnAttente > 1 ? "s" : ""} à vérifier
          </Link>
          {etat.litigesOuverts > 0 && (
            <Link to="/garage/reservations" className="tb-puce tb-puce--alerte">
              <strong>{etat.litigesOuverts}</strong> litige{etat.litigesOuverts > 1 ? "s" : ""} ouvert
              {etat.litigesOuverts > 1 ? "s" : ""}
            </Link>
          )}
        </section>
      )}
    </GarageShell>
  );
}
