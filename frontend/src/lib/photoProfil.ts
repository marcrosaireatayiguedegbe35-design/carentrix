import { supabase } from "./supabaseClient";

/**
 * Photo de profil facultative du client (distincte de la « photo de visage » du dossier de certification).
 * Stockée dans le bucket privé « avatars », toujours à `<id utilisateur>/avatar.jpg` : aucune colonne
 * en base. Seul l'utilisateur (et le garage) peut la lire. Bucket à créer : supabase/schema_photo_profil.sql.
 */

const BUCKET = "avatars";
const COTE_PX = 512;
const TAILLE_MAX_FICHIER = 8 * 1024 * 1024;

function chemin(idUtilisateur: string) {
  return `${idUtilisateur}/avatar.jpg`;
}

export function validerFichierPhotoProfil(fichier: File): string | null {
  if (!fichier.type.startsWith("image/")) return "Choisissez une image (JPEG, PNG, WebP…).";
  if (fichier.size > TAILLE_MAX_FICHIER) return "L'image est trop lourde (8 Mo maximum).";
  return null;
}

function messageErreur(message: string): string {
  if (/bucket not found/i.test(message) || /not found/i.test(message)) {
    return "La photo de profil n'est pas encore activée sur ce serveur (script supabase/schema_photo_profil.sql à exécuter).";
  }
  return message;
}

async function chargerImage(fichier: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(fichier, { imageOrientation: "from-image" });
    } catch {
      // repli ci-dessous
    }
  }
  const url = URL.createObjectURL(fichier);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image illisible."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Recadre au centre en carré et réduit à 512 px, en JPEG. */
export async function preparerPhotoProfil(fichier: File): Promise<Blob> {
  const image = await chargerImage(fichier);
  const largeur = "naturalWidth" in image ? image.naturalWidth : image.width;
  const hauteur = "naturalHeight" in image ? image.naturalHeight : image.height;
  const cote = Math.min(largeur, hauteur);
  const sx = (largeur - cote) / 2;
  const sy = (hauteur - cote) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = COTE_PX;
  canvas.height = COTE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de préparer l'image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, COTE_PX, COTE_PX);
  ctx.drawImage(image, sx, sy, cote, cote, 0, 0, COTE_PX, COTE_PX);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de préparer l'image."))),
      "image/jpeg",
      0.88
    );
  });
}

export async function uploaderPhotoProfil(idUtilisateur: string, fichier: File): Promise<void> {
  const blob = await preparerPhotoProfil(fichier);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(chemin(idUtilisateur), blob, { upsert: true, contentType: "image/jpeg", cacheControl: "300" });
  if (error) throw new Error(messageErreur(error.message));
}

/** Lien temporaire (1 h) vers la photo, ou null si aucune photo n'a été ajoutée. */
export async function urlPhotoProfil(idUtilisateur: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin(idUtilisateur), 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function supprimerPhotoProfil(idUtilisateur: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([chemin(idUtilisateur)]);
  if (error) throw new Error(messageErreur(error.message));
}
