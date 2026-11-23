import { useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { LOGO_HAUTEUR, LOGO_LARGEUR, LOGO_TRACES } from "../lib/logoTraces";

const DUREE_MS = 1300;
const SORTIE_MS = 450;

// Écran de chargement du logo (même animation que l'écran de démarrage de
// index.html), rejoué à chaque changement de page.
export function ChargementLogo() {
  const { pathname } = useLocation();
  const precedent = useRef(pathname);
  const [etat, setEtat] = useState<"cache" | "visible" | "sortie">("cache");
  const [cle, setCle] = useState(0);

  useLayoutEffect(() => {
    if (precedent.current === pathname) return;
    precedent.current = pathname;
    setCle((c) => c + 1);
    setEtat("visible");
    const t1 = window.setTimeout(() => setEtat("sortie"), DUREE_MS);
    const t2 = window.setTimeout(() => setEtat("cache"), DUREE_MS + SORTIE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  if (etat === "cache") return null;

  let e = 0;
  let l = 0;
  return (
    <div
      key={cle}
      className={`intro-loader intro-loader--rapide${etat === "sortie" ? " is-leaving" : ""}`}
      role="status"
      aria-label="Chargement"
    >
      <div className="intro-loader__content">
        <div className="intro-loader__mark">
          <img src="/logo-carentrix.png" alt="" width={LOGO_LARGEUR} height={LOGO_HAUTEUR} />
          <svg className="intro-loader__draw" viewBox={`0 0 ${LOGO_LARGEUR} ${LOGO_HAUTEUR}`} aria-hidden="true">
            {LOGO_TRACES.map((t, i) => {
              const delai = t.emblem ? 0.01 + 0.07 * e++ : 0.28 + 0.035 * l++;
              return (
                <path
                  key={i}
                  className={t.emblem ? "draw-emb" : "draw-txt"}
                  style={{ animationDelay: `${delai.toFixed(2)}s` }}
                  pathLength={1}
                  strokeWidth={t.emblem ? 5 : 4}
                  d={t.d}
                />
              );
            })}
          </svg>
          <span className="intro-loader__shine" aria-hidden="true" />
        </div>
        <span className="intro-loader__track" aria-hidden="true">
          <span />
        </span>
      </div>
    </div>
  );
}
