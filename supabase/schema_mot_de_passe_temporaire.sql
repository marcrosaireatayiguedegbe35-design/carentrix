-- Mot de passe temporaire envoyé par email — à exécuter APRÈS schema_documents.sql,
-- dans Supabase Dashboard > SQL Editor.
--
-- L'inscription publique ne passe plus par supabase.auth.signUp() côté client :
-- le frontend appelle l'Edge Function "inscription", qui génère un mot de passe
-- temporaire, crée le compte via l'API admin (email déjà confirmé, puisque la
-- preuve de possession de l'email est justement l'usage de ce mot de passe), et
-- l'envoie par email. L'utilisateur doit le changer avant d'accéder à son espace.

alter table public.profiles
  add column if not exists doit_changer_mot_de_passe boolean not null default true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, nom, telephone, statut_kyc, doit_changer_mot_de_passe)
  values (
    new.id,
    case when new.raw_user_meta_data->>'role' = 'PROPRIETAIRE' then 'PROPRIETAIRE' else 'LOCATAIRE' end,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'telephone', new.id::text),
    'NON_VERIFIE',
    coalesce((new.raw_user_meta_data->>'doit_changer_mot_de_passe')::boolean, true)
  );
  return new;
end;
$$;

-- Seul point d'écriture pour lever ce drapeau : l'utilisateur doit d'abord avoir
-- réellement changé son mot de passe via supabase.auth.updateUser().
create or replace function public.marquer_mot_de_passe_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  update public.profiles set doit_changer_mot_de_passe = false where id = auth.uid();
end;
$$;

grant execute on function public.marquer_mot_de_passe_change() to authenticated;
