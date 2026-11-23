// Vérifie le statut réel d'une transaction FedaPay directement auprès de
// l'API FedaPay (GET /v1/transactions/{id}, authentifié avec notre clé
// secrète) plutôt que de faire confiance au callback client Checkout.js.
// Un locataire ne peut donc jamais confirmer un paiement qu'il n'a pas
// réellement effectué : seule une réponse "approved" de FedaPay elle-même
// fait foi.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reponseJson(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function baseFedapay(): string {
  const env = (Deno.env.get("FEDAPAY_ENVIRONMENT") || "live").toLowerCase();
  return env === "live" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return reponseJson({ erreur: "Authentification requise" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reponseJson({ erreur: "Authentification requise" }, 401);

  let payload: { transactionId?: string | number };
  try {
    payload = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps de requête invalide" }, 400);
  }

  const transactionId = payload.transactionId;
  if (!transactionId) return reponseJson({ erreur: "Identifiant de transaction manquant" }, 400);

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: paiement, error: erreurPaiement } = await supabaseAdmin
    .from("paiements")
    .select(
      "id, statut, reservation_id, reservations!inner(id, code_public, statut, locataire_id, vehicule_id, chauffeur_id, date_debut, date_fin)"
    )
    .eq("reference", String(transactionId))
    .single();

  if (erreurPaiement || !paiement) return reponseJson({ erreur: "Paiement introuvable" }, 404);

  const reservation = (paiement as any).reservations;
  if (reservation.locataire_id !== user.id) {
    return reponseJson({ erreur: "Accès non autorisé" }, 403);
  }

  // Déjà confirmé (ex. double appel) : on renvoie l'état actuel sans re-vérifier.
  if (paiement.statut === "REUSSI") {
    return reponseJson({ statutPaiement: "REUSSI", statutReservation: reservation.statut });
  }

  const verifRes = await fetch(`${baseFedapay()}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${Deno.env.get("FEDAPAY_SECRET_KEY")!}` },
  });

  if (!verifRes.ok) {
    console.error("Échec vérification transaction FedaPay", verifRes.status, await verifRes.text());
    return reponseJson({ erreur: "Impossible de vérifier le paiement pour le moment." }, 502);
  }

  const transaction = await verifRes.json();
  const statutFedapay = transaction.status;

  if (statutFedapay === "approved") {
    // Tant qu'une réservation n'est pas finalisée, elle ne bloque pas les dates.
    // Au paiement : refuser si quelqu'un d'autre a déjà confirmé le créneau (véhicule ou chauffeur).
    const { data: autreVehicule } = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("vehicule_id", reservation.vehicule_id)
      .neq("id", reservation.id)
      .in("statut", ["CONFIRMEE", "VEHICULE_REMIS", "EN_LOCATION"])
      .lt("date_debut", reservation.date_fin)
      .gt("date_fin", reservation.date_debut)
      .limit(1)
      .maybeSingle();

    if (autreVehicule) {
      await supabaseAdmin.from("paiements").update({ statut: "ECHOUE" }).eq("id", paiement.id);
      await supabaseAdmin.from("reservations").update({ statut: "ANNULEE" }).eq("id", reservation.id);
      return reponseJson({
        erreur: "Ce créneau vient d'être réservé par un autre locataire. Votre réservation a été annulée.",
      }, 409);
    }

    if (reservation.chauffeur_id) {
      const { data: autreChauffeur } = await supabaseAdmin
        .from("reservations")
        .select("id")
        .eq("chauffeur_id", reservation.chauffeur_id)
        .neq("id", reservation.id)
        .in("statut", ["CONFIRMEE", "VEHICULE_REMIS", "EN_LOCATION"])
        .lt("date_debut", reservation.date_fin)
        .gt("date_fin", reservation.date_debut)
        .limit(1)
        .maybeSingle();

      if (autreChauffeur) {
        await supabaseAdmin.from("paiements").update({ statut: "ECHOUE" }).eq("id", paiement.id);
        await supabaseAdmin.from("reservations").update({ statut: "ANNULEE" }).eq("id", reservation.id);
        return reponseJson({
          erreur: "Ce chauffeur vient d'être réservé sur ces dates. Votre réservation a été annulée.",
        }, 409);
      }
    }

    await supabaseAdmin.from("paiements").update({ statut: "REUSSI" }).eq("id", paiement.id);
    if (reservation.statut === "EN_ATTENTE_PAIEMENT" || reservation.statut === "EN_ATTENTE") {
      await supabaseAdmin.from("reservations").update({ statut: "CONFIRMEE" }).eq("id", reservation.id);
    }
    return reponseJson({ statutPaiement: "REUSSI", statutReservation: "CONFIRMEE" });
  }

  if (statutFedapay === "declined" || statutFedapay === "canceled") {
    await supabaseAdmin.from("paiements").update({ statut: "ECHOUE" }).eq("id", paiement.id);
    return reponseJson({ statutPaiement: "ECHOUE", statutReservation: reservation.statut });
  }

  return reponseJson({ statutPaiement: "EN_ATTENTE", statutReservation: reservation.statut });
});
