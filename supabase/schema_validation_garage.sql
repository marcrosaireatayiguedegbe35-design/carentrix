-- Validation des demandes de réservation par le garage.
--
-- Nouveau flux : le locataire envoie une DEMANDE (DEMANDEE) ; le garage la valide
-- (EN_ATTENTE_PAIEMENT, 24h pour payer) ou la refuse (REFUSEE) ; sans paiement
-- sous 24h la réservation passe en EXPIREE. Le paiement la fait passer en CONFIRMEE.
-- 'EN_ATTENTE' reste accepté : anciennes réservations déjà en base.
--
-- À exécuter dans Supabase Dashboard > SQL Editor, après
-- schema_supplement_chauffeur_par_jour.sql et schema_messagerie.sql.
-- Ce script remplace les versions de schema.sql : il est idempotent.

-- 1) Colonnes --------------------------------------------------------------

alter table public.reservations add column if not exists validee_at timestamptz;
alter table public.reservations add column if not exists motif_refus text;

-- 2) Contrainte sur statut -------------------------------------------------

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%statut%'
  loop
    execute format('alter table public.reservations drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.reservations
  add constraint reservations_statut_check check (statut in (
    'DEMANDEE','EN_ATTENTE_PAIEMENT','REFUSEE','EXPIREE','EN_ATTENTE',
    'CONFIRMEE','VEHICULE_REMIS','EN_LOCATION','RETOURNE','INSPECTION',
    'LITIGE','CLOTUREE','ANNULEE'
  ));

alter table public.reservations alter column statut set default 'DEMANDEE';

-- 3) creer_reservation : crée une DEMANDE ----------------------------------
-- (copie de schema_supplement_chauffeur_par_jour.sql, seul le statut change)

create or replace function public.creer_reservation(
  p_code_vehicule text,
  p_date_debut timestamptz,
  p_date_fin timestamptz,
  p_avec_chauffeur boolean default false
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
  c_supplement_chauffeur_par_unite constant int := 5000;
  v_vehicule public.vehicules%rowtype;
  v_conflit boolean;
  v_unites int;
  v_montant_vehicule int;
  v_montant_chauffeur int;
  v_montant_total int;
  v_caution int;
  v_cout_total int;
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
  v_montant_vehicule := v_unites * v_vehicule.prix_unitaire;
  v_montant_chauffeur := case
    when not v_vehicule.chauffeur_obligatoire and p_avec_chauffeur
      then c_supplement_chauffeur_par_unite * v_unites
    else 0
  end;
  v_montant_total := v_montant_vehicule + v_montant_chauffeur;
  v_caution := greatest(10000, round(v_montant_total * 0.2));
  v_cout_total := case
    when v_vehicule.cout_unitaire is null then null
    else v_unites * v_vehicule.cout_unitaire
  end;

  v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  while exists(select 1 from public.reservations where code_public = v_code) loop
    v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  end loop;

  insert into public.reservations(
    code_public, vehicule_id, locataire_id, date_debut, date_fin, statut,
    montant_total, montant_vehicule, caution, chauffeur_id, montant_chauffeur, cout_total
  ) values (
    v_code, v_vehicule.id, auth.uid(), p_date_debut, p_date_fin, 'DEMANDEE',
    v_montant_total, v_montant_vehicule, v_caution, null, v_montant_chauffeur, v_cout_total
  );

  return query select
    v_code,
    'DEMANDEE'::text,
    v_montant_total,
    v_caution,
    v_unites,
    v_vehicule.unite_tarif,
    v_montant_chauffeur,
    null::text;
end;
$$;

grant execute on function public.creer_reservation(text, timestamptz, timestamptz, boolean) to authenticated;

-- 4) payer_reservation : seulement après validation du garage --------------
-- (copie de schema_fix_payer_reservation_ambiguous.sql + délai de 24h)

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

  if v_reservation.statut = 'EN_ATTENTE_PAIEMENT'
     and v_reservation.validee_at is not null
     and v_reservation.validee_at < now() - interval '24 hours' then
    raise exception 'Le délai de paiement de 24h est dépassé. Veuillez refaire une demande.';
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

-- 5) annuler_reservation : le locataire peut annuler une demande -----------
-- (copie de schema_messagerie.sql, seule la liste des statuts change)

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
  v_conv_id uuid;
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

-- 6) Validation / refus par le garage --------------------------------------

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
  where code_public = p_code_reservation
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut <> 'DEMANDEE' then
    raise exception 'Seules les demandes en attente peuvent être validées';
  end if;

  select * into v_vehicule from public.vehicules where id = v_reservation.vehicule_id;

  if not v_vehicule.disponible or not v_vehicule.controle_technique_ok then
    raise exception 'Véhicule non disponible ou contrôle technique non validé';
  end if;

  -- Créneau déjà pris (ou réservé par un autre client qui a 24h pour payer)
  select exists(
    select 1 from public.reservations
    where vehicule_id = v_reservation.vehicule_id
      and id <> v_reservation.id
      and statut in ('EN_ATTENTE_PAIEMENT','CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
      and date_debut < v_reservation.date_fin
      and date_fin > v_reservation.date_debut
  ) into v_conflit;

  if v_conflit then
    raise exception 'Conflit : le véhicule a déjà une autre réservation sur cette période';
  end if;

  update public.reservations
  set statut = 'EN_ATTENTE_PAIEMENT', validee_at = now()
  where id = v_reservation.id;
end;
$$;

grant execute on function public.garage_valider_demande(text) to authenticated;

create or replace function public.garage_refuser_demande(
  p_code_reservation text,
  p_motif text default null
)
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
  where code_public = p_code_reservation
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut <> 'DEMANDEE' then
    raise exception 'Seules les demandes en attente peuvent être refusées';
  end if;

  update public.reservations
  set statut = 'REFUSEE', motif_refus = nullif(trim(p_motif), '')
  where id = v_reservation.id;
end;
$$;

grant execute on function public.garage_refuser_demande(text, text) to authenticated;

-- 7) Expiration des réservations validées mais non payées sous 24h ---------

create or replace function public.expirer_reservations_en_attente_paiement()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.reservations r
  set statut = 'EXPIREE'
  where r.statut = 'EN_ATTENTE_PAIEMENT'
    and r.validee_at < now() - interval '24 hours'
    and not exists (
      select 1 from public.paiements p
      where p.reservation_id = r.id and p.statut = 'REUSSI'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expirer_reservations_en_attente_paiement() from public, anon, authenticated;

-- Exécution automatique toutes les heures (nécessite l'extension pg_cron :
-- Dashboard > Database > Extensions > pg_cron). À lancer une seule fois :
-- select cron.schedule('expirer-reservations-attente-paiement', '0 * * * *',
--   'select public.expirer_reservations_en_attente_paiement();');
