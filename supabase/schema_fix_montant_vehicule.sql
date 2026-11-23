-- Corrige l'erreur "null value in column montant_vehicule... violates not-null
-- constraint" au moment de réserver un véhicule.
--
-- La colonne montant_vehicule existe sur public.reservations mais aucune version
-- suivie de creer_reservation() ne la renseignait (seule montant_total l'était).
-- À exécuter dans Supabase Dashboard > SQL Editor, après schema_benefice_reel.sql.

alter table public.reservations
  add column if not exists montant_vehicule int;

create or replace function public.creer_reservation(
  p_code_vehicule text,
  p_date_debut timestamptz,
  p_date_fin timestamptz,
  p_pseudo_chauffeur text default null
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
  v_vehicule public.vehicules%rowtype;
  v_conflit boolean;
  v_unites int;
  v_montant_vehicule int;
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
  v_caution := greatest(10000, round(v_montant_vehicule * 0.2));
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
    v_montant_vehicule, v_montant_vehicule, v_caution, null, 0, v_cout_total
  );

  return query select
    v_code,
    'EN_ATTENTE'::text,
    v_montant_vehicule,
    v_caution,
    v_unites,
    v_vehicule.unite_tarif,
    0,
    null::text;
end;
$$;

grant execute on function public.creer_reservation(text, timestamptz, timestamptz, text) to authenticated;
