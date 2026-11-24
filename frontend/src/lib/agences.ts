import { supabase } from "./supabaseClient";

export type StatutAgence = "ACTIF" | "SUSPENDU" | "EN_ATTENTE";
export type MoyenReversement = "MTN_MOMO" | "MOOV_MONEY" | "CELTIIS" | "VIREMENT";
export type SensReversement = "PLATEFORME_VERS_AGENCE" | "AGENCE_VERS_PLATEFORME";
export type TypeMouvement =
  | "PART_AGENCE_EN_LIGNE"
  | "COMMISSION_ESPECES"
  | "ANNULATION_PAIEMENT"
  | "REVERSEMENT"
  | "REGLEMENT_COMMISSION"
  | "AJUSTEMENT";

export interface Agence {
  id: string;
  nom: string;
  responsableNom: string;
  adresse: string;
  ville: string;
  email: string | null;
  telephone: string | null;
  tauxCommission: number;
  statut: StatutAgence;
  reversementMoyen: MoyenReversement | null;
  reversementNumero: string | null;
  createdAt: string;
}

export interface SoldeAgence {
  agenceId: string;
  /** > 0 : la plateforme doit cette somme à l'agence ; < 0 : l'agence la doit à la plateforme. */
  solde: number;
  totalPartsEnLigne: number;
  totalCommissionsEspeces: number;
  totalReverse: number;
  totalCommissionsReglees: number;
}

export interface MouvementAgence {
  id: string;
  type: TypeMouvement;
  montant: number;
  libelle: string | null;
  createdAt: string;
}

export const LIBELLES_STATUT_AGENCE: Record<StatutAgence, string> = {
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  EN_ATTENTE: "En attente",
};

export const LIBELLES_MOYEN_REVERSEMENT: Record<MoyenReversement, string> = {
  MTN_MOMO: "MTN MoMo",
  MOOV_MONEY: "Moov Money",
  CELTIIS: "Celtiis Cash",
  VIREMENT: "Virement bancaire",
};

export const LIBELLES_MOUVEMENT: Record<TypeMouvement, string> = {
  PART_AGENCE_EN_LIGNE: "Paiement en ligne",
  COMMISSION_ESPECES: "Commission sur espèces",
  ANNULATION_PAIEMENT: "Remboursement",
  REVERSEMENT: "Reversement reçu",
  REGLEMENT_COMMISSION: "Commission réglée",
  AJUSTEMENT: "Ajustement",
};

export function formaterFcfa(montant: number) {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

export function mapperAgence(a: Record<string, unknown>): Agence {
  return {
    id: a.id as string,
    nom: a.nom as string,
    responsableNom: (a.responsable_nom as string) ?? "",
    adresse: (a.adresse as string) ?? "",
    ville: (a.ville as string) ?? "",
    email: (a.email as string | null) ?? null,
    telephone: (a.telephone as string | null) ?? null,
    tauxCommission: Number(a.taux_commission),
    statut: a.statut as StatutAgence,
    reversementMoyen: (a.reversement_moyen as MoyenReversement | null) ?? null,
    reversementNumero: (a.reversement_numero as string | null) ?? null,
    createdAt: a.created_at as string,
  };
}

export function mapperSolde(s: Record<string, unknown>): SoldeAgence {
  return {
    agenceId: s.agence_id as string,
    solde: Number(s.solde),
    totalPartsEnLigne: Number(s.total_parts_en_ligne),
    totalCommissionsEspeces: Number(s.total_commissions_especes),
    totalReverse: Number(s.total_reverse),
    totalCommissionsReglees: Number(s.total_commissions_reglees),
  };
}

export async function chargerMouvements(agenceId: string, limite = 50): Promise<MouvementAgence[]> {
  const { data, error } = await supabase
    .from("mouvements_agence")
    .select("id, type, montant, libelle, created_at")
    .eq("agence_id", agenceId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    type: m.type as TypeMouvement,
    montant: Number(m.montant),
    libelle: (m.libelle as string | null) ?? null,
    createdAt: m.created_at as string,
  }));
}

/** Phrase lisible pour un solde, du point de vue de l'admin ou de l'agence. */
export function libelleSolde(solde: number, pointDeVue: "admin" | "agence") {
  if (solde === 0) return "Aucun montant en attente";
  if (solde > 0) {
    return pointDeVue === "admin"
      ? `La plateforme doit ${formaterFcfa(solde)} à l'agence`
      : `Carentrix vous doit ${formaterFcfa(solde)}`;
  }
  return pointDeVue === "admin"
    ? `L'agence doit ${formaterFcfa(-solde)} à la plateforme`
    : `Vous devez ${formaterFcfa(-solde)} de commission à Carentrix`;
}

/** Fiche de l'agence connectée (la RLS ne renvoie que la sienne). */
export async function chargerMonAgence(): Promise<{ agence: Agence; solde: SoldeAgence | null }> {
  const [resAgence, resSolde] = await Promise.all([
    supabase.from("agences").select("*").eq("est_plateforme", false).maybeSingle(),
    supabase.from("soldes_agences").select("*").maybeSingle(),
  ]);
  if (resAgence.error) throw new Error(resAgence.error.message);
  if (!resAgence.data) throw new Error("Aucune agence n'est rattachée à ce compte. Contactez l'administration Carentrix.");
  return {
    agence: mapperAgence(resAgence.data),
    solde: resSolde.data ? mapperSolde(resSolde.data) : null,
  };
}

export interface ReservationAgence {
  codePublic: string;
  statut: string;
  dateDebut: string;
  dateFin: string;
  montantTotal: number;
  caution: number;
  tauxCommission: number;
  montantCommission: number;
  montantAgence: number;
  vehiculeCode: string;
  marque: string;
  modele: string;
  clientNom: string | null;
  clientTelephone: string | null;
  paiementMoyen: string | null;
  paiementStatut: string | null;
  createdAt: string;
}

export async function chargerReservationsAgence(): Promise<ReservationAgence[]> {
  const { data, error } = await supabase.rpc("agence_mes_reservations");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    codePublic: r.code_public as string,
    statut: r.statut as string,
    dateDebut: r.date_debut as string,
    dateFin: r.date_fin as string,
    montantTotal: Number(r.montant_total),
    caution: Number(r.caution),
    tauxCommission: Number(r.taux_commission),
    montantCommission: Number(r.montant_commission),
    montantAgence: Number(r.montant_agence),
    vehiculeCode: r.vehicule_code as string,
    marque: r.marque as string,
    modele: r.modele as string,
    clientNom: (r.client_nom as string | null) ?? null,
    clientTelephone: (r.client_telephone as string | null) ?? null,
    paiementMoyen: (r.paiement_moyen as string | null) ?? null,
    paiementStatut: (r.paiement_statut as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Statuts d'une location réellement engagée (comptée dans les revenus). */
export const STATUTS_ENGAGES = ["CONFIRMEE", "VEHICULE_REMIS", "EN_LOCATION", "RETOURNE", "INSPECTION", "LITIGE", "CLOTUREE"];
export const STATUTS_ACTIFS = ["CONFIRMEE", "VEHICULE_REMIS", "EN_LOCATION"];
