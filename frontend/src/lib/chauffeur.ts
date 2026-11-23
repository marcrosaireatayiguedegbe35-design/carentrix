/** Supplément (FCFA) facturé au locataire qui ajoute un chauffeur à un
 * véhicule où celui-ci est facultatif — montant par jour (ou par heure sur un
 * véhicule tarifé à l'heure), multiplié par le nombre d'unités de la location.
 * Doit rester synchronisé avec la constante `c_supplement_chauffeur` de
 * `creer_reservation` côté base de données (voir
 * supabase/schema_supplement_chauffeur_par_jour.sql). */
export const SUPPLEMENT_CHAUFFEUR_FCFA = 5000;
