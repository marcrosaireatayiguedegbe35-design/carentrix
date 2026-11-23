export function BanniereSecurite() {
  return (
    <div className="banniere-securite">
      <svg className="banniere-securite-icone" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9 12 2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Votre sécurité, notre priorité</span>
      <span className="banniere-securite-traits" aria-hidden="true" />
    </div>
  );
}
