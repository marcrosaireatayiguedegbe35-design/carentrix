-- Messagerie locataire ↔ propriétaire après confirmation de réservation.
-- À exécuter dans Supabase Dashboard > SQL Editor.
--
-- Règles :
--  - une conversation par réservation (ouverte dès CONFIRMEE)
--  - pas de téléphone, adresse, email, ni présentation nominative
--  - le propriétaire peut refuser la location tant que le véhicule n'est pas remis

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete cascade,
  locataire_id uuid not null references public.profiles(id),
  proprietaire_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  fermee_at timestamptz,
  motif_fermeture text check (motif_fermeture is null or motif_fermeture in (
    'REFUS_PROPRIETAIRE', 'ANNULATION_LOCATAIRE', 'CLOTURE'
  ))
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  auteur_id uuid references public.profiles(id),
  contenu text not null check (char_length(contenu) between 1 and 2000),
  systeme boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "participants_lisent_conversations" on public.conversations;
create policy "participants_lisent_conversations" on public.conversations
  for select using (
    locataire_id = auth.uid()
    or proprietaire_id = auth.uid()
    or public.est_garage()
  );

drop policy if exists "participants_lisent_messages" on public.messages;
create policy "participants_lisent_messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.locataire_id = auth.uid() or c.proprietaire_id = auth.uid() or public.est_garage())
    )
  );

-- ============================================================
-- Filtrage des données sensibles
-- ============================================================

