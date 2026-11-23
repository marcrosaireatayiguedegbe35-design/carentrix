-- Compte de démonstration pour le personnel du garage.
-- À exécuter APRÈS schema_garage.sql, dans Supabase Dashboard > SQL Editor.
--
-- Un compte GARAGE ne peut jamais être créé via l'inscription publique de
-- l'application (voir le correctif de sécurité dans schema_garage.sql) :
-- il faut le créer ici, en tant qu'administrateur, puis promouvoir
-- explicitement son profil au rôle GARAGE.
-- Les colonnes *_token/*_change sont explicitement mises à '' (jamais NULL) : GoTrue échoue
-- sinon la connexion avec "Database error querying schema" en lisant ces colonnes.

do $$
declare
  v_garage uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'garage@demo.location-benin.bj', crypt('demo-password-123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"nom":"Personnel Garage Demo","telephone":"+22990000099","doit_changer_mot_de_passe":false}',
    '', '', '', '', '', '', '', ''
  )
  returning id into v_garage;

  -- Promotion manuelle : c'est la SEULE façon légitime d'obtenir le rôle GARAGE.
  update public.profiles set role = 'GARAGE', statut_kyc = 'VERIFIE' where id = v_garage;
end $$;
