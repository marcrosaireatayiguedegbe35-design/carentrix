-- 1) Corrige l'annulation d'une réservation par le client.
--    annuler_reservation() retourne des colonnes "code_public" et "statut" qui
--    portent le même nom que celles de la table : sans la directive
--    #variable_conflict use_column, Postgres lève "column reference is ambiguous".
-- 2) Supprime le délai de 24h : une réservation validée par le garage reste
--    payable tant que le client ne l'annule pas.
--
-- À exécuter dans Supabase Dashboard > SQL Editor, après schema_validation_garage.sql.

create or replace function public.annuler_reservation(
  p_code_reservation text
)
returns table(code_public text, statut text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_reservation public.reservations%rowtype;
  v_conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_reservation
  from public.reservations r
  where r.code_public = p_code_reservation and r.locataire_id = auth.uid();

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut not in ('DEMANDEE','EN_ATTENTE_PAIEMENT','EN_ATTENTE','CONFIRMEE') then
    raise exception 'Cette réservation ne peut plus être annulée';
  end if;

  update public.reservations set statut = 'ANNULEE' where id = v_reservation.id;

  update public.conversations
  set fermee_at = coalesce(fermee_at, now()),
      motif_fermeture = coalesce(motif_fermeture, 'ANNULATION_LOCATAIRE')
  where reservation_id = v_reservation.id
  returning id into v_conv_id;

  if v_conv_id is not null then
    insert into public.messages (conversation_id, auteur_id, contenu, systeme)
    values (
      v_conv_id,
      null,
      'Le locataire a annulé la réservation. La conversation est fermée.',
      true
    );
  end if;

  return query select p_code_reservation, 'ANNULEE'::text;
end;
$$;

grant execute on function public.annuler_reservation(text) to authenticated;

-- payer_reservation sans délai de 24h
create or replace function public.payer_reservation(
  p_code_reservation text,
  p_moyen text
)
returns table(reference text, montant int, statut text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_reservation public.reservations%rowtype;
  v_montant int;
  v_reference text;
  v_statut_paiement text;
  v_conflit boolean;
  v_conflit_chauffeur boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if p_moyen not in ('MTN_MOMO', 'MOOV_MONEY', 'CARTE', 'CASH', 'FEDAPAY') then
    raise exception 'Moyen de paiement invalide';
  end if;

  select * into v_reservation
  from public.reservations
  where code_public = p_code_reservation and locataire_id = auth.uid()
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut = 'DEMANDEE' then
    raise exception 'Cette demande doit d''abord être validée par le garage';
  end if;

  if v_reservation.statut not in ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE') then
    raise exception 'Cette réservation n''est plus en attente de paiement';
  end if;

  select exists(
    select 1 from public.reservations
    where vehicule_id = v_reservation.vehicule_id
      and id <> v_reservation.id
      and statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
      and date_debut < v_reservation.date_fin
      and date_fin > v_reservation.date_debut
  ) into v_conflit;

  if v_conflit then
    update public.reservations set statut = 'ANNULEE' where id = v_reservation.id;
    raise exception 'Ce créneau vient d''être réservé par un autre locataire. Votre réservation a été annulée.';
  end if;

  if v_reservation.chauffeur_id is not null then
    select exists(
      select 1 from public.reservations
      where chauffeur_id = v_reservation.chauffeur_id
        and id <> v_reservation.id
        and statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
        and date_debut < v_reservation.date_fin
        and date_fin > v_reservation.date_debut
    ) into v_conflit_chauffeur;

    if v_conflit_chauffeur then
      update public.reservations set statut = 'ANNULEE' where id = v_reservation.id;
      raise exception 'Ce chauffeur vient d''être réservé sur ces dates. Votre réservation a été annulée.';
    end if;
  end if;

  v_montant := v_reservation.montant_total + v_reservation.caution;
  v_reference := 'PAY-' || extract(epoch from now())::bigint || '-' || floor(1000 + random() * 9000)::int;

  v_statut_paiement := case when p_moyen = 'CASH' then 'EN_ATTENTE' else 'REUSSI' end;

  insert into public.paiements(reservation_id, montant, moyen, statut, reference)
  values (v_reservation.id, v_montant, p_moyen, v_statut_paiement, v_reference);

  update public.reservations set statut = 'CONFIRMEE' where id = v_reservation.id;

  return query select v_reference, v_montant, 'CONFIRMEE'::text;
end;
$$;

grant execute on function public.payer_reservation(text, text) to authenticated;

-- Fin de l'expiration automatique : arrêt de la tâche planifiée et suppression
-- de la fonction (sans erreur si pg_cron ou la tâche n'existent pas).
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule('expirer-reservations-attente-paiement');
  end if;
exception when others then
  null;
end $$;

drop function if exists public.expirer_reservations_en_attente_paiement();
