import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ContactDirect } from "../components/ContactDirect";
import { PaiementIndisponible } from "../components/PaiementIndisponible";
import { supabase } from "../lib/supabaseClient";
import type { Reservation } from "../types";

const CLE_PUBLIQUE_FEDAPAY = import.meta.env.VITE_FEDAPAY_PUBLIC_KEY;

function IconeCheckCercle() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
      <path d="m7.5 12.5 3 3 6-6.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ModePaiement = "mtn" | "moov" | "celtiis" | "cash";
type ModeDirectFedapay = "mtn_open" | "moov";

// Depuis la réforme de la numérotation de l'ARCEP (2024), tous les numéros
// béninois comptent 10 chiffres et commencent par "01".
const REGEX_TELEPHONE_BENIN = /^01\d{8}$/;

const MODES: {
  id: ModePaiement;
  label: string;
  detail: string;
  icone?: string;
  fedapay: boolean;
  modeDirect?: ModeDirectFedapay;
}[] = [
  { id: "mtn", label: "MTN MoMo", detail: "Mobile Money", icone: "/paiements/mtn.png", fedapay: true, modeDirect: "mtn_open" },
  { id: "moov", label: "Moov Money", detail: "Mobile Money", icone: "/paiements/moov.png", fedapay: true, modeDirect: "moov" },
  { id: "celtiis", label: "Celtiis", detail: "Mobile Money", icone: "/paiements/celtiis.jpeg", fedapay: true },
  { id: "cash", label: "Espèces", detail: "Paiement au garage", fedapay: false },
];

// supabase.functions.invoke ne renvoie pas le corps d'une réponse non-2xx dans
// `data` : le vrai message d'erreur de la fonction est dans error.context.
async function messageErreurFonction(reponse: { data: unknown; error: unknown }, defaut: string): Promise<string> {
  const data = reponse.data as { erreur?: string } | null;
  if (data?.erreur) return data.erreur;
  const contexte = (reponse.error as { context?: unknown } | null)?.context;
  if (contexte instanceof Response) {
    try {
      const corps = await contexte.clone().json();
      if (corps?.erreur) return corps.erreur as string;
    } catch {
      // corps non JSON : message par défaut
    }
  }
  return defaut;
}

