// Crée une transaction FedaPay pour une réservation en attente de paiement,
// puis génère un lien/jeton de paiement (Checkout.js l'utilisera côté client).
//
// Le montant est entièrement recalculé ici à partir de la réservation en base
// (jamais transmis par le client) : impossible pour un locataire de payer un
// montant différent de celui fixé par creer_reservation().

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

// L'app et les utilisateurs écrivent désormais les numéros béninois au format
// national à 10 chiffres (préfixe "01", depuis la réforme ARCEP de nov. 2024),
// mais l'API FedaPay attend toujours le numéro local historique à 8 chiffres
// (sans le "01", le "country: bj" faisant déjà office d'indicatif +229).
// Sans ce retrait, FedaPay accepte silencieusement la requête mais ne relaie
// jamais la demande de paiement à l'opérateur, laissant le client bloqué sur
// "en attente de confirmation".
function numeroLocalFedapay(chiffres: string): string {
  return chiffres.length > 9 && chiffres.startsWith("01") ? chiffres.slice(2) : chiffres;
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

  let payload: { codeReservation?: string; mode?: string; telephone?: string };
  try {
    payload = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps de requête invalide" }, 400);
  }

  const codeReservation = payload.codeReservation;
  if (!codeReservation) return reponseJson({ erreur: "Code de réservation manquant" }, 400);

  // Modes pris en charge par FedaPay pour un paiement direct (sans redirection
  // vers la page de paiement hébergée) : l'app envoie l'ordre de paiement à
  // l'opérateur, qui affiche une demande de confirmation sur le téléphone du client.
  const MODES_DIRECTS = new Set(["mtn_open", "moov"]);
  const modeDirect = payload.mode && MODES_DIRECTS.has(payload.mode) ? payload.mode : null;

  if (payload.mode && !modeDirect) {
    return reponseJson({ erreur: "Mode de paiement direct non pris en charge." }, 400);
  }

  // Depuis la réforme de la numérotation de l'ARCEP (2024), tous les numéros
  // béninois comptent 10 chiffres et commencent par "01".
  const telephoneDirectChiffres = (payload.telephone || "").replace(/\D/g, "");
  if (modeDirect && !/^01\d{8}$/.test(telephoneDirectChiffres)) {
    return reponseJson({ erreur: "Numéro de téléphone invalide." }, 400);
  }

  // Lu avec le JWT de l'appelant : la policy RLS "reservations_lecture_propre"
  // garantit qu'un locataire ne peut lire qu'une réservation qui lui appartient.
  const { data: reservation, error: erreurReservation } = await supabase
    .from("reservations")
    .select("id, code_public, montant_total, caution, statut")
    .eq("code_public", codeReservation)
    .single();

  if (erreurReservation || !reservation) return reponseJson({ erreur: "Réservation introuvable" }, 404);
  if (reservation.statut !== "EN_ATTENTE_PAIEMENT" && reservation.statut !== "EN_ATTENTE") {
    return reponseJson({ erreur: "Cette réservation n'est plus en attente de paiement" }, 409);
  }

  const { data: profil } = await supabase.from("profiles").select("nom, telephone").eq("id", user.id).single();
  const nomComplet = (profil?.nom || "Client Location Benin").trim().split(/\s+/);
  const prenom = nomComplet[0] || "Client";
  const nom = nomComplet.slice(1).join(" ") || prenom;
  const telephoneChiffres = modeDirect ? telephoneDirectChiffres : (profil?.telephone || "").replace(/\D/g, "");

  const montant = reservation.montant_total + reservation.caution;
  const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY")!;

  const creationRes = await fetch(`${baseFedapay()}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: `Réservation ${reservation.code_public} — Location Bénin`,
      amount: montant,
      currency: { iso: "XOF" },
      callback_url: `${req.headers.get("origin") || ""}/paiement/${reservation.code_public}`,
      customer: {
        firstname: prenom,
        lastname: nom,
        email: user.email,
        ...(telephoneChiffres
          ? { phone_number: { number: numeroLocalFedapay(telephoneChiffres), country: "bj" } }
          : {}),
      },
    }),
  });

  if (!creationRes.ok) {
    const detail = await creationRes.text();
    console.error("Échec création transaction FedaPay", creationRes.status, detail);
    return reponseJson({ erreur: "Impossible de créer la transaction de paiement." }, 502);
  }

  const transactionBrute = await creationRes.json();
  console.log("Réponse création transaction FedaPay:", JSON.stringify(transactionBrute));
  // Certaines réponses FedaPay enveloppent la ressource sous une clé
  // "v1/transaction" plutôt que de renvoyer ses champs à la racine.
  const transaction = transactionBrute?.["v1/transaction"] ?? transactionBrute;
  const transactionId = transaction.id;

  if (!transactionId) {
    console.error("Transaction FedaPay créée sans identifiant exploitable", JSON.stringify(transactionBrute));
    return reponseJson({ erreur: "Réponse inattendue de FedaPay lors de la création de la transaction." }, 502);
  }

  const tokenRes = await fetch(`${baseFedapay()}/transactions/${transactionId}/token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    console.error("Échec génération token FedaPay", tokenRes.status, detail);
    return reponseJson({ erreur: "Impossible de générer le lien de paiement." }, 502);
  }

  const tokenDataBrute = await tokenRes.json();
  console.log("Réponse token FedaPay:", JSON.stringify(tokenDataBrute));
  const tokenData = tokenDataBrute?.["v1/token"] ?? tokenDataBrute;

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error: erreurInsert } = await supabaseAdmin.from("paiements").insert({
    reservation_id: reservation.id,
    montant,
    moyen: "FEDAPAY",
    statut: "EN_ATTENTE",
    reference: String(transactionId),
  });

  if (erreurInsert) {
    console.error("Échec insertion paiement", erreurInsert);
    return reponseJson({ erreur: "Erreur lors de l'enregistrement du paiement." }, 500);
  }

  if (modeDirect) {
    // Envoie directement l'ordre de paiement à l'opérateur (FedaPay affiche alors
    // une demande de confirmation sur le téléphone du client) : aucune page
    // FedaPay n'est montrée, le client reste sur notre site.
    const paiementDirectRes = await fetch(`${baseFedapay()}/${modeDirect}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: tokenData.token,
        phone_number: { number: numeroLocalFedapay(telephoneDirectChiffres), country: "bj" },
      }),
    });

    if (!paiementDirectRes.ok) {
      const detail = await paiementDirectRes.text();
      console.error("Échec paiement direct FedaPay", paiementDirectRes.status, detail);
      return reponseJson({ erreur: "Impossible de lancer le paiement avec ce numéro." }, 502);
    }

    console.log("Réponse paiement direct FedaPay:", await paiementDirectRes.text());
    return reponseJson({ transactionId, montant, direct: true });
  }

  return reponseJson({ transactionId, checkoutUrl: tokenData.url, montant });
});
