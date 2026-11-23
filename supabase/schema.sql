-- Plateforme béninoise de location de véhicules — schéma initial
-- À exécuter dans Supabase Dashboard > SQL Editor (projet cible), une seule fois.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('PROPRIETAIRE', 'LOCATAIRE', 'GARAGE')),
  nom text not null,
  telephone text not null unique,
  statut_kyc text not null default 'NON_VERIFIE' check (statut_kyc in ('NON_VERIFIE','EN_ATTENTE','VERIFIE','REJETE')),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicules (
  id uuid primary key default gen_random_uuid(),
  code_public text not null unique,
  proprietaire_id uuid not null references public.profiles(id),
  marque text not null,
  modele text not null,
  annee int not null,
  transmission text not null check (transmission in ('MANUELLE','AUTOMATIQUE')),
  categorie text not null check (categorie in ('CITADINE','BERLINE','SUV','MINIBUS','PICKUP')),
  ville text not null,
  prix_journalier int not null check (prix_journalier > 0),
  photos text not null default '',
  disponible boolean not null default true,
  controle_technique_ok boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  code_public text not null unique,
  vehicule_id uuid not null references public.vehicules(id),
  locataire_id uuid not null references public.profiles(id),
  date_debut date not null,
  date_fin date not null,
  statut text not null default 'DEMANDEE' check (statut in (
    'DEMANDEE','EN_ATTENTE_PAIEMENT','REFUSEE','EXPIREE','CONFIRMEE','VEHICULE_REMIS','EN_LOCATION','RETOURNE','INSPECTION','LITIGE','CLOTUREE','ANNULEE'
  )),
  montant_total int not null,
  caution int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_fin > date_debut)
);

create or replace function public.update_reservation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_update_reservation_updated_at on public.reservations;
create trigger trigger_update_reservation_updated_at
  before update on public.reservations
  for each row execute function public.update_reservation_updated_at();

create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  montant int not null,
  moyen text not null check (moyen in ('MTN_MOMO','MOOV_MONEY','CARTE')),
  statut text not null default 'EN_ATTENTE' check (statut in ('EN_ATTENTE','REUSSI','ECHOUE','REMBOURSE')),
  reference text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.etats_des_lieux (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  type text not null check (type in ('REMISE','RETOUR')),
  horodatage timestamptz not null default now(),
  notes text
);

create table if not exists public.litiges (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id),
  description text not null,
  resolution text,
  montant_preleve int,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Vue publique des véhicules : n'expose jamais proprietaire_id
-- ============================================================

create or replace view public.vehicules_publics as
select id, code_public, marque, modele, annee, transmission, categorie, ville, prix_journalier, photos, disponible
from public.vehicules
where disponible = true and controle_technique_ok = true;

grant select on public.vehicules_publics to anon, authenticated;

-- ============================================================
-- Vue "mes réservations" : filtrée explicitement sur l'utilisateur connecté
-- ============================================================

create or replace view public.mes_reservations as
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
  v.photos
from public.reservations r
join public.vehicules v on v.id = r.vehicule_id
where r.locataire_id = auth.uid();

grant select on public.mes_reservations to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.vehicules enable row level security;
alter table public.reservations enable row level security;
alter table public.paiements enable row level security;
alter table public.etats_des_lieux enable row level security;
alter table public.litiges enable row level security;

-- profiles : chacun ne voit / modifie que sa propre fiche
create policy "profil_lecture_propre" on public.profiles
  for select using (id = auth.uid());
create policy "profil_maj_propre" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- vehicules : aucun accès direct pour l'espace locataire (passe par la vue vehicules_publics
-- et les fonctions ci-dessous). L'espace Propriétaire (phase suivante) ajoutera une policy
-- "proprietaire_id = auth.uid()" pour la gestion de ses propres véhicules.

-- reservations : un locataire voit uniquement ses propres réservations.
-- Aucune policy insert/update : toute écriture passe par les fonctions SECURITY DEFINER
-- ci-dessous, qui valident les règles métier (disponibilité, montant, transitions de statut).
create policy "reservations_lecture_propre" on public.reservations
  for select using (locataire_id = auth.uid());

