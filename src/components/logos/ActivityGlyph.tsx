import type { Activity } from '../../core/activities';
import { activityLogo } from '../../core/activityLogos';
import { useThemedShade } from '../../hooks/useTheme';
import { LogoGlyph } from './ActivityLogo';

interface ActivityGlyphProps {
  activity: Activity;
  /** Côté du dessin, en pixels, sous les 40 du cadre. */
  size?: number;
  /**
   * Avec la pastille cernée à la couleur de l'activité, après le dessin : là où la petite icône portait cette couleur
   * (lignes d'activité de Réglages, liste de choix d'une activité, lignes de la bibliothèque).
   */
  swatch?: boolean;
  className?: string;
}

/**
 * Dessin seul du logo d'une activité, pour les places trop petites pour le cadre : à la couleur du texte qui l'entoure,
 * l'encre (et le texte inversé d'un onglet allumé). Décoratif : le nom de l'activité l'accompagne toujours.
 */
function ActivityGlyph({ activity, size = 16, swatch = false, className }: ActivityGlyphProps) {
  const shade = useThemedShade();
  const glyph = <LogoGlyph logo={activityLogo(activity)} size={size} className={swatch ? undefined : className} />;
  if (!swatch) return glyph;
  return (
    <span className={className ? `activity-glyph ${className}` : 'activity-glyph'}>
      {glyph}
      <span className="ui-swatch activity-glyph__swatch" style={{ background: shade(activity.color) }} />
    </span>
  );
}

export default ActivityGlyph;
