import type { StatutReservation } from "../types";

/** Statuts d'une réservation où l'argent a déjà été encaissé : tout sauf
 * EN_ATTENTE (pas encore payé) et ANNULEE (annulé). */
export const STATUTS_COMPTABILISES: StatutReservation[] = [
  "CONFIRMEE",
  "VEHICULE_REMIS",
  "EN_LOCATION",
  "RETOURNE",
  "INSPECTION",
  "LITIGE",
  "CLOTUREE",
];

/** Montant à retenir pour le chiffre d'affaires / bénéfice d'une réservation :
 * le prix de la location, plus un éventuel prélèvement sur la caution pour litige. */
export function montantEffectif(montantTotal: number, montantPreleve: number | null | undefined) {
  return montantTotal + (montantPreleve ?? 0);
}
