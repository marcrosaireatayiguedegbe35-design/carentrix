-- Tarification à l'heure ou à la journée — à exécuter APRÈS schema_mot_de_passe_temporaire.sql,
-- dans Supabase Dashboard > SQL Editor.
--
-- Chaque véhicule est tarifé soit à l'heure, soit à la journée (au choix du
-- propriétaire à son dépôt). Les réservations passent de "date" à
-- "timestamptz" pour permettre une réservation à l'heure près.

-- ============================================================
-- Véhicules : unité de tarification + renommage du prix
-- ============================================================

alter table public.vehicules rename column prix_journalier to prix_unitaire;

alter table public.vehicules
  add column if not exists unite_tarif text not null default 'JOUR' check (unite_tarif in ('HEURE', 'JOUR'));

-- ============================================================
-- Réservations : dates -> horodatages (précision à l'heure)
-- ============================================================

alter table public.reservations
  alter column date_debut type timestamptz using date_debut::timestamptz,
  alter column date_fin type timestamptz using date_fin::timestamptz;

-- ============================================================
-- Vue publique des véhicules (mise à jour des colonnes)
-- ============================================================

create or replace view public.vehicules_publics as
select id, code_public, marque, modele, annee, transmission, categorie, ville, prix_unitaire, unite_tarif, photos, disponible
from public.vehicules
where disponible = true and controle_technique_ok = true;

grant select on public.vehicules_publics to anon, authenticated;

-- ============================================================
-- Recherche : dates de disponibilité en timestamptz
-- ============================================================

create or replace function public.rechercher_vehicules(
  p_ville text default null,
  p_categorie text default null,
  p_transmission text default null,
  p_date_debut timestamptz default null,
  p_date_fin timestamptz default null
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
          and r.statut in ('CONFIRMEE','VEHICULE_REMIS','EN_LOCATION')
          and r.date_debut < p_date_fin
          and r.date_fin > p_date_debut
      )
    );
$$;

grant execute on function public.rechercher_vehicules(text, text, text, timestamptz, timestamptz) to anon, authenticated;

-- L'ancienne signature (date, date) n'est plus utilisée par le frontend, on la retire
-- pour éviter toute ambiguïté de surcharge.
drop function if exists public.rechercher_vehicules(text, text, text, date, date);

-- ============================================================
-- Création de réservation : calcul selon l'unité de tarification
-- du véhicule (heure ou jour)
-- ============================================================

create or replace function public.creer_reservation(
  p_code_vehicule text,
  p_date_debut timestamptz,
  p_date_fin timestamptz
)
returns table(code_public text, statut text, montant_total int, caution int, unites int, unite_tarif text)
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

drop function if exists public.creer_reservation(text, date, date);