export function Paiement() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mode, setMode] = useState<ModePaiement>("mtn");
  const [telephone, setTelephone] = useState("");
  const [statutPaiement, setStatutPaiement] = useState<
    "EN_ATTENTE" | "VERIFICATION" | "REUSSI" | "ECHOUE" | "CASH" | null
  >(null);

  async function chargerReservation() {
    if (!code) return;
    const { data, error } = await supabase.from("mes_reservations").select("*").eq("code_public", code).single();
    if (error || !data) {
      setErreur("Réservation introuvable.");
      return;
    }
    setReservation({
      codePublic: data.code_public,
      statut: data.statut,
      dateDebut: data.date_debut,
      dateFin: data.date_fin,
      montantTotal: data.montant_total,
      caution: data.caution,
      montantChauffeur: data.montant_chauffeur ?? 0,
      chauffeurPseudo: data.chauffeur_pseudo ?? null,
      vehicule: {
        codePublic: data.vehicule_code,
        marque: data.marque,
        modele: data.modele,
        ville: data.ville,
        photos: data.photos ?? [],
      },
    });
    if (data.statut === "CONFIRMEE") {
      setStatutPaiement((actuel) => actuel ?? "REUSSI");
    }
    // DEMANDEE : pas encore validée par le garage
    if (data.statut === "DEMANDEE") {
      setErreur("Cette demande est en attente de validation par le garage. Vous pourrez payer une fois validée.");
    }
    // REFUSEE ou EXPIREE : plus possible de payer
    if (data.statut === "REFUSEE" || data.statut === "EXPIREE") {
      setErreur("Cette réservation n'est plus disponible pour paiement.");
    }
  }

  useEffect(() => {
    chargerReservation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function confirmerAupresDeFedapay(transactionId: number | string, tentative = 0) {
    setStatutPaiement("VERIFICATION");
    const { data: session } = await supabase.auth.getSession();
    const reponse = await supabase.functions.invoke("confirmer-paiement-fedapay", {
      body: { transactionId },
      headers: { Authorization: `Bearer ${session.session?.access_token}` },
    });

    if (reponse.error || reponse.data?.erreur) {
      setErreur(await messageErreurFonction(reponse, "Impossible de vérifier le paiement."));
      setStatutPaiement("EN_ATTENTE");
      return;
    }

    if (reponse.data.statutPaiement === "REUSSI") {
      setStatutPaiement("REUSSI");
      chargerReservation();
    } else if (reponse.data.statutPaiement === "ECHOUE") {
      setStatutPaiement("ECHOUE");
      setErreur("Le paiement n'a pas abouti. Vous pouvez réessayer.");
    } else if (tentative >= 40) {
      // ~2 minutes de tentatives (40 × 3s) : on arrête d'attendre indéfiniment
      // et on laisse la personne relancer plutôt que de la bloquer sur cet écran.
      setStatutPaiement("EN_ATTENTE");
      setErreur("La confirmation prend trop de temps. Vérifiez votre téléphone puis réessayez.");
    } else {
      setTimeout(() => confirmerAupresDeFedapay(transactionId, tentative + 1), 3000);
    }
  }

  async function payerEnCash() {
    if (!code) return;
    setErreur(null);
    setChargement(true);
    try {
      const { error } = await supabase.rpc("payer_reservation", {
        p_code_reservation: code,
        p_moyen: "CASH",
      });
      if (error) throw new Error(error.message);
      setStatutPaiement("CASH");
      await chargerReservation();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Impossible de valider le paiement en espèces.");
    } finally {
      setChargement(false);
    }
  }

  async function payerEnLigne() {
    setErreur(null);
    setChargement(true);

    const { data: session } = await supabase.auth.getSession();
    const reponse = await supabase.functions.invoke("creer-paiement-fedapay", {
      body: { codeReservation: code },
      headers: { Authorization: `Bearer ${session.session?.access_token}` },
    });

    setChargement(false);

    if (reponse.error || reponse.data?.erreur) {
      setErreur(await messageErreurFonction(reponse, "Impossible de démarrer le paiement."));
      return;
    }

    const { transactionId } = reponse.data;

    const widget = FedaPay.init({
      public_key: CLE_PUBLIQUE_FEDAPAY,
      transaction: { id: transactionId },
      onComplete: (raison) => {
        if (raison === FedaPay.CHECKOUT_COMPLETED) {
          confirmerAupresDeFedapay(transactionId);
        }
      },
    });
    widget.open();
  }

  async function payerParMobileMoneyDirect(modeDirect: ModeDirectFedapay) {
    setErreur(null);
    const telephoneChiffres = telephone.replace(/\D/g, "");
    if (!REGEX_TELEPHONE_BENIN.test(telephoneChiffres)) {
      setErreur("Veuillez saisir un numéro béninois valide à 10 chiffres commençant par 01.");
      return;
    }

    setChargement(true);
    const { data: session } = await supabase.auth.getSession();
    const reponse = await supabase.functions.invoke("creer-paiement-fedapay", {
      body: { codeReservation: code, mode: modeDirect, telephone: telephoneChiffres },
      headers: { Authorization: `Bearer ${session.session?.access_token}` },
    });
    setChargement(false);

    if (reponse.error || reponse.data?.erreur) {
      setErreur(await messageErreurFonction(reponse, "Impossible de démarrer le paiement."));
      return;
    }

    void confirmerAupresDeFedapay(reponse.data.transactionId);
  }

  function payer() {
    if (mode === "cash") {
      void payerEnCash();
      return;
    }
    if (modeActif.modeDirect) {
      void payerParMobileMoneyDirect(modeActif.modeDirect);
      return;
    }
    void payerEnLigne();
  }

  if (erreur && !reservation) return <p className="message-erreur">{erreur}</p>;
  if (!reservation) return <p className="texte-secondaire">Chargement...</p>;

  const montantAPayer = reservation.montantTotal + reservation.caution;
  const modeActif = MODES.find((m) => m.id === mode)!;

  // Statuts qui ne permettent pas le paiement
  const statutBloque = ["DEMANDEE", "REFUSEE", "EXPIREE", "ANNULEE", "CLOTUREE"].includes(reservation.statut);

  if (statutPaiement === "REUSSI" || statutPaiement === "CASH") {
    const estCash = statutPaiement === "CASH";
    return (
      <div className="page-paiement">
        <div className="formulaire formulaire-paiement carte-confirmation">
          <span className="paiement-confirmation-icone" aria-hidden="true">
            <IconeCheckCercle />
          </span>
          <h1>{estCash ? "Réservation confirmée" : "Paiement confirmé"}</h1>
          <p>
            Votre réservation <strong>{reservation.codePublic}</strong> est maintenant confirmée.
          </p>
          <p className="texte-secondaire">
            {estCash
              ? `Réglez ${montantAPayer.toLocaleString("fr-FR")} FCFA en espèces au garage le ${new Date(reservation.dateDebut).toLocaleString("fr-FR")}, muni de votre pièce d'identité.`
              : `Présentez-vous au garage central le ${new Date(reservation.dateDebut).toLocaleString("fr-FR")} avec votre pièce d'identité pour le retrait du véhicule.`}
          </p>
          <div className="espace-actions">
            <button type="button" className="espace-action-secondaire" onClick={() => navigate("/mes-reservations")}>
              Voir mes réservations
            </button>
          </div>
          <ContactDirect intro="Une question sur votre réservation ? Contactez-nous directement." />
        </div>
      </div>
    );
  }

  if (statutBloque) {
    const messageBloque =
      (reservation.statut === "DEMANDEE" && "Cette demande est en attente de validation par le garage.") ||
      (reservation.statut === "REFUSEE" && "Cette demande a été refusée par le garage.") ||
      (reservation.statut === "EXPIREE" && "Cette réservation a expiré.") ||
      (reservation.statut === "ANNULEE" && "Cette réservation a été annulée.") ||
      (reservation.statut === "CLOTUREE" && "Cette location est déjà terminée.") ||
      "";
    return (
      <PaiementIndisponible message={messageBloque} onVoirReservations={() => navigate("/mes-reservations")} />
    );
  }

  return (
    <div className="page-paiement">
      <div className="paiement-panneau">
        <h1 className="paiement-panneau-titre">Paiement</h1>

        <div className="paiement-montant-total">
          <span>Total à payer</span>
          <strong>{montantAPayer.toLocaleString("fr-FR")} FCFA</strong>
        </div>

        <div className="modes-paiement-grille" role="radiogroup" aria-label="Modes de paiement">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className={`mode-paiement${mode === m.id ? " mode-paiement-actif" : ""}`}
              onClick={() => setMode(m.id)}
            >
              <span className={`mode-paiement-icone${m.icone ? "" : " mode-paiement-icone--texte"}`}>
                {m.icone ? <img src={m.icone} alt="" /> : <span aria-hidden="true">CFA</span>}
              </span>
              <span className="mode-paiement-texte">
                <strong>{m.label}</strong>
                <small>{m.detail}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="paiement-panneau-detail">
          {mode === "cash" && (
            <p className="paiement-cash-info" role="note">
              La réservation sera confirmée immédiatement. Le montant sera réglé en espèces au garage
              lors de la remise du véhicule.
            </p>
          )}

          {modeActif.modeDirect && (
            <label className="champ-telephone-paiement">
              <span>Numéro {modeActif.label}</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="Ex : 01 90 00 00 00"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                disabled={chargement || statutPaiement === "VERIFICATION"}
              />
            </label>
          )}

          {erreur && <p className="message-erreur">{erreur}</p>}

          <button
            type="button"
            className="paiement-bouton-payer"
            onClick={payer}
            disabled={
              chargement ||
              statutPaiement === "VERIFICATION" ||
              (!!modeActif.modeDirect && !REGEX_TELEPHONE_BENIN.test(telephone.replace(/\D/g, "")))
            }
          >
            {statutPaiement === "VERIFICATION"
              ? modeActif.modeDirect
                ? "En attente de confirmation sur votre téléphone..."
                : "Vérification du paiement..."
              : chargement
                ? mode === "cash"
                  ? "Confirmation..."
                  : "Préparation du paiement..."
                : mode === "cash"
                  ? `Confirmer — payer ${montantAPayer.toLocaleString("fr-FR")} FCFA au garage`
                  : `Payer avec ${modeActif.label} — ${montantAPayer.toLocaleString("fr-FR")} FCFA`}
          </button>

          {modeActif.modeDirect && (
            <p className="texte-secondaire paiement-note">
              Validez la demande {modeActif.label} reçue sur ce numéro avec votre code secret Mobile Money.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
