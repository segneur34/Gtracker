import { useMemo, useState } from 'react';
import { t } from '../core/i18n';
import type { PolarBin } from '../sailing/wind';
import CompassAdjustOverlay from './CompassAdjustOverlay';
import SpeedPolarChart from './SpeedPolarChart';
import Button from './ui/Button';

interface WindAdjustOverlayProps {
  /** Vent retenu, en degrés (d'où il vient) ; `null` tant qu'aucun n'est connu. */
  windDeg: number | null;
  /** Vent calculé, et sa confiance de 0 à 1, pour mémoire ; `null` sans estimation. */
  autoWind: number | null;
  confidence: number | null;
  /** Vrai quand le vent retenu est saisi, faux quand c'est le calculé. */
  manual: boolean;
  /** Écrit le vent saisi dans le brouillon ; `null` revient au calculé. */
  onChange: (deg: number | null) => void;
  onClose: () => void;
  /** Polaire de vitesse à un vent donné, dans l'unité de l'activité. */
  polarAt: (deg: number) => PolarBin[];
  unitSymbol: string;
}

/** Polaire de vitesse au vent montré : elle suit la flèche. */
function WindPolar({ polarAt, deg, unitSymbol }: { polarAt: (deg: number) => PolarBin[]; deg: number; unitSymbol: string }) {
  const polar = useMemo(() => polarAt(deg), [polarAt, deg]);
  return (
    <div className="an-wind__polar">
      <SpeedPolarChart data={polar} unitSymbol={unitSymbol} compact />
    </div>
  );
}

/**
 * Réglage du vent posé sur la carte d'une analyse de voile (bouton « Régler »
 * de l'onglet « général ») : la boussole commune (`CompassAdjustOverlay`), la
 * flèche du bord vers le centre, et la polaire à la demande, qui suit la flèche.
 */
function WindAdjustOverlay({ windDeg, autoWind, confidence, manual, onChange, onClose, polarAt, unitSymbol }: WindAdjustOverlayProps) {
  const [polarShown, setPolarShown] = useState(false);
  return (
    <CompassAdjustOverlay value={windDeg} autoValue={autoWind} canReset={manual} onChange={onChange} onClose={onClose}
      arrow="versCentre"
      texts={{ value: (deg) => t('Vent {deg}°', { deg }), field: t('Vent en degrés'), dial: t('Direction du vent'), reset: t('Revenir au vent calculé') }}
      source={(
        <>
          {manual ? t('saisi') : t('calculé')}
          {autoWind !== null && manual && ` · ${t('calculé {deg}°', { deg: autoWind })}`}
          {confidence !== null && !manual && ` · ${t('confiance {percent} %', { percent: Math.round(confidence * 100) })}`}
        </>
      )}
      extraButtons={<Button size="s" aria-pressed={polarShown} onClick={() => setPolarShown(!polarShown)}>{t('Polaire')}</Button>}
      below={polarShown ? (deg) => <WindPolar polarAt={polarAt} deg={deg} unitSymbol={unitSymbol} /> : undefined} />
  );
}

export default WindAdjustOverlay;
