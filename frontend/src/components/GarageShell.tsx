import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { iconePourChemin } from "./GarageIcones";

type GarageShellProps = {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
  retour?: { to: string; libelle: string };
  children: ReactNode;
};

export function GarageShell({ titre, sousTitre, actions, retour, children }: GarageShellProps) {
  const { pathname } = useLocation();
  const Icone = iconePourChemin(pathname);

  return (
    <div className="page-garage">
      <header className="garage-entete">
        <span className="garage-entete-ico">
          <Icone taille={26} />
        </span>
        <div className="garage-entete-centre">
          {retour && (
            <Link to={retour.to} className="garage-retour">
              ← {retour.libelle}
            </Link>
          )}
          <h1 className="garage-titre">{titre}</h1>
          {sousTitre ? <p className="garage-sous">{sousTitre}</p> : null}
        </div>
        {actions ? <div className="garage-entete-actions">{actions}</div> : null}
      </header>
      <div className="garage-corps">{children}</div>
    </div>
  );
}
