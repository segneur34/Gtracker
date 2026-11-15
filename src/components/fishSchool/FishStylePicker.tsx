import type { CSSProperties } from 'react';
import { SCHOOL_STYLES, type SchoolStyle } from '../../core/schoolBasics';
import { brushColorFor } from '../../core/brushColor';
import { useAppliedTheme } from '../../hooks/useTheme';
import { t } from '../../core/i18n';
import FishSprite from './FishSprite';
import { fishScale, fishSymbolId } from './fishSymbols';
import './FishStylePicker.css';

/**
 * Choix du dessin des poissons du banc du Profil (réglages de l'écran Profil) : un bouton enfoncé par style, avec
 * quelques poissons de ce style en aperçu, les mêmes symboles que le banc (`FishSprite`), puis « Aucun », qui cache le
 * banc. Chargé à part, avec les dessins.
 * Le style « Couleur d'activité » se montre aux couleurs des activités reçues, vues du thème comme sur le Profil.
 */

/** Trois poissons de l'aperçu : leur forme, leur place dans le cadre de 64 × 28 px, leur angle et leur longueur. */
const PREVIEW = [
  { shape: 0, x: 14, y: 9, angle: -8, size: 17 },
  { shape: 6, x: 43, y: 12, angle: 5, size: 17 },
  { shape: 2, x: 25, y: 21, angle: 3, size: 15 },
] as const;

/** Nom montré de chaque style : celui de `SCHOOL_STYLES` (français, sans import), traduit à l'affichage. */
const STYLE_NAME: Record<SchoolStyle, string> = {
  P1: t('Alevin au trait'),
  P2: t('Silhouette'),
  P3: t('Pictogramme'),
  P4: t('Deux arcs'),
  P5: t('Couleur d’activité'),
  P6: t('Pinceau'),
  P7: t('Ajouré'),
};

interface Props {
  /** Style montré, `null` : banc caché (« Aucun »). */
  value: SchoolStyle | null;
  /** Un style montre le banc dans ce dessin, `null` le cache. */
  onChange: (style: SchoolStyle | null) => void;
  /** Couleurs des activités (claires, telles que rangées) pour l'aperçu du style à la couleur d'activité. */
  activityColors: readonly string[];
}

function FishStylePicker({ value, onChange, activityColors }: Props) {
  const dark = useAppliedTheme().theme === 'dark';
  return (
    <div className="fish-style-picker" role="group" aria-label={t('Poisson du banc')}>
      {SCHOOL_STYLES.map(({ id }) => (
        <button key={id} type="button" className="fish-style-picker__choice" aria-pressed={id === value}
          data-style={id} onClick={() => onChange(id)}>
          <svg className="fish-style-picker__preview" viewBox="0 0 64 28" aria-hidden="true" focusable="false">
            <FishSprite style={id} />
            {PREVIEW.map((f, k) => {
              const color = activityColors.length > 0 ? brushColorFor(activityColors[k % activityColors.length], dark) : null;
              return (
                <use key={k} href={`#${fishSymbolId(id, f.shape)}`}
                  transform={`translate(${f.x} ${f.y}) rotate(${f.angle}) scale(${fishScale(f.size).toFixed(3)})`}
                  style={color ? ({ '--fish-act': color } as CSSProperties) : undefined} />
              );
            })}
          </svg>
          <span className="fish-style-picker__name">{STYLE_NAME[id]}</span>
        </button>
      ))}
      {/* Huitième choix : ni banc ni eau, le Profil d'avant le banc. Aperçu vide, de la taille des autres. */}
      <button type="button" className="fish-style-picker__choice" aria-pressed={value === null}
        data-style="aucun" onClick={() => onChange(null)}>
        <svg className="fish-style-picker__preview" viewBox="0 0 64 28" aria-hidden="true" focusable="false" />
        <span className="fish-style-picker__name">{t('Aucun')}</span>
      </button>
    </div>
  );
}

export default FishStylePicker;
