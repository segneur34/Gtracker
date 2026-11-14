import { useRef, type KeyboardEvent } from 'react';
import Swatch from './Swatch';

export interface ChoiceButtonItem<K extends string> {
  key: K;
  label: string;
  /** Couleur d'activité : une pastille cernée devant le libellé. */
  color?: string;
  title?: string;
}

/**
 * Choix exclusif en gros boutons qui passent à la ligne, jamais en rangée qui
 * défile : chaque choix est une pilule à fond plein (le champ du fond ne passe
 * pas derrière), celui qui est choisi à l'encre. `columns` les range en
 * grille de colonnes égales, sinon ils se suivent. Taille normale à hauteur
 * de cible tactile (une fenêtre de choix), `small` pour un réglage posé sur
 * la page. Flèches du clavier d'un choix à l'autre.
 */
function ChoiceButtons<K extends string>({ label, items, value, onChange, columns, small, className }: {
  /** Nom du choix, lu par les lecteurs d'écran. */
  label: string;
  items: ChoiceButtonItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Grille de deux ou trois colonnes égales ; sans elle, les choix se suivent. */
  columns?: 2 | 3;
  small?: boolean;
  className?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((it) => it.key === value);
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(0, i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
      : null;
    if (next === null || items.length === 0) return;
    e.preventDefault();
    rowRef.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
    if (items[next].key !== value) onChange(items[next].key);
  };

  const classes = ['ui-choices', small ? 'ui-choices--s' : '', columns ? `ui-choices--grid ui-choices--cols-${columns}` : '', className ?? '']
    .filter(Boolean).join(' ');
  return (
    <div ref={rowRef} className={classes} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item, i) => {
        const checked = item.key === value;
        // Sans choix coché (valeur absente des choix), le premier reste atteignable à la tabulation.
        const focusable = checked || (i === 0 && !items.some((it) => it.key === value));
        return (
          <button key={item.key} type="button" role="radio" aria-checked={checked} tabIndex={focusable ? 0 : -1}
            className="ui-choice" title={item.title} onClick={() => onChange(item.key)}>
            {item.color !== undefined && <Swatch color={item.color} round bordered />}
            <span className="ui-choice__label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ChoiceButtons;
