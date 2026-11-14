import { zoneLabel } from './heartRateColors';
import { t } from '../core/i18n';
import { commaDecimal } from '../core/units';

interface Props {
  /** Bornes basses des zones 1 à 5, en bpm (`HeartRateZones.bounds`). */
  bounds: readonly number[];
  /** Coefficients de « sous Z1 » à Z5 (`HeartRateProfile.loadWeights`). */
  weights: readonly number[];
  /** Statistiques : la charge est la somme des sessions de la période. */
  period?: boolean;
}

const coefficient = (w: number | undefined) => commaDecimal(w ?? 0);

/**
 * Explication de la charge cardiaque, dépliée par le « ? » de sa case :
 * onglet « cardio » d'une session et des statistiques.
 */
function CardioLoadHelp({ bounds, weights, period = false }: Props) {
  const range = (zone: number) =>
    zone === 0 ? t('moins de {n} bpm', { n: bounds[0] })
      : zone === bounds.length ? t('{n} bpm et plus', { n: bounds[zone - 1] })
        : t('{a} à {b} bpm', { a: bounds[zone - 1], b: bounds[zone] - 1 });
  const zones = Array.from({ length: bounds.length + 1 }, (_, zone) =>
    t('{zone} ({range}) × {coef}', { zone: zoneLabel(zone), range: range(zone), coef: coefficient(weights[zone]) })).join(' ; ');
  return (
    <div style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', lineHeight: 1.45, margin: '8px 0 4px' }}>
      {period
        ? t("La charge résume en un chiffre l'effort cardiaque de la période, sa durée et son intensité ensemble : chaque minute compte, d'autant plus que la FC est haute (méthode d'Edwards, temps sous Z1 compris).")
        : t("La charge résume en un chiffre l'effort cardiaque de la sortie, sa durée et son intensité ensemble : chaque minute compte, d'autant plus que la FC est haute (méthode d'Edwards, temps sous Z1 compris).")}
      {' '}{t('Minutes {zones}.', { zones })}
      {' '}{t('Ainsi 1 h en Z2 donne {a} ; 30 min en Z4, {b}.', { a: Math.round(60 * (weights[2] ?? 0)), b: Math.round(30 * (weights[4] ?? 0)) })}
      {period && ` ${t('Ici, somme des sessions de la période ; « Charge par semaine » la divise par le nombre de semaines.')}`}
    </div>
  );
}

export default CardioLoadHelp;
