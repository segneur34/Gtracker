import type { Activity } from './activities';
import type { SportType } from './types';

/**
 * Icône d'une activité : choisie dans Réglages parmi cette liste, sinon
 * devinée de son nom puis de son calcul. Plus d'icônes que de calculs : kayak
 * ou paddle vont aux activités que l'utilisateur crée sur un calcul voisin
 * (surf). Une icône de l'application complète (course, vélo, fractionné) est
 * ignorée à la lecture (`isActivityIconId`) : l'icône redevient devinée.
 */

export const ACTIVITY_ICON_IDS = [
  'bateau', 'planche', 'wingfoil', 'kite',
  'surf', 'surf-foil', 'kayak', 'paddle', 'paddle-foil',
] as const;

export type ActivityIconId = (typeof ACTIVITY_ICON_IDS)[number];

export const ACTIVITY_ICON_LABEL: Record<ActivityIconId, string> = {
  bateau: 'Bateau à voile',
  planche: 'Planche à voile',
  wingfoil: 'Wingfoil',
  kite: 'Kitesurf',
  surf: 'Surf',
  'surf-foil': 'Surf foil',
  kayak: 'Kayak',
  paddle: 'Paddle',
  'paddle-foil': 'Paddle foil',
};

export const isActivityIconId = (value: unknown): value is ActivityIconId =>
  typeof value === 'string' && (ACTIVITY_ICON_IDS as readonly string[]).includes(value);

/** Icône de chaque calcul, quand le nom ne dit rien. */
const BASE_ICON: Record<SportType, ActivityIconId> = {
  wingfoil: 'wingfoil',
  windsurf: 'planche',
  kite: 'kite',
  bateau: 'bateau',
  surf: 'surf',
};

/** Activités de départ qui partagent leur calcul avec une autre (`DEFAULT_ACTIVITIES`). */
const ID_ICON: Record<string, ActivityIconId> = { 'a-surf-foil': 'surf-foil' };

/** Mots du nom, du plus précis au plus large : « paddle foil » avant « paddle », avant « foil ». */
const NAME_ICON: { pattern: RegExp; icon: ActivityIconId; bases?: readonly SportType[] }[] = [
  { pattern: /\b(paddle|sup\b|stand ?up).*\bfoil|\bfoil.*\b(paddle|sup\b|stand ?up)/, icon: 'paddle-foil' },
  { pattern: /\b(paddle|sup\b|stand ?up)/, icon: 'paddle' },
  { pattern: /\b(kayak|cano|pirogue|pagaie)/, icon: 'kayak' },
  { pattern: /\bkite/, icon: 'kite' },
  { pattern: /\bwing/, icon: 'wingfoil' },
  { pattern: /\b(planche|windsurf|windfoil)/, icon: 'planche' },
  { pattern: /\b(bateau|voilier|dériveur|deriveur|catamaran|moth|laser|optimist|régate|regate)/, icon: 'bateau' },
  { pattern: /\bfoil/, icon: 'surf-foil', bases: ['surf'] },
];

/** Icône devinée du nom, de l'identifiant d'une activité de départ, sinon du calcul. */
export const guessActivityIcon = (name: string, base: SportType, id = ''): ActivityIconId => {
  if (ID_ICON[id]) return ID_ICON[id];
  const lower = name.toLowerCase();
  const match = NAME_ICON.find((rule) => (!rule.bases || rule.bases.includes(base)) && rule.pattern.test(lower));
  return match?.icon ?? BASE_ICON[base];
};

/** Icône d'une activité : celle choisie, sinon la devinée. */
export const activityIcon = (activity: Activity): ActivityIconId =>
  activity.icon ?? guessActivityIcon(activity.name, activity.base, activity.id);
