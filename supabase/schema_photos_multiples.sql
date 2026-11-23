-- Plusieurs photos par véhicule — remplace la colonne `vehicules.photos`
-- (une seule URL en texte) par un tableau de textes (text[]), la première
-- entrée servant de photo de couverture (catalogue, cartes, aperçu).
-- À exécuter dans Supabase Dashboard > SQL Editor, après
-- schema_reservation_avec_chauffeur.sql et schema_dispo_apres_paiement.sql.
--
-- Les vues et fonctions qui référencent `photos` doivent être supprimées
-- avant le changement de type, puis recréées à l'identique (seul le type de
-- la colonne change, pas la liste des colonnes exposées).

drop function if exists public.rechercher_vehicules(text, text, text, timestamptz, timestamptz);
drop function if exists public.derniers_vehicules(int);
drop view if exists public.vehicules_publics;
drop view if exists public.mes_reservations;

alter table public.vehicules
  alter column photos drop default,
  alter column photos type text[] using case
    when photos is null or photos = '' then '{}'::text[]
    else array[photos]
  end,
  alter column photos set default '{}'::text[],
  alter column photos set not null;

create view public.vehicules_publics as
select id, code_public, marque, modele, annee, transmission, categorie, ville, prix_unitaire, unite_tarif, photos, disponible
from public.vehicules
where disponible = true and controle_technique_ok = true;

grant select on public.vehicules_publics to anon, authenticated;

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

create or replace function public.derniers_vehicules(p_limite int default 10)
returns setof public.vehicules_publics
language sql
security definer
set search_path = public
stable
as $$
  select vp.*
  from public.vehicules_publics vp
  join public.vehicules v on v.id = vp.id
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limite, 10), 50));
$$;

grant execute on function public.derniers_vehicules(int) to anon, authenticated;
