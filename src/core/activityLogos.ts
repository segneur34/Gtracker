import type { Activity } from './activities';
import { t } from './i18n';
import { familySports, type SportFamily } from './sportProfiles';
import type { SportType } from './types';

/**
 * Logos d'activité : onze dessins, un par activité de départ, posés à partir de 40 px dans un cadre au pinceau à la
 * couleur de l'activité, tourné d'un logo à l'autre ; en dessous, le dessin seul. Les tracés sont dans
 * `components/logos/logoPaths.ts`, chargés à part (`LogoSprite`) ; ce module n'en dépend pas.
 *
 * Le logo d'une activité est choisi dans Réglages parmi les onze, sinon deviné de son nom, de l'identifiant d'une
 * activité de départ, puis de son calcul (`activityLogo`). Un choix inconnu est ignoré à la lecture (`storedLogo`) :
 * le logo redevient deviné.
 */

export const LOGO_IDS = [
  'wingfoil', 'parawing', 'windsurf', 'windfoil', 'kite', 'kitefoil', 'bateau',
  'surf', 'paddle', 'surf-foil', 'pumping',
] as const;

export type LogoId = (typeof LOGO_IDS)[number];

/** Nom de chaque logo, montré seulement (choix du logo, photo du Profil) ; aucune logique ne le lit. */
export const LOGO_LABEL: Readonly<Record<LogoId, string>> = {
  wingfoil: t('Wingfoil'),
  parawing: t('Parawing'),
  windsurf: t('Windsurf'),
  windfoil: t('Windfoil'),
  kite: t('Kite'),
  kitefoil: t('Kitefoil'),
  bateau: t('Bateau'),
  surf: t('Surf'),
  paddle: t('Paddle'),
  'surf-foil': t('Surf foil'),
  pumping: t('Pumping'),
};

export const isLogoId = (value: unknown): value is LogoId =>
  typeof value === 'string' && (LOGO_IDS as readonly string[]).includes(value);

/** Côté, en pixels, à partir duquel le logo se montre dans son cadre ; en dessous, le dessin seul. */
export const LOGO_FRAME_MIN_PX = 40;

/** Part du côté du cadre occupée par le dessin, centré. */
export const LOGO_GLYPH_SCALE = 0.6;

/** Les neuf icônes d'activité d'avant les logos, telles qu'un choix enregistré peut encore les porter. */
export const LEGACY_ICON_IDS = [
  'bateau', 'planche', 'wingfoil', 'kite', 'surf', 'surf-foil', 'kayak', 'paddle', 'paddle-foil',
] as const;

export type LegacyIconId = (typeof LEGACY_ICON_IDS)[number];

/**
 * Ancienne icône d'activité → logo qui lui correspond : six gardent leur nom, la planche devient le windsurf, le kayak
 * le paddle, le paddle foil le surf foil. Sert à relire un choix déjà enregistré sans le remettre à zéro.
 */
