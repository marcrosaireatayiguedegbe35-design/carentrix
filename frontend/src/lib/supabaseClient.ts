import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const cleAnon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !cleAnon) {
  // Sans ce message, une clé absente du build donne une simple page blanche.
  const manquantes = [!url && "VITE_SUPABASE_URL", !cleAnon && "VITE_SUPABASE_PUBLISHABLE_KEY"]
    .filter(Boolean)
    .join(", ");
  document.body.innerHTML = `<p style="font-family:sans-serif;padding:1.5rem;color:#a61d2a">Configuration manquante dans cette version de l'application : ${manquantes}.</p>`;
  throw new Error("VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY doivent être définies dans .env");
}

export const supabase = createClient(url, cleAnon);
