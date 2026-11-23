-- Documents KYC (pièces justificatives) — à exécuter APRÈS schema_garage.sql,
-- dans Supabase Dashboard > SQL Editor.
--
-- Propriétaire : pièce d'identité + justificatif de propriété du véhicule.
-- Locataire : pièce d'identité + permis de conduire + justificatif de résidence
-- au Bénin + photo de profil (visage). Ces documents ne sont jamais visibles
-- par l'autre partie — uniquement par leur propriétaire et par le garage.

-- ============================================================
-- Table des documents
-- ============================================================

create table if not exists public.documents_kyc (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'PIECE_IDENTITE', 'PERMIS_CONDUIRE', 'JUSTIFICATIF_PROPRIETE', 'JUSTIFICATIF_RESIDENCE', 'PHOTO_PROFIL'
  )),
  chemin_fichier text not null,
  created_at timestamptz not null default now(),
  unique (utilisateur_id, type)
);

alter table public.documents_kyc enable row level security;

create policy "documents_kyc_lecture_propre_ou_garage" on public.documents_kyc
  for select using (utilisateur_id = auth.uid() or public.est_garage());

create policy "documents_kyc_ajout_propre" on public.documents_kyc
  for insert with check (utilisateur_id = auth.uid());

create policy "documents_kyc_maj_propre" on public.documents_kyc
  for update using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());

-- ============================================================
-- Stockage : bucket privé, un dossier par utilisateur (son propre id).
-- Personne d'autre que l'utilisateur et le garage ne peut lire ces fichiers.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documents-kyc', 'documents-kyc', false)
on conflict (id) do nothing;

create policy "documents_kyc_stockage_ajout" on storage.objects
  for insert with check (
    bucket_id = 'documents-kyc' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_kyc_stockage_maj" on storage.objects
  for update using (
    bucket_id = 'documents-kyc' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'documents-kyc' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_kyc_stockage_lecture" on storage.objects
  for select using (
    bucket_id = 'documents-kyc'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.est_garage())
  );

-- ============================================================
-- La validation KYC (VERIFIE) exige désormais que les documents requis pour
-- le rôle de l'utilisateur aient été déposés — impossible de valider un
-- dossier incomplet.
-- ============================================================

create or replace function public.garage_verifier_kyc(p_utilisateur_id uuid, p_statut text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_types_requis text[];
  v_manquants text[];
begin
  if not est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;
  if p_statut not in ('VERIFIE', 'REJETE', 'EN_ATTENTE') then
    raise exception 'Statut invalide';
  end if;

  if p_statut = 'VERIFIE' then
    select role into v_role from public.profiles where id = p_utilisateur_id;

    v_types_requis := case
      when v_role = 'PROPRIETAIRE' then array['PIECE_IDENTITE', 'JUSTIFICATIF_PROPRIETE']
      when v_role = 'LOCATAIRE' then array['PIECE_IDENTITE', 'PERMIS_CONDUIRE', 'JUSTIFICATIF_RESIDENCE', 'PHOTO_PROFIL']
      else array[]::text[]
    end;

    select array_agg(t) into v_manquants
    from unnest(v_types_requis) t
    where not exists (
      select 1 from public.documents_kyc d where d.utilisateur_id = p_utilisateur_id and d.type = t
    );

    if v_manquants is not null and array_length(v_manquants, 1) > 0 then
      raise exception 'Documents manquants avant vérification : %', array_to_string(v_manquants, ', ');
    end if;
  end if;

  update public.profiles set statut_kyc = p_statut where id = p_utilisateur_id;
end;
$$;
