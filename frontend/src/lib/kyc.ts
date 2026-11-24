import type { Utilisateur } from "../types";

/** Compte pleinement certifié par le garage. */
export function kycValide(utilisateur: Utilisateur | null | undefined): boolean {
  return !!utilisateur && utilisateur.role !== "GARAGE" && utilisateur.role !== "AGENCE" && utilisateur.statutKyc === "VERIFIE";
}

/**
 * Bloque l'activité métier tant que le dossier n'est pas certifié.
 * Les locataires peuvent réserver sans pièces. Compte garage : jamais bloqué.
 * Anciens rôles propriétaire/chauffeur : bloqués s'ils existent encore en base.
 */
export function kycBloqueActivite(utilisateur: Utilisateur | null | undefined): boolean {
  if (!utilisateur) return false;
  if (utilisateur.role === "GARAGE") return false;
  // Agence : créée et vérifiée par l'administration elle-même.
  if (utilisateur.role === "AGENCE") return false;
  if (utilisateur.role === "LOCATAIRE") return false;
  return utilisateur.statutKyc !== "VERIFIE";
}

/**
 * Le locataire a un statut de dossier à signaler pendant la réservation
 * (en cours de certification, ou rejeté). Exclut NON_VERIFIE : tant qu'il n'a
 * rien déposé, il n'y a rien à signaler côté réservation.
 */
export function locataireStatutASignaler(utilisateur: Utilisateur | null | undefined): boolean {
  return (
    !!utilisateur &&
    utilisateur.role === "LOCATAIRE" &&
    (utilisateur.statutKyc === "EN_ATTENTE" || utilisateur.statutKyc === "REJETE")
  );
}

export function libelleStatutKyc(statutKyc: string): string {
  switch (statutKyc) {
    case "VERIFIE":
      return "Certifié";
    case "EN_ATTENTE":
      return "En attente de certification";
    case "REJETE":
      return "Rejeté";
    case "NON_VERIFIE":
    default:
      return "Non certifié";
  }
}

export function messageBlocageKyc(statutKyc: string, role?: string): string {
  if (role === "LOCATAIRE") {
    if (statutKyc === "EN_ATTENTE") {
      return "Votre dossier est en cours de certification. Vous pouvez réserver, mais le véhicule ne sera remis au garage qu'une fois certifié.";
    }
    if (statutKyc === "REJETE") {
      return "Votre dossier a été rejeté. Déposez de nouveaux documents pour être certifié avant la remise du véhicule.";
    }
    return "Déposez vos pièces pour faire certifier votre dossier avant la remise du véhicule au garage.";
  }

  if (statutKyc === "EN_ATTENTE") {
    return "Votre dossier est en cours de vérification par le garage. Aucune activité n'est possible tant qu'il n'est pas validé.";
  }
  if (statutKyc === "REJETE") {
    return "Votre dossier a été rejeté. Déposez de nouveaux documents pour une nouvelle vérification avant toute activité.";
  }
  return "Déposez tous vos documents dans Mon dossier. Aucune activité n'est possible avant la validation du garage.";
}
