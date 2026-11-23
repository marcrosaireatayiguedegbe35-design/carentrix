import { useMemo, useRef, useState } from "react";

export type MoisFinance = {
  libelle: string;
  chiffreAffaires: number;
  beneficeNet: number;
  commandes: number;
};

function compact(n: number): string {
  const signe = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${signe}${(abs / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${signe}${(abs / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} K`;
  return `${signe}${abs.toLocaleString("fr-FR")}`;
}

function niceMax(valeur: number): number {
  if (valeur <= 0) return 1000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(valeur)));
  const residu = valeur / magnitude;
  const residuPropre = residu <= 1 ? 1 : residu <= 2 ? 2 : residu <= 5 ? 5 : 10;
  return residuPropre * magnitude;
}

const LARGEUR = 640;
const HAUTEUR = 260;
const MARGE = { haut: 26, bas: 34, gauche: 46, droite: 78 };
const LARGEUR_TRACE = LARGEUR - MARGE.gauche - MARGE.droite;
const HAUTEUR_TRACE = HAUTEUR - MARGE.haut - MARGE.bas;

const COULEUR_BENEFICE = "#a4243b";
const COULEUR_CA = "#d4a017";

export function CourbeFinances({ mois }: { mois: MoisFinance[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const yMax = useMemo(
    () => niceMax(Math.max(1000, ...mois.map((m) => Math.max(m.chiffreAffaires, m.beneficeNet)))),
    [mois]
  );

  const x = (i: number) => MARGE.gauche + (mois.length > 1 ? (i / (mois.length - 1)) * LARGEUR_TRACE : LARGEUR_TRACE / 2);
  const y = (v: number) => MARGE.haut + HAUTEUR_TRACE - (v / yMax) * HAUTEUR_TRACE;

  const cheminCa = mois.map((m, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(m.chiffreAffaires)}`).join(" ");
  const cheminBenefice = mois.map((m, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(m.beneficeNet)}`).join(" ");

  const dernier = mois[mois.length - 1];
  const yCaFin = dernier ? y(dernier.chiffreAffaires) : 0;
  const yBeneficeFin = dernier ? y(dernier.beneficeNet) : 0;
  const proches = Math.abs(yCaFin - yBeneficeFin) < 14;

  const ticks = [0, yMax / 2, yMax];

  function gererSurvol(evt: React.PointerEvent<SVGRectElement>) {
    const rect = evt.currentTarget.getBoundingClientRect();
    const ratio = LARGEUR / rect.width;
    const px = (evt.clientX - rect.left) * ratio;
    const pasIndex = mois.length > 1 ? LARGEUR_TRACE / (mois.length - 1) : LARGEUR_TRACE;
    const index = Math.round((px - MARGE.gauche) / pasIndex);
    setSurvol(Math.min(mois.length - 1, Math.max(0, index)));
  }

  function gererClavier(evt: React.KeyboardEvent<SVGRectElement>) {
    if (evt.key === "ArrowRight") {
      evt.preventDefault();
      setSurvol((s) => Math.min(mois.length - 1, (s ?? -1) + 1));
    } else if (evt.key === "ArrowLeft") {
      evt.preventDefault();
      setSurvol((s) => Math.max(0, (s ?? mois.length) - 1));
    }
  }

  const pointSurvol = survol !== null ? mois[survol] : null;
  const xSurvol = survol !== null ? x(survol) : 0;

  return (
    <div className="tb-carte-graphique">
      <div className="tb-graphique-entete">
        <h2>Chiffre d’affaires &amp; bénéfice net</h2>
        <ul className="tb-legende">
          <li>
            <span className="tb-legende-trait" style={{ background: COULEUR_BENEFICE }} aria-hidden="true" />
            Bénéfice net
          </li>
          <li>
            <span className="tb-legende-trait" style={{ background: COULEUR_CA }} aria-hidden="true" />
            Chiffre d’affaires
          </li>
        </ul>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="tb-svg"
        role="img"
        aria-label="Évolution du chiffre d’affaires et du bénéfice net sur les derniers mois"
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={MARGE.gauche}
              x2={LARGEUR - MARGE.droite}
              y1={y(t)}
              y2={y(t)}
              className="tb-grille"
            />
            <text x={MARGE.gauche - 8} y={y(t)} className="tb-axe-texte" textAnchor="end" dominantBaseline="middle">
              {compact(t)}
            </text>
          </g>
        ))}

        {mois.map((m, i) => (
          <text key={m.libelle + i} x={x(i)} y={HAUTEUR - 8} className="tb-axe-texte" textAnchor="middle">
            {m.libelle}
          </text>
        ))}

        <path d={cheminCa} className="tb-ligne" style={{ stroke: COULEUR_CA }} />
        <path d={cheminBenefice} className="tb-ligne" style={{ stroke: COULEUR_BENEFICE }} />

        {dernier && (
          <>
            <circle cx={x(mois.length - 1)} cy={yCaFin} r={6} className="tb-anneau" />
            <circle cx={x(mois.length - 1)} cy={yCaFin} r={4} style={{ fill: COULEUR_CA }} />
            <text
              x={x(mois.length - 1) + 10}
              y={proches ? yCaFin - 8 : yCaFin}
              className="tb-etiquette-fin"
              dominantBaseline="middle"
            >
              {compact(dernier.chiffreAffaires)}
            </text>

            <circle cx={x(mois.length - 1)} cy={yBeneficeFin} r={6} className="tb-anneau" />
            <circle cx={x(mois.length - 1)} cy={yBeneficeFin} r={4} style={{ fill: COULEUR_BENEFICE }} />
            <text
              x={x(mois.length - 1) + 10}
              y={proches ? yBeneficeFin + 8 : yBeneficeFin}
              className="tb-etiquette-fin"
              dominantBaseline="middle"
            >
              {compact(dernier.beneficeNet)}
            </text>
          </>
        )}

        {pointSurvol && (
          <g>
            <line
              x1={xSurvol}
              x2={xSurvol}
              y1={MARGE.haut}
              y2={HAUTEUR - MARGE.bas}
              className="tb-curseur"
            />
            <circle cx={xSurvol} cy={y(pointSurvol.chiffreAffaires)} r={4} style={{ fill: COULEUR_CA }} />
            <circle cx={xSurvol} cy={y(pointSurvol.beneficeNet)} r={4} style={{ fill: COULEUR_BENEFICE }} />
          </g>
        )}

        <rect
          x={MARGE.gauche}
          y={MARGE.haut}
          width={LARGEUR_TRACE}
          height={HAUTEUR_TRACE}
          fill="transparent"
          tabIndex={0}
          role="slider"
          aria-label="Parcourir les mois"
          aria-valuemin={0}
          aria-valuemax={mois.length - 1}
          aria-valuenow={survol ?? mois.length - 1}
          aria-valuetext={pointSurvol ? `${pointSurvol.libelle} : CA ${compact(pointSurvol.chiffreAffaires)} FCFA, bénéfice ${compact(pointSurvol.beneficeNet)} FCFA` : undefined}
          onPointerMove={gererSurvol}
          onPointerLeave={() => setSurvol(null)}
          onFocus={() => setSurvol((s) => s ?? mois.length - 1)}
          onBlur={() => setSurvol(null)}
          onKeyDown={gererClavier}
        />
      </svg>

      {pointSurvol && (
        <div
          className="tb-infobulle"
          style={{ left: `${(xSurvol / LARGEUR) * 100}%` }}
        >
          <strong>{pointSurvol.libelle}</strong>
          <span>
            <i style={{ background: COULEUR_BENEFICE }} /> Bénéfice <b>{formaterFcfa(pointSurvol.beneficeNet)}</b>
          </span>
          <span>
            <i style={{ background: COULEUR_CA }} /> CA <b>{formaterFcfa(pointSurvol.chiffreAffaires)}</b>
          </span>
        </div>
      )}

      <details className="tb-tableau">
        <summary>Voir le détail par mois</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              <th scope="col">Chiffre d’affaires</th>
              <th scope="col">Bénéfice net</th>
            </tr>
          </thead>
          <tbody>
            {mois.map((m) => (
              <tr key={m.libelle}>
                <th scope="row">{m.libelle}</th>
                <td>{formaterFcfa(m.chiffreAffaires)}</td>
                <td>{formaterFcfa(m.beneficeNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function BarresCommandes({ mois }: { mois: MoisFinance[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const yMax = useMemo(() => niceMax(Math.max(1, ...mois.map((m) => m.commandes))), [mois]);
  const largeurBande = mois.length > 0 ? LARGEUR_TRACE / mois.length : LARGEUR_TRACE;
  const largeurBarre = Math.min(24, largeurBande * 0.5);

  const yBase = MARGE.haut + HAUTEUR_TRACE;
  const yDe = (v: number) => MARGE.haut + HAUTEUR_TRACE - (v / yMax) * HAUTEUR_TRACE;
  const ticks = [0, yMax / 2, yMax];

  return (
    <div className="tb-carte-graphique">
      <div className="tb-graphique-entete">
        <h2>Commandes effectuées</h2>
      </div>

      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="tb-svg"
        role="img"
        aria-label="Nombre de commandes clôturées par mois"
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={MARGE.gauche} x2={LARGEUR - MARGE.droite} y1={yDe(t)} y2={yDe(t)} className="tb-grille" />
            <text x={MARGE.gauche - 8} y={yDe(t)} className="tb-axe-texte" textAnchor="end" dominantBaseline="middle">
              {Math.round(t)}
            </text>
          </g>
        ))}

        {mois.map((m, i) => {
          const cx = MARGE.gauche + largeurBande * i + largeurBande / 2;
          const hauteurBarre = yBase - yDe(m.commandes);
          const survolee = survol === i;
          return (
            <g key={m.libelle + i}>
              <rect
                x={cx - largeurBarre / 2}
                y={yDe(m.commandes)}
                width={largeurBarre}
                height={Math.max(hauteurBarre, m.commandes > 0 ? 3 : 0)}
                rx={4}
                className={`tb-barre${survolee ? " est-survolee" : ""}`}
              />
              {m.commandes > 0 && (
                <text x={cx} y={yDe(m.commandes) - 8} className="tb-etiquette-barre" textAnchor="middle">
                  {m.commandes}
                </text>
              )}
              <text x={cx} y={HAUTEUR - 8} className="tb-axe-texte" textAnchor="middle">
                {m.libelle}
              </text>
              <rect
                x={MARGE.gauche + largeurBande * i}
                y={MARGE.haut}
                width={largeurBande}
                height={HAUTEUR_TRACE}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${m.libelle} : ${m.commandes} commande${m.commandes > 1 ? "s" : ""}`}
                onPointerEnter={() => setSurvol(i)}
                onPointerLeave={() => setSurvol(null)}
                onFocus={() => setSurvol(i)}
                onBlur={() => setSurvol(null)}
              />
            </g>
          );
        })}
      </svg>

      <details className="tb-tableau">
        <summary>Voir le détail par mois</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              <th scope="col">Commandes</th>
            </tr>
          </thead>
          <tbody>
            {mois.map((m) => (
              <tr key={m.libelle}>
                <th scope="row">{m.libelle}</th>
                <td>{m.commandes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function formaterFcfa(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}
