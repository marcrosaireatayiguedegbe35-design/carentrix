-- Retrait d'un membre de l'équipe garage — à exécuter dans Supabase Dashboard
-- > SQL Editor, après schema_suppression_compte.sql.
--
-- supprimer_compte() refuse volontairement de supprimer un compte GARAGE
-- (voir schema_suppression_compte.sql). Cette fonction est le pendant
-- réservé au retrait d'un membre de l'équipe par un autre membre du garage :
-- - impossible de se retirer soi-même (éviter un verrouillage accidentel) ;
-- - impossible de supprimer le dernier compte garage restant ;
-- - les véhicules publiés par le membre retiré sont repris par l'appelant.

create or replace function public.garage_supprimer_membre(p_utilisateur_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_acteur uuid := auth.uid();
  v_role_cible text;
  v_nb_garage int;
begin
  if not est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  if p_utilisateur_id = v_acteur then
    raise exception 'Vous ne pouvez pas vous retirer vous-même de l''équipe';
  end if;

  select role into v_role_cible from public.profiles where id = p_utilisateur_id;
  if v_role_cible is null then
    raise exception 'Compte introuvable';
  end if;
  if v_role_cible <> 'GARAGE' then
    raise exception 'Ce compte ne fait pas partie de l''équipe garage';
  end if;

  select count(*) into v_nb_garage from public.profiles where role = 'GARAGE';
  if v_nb_garage <= 1 then
    raise exception 'Impossible de supprimer le dernier compte garage';
  end if;

  -- Véhicules encore rattachés au membre retiré → repris par l'appelant.
  perform set_config('app.bypass_verrou_vehicule', 'on', true);
  update public.vehicules
  set proprietaire_id = v_acteur
  where proprietaire_id = p_utilisateur_id;

  delete from auth.users where id = p_utilisateur_id;
  if not found then
    delete from public.profiles where id = p_utilisateur_id;
  end if;
end;
$$;

revoke all on function public.garage_supprimer_membre(uuid) from public;
grant execute on function public.garage_supprimer_membre(uuid) to authenticated;
