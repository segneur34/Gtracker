import type { SportFamily } from '../core/sportProfiles';
import { IconSail, IconSurf } from './icons';

/** Icône de chaque famille de sports, partout : barre de navigation, accueil, listes groupées par famille (choix d'activité, Réglages). */
export const FAMILY_ICON: Record<SportFamily, typeof IconSail> = { voile: IconSail, surf: IconSurf };
