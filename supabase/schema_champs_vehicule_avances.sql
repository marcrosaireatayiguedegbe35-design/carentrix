-- Champs véhicule avancés (zone de prise en charge, zone incluse, places,
-- portes, carburant, équipements) + chauffeur facultatif par véhicule.
--
-- À exécuter dans Supabase Dashboard > SQL Editor, après schema_fix_montant_vehicule.sql
-- (dernière version active de creer_reservation à cette date).
--
-- Le garagiste saisit désormais lui-même, à la main, la zone de prise en
-- charge et la zone incluse dans le tarif (texte libre, pas de géocodage).
-- Chaque véhicule peut aussi rendre le chauffeur obligatoire (comportement
-- actuel, inchangé par défaut) ou facultatif : dans ce cas le locataire
-- choisit d'ajouter un chauffeur au moment de la réservation, moyennant un
-- supplément fixe de 5000 FCFA (montant unique par réservation, pas par
-- jour/heure — même prix quelle que soit la durée de la location), payé en
-- une seule fois avec le reste (pas de second paiement séparé).

-- ============================================================
-- Colonnes sur vehicules
-- ============================================================

alter table public.vehicules
  add column if not exists zone_prise_en_charge text,
  add column if not exists zone_incluse text,
  add column if not exists nombre_places int check (nombre_places > 0),
  add column if not exists nombre_portes int check (nombre_portes > 0),
  add column if not exists carburant text check (carburant in ('ESSENCE','GASOIL','AUTRE')),
  add column if not exists equipements text[] not null default '{}',
  add column if not exists chauffeur_obligatoire boolean not null default true;

-- ============================================================
-- vehicules_publics : on DROP puis recrée (avec les fonctions qui en
-- dépendent) plutôt que CREATE OR REPLACE, pour pouvoir retirer sans erreur
-- une colonne éventuellement ajoutée par une itération précédente de ce
-- fichier (Postgres refuse "cannot drop columns from view" sinon). Il faut
-- d'abord supprimer la vue et les fonctions qui en dépendent AVANT de
-- pouvoir supprimer la colonne dont la vue dépend (sinon "cannot drop column
-- ... because other objects depend on it").
-- ============================================================

drop function if exists public.rechercher_vehicules(text, text, text, timestamptz, timestamptz);
drop function if exists public.derniers_vehicules(int);
drop view if exists public.vehicules_publics;

-- Nettoyage : colonne d'une itération précédente de ce fichier (tarif
-- chauffeur configurable par véhicule), remplacée par un supplément fixe de
-- 5000 FCFA codé en dur dans creer_reservation. Sans effet si absente.
alter table public.vehicules
  drop column if exists tarif_chauffeur_optionnel;

create view public.vehicules_publics as
select
  v.id, v.code_public, v.marque, v.modele, v.annee, v.transmission, v.categorie, v.ville,
  v.prix_unitaire, v.unite_tarif, v.photos, v.disponible,
  coalesce(round(avg(a.note), 1), 0)::numeric as note_moyenne,
  count(a.id) as nb_avis,
  v.zone_prise_en_charge, v.zone_incluse, v.nombre_places, v.nombre_portes, v.carburant,
  v.equipements, v.chauffeur_obligatoire
from public.vehicules v
left join public.avis a on a.vehicule_id = v.id
where v.disponible = true and v.controle_technique_ok = true
group by v.id;

grant select on public.vehicules_publics to anon, authenticated;

create function public.rechercher_vehicules(
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

create function public.derniers_vehicules(p_limite int default 10)
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

-- ============================================================
-- creer_reservation : remplace le paramètre mort p_pseudo_chauffeur (jamais
-- honoré depuis schema_agence_garage.sql) par p_avec_chauffeur boolean —
-- même arité (4 paramètres), donc drop de l'ancienne signature texte pour
-- éviter toute ambiguïté d'overload.
-- ============================================================

drop function if exists public.creer_reservation(text, timestamptz, timestamptz, text);

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
  c_supplement_chauffeur constant int := 5000;
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
      then c_supplement_chauffeur
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
    v_code, v_vehicule.id, auth.uid(), p_date_debut, p_date_fin, 'EN_ATTENTE',
    v_montant_total, v_montant_vehicule, v_caution, null, v_montant_chauffeur, v_cout_total
  );

  return query select
    v_code,
    'EN_ATTENTE'::text,
    v_montant_total,
    v_caution,
    v_unites,
    v_vehicule.unite_tarif,
    v_montant_chauffeur,
    null::text;
end;
$$;

grant execute on function public.creer_reservation(text, timestamptz, timestamptz, boolean) to authenticated;
