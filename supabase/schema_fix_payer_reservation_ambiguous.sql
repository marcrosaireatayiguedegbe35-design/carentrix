-- Corrige l'erreur "column reference "statut" is ambiguous" au moment de
-- payer une réservation (tous moyens de paiement, pas seulement Espèces).
--
-- payer_reservation() retourne une colonne "statut" (RETURNS TABLE(..., statut
-- text)) et référence aussi reservations.statut sans le qualifier : Postgres ne
-- sait plus lequel des deux "statut" est visé. creer_reservation() avait déjà
-- reçu la directive #variable_conflict use_column pour ce même problème ;
-- payer_reservation() ne l'avait jamais eue.
--
-- Reprend aussi la vérification de conflit chauffeur ajoutée par
-- schema_reservation_avec_chauffeur.sql, absente de la version cash.
--
-- À exécuter dans Supabase Dashboard > SQL Editor, après schema_paiement_cash.sql.

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

  if v_reservation.statut <> 'EN_ATTENTE' then
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

  -- Espèces : à régler au garage ; en ligne : considéré réglé immédiatement
  v_statut_paiement := case when p_moyen = 'CASH' then 'EN_ATTENTE' else 'REUSSI' end;

  insert into public.paiements(reservation_id, montant, moyen, statut, reference)
  values (v_reservation.id, v_montant, p_moyen, v_statut_paiement, v_reference);

  update public.reservations set statut = 'CONFIRMEE' where id = v_reservation.id;

  return query select v_reference, v_montant, 'CONFIRMEE'::text;
end;
$$;

grant execute on function public.payer_reservation(text, text) to authenticated;
