import { t } from '../../core/i18n';
import CompassAdjustOverlay from '../CompassAdjustOverlay';

interface WaveSenseOverlayProps {
  /** Cap vers lequel vont les vagues, en degrés, tel qu'il est retenu ; `null` tant qu'il n'est pas estimé. */
  directionDeg: number | null;
  /** Vrai quand le sens est saisi, faux quand il est calculé. */
  manual: boolean;
  /** Vrai quand le sens calculé est jugé sûr. */
  reliable: boolean;
  /** Écrit le sens saisi dans le brouillon ; `null` revient au calculé. */
  onChange: (deg: number | null) => void;
  onClose: () => void;
}

/**
 * Réglage du sens des vagues posé sur la carte d'une analyse de surf : la
 * boussole commune (`CompassAdjustOverlay`), la flèche du centre vers le bord,
 * qui montre où vont les vagues ; la poignée au bord donne le cap.
 */
function WaveSenseOverlay({ directionDeg, manual, reliable, onChange, onClose }: WaveSenseOverlayProps) {
  return (
    <CompassAdjustOverlay value={directionDeg} autoValue={null} canReset={manual} onChange={onChange} onClose={onClose}
      arrow="versBord"
      texts={{
        value: (deg) => t('Vagues {deg}°', { deg }),
        field: t('Sens des vagues en degrés'),
        dial: t('Sens des vagues'),
        reset: t('Revenir au sens calculé'),
      }}
      source={manual ? t('saisi') : reliable ? t('calculé') : t('calculé · peu sûr')} />
  );
}

export default WaveSenseOverlay;
