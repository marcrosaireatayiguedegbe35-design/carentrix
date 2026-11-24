-- Carentrix devient une marketplace : des agences partenaires publient leurs véhicules,
-- l'administration (rôle GARAGE, inchangé) crée les agences et fixe la commission de
-- chacune. Circuit financier MIXTE :
--   * paiement en ligne (FedaPay) : la plateforme encaisse et DOIT la part agence ;
--   * paiement en espèces       : l'agence encaisse et DOIT la commission plateforme.
-- Chaque mouvement est inscrit dans un grand livre (mouvements_agence) ; le solde net
-- par agence dit qui doit quoi. Les reversements sont enregistrés par l'admin, avec
-- verrou et référence unique contre les doubles paiements.
--
-- À exécuter dans Supabase Dashboard > SQL Editor, APRÈS tous les autres schema_*.sql.
-- Idempotent : peut être relancé sans dommage.
--
-- Le client final ne voit jamais l'agence : vehicules_publics et rechercher_vehicules
-- ne sont pas modifiés et n'exposent pas agence_id.

begin;

-- ============================================================
-- 1. Rôle AGENCE
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('PROPRIETAIRE', 'LOCATAIRE', 'GARAGE', 'CHAUFFEUR', 'AGENCE'));

-- ============================================================
-- 2. Agences partenaires
-- ============================================================

create table if not exists public.agences (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  responsable_nom text not null default '',
  adresse text not null default '',
  ville text not null default '',
  email text,
  telephone text,
  -- Pourcentage gardé par la plateforme sur le prix de location (hors caution).
  taux_commission numeric(5,2) not null
    check (taux_commission >= 0 and taux_commission <= 100),
  statut text not null default 'EN_ATTENTE'
    check (statut in ('ACTIF', 'SUSPENDU', 'EN_ATTENTE')),
  -- Compte sur lequel l'agence reçoit ses reversements : modifiable par l'admin seul
  -- (un compte d'agence piraté ne doit pas pouvoir détourner les reversements).
  reversement_moyen text
    check (reversement_moyen is null or reversement_moyen in ('MTN_MOMO', 'MOOV_MONEY', 'CELTIIS', 'VIREMENT')),
  reversement_numero text,
  -- L'agence « Carentrix » : le parc historique, géré par la plateforme elle-même.
  est_plateforme boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agences_une_seule_plateforme
  on public.agences (est_plateforme) where est_plateforme;

drop trigger if exists agences_updated_at on public.agences;
create trigger agences_updated_at
  before update on public.agences
  for each row execute function public.update_reservation_updated_at();

insert into public.agences (nom, responsable_nom, taux_commission, statut, est_plateforme)
select 'Carentrix', 'Administration Carentrix', 100, 'ACTIF', true
where not exists (select 1 from public.agences where est_plateforme);

create or replace function public.agence_plateforme_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.agences where est_plateforme limit 1;
$$;

-- ============================================================
-- 3. Rattachements : utilisateurs, véhicules, réservations
-- ============================================================

alter table public.profiles
  add column if not exists agence_id uuid references public.agences(id) on delete set null;

alter table public.vehicules
  add column if not exists agence_id uuid references public.agences(id);
update public.vehicules set agence_id = public.agence_plateforme_id() where agence_id is null;
alter table public.vehicules alter column agence_id set not null;
create index if not exists vehicules_agence_idx on public.vehicules (agence_id);

-- Commission figée au moment de la réservation : un changement de taux ultérieur
-- ne modifie jamais rétroactivement une réservation existante.
alter table public.reservations
  add column if not exists agence_id uuid references public.agences(id),
  add column if not exists taux_commission numeric(5,2),
  add column if not exists montant_commission int,
  add column if not exists montant_agence int;

update public.reservations r
set agence_id = v.agence_id,
    taux_commission = a.taux_commission,
    montant_commission = round(r.montant_total * a.taux_commission / 100.0),
    montant_agence = r.montant_total - round(r.montant_total * a.taux_commission / 100.0)
from public.vehicules v
join public.agences a on a.id = v.agence_id
where v.id = r.vehicule_id and r.agence_id is null;

create index if not exists reservations_agence_idx on public.reservations (agence_id);

-- ============================================================
-- 4. Fonctions d'identité
-- ============================================================

create or replace function public.mon_agence_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agence_id from public.profiles
  where id = auth.uid() and role = 'AGENCE' and agence_id is not null;
$$;

create or replace function public.est_agence()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mon_agence_id() is not null;
$$;

grant execute on function public.mon_agence_id() to authenticated;
grant execute on function public.est_agence() to authenticated;

-- ============================================================
-- 5. Protection des profils : ni l'inscription publique ni un client connecté
--    ne peuvent s'attribuer GARAGE / AGENCE ou changer d'agence.
-- ============================================================

-- Inscription (auth.signUp passe par GoTrue, connecté en supabase_auth_admin) :
-- quel que soit le handle_new_user() en place, un rôle privilégié est rétrogradé.
-- Les comptes admin/agence sont promus ensuite par la clé de service (UPDATE).
create or replace function public.proteger_insertion_profil()
returns trigger
language plpgsql
as $$
begin
  if session_user = 'supabase_auth_admin' or current_user in ('authenticated', 'anon') then
    if new.role in ('GARAGE', 'AGENCE') then
      new.role := 'LOCATAIRE';
    end if;
    new.agence_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_insertion_profil on public.profiles;
create trigger proteger_insertion_profil
  before insert on public.profiles
  for each row execute function public.proteger_insertion_profil();

create or replace function public.proteger_colonnes_profil()
returns trigger
language plpgsql
as $$
begin
  -- Sessions de l'application (clients connectés) : colonnes sensibles verrouillées.
  -- Les fonctions SECURITY DEFINER, la clé de service et le SQL Editor ne sont pas concernés.
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) ->> 'role') is distinct from (to_jsonb(old) ->> 'role')
       or (to_jsonb(new) ->> 'statut_kyc') is distinct from (to_jsonb(old) ->> 'statut_kyc')
       or (to_jsonb(new) ->> 'pseudo') is distinct from (to_jsonb(old) ->> 'pseudo')
       or (to_jsonb(new) ->> 'agence_id') is distinct from (to_jsonb(old) ->> 'agence_id') then
      raise exception 'Modification interdite : le rôle, le statut du dossier, le pseudo et l''agence sont gérés par l''administration.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_colonnes_profil on public.profiles;
