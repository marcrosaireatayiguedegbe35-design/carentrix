function IconeEtoile({ pleine }: { pleine: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5l2.62 5.94 6.38.65-4.8 4.4 1.32 6.51L12 17.9l-5.52 3.1 1.32-6.51-4.8-4.4 6.38-.65L12 3.5Z"
        fill={pleine ? "#d4a017" : "none"}
        stroke="#d4a017"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Affichage lecture seule d'une note (arrondie à l'étoile la plus proche). */
export function Etoiles({ note }: { note: number }) {
  const pleines = Math.round(note);
  return (
    <span className="etoiles" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <IconeEtoile key={i} pleine={i < pleines} />
      ))}
    </span>
  );
}

/** Sélecteur de note interactif (1 à 5). */
export function SaisieEtoiles({
  valeur,
  onChange,
}: {
  valeur: number;
  onChange: (note: number) => void;
}) {
  return (
    <span className="etoiles etoiles--saisie" role="radiogroup" aria-label="Votre note">
      {Array.from({ length: 5 }, (_, i) => {
        const note = i + 1;
        return (
          <button
            key={note}
            type="button"
            role="radio"
            aria-checked={valeur === note}
            aria-label={`${note} étoile${note > 1 ? "s" : ""}`}
            onClick={() => onChange(note)}
          >
            <IconeEtoile pleine={note <= valeur} />
          </button>
        );
      })}
    </span>
  );
}
