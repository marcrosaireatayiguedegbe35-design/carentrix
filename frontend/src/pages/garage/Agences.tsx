import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { GarageShell } from "../../components/GarageShell";
import { ListeMouvements } from "../../components/ListeMouvements";
import { supabase } from "../../lib/supabaseClient";
import {
  LIBELLES_MOYEN_REVERSEMENT,
  LIBELLES_STATUT_AGENCE,
  chargerMouvements,
  formaterFcfa,
  libelleSolde,
  mapperAgence,
  mapperSolde,
} from "../../lib/agences";
import type {
  Agence,
  MouvementAgence,
  MoyenReversement,
  SensReversement,
  SoldeAgence,
  StatutAgence,
} from "../../lib/agences";

const MOYENS = Object.keys(LIBELLES_MOYEN_REVERSEMENT) as MoyenReversement[];
const STATUTS = Object.keys(LIBELLES_STATUT_AGENCE) as StatutAgence[];

const CLASSE_BADGE: Record<StatutAgence, string> = {
  ACTIF: "garage-badge--confirmee",
  SUSPENDU: "garage-badge--annulee",
  EN_ATTENTE: "garage-badge--en_attente",
};

function messageErreur(err: unknown) {
  return err instanceof Error ? err.message : "Une erreur est survenue";
}

export function AgencesGarage() {
  const [agences, setAgences] = useState<Agence[]>([]);
  const [soldes, setSoldes] = useState<Record<string, SoldeAgence>>({});
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);

  async function charger() {
    setChargement(true);
    setErreurChargement(null);
    const [resAgences, resSoldes] = await Promise.all([
      supabase.from("agences").select("*").eq("est_plateforme", false).order("created_at", { ascending: false }),
      supabase.from("soldes_agences").select("*"),
    ]);
    if (resAgences.error) {
      setErreurChargement(
        resAgences.error.message.includes("agences")
          ? "La table des agences n'existe pas encore : exécutez supabase/schema_marketplace_agences.sql."
          : resAgences.error.message
      );
    } else {
      setAgences((resAgences.data ?? []).map(mapperAgence));
    }
    if (!resSoldes.error) {
      const parAgence: Record<string, SoldeAgence> = {};
      for (const ligne of resSoldes.data ?? []) {
        const solde = mapperSolde(ligne);
        parAgence[solde.agenceId] = solde;
      }
      setSoldes(parAgence);
    }
    setChargement(false);
  }

  useEffect(() => {
    void charger();
  }, []);

  const actives = agences.filter((a) => a.statut === "ACTIF").length;
  const totalDuAuxAgences = Object.values(soldes).reduce((t, s) => t + Math.max(s.solde, 0), 0);
  const totalDuParAgences = Object.values(soldes).reduce((t, s) => t + Math.max(-s.solde, 0), 0);

  return (
    <GarageShell
      titre="Agences partenaires"
      sousTitre="Créez les comptes des agences, fixez leur commission et suivez les reversements."
      actions={
        <button
          type="button"
          className="garage-btn garage-btn--principal"
          onClick={() => setFormulaireOuvert((v) => !v)}
        >
          {formulaireOuvert ? "Fermer" : "Nouvelle agence"}
        </button>
      }
    >
      <section className="kc-grille" aria-label="Indicateurs agences">
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Agences actives</span>
            <span className="kc-valeur">{chargement ? "…" : `${actives} / ${agences.length}`}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">À reverser aux agences</span>
            <span className="kc-valeur">{chargement ? "…" : formaterFcfa(totalDuAuxAgences)}</span>
          </div>
        </div>
        <div className="kc">
          <div className="kc-corps">
            <span className="kc-label">Commissions à recevoir</span>
            <span className="kc-valeur">{chargement ? "…" : formaterFcfa(totalDuParAgences)}</span>
          </div>
        </div>
      </section>

      {formulaireOuvert && (
        <FormulaireNouvelleAgence
          onCree={() => {
            setFormulaireOuvert(false);
            void charger();
          }}
        />
      )}

      {chargement && <p className="garage-etat">Chargement des agences…</p>}
      {erreurChargement && <p className="message-erreur">{erreurChargement}</p>}
      {!chargement && !erreurChargement && agences.length === 0 && (
        <div className="garage-vide">
          <p>Aucune agence partenaire pour le moment.</p>
          <button type="button" className="garage-btn garage-btn--principal" onClick={() => setFormulaireOuvert(true)}>
            Créer la première agence
          </button>
        </div>
      )}

      <ul className="garage-liste">
        {agences.map((a) => {
          const solde = soldes[a.id];
          const estOuverte = ouverte === a.id;
          return (
            <li key={a.id} className="garage-dossier">
              <div className="garage-ligne-principal">
                <strong>{a.nom}</strong>
                <span className={`garage-badge ${CLASSE_BADGE[a.statut]}`}>{LIBELLES_STATUT_AGENCE[a.statut]}</span>
              </div>
              <p className="garage-meta">
                Commission plateforme <strong>{a.tauxCommission} %</strong> · part agence{" "}
                {Math.round((100 - a.tauxCommission) * 100) / 100} %
              </p>
              <p className="garage-meta">
                {a.responsableNom}
                {a.telephone ? ` · ${a.telephone}` : ""}
                {a.email ? ` · ${a.email}` : ""}
                {a.ville ? ` · ${a.ville}` : ""}
              </p>
              <p className="garage-meta">
                <strong>{libelleSolde(solde?.solde ?? 0, "admin")}</strong>
              </p>
              <div className="garage-carte-actions">
                <button
                  type="button"
                  className="garage-btn garage-btn--fantome"
                  onClick={() => setOuverte(estOuverte ? null : a.id)}
                >
                  {estOuverte ? "Fermer" : "Gérer"}
                </button>
              </div>
              {estOuverte && (
                <GestionAgence
                  agence={a}
                  solde={solde?.solde ?? 0}
                  onModifie={() => void charger()}
                />
              )}
            </li>
          );
        })}
      </ul>
    </GarageShell>
  );
}

