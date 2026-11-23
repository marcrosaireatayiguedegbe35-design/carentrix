-- Disponibilité : une réservation non finalisée (EN_ATTENTE de paiement)
-- ne bloque plus les dates. Seules les réservations payées / confirmées occupent le véhicule.
--
-- Pour creer_reservation / payer_reservation avec chauffeur optionnel,
-- exécuter schema_reservation_avec_chauffeur.sql (qui inclut déjà cette logique).

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
