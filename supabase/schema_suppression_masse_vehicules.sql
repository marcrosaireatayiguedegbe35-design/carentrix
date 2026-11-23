-- Suppression définitive de tous les véhicules du catalogue N'AYANT AUCUNE réservation.
-- Les véhicules avec un historique de réservations sont conservés mais mis hors ligne
-- (disponible = false), conformément à la règle appliquée par garage_supprimer_vehicule
-- dans schema_suppression_vehicule.sql : impossible de supprimer un véhicule qui a un
-- historique de réservations.
--
-- À exécuter manuellement dans Supabase Dashboard > SQL Editor du projet "location"
-- (ref swpvaiefvizohhykidpc). Script volontairement non automatisé : à lancer soi-même
-- après vérification du résultat de l'étape 1.

-- 1. Aperçu avant suppression
select
  count(*) as total_vehicules,
  count(*) filter (
    where id in (select distinct vehicule_id from public.reservations)
  ) as avec_reservations_conserves,
  count(*) filter (
    where id not in (select distinct vehicule_id from public.reservations)
  ) as sans_reservation_a_supprimer
from public.vehicules;

-- 2. Mettre hors ligne les véhicules ayant un historique (non supprimables)
update public.vehicules
set disponible = false
where id in (select distinct vehicule_id from public.reservations);

-- 3. Supprimer définitivement les véhicules sans aucune réservation
delete from public.vehicules
where id not in (select distinct vehicule_id from public.reservations);
