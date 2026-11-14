import type { CSSProperties } from 'react';
import { SCHOOL_STYLES, type SchoolStyle } from '../../core/schoolBasics';
import { brushColorFor } from '../../core/brushColor';
import { useAppliedTheme } from '../../hooks/useTheme';
import FishSprite from './FishSprite';
import { fishScale, fishSymbolId } from './fishSymbols';
import './FishStylePicker.css';

/**
 * Choix du dessin des poissons du banc du Profil (Réglages › Pratiquant) : un bouton enfoncé par style, avec quelques
 * poissons de ce style en aperçu, les mêmes symboles que le banc (`FishSprite`). Chargé à part, avec les dessins.
 * Le style « Couleur d'activité » se montre aux couleurs des activités reçues, vues du thème comme sur le Profil.
 */

/** Trois poissons de l'aperçu : leur forme, leur place dans le cadre de 64 × 28 px, leur angle et leur longueur. */
const PREVIEW = [
  { shape: 0, x: 14, y: 9, angle: -8, size: 17 },
  { shape: 6, x: 43, y: 12, angle: 5, size: 17 },
  { shape: 2, x: 25, y: 21, angle: 3, size: 15 },
] as const;

interface Props {
  value: SchoolStyle;
  onChange: (style: SchoolStyle) => void;
  /** Couleurs des activités (claires, telles que rangées) pour l'aperçu du style à la couleur d'activité. */
  activityColors: readonly string[];
}

function FishStylePicker({ value, onChange, activityColors }: Props) {
  const dark = useAppliedTheme().theme === 'dark';
  return (
    <div className="fish-style-picker" role="group" aria-label="Poisson du banc">
      {SCHOOL_STYLES.map(({ id, name }) => (
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
          <span className="fish-style-picker__name">{name}</span>
        </button>
      ))}
    </div>
  );
}

export default FishStylePicker;
