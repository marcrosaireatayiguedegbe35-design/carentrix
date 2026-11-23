import { supabase } from "./supabaseClient";

const BUCKET = "vehicules-photos";
const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
const TYPES_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const NB_PHOTOS_MAX = 8;

export function validerFichierPhoto(fichier: File): string | null {
  if (!TYPES_OK.includes(fichier.type)) {
    return "Formats acceptés : JPG, PNG, WebP ou GIF.";
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return "La photo ne doit pas dépasser 5 Mo.";
  }
  return null;
}

/** Upload une photo dans le bucket public et retourne l'URL publique. */
export async function uploaderPhotoVehicule(utilisateurId: string, fichier: File): Promise<string> {
  const erreurValidation = validerFichierPhoto(fichier);
  if (erreurValidation) throw new Error(erreurValidation);

  const extension = (fichier.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const chemin = `${utilisateurId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension || "jpg"}`;

  const { error } = await supabase.storage.from(BUCKET).upload(chemin, fichier, {
    upsert: false,
    contentType: fichier.type,
    cacheControl: "3600",
  });
  if (error) {
    if (error.message.toLowerCase().includes("bucket") || error.message.includes("not found")) {
      throw new Error(
        "Le stockage photos n'est pas encore configuré. Exécutez supabase/schema_photos_vehicules.sql dans le SQL Editor."
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);
  if (!data?.publicUrl) throw new Error("Impossible d'obtenir l'URL de la photo.");
  return data.publicUrl;
}

/** Upload plusieurs photos en parallèle et retourne leurs URLs publiques, dans l'ordre. */
export async function uploaderPhotosVehicule(utilisateurId: string, fichiers: File[]): Promise<string[]> {
  return Promise.all(fichiers.map((fichier) => uploaderPhotoVehicule(utilisateurId, fichier)));
}
