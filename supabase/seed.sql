-- Données de démonstration : 3 propriétaires + 5 véhicules disponibles à la location.
-- À exécuter APRÈS schema.sql, dans Supabase Dashboard > SQL Editor.
-- Crée directement des comptes dans auth.users (technique de seed réservée à la console
-- d'administration) : le trigger on_auth_user_created crée automatiquement leur profil.
-- Les colonnes *_token/*_change sont explicitement mises à '' (jamais NULL) : GoTrue échoue
-- sinon la connexion avec "Database error querying schema" en lisant ces colonnes.

do $$
declare
  v_prop_a uuid;
  v_prop_b uuid;
  v_prop_c uuid;
begin
  -- Propriétaire A
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'proprietaire.a@demo.location-benin.bj', crypt('demo-password-123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"PROPRIETAIRE","nom":"Propriétaire A","telephone":"+22990000001","doit_changer_mot_de_passe":false}',
    '', '', '', '', '', '', '', ''
  )
  returning id into v_prop_a;

  -- Propriétaire B
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'proprietaire.b@demo.location-benin.bj', crypt('demo-password-123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"PROPRIETAIRE","nom":"Propriétaire B","telephone":"+22990000002","doit_changer_mot_de_passe":false}',
    '', '', '', '', '', '', '', ''
  )
  returning id into v_prop_b;

  -- Propriétaire C
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'proprietaire.c@demo.location-benin.bj', crypt('demo-password-123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"PROPRIETAIRE","nom":"Propriétaire C","telephone":"+22990000003","doit_changer_mot_de_passe":false}',
    '', '', '', '', '', '', '', ''
  )
  returning id into v_prop_c;

  -- Le déclencheur verrouiller_champs_vehicule (schema_proprietaire.sql) force
  -- disponible/controle_technique_ok à false sur tout INSERT, y compris depuis
  -- l'éditeur SQL : on le désactive le temps de créer des véhicules déjà validés.
  alter table public.vehicules disable trigger verrouille_vehicule;

  insert into public.vehicules
    (code_public, proprietaire_id, marque, modele, annee, transmission, categorie, ville, prix_unitaire, unite_tarif, photos, disponible, controle_technique_ok)
  values
    ('BEN-CAR-001', v_prop_a, 'Toyota', 'Corolla', 2022, 'AUTOMATIQUE', 'BERLINE', 'Cotonou', 25000, 'JOUR', array['https://images.unsplash.com/photo-1623869675184-6d0e6e0a2c1f'], true, true),
    ('BEN-CAR-002', v_prop_b, 'Hyundai', 'Tucson', 2021, 'AUTOMATIQUE', 'SUV', 'Cotonou', 40000, 'JOUR', array['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf'], true, true),
    ('BEN-CAR-003', v_prop_c, 'Kia', 'Picanto', 2020, 'MANUELLE', 'CITADINE', 'Abomey-Calavi', 15000, 'JOUR', array['https://images.unsplash.com/photo-1541899481282-d53bffe3c35d'], true, true),
    ('BEN-CAR-004', v_prop_a, 'Toyota', 'Hiace', 2019, 'MANUELLE', 'MINIBUS', 'Porto-Novo', 55000, 'JOUR', array['https://images.unsplash.com/photo-1519641471654-76ce0107ad1b'], true, true),
    ('BEN-CAR-005', v_prop_b, 'Ford', 'Ranger', 2023, 'AUTOMATIQUE', 'PICKUP', 'Cotonou', 45000, 'JOUR', array['https://images.unsplash.com/photo-1595820038742-fa9d43c7a0e2'], true, true),
    ('BEN-CAR-006', v_prop_c, 'Suzuki', 'Swift', 2021, 'MANUELLE', 'CITADINE', 'Cotonou', 2500, 'HEURE', array['https://images.unsplash.com/photo-1541899481282-d53bffe3c35d'], true, true);

  alter table public.vehicules enable trigger verrouille_vehicule;
end $$;
