-- Rôle CHAUFFEUR : inscription publique, KYC (CNI + permis + photo), profil.
-- À exécuter APRÈS schema_kyc_obligatoire.sql, dans Supabase Dashboard > SQL Editor.
--
-- Un chauffeur s'inscrit comme locataire/propriétaire (nom, téléphone, email),
-- dépose ses documents (pièce d'identité, permis de conduire, photo de profil),
-- et passe par la même validation KYC du garage. Une fois vérifié, il définit
-- son tarif journalier et sa disponibilité depuis son espace.
--
-- Le rattachement d'un chauffeur à une réservation (location "avec chauffeur")
-- est une étape suivante, pas couverte ici.

-- ============================================================
-- profiles : nouveau rôle + champs spécifiques chauffeur
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('PROPRIETAIRE', 'LOCATAIRE', 'GARAGE', 'CHAUFFEUR'));

alter table public.profiles
  add column if not exists annees_experience int check (annees_experience is null or annees_experience >= 0),
  add column if not exists tarif_journalier_chauffeur int check (tarif_journalier_chauffeur is null or tarif_journalier_chauffeur > 0),
  add column if not exists disponible_chauffeur boolean not null default true,
  add column if not exists pseudo text;

-- ============================================================
-- Inscription : lire le rôle CHAUFFEUR et les années d'expérience
-- ============================================================

-- ============================================================
-- Inscription : rôle CHAUFFEUR + années d'expérience + pseudo
-- ============================================================

create or replace function public.generer_pseudo()
returns text
language plpgsql
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_pseudo text;
  v_i int;
  v_tentatives int := 0;
begin
  loop
    v_pseudo := 'CX-';
    for v_i in 1..6 loop
      v_pseudo := v_pseudo || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where pseudo = v_pseudo);
    v_tentatives := v_tentatives + 1;
    if v_tentatives > 40 then
      v_pseudo := 'CX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit;
    end if;
  end loop;
  return v_pseudo;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, role, nom, telephone, statut_kyc, doit_changer_mot_de_passe,
    annees_experience, pseudo
  )
  values (
    new.id,
    case
      when new.raw_user_meta_data->>'role' = 'PROPRIETAIRE' then 'PROPRIETAIRE'
      when new.raw_user_meta_data->>'role' = 'CHAUFFEUR' then 'CHAUFFEUR'
      else 'LOCATAIRE'
    end,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'telephone', new.id::text),
    'NON_VERIFIE',
    coalesce((new.raw_user_meta_data->>'doit_changer_mot_de_passe')::boolean, true),
    nullif(new.raw_user_meta_data->>'annees_experience', '')::int,
    public.generer_pseudo()
  );
  return new;
end;
$$;

-- ============================================================
-- KYC : documents requis pour un chauffeur (pièce d'identité,
-- permis de conduire, photo de profil — types déjà existants)
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

  if v_role not in ('LOCATAIRE', 'PROPRIETAIRE', 'CHAUFFEUR') then
    raise exception 'Réservé aux locataires, propriétaires et chauffeurs';
  end if;

  if v_statut = 'VERIFIE' then
    return 'VERIFIE';
  end if;

  v_types_requis := case
    when v_role = 'PROPRIETAIRE' then array['PIECE_IDENTITE', 'JUSTIFICATIF_PROPRIETE']
    when v_role = 'LOCATAIRE' then array['PIECE_IDENTITE', 'PERMIS_CONDUIRE', 'JUSTIFICATIF_RESIDENCE', 'PHOTO_PROFIL']
    when v_role = 'CHAUFFEUR' then array['PIECE_IDENTITE', 'PERMIS_CONDUIRE', 'PHOTO_PROFIL']
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
-- Un chauffeur vérifié définit son tarif et sa disponibilité
-- (aucune nouvelle policy nécessaire : "profil_maj_propre" couvre
-- déjà la mise à jour de sa propre fiche).
-- ============================================================

create or replace function public.definir_tarif_chauffeur(
  p_tarif_journalier int,
  p_disponible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_statut text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select role, statut_kyc into v_role, v_statut from public.profiles where id = auth.uid();

  if v_role <> 'CHAUFFEUR' then
    raise exception 'Réservé aux chauffeurs';
  end if;
  if v_statut <> 'VERIFIE' then
    raise exception 'Dossier KYC non validé par le garage.';
  end if;
  if p_tarif_journalier <= 0 then
    raise exception 'Tarif invalide';
  end if;

  update public.profiles
  set tarif_journalier_chauffeur = p_tarif_journalier, disponible_chauffeur = p_disponible
  where id = auth.uid();
end;
$$;

grant execute on function public.definir_tarif_chauffeur(int, boolean) to authenticated;

-- ============================================================
-- Vitrine chauffeurs : afficher le pseudo
create or replace function public.chauffeurs_disponibles(p_limite int default 8)
returns table (
  id uuid,
  prenom text,
  annees_experience int,
  tarif_journalier int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    coalesce(p.pseudo, split_part(trim(p.nom), ' ', 1)) as prenom,
    p.annees_experience,
    p.tarif_journalier_chauffeur as tarif_journalier
  from public.profiles p
  where p.role = 'CHAUFFEUR'
    and p.statut_kyc = 'VERIFIE'
    and p.disponible_chauffeur = true
    and p.tarif_journalier_chauffeur is not null
  order by p.tarif_journalier_chauffeur asc, coalesce(p.pseudo, p.nom) asc
  limit greatest(1, least(coalesce(p_limite, 8), 40));
$$;

grant execute on function public.chauffeurs_disponibles(int) to anon, authenticated;
