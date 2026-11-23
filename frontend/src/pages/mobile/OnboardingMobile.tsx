import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { marquerOnboardingVu } from "../../lib/onboarding";

export function OnboardingMobile() {
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setTimeout(() => {
      marquerOnboardingVu();
      navigate("/", { replace: true });
    }, 1600);
    return () => window.clearTimeout(id);
  }, [navigate]);

  return (
    <div className="onboarding onboarding-splash" aria-busy="true" aria-label="Chargement Carentrix">
      <div className="onboarding-splash-marque">
        <img src="/logo-carentrix.png" alt="Carentrix" className="onboarding-splash-logo-principal" />
        <p className="onboarding-splash-tag">Location sécurisée au Bénin</p>
      </div>
      <div className="onboarding-splash-barre" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
