import type { Carburant } from "../types";

export const EQUIPEMENTS_DISPONIBLES = [
  { code: "CLIMATISATION", libelle: "Climatiseur" },
  { code: "ROUE_DE_SECOURS", libelle: "Roue de secours" },
  { code: "BLUETOOTH", libelle: "Bluetooth" },
  { code: "GPS", libelle: "GPS" },
  { code: "USB", libelle: "Prise USB" },
  { code: "CAMERA_RECUL", libelle: "Caméra de recul" },
  { code: "SIEGE_BEBE", libelle: "Siège bébé" },
  { code: "VITRES_ELECTRIQUES", libelle: "Vitres électriques" },
  { code: "TOIT_OUVRANT", libelle: "Toit ouvrant" },
] as const;

export const LIBELLES_CARBURANT: Record<Carburant, string> = {
  ESSENCE: "Essence",
  GASOIL: "Gasoil",
  AUTRE: "Autre",
};
