import { useEffect, useState } from "react";
import { estAppNative } from "./native";

const REQUETE_MOBILE = "(max-width: 720px)";

function lireMobile() {
  if (estAppNative()) return true;
  return typeof window !== "undefined" && window.matchMedia(REQUETE_MOBILE).matches;
}

/** Vrai dans l'app Capacitor ou sur un écran de téléphone (même seuil que le CSS mobile). */
export function useEstMobile() {
  const [mobile, setMobile] = useState(lireMobile);

  useEffect(() => {
    const mq = window.matchMedia(REQUETE_MOBILE);
    const maj = () => setMobile(lireMobile());
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);

  return mobile;
}
