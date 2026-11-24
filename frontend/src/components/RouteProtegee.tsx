import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

function accueilPourRole(role: Role) {
  if (role === "GARAGE") return "/garage/tableau-de-bord";
  if (role === "AGENCE") return "/agence/tableau-de-bord";
  return "/vehicules";
}

// Le blocage "mot de passe temporaire non changé" est géré globalement dans App.tsx
// (il doit aussi s'appliquer aux routes publiques comme /vehicules) — pas ici.
export function RouteProtegee({ children, role }: { children: ReactNode; role?: Role | Role[] }) {
  const { utilisateur, chargementSession } = useAuth();

  if (chargementSession) {
    return <p className="texte-secondaire">Chargement...</p>;
  }
  if (!utilisateur) {
    return <Navigate to="/connexion" replace />;
  }
  const rolesAutorises = role ? (Array.isArray(role) ? role : [role]) : null;
  if (rolesAutorises && !rolesAutorises.includes(utilisateur.role)) {
    return <Navigate to={accueilPourRole(utilisateur.role)} replace />;
  }
  return <>{children}</>;
}
