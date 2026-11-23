// Petit service d'inscription : envoie un code à 6 chiffres par Gmail SMTP
// (mot de passe temporaire) puis crée/met à jour le compte Supabase.
//
// Vit en dehors de Supabase Edge Functions (Deno Deploy) exprès : cette
// plateforme bloque les connexions SMTP sortantes (ports 25/465/587) pour
// éviter les abus, donc l'envoi Gmail y échoue systématiquement. Un service
// Node classique (Render Web Service) n'a pas cette restriction.
//
// Variables d'environnement requises :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   + BREVO_API_KEY et MAIL_FROM (recommandé) OU GMAIL_USER et GMAIL_APP_PASSWORD

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

function genererCode() {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

function creerTransporteur() {
  const gmailUser = (process.env.GMAIL_USER || "").trim();
  const gmailPassword = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!gmailUser || !gmailPassword) {
    throw new Error("config_gmail_manquante");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword },
  });
}

function contenuEmail({ nom, code }) {
  return `
      <p>Bonjour ${nom},</p>
      <p>Voici votre code de vérification Carentrix :</p>
      <p style="font-size:1.8em;font-weight:bold;letter-spacing:6px;">${code}</p>
      <p>Saisissez ce code dans l'application pour activer votre compte, puis choisissez
      votre mot de passe.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `;
}

// Envoi via l'API HTTPS de Brevo (pas de SMTP : les offres gratuites de Render
// bloquent les ports SMTP sortants). Expéditeur = adresse vérifiée dans Brevo.
async function envoyerCodeBrevo({ destinataire, nom, code }) {
  const expediteur = (process.env.MAIL_FROM || process.env.GMAIL_USER || "").trim();
  if (!expediteur) throw new Error("config_expediteur_manquante");
  const reponse = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY.trim(),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Carentrix", email: expediteur },
      to: [{ email: destinataire }],
      subject: "Votre code Carentrix",
      htmlContent: contenuEmail({ nom, code }),
    }),
  });
  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => "");
    throw new Error(`brevo_${reponse.status}: ${detail.slice(0, 300)}`);
  }
}

async function envoyerCodeGmail({ destinataire, nom, code }) {
  const gmailUser = process.env.GMAIL_USER.trim();
  const transporteur = creerTransporteur();
  await transporteur.sendMail({
    from: `Carentrix <${gmailUser}>`,
    to: destinataire,
    subject: "Votre code Carentrix",
    html: contenuEmail({ nom, code }),
  });
}

async function envoyerCode(args) {
  if (process.env.BREVO_API_KEY) return envoyerCodeBrevo(args);
  return envoyerCodeGmail(args);
}

function messageErreurEmail(erreur) {
  const texte = String(erreur && erreur.message ? erreur.message : erreur || "");
  if (texte.includes("brevo_401")) {
    return "Clé API Brevo invalide (BREVO_API_KEY).";
  }
  if (texte.includes("brevo_")) {
    return "L'envoi par Brevo a échoué (expéditeur non vérifié ou quota atteint).";
  }
  if (texte.includes("config_expediteur_manquante")) {
    return "Expéditeur manquant (MAIL_FROM).";
  }
  if (texte.includes("config_gmail_manquante")) {
    return "Configuration Gmail manquante (GMAIL_USER / GMAIL_APP_PASSWORD).";
  }
  if (texte.includes("Daily user sending limit") || texte.includes("5.4.5")) {
    return "Limite d'envoi Gmail atteinte pour aujourd'hui. Réessayez demain.";
  }
  if (texte.includes("Invalid login") || texte.includes("Username and Password not accepted") || texte.includes("535")) {
    return "Identifiants Gmail invalides. Vérifiez GMAIL_USER et GMAIL_APP_PASSWORD.";
  }
  return "L'envoi du code par email a échoué. Veuillez réessayer.";
}

async function trouverUtilisateurParEmail(supabaseAdmin, emailNorm) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => (u.email || "").toLowerCase() === emailNorm) || null;
}

