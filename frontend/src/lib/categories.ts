import type { Categorie } from "../types";

export const LIBELLES_CATEGORIE: Record<Categorie, string> = {
  CITADINE: "Citadine",
  BERLINE: "Berline",
  SUV: "SUV",
  MINIBUS: "Minibus",
  PICKUP: "Pick-up",
};

/** Une image représentative par catégorie (dossier public/categories). */
export const CATEGORIES_VITRINE: {
  code: Categorie;
  libelle: string;
  image: string;
}[] = [
  { code: "CITADINE", libelle: LIBELLES_CATEGORIE.CITADINE, image: "/categories/citadine.jpg" },
  { code: "BERLINE", libelle: LIBELLES_CATEGORIE.BERLINE, image: "/categories/berline.jpg" },
  { code: "SUV", libelle: LIBELLES_CATEGORIE.SUV, image: "/categories/suv.jpg" },
  { code: "MINIBUS", libelle: LIBELLES_CATEGORIE.MINIBUS, image: "/categories/minibus.jpg" },
  { code: "PICKUP", libelle: LIBELLES_CATEGORIE.PICKUP, image: "/categories/pickup.jpg" },
];

export function categorieDepuisParam(valeur: string | null | undefined): Categorie | "" {
  if (!valeur) return "";
  const code = valeur.toUpperCase() as Categorie;
  return code in LIBELLES_CATEGORIE ? code : "";
}
