import { useEffect, useMemo, useState } from "react";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import { documentsRequisPourRole, LIBELLES_DOCUMENT, urlSigneeDocument } from "../../lib/documentsKyc";
import type { DocumentKyc, ProfilResume } from "../../types";

const LIBELLES_ROLE: Record<string, string> = {
  LOCATAIRE: "Locataire",
  PROPRIETAIRE: "Ancien propriétaire",
  CHAUFFEUR: "Ancien chauffeur",
  GARAGE: "Garage",
};

export function UtilisateursGarage() {
  const [profils, setProfils] = useState<ProfilResume[]>([]);
  const [documentsParUtilisateur, setDocumentsParUtilisateur] = useState<Record<string, DocumentKyc[]>>({});
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [afficherTous, setAfficherTous] = useState(true);
  const [recherche, setRecherche] = useState("");

  async function charger() {
    setChargement(true);
    let requete = supabase
      .from("profiles")
      .select("*")
      .neq("role", "GARAGE")
      .order("created_at", { ascending: false });
    if (!afficherTous) {
      requete = requete.in("statut_kyc", ["NON_VERIFIE", "EN_ATTENTE"]);
    }
    const { data, error } = await requete;
    if (!error) {
      const liste = (data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        role: p.role as ProfilResume["role"],
        nom: p.nom as string,
        pseudo: p.pseudo as string,
        telephone: p.telephone as string,
        statutKyc: p.statut_kyc as string,
      }));
      setProfils(liste);

      const ids = liste.map((p) => p.id);
      if (ids.length > 0) {
        const { data: docs } = await supabase.from("documents_kyc").select("*").in("utilisateur_id", ids);
        const groupes: Record<string, DocumentKyc[]> = {};
        for (const d of docs ?? []) {
          const cle = (d as Record<string, unknown>).utilisateur_id as string;
          (groupes[cle] ??= []).push({
            type: (d as Record<string, unknown>).type as DocumentKyc["type"],
            cheminFichier: (d as Record<string, unknown>).chemin_fichier as string,
            createdAt: (d as Record<string, unknown>).created_at as string,
          });
        }
        setDocumentsParUtilisateur(groupes);
      } else {
        setDocumentsParUtilisateur({});
      }
    }
    setChargement(false);
  }

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afficherTous]);

  async function definirStatut(id: string, statut: string) {
    setEnCours(id);
    setErreurs((e) => ({ ...e, [id]: "" }));
    const { error } = await supabase.rpc("garage_verifier_kyc", {
      p_utilisateur_id: id,
      p_statut: statut,
    });
    setEnCours(null);
    if (error) {
      setErreurs((e) => ({ ...e, [id]: error.message }));
    } else {
      void charger();
    }
  }

  async function supprimerCompte(id: string, nom: string) {
    const ok = window.confirm(
      `Supprimer définitivement le compte de ${nom} ? Cette action est irréversible.`
    );
    if (!ok) return;
    setEnCours(id);
    setErreurs((e) => ({ ...e, [id]: "" }));
    const { error } = await supabase.rpc("supprimer_compte", {
      p_utilisateur_id: id,
    });
    setEnCours(null);
    if (error) {
      setErreurs((e) => ({ ...e, [id]: error.message }));
    } else {
      void charger();
    }
  }

  async function voirDocument(chemin: string) {
    const url = await urlSigneeDocument(chemin);
    if (url) window.open(url, "_blank");
  }

  const profilsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return profils;
    return profils.filter((p) =>
      [p.nom, p.pseudo, p.telephone].some((champ) => (champ ?? "").toLowerCase().includes(q))
    );
  }, [profils, recherche]);

  return (
    <GarageShell
      titre="Clients"
      sousTitre="Certification des dossiers avant remise des clés."
      actions={
        <button
          type="button"
          className="garage-btn garage-btn--fantome"
          onClick={() => setAfficherTous((v) => !v)}
        >
          {afficherTous ? "En attente seulement" : "Tous les comptes"}
        </button>
      }
    >
      <div className="garage-recherche">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un client (nom, pseudo, téléphone)"
          aria-label="Rechercher un client"
        />
      </div>

      {chargement && <p className="garage-etat">Chargement…</p>}
      {!chargement && profilsFiltres.length === 0 && (
        <div className="garage-vide">
          <p>{profils.length === 0 ? "Aucun dossier à traiter." : "Aucun client ne correspond à cette recherche."}</p>
        </div>
      )}

      <ul className="garage-liste">
        {profilsFiltres.map((p) => {
          const documents = documentsParUtilisateur[p.id] ?? [];
          const requis = documentsRequisPourRole(p.role);
          return (
            <li key={p.id} className="garage-dossier">
              <div className="garage-ligne-principal">
                <strong>{p.pseudo || p.nom || "Sans pseudo"}</strong>
                <span className={`garage-badge garage-badge--${p.statutKyc.toLowerCase()}`}>
                  {p.statutKyc === "VERIFIE"
                    ? "Certifié"
                    : p.statutKyc === "EN_ATTENTE"
                      ? "En attente"
                      : p.statutKyc === "REJETE"
                        ? "Rejeté"
                        : "Non certifié"}
                </span>
              </div>
              <p className="garage-meta">
                {p.nom ? `${p.nom} · ` : ""}
                {LIBELLES_ROLE[p.role] ?? p.role} · {p.telephone}
              </p>

              <div className="garage-docs">
                {requis.map((type) => {
                  const document = documents.find((d) => d.type === type);
                  return document ? (
                    <button
                      key={type}
                      type="button"
                      className="garage-doc garage-doc--ok"
                      onClick={() => void voirDocument(document.cheminFichier)}
                    >
                      {LIBELLES_DOCUMENT[type]}
                    </button>
                  ) : (
                    <span key={type} className="garage-doc garage-doc--ko">
                      {LIBELLES_DOCUMENT[type]}
                    </span>
                  );
                })}
              </div>

              {erreurs[p.id] && <p className="message-erreur">{erreurs[p.id]}</p>}

              <div className="garage-carte-actions">
                <button
                  type="button"
                  className="garage-btn garage-btn--principal"
                  disabled={enCours === p.id}
                  onClick={() => void definirStatut(p.id, "VERIFIE")}
                >
                  Certifier
                </button>
                <button
                  type="button"
                  className="garage-btn garage-btn--fantome"
                  disabled={enCours === p.id}
                  onClick={() => void definirStatut(p.id, "REJETE")}
                >
                  Rejeter
                </button>
                <button
                  type="button"
                  className="garage-btn garage-btn--danger"
                  disabled={enCours === p.id}
                  onClick={() => void supprimerCompte(p.id, p.pseudo || p.nom || "cet utilisateur")}
                >
                  Supprimer le compte
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </GarageShell>
  );
}