create or replace function public.message_contient_sensible(p_texte text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text := lower(coalesce(p_texte, ''));
begin
  -- Téléphones (Bénin + formats espacés / collés)
  if v ~ '(\+|00)?[[:space:].\-]*229[[:space:].\-]*[[:digit:]]{2}' then
    return true;
  end if;
  if v ~ '(^|[^[:digit:]])(01|02|03|04|05|06|07|08|09|4[1-6]|5[0-9]|6[0-9]|9[0-9])[[:space:].\-]?[[:digit:]]{2}[[:space:].\-]?[[:digit:]]{2}[[:space:].\-]?[[:digit:]]{2}([^[:digit:]]|$)' then
    return true;
  end if;
  if v ~ '(^|[^[:digit:]])[[:digit:]]{2}[[:space:].\-][[:digit:]]{2}[[:space:].\-][[:digit:]]{2}[[:space:].\-][[:digit:]]{2}([^[:digit:]]|$)' then
    return true;
  end if;
  if v ~ '(^|[^[:digit:]])[[:digit:]]{8,11}([^[:digit:]]|$)' then
    return true;
  end if;

  -- Emails / liens / réseaux
  if v ~ '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}' then
    return true;
  end if;
  if v ~ 'https?://|www\.|wa\.me/|t\.me/|bit\.ly/' then
    return true;
  end if;
  if v ~ 'whatsapp|telegram|instagram|facebook|tiktok|snapchat|[[:<:]]signal[[:>:]]' then
    return true;
  end if;
  if v ~ '(^|[^[:alnum:]])@[[:alnum:]._]{3,}' then
    return true;
  end if;

  -- Adresses / lieux de rendez-vous hors garage
  if v ~ 'adresse|quartier|lotissement|[[:<:]]villa[[:>:]]|[[:<:]]maison[[:>:]]|r[eé]sidence|immeuble|appartement|bp[[:space:]]*[[:digit:]]|bo[iî]te[[:space:]]+postale|carrefour|rond[- ]point|derri[eè]re[[:space:]]+chez|chez[[:space:]]+moi|viens[[:space:]]+(chez|[àa]|au)|passe[[:space:]]+(chez|[àa]|me)|[[:<:]]rue[[:space:]]|[[:<:]]avenue[[:space:]]|[[:<:]]boulevard[[:space:]]|[[:<:]]impasse[[:space:]]' then
    return true;
  end if;

  -- Identité nominative (présentations explicites uniquement)
  if v ~ 'je[[:space:]]+m[''’]?appelle|mon[[:space:]]+nom[[:space:]]+(est|c[''’]?est)|mon[[:space:]]+pr[eé]nom[[:space:]]*(est|c[''’]?est)?|appelle[- ]moi|nom[[:space:]]+complet|pi[eè]ce[[:space:]]+d[''’]?identit|num[eé]ro[[:space:]]+de[[:space:]]+permis|[[:<:]]cni[[:>:]]|[[:<:]]passeport[[:>:]]' then
    return true;
  end if;

  return false;
end;
$$;

-- ============================================================
-- Ouverture automatique à la confirmation
-- ============================================================

create or replace function public.ouvrir_conversation_reservation(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations%rowtype;
  v_proprio uuid;
  v_conv_id uuid;
  v_code text;
  v_vehicule text;
begin
  select * into v_res from public.reservations where id = p_reservation_id;
  if not found then
    raise exception 'Réservation introuvable';
  end if;

  select proprietaire_id, marque || ' ' || modele, code_public
    into v_proprio, v_vehicule, v_code
  from public.vehicules
  where id = v_res.vehicule_id;

  if v_proprio is null then
    raise exception 'Propriétaire introuvable';
  end if;

  insert into public.conversations (reservation_id, locataire_id, proprietaire_id)
  values (v_res.id, v_res.locataire_id, v_proprio)
  on conflict (reservation_id) do update
    set fermee_at = null,
        motif_fermeture = null
  returning id into v_conv_id;

  if not exists (
    select 1 from public.messages
    where conversation_id = v_conv_id and systeme = true
  ) then
    insert into public.messages (conversation_id, auteur_id, contenu, systeme)
    values (
      v_conv_id,
      null,
      'Conversation ouverte pour la réservation ' || v_res.code_public
        || ' (' || coalesce(v_vehicule, 'véhicule') || '). '
        || 'Échangez uniquement sur le véhicule et les consignes de location. '
        || 'Téléphone, adresse et nom réel sont interdits et seront bloqués.',
      true
    );
  end if;

  return v_conv_id;
end;
$$;

create or replace function public.apres_reservation_confirmee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'CONFIRMEE' and (tg_op = 'INSERT' or old.statut is distinct from 'CONFIRMEE') then
    perform public.ouvrir_conversation_reservation(new.id);
  end if;

  if new.statut = 'ANNULEE' and (old.statut is distinct from 'ANNULEE') then
    update public.conversations
    set fermee_at = coalesce(fermee_at, now()),
        motif_fermeture = coalesce(motif_fermeture, 'ANNULATION_LOCATAIRE')
    where reservation_id = new.id and fermee_at is null;
  end if;

  if new.statut in ('CLOTUREE', 'VEHICULE_REMIS', 'EN_LOCATION') and old.statut is distinct from new.statut then
    -- garde la conversation ouverte pendant la location ; ne ferme qu'à la clôture
    if new.statut = 'CLOTUREE' then
      update public.conversations
      set fermee_at = coalesce(fermee_at, now()),
          motif_fermeture = coalesce(motif_fermeture, 'CLOTURE')
      where reservation_id = new.id and fermee_at is null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apres_reservation_confirmee on public.reservations;
create trigger trg_apres_reservation_confirmee
  after insert or update of statut on public.reservations
  for each row execute function public.apres_reservation_confirmee();

-- Ouvrir les conversations manquantes pour les réservations déjà confirmées
do $$
declare
  r record;
begin
  for r in
    select id from public.reservations
    where statut in ('CONFIRMEE', 'VEHICULE_REMIS', 'EN_LOCATION', 'RETOURNE', 'INSPECTION')
  loop
    perform public.ouvrir_conversation_reservation(r.id);
  end loop;
end $$;

-- ============================================================
-- Vues & RPCs
-- ============================================================

create or replace view public.mes_conversations as
select
  c.id as conversation_id,
  r.code_public as reservation_code,
  r.statut as reservation_statut,
  v.code_public as vehicule_code,
  v.marque,
  v.modele,
  c.created_at,
  c.fermee_at,
  c.motif_fermeture,
  case
    when c.locataire_id = auth.uid() then 'LOCATAIRE'
    when c.proprietaire_id = auth.uid() then 'PROPRIETAIRE'
    else null
  end as mon_role,
  case
    when c.locataire_id = auth.uid() then coalesce(pp.pseudo, 'Propriétaire')
    else coalesce(pl.pseudo, 'Locataire')
  end as interlocuteur_pseudo,
  (
    select m.contenu from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as dernier_message,
  (
    select m.created_at from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) as dernier_message_at
from public.conversations c
join public.reservations r on r.id = c.reservation_id
join public.vehicules v on v.id = r.vehicule_id
left join public.profiles pl on pl.id = c.locataire_id
left join public.profiles pp on pp.id = c.proprietaire_id
where c.locataire_id = auth.uid() or c.proprietaire_id = auth.uid();

grant select on public.mes_conversations to authenticated;

create or replace function public.lire_messages_reservation(p_code_reservation text)
returns table (
  id uuid,
  contenu text,
  systeme boolean,
  est_moi boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select c.* into v_conv
  from public.conversations c
  join public.reservations r on r.id = c.reservation_id
  where r.code_public = p_code_reservation
    and (c.locataire_id = auth.uid() or c.proprietaire_id = auth.uid() or public.est_garage());

  if not found then
    raise exception 'Conversation introuvable';
  end if;

  return query
  select
    m.id,
    m.contenu,
    m.systeme,
    (m.auteur_id is not null and m.auteur_id = auth.uid()) as est_moi,
    m.created_at
  from public.messages m
  where m.conversation_id = v_conv.id
  order by m.created_at asc;
end;
$$;

grant execute on function public.lire_messages_reservation(text) to authenticated;

create or replace function public.envoyer_message_reservation(
  p_code_reservation text,
  p_contenu text
)
returns table (id uuid, contenu text, systeme boolean, est_moi boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations%rowtype;
  v_texte text := trim(coalesce(p_contenu, ''));
  v_msg public.messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if char_length(v_texte) < 1 then
    raise exception 'Message vide';
  end if;

  if char_length(v_texte) > 2000 then
    raise exception 'Message trop long';
  end if;

  if public.message_contient_sensible(v_texte) then
    raise exception 'Message bloqué : téléphone, adresse, email ou nom réel sont interdits. Reformulez sans donnée personnelle.';
  end if;

  select c.* into v_conv
  from public.conversations c
  join public.reservations r on r.id = c.reservation_id
  where r.code_public = p_code_reservation
    and (c.locataire_id = auth.uid() or c.proprietaire_id = auth.uid());

  if not found then
    raise exception 'Conversation introuvable';
  end if;

  if v_conv.fermee_at is not null then
    raise exception 'Cette conversation est fermée';
  end if;

  insert into public.messages (conversation_id, auteur_id, contenu, systeme)
  values (v_conv.id, auth.uid(), v_texte, false)
  returning * into v_msg;

  return query
  select v_msg.id, v_msg.contenu, v_msg.systeme, true, v_msg.created_at;
end;
$$;

grant execute on function public.envoyer_message_reservation(text, text) to authenticated;

create or replace function public.proprietaire_refuser_location(p_code_reservation text)
returns table (code_public text, statut text)
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

  select r.* into v_reservation
  from public.reservations r
  join public.vehicules v on v.id = r.vehicule_id
  where r.code_public = p_code_reservation
    and v.proprietaire_id = auth.uid();

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.statut <> 'CONFIRMEE' then
    raise exception 'Vous ne pouvez refuser que tant que le véhicule n''a pas encore été remis';
  end if;

  -- Marquer le motif avant l'annulation (le trigger ne l'écrase pas)
  update public.conversations
  set fermee_at = coalesce(fermee_at, now()),
      motif_fermeture = 'REFUS_PROPRIETAIRE'
  where reservation_id = v_reservation.id
  returning id into v_conv_id;

  update public.reservations
  set statut = 'ANNULEE'
  where id = v_reservation.id;

  if v_conv_id is not null then
    insert into public.messages (conversation_id, auteur_id, contenu, systeme)
    values (
      v_conv_id,
      null,
      'Le propriétaire a refusé cette location. La réservation est annulée.',
      true
    );
  end if;

  return query select p_code_reservation, 'ANNULEE'::text;
end;
$$;

grant execute on function public.proprietaire_refuser_location(text) to authenticated;

-- Fermer proprement aussi quand le locataire annule
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

  if v_reservation.statut not in ('EN_ATTENTE','CONFIRMEE') then
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
