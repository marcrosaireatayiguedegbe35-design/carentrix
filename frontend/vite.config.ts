import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Web (Render) : chemins absolus ("/assets/..."), sinon recharger une route
  // profonde (ex. /garage/tableau-de-bord) résout les assets relativement à
  // cette route (/garage/assets/...) au lieu de la racine → page blanche.
  // Capacitor (WebView file:// / capacitor://) : chemins relatifs requis,
  // il n'y a pas de racine de domaine fixe. Voir mobile:build dans package.json.
  base: mode === 'capacitor' ? './' : '/',
}))
