import type { LogoId } from '../../core/activityLogos';

/** Identifiants des symboles posés par la feuille `LogoSprite`, repris par les `<use>` des logos. */
export const LOGO_FRAME_SYMBOL = 'gt-logo-frame';
export const logoSymbolId = (logo: LogoId): string => `gt-logo-${logo}`;

/** Repère des tracés : un carré de 1000 de côté. */
export const LOGO_VIEWBOX = '0 0 1000 1000';
export const LOGO_BOX = 1000;
