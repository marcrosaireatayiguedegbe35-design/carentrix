-- Back-office Garage — à exécuter APRÈS schema.sql et schema_proprietaire.sql,
-- dans Supabase Dashboard > SQL Editor.

-- ============================================================
-- Correctif de sécurité : le rôle GARAGE ne doit jamais pouvoir être
-- auto-attribué par un utilisateur via l'inscription publique (le client
-- contrôle entièrement les métadonnées envoyées à auth.signUp). Seuls
-- PROPRIETAIRE et LOCATAIRE restent possibles par ce chemin ; un compte
-- GARAGE ne peut être créé que manuellement par un administrateur en SQL
-- (voir seed_garage.sql).
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
    case when new.raw_user_meta_data->>'role' = 'PROPRIETAIRE' then 'PROPRIETAIRE' else 'LOCATAIRE' end,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'telephone', new.id::text),
    'NON_VERIFIE'
  );
  return new;
end;
$$;

-- ============================================================
-- Fonction utilitaire : l'utilisateur connecté est-il un membre du garage ?
-- SECURITY DEFINER pour éviter toute récursion RLS quand elle est utilisée
-- à l'intérieur d'autres policies.
-- ============================================================

create or replace function public.est_garage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'GARAGE');
$$;

grant execute on function public.est_garage() to authenticated;

-- ============================================================
-- Le garage doit pouvoir valider le contrôle technique d'un véhicule.
-- Le trigger de verrouillage (schema_proprietaire.sql) est mis à jour pour
-- n'autoriser ce changement que lorsque l'appelant est membre du garage —
-- un propriétaire reste incapable de s'auto-certifier.
-- ============================================================

create or replace function public.verrouiller_champs_vehicule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.proprietaire_id := auth.uid();
    new.disponible := false;
    new.controle_technique_ok := false;
    if new.code_public is null or new.code_public = '' then
      new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      while exists(select 1 from public.vehicules where code_public = new.code_public) loop
        new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      end loop;
    end if;
  elsif tg_op = 'UPDATE' then
    new.proprietaire_id := old.proprietaire_id;
    new.code_public := old.code_public;
    if not public.est_garage() then
      new.controle_technique_ok := old.controle_technique_ok;
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- Journal d'accès aux identités : trace chaque consultation croisée
-- (propriétaire + locataire d'une même réservation) par un membre du garage.
-- ============================================================

create table if not exists public.journal_acces_identite (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references public.profiles(id),
  reservation_id uuid not null references public.reservations(id),
  consulte_le timestamptz not null default now()
);

alter table public.journal_acces_identite enable row level security;

create policy "garage_lit_journal" on public.journal_acces_identite
  for select using (public.est_garage());

-- ============================================================
-- RLS : accès en lecture du garage à l'ensemble des tables (jamais en
-- écriture directe — toute action passe par les fonctions ci-dessous, qui
-- valident les transitions de statut et journalisent les accès sensibles).
-- ============================================================

create policy "garage_lit_tous_profils" on public.profiles
  for select using (public.est_garage());

create policy "garage_lit_tous_vehicules" on public.vehicules
  for select using (public.est_garage());

create policy "garage_maj_controle_technique" on public.vehicules
  for update using (public.est_garage()) with check (public.est_garage());

create policy "garage_lit_toutes_reservations" on public.reservations
  for select using (public.est_garage());

create policy "garage_lit_tous_paiements" on public.paiements
  for select using (public.est_garage());

create policy "garage_lit_etats_des_lieux" on public.etats_des_lieux
  for select using (public.est_garage());

create policy "garage_lit_litiges" on public.litiges
  for select using (public.est_garage());

-- ============================================================
-- Vérification KYC (identité, permis, justificatif de propriété)
-- ============================================================