-- paiements : visible uniquement par le locataire propriétaire de la réservation associée.
create policy "paiements_lecture_propre" on public.paiements
  for select using (
    exists (
      select 1 from public.reservations r
      where r.id = paiements.reservation_id and r.locataire_id = auth.uid()
    )
  );

-- ============================================================
-- Création automatique du profil à l'inscription (auth.users -> profiles)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, nom, telephone, statut_kyc)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'LOCATAIRE'),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'telephone', new.id::text),
    'NON_VERIFIE'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Fonctions métier (SECURITY DEFINER) : seul point d'écriture pour les
-- réservations et paiements, afin que le prix et les transitions de statut
-- ne soient jamais calculés côté client.
-- ============================================================

create or replace function public.rechercher_vehicules(
  p_ville text default null,
  p_categorie text default null,
  p_transmission text default null,
  p_date_debut date default null,
  p_date_fin date default null
)
returns setof public.vehicules_publics
language sql
security definer
set search_path = public
stable
as $$
  select vp.*
  from public.vehicules_publics vp
  where (p_ville is null or vp.ville = p_ville)
    and (p_categorie is null or vp.categorie = p_categorie)
    and (p_transmission is null or vp.transmission = p_transmission)
    and (
      p_date_debut is null or p_date_fin is null or not exists (
        select 1 from public.reservations r
        join public.vehicules v on v.id = r.vehicule_id
        where v.code_public = vp.code_public
          and r.statut in ('DEMANDEE','EN_ATTENTE_PAIEMENT','CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
          and r.date_debut < p_date_fin
          and r.date_fin > p_date_debut
      )
    );
$$;

grant execute on function public.rechercher_vehicules(text, text, text, date, date) to anon, authenticated;

create or replace function public.creer_reservation(
  p_code_vehicule text,
  p_date_debut date,
  p_date_fin date
)
returns table(code_public text, statut text, montant_total int, caution int, nuits int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicule public.vehicules%rowtype;
  v_conflit boolean;
  v_nuits int;
  v_montant int;
  v_caution int;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
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

  -- Conflit sur demandes en cours, en attente paiement, confirmées ou en cours
  select exists(
    select 1 from public.reservations
    where vehicule_id = v_vehicule.id
      and statut in ('DEMANDEE','EN_ATTENTE_PAIEMENT','CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
      and date_debut < p_date_fin
      and date_fin > p_date_debut
  ) into v_conflit;

  if v_conflit then
    raise exception 'Ce véhicule n''est plus disponible sur cette période';
  end if;

  v_nuits := p_date_fin - p_date_debut;
  v_montant := v_nuits * v_vehicule.prix_journalier;
  v_caution := greatest(10000, round(v_montant * 0.2));

  v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  while exists(select 1 from public.reservations where code_public = v_code) loop
    v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  end loop;

  -- Statut DEMANDEE par défaut (défini dans la table)
  insert into public.reservations(code_public, vehicule_id, locataire_id, date_debut, date_fin, montant_total, caution)
  values (v_code, v_vehicule.id, auth.uid(), p_date_debut, p_date_fin, v_montant, v_caution);

  return query select v_code, 'DEMANDEE'::text, v_montant, v_caution, v_nuits;
end;
$$;

grant execute on function public.creer_reservation(text, date, date) to authenticated;

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
  v_conflit_confirme boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
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

  -- Accepter EN_ATTENTE_PAIEMENT (après validation garage) ou DEMANDEE (ancien flux auto)
  if v_reservation.statut not in ('EN_ATTENTE_PAIEMENT','DEMANDEE') then
    raise exception 'Cette réservation n''est plus en attente de paiement';
  end if;

  -- Vérifier si une autre réservation CONFIRMEE existe déjà sur ce véhicule/période
  -- (double sécurité : garage a déjà validé, mais on vérifie quand même)
  select exists(
    select 1 from public.reservations
    where vehicule_id = v_reservation.vehicule_id
      and statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
      and date_debut < v_reservation.date_fin
      and date_fin > v_reservation.date_debut
      and id <> v_reservation.id
  ) into v_conflit_confirme;

  if v_conflit_confirme then
    update public.reservations set statut = 'EXPIREE' where id = v_reservation.id;
    raise exception 'Ce véhicule vient d''être réservé par un autre client. Votre réservation a expiré.';
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

create or replace function public.annuler_reservation(
  p_code_reservation text
)
returns table(code_public text, statut text)
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
  where code_public = p_code_reservation and locataire_id = auth.uid();

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut not in ('DEMANDEE','EN_ATTENTE_PAIEMENT','CONFIRMEE') then
    raise exception 'Cette réservation ne peut plus être annulée';
  end if;

  update public.reservations set statut = 'ANNULEE' where id = v_reservation.id;

  return query select p_code_reservation, 'ANNULEE'::text;
end;
$$;

grant execute on function public.annuler_reservation(text) to authenticated;

-- ============================================================
-- Validation garage des demandes de réservation
-- ============================================================

create or replace function public.garage_valider_demande(p_code_reservation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_vehicule public.vehicules%rowtype;
  v_conflit boolean;
begin
  if not public.est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  select * into v_reservation
  from public.reservations
  where code_public = p_code_reservation;

  if v_reservation is null then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut <> 'DEMANDEE' then
    raise exception 'Seules les demandes en attente peuvent être validées';
  end if;

  -- Double vérification : véhicule encore dispo sur la période
  select * into v_vehicule from public.vehicules where id = v_reservation.vehicule_id;

  select exists(
    select 1 from public.reservations
    where vehicule_id = v_vehicule.id
      and statut in ('DEMANDEE','EN_ATTENTE_PAIEMENT','CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
      and date_debut < v_reservation.date_fin
      and date_fin > v_reservation.date_debut
      and id <> v_reservation.id
  ) into v_conflit;

  if v_conflit then
    raise exception 'Conflit détecté : le véhicule a une autre réservation sur cette période';
  end if;

  if not v_vehicule.disponible or not v_vehicule.controle_technique_ok then
    raise exception 'Véhicule non disponible ou contrôle technique non validé';
  end if;

  -- Passer en EN_ATTENTE_PAIEMENT (client a 24h pour payer)
  update public.reservations set statut = 'EN_ATTENTE_PAIEMENT' where id = v_reservation.id;
end;
$$;

grant execute on function public.garage_valider_demande(text) to authenticated;

create or replace function public.garage_refuser_demande(p_code_reservation text, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
begin
  if not public.est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  select * into v_reservation
  from public.reservations
  where code_public = p_code_reservation;

  if v_reservation is null then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut <> 'DEMANDEE' then
    raise exception 'Seules les demandes en attente peuvent être refusées';
  end if;

  update public.reservations set statut = 'REFUSEE' where id = v_reservation.id;
  -- TODO: notifier le client (email/push) avec le motif
end;
$$;

grant execute on function public.garage_refuser_demande(text, text) to authenticated;

-- ============================================================
-- Expiration automatique des réservations EN_ATTENTE_PAIEMENT > 24h
-- ============================================================

create or replace function public.expirer_reservations_en_attente_paiement()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Expire les réservations EN_ATTENTE_PAIEMENT de plus de 24h sans paiement
  update public.reservations
  set statut = 'EXPIREE'
  where statut = 'EN_ATTENTE_PAIEMENT'
    and updated_at < now() - interval '24 hours'
    and not exists (
      select 1 from public.paiements p
      where p.reservation_id = reservations.id and p.statut = 'REUSSI'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.expirer_reservations_en_attente_paiement() to authenticated;

-- Job cron : exécuter toutes les heures
-- Nécessite l'extension pg_cron activée dans Supabase (Database > Extensions > pg_cron)
-- select cron.schedule('expirer-reservations-attente-paiement', '0 * * * *', 'select public.expirer_reservations_en_attente_paiement();');

-- Ancienne fonction pour compatibilité (PROVISOIRE n'existe plus)
create or replace function public.expirer_reservations_provisoires()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0; -- Plus utilisé, conservé pour compatibilité cron existant
end;
$$;
