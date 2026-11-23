import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { RoleInscription, Utilisateur } from "../types";

interface AuthContextValue {
  utilisateur: Utilisateur | null;
  chargementSession: boolean;
  connexion: (email: string, motDePasse: string) => Promise<Utilisateur | null>;
  /** Envoie le code à 6 chiffres par email (Supabase + Brevo). */
  demanderCodeInscription: (
    nom: string,
    telephone: string,
    email: string,
    role: RoleInscription
  ) => Promise<void>;
  /** Valide le code reçu par email. */
  verifierCodeInscription: (email: string, code: string) => Promise<Utilisateur | null>;
  /** Renvoie un nouveau code. */
  renvoyerCodeInscription: (email: string) => Promise<void>;
  /** Mot de passe oublié : envoie un code à un compte existant. */
  demanderCodeReinitialisation: (email: string) => Promise<void>;
  changerMotDePasse: (nouveauMotDePasse: string) => Promise<void>;
  rafraichirProfil: () => Promise<Utilisateur | null>;
  deconnexion: () => Promise<void>;
  /** Suppression définitive du compte connecté (client). */
  supprimerMonCompte: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function chargerProfil(userId: string): Promise<Utilisateur | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, role, nom, pseudo, telephone, statut_kyc, doit_changer_mot_de_passe, annees_experience, tarif_journalier_chauffeur, disponible_chauffeur"
    )
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    role: data.role,
    nom: data.nom,
    pseudo: data.pseudo || data.nom,
    telephone: data.telephone,
    statutKyc: data.statut_kyc,
    doitChangerMotDePasse: data.doit_changer_mot_de_passe,
    anneesExperience: data.annees_experience,
    tarifJournalierChauffeur: data.tarif_journalier_chauffeur,
    disponibleChauffeur: data.disponible_chauffeur,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargementSession, setChargementSession] = useState(true);

  useEffect(() => {
    // getSession() (au montage) et onAuthStateChange (à chaque événement, y compris
    // un "INITIAL_SESSION" tiré au moment de l'abonnement) peuvent toutes deux lancer
    // chargerProfil en parallèle. Sans garde, une réponse plus ancienne qui résout
    // après une plus récente écrase le profil courant avec des données obsolètes —
    // c'est ce qui provoquait une redirection intermittente du garage vers le
    // catalogue client (RouteProtegee voit alors un rôle qui n'est plus "GARAGE").
    let derniereRequete = 0;

    async function appliquerSession(session: { user: { id: string } } | null) {
      const idRequete = ++derniereRequete;
      const profil = session?.user ? await chargerProfil(session.user.id) : null;
      if (idRequete === derniereRequete) {
        setUtilisateur(profil);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void appliquerSession(data.session).finally(() => setChargementSession(false));
    });

    const { data: abonnement } = supabase.auth.onAuthStateChange((_event, session) => {
      void appliquerSession(session);
    });

    return () => abonnement.subscription.unsubscribe();
  }, []);

  async function connexion(email: string, motDePasse: string): Promise<Utilisateur | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) throw new Error(traduireErreur(error.message));
    if (!data.user) return null;
    const profil = await chargerProfil(data.user.id);
    setUtilisateur(profil);
    return profil;
  }

  async function demanderCodeInscription(
    nom: string,
    telephone: string,
    email: string,
    role: RoleInscription
  ): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: {
          nom: nom.trim(),
          telephone: telephone.trim(),
          role,
          doit_changer_mot_de_passe: true,
        },
      },
    });
    if (error) throw new Error(traduireErreur(error.message));
  }

  async function verifierCodeInscription(
    email: string,
    code: string
  ): Promise<Utilisateur | null> {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error || !data.user) {
      throw new Error("Code incorrect. Vérifiez l'email reçu et réessayez.");
    }
    const profil = await chargerProfil(data.user.id);
    setUtilisateur(profil);
    return profil;
  }

  async function renvoyerCodeInscription(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(traduireErreur(error.message));
  }

  async function demanderCodeReinitialisation(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) {
      if (error.message.includes("Signups not allowed") || error.message.includes("not allowed for otp")) {
        throw new Error("Aucun compte n'existe avec cet email.");
      }
      throw new Error(traduireErreur(error.message));
    }
  }

  async function changerMotDePasse(nouveauMotDePasse: string) {
    const { error: erreurMaj } = await supabase.auth.updateUser({ password: nouveauMotDePasse });
    if (erreurMaj) throw new Error(traduireErreur(erreurMaj.message));

    const { error: erreurRpc } = await supabase.rpc("marquer_mot_de_passe_change");
    if (erreurRpc) throw new Error(erreurRpc.message);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUtilisateur(await chargerProfil(user.id));
    }
  }

  async function rafraichirProfil(): Promise<Utilisateur | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUtilisateur(null);
      return null;
    }
    const profil = await chargerProfil(user.id);
    setUtilisateur(profil);
    return profil;
  }

  async function deconnexion() {
    await supabase.auth.signOut();
  }

  async function supprimerMonCompte() {
    const { error } = await supabase.rpc("supprimer_compte", {
      p_utilisateur_id: null,
    });
    if (error) throw new Error(traduireErreur(error.message));
    setUtilisateur(null);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        utilisateur,
        chargementSession,
        connexion,
        demanderCodeInscription,
        verifierCodeInscription,
        renvoyerCodeInscription,
        demanderCodeReinitialisation,
        changerMotDePasse,
        rafraichirProfil,
        deconnexion,
        supprimerMonCompte,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function traduireErreur(message: string): string {
  if (message.includes("Invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (message.includes("Password should be")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (message.includes("rate limit") || message.includes("over_email_send_rate_limit")) {
    return "Trop d'envois. Réessayez dans quelques minutes.";
  }
  return message;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
