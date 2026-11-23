import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { estAppNative } from "../lib/native";

type AuthShellProps = {
  titre: string;
  sousTitre?: string;
  children: ReactNode;
  image?: string;
};

const IMAGE_DEFAUT = "/hero/hero-03.jpg";

/** Dernier mot du titre en rouge : « Bon retour » → Bon <retour>. */
function TitreAccentue({ titre }: { titre: string }) {
  const mots = titre.trim().split(" ");
  if (mots.length < 2) return <>{titre}</>;
  const dernier = mots.pop();
  return (
    <>
      {mots.join(" ")} <span className="auth-titre-accent">{dernier}</span>
    </>
  );
}

export function AuthShell({ titre, sousTitre, children, image = IMAGE_DEFAUT }: AuthShellProps) {
  const natif = estAppNative();

  return (
    <div className={`page-auth${natif ? " page-auth--natif" : ""}`}>
      <div className="auth-mobile">
        <div className="auth-hero">
          <img className="auth-hero-image" src={image} alt="" />
          <div className="auth-hero-voile" aria-hidden="true" />
          <Link to={natif ? "/vehicules" : "/"} className="auth-hero-logo" aria-label="Carentrix">
            <img src="/logo-carentrix.png" alt="Carentrix" width={140} height={70} />
          </Link>
        </div>

        <div className="auth-contenu">
          <header className="auth-form-entete">
            <h1>
              <TitreAccentue titre={titre} />
            </h1>
            {sousTitre ? <p>{sousTitre}</p> : null}
          </header>
          {children}
        </div>

        <svg className="auth-deco-bas" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 120V58C30 78 70 100 120 120Z" fill="#e50914" />
          <path d="M0 120V84C20 98 44 110 70 120Z" fill="#f0252f" />
          <path d="M400 120V62C370 84 330 104 290 120Z" fill="#e50914" />
          <path d="M400 120V88C384 100 366 111 346 120Z" fill="#f0252f" />
        </svg>
      </div>
    </div>
  );
}
