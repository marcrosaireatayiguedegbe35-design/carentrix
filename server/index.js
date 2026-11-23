// Petit service d'inscription : envoie un code à 6 chiffres par l'API Brevo
// (mot de passe temporaire) puis crée/met à jour le compte Supabase.
//
// Vit en dehors de Supabase Edge Functions (Deno Deploy) exprès : cette
// plateforme bloque les connexions SMTP sortantes (ports 25/465/587) pour
// éviter les abus, donc l'envoi Gmail y échoue systématiquement. Un service
// Node classique (Render Web Service) n'a pas cette restriction.
//
// Variables d'environnement requises :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   + BREVO_API_KEY et MAIL_FROM (adresse expéditeur vérifiée dans Brevo)
//   Optionnel : CORS_ORIGINS (origines autorisées, séparées par des virgules)

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3000;

const app = express();
app.set("trust proxy", 1); // Render est derrière un proxy : IP client fiable pour la limitation
app.disable("x-powered-by");

// CORS restreint aux origines du site (variable CORS_ORIGINS : liste séparée par des virgules).
const ORIGINES_AUTORISEES = (
  process.env.CORS_ORIGINS ||
  "https://carentrix.pages.dev,https://carentrix.com,https://www.carentrix.com,http://localhost:5173,capacitor://localhost,https://localhost,http://localhost"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origine, cb) {
      // Pas d'en-tête Origin (curl, serveur à serveur) : autorisé côté CORS, la limitation de débit s'applique quand même.
      if (!origine || ORIGINES_AUTORISEES.includes(origine)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: "10kb" }));

// Limitation de débit en mémoire (suffisant pour une instance unique).
const compteurs = new Map();
function limite(cle, max, fenetreMs) {
  const maintenant = Date.now();
  const entree = compteurs.get(cle);
  if (!entree || entree.fin < maintenant) {
    compteurs.set(cle, { n: 1, fin: maintenant + fenetreMs });
    return true;
  }
  entree.n += 1;
  return entree.n <= max;
}
setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, v] of compteurs) if (v.fin < maintenant) compteurs.delete(cle);
}, 60_000).unref();

function echapperHtml(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function genererCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function contenuEmail({ nom, code }) {
  return `
      <p>Bonjour ${echapperHtml(nom)},</p>
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

async function envoyerCode(args) {
  if (!process.env.BREVO_API_KEY) throw new Error("config_brevo_manquante");
  return envoyerCodeBrevo(args);
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
  if (texte.includes("config_brevo_manquante")) {
    return "Configuration d'envoi d'email manquante (BREVO_API_KEY).";
  }
  return "L'envoi du code par email a échoué. Veuillez réessayer.";
}

async function trouverUtilisateurParEmail(supabaseAdmin, emailNorm) {
  const parPage = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: parPage });
    if (error) throw error;
    const trouve = data.users.find((u) => (u.email || "").toLowerCase() === emailNorm);
    if (trouve) return trouve;
    if (data.users.length < parPage) return null;
  }
  return null;
}

// Un compte « en attente » n'a pas encore choisi son mot de passe : seul ce cas
// autorise l'envoi d'un nouveau code. Un compte actif (ou le garage) n'est JAMAIS modifié.
function estEnAttente(utilisateur) {
  return !!(utilisateur && utilisateur.user_metadata && utilisateur.user_metadata.doit_changer_mot_de_passe === true);
}

app.get("/", (_req, res) => res.json({ ok: true, service: "carentrix-mailer" }));

app.post("/inscription", async (req, res) => {
  const { nom, telephone, email, role, etape } = req.body || {};
  const emailNorm = (email || "").trim().toLowerCase();
  const nomNorm = (nom || "").trim();
  const telephoneNorm = (telephone || "").trim();
  const roleNorm = role || "";

  if (!emailNorm || emailNorm.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return res.status(400).json({ erreur: "Email invalide." });
  }
  if (nomNorm.length > 100 || telephoneNorm.length > 30) {
    return res.status(400).json({ erreur: "Données trop longues." });
  }

  // Limitation de débit : par IP et par email (évite l'envoi massif et le brute-force).
  const ip = req.ip || "inconnue";
  if (!limite(`ip:${ip}`, 15, 15 * 60_000) || !limite(`email:${emailNorm}`, 3, 15 * 60_000)) {
    return res.status(429).json({ erreur: "Trop de tentatives. Réessayez dans quelques minutes." });
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

  if (estRenvoi && !estEnAttente(utilisateur)) {
    // Réponse neutre : ne révèle pas si le compte existe et ne touche jamais un compte actif.
    return res.json({ ok: true, renvoi: true });
  }
  if (!estRenvoi && utilisateur && !estEnAttente(utilisateur)) {
    return res.status(400).json({ erreur: "Un compte existe déjà avec cet email. Connectez-vous." });
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
      if (existant && estEnAttente(existant)) {
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
