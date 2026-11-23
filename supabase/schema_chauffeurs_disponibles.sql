-- Liste publique des chauffeurs disponibles (vitrine landing).
-- Pour la version avec stats de missions, exécuter schema_missions_chauffeur.sql.

create or replace function public.chauffeurs_disponibles(p_limite int default 8)
returns table (
  id uuid,
  prenom text,
  annees_experience int,
  tarif_journalier int
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(p.pseudo, 'Chauffeur') as prenom,
    p.annees_experience,
    p.tarif_journalier_chauffeur as tarif_journalier
  from public.profiles p
  where p.role = 'CHAUFFEUR'
    and p.statut_kyc = 'VERIFIE'
    and p.disponible_chauffeur = true
    and p.tarif_journalier_chauffeur is not null
  order by p.tarif_journalier_chauffeur asc, coalesce(p.pseudo, p.nom) asc
  limit greatest(1, least(coalesce(p_limite, 8), 40));
$$;

grant execute on function public.chauffeurs_disponibles(int) to anon, authenticated;
