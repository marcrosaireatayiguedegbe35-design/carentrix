-- Chauffeur optionnel sur une réservation de véhicule (plus de mission autonome).
-- À exécuter dans Supabase Dashboard > SQL Editor.
--
-- Flux : réserver une voiture → cocher / choisir un chauffeur → payer le total (véhicule + chauffeur).

-- ============================================================
-- Colonnes sur reservations
-- ============================================================

alter table public.reservations
  add column if not exists chauffeur_id uuid references public.profiles(id),
  add column if not exists montant_chauffeur int not null default 0 check (montant_chauffeur >= 0);

create index if not exists reservations_chauffeur_idx
  on public.reservations (chauffeur_id, date_debut)
  where chauffeur_id is not null;

-- ============================================================
-- Retirer l'engagement chauffeur sans véhicule (tables / RPCs)
-- ============================================================

drop function if exists public.creer_mission_chauffeur(text, timestamptz, text, int);
drop function if exists public.payer_mission_chauffeur(text, text);
drop function if exists public.annuler_mission_chauffeur(text);
drop function if exists public.detail_chauffeur_public(text);

drop view if exists public.mes_missions_chauffeur;

-- Ne pas supprimer missions_recues_chauffeur ici : elle est redéfinie plus bas
-- sur les réservations véhicule.

drop table if exists public.paiements_mission cascade;
drop table if exists public.missions_chauffeur cascade;

-- ============================================================
-- Vitrine chauffeurs (stats via réservations véhicules)
-- ============================================================

drop function if exists public.chauffeurs_disponibles(int);

