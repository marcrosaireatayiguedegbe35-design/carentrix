#!/usr/bin/env bash
# Met à jour les variables Render du service safesteer (nécessite RENDER_API_KEY).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source <(grep -E '^VITE_' "$ROOT/frontend/.env")
set +a
: "${RENDER_API_KEY:?Exportez RENDER_API_KEY}"
: "${RENDER_SERVICE_ID:?Exportez RENDER_SERVICE_ID (Dashboard > Service > Settings > ID)}"

curl -sS -X PUT "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "[
    {\"key\":\"VITE_SUPABASE_URL\",\"value\":\"${VITE_SUPABASE_URL}\"},
    {\"key\":\"VITE_SUPABASE_PUBLISHABLE_KEY\",\"value\":\"${VITE_SUPABASE_PUBLISHABLE_KEY}\"},
    {\"key\":\"VITE_FEDAPAY_PUBLIC_KEY\",\"value\":\"${VITE_FEDAPAY_PUBLIC_KEY}\"},
    {\"key\":\"NODE_VERSION\",\"value\":\"22.12.0\"}
  ]"
echo
echo "OK — déclenchez un Manual Deploy sur Render."
