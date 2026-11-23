export function IndicateurChargement() {
  return (
    <div className="chargement-app" role="status" aria-live="polite">
      <span className="chargement-app-spinner" aria-hidden="true" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