create or replace function public.chauffeurs_disponibles(p_limite int default 8)
returns table (
  id uuid,
  prenom text,
  annees_experience int,
  tarif_journalier int,
  missions_terminees bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(p.pseudo, 'Chauffeur') as prenom,
    p.annees_experience,
    p.tarif_journalier_chauffeur as tarif_journalier,
    (
      select count(*)::bigint
      from public.reservations r
      where r.chauffeur_id = p.id
        and r.statut in ('CLOTUREE', 'RETOURNE')
    ) as missions_terminees
  from public.profiles p
  where p.role = 'CHAUFFEUR'
    and p.statut_kyc = 'VERIFIE'
    and p.disponible_chauffeur = true
    and p.tarif_journalier_chauffeur is not null
  order by p.tarif_journalier_chauffeur asc, coalesce(p.pseudo, p.nom) asc
  limit greatest(1, least(coalesce(p_limite, 8), 60));
$$;

grant execute on function public.chauffeurs_disponibles(int) to anon, authenticated;

-- ============================================================
-- Création réservation + chauffeur optionnel
-- ============================================================

drop function if exists public.creer_reservation(text, timestamptz, timestamptz);

create or replace function public.creer_reservation(
  p_code_vehicule text,
  p_date_debut timestamptz,
  p_date_fin timestamptz,
  p_pseudo_chauffeur text default null
)
returns table(
  code_public text,
  statut text,
  montant_total int,
  caution int,
  unites int,
  unite_tarif text,
  montant_chauffeur int,
  chauffeur_pseudo text
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
  v_montant_vehicule int;
  v_montant_chauffeur int := 0;
  v_caution int;
  v_code text;
  v_role text;
  v_chauffeur public.profiles%rowtype;
  v_jours_chauffeur int;
  v_chevauche_chauffeur boolean;
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
  v_montant_vehicule := v_unites * v_vehicule.prix_unitaire;
  v_caution := greatest(10000, round(v_montant_vehicule * 0.2));

  if p_pseudo_chauffeur is not null and trim(p_pseudo_chauffeur) <> '' then
    select * into v_chauffeur
    from public.profiles
    where role = 'CHAUFFEUR'
      and statut_kyc = 'VERIFIE'
      and disponible_chauffeur = true
      and tarif_journalier_chauffeur is not null
      and lower(coalesce(pseudo, '')) = lower(trim(p_pseudo_chauffeur));

    if not found then
      raise exception 'Chauffeur indisponible';
    end if;

    select exists(
      select 1 from public.reservations r
      where r.chauffeur_id = v_chauffeur.id
        and r.statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
        and r.date_debut < p_date_fin
        and r.date_fin > p_date_debut
    ) into v_chevauche_chauffeur;

    if v_chevauche_chauffeur then
      raise exception 'Ce chauffeur n''est plus disponible sur cette période';
    end if;

    -- Facturation chauffeur au jour civil couvert (min. 1 jour)
    v_jours_chauffeur := greatest(1, ceil(extract(epoch from (p_date_fin - p_date_debut)) / 86400.0)::int);
    v_montant_chauffeur := v_jours_chauffeur * v_chauffeur.tarif_journalier_chauffeur;
  end if;

  v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  while exists(select 1 from public.reservations where code_public = v_code) loop
    v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  end loop;

  insert into public.reservations(
    code_public, vehicule_id, locataire_id, date_debut, date_fin, statut,
    montant_total, caution, chauffeur_id, montant_chauffeur
  ) values (
    v_code, v_vehicule.id, auth.uid(), p_date_debut, p_date_fin, 'EN_ATTENTE',
    v_montant_vehicule + v_montant_chauffeur, v_caution,
    case when v_montant_chauffeur > 0 then v_chauffeur.id else null end,
    v_montant_chauffeur
  );

  return query select
    v_code,
    'EN_ATTENTE'::text,
    v_montant_vehicule + v_montant_chauffeur,
    v_caution,
    v_unites,
    v_vehicule.unite_tarif,
    v_montant_chauffeur,
    case when v_montant_chauffeur > 0 then v_chauffeur.pseudo else null end;
end;
$$;

grant execute on function public.creer_reservation(text, timestamptz, timestamptz, text) to authenticated;

-- ============================================================
-- Paiement : vérifier aussi le chauffeur au moment de finaliser
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
  v_statut_paiement := case when p_moyen = 'CASH' then 'EN_ATTENTE' else 'REUSSI' end;

  insert into public.paiements(reservation_id, montant, moyen, statut, reference)
  values (v_reservation.id, v_montant, p_moyen, v_statut_paiement, v_reference);

  update public.reservations set statut = 'CONFIRMEE' where id = v_reservation.id;

  return query select v_reference, v_montant, 'CONFIRMEE'::text;
end;
$$;

grant execute on function public.payer_reservation(text, text) to authenticated;

-- ============================================================
-- Vues
-- ============================================================

drop view if exists public.mes_reservations;
create view public.mes_reservations as
select
  r.code_public,
  r.statut,
  r.date_debut,
  r.date_fin,
  r.montant_total,
  r.caution,
  v.code_public as vehicule_code,
  v.marque,
  v.modele,
  v.ville,
  v.photos,
  coalesce(r.montant_chauffeur, 0) as montant_chauffeur,
  c.pseudo as chauffeur_pseudo
from public.reservations r
join public.vehicules v on v.id = r.vehicule_id
left join public.profiles c on c.id = r.chauffeur_id
where r.locataire_id = auth.uid();

grant select on public.mes_reservations to authenticated;

drop view if exists public.missions_recues_chauffeur;
create view public.missions_recues_chauffeur as
select
  r.code_public,
  r.statut,
  r.date_debut,
  r.date_fin,
  r.montant_chauffeur as montant_total,
  v.marque || ' ' || v.modele as vehicule,
  v.code_public as vehicule_code,
  coalesce(l.pseudo, 'Client') as client_pseudo
from public.reservations r
join public.vehicules v on v.id = r.vehicule_id
join public.profiles l on l.id = r.locataire_id
where r.chauffeur_id = auth.uid()
  and r.statut <> 'ANNULEE';

grant select on public.missions_recues_chauffeur to authenticated;

-- Refus chauffeur = retirer le chauffeur de la réservation (véhicule reste)
create or replace function public.chauffeur_refuser_reservation(p_code_reservation text)
returns table (code_public text, statut text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_reservation
  from public.reservations
  where code_public = p_code_reservation
    and chauffeur_id = auth.uid()
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut not in ('CONFIRMEE') then
    raise exception 'Vous ne pouvez refuser que tant que le véhicule n''a pas été remis';
  end if;

  update public.reservations
  set chauffeur_id = null,
      montant_total = montant_total - coalesce(montant_chauffeur, 0),
      montant_chauffeur = 0
  where id = v_reservation.id;

  return query select p_code_reservation, v_reservation.statut;
end;
$$;

grant execute on function public.chauffeur_refuser_reservation(text) to authenticated;
