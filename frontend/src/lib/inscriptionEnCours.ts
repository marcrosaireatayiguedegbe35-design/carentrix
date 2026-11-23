// Inscription commencée mais pas terminée (code envoyé, pas encore validé).
// Seuls l'email, le nom et le téléphone sont mémorisés — jamais de mot de passe
// ni de code — pour que la personne retrouve l'écran du code en revenant.
const CLE = "carentrix.inscription_en_cours.v1";
const DUREE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export type InscriptionEnCours = {
  email: string;
  nom: string;
  telephone: string;
};

export function lireInscriptionEnCours(): InscriptionEnCours | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const donnees = JSON.parse(brut) as InscriptionEnCours & { date?: number };
    if (!donnees.email || !donnees.date || Date.now() - donnees.date > DUREE_MAX_MS) {
      localStorage.removeItem(CLE);
      return null;
    }
    return { email: donnees.email, nom: donnees.nom ?? "", telephone: donnees.telephone ?? "" };
  } catch {
    return null;
  }
}

export function memoriserInscriptionEnCours(donnees: InscriptionEnCours): void {
  try {
    localStorage.setItem(CLE, JSON.stringify({ ...donnees, date: Date.now() }));
  } catch {
    // ignore (mode privé / stockage bloqué)
  }
}

export function effacerInscriptionEnCours(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // ignore
  }
}
