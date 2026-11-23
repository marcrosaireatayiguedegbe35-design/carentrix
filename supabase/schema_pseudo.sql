-- Pseudo public automatique à l'inscription.
-- À exécuter dans Supabase Dashboard > SQL Editor (après schema_chauffeurs.sql).
--
-- Chaque profil reçoit un pseudo unique du type CX-A7K2M9.
-- Le vrai nom reste réservé au garage / KYC ; le pseudo sert d'identifiant public.

alter table public.profiles
  add column if not exists pseudo text;

-- Générateur : CX- + 6 caractères alphanumériques
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

-- Renseigner les profils existants sans pseudo
update public.profiles
set pseudo = public.generer_pseudo()
where pseudo is null or trim(pseudo) = '';

alter table public.profiles
  alter column pseudo set not null;

create unique index if not exists profiles_pseudo_unique on public.profiles (pseudo);

-- Création de profil à l'inscription : pseudo généré automatiquement
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
      when new.raw_user_meta_data->>'role' = 'GARAGE' then 'GARAGE'
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

-- Vitrine chauffeurs : afficher le pseudo plutôt que le prénom réel
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
    p.pseudo as prenom,
    p.annees_experience,
    p.tarif_journalier_chauffeur as tarif_journalier
  from public.profiles p
  where p.role = 'CHAUFFEUR'
    and p.statut_kyc = 'VERIFIE'
    and p.disponible_chauffeur = true
    and p.tarif_journalier_chauffeur is not null
  order by p.tarif_journalier_chauffeur asc, p.pseudo asc
  limit greatest(1, least(coalesce(p_limite, 8), 40));
$$;

grant execute on function public.chauffeurs_disponibles(int) to anon, authenticated;
