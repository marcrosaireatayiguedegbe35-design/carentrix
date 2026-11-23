-- Paiement en ligne réel via FedaPay — à exécuter APRÈS schema_tarification_horaire.sql,
-- dans Supabase Dashboard > SQL Editor.
--
-- Le paiement simulé (fonction payer_reservation) est conservé tel quel comme
-- filet de secours pour un encaissement manuel par le garage (espèces, cas
-- exceptionnel), mais n'est plus utilisé par défaut par l'espace Locataire :
-- celui-ci passe désormais par les Edge Functions creer-paiement-fedapay et
-- confirmer-paiement-fedapay, qui parlent réellement à l'API FedaPay.

alter table public.paiements drop constraint if exists paiements_moyen_check;
alter table public.paiements add constraint paiements_moyen_check
  check (moyen in ('MTN_MOMO', 'MOOV_MONEY', 'CARTE', 'FEDAPAY'));
