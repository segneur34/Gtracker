import { isLostOnBackground } from '../../core/activities';
import { LOGO_FRAME_MIN_PX, LOGO_GLYPH_SCALE, logoRotation, type LogoId } from '../../core/activityLogos';
import { useAppliedTheme } from '../../hooks/useTheme';
import { LOGO_BOX, LOGO_FRAME_SYMBOL, LOGO_VIEWBOX, logoSymbolId } from './logoSymbols';
import './ActivityLogo.css';

/** Nom accessible quand il est donné (le nom de l'activité n'est pas écrit à côté), sinon pièce décorative. */
const a11y = (label?: string) => (label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true });

const GLYPH_SIDE = LOGO_BOX * LOGO_GLYPH_SCALE;
const GLYPH_OFFSET = (LOGO_BOX - GLYPH_SIDE) / 2;

interface LogoGlyphProps {
  logo: LogoId;
  /** Côté, en pixels. */
  size: number;
  label?: string;
  className?: string;
}

/** Dessin seul d'une activité, à la couleur du texte qui l'entoure (`currentColor`). */
export function LogoGlyph({ logo, size, label, className }: LogoGlyphProps) {
  return (
    <svg className={className ? `logo-glyph ${className}` : 'logo-glyph'} width={size} height={size} viewBox={LOGO_VIEWBOX} focusable="false" {...a11y(label)}>
      <use href={`#${logoSymbolId(logo)}`} />
    </svg>
  );
}

interface ActivityLogoProps {
  logo: LogoId;
  /** Couleur du cadre, déjà celle du thème (la couleur de l'activité telle qu'affichée). */
  color: string;
  /** Côté, en pixels : le cadre à partir de `LOGO_FRAME_MIN_PX`, le dessin seul en dessous. */
  size: number;
  label?: string;
  className?: string;
}

/**
 * Logo d'une activité : son dessin à l'encre, posé à 60 % au centre du cadre au pinceau, à la couleur de l'activité et
 * tourné selon le logo (`logoRotation`) ; en dessous de 40 px, le dessin seul à l'encre. Un cadre qui se confond avec
 * le fond (le blanc le jour, le noir la nuit) est cerné d'un trait gris d'un pixel, celui des pastilles. Les symboles
 * viennent de `LogoSprite`.
 */
function ActivityLogo({ logo, color, size, label, className }: ActivityLogoProps) {
  const dark = useAppliedTheme().theme === 'dark';
  if (size < LOGO_FRAME_MIN_PX) {
    return <LogoGlyph logo={logo} size={size} label={label} className={className ? `activity-logo__glyph ${className}` : 'activity-logo__glyph'} />;
  }
  const rotation = logoRotation(logo);
  // Le trait suit le bord du pinceau ; son épaisseur, en unités du dessin, vaut un pixel à l'écran.
  const ring = isLostOnBackground(color, dark) ? { className: 'activity-logo__frame--ringed', strokeWidth: LOGO_BOX / size } : {};
  return (
    <svg className={className ? `activity-logo ${className}` : 'activity-logo'} width={size} height={size} viewBox={LOGO_VIEWBOX} focusable="false" {...a11y(label)}>
      <use href={`#${LOGO_FRAME_SYMBOL}`} color={color} transform={`rotate(${rotation} ${LOGO_BOX / 2} ${LOGO_BOX / 2})`} {...ring} />
      <use className="activity-logo__glyph" href={`#${logoSymbolId(logo)}`} x={GLYPH_OFFSET} y={GLYPH_OFFSET} width={GLYPH_SIDE} height={GLYPH_SIDE} />
    </svg>
  );
}

export default ActivityLogo;