app.get("/", (_req, res) => res.json({ ok: true, service: "carentrix-mailer" }));

app.post("/inscription", async (req, res) => {
  const { nom, telephone, email, role, etape } = req.body || {};
  const emailNorm = (email || "").trim().toLowerCase();
  const nomNorm = (nom || "").trim();
  const telephoneNorm = (telephone || "").trim();
  const roleNorm = role || "";

  if (!emailNorm) {
    return res.status(400).json({ erreur: "Email requis." });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ erreur: "Configuration Supabase manquante côté serveur." });
  }

  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const estRenvoi = etape === "renvoyer";
  if (!estRenvoi && (!nomNorm || !telephoneNorm || !["PROPRIETAIRE", "LOCATAIRE"].includes(roleNorm))) {
    return res.status(400).json({ erreur: "Nom, téléphone et rôle sont requis." });
  }

  let utilisateur = null;
  try {
    utilisateur = await trouverUtilisateurParEmail(supabaseAdmin, emailNorm);
  } catch {
    return res.status(500).json({ erreur: "Impossible de vérifier le compte." });
  }

  if (estRenvoi && !utilisateur) {
    return res.status(400).json({ erreur: "Aucun compte en attente pour cet email." });
  }

  const code = genererCode();
  const nomEmail = nomNorm || (utilisateur && utilisateur.user_metadata && utilisateur.user_metadata.nom) || "utilisateur";
  const telephoneFinal =
    telephoneNorm || (utilisateur && utilisateur.user_metadata && utilisateur.user_metadata.telephone) || "";
  const roleFinal =
    (["PROPRIETAIRE", "LOCATAIRE"].includes(roleNorm)
      ? roleNorm
      : utilisateur && utilisateur.user_metadata && utilisateur.user_metadata.role) || "LOCATAIRE";

  try {
    await envoyerCode({ destinataire: emailNorm, nom: nomEmail, code });
  } catch (erreurEmail) {
    console.error("Échec envoi email", erreurEmail);
    return res.status(500).json({ erreur: messageErreurEmail(erreurEmail) });
  }

  if (utilisateur) {
    const { error: erreurMaj } = await supabaseAdmin.auth.admin.updateUserById(utilisateur.id, {
      password: code,
      email_confirm: true,
      user_metadata: {
        ...utilisateur.user_metadata,
        nom: nomEmail,
        telephone: telephoneFinal || (utilisateur.user_metadata && utilisateur.user_metadata.telephone),
        role: roleFinal,
        doit_changer_mot_de_passe: true,
      },
    });
    if (erreurMaj) return res.status(500).json({ erreur: erreurMaj.message });
    return res.json({ ok: true, renvoi: true });
  }

  const { data: cree, error: erreurCreation } = await supabaseAdmin.auth.admin.createUser({
    email: emailNorm,
    password: code,
    email_confirm: true,
    user_metadata: { nom: nomEmail, telephone: telephoneFinal, role: roleFinal, doit_changer_mot_de_passe: true },
  });

  if (erreurCreation || !cree.user) {
    if (erreurCreation && erreurCreation.message && erreurCreation.message.includes("already been registered")) {
      const existant = await trouverUtilisateurParEmail(supabaseAdmin, emailNorm);
      if (existant) {
        const { error: erreurMaj } = await supabaseAdmin.auth.admin.updateUserById(existant.id, {
          password: code,
          email_confirm: true,
          user_metadata: { ...existant.user_metadata, nom: nomEmail, telephone: telephoneFinal, role: roleFinal, doit_changer_mot_de_passe: true },
        });
        if (erreurMaj) return res.status(500).json({ erreur: erreurMaj.message });
        return res.json({ ok: true, renvoi: true });
      }
    }
    return res.status(400).json({ erreur: (erreurCreation && erreurCreation.message) || "Création du compte impossible" });
  }

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`carentrix-mailer démarré sur le port ${PORT}`);
});
