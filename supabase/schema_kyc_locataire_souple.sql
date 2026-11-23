-- Locataire : réservation et paiement possibles sans dossier certifié.
-- La remise du véhicule au garage exige un locataire CERTIFIÉ (statut_kyc = VERIFIE).
-- À exécuter dans Supabase Dashboard > SQL Editor (après schema_kyc_obligatoire.sql).

-- ============================================================
-- Réservation : plus de blocage KYC pour le locataire
-- ============================================================

create or replace function public.creer_reservation(
  p_code_vehicule text,
  p_date_debut timestamptz,
  p_date_fin timestamptz
)
returns table(
  code_public text,
  statut text,
  montant_total int,
  caution int,
  unites int,
  unite_tarif text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_vehicule public.vehicules%rowtype;
  v_conflit boolean;
  v_unites int;
  v_montant int;
  v_caution int;
  v_code text;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select role into v_role from public.profiles where id = auth.uid();

  if v_role <> 'LOCATAIRE' then
    raise exception 'Seuls les locataires peuvent réserver';
  end if;

  if p_date_debut is null or p_date_fin is null or p_date_debut >= p_date_fin then
    raise exception 'Plage de dates invalide';
  end if;

  select * into v_vehicule
  from public.vehicules
  where code_public = p_code_vehicule and disponible = true and controle_technique_ok = true;

  if not found then
    raise exception 'Véhicule indisponible';
  end if;

  select exists(
    select 1 from public.reservations
    where vehicule_id = v_vehicule.id
      and statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
      and date_debut < p_date_fin
      and date_fin > p_date_debut
  ) into v_conflit;

  if v_conflit then
    raise exception 'Ce véhicule n''est plus disponible sur cette période';
  end if;

  if v_vehicule.unite_tarif = 'HEURE' then
    v_unites := ceil(extract(epoch from (p_date_fin - p_date_debut)) / 3600.0);
  else
    v_unites := ceil(extract(epoch from (p_date_fin - p_date_debut)) / 86400.0);
  end if;
  v_montant := v_unites * v_vehicule.prix_unitaire;
  v_caution := greatest(10000, round(v_montant * 0.2));

  v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  while exists(select 1 from public.reservations where code_public = v_code) loop
    v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  end loop;

  insert into public.reservations(code_public, vehicule_id, locataire_id, date_debut, date_fin, statut, montant_total, caution)
  values (v_code, v_vehicule.id, auth.uid(), p_date_debut, p_date_fin, 'EN_ATTENTE', v_montant, v_caution);

  return query select v_code, 'EN_ATTENTE'::text, v_montant, v_caution, v_unites, v_vehicule.unite_tarif;
end;
$$;

grant execute on function public.creer_reservation(text, timestamptz, timestamptz) to authenticated;

-- ============================================================
-- Paiement : autorisé même si le locataire n'est pas encore certifié
-- ============================================================

create or replace function public.payer_reservation(
  p_code_reservation text,
  p_moyen text
)
returns table(reference text, montant int, statut text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_montant int;
  v_reference text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if p_moyen not in ('MTN_MOMO','MOOV_MONEY','CARTE','CASH','FEDAPAY') then
    raise exception 'Moyen de paiement invalide';
  end if;

  select * into v_reservation
  from public.reservations
  where code_public = p_code_reservation and locataire_id = auth.uid();

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut <> 'EN_ATTENTE' then
    raise exception 'Cette réservation n''est plus en attente de paiement';
  end if;

  v_montant := v_reservation.montant_total + v_reservation.caution;
  v_reference := 'PAY-' || extract(epoch from now())::bigint || '-' || floor(1000 + random() * 9000)::int;

  insert into public.paiements(reservation_id, montant, moyen, statut, reference)
  values (
    v_reservation.id,
    v_montant,
    p_moyen,
    case when p_moyen = 'CASH' then 'EN_ATTENTE' else 'REUSSI' end,
    v_reference
  );

  update public.reservations set statut = 'CONFIRMEE' where id = v_reservation.id;

  return query select v_reference, v_montant, 'CONFIRMEE'::text;
end;
$$;

grant execute on function public.payer_reservation(text, text) to authenticated;

-- ============================================================
-- Remise garage : locataire CERTIFIÉ obligatoire
-- ============================================================

create or replace function public.garage_remettre_vehicule(
  p_code_reservation text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_statut text;
  v_locataire_id uuid;
  v_statut_kyc text;
begin
  if not est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  select id, statut, locataire_id
  into v_id, v_statut, v_locataire_id
  from public.reservations
  where code_public = p_code_reservation;

  if v_id is null then
    raise exception 'Réservation introuvable';
  end if;

  if v_statut <> 'CONFIRMEE' then
    raise exception 'Cette réservation n''est pas prête pour la remise du véhicule';
  end if;

  select statut_kyc into v_statut_kyc
  from public.profiles
  where id = v_locataire_id;

  if coalesce(v_statut_kyc, '') <> 'VERIFIE' then
    raise exception 'Remise impossible : le locataire n''est pas certifié. Il doit déposer ses pièces et être validé par le garage.';
  end if;

  update public.reservations set statut = 'EN_LOCATION' where id = v_id;
  insert into public.etats_des_lieux (reservation_id, type, notes)
  values (v_id, 'REMISE', p_notes);
end;
$$;

grant execute on function public.garage_remettre_vehicule(text, text) to authenticated;
