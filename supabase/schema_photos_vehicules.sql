-- Photos de véhicules — à exécuter dans Supabase Dashboard > SQL Editor.
-- Bucket public : les images s'affichent dans le catalogue sans URL signée.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicules-photos',
  'vehicules-photos',
  true,
  5242880, -- 5 Mo
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicules_photos_ajout" on storage.objects;
drop policy if exists "vehicules_photos_maj" on storage.objects;
drop policy if exists "vehicules_photos_suppression" on storage.objects;
drop policy if exists "vehicules_photos_lecture" on storage.objects;

create policy "vehicules_photos_ajout"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vehicules-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vehicules_photos_maj"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'vehicules-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'vehicules-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vehicules_photos_suppression"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vehicules-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vehicules_photos_lecture"
  on storage.objects for select
  using (bucket_id = 'vehicules-photos');
