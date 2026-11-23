-- Suppression définitive de compte
-- - le client (locataire) peut supprimer son propre compte
-- - le garage peut supprimer n'importe quel compte non-GARAGE
--
-- Note : le trigger verrouille_vehicule bloque normalement le changement de
-- proprietaire_id. On le contourne via set_config pendant la réaffectation.

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
    -- Autoriser la réaffectation uniquement pendant supprimer_compte
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

create or replace function public.supprimer_compte(p_utilisateur_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_acteur uuid := auth.uid();
  v_cible uuid;
  v_role_acteur text;
  v_role_cible text;
  v_res uuid;
  v_garage_id uuid;
begin
  if v_acteur is null then
    raise exception 'Authentification requise';
  end if;

  select role into v_role_acteur from public.profiles where id = v_acteur;
  if v_role_acteur is null then
    raise exception 'Profil introuvable';
  end if;

  v_cible := coalesce(p_utilisateur_id, v_acteur);

  select role into v_role_cible from public.profiles where id = v_cible;
  if v_role_cible is null then
    raise exception 'Compte introuvable';
  end if;

  if v_role_cible = 'GARAGE' then
    raise exception 'Impossible de supprimer un compte garage';
  end if;

  if v_cible = v_acteur then
    if v_role_acteur = 'GARAGE' then
      raise exception 'Le compte garage ne peut pas être supprimé depuis l''application';
    end if;
  else
    if not public.est_garage() then
      raise exception 'Seul le garage peut supprimer le compte d''un autre utilisateur';
    end if;
  end if;

  -- Bloquer si location encore active
  if exists (
    select 1
    from public.reservations
    where locataire_id = v_cible
      and statut in (
        'CONFIRMEE', 'VEHICULE_REMIS', 'EN_LOCATION',
        'RETOURNE', 'INSPECTION', 'LITIGE'
      )
  ) then
    raise exception 'Ce compte a des locations en cours. Clôturez-les avant de le supprimer.';
  end if;

  -- Annuler les réservations encore en attente de paiement
  update public.reservations
  set statut = 'ANNULEE'
  where locataire_id = v_cible
    and statut = 'EN_ATTENTE';

  -- Véhicules encore rattachés → reprendre par un compte garage
  if exists (select 1 from public.vehicules where proprietaire_id = v_cible) then
    if public.est_garage() then
      v_garage_id := v_acteur;
    else
      select id into v_garage_id
      from public.profiles
      where role = 'GARAGE'
      order by created_at
      limit 1;
      if v_garage_id is null then
        raise exception 'Ce compte possède encore des véhicules. Contactez l''agence.';
      end if;
    end if;

    perform set_config('app.bypass_verrou_vehicule', 'on', true);
    update public.vehicules
    set proprietaire_id = v_garage_id,
        disponible = false
    where proprietaire_id = v_cible;
  end if;

  -- Détacher le rôle chauffeur éventuel
  update public.reservations
  set chauffeur_id = null
  where chauffeur_id = v_cible;

  -- Messagerie
  if to_regclass('public.conversations') is not null then
    delete from public.messages m
    using public.conversations c
    where m.conversation_id = c.id
      and (
        c.locataire_id = v_cible
        or c.proprietaire_id = v_cible
        or c.reservation_id in (
          select id from public.reservations where locataire_id = v_cible
        )
      );

    delete from public.conversations
    where locataire_id = v_cible
       or proprietaire_id = v_cible
       or reservation_id in (
         select id from public.reservations where locataire_id = v_cible
       );

    update public.messages
    set auteur_id = null
    where auteur_id = v_cible;
  end if;

  if to_regclass('public.journal_acces_identite') is not null then
    delete from public.journal_acces_identite
    where reservation_id in (
      select id from public.reservations where locataire_id = v_cible
    );
  end if;

  for v_res in
    select id from public.reservations where locataire_id = v_cible
  loop
    delete from public.paiements where reservation_id = v_res;
    delete from public.etats_des_lieux where reservation_id = v_res;
    delete from public.litiges where reservation_id = v_res;
    delete from public.reservations where id = v_res;
  end loop;

  if to_regclass('public.documents_kyc') is not null then
    delete from public.documents_kyc where utilisateur_id = v_cible;
  end if;

  delete from auth.users where id = v_cible;
  if not found then
    delete from public.profiles where id = v_cible;
  end if;
end;
$$;

revoke all on function public.supprimer_compte(uuid) from public;
grant execute on function public.supprimer_compte(uuid) to authenticated;

comment on function public.supprimer_compte(uuid) is
  'Suppression définitive : soi-même (client) ou n''importe quel non-GARAGE (garage).';