create trigger proteger_colonnes_profil
  before update on public.profiles
  for each row execute function public.proteger_colonnes_profil();

-- ============================================================
-- 6. Véhicules : chaque véhicule appartient à une agence
-- ============================================================

create or replace function public.verrouiller_champs_vehicule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass boolean := current_setting('app.bypass_verrou_vehicule', true) is not distinct from 'on';
  v_statut_agence text;
begin
  if tg_op = 'INSERT' then
    new.proprietaire_id := coalesce(auth.uid(), new.proprietaire_id);
    if new.code_public is null or new.code_public = '' then
      new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      while exists(select 1 from public.vehicules where code_public = new.code_public) loop
        new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      end loop;
    end if;

    if public.est_garage() then
      -- L'admin publie pour l'agence choisie, par défaut la plateforme ; publié d'office.
      new.agence_id := coalesce(new.agence_id, public.agence_plateforme_id());
      new.controle_technique_ok := coalesce(new.controle_technique_ok, true);
      new.disponible := coalesce(new.disponible, true);
    elsif public.est_agence() then
      new.agence_id := public.mon_agence_id();
      select statut into v_statut_agence from public.agences where id = new.agence_id;
      if v_statut_agence is distinct from 'ACTIF' then
        raise exception 'Votre agence n''est pas active : ajout de véhicule impossible.';
      end if;
      -- En attente de validation par l'administration avant d'apparaître au catalogue.
      new.controle_technique_ok := false;
      new.disponible := coalesce(new.disponible, true);
    elsif auth.uid() is null then
      -- SQL Editor / seed : agence explicite ou plateforme.
      new.agence_id := coalesce(new.agence_id, public.agence_plateforme_id());
    else
      new.agence_id := public.agence_plateforme_id();
      new.disponible := false;
      new.controle_technique_ok := false;
    end if;

  elsif tg_op = 'UPDATE' then
    if not v_bypass then
      new.proprietaire_id := old.proprietaire_id;
      new.code_public := old.code_public;
      if auth.uid() is not null and not public.est_garage() then
        new.agence_id := old.agence_id;
        new.controle_technique_ok := old.controle_technique_ok;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "agence_lit_ses_vehicules" on public.vehicules;
