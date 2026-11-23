export function PageAVenir({
  eyebrow,
  titre,
  description,
}: {
  eyebrow: string;
  titre: string;
  description: string;
}) {
  return (
    <div className="page-espace">
      <header className="espace-entete">
        <div>
          <p className="espace-eyebrow">{eyebrow}</p>
          <h1 className="espace-titre">{titre}</h1>
          <p className="espace-sous">{description}</p>
        </div>
      </header>
      <div className="etat-page">
        <p className="etat-page-titre">Bientôt disponible</p>
        <p className="texte-secondaire">Cette fonctionnalité arrive prochainement sur Carentrix.</p>
      </div>
    </div>
  );
}
