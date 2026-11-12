import type { ActivityIconId } from './activityIcons';

/**
 * Logos d'activité : onze dessins, un par activité de départ, posés à partir de 40 px dans un cadre au pinceau à la
 * couleur de l'activité, tourné d'une activité à l'autre ; en dessous, le dessin seul. Les tracés sont dans
 * `components/logos/logoPaths.ts`, chargés à part (`LogoSprite`) ; ce module n'en dépend pas.
 */

export const LOGO_IDS = [
  'wingfoil', 'parawing', 'windsurf', 'windfoil', 'kite', 'kitefoil', 'bateau',
  'surf', 'paddle', 'surf-foil', 'pumping',
] as const;

export type LogoId = (typeof LOGO_IDS)[number];

export const LOGO_LABEL: Readonly<Record<LogoId, string>> = {
  wingfoil: 'Wingfoil',
  parawing: 'Parawing',
  windsurf: 'Windsurf',
  windfoil: 'Windfoil',
  kite: 'Kite',
  kitefoil: 'Kitefoil',
  bateau: 'Bateau',
  surf: 'Surf',
  paddle: 'Paddle',
  'surf-foil': 'Surf foil',
  pumping: 'Pumping',
};

export const isLogoId = (value: unknown): value is LogoId =>
  typeof value === 'string' && (LOGO_IDS as readonly string[]).includes(value);

/** Côté, en pixels, à partir duquel le logo se montre dans son cadre ; en dessous, le dessin seul. */
export const LOGO_FRAME_MIN_PX = 40;

/** Part du côté du cadre occupée par le dessin, centré. */
export const LOGO_GLYPH_SCALE = 0.6;

/**
 * Ancienne icône d'activité (neuf, avant les logos) → logo qui lui correspond : six gardent leur nom, la planche
 * devient le windsurf, le kayak le paddle, le paddle foil le surf foil. Sert à relire un choix déjà enregistré sans le
 * remettre à zéro.
 */
const LEGACY_ICON_LOGO: Readonly<Record<ActivityIconId, LogoId>> = {
  bateau: 'bateau',
  planche: 'windsurf',
  wingfoil: 'wingfoil',
  kite: 'kite',
  surf: 'surf',
  'surf-foil': 'surf-foil',
  kayak: 'paddle',
  paddle: 'paddle',
  'paddle-foil': 'surf-foil',
};

export const legacyIconToLogo = (icon: ActivityIconId): LogoId => LEGACY_ICON_LOGO[icon];

/**
 * Logo d'un choix enregistré : un logo tel quel, une ancienne icône par sa correspondance, sinon `undefined` (le logo
 * redevient deviné).
 */
export const storedLogo = (value: unknown): LogoId | undefined => {
  if (isLogoId(value)) return value;
  if (typeof value === 'string' && Object.hasOwn(LEGACY_ICON_LOGO, value)) return LEGACY_ICON_LOGO[value as ActivityIconId];
  return undefined;
};

/**
 * Rotation du cadre d'une activité, en degrés entiers de 0 à 359, tirée d'un hachage de son identifiant (FNV-1a sur
 * 32 bits) : la même à chaque affichage, quel que soit le rang de l'activité dans une liste.
 */
export const logoRotation = (id: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 360;
};
