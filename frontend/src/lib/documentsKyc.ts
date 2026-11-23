import { supabase } from "./supabaseClient";
import type { DocumentKyc, Role, TypeDocumentKyc } from "../types";

export const LIBELLES_DOCUMENT: Record<TypeDocumentKyc, string> = {
  PIECE_IDENTITE: "Pièce d'identité",
  PERMIS_CONDUIRE: "Permis de conduire",
  JUSTIFICATIF_PROPRIETE: "Justificatif de propriété du véhicule",
  JUSTIFICATIF_RESIDENCE: "Justificatif de résidence au Bénin",
  PHOTO_PROFIL: "Photo de profil (visage)",
};

export function documentsRequisPourRole(role: Role): TypeDocumentKyc[] {
  if (role === "PROPRIETAIRE") return ["PIECE_IDENTITE", "JUSTIFICATIF_PROPRIETE"];
  if (role === "LOCATAIRE") return ["PIECE_IDENTITE", "PERMIS_CONDUIRE", "JUSTIFICATIF_RESIDENCE", "PHOTO_PROFIL"];
  if (role === "CHAUFFEUR") return ["PIECE_IDENTITE", "PERMIS_CONDUIRE", "PHOTO_PROFIL"];
  return [];
}

export async function mesDocuments(utilisateurId: string): Promise<DocumentKyc[]> {
  const { data, error } = await supabase
    .from("documents_kyc")
    .select("type, chemin_fichier, created_at")
    .eq("utilisateur_id", utilisateurId);
  if (error || !data) return [];
  return data.map((d: any) => ({ type: d.type, cheminFichier: d.chemin_fichier, createdAt: d.created_at }));
}

export async function uploaderDocument(utilisateurId: string, type: TypeDocumentKyc, fichier: File) {
  const extension = fichier.name.split(".").pop() || "jpg";
  const chemin = `${utilisateurId}/${type}.${extension}`;

  const { error: erreurUpload } = await supabase.storage
    .from("documents-kyc")
    .upload(chemin, fichier, { upsert: true, contentType: fichier.type });
  if (erreurUpload) throw new Error(erreurUpload.message);

  const { error: erreurDb } = await supabase
    .from("documents_kyc")
    .upsert({ utilisateur_id: utilisateurId, type, chemin_fichier: chemin }, { onConflict: "utilisateur_id,type" });
  if (erreurDb) throw new Error(erreurDb.message);
}

export async function urlSigneeDocument(cheminFichier: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("documents-kyc").createSignedUrl(cheminFichier, 300);
  if (error || !data) return null;
  return data.signedUrl;
}
