-- Espace Propriétaire — à exécuter APRÈS schema.sql (et seed.sql si utilisé),
-- dans Supabase Dashboard > SQL Editor.

-- ============================================================
-- Verrouillage des champs sensibles d'un véhicule
-- Le propriétaire choisit marque/modèle/prix/photos, mais ne peut jamais :
--  - s'attribuer un autre proprietaire_id
--  - changer son propre code_public
--  - se déclarer lui-même "contrôle technique OK" ou "disponible" (réservé au garage,
--    qui validera ces champs dans le futur back-office)
-- ============================================================

create or replace function public.verrouiller_champs_vehicule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.proprietaire_id := auth.uid();
    new.disponible := false;
    new.controle_technique_ok := false;
    if new.code_public is null or new.code_public = '' then
      new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      while exists(select 1 from public.vehicules where code_public = new.code_public) loop
        new.code_public := 'BEN-CAR-' || floor(1000 + random() * 9000)::int;
      end loop;
    end if;
  elsif tg_op = 'UPDATE' then
    new.proprietaire_id := old.proprietaire_id;
    new.code_public := old.code_public;
    new.controle_technique_ok := old.controle_technique_ok;
  end if;
  return new;
end;
$$;

drop trigger if exists verrouille_vehicule on public.vehicules;
create trigger verrouille_vehicule
  before insert or update on public.vehicules
  for each row execute function public.verrouiller_champs_vehicule();

-- ============================================================
-- RLS : le propriétaire gère ses propres véhicules
-- ============================================================

create policy "proprietaire_lit_ses_vehicules" on public.vehicules
  for select using (proprietaire_id = auth.uid());

create policy "proprietaire_ajoute_vehicule" on public.vehicules
  for insert with check (proprietaire_id = auth.uid());

create policy "proprietaire_modifie_son_vehicule" on public.vehicules
  for update using (proprietaire_id = auth.uid()) with check (proprietaire_id = auth.uid());

-- ============================================================
-- Vue des réservations pour un propriétaire : jamais l'identité du locataire,
-- seulement les codes, dates, montants, et le montant net après commission.
-- ============================================================

create or replace view public.reservations_proprietaire as
select
  r.code_public,
  r.statut,
  r.date_debut,
  r.date_fin,
  r.montant_total,
  round(r.montant_total * 0.90)::int as montant_proprietaire, -- commission plateforme : 10 %
  v.code_public as vehicule_code,
  v.marque,
  v.modele
from public.reservations r
join public.vehicules v on v.id = r.vehicule_id
where v.proprietaire_id = auth.uid();

grant select on public.reservations_proprietaire to authenticated;
