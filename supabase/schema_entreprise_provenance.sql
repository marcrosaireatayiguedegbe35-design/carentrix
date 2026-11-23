-- Entreprise de provenance d'un véhicule — usage interne au garage uniquement.
-- À exécuter dans Supabase Dashboard > SQL Editor.
--
-- Cette colonne n'est jamais exposée côté locataire : la vue publique
-- (vehicules_publics) et la fonction de recherche (rechercher_vehicules)
-- listent leurs colonnes explicitement et ne l'incluent pas. Seul le garage,
-- qui a un accès direct à la table `vehicules` (policies garage_lit_tous_vehicules
-- / garage_insere_vehicules), peut la lire ou l'écrire.

alter table public.vehicules
  add column if not exists entreprise_provenance text;
