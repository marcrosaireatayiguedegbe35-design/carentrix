import type { Vehicule } from "../types";

/** Ligne SQL (rechercher_vehicules / vehicules_publics) → véhicule de l'interface. */
export function mapperVehicule(v: Record<string, unknown>): Vehicule {
  return {
    codePublic: v.code_public as string,
    marque: v.marque as string,
    modele: v.modele as string,
    annee: v.annee as number,
    transmission: v.transmission as Vehicule["transmission"],
    categorie: v.categorie as Vehicule["categorie"],
    ville: v.ville as string,
    prixUnitaire: v.prix_unitaire as number,
    uniteTarif: v.unite_tarif as Vehicule["uniteTarif"],
    photos: (v.photos as string[] | null) ?? [],
    disponible: v.disponible as boolean,
    noteMoyenne: Number(v.note_moyenne) || 0,
    nbAvis: Number(v.nb_avis) || 0,
    zonePriseEnCharge: (v.zone_prise_en_charge as string | null) ?? null,
    zoneIncluse: (v.zone_incluse as string | null) ?? null,
    nombrePlaces: (v.nombre_places as number | null) ?? null,
    nombrePortes: (v.nombre_portes as number | null) ?? null,
    carburant: (v.carburant as Vehicule["carburant"]) ?? null,
    equipements: (v.equipements as string[] | null) ?? [],
    chauffeurObligatoire: (v.chauffeur_obligatoire as boolean) ?? true,
  };
}
