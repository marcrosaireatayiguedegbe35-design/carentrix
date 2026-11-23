-- Réactions (J'aime / Cœur) et commentaires sur chaque véhicule, + suivi de performance pour le garage.
-- À exécuter dans Supabase Dashboard > SQL Editor, après schema_avis.sql.
--
-- Règles :
--  - Voir les compteurs et les commentaires : tout le monde (visiteurs compris).
--  - Réagir (J'aime, Cœur) et commenter : clients connectés uniquement.
--  - Un client a au plus une réaction de chaque type par véhicule (re-cliquer la retire).
--  - Les commentaires affichent le pseudo, jamais le nom ni le téléphone. Les commentaires qui contiennent un
--    téléphone, un email ou un lien sont refusés (même principe que la messagerie). Limite : 5 commentaires/heure.
--  - Le garage voit les statistiques par véhicule et peut masquer un commentaire.
--  - Les écritures passent uniquement par les fonctions ci-dessous (aucune écriture directe sur les tables).

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.reactions_vehicule (
  vehicule_id uuid not null references public.vehicules(id) on delete cascade,
  utilisateur_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('LIKE', 'COEUR')),
  created_at timestamptz not null default now(),
  primary key (vehicule_id, utilisateur_id, type)
);

create table if not exists public.commentaires_vehicule (
  id uuid primary key default gen_random_uuid(),
  vehicule_id uuid not null references public.vehicules(id) on delete cascade,
  utilisateur_id uuid not null references public.profiles(id) on delete cascade,
  contenu text not null check (char_length(contenu) between 1 and 500),
  masque boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists commentaires_vehicule_idx on public.commentaires_vehicule (vehicule_id, created_at desc);
create index if not exists commentaires_utilisateur_idx on public.commentaires_vehicule (utilisateur_id, created_at desc);

alter table public.reactions_vehicule enable row level security;
alter table public.commentaires_vehicule enable row level security;

drop policy if exists "reactions_lecture_propre_ou_garage" on public.reactions_vehicule;
create policy "reactions_lecture_propre_ou_garage" on public.reactions_vehicule
  for select using (utilisateur_id = auth.uid() or public.est_garage());

drop policy if exists "commentaires_lecture_propre_ou_garage" on public.commentaires_vehicule;
create policy "commentaires_lecture_propre_ou_garage" on public.commentaires_vehicule
  for select using (utilisateur_id = auth.uid() or public.est_garage());

-- ============================================================
-- Vues publiques (compteurs et commentaires visibles)
-- ============================================================

create or replace view public.vehicules_engagement as
select
  v.code_public as vehicule_code,
  (select count(*) from public.reactions_vehicule r where r.vehicule_id = v.id and r.type = 'LIKE')::int as nb_likes,
  (select count(*) from public.reactions_vehicule r where r.vehicule_id = v.id and r.type = 'COEUR')::int as nb_coeurs,
  (select count(*) from public.commentaires_vehicule c where c.vehicule_id = v.id and not c.masque)::int as nb_commentaires
from public.vehicules v;

grant select on public.vehicules_engagement to anon, authenticated;

create or replace view public.commentaires_publics as
select
  c.id,
  v.code_public as vehicule_code,
  c.contenu,
  c.created_at,
  coalesce(p.pseudo, 'Client Carentrix') as auteur_pseudo,
  (c.utilisateur_id = auth.uid()) as est_le_mien
from public.commentaires_vehicule c
join public.vehicules v on v.id = c.vehicule_id
left join public.profiles p on p.id = c.utilisateur_id
where not c.masque
order by c.created_at desc;

grant select on public.commentaires_publics to anon, authenticated;

-- ============================================================
-- Fonctions client
-- ============================================================

create or replace function public.commentaire_contient_sensible(p_texte text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text := lower(coalesce(p_texte, ''));
begin
  if v ~ '(^|[^[:digit:]])[[:digit:]]{8,13}([^[:digit:]]|$)' then return true; end if;
  if v ~ '(\+|00)?[[:space:].\-]*229[[:space:].\-]*[[:digit:]]{2}' then return true; end if;
  if v ~ '(^|[^[:digit:]])[[:digit:]]{2}[[:space:].\-][[:digit:]]{2}[[:space:].\-][[:digit:]]{2}[[:space:].\-][[:digit:]]{2}([^[:digit:]]|$)' then return true; end if;
  if v ~ '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}' then return true; end if;
  if v ~ 'https?://|www\.|wa\.me/|t\.me/|bit\.ly/' then return true; end if;
  if v ~ 'whatsapp|telegram|instagram|facebook|tiktok|snapchat' then return true; end if;
  return false;
end;
$$;

create or replace function public.mes_reactions_vehicule(p_code_vehicule text)
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(r.type order by r.type), array[]::text[])
  from public.reactions_vehicule r
  join public.vehicules v on v.id = r.vehicule_id
  where v.code_public = p_code_vehicule and r.utilisateur_id = auth.uid();
$$;

grant execute on function public.mes_reactions_vehicule(text) to authenticated;

create or replace function public.basculer_reaction(p_code_vehicule text, p_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actif boolean;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if p_type not in ('LIKE', 'COEUR') then
    raise exception 'Réaction invalide';
  end if;

  select id into v_id from public.vehicules where code_public = p_code_vehicule;
  if v_id is null then
    raise exception 'Véhicule introuvable';
  end if;

  if exists (
    select 1 from public.reactions_vehicule
    where vehicule_id = v_id and utilisateur_id = auth.uid() and type = p_type
  ) then
    delete from public.reactions_vehicule
    where vehicule_id = v_id and utilisateur_id = auth.uid() and type = p_type;
    v_actif := false;
  else
    insert into public.reactions_vehicule (vehicule_id, utilisateur_id, type)
    values (v_id, auth.uid(), p_type);
    v_actif := true;
  end if;

  return jsonb_build_object(
    'actif', v_actif,
    'nb_likes', (select count(*) from public.reactions_vehicule where vehicule_id = v_id and type = 'LIKE'),
    'nb_coeurs', (select count(*) from public.reactions_vehicule where vehicule_id = v_id and type = 'COEUR')
  );
end;
$$;

grant execute on function public.basculer_reaction(text, text) to authenticated;

create or replace function public.ajouter_commentaire(p_code_vehicule text, p_contenu text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_texte text := trim(coalesce(p_contenu, ''));
  v_nouveau uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if char_length(v_texte) < 1 then
    raise exception 'Commentaire vide';
  end if;
  if char_length(v_texte) > 500 then
    raise exception 'Commentaire trop long (500 caractères maximum)';
  end if;
  if public.commentaire_contient_sensible(v_texte) then
    raise exception 'Commentaire refusé : téléphone, email ou lien interdits. Reformulez sans donnée personnelle.';
  end if;
  if (
    select count(*) from public.commentaires_vehicule
    where utilisateur_id = auth.uid() and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Trop de commentaires en peu de temps. Réessayez plus tard.';
  end if;

  select id into v_id from public.vehicules where code_public = p_code_vehicule;
  if v_id is null then
    raise exception 'Véhicule introuvable';
  end if;

  insert into public.commentaires_vehicule (vehicule_id, utilisateur_id, contenu)
  values (v_id, auth.uid(), v_texte)
  returning id into v_nouveau;

  return v_nouveau;
end;
$$;

grant execute on function public.ajouter_commentaire(text, text) to authenticated;

create or replace function public.supprimer_mon_commentaire(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  delete from public.commentaires_vehicule where id = p_id and utilisateur_id = auth.uid();
end;
$$;

grant execute on function public.supprimer_mon_commentaire(uuid) to authenticated;

-- ============================================================
-- Fonctions garage : performance et modération
-- ============================================================

create or replace function public.garage_performance_vehicules()
returns table (
  vehicule_code text,
  marque text,
  modele text,
  ville text,
  nb_likes int,
  nb_coeurs int,
  nb_commentaires int,
  nb_reservations int,
  nb_avis int,
  note_moyenne numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  return query
  with stats as (
    select
      v.id,
      v.code_public as code,
      v.marque as marque_v,
      v.modele as modele_v,
      v.ville as ville_v,
      v.created_at as cree_le,
      (select count(*) from public.reactions_vehicule r where r.vehicule_id = v.id and r.type = 'LIKE')::int as likes,
      (select count(*) from public.reactions_vehicule r where r.vehicule_id = v.id and r.type = 'COEUR')::int as coeurs,
      (select count(*) from public.commentaires_vehicule c where c.vehicule_id = v.id and not c.masque)::int as commentaires,
      (select count(*) from public.reservations x
         where x.vehicule_id = v.id and x.statut not in ('ANNULEE', 'REFUSEE', 'EXPIREE'))::int as reservations,
      (select count(*) from public.avis a where a.vehicule_id = v.id)::int as avis,
      (select round(avg(a.note)::numeric, 1) from public.avis a where a.vehicule_id = v.id) as note
    from public.vehicules v
  )
  select s.code, s.marque_v, s.modele_v, s.ville_v,
         s.likes, s.coeurs, s.commentaires, s.reservations, s.avis, s.note
  from stats s
  order by (s.likes + s.coeurs + s.commentaires) desc, s.reservations desc, s.cree_le desc;
end;
$$;

grant execute on function public.garage_performance_vehicules() to authenticated;

create or replace function public.garage_commentaires_recents(p_limite int default 50)
returns table (
  id uuid,
  vehicule_code text,
  marque text,
  modele text,
  auteur_pseudo text,
  contenu text,
  masque boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  return query
  select c.id, v.code_public, v.marque, v.modele,
         coalesce(p.pseudo, 'Client Carentrix'), c.contenu, c.masque, c.created_at
  from public.commentaires_vehicule c
  join public.vehicules v on v.id = c.vehicule_id
  left join public.profiles p on p.id = c.utilisateur_id
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limite, 50), 200));
end;
$$;

grant execute on function public.garage_commentaires_recents(int) to authenticated;

create or replace function public.garage_masquer_commentaire(p_id uuid, p_masque boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;
  update public.commentaires_vehicule set masque = coalesce(p_masque, true) where id = p_id;
end;
$$;

grant execute on function public.garage_masquer_commentaire(uuid, boolean) to authenticated;