create or replace function public.garage_verifier_kyc(p_utilisateur_id uuid, p_statut text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;
  if p_statut not in ('VERIFIE', 'REJETE', 'EN_ATTENTE') then
    raise exception 'Statut invalide';
  end if;
  update public.profiles set statut_kyc = p_statut where id = p_utilisateur_id;
end;
$$;

grant execute on function public.garage_verifier_kyc(uuid, text) to authenticated;

-- ============================================================
-- Détail croisé d'une réservation : seul point du système où les deux
-- identités sont réunies. Réservé au garage, et journalisé à chaque appel.
-- ============================================================

create or replace function public.garage_details_reservation(p_code_reservation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_vehicule public.vehicules%rowtype;
  v_proprietaire public.profiles%rowtype;
  v_locataire public.profiles%rowtype;
  v_resultat jsonb;
begin
  if not est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  select * into v_reservation from public.reservations where code_public = p_code_reservation;
  if not found then
    raise exception 'Réservation introuvable';
  end if;

  select * into v_vehicule from public.vehicules where id = v_reservation.vehicule_id;
  select * into v_proprietaire from public.profiles where id = v_vehicule.proprietaire_id;
  select * into v_locataire from public.profiles where id = v_reservation.locataire_id;

  insert into public.journal_acces_identite (garage_id, reservation_id) values (auth.uid(), v_reservation.id);

  select jsonb_build_object(
    'reservation', jsonb_build_object(
      'codePublic', v_reservation.code_public,
      'statut', v_reservation.statut,
      'dateDebut', v_reservation.date_debut,
      'dateFin', v_reservation.date_fin,
      'montantTotal', v_reservation.montant_total,
      'caution', v_reservation.caution
    ),
    'vehicule', jsonb_build_object(
      'codePublic', v_vehicule.code_public,
      'marque', v_vehicule.marque,
      'modele', v_vehicule.modele,
      'ville', v_vehicule.ville
    ),
    'proprietaire', jsonb_build_object(
      'nom', v_proprietaire.nom,
      'telephone', v_proprietaire.telephone,
      'statutKyc', v_proprietaire.statut_kyc
    ),
    'locataire', jsonb_build_object(
      'nom', v_locataire.nom,
      'telephone', v_locataire.telephone,
      'statutKyc', v_locataire.statut_kyc
    ),
    'paiements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'montant', p.montant, 'moyen', p.moyen, 'statut', p.statut,
        'reference', p.reference, 'createdAt', p.created_at
      ) order by p.created_at), '[]'::jsonb)
      from public.paiements p where p.reservation_id = v_reservation.id
    ),
    'etatsDesLieux', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'type', e.type, 'horodatage', e.horodatage, 'notes', e.notes
      ) order by e.horodatage), '[]'::jsonb)
      from public.etats_des_lieux e where e.reservation_id = v_reservation.id
    ),
    'litige', (
      select jsonb_build_object(
        'description', l.description, 'resolution', l.resolution, 'montantPreleve', l.montant_preleve
      )
      from public.litiges l where l.reservation_id = v_reservation.id
    )
  ) into v_resultat;

  return v_resultat;
end;
$$;

grant execute on function public.garage_details_reservation(text) to authenticated;

-- ============================================================
-- Transitions du cycle de vie d'une réservation, pilotées par le garage
-- ============================================================

create or replace function public.garage_remettre_vehicule(p_code_reservation text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_statut text;
begin
  if not est_garage() then raise exception 'Accès réservé au personnel du garage'; end if;
  select id, statut into v_id, v_statut from public.reservations where code_public = p_code_reservation;
  if v_id is null then raise exception 'Réservation introuvable'; end if;
  if v_statut <> 'CONFIRMEE' then raise exception 'Cette réservation n''est pas prête pour la remise du véhicule'; end if;

  update public.reservations set statut = 'EN_LOCATION' where id = v_id;
  insert into public.etats_des_lieux (reservation_id, type, notes) values (v_id, 'REMISE', p_notes);
end;
$$;

grant execute on function public.garage_remettre_vehicule(text, text) to authenticated;

create or replace function public.garage_retourner_vehicule(p_code_reservation text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_statut text;
begin
  if not est_garage() then raise exception 'Accès réservé au personnel du garage'; end if;
  select id, statut into v_id, v_statut from public.reservations where code_public = p_code_reservation;
  if v_id is null then raise exception 'Réservation introuvable'; end if;
  if v_statut <> 'EN_LOCATION' then raise exception 'Ce véhicule n''est pas en cours de location'; end if;

  update public.reservations set statut = 'INSPECTION' where id = v_id;
  insert into public.etats_des_lieux (reservation_id, type, notes) values (v_id, 'RETOUR', p_notes);
end;
$$;

grant execute on function public.garage_retourner_vehicule(text, text) to authenticated;

create or replace function public.garage_terminer_inspection(
  p_code_reservation text,
  p_litige boolean,
  p_description text default null,
  p_montant_preleve int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_statut text;
begin
  if not est_garage() then raise exception 'Accès réservé au personnel du garage'; end if;
  select id, statut into v_id, v_statut from public.reservations where code_public = p_code_reservation;
  if v_id is null then raise exception 'Réservation introuvable'; end if;
  if v_statut <> 'INSPECTION' then raise exception 'Cette réservation n''est pas en inspection'; end if;

  if p_litige then
    update public.reservations set statut = 'LITIGE' where id = v_id;
    insert into public.litiges (reservation_id, description, montant_preleve)
    values (v_id, coalesce(p_description, ''), p_montant_preleve);
  else
    update public.reservations set statut = 'CLOTUREE' where id = v_id;
  end if;
end;
$$;

grant execute on function public.garage_terminer_inspection(text, boolean, text, int) to authenticated;

create or replace function public.garage_resoudre_litige(
  p_code_reservation text,
  p_resolution text,
  p_montant_preleve int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_statut text;
begin
  if not est_garage() then raise exception 'Accès réservé au personnel du garage'; end if;
  select id, statut into v_id, v_statut from public.reservations where code_public = p_code_reservation;
  if v_id is null then raise exception 'Réservation introuvable'; end if;
  if v_statut <> 'LITIGE' then raise exception 'Cette réservation n''est pas en litige'; end if;

  update public.litiges
  set resolution = p_resolution, montant_preleve = coalesce(p_montant_preleve, montant_preleve)
  where reservation_id = v_id;
  update public.reservations set statut = 'CLOTUREE' where id = v_id;
end;
$$;

grant execute on function public.garage_resoudre_litige(text, text, int) to authenticated;
