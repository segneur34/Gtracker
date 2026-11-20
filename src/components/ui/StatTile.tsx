import type { ReactNode } from 'react';
import { IconChevronRight } from '../icons';

interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Précision grisée à la suite de la valeur (« 12:03 » après un record). */
  detail?: ReactNode;
  title?: string;
  /** Tuile qui se touche (onglet de « général ») : la racine devient un bouton, un chevron au bout du libellé. */
  onClick?: () => void;
  /** Nom du bouton lu par l'accessibilité, avec `onClick` : chiffre et ce que fait le toucher. */
  ariaLabel?: string;
  /** Avec `onClick` : l'onglet de la tuile est ouvert (`aria-expanded`), le toucher le refermera. */
  expanded?: boolean;
}

/**
 * Tuile de chiffre d'une analyse : libellé grisé, valeur, détail. Posée dans une grille `an-sheet__stats`.
 * Avec `onClick`, un bouton à la même place que le bloc (grille et paires gardées).
 */
function StatTile({ label, value, detail, title, onClick, ariaLabel, expanded }: StatTileProps) {
  const body = (
    <>
      <span className="an-sheet__stat-label">
        {label}
        {/* Point d'accroche sans largeur au bout du libellé : le chevron, posé dessus en absolu, ne passe jamais seul
            à la ligne et n'en ajoute jamais une. */}
        {onClick && <span className="an-sheet__stat-chevron"><IconChevronRight size={10} /></span>}
      </span>
      <strong className="an-sheet__stat-value">
        {value}
        {detail && <span className="ui-muted ui-weight-normal ui-text-xs"> {detail}</span>}
      </strong>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="an-sheet__stat an-sheet__stat--link" title={title} aria-label={ariaLabel}
        aria-expanded={expanded ?? false} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <div className="an-sheet__stat" title={title}>
      {body}
    </div>
  );
}

export default StatTile;
