// Edge Function "inscription"
// Envoie un code à 6 chiffres par l'API Gmail (HTTPS, pas SMTP — Deno Deploy /
// Supabase Edge Functions bloque les connexions SMTP sortantes sur les ports
// 25/465/587), crée ou met à jour le compte.
// Secrets : GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

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

function genererCode(): string {
  const octets = new Uint8Array(3);
  crypto.getRandomValues(octets);
  const n = (octets[0]! << 16) | (octets[1]! << 8) | octets[2]!;
  return String(n % 1_000_000).padStart(6, "0");
}

async function obtenirAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`refresh_token_echec:${res.status}:${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

function encoderBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binaire = "";
  bytes.forEach((b) => (binaire += String.fromCharCode(b)));
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encoderSujetUtf8(sujet: string): string {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(sujet)))}?=`;
}

async function envoyerCodeGmailAPI(params: {
  accessToken: string;
  gmailUser: string;
  destinataire: string;
  nom: string;
  code: string;
}) {
  const { accessToken, gmailUser, destinataire, nom, code } = params;
  const html = `
    <p>Bonjour ${nom},</p>
    <p>Voici votre code de vérification Carentrix :</p>
    <p style="font-size:1.8em;font-weight:bold;letter-spacing:6px;">${code}</p>
    <p>Saisissez ce code dans l'application pour activer votre compte, puis choisissez
    votre mot de passe.</p>
    <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  `;

  const message = [
    `From: Carentrix <${gmailUser}>`,
    `To: ${destinataire}`,
    `Subject: ${encoderSujetUtf8("Votre code Carentrix")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
  ].join("\r\n");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoderBase64Url(message) }),
  });

  if (!res.ok) {
    throw new Error(`gmail_api_echec:${res.status}:${await res.text()}`);
  }
}

function messageErreurEmail(erreur: unknown): string {
  const texte = String((erreur as Error)?.message ?? erreur ?? "");
  if (texte.includes("refresh_token_echec")) {
    return "Configuration Google OAuth invalide (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).";
  }
  if (texte.includes("gmail_api_echec")) {
    return "L'envoi via l'API Gmail a échoué. Vérifiez que le scope gmail.send est autorisé.";
  }
  return "L'envoi du code par email a échoué. Veuillez réessayer.";
}

async function trouverUtilisateurParEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  emailNorm: string
) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => (u.email ?? "").toLowerCase() === emailNorm) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  let payload: {
    nom?: string;
    telephone?: string;
    email?: string;
    role?: string;
    etape?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return reponseJson({ erreur: "Corps de requête invalide" }, 400);
  }

  const { nom, telephone, email, role, etape } = payload;
  const emailNorm = (email ?? "").trim().toLowerCase();
  const nomNorm = (nom ?? "").trim();
  const telephoneNorm = (telephone ?? "").trim();
  const roleNorm = role ?? "";

  if (!emailNorm) {
    return reponseJson({ erreur: "Email requis." }, 400);
  }

  const gmailUser = Deno.env.get("GMAIL_USER")?.trim();
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")?.trim();
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")?.trim();
  const googleRefreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN")?.trim();
  if (!gmailUser || !googleClientId || !googleClientSecret || !googleRefreshToken) {
    return reponseJson(
      {
        erreur:
          "Configuration Google OAuth manquante (GMAIL_USER / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).",
      },
      500
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const estRenvoi = etape === "renvoyer";

  if (!estRenvoi && (!nomNorm || !telephoneNorm || !["PROPRIETAIRE", "LOCATAIRE"].includes(roleNorm))) {
    return reponseJson({ erreur: "Nom, téléphone et rôle sont requis." }, 400);
  }

  let utilisateur = null;
  try {
    utilisateur = await trouverUtilisateurParEmail(supabaseAdmin, emailNorm);
  } catch {
    return reponseJson({ erreur: "Impossible de vérifier le compte." }, 500);
  }

  if (estRenvoi && !utilisateur) {
    return reponseJson({ erreur: "Aucun compte en attente pour cet email." }, 400);
  }

  const code = genererCode();
  const nomEmail =
    nomNorm || (utilisateur?.user_metadata?.nom as string | undefined) || "utilisateur";
  const telephoneFinal =
    telephoneNorm || (utilisateur?.user_metadata?.telephone as string | undefined) || "";
  const roleFinal =
    (["PROPRIETAIRE", "LOCATAIRE"].includes(roleNorm)
      ? roleNorm
      : (utilisateur?.user_metadata?.role as string | undefined)) || "LOCATAIRE";

  // Envoi Gmail avant toute écriture Auth.
  try {
    const accessToken = await obtenirAccessToken(googleClientId, googleClientSecret, googleRefreshToken);
    await envoyerCodeGmailAPI({
      accessToken,
      gmailUser,
      destinataire: emailNorm,
      nom: nomEmail,
      code,
    });
  } catch (erreurEmail) {
    console.error("Échec envoi email", erreurEmail);
    return reponseJson({ erreur: messageErreurEmail(erreurEmail) }, 500);
  }

  if (utilisateur) {
    const { error: erreurMaj } = await supabaseAdmin.auth.admin.updateUserById(utilisateur.id, {
      password: code,
      email_confirm: true,
      user_metadata: {
        ...utilisateur.user_metadata,
        nom: nomEmail,
        telephone: telephoneFinal || utilisateur.user_metadata?.telephone,
        role: roleFinal,
        doit_changer_mot_de_passe: true,
      },
    });
    if (erreurMaj) {
      return reponseJson({ erreur: erreurMaj.message }, 500);
    }
    return reponseJson({ ok: true, renvoi: true });
  }

  const { data: cree, error: erreurCreation } = await supabaseAdmin.auth.admin.createUser({
    email: emailNorm,
    password: code,
    email_confirm: true,
    user_metadata: {
      nom: nomEmail,
      telephone: telephoneFinal,
      role: roleFinal,
      doit_changer_mot_de_passe: true,
    },
  });

  if (erreurCreation || !cree.user) {
    // Course possible : compte créé entre-temps → retenter en mise à jour.
    if (erreurCreation?.message?.includes("already been registered")) {
      const existant = await trouverUtilisateurParEmail(supabaseAdmin, emailNorm);
      if (existant) {
        const { error: erreurMaj } = await supabaseAdmin.auth.admin.updateUserById(existant.id, {
          password: code,
          email_confirm: true,
          user_metadata: {
            ...existant.user_metadata,
            nom: nomEmail,
            telephone: telephoneFinal,
            role: roleFinal,
            doit_changer_mot_de_passe: true,
          },
        });
        if (erreurMaj) return reponseJson({ erreur: erreurMaj.message }, 500);
        return reponseJson({ ok: true, renvoi: true });
      }
    }
    return reponseJson(
      { erreur: erreurCreation?.message || "Création du compte impossible" },
      400
    );
  }

  return reponseJson({ ok: true });
});
