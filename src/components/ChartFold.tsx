import type { CSSProperties, ReactNode } from 'react';
import { t } from '../core/i18n';
import { HoverReadout, type Readout } from './ChartReadout';
import FoldTitle from './ui/FoldTitle';

/**
 * Bouton qui replie ou montre une partie d'un panneau à sa place : un graphe
 * parmi d'autres (onglet « graphiques »), le tableau des
 * zones de l'énergie, les pastilles des statistiques. Chevron vers le haut quand la partie est montrée, vers
 * le bas quand elle est repliée. `color` teinte le nom, celle de la série du
 * graphe ; `aria-expanded` dit l'état (banc compris). Plus petit dans les
 * analyses (`--chart-name-size`, `analysisMobile.css`).
 */
function ChartFold({ label, open, onToggle, color, title, style, className, disabled }: {
  label: ReactNode;
  open: boolean;
  onToggle: () => void;
  color?: string;
  title?: string;
  style?: CSSProperties;
  className?: string;
  /** Bouton grisé, non cliquable, qui ne déplie rien. */
  disabled?: boolean;
}) {
  return (
    <FoldTitle open={open} onToggle={onToggle} disabled={disabled} chevronSide="end" openDirection="up" chevronClassName="ui-chevron--ink"
      data-chart-fold="" className={className} title={title ?? (open ? t('Replier') : t('Montrer'))}
      style={{
        alignSelf: 'flex-start', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px 3px 10px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : undefined, border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 'var(--chart-name-size, var(--text-xs))',
        backgroundColor: 'var(--surface-sunken)', color: color ?? 'var(--ink)', fontWeight: color ? 600 : undefined,
        letterSpacing: 'var(--title-spacing)', textTransform: 'var(--title-case)' as CSSProperties['textTransform'],
        ...style,
      }}>
      {label}
    </FoldTitle>
  );
}

/**
 * Tête d'un graphe des analyses : son nom repliable (`ChartFold`) et, à
 * droite, la lecture au point survolé tant que le graphe est montré. Chaque
 * infobulle (`title`) est donnée par l'appelant, avec ses mots.
 */
export function GraphFoldHead({ label, color, open, onToggle, read, title, foldStyle, style, className }: {
  label: ReactNode;
  color?: string;
  open: boolean;
  onToggle: () => void;
  /** Lecture d'un indice de trace, sans nom ni couleur ; aucune lecture s'il manque. */
  read?: (index: number) => Readout | null;
  title?: string;
  /** Style du bouton du nom. */
  foldStyle?: CSSProperties;
  /** Classes de la rangée, en plus de `chart-head`. */
  className?: string;
  /** Style de la rangée. */
  style?: CSSProperties;
}) {
  return (
    <div className={className ? `chart-head ${className}` : 'chart-head'} style={style}>
      <ChartFold label={label} color={color} open={open} onToggle={onToggle} title={title} style={foldStyle} />
      {read !== undefined && open && <HoverReadout read={read} />}
    </div>
  );
}

export default ChartFold;
