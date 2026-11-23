-- Permet au garage d'enregistrer la réception d'un paiement en espèces.
-- Jusqu'ici, un paiement CASH restait indéfiniment "EN_ATTENTE" (affiché
-- "À encaisser" dans /garage/reservations/:code) : rien ne permettait de le
-- marquer comme réglé une fois le client passé au garage.
--
-- Notifie aussi le locataire via un message système dans la conversation
-- de la réservation (déjà ouverte dès que la réservation est CONFIRMEE).
--
-- À exécuter dans Supabase Dashboard > SQL Editor, après schema_messagerie.sql
-- et schema_paiement_cash.sql (ou schema_fix_payer_reservation_ambiguous.sql).

create or replace function public.garage_encaisser_paiement_cash(p_code_reservation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_paiement_id uuid;
  v_conv_id uuid;
begin
  if not est_garage() then
    raise exception 'Accès réservé au personnel du garage';
  end if;

  select id into v_reservation_id
  from public.reservations
  where code_public = p_code_reservation;

  if v_reservation_id is null then
    raise exception 'Réservation introuvable';
  end if;

  select id into v_paiement_id
  from public.paiements
  where reservation_id = v_reservation_id
    and moyen = 'CASH'
    and statut = 'EN_ATTENTE'
  order by created_at desc
  limit 1;

  if v_paiement_id is null then
    raise exception 'Aucun paiement en espèces en attente pour cette réservation';
  end if;

  update public.paiements set statut = 'REUSSI' where id = v_paiement_id;

  select id into v_conv_id from public.conversations where reservation_id = v_reservation_id;
  if v_conv_id is not null then
    insert into public.messages (conversation_id, auteur_id, contenu, systeme)
    values (
      v_conv_id,
      null,
      'Le garage a confirmé la réception du paiement en espèces.',
      true
    );
  end if;
end;
$$;

grant execute on function public.garage_encaisser_paiement_cash(text) to authenticated;
