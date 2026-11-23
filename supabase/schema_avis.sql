-- Avis clients : note (1-5) + commentaire, laissés par le locataire après
-- une location clôturée. À exécuter dans Supabase Dashboard > SQL Editor,
-- après schema_photos_multiples.sql.
--
-- - Un seul avis par réservation (contrainte unique), possible uniquement
--   une fois la location CLOTUREE, et seulement par le locataire concerné.
-- - La table brute `avis` n'est lisible que par le garage (modération) ;
--   l'affichage public passe par la vue `avis_publics`, qui n'expose que le
--   pseudo de l'auteur — jamais son nom ni son téléphone.
-- - `vehicules_publics` et `mes_reservations` sont recréées pour exposer
--   respectively la note moyenne d'un véhicule et l'avis déjà laissé par le
--   locataire sur chacune de ses réservations.

create table if not exists public.avis (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id),
  locataire_id uuid not null references public.profiles(id),
  vehicule_id uuid not null references public.vehicules(id),
  note int not null check (note between 1 and 5),
  commentaire text,
  created_at timestamptz not null default now()
);

alter table public.avis enable row level security;

drop policy if exists "garage_lit_avis" on public.avis;
create policy "garage_lit_avis" on public.avis
  for select using (public.est_garage());

create or replace view public.avis_publics as
select
  a.id,
  a.vehicule_id,
  v.code_public as vehicule_code,
  a.note,
  a.commentaire,
  a.created_at,
  coalesce(p.pseudo, 'Client Carentrix') as auteur_pseudo
from public.avis a
join public.vehicules v on v.id = a.vehicule_id
left join public.profiles p on p.id = a.locataire_id
order by a.created_at desc;

grant select on public.avis_publics to anon, authenticated;

create or replace function public.laisser_avis(
  p_code_reservation text,
  p_note int,
  p_commentaire text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if p_note < 1 or p_note > 5 then
    raise exception 'La note doit être comprise entre 1 et 5';
  end if;

  select * into v_reservation from public.reservations where code_public = p_code_reservation;
  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_reservation.locataire_id <> auth.uid() then
    raise exception 'Vous ne pouvez laisser un avis que sur vos propres locations';
  end if;

  if v_reservation.statut <> 'CLOTUREE' then
    raise exception 'Vous pourrez laisser un avis une fois la location clôturée';
  end if;

  if exists (select 1 from public.avis where reservation_id = v_reservation.id) then
    raise exception 'Vous avez déjà laissé un avis pour cette location';
  end if;

  insert into public.avis (reservation_id, locataire_id, vehicule_id, note, commentaire)
  values (v_reservation.id, auth.uid(), v_reservation.vehicule_id, p_note, nullif(trim(p_commentaire), ''));
end;
$$;

grant execute on function public.laisser_avis(text, int, text) to authenticated;

-- ============================================================
-- vehicules_publics : ajoute la note moyenne et le nombre d'avis
-- (CREATE OR REPLACE VIEW autorise l'ajout de colonnes en fin de liste)
-- ============================================================

create or replace view public.vehicules_publics as
select
  v.id, v.code_public, v.marque, v.modele, v.annee, v.transmission, v.categorie, v.ville,
  v.prix_unitaire, v.unite_tarif, v.photos, v.disponible,
  coalesce(round(avg(a.note), 1), 0)::numeric as note_moyenne,
  count(a.id) as nb_avis
from public.vehicules v
left join public.avis a on a.vehicule_id = v.id
where v.disponible = true and v.controle_technique_ok = true
group by v.id;

grant select on public.vehicules_publics to anon, authenticated;

-- ============================================================
-- mes_reservations : expose l'avis déjà laissé (s'il existe) pour que
-- l'espace locataire sache s'il doit proposer "Laisser un avis" ou afficher
-- l'avis déjà soumis.
-- ============================================================

drop view if exists public.mes_reservations;
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
  c.pseudo as chauffeur_pseudo,
  a.note as avis_note,
  a.commentaire as avis_commentaire
from public.reservations r
join public.vehicules v on v.id = r.vehicule_id
left join public.profiles c on c.id = r.chauffeur_id
left join public.avis a on a.reservation_id = r.id
where r.locataire_id = auth.uid();

grant select on public.mes_reservations to authenticated;
