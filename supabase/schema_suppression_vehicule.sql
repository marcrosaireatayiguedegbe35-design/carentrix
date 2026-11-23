-- Suppression définitive d'un véhicule du catalogue par le garage —
-- à exécuter dans Supabase Dashboard > SQL Editor, après schema_agence_garage.sql.

create or replace function public.garage_supprimer_vehicule(p_code_public text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nb_reservations int;
begin
  if not est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  select id into v_id from public.vehicules where code_public = p_code_public;
  if v_id is null then
    raise exception 'Véhicule introuvable';
  end if;

  select count(*) into v_nb_reservations
  from public.reservations
  where vehicule_id = v_id;

  if v_nb_reservations > 0 then
    raise exception 'Impossible de supprimer : ce véhicule a un historique de réservations. Mettez-le hors ligne à la place.';
  end if;

  delete from public.vehicules where id = v_id;
end;
$$;

grant execute on function public.garage_supprimer_vehicule(text) to authenticated;
