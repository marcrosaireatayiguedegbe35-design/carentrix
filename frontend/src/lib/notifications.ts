import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { mapperVehicule } from "./mapperVehicule";
import { supabase } from "./supabaseClient";

/**
 * Notifications du client, uniquement :
 *  - un nouveau véhicule publié par le garage ;
 *  - la réponse du garage à une demande de réservation (validée ou refusée).
 * Elles sont détectées à l'ouverture de l'app, au retour sur l'onglet et toutes les 45 secondes,
 * puis conservées sur l'appareil (le visiteur non connecté reçoit aussi les nouveaux véhicules).
 */

export type TonaliteNotification = "info" | "succes" | "alerte";

export interface NotificationClient {
  id: string;
  type: "VEHICULE" | "RESERVATION";
  titre: string;
  detail: string;
  /** Date de détection (ISO). */
  date: string;
  lien: string;
  lu: boolean;
  tonalite: TonaliteNotification;
}

interface EtatStocke {
  /** Codes des véhicules déjà vus (la 1re synchronisation ne notifie pas l'existant). */
  vus: string[];
  items: NotificationClient[];
}

const MAX_NOTIFICATIONS = 50;
const INTERVALLE_MS = 45_000;

function cleStockage(idUtilisateur: string | undefined) {
  return `carentrix.notifications.v1.${idUtilisateur ?? "visiteur"}`;
}

function lire(cle: string): EtatStocke {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return { vus: [], items: [] };
    const donnees = JSON.parse(brut) as Partial<EtatStocke>;
    return {
      vus: Array.isArray(donnees.vus) ? donnees.vus : [],
      items: Array.isArray(donnees.items) ? donnees.items : [],
    };
  } catch {
    return { vus: [], items: [] };
  }
}

function ecrire(cle: string, etat: EtatStocke) {
  try {
    localStorage.setItem(cle, JSON.stringify(etat));
  } catch {
    // stockage indisponible (mode privé) : les notifications restent en mémoire pour cette session
  }
}

async function detecter(cle: string, connecte: boolean): Promise<EtatStocke> {
  // Réseau d'abord : l'état local est lu seulement après, pour ne pas écraser un « lu » intermédiaire.
  const { data: vehiculesData, error: vehiculesErreur } = await supabase.rpc("rechercher_vehicules", {
    p_ville: null,
    p_categorie: null,
    p_transmission: null,
    p_date_debut: null,
    p_date_fin: null,
  });
  const reservationsData = connecte
    ? (
        await supabase
          .from("mes_reservations")
          .select("code_public, statut, marque, modele")
          .order("date_debut", { ascending: false })
          .limit(20)
      ).data
    : null;

  const etat = lire(cle);
  const maintenant = new Date().toISOString();

  // 1. Nouveaux véhicules publiés
  if (!vehiculesErreur && vehiculesData) {
    const premiereSynchro = etat.vus.length === 0;
    for (const ligne of vehiculesData as Record<string, unknown>[]) {
      const v = mapperVehicule(ligne);
      if (etat.vus.includes(v.codePublic)) continue;
      etat.vus.push(v.codePublic);
      if (premiereSynchro) continue;
      etat.items.unshift({
        id: `vehicule-${v.codePublic}`,
        type: "VEHICULE",
        titre: "Nouveau véhicule disponible",
        detail: `${v.marque} ${v.modele} · ${v.ville}`,
        date: maintenant,
        lien: `/vehicules/${v.codePublic}`,
        lu: false,
        tonalite: "info",
      });
    }
  }

  // 2. Réponse du garage à une demande de réservation (clients connectés)
  for (const r of (reservationsData ?? []) as Record<string, unknown>[]) {
    const statut = r.statut as string;
    if (statut !== "EN_ATTENTE_PAIEMENT" && statut !== "REFUSEE") continue;
    const code = r.code_public as string;
    const id = `reservation-${code}-${statut}`;
    if (etat.items.some((n) => n.id === id)) continue;
    const valide = statut === "EN_ATTENTE_PAIEMENT";
    etat.items.unshift({
      id,
      type: "RESERVATION",
      titre: valide ? "Votre demande a été validée" : "Votre demande a été refusée",
      detail: `${r.marque as string} ${r.modele as string} · réservation ${code}${valide ? " — vous pouvez payer" : ""}`,
      date: maintenant,
      lien: "/mes-reservations",
      lu: false,
      tonalite: valide ? "succes" : "alerte",
    });
  }

  etat.items = etat.items.slice(0, MAX_NOTIFICATIONS);
  ecrire(cle, etat);
  return etat;
}

export function useNotifications() {
  const { utilisateur } = useAuth();
  const idUtilisateur = utilisateur?.id;
  const connecte = Boolean(utilisateur);
  const cle = cleStockage(idUtilisateur);
  const [items, setItems] = useState<NotificationClient[]>(() => lire(cle).items);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    setItems(lire(cle).items);

    async function actualiser() {
      try {
        const etat = await detecter(cle, connecte);
        if (!annule) setItems(etat.items);
      } catch {
        // réseau indisponible : on garde les notifications déjà stockées
      } finally {
        if (!annule) setChargement(false);
      }
    }

    void actualiser();
    const minuteur = window.setInterval(() => void actualiser(), INTERVALLE_MS);
    const surRetour = () => {
      if (document.visibilityState === "visible") void actualiser();
    };
    document.addEventListener("visibilitychange", surRetour);
    return () => {
      annule = true;
      window.clearInterval(minuteur);
      document.removeEventListener("visibilitychange", surRetour);
    };
  }, [cle, connecte]);

  const marquerToutLu = useCallback(() => {
    const etat = lire(cle);
    if (!etat.items.some((n) => !n.lu)) return;
    etat.items = etat.items.map((n) => ({ ...n, lu: true }));
    ecrire(cle, etat);
    setItems(etat.items);
  }, [cle]);

  const nonLues = items.filter((n) => !n.lu).length;

  return { items, nonLues, chargement, marquerToutLu };
}
