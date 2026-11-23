import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GarageShell } from "../../components/GarageShell";
import { montantEffectif, STATUTS_COMPTABILISES } from "../../lib/comptabilite";
import { supabase } from "../../lib/supabaseClient";
import type { StatutReservation } from "../../types";

const LIBELLES_STATUT: Record<StatutReservation, string> = {
  DEMANDEE: "Nouvelle demande",
  EN_ATTENTE_PAIEMENT: "En attente paiement",
  REFUSEE: "Refusée",
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

type LigneJournal = {
  codePublic: string;
  statut: StatutReservation;
  dateDebut: string;
  dateFin: string;
  montantTotal: number;
  coutTotal: number | null;
  caution: number;
  vehiculeCode: string;
  marque: string;
  modele: string;
  ville: string;
  locataireNom: string;
  locatairePseudo: string;
  locataireTelephone: string;
  remiseLe: string | null;
  retourLe: string | null;
  paiementMoyen: string | null;
  paiementStatut: string | null;
  litige: { description: string; resolution: string | null; montantPreleve: number | null } | null;
};

function formaterFcfa(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function formaterDateHeure(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("fr-FR");
}

function debutDuMois() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function JournalLocationsGarage() {
  const [lignes, setLignes] = useState<LigneJournal[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"toutes" | "litige">("toutes");

  useEffect(() => {
    let annule = false;

    async function charger() {
      setChargement(true);

      const { data, error } = await supabase
        .from("reservations")
        .select(
          [
            "code_public",
            "statut",
            "locataire_id",
            "date_debut",
            "date_fin",
            "montant_total",
            "cout_total",
            "caution",
            "vehicules(code_public, marque, modele, ville)",
            "paiements(moyen, statut, created_at)",
            "litiges(description, resolution, montant_preleve)",
            "etats_des_lieux(type, horodatage)",
          ].join(", ")
        )
        .in("statut", STATUTS_COMPTABILISES)
        .order("date_debut", { ascending: false });

      if (annule) return;
      if (error || !data) {
        console.error(error);
        setLignes([]);
        setChargement(false);
        return;
      }

      const brut = data as unknown as Record<string, unknown>[];
      const locataireIds = Array.from(new Set(brut.map((r) => r.locataire_id as string)));
      const { data: profils } = locataireIds.length
        ? await supabase.from("profiles").select("id, nom, pseudo, telephone").in("id", locataireIds)
        : { data: [] as Record<string, unknown>[] };
      const profilsParId = new Map((profils ?? []).map((p: Record<string, unknown>) => [p.id as string, p]));

      if (annule) return;

      setLignes(
        brut.map((r) => {
          const vehicule = r.vehicules as
            | { code_public?: string; marque?: string; modele?: string; ville?: string }
            | null;
          const profil = profilsParId.get(r.locataire_id as string) as Record<string, unknown> | undefined;
          const paiements = (r.paiements as { moyen: string; statut: string; created_at: string }[] | null) ?? [];
          const paiement = paiements.find((p) => p.statut === "REUSSI") ?? paiements[0];
          const etats = (r.etats_des_lieux as { type: string; horodatage: string }[] | null) ?? [];
          const remise = etats.find((e) => e.type === "REMISE")?.horodatage ?? null;
          const retour = etats.find((e) => e.type === "RETOUR")?.horodatage ?? null;
          const litigeBrut = r.litiges as
            | { description: string; resolution: string | null; montant_preleve: number | null }
            | { description: string; resolution: string | null; montant_preleve: number | null }[]
            | null;
          const litige = Array.isArray(litigeBrut) ? (litigeBrut[0] ?? null) : litigeBrut;

          return {
            codePublic: r.code_public as string,
            statut: r.statut as StatutReservation,
            dateDebut: r.date_debut as string,
            dateFin: r.date_fin as string,
            montantTotal: Number(r.montant_total) || 0,
            coutTotal: r.cout_total == null ? null : Number(r.cout_total),
            caution: Number(r.caution) || 0,
            vehiculeCode: vehicule?.code_public ?? "",
            marque: vehicule?.marque ?? "",
            modele: vehicule?.modele ?? "",
            ville: vehicule?.ville ?? "",
            locataireNom: (profil?.nom as string) ?? "",
            locatairePseudo: (profil?.pseudo as string) ?? "",
            locataireTelephone: (profil?.telephone as string) ?? "",
            remiseLe: remise,
            retourLe: retour,
            paiementMoyen: paiement?.moyen ?? null,
            paiementStatut: paiement?.statut ?? null,
            litige: litige
              ? {
                  description: litige.description,
                  resolution: litige.resolution,
                  montantPreleve: litige.montant_preleve,
                }
              : null,
          };
        })
      );
      setChargement(false);
    }

    void charger();
    return () => {
      annule = true;
    };
  }, []);

  const lignesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter((l) => {
      if (filtre === "litige" && !l.litige) return false;
      if (!q) return true;
      return [
        l.codePublic,
        l.marque,
        l.modele,
        l.vehiculeCode,
        l.locataireNom,
        l.locatairePseudo,
        l.locataireTelephone,
      ].some((champ) => (champ ?? "").toLowerCase().includes(q));
    });
  }, [lignes, recherche, filtre]);

  const stats = useMemo(() => {
    const debutMois = debutDuMois();
    const connues = lignes.filter((l) => l.coutTotal != null);
    const connuesMois = connues.filter((l) => new Date(l.dateDebut) >= debutMois);

    const somme = (arr: LigneJournal[], champ: (l: LigneJournal) => number) =>
      arr.reduce((s, l) => s + champ(l), 0);
    const montant = (l: LigneJournal) => montantEffectif(l.montantTotal, l.litige?.montantPreleve);

    const caConnuTotal = somme(connues, montant);
    const beneficeTotal = somme(connues, (l) => montant(l) - (l.coutTotal ?? 0));
    const caConnuMois = somme(connuesMois, montant);
    const beneficeMois = somme(connuesMois, (l) => montant(l) - (l.coutTotal ?? 0));

    return {
      commandes: lignes.length,
      avecLitige: lignes.filter((l) => l.litige).length,
      sansCout: lignes.length - connues.length,
      chiffreAffairesTotal: somme(lignes, montant),
      coutTotal: somme(connues, (l) => l.coutTotal ?? 0),
      beneficeTotal,
      beneficeMois,
      margeTotal: caConnuTotal > 0 ? Math.round((beneficeTotal / caConnuTotal) * 100) : null,
      margeMois: caConnuMois > 0 ? Math.round((beneficeMois / caConnuMois) * 100) : null,
    };
  }, [lignes]);

  return (
    <GarageShell
      titre="Journal des locations"
      sousTitre="Historique détaillé de toutes les réservations facturées (payées)."
    >
      <div className="garage-kpis">
        <div className="garage-kpi garage-kpi--accent">
          <span className="garage-kpi-label">Bénéfice net (total)</span>
          <span className="garage-kpi-valeur">{chargement ? "…" : formaterFcfa(stats.beneficeTotal)}</span>
        </div>
        <div className="garage-kpi">
          <span className="garage-kpi-label">Bénéfice net (ce mois-ci)</span>
          <span className="garage-kpi-valeur">{chargement ? "…" : formaterFcfa(stats.beneficeMois)}</span>
        </div>
        <div className="garage-kpi">
          <span className="garage-kpi-label">Chiffre d’affaires</span>
          <span className="garage-kpi-valeur">{chargement ? "…" : formaterFcfa(stats.chiffreAffairesTotal)}</span>
        </div>
        <div className="garage-kpi">
          <span className="garage-kpi-label">Coût fournisseurs</span>
          <span className="garage-kpi-valeur">{chargement ? "…" : formaterFcfa(stats.coutTotal)}</span>
        </div>
        <div className="garage-kpi">
          <span className="garage-kpi-label">Marge</span>
          <span className="garage-kpi-valeur">
            {chargement || stats.margeTotal === null ? "…" : `${stats.margeTotal} %`}
          </span>
        </div>
        <div className="garage-kpi">
          <span className="garage-kpi-label">Réservations facturées</span>
          <span className="garage-kpi-valeur">{chargement ? "…" : stats.commandes}</span>
        </div>
      </div>

      {!chargement && stats.sansCout > 0 && (
        <p className="garage-meta garage-meta--interne">
          {stats.sansCout} commande{stats.sansCout > 1 ? "s" : ""} sans coût fournisseur renseigné — exclue
          {stats.sansCout > 1 ? "s" : ""} du calcul du bénéfice et de la marge (le chiffre d’affaires, lui, les
          inclut toutes).
        </p>
      )}

      <div className="garage-recherche">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (code, véhicule, client, téléphone)"
          aria-label="Rechercher dans le journal"
        />
      </div>

      <div className="garage-onglets" role="tablist">
        {(
          [
            ["toutes", "Toutes"],
            ["litige", "Avec litige"],
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
      {!chargement && lignesFiltrees.length === 0 && (
        <div className="garage-vide">
          <p>
            {lignes.length === 0
              ? "Aucune réservation facturée pour le moment."
              : "Aucun résultat pour cette recherche."}
          </p>
        </div>
      )}

      <ul className="garage-liste">
        {lignesFiltrees.map((l) => (
          <li key={l.codePublic}>
            <Link to={`/garage/reservations/${l.codePublic}`} className="garage-ligne">
              <div className="garage-ligne-principal">
                <strong>{l.codePublic}</strong>
                <span className={`garage-badge${l.litige ? " garage-badge--litige" : ""}`}>
                  {l.statut === "LITIGE"
                    ? "Litige en cours"
                    : l.litige
                      ? "Litige résolu"
                      : LIBELLES_STATUT[l.statut]}
                </span>
              </div>
              <p className="garage-meta">
                {l.marque} {l.modele} ({l.vehiculeCode}) · {l.ville}
              </p>
              <p className="garage-meta">
                Client · {l.locatairePseudo || l.locataireNom || "—"} · {l.locataireTelephone}
              </p>
              <p className="garage-meta">
                {new Date(l.dateDebut).toLocaleDateString("fr-FR")} →{" "}
                {new Date(l.dateFin).toLocaleDateString("fr-FR")}
                {l.remiseLe ? ` · remis le ${formaterDateHeure(l.remiseLe)}` : ""}
                {l.retourLe ? ` · retourné le ${formaterDateHeure(l.retourLe)}` : ""}
              </p>
              {l.paiementMoyen && (
                <p className="garage-meta">
                  Paiement · {l.paiementMoyen === "CASH" ? "Espèces" : l.paiementMoyen} · {l.paiementStatut}
                </p>
              )}
              <p className="garage-ligne-montant">
                {formaterFcfa(montantEffectif(l.montantTotal, l.litige?.montantPreleve))} · caution{" "}
                {formaterFcfa(l.caution)}
              </p>
              <p className="garage-meta garage-meta--interne">
                {l.coutTotal != null
                  ? `Bénéfice · ${formaterFcfa(montantEffectif(l.montantTotal, l.litige?.montantPreleve) - l.coutTotal)} (coût ${formaterFcfa(l.coutTotal)})`
                  : "Bénéfice non calculable — coût fournisseur non renseigné"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </GarageShell>
  );
}