create policy "agence_lit_ses_vehicules" on public.vehicules
  for select to authenticated using (agence_id = public.mon_agence_id());

drop policy if exists "agence_ajoute_vehicule" on public.vehicules;
create policy "agence_ajoute_vehicule" on public.vehicules
  for insert to authenticated with check (agence_id = public.mon_agence_id());

-- Pas de suppression pour l'agence : elle archive (disponible = false).
drop policy if exists "agence_modifie_ses_vehicules" on public.vehicules;
create policy "agence_modifie_ses_vehicules" on public.vehicules
  for update to authenticated
  using (agence_id = public.mon_agence_id())
  with check (agence_id = public.mon_agence_id());

-- ============================================================
-- 7. Réservations : agence et commission figées côté serveur
-- ============================================================

create or replace function public.figer_commission_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agence_id uuid;
  v_taux numeric(5,2);
  v_statut text;
begin
  if tg_op = 'INSERT' then
    select v.agence_id, a.taux_commission, a.statut
      into v_agence_id, v_taux, v_statut
    from public.vehicules v
    join public.agences a on a.id = v.agence_id
    where v.id = new.vehicule_id;

    if v_statut is distinct from 'ACTIF' then
      raise exception 'Véhicule indisponible';
    end if;

    new.agence_id := v_agence_id;
    new.taux_commission := v_taux;
  else
    -- Jamais modifiables après coup, même par l'admin.
    new.agence_id := old.agence_id;
    new.taux_commission := old.taux_commission;
  end if;

  new.montant_commission := round(new.montant_total * new.taux_commission / 100.0);
  new.montant_agence := new.montant_total - new.montant_commission;
  return new;
end;
$$;

drop trigger if exists figer_commission_reservation on public.reservations;
create trigger figer_commission_reservation
  before insert or update on public.reservations
  for each row execute function public.figer_commission_reservation();

drop policy if exists "agence_lit_ses_reservations" on public.reservations;
create policy "agence_lit_ses_reservations" on public.reservations
  for select to authenticated using (agence_id = public.mon_agence_id());

drop policy if exists "agence_lit_ses_paiements" on public.paiements;
create policy "agence_lit_ses_paiements" on public.paiements
  for select to authenticated using (
    exists (
      select 1 from public.reservations r
      where r.id = paiements.reservation_id and r.agence_id = public.mon_agence_id()
    )
  );

-- ============================================================
-- 8. Grand livre et reversements
--    montant > 0 : la plateforme doit cette somme à l'agence
--    montant < 0 : l'agence doit cette somme à la plateforme
-- ============================================================

create table if not exists public.reversements_agence (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id),
  sens text not null check (sens in ('PLATEFORME_VERS_AGENCE', 'AGENCE_VERS_PLATEFORME')),
  montant int not null check (montant > 0),
  moyen text not null,
  -- Référence de la transaction (Mobile Money, virement) : unique → un même
  -- reversement ne peut pas être enregistré deux fois.
  reference_externe text not null unique,
  note text,
  cree_par uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.mouvements_agence (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id),
  reservation_id uuid references public.reservations(id),
  paiement_id uuid references public.paiements(id),
  reversement_id uuid references public.reversements_agence(id),
  type text not null check (type in (
    'PART_AGENCE_EN_LIGNE',   -- paiement en ligne réussi : +part agence
    'COMMISSION_ESPECES',     -- paiement espèces encaissé par l'agence : -commission
    'ANNULATION_PAIEMENT',    -- remboursement : contre-passation
    'REVERSEMENT',            -- la plateforme a payé l'agence : -montant
    'REGLEMENT_COMMISSION',   -- l'agence a payé la plateforme : +montant
    'AJUSTEMENT'
  )),
  montant int not null,
  libelle text,
  created_at timestamptz not null default now()
);

-- Un paiement ne génère qu'un seul mouvement de chaque type (idempotence).
create unique index if not exists mouvements_agence_paiement_unique
  on public.mouvements_agence (paiement_id, type) where paiement_id is not null;
create index if not exists mouvements_agence_agence_idx on public.mouvements_agence (agence_id, created_at);

create or replace function public.comptabiliser_paiement_agence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations%rowtype;
  v_est_plateforme boolean;
  v_total int;