function FormulaireNouvelleAgence({ onCree }: { onCree: () => void }) {
  const [nom, setNom] = useState("");
  const [responsableNom, setResponsableNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("Cotonou");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [tauxCommission, setTauxCommission] = useState<number | "">(15);
  const [statut, setStatut] = useState<StatutAgence>("ACTIF");
  const [reversementMoyen, setReversementMoyen] = useState<MoyenReversement | "">("MTN_MOMO");
  const [reversementNumero, setReversementNumero] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(null);
    if (tauxCommission === "" || tauxCommission < 0 || tauxCommission > 100) {
      setErreur("La commission doit être comprise entre 0 et 100 %.");
      return;
    }
    if (motDePasse.length < 8) {
      setErreur("Le mot de passe provisoire doit contenir au moins 8 caractères.");
      return;
    }
    setEnvoi(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const reponse = await supabase.functions.invoke("admin-creer-agence", {
        body: {
          nom: nom.trim(),
          responsableNom: responsableNom.trim(),
          adresse: adresse.trim(),
          ville: ville.trim(),
          email: email.trim(),
          telephone: telephone.trim(),
          tauxCommission,
          statut,
          reversementMoyen: reversementMoyen || null,
          reversementNumero: reversementNumero.trim() || null,
          motDePasse,
        },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (reponse.error) {
        // L'Edge Function renvoie { erreur } avec un statut 4xx : on récupère ce message.
        const corps = await (reponse.error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(corps?.erreur ?? reponse.error.message);
      }
      if (reponse.data?.erreur) throw new Error(reponse.data.erreur);
      setSucces(
        `Agence « ${nom.trim()} » créée. Transmettez au responsable son email (${email.trim()}) et le mot de passe provisoire : il devra le changer à sa première connexion.`
      );
      setTimeout(onCree, 2500);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  const partAgence = tauxCommission === "" ? null : Math.round((100 - tauxCommission) * 100) / 100;

  return (
    <section className="garage-panneau garage-panneau--action">
      <h2>Nouvelle agence partenaire</h2>
      <form onSubmit={soumettre} className="garage-corps">
        <div className="depot-champs">
          <label className="garage-champ">
            Nom de l'agence
            <input value={nom} onChange={(e) => setNom(e.target.value)} required minLength={2} autoComplete="off" />
          </label>
          <label className="garage-champ">
            Nom du responsable
            <input
              value={responsableNom}
              onChange={(e) => setResponsableNom(e.target.value)}
              required
              minLength={2}
              autoComplete="off"
            />
          </label>
          <label className="garage-champ">
            Adresse
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} autoComplete="off" />
          </label>
          <label className="garage-champ">
            Ville
            <input value={ville} onChange={(e) => setVille(e.target.value)} autoComplete="off" />
          </label>
          <label className="garage-champ">
            Email (identifiant de connexion)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
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
          <label className="garage-champ">
            Commission plateforme (%)
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={tauxCommission}
              onChange={(e) => setTauxCommission(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </label>
          <label className="garage-champ">
            Statut du partenariat
            <select value={statut} onChange={(e) => setStatut(e.target.value as StatutAgence)}>
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {LIBELLES_STATUT_AGENCE[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="garage-champ">
            Reversements sur
            <select
              value={reversementMoyen}
              onChange={(e) => setReversementMoyen(e.target.value as MoyenReversement | "")}
            >
              <option value="">À définir</option>
              {MOYENS.map((m) => (
                <option key={m} value={m}>
                  {LIBELLES_MOYEN_REVERSEMENT[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="garage-champ">
            Numéro / compte de reversement
            <input value={reversementNumero} onChange={(e) => setReversementNumero(e.target.value)} autoComplete="off" />
          </label>
          <label className="garage-champ depot-champ--large">
            Mot de passe provisoire
            <input
              type="text"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8 caractères minimum — à changer à la première connexion"
            />
          </label>
        </div>

        {partAgence !== null && (
          <p className="garage-meta">
            Sur une location de 50 000 FCFA : plateforme{" "}
            <strong>{formaterFcfa((50000 * (tauxCommission as number)) / 100)}</strong>, agence{" "}
            <strong>{formaterFcfa((50000 * partAgence) / 100)}</strong>.
          </p>
        )}

        {erreur && <p className="message-erreur">{erreur}</p>}
        {succes && <p className="garage-meta">{succes}</p>}

        <button type="submit" className="garage-btn garage-btn--principal" disabled={envoi || !!succes}>
          {envoi ? "Création…" : "Créer l'agence et son accès"}
        </button>
      </form>
    </section>
  );
}

function GestionAgence({
  agence,
  solde,
  onModifie,
}: {
  agence: Agence;
  solde: number;
  onModifie: () => void;
}) {
  const [taux, setTaux] = useState<number | "">(agence.tauxCommission);
  const [statut, setStatut] = useState<StatutAgence>(agence.statut);
  const [moyen, setMoyen] = useState<MoyenReversement | "">(agence.reversementMoyen ?? "");
  const [numero, setNumero] = useState(agence.reversementNumero ?? "");
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageReglages, setMessageReglages] = useState<{ ok: boolean; texte: string } | null>(null);

  const [sens, setSens] = useState<SensReversement>(solde < 0 ? "AGENCE_VERS_PLATEFORME" : "PLATEFORME_VERS_AGENCE");
  const [montant, setMontant] = useState<number | "">(Math.abs(solde) || "");
  const [moyenReversement, setMoyenReversement] = useState<MoyenReversement>(agence.reversementMoyen ?? "MTN_MOMO");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [envoiReversement, setEnvoiReversement] = useState(false);
  const [messageReversement, setMessageReversement] = useState<{ ok: boolean; texte: string } | null>(null);

  const [mouvements, setMouvements] = useState<MouvementAgence[] | null>(null);

  useEffect(() => {
    chargerMouvements(agence.id, 20)
      .then(setMouvements)
      .catch(() => setMouvements([]));
  }, [agence.id, solde]);

  async function enregistrerReglages(e: FormEvent) {
    e.preventDefault();
    setMessageReglages(null);
    if (taux === "" || taux < 0 || taux > 100) {
      setMessageReglages({ ok: false, texte: "La commission doit être comprise entre 0 et 100 %." });
      return;
    }
    if (
      statut !== "ACTIF" &&
      agence.statut === "ACTIF" &&
      !window.confirm(`Suspendre ${agence.nom} retire immédiatement tous ses véhicules du catalogue. Continuer ?`)
    ) {
      return;
    }
    setEnregistrement(true);
    const { error } = await supabase
      .from("agences")
      .update({
        taux_commission: taux,
        statut,
        reversement_moyen: moyen || null,
        reversement_numero: numero.trim() || null,
      })
      .eq("id", agence.id);
    setEnregistrement(false);
    if (error) {
      setMessageReglages({ ok: false, texte: error.message });
    } else {
      setMessageReglages({
        ok: true,
        texte:
          taux !== agence.tauxCommission
            ? "Enregistré. Le nouveau taux s'applique aux prochaines réservations uniquement."
            : "Enregistré.",
      });
      onModifie();
    }
  }

  async function enregistrerReversement(e: FormEvent) {
    e.preventDefault();
    setMessageReversement(null);
    if (montant === "" || montant <= 0) {
      setMessageReversement({ ok: false, texte: "Indiquez un montant positif." });
      return;
    }
    if (!reference.trim()) {
      setMessageReversement({ ok: false, texte: "La référence de la transaction est obligatoire." });
      return;
    }
    setEnvoiReversement(true);
    const { error } = await supabase.rpc("admin_enregistrer_reversement", {
      p_agence_id: agence.id,
      p_sens: sens,
      p_montant: montant,
      p_moyen: moyenReversement,
      p_reference: reference.trim(),
      p_note: note.trim() || null,
    });
    setEnvoiReversement(false);
    if (error) {
      setMessageReversement({ ok: false, texte: error.message });
    } else {
      setMessageReversement({ ok: true, texte: "Reversement enregistré." });
      setReference("");
      setNote("");
      onModifie();
    }
  }

  return (
    <div className="garage-corps" style={{ marginTop: "1rem" }}>
      <section className="garage-panneau">
        <h2>Réglages</h2>
        <form onSubmit={enregistrerReglages} className="garage-corps">
          <div className="depot-champs">
            <label className="garage-champ">
              Commission plateforme (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={taux}
                onChange={(e) => setTaux(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
            <label className="garage-champ">
              Statut
              <select value={statut} onChange={(e) => setStatut(e.target.value as StatutAgence)}>
                {STATUTS.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLES_STATUT_AGENCE[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="garage-champ">
              Reversements sur
              <select value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenReversement | "")}>
                <option value="">À définir</option>
                {MOYENS.map((m) => (
                  <option key={m} value={m}>
                    {LIBELLES_MOYEN_REVERSEMENT[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="garage-champ">
              Numéro / compte
              <input value={numero} onChange={(e) => setNumero(e.target.value)} autoComplete="off" />
            </label>
          </div>
          {messageReglages && (
            <p className={messageReglages.ok ? "garage-meta" : "message-erreur"}>{messageReglages.texte}</p>
          )}
          <button type="submit" className="garage-btn garage-btn--principal" disabled={enregistrement}>
            {enregistrement ? "Enregistrement…" : "Enregistrer les réglages"}
          </button>
        </form>
      </section>

      <section className="garage-panneau">
        <h2>Enregistrer un reversement</h2>
        <p className="garage-meta">{libelleSolde(solde, "admin")}.</p>
        <form onSubmit={enregistrerReversement} className="garage-corps">
          <div className="depot-champs">
            <label className="garage-champ">
              Sens
              <select value={sens} onChange={(e) => setSens(e.target.value as SensReversement)}>
                <option value="PLATEFORME_VERS_AGENCE">Carentrix a payé l'agence</option>
                <option value="AGENCE_VERS_PLATEFORME">L'agence a payé sa commission</option>
              </select>
            </label>
            <label className="garage-champ">
              Montant (FCFA)
              <input
                type="number"
                min={1}
                value={montant}
                onChange={(e) => setMontant(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
            <label className="garage-champ">
              Moyen
              <select
                value={moyenReversement}
                onChange={(e) => setMoyenReversement(e.target.value as MoyenReversement)}
              >
                {MOYENS.map((m) => (
                  <option key={m} value={m}>
                    {LIBELLES_MOYEN_REVERSEMENT[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="garage-champ">
              Référence de la transaction
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="ID Mobile Money / virement"
                autoComplete="off"
              />
            </label>
            <label className="garage-champ depot-champ--large">
              Note (facultatif)
              <input value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
            </label>
          </div>
          {messageReversement && (
            <p className={messageReversement.ok ? "garage-meta" : "message-erreur"}>{messageReversement.texte}</p>
          )}
          <button type="submit" className="garage-btn garage-btn--principal" disabled={envoiReversement}>
            {envoiReversement ? "Enregistrement…" : "Enregistrer le reversement"}
          </button>
        </form>
      </section>

      <section className="garage-panneau">
        <h2>Derniers mouvements</h2>
        <ListeMouvements mouvements={mouvements} />
      </section>
    </div>
  );
}
