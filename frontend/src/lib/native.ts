import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

/** Initialise les APIs natives Capacitor (no-op sur le web). */
export async function initialiserNatifs() {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add("is-native");
  document.documentElement.dataset.platform = Capacitor.getPlatform();

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
  } catch {
    // Certaines plateformes (ex. iOS edge-to-edge) ignorent setBackgroundColor.
  }

  try {
    await SplashScreen.hide();
  } catch {
    // ignore
  }

  await CapApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void CapApp.exitApp();
    }
  });
}

export function estAppNative() {
  if (Capacitor.isNativePlatform()) return true;
  // Dev / preview : localStorage.setItem('carentrix.forceNative','1')
  try {
    return localStorage.getItem("carentrix.forceNative") === "1";
  } catch {
    return false;
  }
}

