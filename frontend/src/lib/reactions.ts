import { supabase } from "./supabaseClient";

/**
 * « J'aime », « Cœur » et commentaires sur chaque véhicule (script : supabase/schema_reactions_commentaires.sql).
 * Lecture publique ; réagir et commenter exigent un compte connecté ; le garage voit les statistiques.
 */

export type TypeReaction = "LIKE" | "COEUR";

export interface Engagement {
  likes: number;
  coeurs: number;
  commentaires: number;
}

export interface Commentaire {
  id: string;
  auteur: string;
  contenu: string;
  date: string;
  estLeMien: boolean;
}

export interface PerformanceVehicule {
  code: string;
  marque: string;
  modele: string;
  ville: string;
  likes: number;
  coeurs: number;
  commentaires: number;
  reservations: number;
  nbAvis: number;
  noteMoyenne: number | null;
}

export interface CommentaireGarage {
  id: string;
  vehiculeCode: string;
  vehicule: string;
  auteur: string;
  contenu: string;
  masque: boolean;
  date: string;
}

export const EVENEMENT_ENGAGEMENT = "carentrix:engagement";

function traduireErreur(message: string): string {
  if (/could not find|does not exist|schema cache|relation .* does not exist|function .* does not exist/i.test(message)) {
    return "Cette fonction n'est pas encore activée sur le serveur (script supabase/schema_reactions_commentaires.sql à exécuter).";
  }
  return message;
}

export async function chargerEngagement(code: string): Promise<Engagement> {
  const { data, error } = await supabase
    .from("vehicules_engagement")
    .select("nb_likes, nb_coeurs, nb_commentaires")
    .eq("vehicule_code", code)
    .maybeSingle();
  if (error) throw new Error(traduireErreur(error.message));
  return {
    likes: Number(data?.nb_likes ?? 0),
    coeurs: Number(data?.nb_coeurs ?? 0),
    commentaires: Number(data?.nb_commentaires ?? 0),
  };
}

export async function mesReactions(code: string): Promise<TypeReaction[]> {
  const { data, error } = await supabase.rpc("mes_reactions_vehicule", { p_code_vehicule: code });
  if (error) throw new Error(traduireErreur(error.message));
  return ((data as string[] | null) ?? []).filter((t): t is TypeReaction => t === "LIKE" || t === "COEUR");
}

export async function basculerReaction(
  code: string,
  type: TypeReaction
): Promise<{ actif: boolean; likes: number; coeurs: number }> {
  const { data, error } = await supabase.rpc("basculer_reaction", { p_code_vehicule: code, p_type: type });
  if (error) throw new Error(traduireErreur(error.message));
  const r = data as { actif: boolean; nb_likes: number; nb_coeurs: number };
  return { actif: Boolean(r.actif), likes: Number(r.nb_likes), coeurs: Number(r.nb_coeurs) };
}

export async function chargerCommentaires(code: string): Promise<Commentaire[]> {
  const { data, error } = await supabase
    .from("commentaires_publics")
    .select("id, auteur_pseudo, contenu, created_at, est_le_mien")
    .eq("vehicule_code", code)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(traduireErreur(error.message));
  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    auteur: (c.auteur_pseudo as string) || "Client Carentrix",
    contenu: c.contenu as string,
    date: c.created_at as string,
    estLeMien: Boolean(c.est_le_mien),
  }));
}

export async function ajouterCommentaire(code: string, contenu: string): Promise<void> {
  const { error } = await supabase.rpc("ajouter_commentaire", { p_code_vehicule: code, p_contenu: contenu });
  if (error) throw new Error(traduireErreur(error.message));
  window.dispatchEvent(new Event(EVENEMENT_ENGAGEMENT));
}

export async function supprimerMonCommentaire(id: string): Promise<void> {
  const { error } = await supabase.rpc("supprimer_mon_commentaire", { p_id: id });
  if (error) throw new Error(traduireErreur(error.message));
  window.dispatchEvent(new Event(EVENEMENT_ENGAGEMENT));
}

/* ---------- Garage ---------- */

export async function performanceVehicules(): Promise<PerformanceVehicule[]> {
  const { data, error } = await supabase.rpc("garage_performance_vehicules");
  if (error) throw new Error(traduireErreur(error.message));
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    code: r.vehicule_code as string,
    marque: r.marque as string,
    modele: r.modele as string,
    ville: r.ville as string,
    likes: Number(r.nb_likes),
    coeurs: Number(r.nb_coeurs),
    commentaires: Number(r.nb_commentaires),
    reservations: Number(r.nb_reservations),
    nbAvis: Number(r.nb_avis),
    noteMoyenne: r.note_moyenne == null ? null : Number(r.note_moyenne),
  }));
}

export async function commentairesRecentsGarage(): Promise<CommentaireGarage[]> {
  const { data, error } = await supabase.rpc("garage_commentaires_recents", { p_limite: 50 });
  if (error) throw new Error(traduireErreur(error.message));
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    vehiculeCode: r.vehicule_code as string,
    vehicule: `${r.marque as string} ${r.modele as string}`,
    auteur: r.auteur_pseudo as string,
    contenu: r.contenu as string,
    masque: Boolean(r.masque),
    date: r.created_at as string,
  }));
}

export async function masquerCommentaire(id: string, masque: boolean): Promise<void> {
  const { error } = await supabase.rpc("garage_masquer_commentaire", { p_id: id, p_masque: masque });
  if (error) throw new Error(traduireErreur(error.message));
}
