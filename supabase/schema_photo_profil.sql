-- Photo de profil facultative du client — à exécuter dans Supabase Dashboard > SQL Editor.
--
-- Bucket privé « avatars » : un dossier par utilisateur (son propre id), un seul fichier
-- avatar.jpg. Seul l'utilisateur et le garage peuvent le lire ; personne d'autre.
-- Aucune colonne ajoutée à public.profiles.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists "avatars_stockage_ajout" on storage.objects;
create policy "avatars_stockage_ajout" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_stockage_maj" on storage.objects;
create policy "avatars_stockage_maj" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_stockage_lecture" on storage.objects;
create policy "avatars_stockage_lecture" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.est_garage())
  );

drop policy if exists "avatars_stockage_suppression" on storage.objects;
create policy "avatars_stockage_suppression" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
