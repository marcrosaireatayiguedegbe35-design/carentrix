-- 10 derniers véhicules publics — à exécuter dans Supabase Dashboard > SQL Editor.

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
