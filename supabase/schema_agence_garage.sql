-- Carentrix = agence de location
-- Garage publie le parc ; chaque location inclut chauffeur (tarif tout compris).

-- ============================================================
-- Véhicules : le garage crée et gère le parc
-- ============================================================

drop policy if exists "garage_insere_vehicules" on public.vehicules;
create policy "garage_insere_vehicules" on public.vehicules
  for insert to authenticated
  with check (public.est_garage());

-- Remplace le verrouillage : dépôt garage = publié (CT + dispo)
create or replace function public.verrouiller_champs_vehicule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.proprietaire_id := auth.uid();
    if new.code_public is null or new.code_public = '' then
      new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      while exists(select 1 from public.vehicules where code_public = new.code_public) loop
        new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      end loop;
    end if;
    if public.est_garage() then
      new.controle_technique_ok := coalesce(new.controle_technique_ok, true);
      new.disponible := coalesce(new.disponible, true);
    else
      new.disponible := false;
      new.controle_technique_ok := false;
    end if;
  elsif tg_op = 'UPDATE' then
    -- bypass pendant supprimer_compte (réaffectation des véhicules)
    if current_setting('app.bypass_verrou_vehicule', true) is distinct from 'on' then
      new.proprietaire_id := old.proprietaire_id;
      new.code_public := old.code_public;
    end if;
    if not public.est_garage() then
      new.controle_technique_ok := old.controle_technique_ok;
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- Réservation : chauffeur inclus dans le service (param ignoré)
-- ============================================================

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

  v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  while exists(select 1 from public.reservations where code_public = v_code) loop
    v_code := 'RES-' || floor(1000 + random() * 9000)::int;
  end loop;

  insert into public.reservations(
    code_public, vehicule_id, locataire_id, date_debut, date_fin, statut,
    montant_total, caution, chauffeur_id, montant_chauffeur
  ) values (
    v_code, v_vehicule.id, auth.uid(), p_date_debut, p_date_fin, 'EN_ATTENTE',
    v_montant_vehicule, v_caution, null, 0
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

-- Messagerie (si la table existe déjà)
do $$
begin
  if to_regclass('public.conversations') is not null then
    execute $v$
      create or replace view public.mes_conversations as
      select
        c.id as conversation_id,
        c.reservation_id,
        c.ouverte,
        c.motif_fermeture,
        c.created_at,
        r.code_public as reservation_code,
        v.marque || ' ' || v.modele as vehicule_libelle,
        case
          when c.locataire_id = auth.uid() then 'LOCATAIRE'
          when c.proprietaire_id = auth.uid() or public.est_garage() then 'PROPRIETAIRE'
          else null
        end as mon_role,
        coalesce(pl.pseudo, 'Locataire') as locataire_pseudo,
        'Carentrix'::text as proprietaire_pseudo,
        (
          select m.contenu
          from public.messages m
          where m.conversation_id = c.id
          order by m.created_at desc
          limit 1
        ) as dernier_message,
        (
          select m.created_at
          from public.messages m
          where m.conversation_id = c.id
          order by m.created_at desc
          limit 1
        ) as dernier_message_at
      from public.conversations c
      join public.reservations r on r.id = c.reservation_id
      join public.vehicules v on v.id = r.vehicule_id
      left join public.profiles pl on pl.id = c.locataire_id
      where c.locataire_id = auth.uid()
         or c.proprietaire_id = auth.uid()
         or public.est_garage()
    $v$;
    grant select on public.mes_conversations to authenticated;
  end if;
end $$;