begin
  select * into v_res from public.reservations where id = new.reservation_id;
  if v_res.agence_id is null then
    return new;
  end if;
  select est_plateforme into v_est_plateforme from public.agences where id = v_res.agence_id;
  if v_est_plateforme then
    return new; -- parc propre à la plateforme : rien à répartir
  end if;

  if new.statut = 'REUSSI' and (tg_op = 'INSERT' or old.statut is distinct from 'REUSSI') then
    if new.moyen = 'CASH' then
      insert into public.mouvements_agence (agence_id, reservation_id, paiement_id, type, montant, libelle)
      values (v_res.agence_id, v_res.id, new.id, 'COMMISSION_ESPECES', -v_res.montant_commission,
              'Commission ' || v_res.taux_commission || ' % — ' || v_res.code_public || ' (espèces)')
      on conflict (paiement_id, type) where paiement_id is not null do nothing;
    else
      insert into public.mouvements_agence (agence_id, reservation_id, paiement_id, type, montant, libelle)
      values (v_res.agence_id, v_res.id, new.id, 'PART_AGENCE_EN_LIGNE', v_res.montant_agence,
              'Part agence — ' || v_res.code_public || ' (en ligne)')
      on conflict (paiement_id, type) where paiement_id is not null do nothing;
    end if;

  elsif new.statut = 'REMBOURSE' and tg_op = 'UPDATE' and old.statut = 'REUSSI' then
    select coalesce(sum(montant), 0) into v_total
    from public.mouvements_agence
    where paiement_id = new.id and type <> 'ANNULATION_PAIEMENT';
    if v_total <> 0 then
      insert into public.mouvements_agence (agence_id, reservation_id, paiement_id, type, montant, libelle)
      values (v_res.agence_id, v_res.id, new.id, 'ANNULATION_PAIEMENT', -v_total,
              'Remboursement — ' || v_res.code_public)
      on conflict (paiement_id, type) where paiement_id is not null do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists comptabiliser_paiement_agence on public.paiements;
create trigger comptabiliser_paiement_agence
  after insert or update of statut on public.paiements
  for each row execute function public.comptabiliser_paiement_agence();

-- Rattrapage : paiements déjà réussis sur des agences partenaires (aucun à la
-- première exécution, puisque tout le parc existant appartient à la plateforme).
insert into public.mouvements_agence (agence_id, reservation_id, paiement_id, type, montant, libelle)
select r.agence_id, r.id, p.id,
       case when p.moyen = 'CASH' then 'COMMISSION_ESPECES' else 'PART_AGENCE_EN_LIGNE' end,
       case when p.moyen = 'CASH' then -r.montant_commission else r.montant_agence end,
       'Reprise historique — ' || r.code_public
from public.paiements p
join public.reservations r on r.id = p.reservation_id
join public.agences a on a.id = r.agence_id
where p.statut = 'REUSSI' and not a.est_plateforme
on conflict (paiement_id, type) where paiement_id is not null do nothing;

create or replace view public.soldes_agences
with (security_invoker = true) as
select
  a.id as agence_id,
  a.nom,
  a.statut,
  a.taux_commission,
  coalesce(sum(m.montant), 0)::bigint as solde,  -- > 0 : dû à l'agence ; < 0 : dû par l'agence
  coalesce(sum(m.montant) filter (where m.type = 'PART_AGENCE_EN_LIGNE'), 0)::bigint as total_parts_en_ligne,
  coalesce(-sum(m.montant) filter (where m.type = 'COMMISSION_ESPECES'), 0)::bigint as total_commissions_especes,
  coalesce(-sum(m.montant) filter (where m.type = 'REVERSEMENT'), 0)::bigint as total_reverse,
  coalesce(sum(m.montant) filter (where m.type = 'REGLEMENT_COMMISSION'), 0)::bigint as total_commissions_reglees
from public.agences a
left join public.mouvements_agence m on m.agence_id = a.id
where not a.est_plateforme
group by a.id;

grant select on public.soldes_agences to authenticated;

