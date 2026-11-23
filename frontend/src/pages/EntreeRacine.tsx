import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEstMobile } from "../lib/estMobile";
import { lireInscriptionEnCours } from "../lib/inscriptionEnCours";
import { estAppNative } from "../lib/native";
import { onboardingDejaVu } from "../lib/onboarding";
import { Accueil } from "./Accueil";
import { BienvenueMobile } from "./BienvenueMobile";
import { OnboardingMobile } from "./mobile/OnboardingMobile";

/**
 * Racine `/` : un utilisateur déjà connecté ne doit jamais revoir la
 * landing page — il est redirigé vers son espace. Sinon, onboarding mobile
 * (splash) à la 1ʳᵉ visite puis catalogue direct pour l'appli native ;
 * Accueil (landing complète) pour le web.
 */
export function EntreeRacine() {
  const { utilisateur } = useAuth();
  const mobile = useEstMobile();

  if (utilisateur) {
    return (
      <Navigate to={utilisateur.role === "GARAGE" ? "/garage/tableau-de-bord" : "/vehicules"} replace />
    );
  }

  // Inscription interrompue : retour direct à l'écran du code.
  if (lireInscriptionEnCours()) {
    return <Navigate to="/inscription" replace />;
  }

  if (estAppNative() && !onboardingDejaVu()) {
    return <OnboardingMobile />;
  }

  // Mobile (appli ou site) : uniquement l'écran de bienvenue, jamais la landing page.
  if (mobile) {
    return <BienvenueMobile />;
  }

  return <Accueil />;
}
