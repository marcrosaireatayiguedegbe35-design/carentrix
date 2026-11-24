import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { GarageShell } from "../../components/GarageShell";
import { supabase } from "../../lib/supabaseClient";
import { LIBELLES_MOYEN_REVERSEMENT, LIBELLES_STATUT_AGENCE, chargerMonAgence } from "../../lib/agences";
import type { Agence } from "../../lib/agences";

export function ProfilAgence() {
  const [agence, setAgence] = useState<Agence | null>(null);
  const [responsableNom, setResponsableNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    chargerMonAgence()
      .then(({ agence: a }) => {
        setAgence(a);
        setResponsableNom(a.responsableNom);
        setAdresse(a.adresse);
        setVille(a.ville);
        setEmail(a.email ?? "");
        setTelephone(a.telephone ?? "");
      })
      .catch((err) => setMessage({ ok: false, texte: err instanceof Error ? err.message : "Chargement impossible" }));
  }, []);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setEnvoi(true);
    const { error } = await supabase.rpc("agence_modifier_profil", {
      p_responsable_nom: responsableNom.trim(),
      p_adresse: adresse.trim(),
      p_ville: ville.trim(),
      p_email: email.trim(),
      p_telephone: telephone.trim(),
    });
    setEnvoi(false);
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: "Informations enregistrées." });
  }

  return (
    <GarageShell titre="Profil de l'agence" sousTitre={agence?.nom}>
      {agence && (
        <section className="garage-panneau">
          <h2>Partenariat</h2>
          <p className="garage-meta">
            Statut : <strong>{LIBELLES_STATUT_AGENCE[agence.statut]}</strong>
          </p>
          <p className="garage-meta">
            Commission Carentrix : <strong>{agence.tauxCommission} %</strong> · votre part :{" "}
            <strong>{Math.round((100 - agence.tauxCommission) * 100) / 100} %</strong>
          </p>
          <p className="garage-meta">
            Compte de reversement :{" "}
            <strong>
              {agence.reversementMoyen
                ? `${LIBELLES_MOYEN_REVERSEMENT[agence.reversementMoyen]}${agence.reversementNumero ? ` · ${agence.reversementNumero}` : ""}`
                : "non renseigné"}
            </strong>
          </p>
          <p className="garage-meta">
            La commission et le compte de reversement ne peuvent être modifiés que par l'administration Carentrix.
          </p>
        </section>
      )}

      <section className="garage-panneau garage-panneau--action">
        <h2>Coordonnées</h2>
        <form onSubmit={enregistrer} className="garage-corps">
          <div className="depot-champs">
            <label className="garage-champ">
              Responsable
              <input value={responsableNom} onChange={(e) => setResponsableNom(e.target.value)} required minLength={2} />
            </label>
            <label className="garage-champ">
              Téléphone
              <input value={telephone} onChange={(e) => setTelephone(e.target.value)} required />
            </label>
            <label className="garage-champ">
              Email de contact
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="garage-champ">
              Ville
              <input value={ville} onChange={(e) => setVille(e.target.value)} />
            </label>
            <label className="garage-champ depot-champ--large">
              Adresse
              <input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </label>
          </div>
          {message && <p className={message.ok ? "garage-meta" : "message-erreur"}>{message.texte}</p>}
          <button type="submit" className="garage-btn garage-btn--principal" disabled={envoi || !agence}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      </section>
    </GarageShell>
  );
}