-- Enregistre un reversement (admin uniquement). Verrouille la ligne de l'agence
-- pour sérialiser les reversements concurrents et refuse tout montant
-- supérieur à ce qui est réellement dû.
create or replace function public.admin_enregistrer_reversement(
  p_agence_id uuid,
  p_sens text,
  p_montant int,
  p_moyen text,
  p_reference text,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solde bigint;
  v_reversement_id uuid;
begin
  if not public.est_garage() then
    raise exception 'Accès réservé à l''administration';
  end if;
  if p_montant is null or p_montant <= 0 then
    raise exception 'Montant invalide';
  end if;
  if coalesce(trim(p_reference), '') = '' then
    raise exception 'La référence de la transaction est obligatoire';
  end if;

  perform 1 from public.agences where id = p_agence_id and not est_plateforme for update;
  if not found then
    raise exception 'Agence introuvable';
  end if;

  if exists (select 1 from public.reversements_agence where reference_externe = trim(p_reference)) then
    raise exception 'Cette référence de transaction a déjà été enregistrée';
  end if;

  select coalesce(sum(montant), 0) into v_solde from public.mouvements_agence where agence_id = p_agence_id;

  if p_sens = 'PLATEFORME_VERS_AGENCE' then
    if p_montant > v_solde then
      raise exception 'Montant supérieur à ce que la plateforme doit à l''agence (% FCFA)', greatest(v_solde, 0);
    end if;
  elsif p_sens = 'AGENCE_VERS_PLATEFORME' then
    if p_montant > -v_solde then
      raise exception 'Montant supérieur à ce que l''agence doit à la plateforme (% FCFA)', greatest(-v_solde, 0);
    end if;
  else
    raise exception 'Sens de reversement invalide';
  end if;

  insert into public.reversements_agence (agence_id, sens, montant, moyen, reference_externe, note, cree_par)
  values (p_agence_id, p_sens, p_montant, p_moyen, trim(p_reference), p_note, auth.uid())
  returning id into v_reversement_id;

  insert into public.mouvements_agence (agence_id, reversement_id, type, montant, libelle)
  values (
    p_agence_id, v_reversement_id,
    case when p_sens = 'PLATEFORME_VERS_AGENCE' then 'REVERSEMENT' else 'REGLEMENT_COMMISSION' end,
    case when p_sens = 'PLATEFORME_VERS_AGENCE' then -p_montant else p_montant end,
    case when p_sens = 'PLATEFORME_VERS_AGENCE' then 'Reversement ' else 'Règlement de commission ' end
      || p_moyen || ' — réf. ' || trim(p_reference)
  );

  return v_solde + case when p_sens = 'PLATEFORME_VERS_AGENCE' then -p_montant else p_montant end;
end;
$$;

grant execute on function public.admin_enregistrer_reversement(uuid, text, int, text, text, text) to authenticated;

-- ============================================================
-- 9. Encaissement espèces par l'agence
-- ============================================================

create or replace function public.agence_encaisser_paiement_cash(p_code_reservation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_paiement_id uuid;
  v_conv_id uuid;
begin
  if not public.est_agence() then
    raise exception 'Accès réservé aux agences';
  end if;

  select id into v_reservation_id
  from public.reservations
  where code_public = p_code_reservation and agence_id = public.mon_agence_id();
  if v_reservation_id is null then
    raise exception 'Réservation introuvable';
  end if;

  select id into v_paiement_id
  from public.paiements
  where reservation_id = v_reservation_id and moyen = 'CASH' and statut = 'EN_ATTENTE'
  order by created_at desc
  limit 1
  for update;
  if v_paiement_id is null then
    raise exception 'Aucun paiement en espèces en attente pour cette réservation';
  end if;

  update public.paiements set statut = 'REUSSI' where id = v_paiement_id;

  if to_regclass('public.conversations') is not null then
    execute 'select id from public.conversations where reservation_id = $1'
      into v_conv_id using v_reservation_id;
    if v_conv_id is not null then
      execute 'insert into public.messages (conversation_id, auteur_id, contenu, systeme) values ($1, null, $2, true)'
        using v_conv_id, 'La réception du paiement en espèces a été confirmée.';
    end if;
  end if;
end;
$$;

grant execute on function public.agence_encaisser_paiement_cash(text) to authenticated;

-- ============================================================
-- 10. Gestion des agences
-- ============================================================

-- Suspendre une agence retire aussitôt ses véhicules du catalogue ; à la
-- réactivation, l'admin les revalide un par un.
create or replace function public.retirer_vehicules_agence_suspendue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut <> 'ACTIF' and old.statut = 'ACTIF' then
    perform set_config('app.bypass_verrou_vehicule', 'on', true);
    update public.vehicules set controle_technique_ok = false where agence_id = new.id;
    perform set_config('app.bypass_verrou_vehicule', 'off', true);
  end if;
  return new;
end;
$$;

drop trigger if exists retirer_vehicules_agence_suspendue on public.agences;
create trigger retirer_vehicules_agence_suspendue
  after update of statut on public.agences
  for each row execute function public.retirer_vehicules_agence_suspendue();

-- L'agence modifie ses coordonnées, jamais sa commission, son statut ni son compte de reversement.
create or replace function public.agence_modifier_profil(
  p_responsable_nom text,
  p_adresse text,
  p_ville text,
  p_email text,
  p_telephone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_agence() then
    raise exception 'Accès réservé aux agences';
  end if;
  update public.agences
  set responsable_nom = coalesce(p_responsable_nom, responsable_nom),
      adresse = coalesce(p_adresse, adresse),
      ville = coalesce(p_ville, ville),
      email = coalesce(p_email, email),
      telephone = coalesce(p_telephone, telephone)
  where id = public.mon_agence_id();
end;
$$;

grant execute on function public.agence_modifier_profil(text, text, text, text, text) to authenticated;

-- ============================================================
-- 11. Row Level Security
-- ============================================================

alter table public.agences enable row level security;
alter table public.mouvements_agence enable row level security;
alter table public.reversements_agence enable row level security;

drop policy if exists "admin_gere_agences" on public.agences;
create policy "admin_gere_agences" on public.agences
  for all to authenticated using (public.est_garage()) with check (public.est_garage());

drop policy if exists "agence_lit_sa_fiche" on public.agences;
create policy "agence_lit_sa_fiche" on public.agences
  for select to authenticated using (id = public.mon_agence_id());

drop policy if exists "admin_lit_mouvements" on public.mouvements_agence;
create policy "admin_lit_mouvements" on public.mouvements_agence
  for select to authenticated using (public.est_garage());

drop policy if exists "agence_lit_ses_mouvements" on public.mouvements_agence;
create policy "agence_lit_ses_mouvements" on public.mouvements_agence
  for select to authenticated using (agence_id = public.mon_agence_id());

drop policy if exists "admin_lit_reversements" on public.reversements_agence;
create policy "admin_lit_reversements" on public.reversements_agence
  for select to authenticated using (public.est_garage());

drop policy if exists "agence_lit_ses_reversements" on public.reversements_agence;
create policy "agence_lit_ses_reversements" on public.reversements_agence
  for select to authenticated using (agence_id = public.mon_agence_id());

-- Écritures du grand livre et des reversements : uniquement via les triggers et
-- admin_enregistrer_reversement (aucune policy insert/update/delete).

-- ============================================================
-- 12. Réservations vues par l'agence
--     Le nom et le téléphone du client ne sont communiqués qu'une fois la
--     réservation confirmée (nécessaires à la remise du véhicule), jamais avant.
-- ============================================================

drop function if exists public.agence_mes_reservations();
create or replace function public.agence_mes_reservations()
returns table(
  code_public text,
  statut text,
  date_debut timestamptz,
  date_fin timestamptz,
  montant_total int,
  caution int,
  taux_commission numeric,
  montant_commission int,
  montant_agence int,
  vehicule_code text,
  marque text,
  modele text,
  client_nom text,
  client_telephone text,
  paiement_moyen text,
  paiement_statut text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.code_public,
    r.statut,
    r.date_debut::timestamptz,
    r.date_fin::timestamptz,
    r.montant_total,
    r.caution,
    r.taux_commission,
    r.montant_commission,
    r.montant_agence,
    v.code_public,
    v.marque,
    v.modele,
    case when r.statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION','RETOURNE','INSPECTION','LITIGE','CLOTUREE')
      then p.nom end,
    case when r.statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION','RETOURNE','INSPECTION','LITIGE','CLOTUREE')
      then p.telephone end,
    pay.moyen,
    pay.statut,
    r.created_at
  from public.reservations r
  join public.vehicules v on v.id = r.vehicule_id
  left join public.profiles p on p.id = r.locataire_id
  left join lateral (
    select pa.moyen, pa.statut from public.paiements pa
    where pa.reservation_id = r.id
    order by pa.created_at desc
    limit 1
  ) pay on true
  where r.agence_id = public.mon_agence_id()
  order by r.created_at desc;
$$;

grant execute on function public.agence_mes_reservations() to authenticated;

commit;
