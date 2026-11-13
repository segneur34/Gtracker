import { useEffect, useId, useState, type CSSProperties } from 'react';
import { FISH_LEVELS, type FishPath, type FishStyle } from '../library/fishGrowth';
import { fishDrawingKey, fishMarkup, loadFishDrawing } from './fishDrawings';
import './ProfileFish.css';

/**
 * Poisson du Profil dans son bocal : un bouton nommé pour un lecteur d'écran, le dessin du style, de la voie et du
 * niveau montrés, lu à la demande (`fishDrawings.ts`). Le bocal grandit avec le niveau, petit pour l'alevin, plein au
 * dernier ; sa plus grande taille suit la largeur de l'en-tête (`ProfileFish.css`).
 */

/** Taille du bocal du niveau 1 au niveau 6, en part du plus grand. */
const SIZE_FACTORS = [0.48, 0.57, 0.67, 0.76, 0.88, 1] as const;

const levelIndex = (level: number): number => Math.min(FISH_LEVELS, Math.max(1, Math.round(level))) - 1;

interface DrawingProps {
  style: FishStyle;
  path: FishPath;
  level: number;
  className?: string;
}

/** Un dessin du poisson, injecté tel quel (fichier livré avec l'application) ; une boîte vide le temps de sa lecture. */
export function FishDrawing({ style, path, level, className }: DrawingProps) {
  // Les identifiants du dessin sont suffixés par copie : deux copies dans la page ne se volent pas leurs découpes.
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const key = fishDrawingKey(style, path, level);
  const [drawn, setDrawn] = useState<{ key: string; markup: string } | null>(null);
  useEffect(() => {
    let alive = true;
    loadFishDrawing(style, path, level).then(
      (svg) => { if (alive) setDrawn({ key, markup: fishMarkup(svg, suffix) }); },
      () => { if (alive) setDrawn(null); }
    );
    return () => { alive = false; };
  }, [style, path, level, key, suffix]);
  return (
    <span className={className ? `fish-drawing ${className}` : 'fish-drawing'} data-drawing={drawn?.key}
      dangerouslySetInnerHTML={drawn ? { __html: drawn.markup } : undefined} />
  );
}

interface Props {
  level: number;
  style: FishStyle;
  path: FishPath;
  /** Couleur du verre au pinceau (style B) : celle des cadres du Profil. */
  brushColor: string;
  /** Toucher le bocal : la fenêtre de choix du poisson. */
  onOpen?: () => void;
}

export default function ProfileFish({ level, style, path, brushColor, onOpen }: Props) {
  const i = levelIndex(level);
  const boxStyle = { '--fish-f': SIZE_FACTORS[i], '--brush': brushColor } as CSSProperties;
  return (
    <button type="button" className="profile-fish" data-level={i + 1} style={boxStyle}
      aria-label={`Poisson, niveau ${i + 1} sur ${FISH_LEVELS}`} onClick={onOpen}>
      <FishDrawing style={style} path={path} level={i + 1} />
    </button>
  );
}
