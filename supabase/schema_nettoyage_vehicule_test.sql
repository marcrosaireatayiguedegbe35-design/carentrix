-- Nettoyage complet d'un véhicule de test et de tout son historique lié
-- (réservations, paiements, états des lieux, litiges, avis, journal d'accès).
-- À utiliser en phase de test uniquement : ceci supprime définitivement des
-- lignes réelles (paiements FedaPay compris) sans possibilité de retour en arrière.
--
-- À exécuter manuellement dans Supabase Dashboard > SQL Editor du projet "location".
-- Remplace l'UUID ci-dessous si besoin.

do $$
declare
  v_vehicule_id uuid := '729cd8e8-ed19-4841-bb08-95c867569ec4';
begin
  -- Paiements liés aux réservations de ce véhicule
  delete from public.paiements
  where reservation_id in (select id from public.reservations where vehicule_id = v_vehicule_id);

  -- États des lieux liés
  delete from public.etats_des_lieux
  where reservation_id in (select id from public.reservations where vehicule_id = v_vehicule_id);

  -- Litiges liés
  delete from public.litiges
  where reservation_id in (select id from public.reservations where vehicule_id = v_vehicule_id);

  -- Avis liés (si la table existe déjà sur cette base)
  if to_regclass('public.avis') is not null then
    delete from public.avis
    where reservation_id in (select id from public.reservations where vehicule_id = v_vehicule_id);
  end if;

  -- Journal d'accès identité côté garage (si la table existe déjà sur cette base)
  if to_regclass('public.journal_acces_identite') is not null then
    delete from public.journal_acces_identite
    where reservation_id in (select id from public.reservations where vehicule_id = v_vehicule_id);
  end if;

  -- messagerie : déjà en "on delete cascade" sur reservation_id, se vide automatiquement

  -- Réservations du véhicule
  delete from public.reservations where vehicule_id = v_vehicule_id;

  -- Le véhicule lui-même
  delete from public.vehicules where id = v_vehicule_id;
end $$;
