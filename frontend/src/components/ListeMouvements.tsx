import { LIBELLES_MOUVEMENT, formaterFcfa } from "../lib/agences";
import type { MouvementAgence } from "../lib/agences";

/** Grand livre d'une agence : + = dû à l'agence, − = dû à la plateforme (ou déjà reversé). */
export function ListeMouvements({ mouvements }: { mouvements: MouvementAgence[] | null }) {
  if (mouvements === null) return <p className="garage-etat">Chargement…</p>;
  if (mouvements.length === 0) return <p className="garage-meta">Aucun mouvement pour le moment.</p>;
  return (
    <ul className="garage-liste">
      {mouvements.map((m) => (
        <li key={m.id} className="garage-ligne-principal">
          <span>
            <strong>{LIBELLES_MOUVEMENT[m.type]}</strong>
            <span className="garage-meta">
              {" "}
              · {new Date(m.createdAt).toLocaleDateString("fr-FR")}
              {m.libelle ? ` · ${m.libelle}` : ""}
            </span>
          </span>
          <strong style={{ color: m.montant >= 0 ? "var(--vert, #15803d)" : "var(--rouge, #b91c1c)" }}>
            {m.montant >= 0 ? "+" : "−"}
            {formaterFcfa(Math.abs(m.montant))}
          </strong>
        </li>
      ))}
    </ul>
  );
}
