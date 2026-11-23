type IconeProps = { className?: string };

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function IconeEmail({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7.5 8 6 8-6" />
    </svg>
  );
}

export function IconeCadenas({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="10.5" width="14" height="10" rx="3" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle cx="12" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeOeil({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconeOeilBarre({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.6 7.1A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m4 4 16 16" />
    </svg>
  );
}

export function IconeConnexion({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M4 12h11M11 8l4 4-4 4" />
    </svg>
  );
}

export function IconeCatalogue({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 6.5C10.3 5.3 7.9 4.8 4 5v13c3.9-.2 6.3.3 8 1.5 1.7-1.2 4.1-1.7 8-1.5V5c-3.9-.2-6.3.3-8 1.5Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

export function IconeFlecheDroite({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconeUtilisateur({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1-3.8 4-5.5 7.5-5.5s6.5 1.7 7.5 5.5" />
    </svg>
  );
}

export function IconeTelephone({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.6 3.5h2.7l1.4 4-1.9 1.3a11 11 0 0 0 5.9 5.9l1.3-1.9 4 1.4v2.7a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
    </svg>
  );
}

export function IconeCle({ className }: IconeProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8.5-8.5M16 7l3 3M14 9l2 2" />
    </svg>
  );
}
