import type { HTMLAttributes, ReactNode } from 'react';
import { IconChevronRight } from '../icons';

/**
 * Titre qui replie ou montre une partie de la page, avec son chevron : la pièce
 * commune de `PanelTitle`, `ChartFold` et du pli du détail du Profil. Elle porte
 * `aria-expanded`, le clic et, au clavier, Entrée et Espace ; le chevron tourne par
 * les classes `ui-chevron` de `ui.css`, jamais par un style en ligne.
 *
 * Un vrai `<button>` par défaut. `nested` le remplace par un `<strong role="button">`
 * focalisable, pour un titre qui contient lui-même un bouton (le « ? » d'aide) : un
 * bouton dans un bouton n'est pas permis. Le reste des attributs (`className`, `title`,
 * `style`, `data-*`) passe tel quel à l'élément.
 */
function FoldTitle({
  open, onToggle, children, nested = false, disabled, chevronSide = 'start', openDirection = 'down',
  chevronSize = 14, chevronClassName, ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'onClick'> & {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Titre à contenu interactif : `<strong role="button">` au lieu de `<button>`. */
  nested?: boolean;
  /** Bouton grisé, non cliquable, qui ne déplie rien (sans effet avec `nested`). */
  disabled?: boolean;
  /** Chevron avant le contenu (panneau) ou après (graphe, pli du Profil). */
  chevronSide?: 'start' | 'end';
  /** Sens du chevron une fois ouvert : vers le bas (il pointe à droite replié) ou vers le haut (il pointe vers le bas replié). */
  openDirection?: 'down' | 'up';
  chevronSize?: number;
  /** Classes de plus sur le chevron (couleur, place dans la ligne). */
  chevronClassName?: string;
}) {
  const chevron = (
    <IconChevronRight
      size={chevronSize}
      className={`ui-chevron ui-chevron--${openDirection}${open ? ' ui-chevron--open' : ''}${chevronClassName ? ` ${chevronClassName}` : ''}`} />
  );
  const content = chevronSide === 'start' ? <>{chevron}{children}</> : <>{children}{chevron}</>;
  if (nested) {
    return (
      <strong
        {...rest}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
        {content}
      </strong>
    );
  }
  return (
    <button {...rest} type="button" aria-expanded={open} onClick={disabled ? undefined : onToggle}
      disabled={disabled} aria-disabled={disabled || undefined}>
      {content}
    </button>
  );
}

export default FoldTitle;
