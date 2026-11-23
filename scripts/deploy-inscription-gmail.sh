#!/usr/bin/env bash
# Déploie la fonction inscription + secrets Google OAuth (API Gmail).
# Prérequis : supabase login  (ou SUPABASE_ACCESS_TOKEN)
#
# L'envoi passe par l'API Gmail (HTTPS) et non par SMTP : Supabase Edge
# Functions tourne sur Deno Deploy, qui bloque les connexions SMTP sortantes
# (ports 25/465/587) pour éviter les abus. Voir SETUP.md pour la procédure
# d'obtention du Client ID / Client Secret / Refresh token.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="swpvaiefvizohhykidpc"

if [[ -z "${GMAIL_USER:-}" || -z "${GOOGLE_CLIENT_ID:-}" || -z "${GOOGLE_CLIENT_SECRET:-}" || -z "${GOOGLE_REFRESH_TOKEN:-}" ]]; then
  echo "Exportez GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REFRESH_TOKEN puis relancez."
  echo "Exemple :"
  echo "  export GMAIL_USER='marcrosaire2@gmail.com'"
  echo "  export GOOGLE_CLIENT_ID='xxxxxxxx.apps.googleusercontent.com'"
  echo "  export GOOGLE_CLIENT_SECRET='xxxxxxxx'"
  echo "  export GOOGLE_REFRESH_TOKEN='xxxxxxxx'"
  exit 1
fi

cd "$ROOT"
npx --yes supabase secrets set \
  --project-ref "$PROJECT_REF" \
  "GMAIL_USER=${GMAIL_USER}" \
  "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
  "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" \
  "GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH_TOKEN}"

npx --yes supabase functions deploy inscription --project-ref "$PROJECT_REF"
echo "OK — secrets + fonction inscription déployés."
