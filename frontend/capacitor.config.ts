import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "bj.carentrix.app",
  appName: "Carentrix",
  webDir: "dist",
  server: {
    androidScheme: "https",
    allowNavigation: [
      "https://*.supabase.co",
      "https://*.fedapay.com",
      "https://cdn.fedapay.com",
    ],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: "#ffffff",
      showSpinner: false,
      splashFullScreen: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff",
    },
  },
};

export default config;
