// Edge Function "garage-ajouter-membre"
// Permet à un membre du garage déjà authentifié de créer un compte complet
// pour un nouveau membre d'équipe (rôle GARAGE), avec le mot de passe de son
// choix — pas d'email de code temporaire, pas de dépendance OAuth externe.
// Le rôle GARAGE ne peut jamais être auto-attribué via l'inscription publique
// (voir schema_garage.sql) : cette fonction est le seul chemin applicatif
// pour créer un compte garage, et elle est elle-même réservée aux appelants
// déjà membres du garage (vérifié ci-dessous).

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return reponseJson({ erreur: "Authentification requise" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAppelant = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: appelant },
  } = await supabaseAppelant.auth.getUser();
  if (!appelant) {
    return reponseJson({ erreur: "Authentification requise" }, 401);
  }

  const { data: profilAppelant } = await supabaseAppelant
    .from("profiles")
    .select("role")
    .eq("id", appelant.id)
    .single();

  if (profilAppelant?.role !== "GARAGE") {
    return reponseJson({ erreur: "Réservé au personnel du garage" }, 403);
  }

  let payload: { nom?: string; telephone?: string; email?: string; motDePasse?: string };
  try {
    payload = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps de requête invalide" }, 400);
  }

  const nom = (payload.nom ?? "").trim();
  const telephone = (payload.telephone ?? "").trim();
  const email = (payload.email ?? "").trim().toLowerCase();
  const motDePasse = payload.motDePasse ?? "";

  if (!nom || !telephone || !email || !motDePasse) {
    return reponseJson({ erreur: "Nom, téléphone, email et mot de passe sont requis." }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: listeExistante, error: erreurListe } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (erreurListe) {
    return reponseJson({ erreur: "Impossible de vérifier le compte." }, 500);
  }
  if (listeExistante.users.some((u) => (u.email ?? "").toLowerCase() === email)) {
    return reponseJson({ erreur: "Un compte existe déjà avec cet email." }, 409);
  }

  const { data: cree, error: erreurCreation } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: {
      nom,
      telephone,
      doit_changer_mot_de_passe: false,
    },
  });

  if (erreurCreation || !cree.user) {
    return reponseJson({ erreur: erreurCreation?.message || "Création du compte impossible" }, 400);
  }

  // Le trigger handle_new_user() ignore délibérément tout rôle autre que
  // PROPRIETAIRE/CHAUFFEUR dans les métadonnées (protection contre
  // l'auto-attribution du rôle GARAGE) : on promeut donc explicitement ici,
  // seulement atteignable après la vérification est_garage ci-dessus.
  const { error: erreurPromotion } = await supabaseAdmin
    .from("profiles")
    .update({ role: "GARAGE" })
    .eq("id", cree.user.id);

  if (erreurPromotion) {
    return reponseJson(
      { erreur: "Compte créé mais impossible de lui attribuer le rôle garage : " + erreurPromotion.message },
      500
    );
  }

  return reponseJson({ ok: true });
});
