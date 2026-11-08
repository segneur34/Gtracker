import type { ActivityIconId } from '../core/activityIcons';
import type { SportFamily } from '../core/sportProfiles';
import {
  IconKayak, IconKite, IconPaddle, IconPaddleFoil, IconSail, IconSailboat, IconSurf, IconSurfFoil, IconSurfer, IconWindsurf, IconWingfoil,
} from './icons';

/** Icône de chaque famille de sports, partout : barre de navigation, accueil, listes groupées par famille (choix d'activité, Réglages). */
export const FAMILY_ICON: Record<SportFamily, typeof IconSail> = { voile: IconSail, surf: IconSurf };

/** Petite icône de chaque activité (`activityIcon`) : listes, onglets, Réglages, accueil. */
export const ACTIVITY_ICON: Record<ActivityIconId, typeof IconSail> = {
  bateau: IconSailboat,
  planche: IconWindsurf,
  wingfoil: IconWingfoil,
  kite: IconKite,
  surf: IconSurfer,
  'surf-foil': IconSurfFoil,
  kayak: IconKayak,
  paddle: IconPaddle,
  'paddle-foil': IconPaddleFoil,
};
