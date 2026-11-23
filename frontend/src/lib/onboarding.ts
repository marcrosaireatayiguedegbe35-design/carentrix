const CLE_ONBOARDING = "carentrix.onboarding.v1";

export function onboardingDejaVu(): boolean {
  try {
    return localStorage.getItem(CLE_ONBOARDING) === "1";
  } catch {
    return false;
  }
}

export function marquerOnboardingVu(): void {
  try {
    localStorage.setItem(CLE_ONBOARDING, "1");
  } catch {
    // ignore (mode privé / stockage bloqué)
  }
}
