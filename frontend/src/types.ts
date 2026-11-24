export type Transmission = "MANUELLE" | "AUTOMATIQUE";
export type Categorie = "CITADINE" | "BERLINE" | "SUV" | "MINIBUS" | "PICKUP";
export type Carburant = "ESSENCE" | "GASOIL" | "AUTRE";
export type StatutReservation =
  | "DEMANDEE"
  | "EN_ATTENTE_PAIEMENT"
  | "REFUSEE"
  | "EXPIREE"
  | "EN_ATTENTE"
  | "CONFIRMEE"
  | "VEHICULE_REMIS"
  | "EN_LOCATION"
  | "RETOURNE"
  | "INSPECTION"
  | "LITIGE"
  | "CLOTUREE"
  | "ANNULEE";
export type MoyenPaiement = "MTN_MOMO" | "MOOV_MONEY" | "CARTE" | "CASH" | "FEDAPAY";
export type UniteTarif = "HEURE" | "JOUR";

export interface Vehicule {
  codePublic: string;
  marque: string;
  modele: string;
  annee: number;
  transmission: Transmission;
  categorie: Categorie;
  ville: string;
  prixUnitaire: number;
  uniteTarif: UniteTarif;
  photos: string[];
  disponible: boolean;
  noteMoyenne?: number;
  nbAvis?: number;
  zonePriseEnCharge: string | null;
  zoneIncluse: string | null;
  nombrePlaces: number | null;
  nombrePortes: number | null;
  carburant: Carburant | null;
  equipements: string[];
  chauffeurObligatoire: boolean;
}

export interface AvisPublic {
  id: string;
  vehiculeCode: string;
  note: number;
  commentaire: string | null;
  createdAt: string;
  auteurPseudo: string;
}

export type RoleInscription = "LOCATAIRE";
export type Role = "LOCATAIRE" | "GARAGE" | "PROPRIETAIRE" | "CHAUFFEUR" | "AGENCE";

export interface Utilisateur {
  id: string;
  role: Role;
  nom: string;
  pseudo: string;
  telephone: string;
  statutKyc: string;
  doitChangerMotDePasse: boolean;
  anneesExperience?: number | null;
  tarifJournalierChauffeur?: number | null;
  disponibleChauffeur?: boolean;
}

export interface ProfilResume {
  id: string;
  role: Role;
  nom: string;
  pseudo?: string;
  telephone: string;
  statutKyc: string;
}

export type TypeDocumentKyc =
  | "PIECE_IDENTITE"
  | "PERMIS_CONDUIRE"
  | "JUSTIFICATIF_PROPRIETE"
  | "JUSTIFICATIF_RESIDENCE"
  | "PHOTO_PROFIL";

export interface DocumentKyc {
  type: TypeDocumentKyc;
  cheminFichier: string;
  createdAt: string;
}

export interface VehiculeGarage extends Vehicule {
  controleTechniqueOk: boolean;
  agenceNom?: string | null;
  proprietaireId: string;
  entrepriseProvenance: string | null;
  coutUnitaire: number | null;
}

export interface ReservationGarage {
  codePublic: string;
  statut: StatutReservation;
  dateDebut: string;
  dateFin: string;
  montantTotal: number;
  vehiculeCode: string;
  marque: string;
  modele: string;
}

export interface DetailReservationGarage {
  reservation: {
    codePublic: string;
    statut: StatutReservation;
    dateDebut: string;
    dateFin: string;
    montantTotal: number;
    caution: number;
  };
  vehicule: { codePublic: string; marque: string; modele: string; ville: string };
  proprietaire: { nom: string; telephone: string; statutKyc: string };
  locataire: { nom: string; telephone: string; statutKyc: string };
  paiements: { montant: number; moyen: MoyenPaiement; statut: string; reference: string; createdAt: string }[];
  etatsDesLieux: { type: "REMISE" | "RETOUR"; horodatage: string; notes: string | null }[];
  litige: { description: string; resolution: string | null; montantPreleve: number | null } | null;
}

export interface VehiculeProprietaire extends Vehicule {
  controleTechniqueOk: boolean;
}

export interface ReservationProprietaire {
  codePublic: string;
  statut: StatutReservation;
  dateDebut: string;
  dateFin: string;
  montantTotal: number;
  montantProprietaire: number;
  vehiculeCode: string;
  marque: string;
  modele: string;
}

export interface Reservation {
  codePublic: string;
  statut: StatutReservation;
  dateDebut: string;
  dateFin: string;
  montantTotal: number;
  caution: number;
  montantChauffeur?: number;
  chauffeurPseudo?: string | null;
  avisNote?: number | null;
  avisCommentaire?: string | null;
  vehicule: Pick<Vehicule, "codePublic" | "marque" | "modele" | "ville" | "photos">;
}

export interface ConversationResume {
  conversationId: string;
  reservationCode: string;
  reservationStatut: StatutReservation;
  vehiculeCode: string;
  marque: string;
  modele: string;
  monRole: "LOCATAIRE" | "PROPRIETAIRE";
  interlocuteurPseudo: string;
  dernierMessage: string | null;
  dernierMessageAt: string | null;
  fermeeAt: string | null;
}

