-- Nettoyage des réservations de test et de tout ce qui en dépend.
--
-- ATTENTION : suppression DÉFINITIVE. Ce projet Supabase n'a aucune
-- sauvegarde configurée à ce jour — il n'y a aucun moyen de revenir en
-- arrière après exécution. Vérifiez d'abord le nombre de lignes concernées
-- avec la requête de contrôle ci-dessous si vous avez un doute.
--
-- Ne touche pas aux véhicules (table vehicules) ni aux comptes (profiles) —
-- seules les réservations et ce qui en dépend directement sont supprimés.
-- conversations/messages sont liés aux réservations avec "on delete cascade"
-- (schema_messagerie.sql) : ils sont donc effacés automatiquement en même
-- temps que les réservations, pas besoin d'un delete séparé.

-- ============================================================
-- Contrôle avant suppression (optionnel — à exécuter séparément si besoin)
-- ============================================================
-- select
--   (select count(*) from public.reservations) as reservations,
--   (select count(*) from public.paiements) as paiements,
--   (select count(*) from public.litiges) as litiges,
--   (select count(*) from public.etats_des_lieux) as etats_des_lieux,
--   (select count(*) from public.avis) as avis,
--   (select count(*) from public.journal_acces_identite) as journal_acces_identite;

-- ============================================================
-- Suppression (ordre imposé par les clés étrangères)
-- ============================================================

delete from public.journal_acces_identite;
delete from public.avis;
delete from public.litiges;
delete from public.etats_des_lieux;
delete from public.paiements;
delete from public.reservations;
