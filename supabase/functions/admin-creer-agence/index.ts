// Edge Function "admin-creer-agence"
// L'administration (rôle GARAGE) crée en une fois une agence partenaire et le
// compte de connexion de son responsable (rôle AGENCE, rattaché à l'agence).
// Le rôle AGENCE ne peut jamais être obtenu par l'inscription publique
// (trigger proteger_insertion_profil) : cette fonction est le seul chemin
// applicatif, réservé aux appelants déjà GARAGE.
//
// En cas d'échec après la création de l'agence, tout est annulé (compte et
// agence supprimés) pour ne jamais laisser d'agence sans accès ni de compte
// orphelin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUTS = ["ACTIF", "SUSPENDU", "EN_ATTENTE"];
const MOYENS_REVERSEMENT = ["MTN_MOMO", "MOOV_MONEY", "CELTIIS", "VIREMENT"];

function reponseJson(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type Payload = {
  nom?: string;
  responsableNom?: string;
  adresse?: string;
  ville?: string;
  email?: string;
  telephone?: string;
  tauxCommission?: number;
  statut?: string;
  reversementMoyen?: string | null;
  reversementNumero?: string | null;
  motDePasse?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return reponseJson({ erreur: "Authentification requise" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAppelant = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: appelant },
  } = await supabaseAppelant.auth.getUser();
  if (!appelant) return reponseJson({ erreur: "Authentification requise" }, 401);

  const { data: profilAppelant } = await supabaseAppelant
    .from("profiles")
    .select("role")
    .eq("id", appelant.id)
    .single();
  if (profilAppelant?.role !== "GARAGE") {
    return reponseJson({ erreur: "Réservé à l'administration" }, 403);
  }

  let p: Payload;
  try {
    p = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps de requête invalide" }, 400);
  }

  const nom = (p.nom ?? "").trim();
  const responsableNom = (p.responsableNom ?? "").trim();
  const email = (p.email ?? "").trim().toLowerCase();
  const telephone = (p.telephone ?? "").trim();
  const motDePasse = p.motDePasse ?? "";
  const taux = Number(p.tauxCommission);
  const statut = p.statut ?? "ACTIF";
  const reversementMoyen = p.reversementMoyen || null;

  if (!nom || !responsableNom || !email || !telephone) {
    return reponseJson({ erreur: "Nom de l'agence, responsable, email et téléphone sont requis." }, 400);
  }
  if (motDePasse.length < 8) {
    return reponseJson({ erreur: "Le mot de passe doit contenir au moins 8 caractères." }, 400);
  }
  if (!Number.isFinite(taux) || taux < 0 || taux > 100) {
    return reponseJson({ erreur: "La commission doit être comprise entre 0 et 100 %." }, 400);
  }
  if (!STATUTS.includes(statut)) {
    return reponseJson({ erreur: "Statut invalide." }, 400);
  }
  if (reversementMoyen && !MOYENS_REVERSEMENT.includes(reversementMoyen)) {
    return reponseJson({ erreur: "Moyen de reversement invalide." }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: agence, error: erreurAgence } = await supabaseAdmin
    .from("agences")
    .insert({
      nom,
      responsable_nom: responsableNom,
      adresse: (p.adresse ?? "").trim(),
      ville: (p.ville ?? "").trim(),
      email,
      telephone,
      taux_commission: Math.round(taux * 100) / 100,
      statut,
      reversement_moyen: reversementMoyen,
      reversement_numero: (p.reversementNumero ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (erreurAgence || !agence) {
    return reponseJson({ erreur: "Création de l'agence impossible : " + (erreurAgence?.message ?? "") }, 400);
  }

  const annulerAgence = () => supabaseAdmin.from("agences").delete().eq("id", agence.id);

  const { data: cree, error: erreurCreation } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: {
      nom: responsableNom,
      telephone,
      // Le responsable choisit son propre mot de passe à la première connexion.
      doit_changer_mot_de_passe: true,
    },
  });
  if (erreurCreation || !cree.user) {
    await annulerAgence();
    const message = erreurCreation?.message ?? "";
    const dejaPris = /already|registered|exists/i.test(message);
    return reponseJson(
      { erreur: dejaPris ? "Un compte existe déjà avec cet email." : "Création du compte impossible : " + message },
      dejaPris ? 409 : 400
    );
  }

  const { error: erreurPromotion } = await supabaseAdmin
    .from("profiles")
    .update({ role: "AGENCE", agence_id: agence.id, doit_changer_mot_de_passe: true })
    .eq("id", cree.user.id);
  if (erreurPromotion) {
    await supabaseAdmin.auth.admin.deleteUser(cree.user.id);
    await annulerAgence();
    return reponseJson({ erreur: "Impossible d'attribuer le rôle agence : " + erreurPromotion.message }, 500);
  }

  return reponseJson({ ok: true, agenceId: agence.id });
});
