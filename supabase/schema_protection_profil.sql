-- Protection des colonnes sensibles de public.profiles
-- À exécuter dans Supabase Dashboard > SQL Editor.
--
-- Problème corrigé : la règle « profil_maj_propre » laisse chaque utilisateur modifier TOUTES les
-- colonnes de sa propre ligne depuis l'application. Un client pouvait donc s'écrire lui-même
-- statut_kyc = 'VERIFIE' (dossier certifié sans documents) ou role = 'GARAGE'.
-- Après ce script, ces colonnes ne changent plus que par les fonctions du serveur
-- (soumettre_dossier_verification, garage_verifier_kyc, garage-ajouter-membre) ou depuis le SQL Editor.

create or replace function public.proteger_colonnes_profil()
returns trigger
language plpgsql
as $$
begin
  -- Sessions de l'application (clients connectés) : colonnes sensibles verrouillées.
  -- Les fonctions SECURITY DEFINER, la clé de service et le SQL Editor ne sont pas concernés.
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) ->> 'role') is distinct from (to_jsonb(old) ->> 'role')
       or (to_jsonb(new) ->> 'statut_kyc') is distinct from (to_jsonb(old) ->> 'statut_kyc')
       or (to_jsonb(new) ->> 'pseudo') is distinct from (to_jsonb(old) ->> 'pseudo') then
      raise exception 'Modification interdite : le rôle, le statut du dossier et le pseudo sont gérés par le garage.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_colonnes_profil on public.profiles;
create trigger proteger_colonnes_profil
  before update on public.profiles
  for each row execute function public.proteger_colonnes_profil();

-- ============================================================
-- VÉRIFICATIONS (lecture seule) — à lancer séparément pour contrôler votre base
-- ============================================================

-- 1) Qui est certifié sans avoir déposé les 4 documents ? (votre compte de test, créé en SQL, apparaît ici)
-- select p.id, p.nom, p.statut_kyc, count(d.*) as documents_deposes
-- from public.profiles p
-- left join public.documents_kyc d on d.utilisateur_id = p.id
-- where p.role = 'LOCATAIRE' and p.statut_kyc = 'VERIFIE'
-- group by p.id, p.nom, p.statut_kyc
-- having count(d.*) < 4;

-- 2) La validation du garage vérifie-t-elle les documents ? Le texte doit contenir « Documents manquants ».
-- select pg_get_functiondef('public.garage_verifier_kyc(uuid,text)'::regprocedure);

-- 3) L'inscription publique peut-elle créer un rôle GARAGE ? Le texte ne doit PAS contenir 'GARAGE'.
-- select pg_get_functiondef('public.handle_new_user()'::regprocedure);
