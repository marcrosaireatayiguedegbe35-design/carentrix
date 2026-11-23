-- KYC obligatoire avant toute activité métier.
-- À exécuter dans Supabase Dashboard > SQL Editor (après schema_documents.sql).

-- ============================================================
-- Marquer le dossier "EN_ATTENTE" quand tous les documents requis sont déposés
-- ============================================================

create or replace function public.soumettre_dossier_verification()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_statut text;
  v_types_requis text[];
  v_manquants text[];
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select role, statut_kyc into v_role, v_statut
  from public.profiles
  where id = auth.uid();

  if v_role not in ('LOCATAIRE', 'PROPRIETAIRE') then
    raise exception 'Réservé aux locataires et propriétaires';
  end if;

  if v_statut = 'VERIFIE' then
    return 'VERIFIE';
  end if;

  v_types_requis := case
    when v_role = 'PROPRIETAIRE' then array['PIECE_IDENTITE', 'JUSTIFICATIF_PROPRIETE']
    when v_role = 'LOCATAIRE' then array['PIECE_IDENTITE', 'PERMIS_CONDUIRE', 'JUSTIFICATIF_RESIDENCE', 'PHOTO_PROFIL']
    else array[]::text[]
  end;

  select coalesce(array_agg(t), array[]::text[]) into v_manquants
  from unnest(v_types_requis) t
  where not exists (
    select 1 from public.documents_kyc d
    where d.utilisateur_id = auth.uid() and d.type = t
  );

  if array_length(v_manquants, 1) is not null then
    raise exception 'Documents manquants : %', array_to_string(v_manquants, ', ');
  end if;

  update public.profiles
  set statut_kyc = 'EN_ATTENTE'
  where id = auth.uid() and statut_kyc in ('NON_VERIFIE', 'REJETE', 'EN_ATTENTE');

  return 'EN_ATTENTE';
end;
$$;

grant execute on function public.soumettre_dossier_verification() to authenticated;

-- ============================================================
-- Réservation : KYC VERIFIE obligatoire
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
  v_statut_kyc text;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select role, statut_kyc into v_role, v_statut_kyc
  from public.profiles where id = auth.uid();

  if v_role <> 'LOCATAIRE' then
    raise exception 'Seuls les locataires peuvent réserver';
  end if;

  if v_statut_kyc <> 'VERIFIE' then
    raise exception 'Dossier KYC non validé par le garage. Déposez vos documents et attendez la validation avant de réserver.';
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
      and statut in ('EN_ATTENTE','CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
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
-- Dépôt véhicule : KYC VERIFIE obligatoire pour le propriétaire
-- ============================================================

create or replace function public.exiger_kyc_avant_vehicule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
  v_role text;
begin
  -- Seeds / SQL admin : pas de session utilisateur
  if auth.uid() is null then
    return new;
  end if;

  select role, statut_kyc into v_role, v_statut
  from public.profiles where id = auth.uid();

  if tg_op in ('INSERT', 'UPDATE') and v_role = 'PROPRIETAIRE' and coalesce(v_statut, '') <> 'VERIFIE' then
    raise exception 'Dossier KYC non validé par le garage. Déposez vos documents et attendez la validation avant toute activité sur vos véhicules.';
  end if;

  return new;
end;
$$;

drop trigger if exists exige_kyc_vehicule on public.vehicules;
create trigger exige_kyc_vehicule
  before insert or update on public.vehicules
  for each row execute function public.exiger_kyc_avant_vehicule();

-- ============================================================
-- Paiement : KYC VERIFIE obligatoire
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
  v_statut_kyc text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select statut_kyc into v_statut_kyc
  from public.profiles where id = auth.uid();

  if coalesce(v_statut_kyc, '') <> 'VERIFIE' then
    raise exception 'Dossier KYC non validé par le garage. Aucune activité n''est possible avant validation.';
  end if;

  if p_moyen not in ('MTN_MOMO','MOOV_MONEY','CARTE') then
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
  values (v_reservation.id, v_montant, p_moyen, 'REUSSI', v_reference);

  update public.reservations set statut = 'CONFIRMEE' where id = v_reservation.id;

  return query select v_reference, v_montant, 'CONFIRMEE'::text;
end;
$$;

grant execute on function public.payer_reservation(text, text) to authenticated;