const LEGACY_ICON_LOGO: Readonly<Record<LegacyIconId, LogoId>> = {
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

export const legacyIconToLogo = (icon: LegacyIconId): LogoId => LEGACY_ICON_LOGO[icon];

/**
 * Logo d'un choix enregistré : un logo tel quel, une ancienne icône par sa correspondance, sinon `undefined` (le logo
 * redevient deviné).
 */
export const storedLogo = (value: unknown): LogoId | undefined => {
  if (isLogoId(value)) return value;
  if (typeof value === 'string' && Object.hasOwn(LEGACY_ICON_LOGO, value)) return LEGACY_ICON_LOGO[value as LegacyIconId];
  return undefined;
};

/** Écart d'angle, en degrés, entre les cadres de deux logos voisins dans `LOGO_IDS`. */
const ROTATION_STEP_DEG = 47;

/**
 * Rotation du cadre d'un logo, en degrés entiers de 0 à 359 : son rang dans `LOGO_IDS` fois 47, modulo 360, comme sur
 * la planche validée. Deux logos voisins ont des cadres bien distincts, et l'angle ne dépend pas du rang d'une
 * activité dans une liste.
 */
export const logoRotation = (logo: LogoId): number => (LOGO_IDS.indexOf(logo) * ROTATION_STEP_DEG) % 360;

/** Logo de chaque calcul, quand le nom ne dit rien. */
const BASE_LOGO: Readonly<Record<SportType, LogoId>> = {
  wingfoil: 'wingfoil',
  windsurf: 'windsurf',
  kite: 'kite',
  bateau: 'bateau',
  surf: 'surf',
};

/** Activités de départ qui partagent leur calcul avec une autre (`DEFAULT_ACTIVITIES`) : leur logo, même renommées. */
const ID_LOGO: Readonly<Record<string, LogoId>> = {
  'a-parawing': 'parawing',
  'a-windfoil': 'windfoil',
  'a-kitefoil': 'kitefoil',
  'a-paddle': 'paddle',
  'a-surf-foil': 'surf-foil',
  'a-pumping': 'pumping',
};

const PADDLE_WORD = String.raw`\b(paddle|sup\b|stand ?up)`;

/** Mots du nom, du plus précis au plus large : « kitefoil » avant « kite », « paddle foil » avant « paddle », avant « foil ». */
const NAME_LOGO: { pattern: RegExp; logo: LogoId; bases?: readonly SportType[] }[] = [
  { pattern: /\bpara ?wing/, logo: 'parawing' },
  { pattern: /\bkite ?foil/, logo: 'kitefoil' },
  { pattern: /\bwind ?foil/, logo: 'windfoil' },
  { pattern: /\bpump/, logo: 'pumping' },
  { pattern: new RegExp(`${PADDLE_WORD}.*\\bfoil|\\bfoil.*${PADDLE_WORD}`), logo: 'surf-foil' },
  { pattern: new RegExp(PADDLE_WORD), logo: 'paddle' },
  { pattern: /\b(kayak|cano|pirogue|pagaie)/, logo: 'paddle' },
  { pattern: /\bkite/, logo: 'kite' },
  { pattern: /\bwing/, logo: 'wingfoil' },
  { pattern: /\b(planche|windsurf)/, logo: 'windsurf' },
  { pattern: /\b(bateau|voilier|dériveur|deriveur|catamaran|moth|laser|optimist|régate|regate)/, logo: 'bateau' },
  { pattern: /\bfoil/, logo: 'surf-foil', bases: ['surf'] },
];

/** Logo deviné de l'identifiant d'une activité de départ, sinon du nom, sinon du calcul. */
export const guessActivityLogo = (name: string, base: SportType, id = ''): LogoId => {
  if (Object.hasOwn(ID_LOGO, id)) return ID_LOGO[id];
  const lower = name.toLowerCase();
  const match = NAME_LOGO.find((rule) => (!rule.bases || rule.bases.includes(base)) && rule.pattern.test(lower));
  return match?.logo ?? BASE_LOGO[base];
};

/** Logo d'une activité : celui choisi, sinon le deviné. */
export const activityLogo = (activity: Activity): LogoId =>
  activity.icon ?? guessActivityLogo(activity.name, activity.base, activity.id);

/** Mots du nom qui disent le calcul d'une activité de voile, du plus précis au plus large. */
const NAME_BASE: { pattern: RegExp; base: SportType }[] = [
  { pattern: /\bkite/, base: 'kite' },
  { pattern: /\bwing/, base: 'wingfoil' },
  { pattern: /\b(planche|windsurf|windfoil)/, base: 'windsurf' },
  { pattern: /\b(bateau|voilier|dériveur|deriveur|catamaran)/, base: 'bateau' },
];

/**
 * Calcul deviné du nom d'une activité qu'on ajoute (« Bateau » → bateau, « Kite » → kite, « Planche » →
 * windsurf, « Wing » → wingfoil), pour que le formulaire ne parte pas sur le premier calcul de la famille en
 * silence ; le sélecteur reste modifiable. Le calcul rendu est toujours de `family` (un nom de voile en surf
 * rend le premier calcul du surf) ; un nom qui ne dit rien rend le premier calcul de la famille.
 */
export const guessActivityBase = (name: string, family: SportFamily): SportType => {
  const allowed = familySports(family);
  const lower = name.toLowerCase();
  const match = NAME_BASE.find((rule) => allowed.includes(rule.base) && rule.pattern.test(lower));
  return match?.base ?? allowed[0];
};
