import type { CSSProperties } from 'react';
import { t } from '../../core/i18n';

interface MapToggleProps {
  /** Vrai quand l'élément est montré sur la carte : la pastille prend alors la couleur de l'analyse. */
  shown: boolean;
  onClick: () => void;
  /** Couleur de la pastille allumée (accent de l'analyse ou de la surbrillance). */
  color: string;
  /** Texte de la pastille allumée : blanc par défaut (couleur de donnée), `--on-ink` sur l'accent de l'analyse. */
  ink?: string;
  disabled?: boolean;
  /** Libellés éteint puis allumé ; « Voir » et « Masquer » par défaut. */
  labels?: readonly [string, string];
  title?: string;
  /** Retouche d'une pastille qui s'écarte de la commune (marge, opacité). */
  style?: CSSProperties;
}

/**
 * Pastille « Voir sur la carte » d'une ligne de tableau ou d'un podium :
 * montre ou masque l'élément sur la carte de l'analyse (une seule surbrillance
 * à la fois, `useMapHighlight`). Pilule à trait d'encre, pleine quand
 * l'élément est montré. Le style reste en ligne, pour passer devant les règles
 * de boutons des tableaux du téléphone.
 */
function MapToggle({ shown, onClick, color, ink = 'var(--on-accent)', disabled, labels = [t('Voir'), t('Masquer')], title, style }: MapToggleProps) {
  return (
    <button
      type="button" disabled={disabled} title={title} onClick={onClick}
      style={{
        padding: '2px 8px', fontSize: 'var(--text-xs)', cursor: disabled ? 'default' : 'pointer',
        backgroundColor: shown ? color : 'transparent', color: shown ? ink : 'var(--ink)',
        border: `var(--stroke) solid ${shown ? color : 'var(--ink)'}`, borderRadius: 'var(--radius-pill)', ...style,
      }}>
      {shown ? labels[1] : labels[0]}
    </button>
  );
}

export default MapToggle;
