export const NUMEROS_CONTACT = [
  { affichage: "+229 66 58 58 69", numero: "22966585869" },
  { affichage: "+229 0147880143", numero: "2290147880143" },
];

export function IconeWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.63-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 8.1c.16-.35.32-.36.47-.37h.4c.13 0 .3-.02.46.35.16.38.55 1.32.6 1.42.05.1.08.22.02.35a.9.9 0 0 1-.2.3c-.1.1-.2.2-.29.3-.1.1-.2.2-.09.4.12.2.53.9 1.14 1.45.78.7 1.44.92 1.65 1.02.2.1.32.08.44-.05.12-.13.5-.58.63-.78.13-.2.26-.16.44-.1.18.07 1.13.53 1.32.63.2.1.32.15.37.23.05.09.05.5-.12.98-.17.48-.99.92-1.38.98-.35.05-.8.08-1.29-.08-.3-.1-.68-.22-1.17-.43-2.06-.9-3.4-2.98-3.5-3.12-.1-.15-.84-1.12-.84-2.14 0-1.02.53-1.52.72-1.73Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconeTelephone({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.6 4h2.2l1 3.6-1.6 1.4a11.4 11.4 0 0 0 5.4 5.4l1.4-1.6 3.6 1v2.2c0 1-.8 1.8-1.8 1.7C11.7 17.2 6.8 12.3 4.5 7.2 4.4 6.2 5.2 4 6.6 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconeCasque() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13" width="4" height="6" rx="1.6" />
      <rect x="17" y="13" width="4" height="6" rx="1.6" />
      <path d="M19 19c0 1.4-1.6 2-4 2h-2" />
    </svg>
  );
}

export function ContactDirect({ intro, avecIcones = false }: { intro?: string; avecIcones?: boolean }) {
  return (
    <div className={`contact-direct${avecIcones ? " contact-direct--icones" : ""}`}>
      {intro && (
        <div className="contact-direct-entete">
          {avecIcones && (
            <span className="contact-direct-icone-support">
              <IconeCasque />
            </span>
          )}
          <p className="contact-direct-intro">{intro}</p>
        </div>
      )}
      <div className="contact-direct-liste">
        {NUMEROS_CONTACT.map((n) => (
          <div key={n.numero} className="contact-direct-numero">
            <span className="contact-direct-numero-texte">
              {avecIcones && (
                <span className="contact-direct-pastille">
                  <IconeWhatsApp />
                </span>
              )}
              {n.affichage}
            </span>
            <div className="contact-direct-actions">
              <a
                href={`https://wa.me/${n.numero}`}
                target="_blank"
                rel="noreferrer"
                className="contact-direct-bouton contact-direct-bouton--whatsapp"
              >
                <IconeWhatsApp />
                WhatsApp
              </a>
              <a href={`tel:+${n.numero}`} className="contact-direct-bouton contact-direct-bouton--appel">
                <IconeTelephone />
                Appeler
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
