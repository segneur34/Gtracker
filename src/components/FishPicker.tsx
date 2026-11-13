import type { CSSProperties } from 'react';
import Dialog from './ui/Dialog';
import { FishDrawing } from './ProfileFish';
import { FISH_LEVELS, FISH_PATHS, FISH_STYLES, type FishPath, type FishStyle } from '../library/fishGrowth';
import './FishPicker.css';

/**
 * Fenêtre de choix du poisson du Profil, ouverte en touchant le bocal : les douze poissons que l'on peut choisir
 * (quatre styles de dessin, trois voies), montrés au niveau atteint ; le choix s'applique tout de suite et se garde
 * dans le profil du pratiquant. Dessous, les niveaux débloqués du poisson choisi, à regarder seulement ; les niveaux
 * à venir sont comptés, jamais dessinés. Chaque dessin se lit à son tour, dans une case de taille fixe : la fenêtre
 * s'ouvre avant eux.
 */

interface Props {
  /** Niveau montré, de 1 à `FISH_LEVELS`. */
  level: number;
  /** Niveaux débloqués, de 1 à `unlocked`. */
  unlocked: number;
  style: FishStyle;
  path: FishPath;
  /** Couleur du verre au pinceau (style B) : la fenêtre est hors de la page, elle ne l'hérite pas. */
  brushColor: string;
  onChoose: (choice: { style: FishStyle; path: FishPath }) => void;
  onClose: () => void;
}

const nameOf = <T extends string>(list: readonly { id: T; name: string }[], id: T): string =>
  list.find((x) => x.id === id)?.name ?? id;

export default function FishPicker({ level, unlocked, style, path, brushColor, onChoose, onClose }: Props) {
  const shown = Math.min(FISH_LEVELS, Math.max(1, Math.round(level)));
  const open = Math.min(FISH_LEVELS, Math.max(1, Math.round(unlocked)));
  const toCome = FISH_LEVELS - open;
  const chosen = `${nameOf(FISH_STYLES, style)}, ${nameOf(FISH_PATHS, path).toLowerCase()}`;
  const bodyStyle = { '--brush': brushColor } as CSSProperties;
  return (
    <Dialog title="Poisson" onClose={onClose} className="fish-picker">
      <div className="fish-picker__body" style={bodyStyle}>
        <p className="fish-picker__lead">
          Niveau {shown} sur {FISH_LEVELS}
          {shown === 1 && ' : les trois voies partent du même alevin, elles se séparent au niveau 2.'}
        </p>
        <div className="fish-picker__grid">
          {FISH_STYLES.map((s) => (
            <div key={s.id} className="fish-picker__style" role="group" aria-label={s.name}>
              <span className="fish-picker__style-name">{s.name}</span>
              <div className="fish-picker__row">
                {FISH_PATHS.map((p) => {
                  const pressed = s.id === style && p.id === path;
                  return (
                    <button key={p.id} type="button" className="fish-picker__choice" aria-pressed={pressed}
                      aria-label={`${s.name}, ${p.name.toLowerCase()}`} data-fish={`${s.id}/${p.id}`}
                      onClick={() => onChoose({ style: s.id, path: p.id })}>
                      <FishDrawing style={s.id} path={p.id} level={shown} className="fish-picker__drawing" />
                      <span className="fish-picker__path" aria-hidden="true">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <section className="fish-picker__levels" aria-label={`Niveaux débloqués : ${chosen}`}>
          <span className="fish-picker__style-name">Niveaux débloqués : {chosen}</span>
          <ol className="fish-picker__frieze">
            {Array.from({ length: open }, (_, i) => (
              <li key={i} className="fish-picker__step" aria-label={`Niveau ${i + 1}`}>
                <FishDrawing style={style} path={path} level={i + 1} className="fish-picker__step-drawing" />
                <span className="fish-picker__step-number" aria-hidden="true">{i + 1}</span>
              </li>
            ))}
          </ol>
          {toCome > 0 && (
            <p className="fish-picker__to-come">{toCome === 1 ? '1 niveau à découvrir' : `${toCome} niveaux à découvrir`}</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
