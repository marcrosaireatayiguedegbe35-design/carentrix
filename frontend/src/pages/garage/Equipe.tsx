import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { GarageShell } from "../../components/GarageShell";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import type { ProfilResume } from "../../types";

export function EquipeGarage() {
  const { utilisateur } = useAuth();
  const [membres, setMembres] = useState<ProfilResume[]>([]);
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreursMembre, setErreursMembre] = useState<Record<string, string>>({});

  async function charger() {
    setChargement(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, nom, pseudo, telephone, statut_kyc")
      .eq("role", "GARAGE")
      .order("created_at", { ascending: true });
    if (!error) {
      setMembres(
        (data ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          role: p.role as ProfilResume["role"],
          nom: p.nom as string,
          pseudo: p.pseudo as string | undefined,
          telephone: p.telephone as string,
          statutKyc: p.statut_kyc as string,
        }))
      );
    }
    setChargement(false);
  }

  useEffect(() => {
    void charger();
  }, []);

  async function ajouterMembre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(null);

    if (!motDePasse) {
      setErreur("Indiquez un mot de passe.");
      return;
    }
    if (motDePasse !== confirmationMotDePasse) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setEnvoi(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const reponse = await supabase.functions.invoke("garage-ajouter-membre", {
        body: { nom: nom.trim(), telephone: telephone.trim(), email: email.trim(), motDePasse },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (reponse.error) throw new Error(reponse.error.message);
      if (reponse.data?.erreur) throw new Error(reponse.data.erreur);

      setSucces(`Compte créé pour ${email}. Communiquez-lui l’email et le mot de passe pour se connecter.`);
      setNom("");
      setTelephone("");
      setEmail("");
      setMotDePasse("");
      setConfirmationMotDePasse("");
      void charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setEnvoi(false);
    }
  }

  async function retirerMembre(id: string, libelle: string) {
    const ok = window.confirm(`Retirer ${libelle} de l’équipe garage ? Cette action est irréversible.`);
    if (!ok) return;
    setEnCours(id);
    setErreursMembre((e) => ({ ...e, [id]: "" }));
    const { error } = await supabase.rpc("garage_supprimer_membre", { p_utilisateur_id: id });
    setEnCours(null);
    if (error) {
      setErreursMembre((e) => ({ ...e, [id]: error.message }));
    } else {
      void charger();
    }
  }

  return (
    <GarageShell
      titre="Équipe"
      sousTitre="Ajoutez les membres du personnel qui géreront le garage avec vous."
    >
      <section className="garage-panneau garage-panneau--action">
        <h2>Ajouter un membre</h2>
        <form onSubmit={ajouterMembre} className="garage-corps">
          <div className="depot-champs">
            <label className="garage-champ">
              Nom complet
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                minLength={2}
                placeholder="Prénom et nom"
                autoComplete="off"
              />
            </label>
            <label className="garage-champ">
              Téléphone
              <input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                required
                placeholder="+229 XX XX XX XX"
                autoComplete="off"
              />
            </label>
            <label className="garage-champ depot-champ--large">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="collegue@exemple.com"
                autoComplete="off"
              />
            </label>
            <label className="garage-champ">
              Mot de passe
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                placeholder="Mot de passe"
                autoComplete="new-password"
              />
            </label>
            <label className="garage-champ">
              Confirmer le mot de passe
              <input
                type="password"
                value={confirmationMotDePasse}
                onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                required
                placeholder="Ressaisir le mot de passe"
                autoComplete="new-password"
              />
            </label>
          </div>

          {erreur && <p className="message-erreur">{erreur}</p>}
          {succes && <p className="garage-meta">{succes}</p>}

          <button type="submit" className="garage-btn garage-btn--principal" disabled={envoi}>
            {envoi ? "Création…" : "Ajouter à l’équipe"}
          </button>
        </form>
      </section>

      <h2 className="garage-section-titre">Membres actuels</h2>

      {chargement && <p className="garage-etat">Chargement…</p>}
      {!chargement && membres.length === 0 && (
        <div className="garage-vide">
          <p>Aucun membre pour le moment.</p>
        </div>
      )}

      <ul className="garage-liste">
        {membres.map((m) => {
          const estSoiMeme = m.id === utilisateur?.id;
          return (
            <li key={m.id} className="garage-dossier">
              <div className="garage-ligne-principal">
                <strong>{m.pseudo || m.nom}</strong>
                <span className="garage-badge">Garage{estSoiMeme ? " · Vous" : ""}</span>
              </div>
              <p className="garage-meta">
                {m.nom} · {m.telephone}
              </p>
              {erreursMembre[m.id] && <p className="message-erreur">{erreursMembre[m.id]}</p>}
              {!estSoiMeme && (
                <div className="garage-carte-actions">
                  <button
                    type="button"
                    className="garage-btn garage-btn--danger"
                    disabled={enCours === m.id}
                    onClick={() => void retirerMembre(m.id, m.pseudo || m.nom)}
                  >
                    Retirer de l’équipe
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </GarageShell>
  );
}
