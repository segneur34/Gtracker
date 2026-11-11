import { isObject } from './basics';
import {
  SPORT_FAMILIES, SPORT_PROFILES, isSportType, sportFamily, sportTreatment, type SportFamily, type Treatment,
} from './sportProfiles';
import type { SportType } from './types';
import { isActivityIconId, type ActivityIconId } from './activityIcons';

/**
 * Activités : ce que l'utilisateur pratique, sous le nom qu'il choisit
 * (« Moth à foil », « SUP foil »). Chacune s'appuie sur un des
 * calculs de `SPORT_PROFILES`, sa base, qui fixe ses valeurs par défaut, sa
 * famille et le module qui l'analyse. Les calculs ne connaissent que la base.
 *
 * Les réglages de l'appareil (unité, seuil, couleurs de trace, pause
 * automatique) sont rangés sous l'identifiant de l'activité. Une activité de
 * base, construite à la volée pour un calcul sans activité, porte
 * l'identifiant du calcul lui-même : c'est sous lui que les réglages étaient
 * rangés avant les activités (§10, point 53), ils restent donc valables.
 */

export interface Activity {
  /** Identifiant stable, clé des réglages et des fiches ; jamais affiché. */
  id: string;
  name: string;
  /** Calcul sur lequel l'activité s'appuie. */
  base: SportType;
  /** Couleur de l'activité dans le graphe de l'accueil (donnée de graphe, en dur). */
  color: string;
  /**
   * Cachée dans Réglages : ni proposée, ni listée, ses sessions comprises ;
   * rien n'est effacé, la ré-afficher rend tout (§10, point 100).
   */
  hidden?: true;
  /** Icône choisie dans Réglages ; absente, elle est devinée du nom et du calcul (`activityIcon`). */
  icon?: ActivityIconId;
}

/**
 * Nuances de chaque famille (§10, point 90) : la première est la couleur de la
 * famille (`--voile`, `--surf` de `theme/tokens.css`, qui porte du texte
 * blanc, contraste d'au moins 4,5 sur blanc) ; les suivantes, d'un contraste
 * d'au moins 3, vont aux activités dans cet ordre (`nextActivityColor`).
 * Toutes distinctes, d'une famille à l'autre comprises (`palette.test.ts`).
 * Une famille ne se montre jamais par sa seule couleur.
 */
export const FAMILY_SHADES: Record<SportFamily, readonly string[]> = {
  voile: ['#004aad', '#014e86', '#5b87f2', '#4458c2', '#192f94', '#0c92ce'],
  // Gris un peu teintés, bleutés ou chauds : des gris purs ne se sépareraient que par leur clarté (point 97).
  surf: ['#5b6670', '#8292a6', '#847c6e', '#223246', '#2e2610', '#0a1a2e'],
};

/**
 * Les mêmes nuances, au même rang, en thème sombre (lot 12, décision du
 * 28/10) : la première est la couleur de famille sombre de `theme/tokens.css`,
 * éclaircie d'un cran, texte blanc gardé (contraste d'au moins 4,5) ; une
 * nuance lisible sur le fond sombre (contraste d'au moins 3 sur `--surface`)
 * reste celle du clair, les autres sont éclaircies, teinte gardée, et restent
 * distinctes (`palette.test.ts`). La fiche d'une activité garde sa couleur
 * claire : seul l'affichage passe par `shadeForTheme`.
 */
export const FAMILY_SHADES_DARK: Record<SportFamily, readonly string[]> = {
  voile: ['#2f6fd6', '#3c7cb7', '#5b87f2', '#7c98ff', '#86afff', '#0c92ce'],
  surf: ['#627386', '#8292a6', '#847c6e', '#92a5be', '#746b52', '#a4b9d4'],
};

/** Nuance sombre de chaque nuance claire. */
const DARK_SHADE = new Map(
  SPORT_FAMILIES.flatMap((family) => FAMILY_SHADES[family].map((shade, i) => [shade, FAMILY_SHADES_DARK[family][i]] as const))
);

/** Couleur d'une activité à l'écran : en sombre, la nuance sombre de même rang ; une couleur hors palette reste telle quelle. */
export const shadeForTheme = (color: string, dark: boolean): string =>
  dark ? DARK_SHADE.get(color.toLowerCase()) ?? color : color;

/** Couleur de chaque calcul, pour ses activités de base : une nuance de sa famille. */
export const BASE_COLOR: Record<SportType, string> = {
  wingfoil: FAMILY_SHADES.voile[0],
  windsurf: FAMILY_SHADES.voile[5],
  kite: FAMILY_SHADES.voile[3],
  bateau: FAMILY_SHADES.voile[1],
  surf: FAMILY_SHADES.surf[0],
};

/** Activités de la famille Surf (§10, point 97) ; le foil de « Surf foil » est coché d'office (`useSportSettings.ts`). */
export const SURF_ACTIVITY: Activity = { id: 'surf', name: 'Surf', base: 'surf', color: BASE_COLOR.surf };
export const SURF_FOIL_ACTIVITY: Activity = { id: 'a-surf-foil', name: 'Surf foil', base: 'surf', color: FAMILY_SHADES.surf[1] };

/**
 * Au premier lancement : Voile, sur l'identifiant de son calcul (celui des
 * anciens réglages), et les deux du surf.
 */
export const DEFAULT_ACTIVITIES: Activity[] = [
  { id: 'wingfoil', name: 'Voile', base: 'wingfoil', color: BASE_COLOR.wingfoil },
  SURF_ACTIVITY,
  SURF_FOIL_ACTIVITY,
];

/** Calcul par défaut d'une famille, pour un module sans activité. */
export const FAMILY_BASE: Record<SportFamily, SportType> = { voile: 'wingfoil', surf: 'surf' };

/** Nom d'une famille, tel que l'interface l'affiche. */
export const FAMILY_LABEL: Record<SportFamily, string> = { voile: 'Voile', surf: 'Surf' };

/** Tournure d'une famille dans « Aucune activité … », « Aucune session … » : « de voile », « de surf ». */
export const FAMILY_OF: Record<SportFamily, string> = { voile: 'de voile', surf: 'de surf' };

/** Couleur d'interface d'une famille (variable du thème). */
export const FAMILY_ACCENT: Record<SportFamily, string> = { voile: 'var(--voile)', surf: 'var(--surf)' };

const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

/**
 * Liste des activités telle que les réglages la gardent. Absente : celles du
 * premier lancement. Une entrée abîmée est écartée, un doublon d'identifiant
 * aussi, comme une activité posée sur un calcul inconnu (« ski ») ; une liste
 * vide reste vide (l'utilisateur a tout supprimé).
 */
export const readActivities = (raw: unknown): Activity[] => {
  // Une copie : l'appelant peut trier ou compléter la liste sans toucher la constante.
  if (!Array.isArray(raw)) return DEFAULT_ACTIVITIES.map((a) => ({ ...a }));
  const seen = new Set<string>();
  const list: Activity[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const { id, name, base, color, hidden, icon } = item;
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    if (typeof name !== 'string' || name.trim() === '' || !isSportType(base)) continue;
    seen.add(id);
    list.push({
      id, name: name.trim(), base, color: isColor(color) ? color : BASE_COLOR[base],
      ...(hidden === true ? { hidden } : {}),
      ...(isActivityIconId(icon) ? { icon } : {}),
    });
  }
  return list;
};

/** Activité de base d'un calcul : son libellé, sa couleur, son identifiant. */
export const baseActivity = (sport: SportType): Activity => ({
  id: sport,
  name: SPORT_PROFILES[sport].label,
  base: sport,
  color: BASE_COLOR[sport],
});

export const activityFamily = (activity: Activity): SportFamily => sportFamily(activity.base);

export const activityTreatment = (activity: Activity): Treatment => sportTreatment(activity.base);

export const activitiesOfFamily = (activities: Activity[], family: SportFamily): Activity[] =>
  activities.filter((a) => activityFamily(a) === family);

/**
 * Famille cachée (§10, point 100) : cachée dans Réglages, ou sans activité
 * visible, qu'elles soient toutes cachées ou qu'elle n'en ait aucune (choix de
 * l'utilisateur). Une activité ajoutée dans Réglages la fait revenir.
 */
export const isFamilyHidden = (activities: Activity[], hiddenFamilies: readonly string[], family: SportFamily): boolean =>
  hiddenFamilies.includes(family) || activitiesOfFamily(activities, family).every((a) => a.hidden);

/** Familles visibles, dans l'ordre de `families` (toutes par défaut). */
export const visibleFamilies = (
  activities: Activity[], hiddenFamilies: readonly string[], families: readonly SportFamily[] = SPORT_FAMILIES
): SportFamily[] => families.filter((f) => !isFamilyHidden(activities, hiddenFamilies, f));

/**
 * Activité visible : ni cachée elle-même, ni dans une famille cachée. Une
 * activité de base (supprimée, ou session sans activité) suit sa famille.
 */
export const isActivityShown = (activity: Activity, activities: Activity[], hiddenFamilies: readonly string[]): boolean =>
  !activity.hidden && !isFamilyHidden(activities, hiddenFamilies, activityFamily(activity));

/** Activité cachée ou ré-affichée ; une activité visible ne porte pas le champ. */
export const withHidden = (activity: Activity, hidden: boolean): Activity => {
  const { hidden: _was, ...rest } = activity;
  return hidden ? { ...rest, hidden: true } : rest;
};

/** Activités visibles, d'une famille ou de toutes, dans l'ordre de la liste. */
export const visibleActivities = (activities: Activity[], hiddenFamilies: readonly string[], family?: SportFamily): Activity[] =>
  (family ? activitiesOfFamily(activities, family) : activities).filter((a) => isActivityShown(a, activities, hiddenFamilies));

/**
 * Activité désignée par un identifiant : une de la liste, sinon celle de base
 * si l'identifiant est un calcul, sinon `null`.
 */
export const findActivity = (activities: Activity[], id: string | null | undefined): Activity | null => {
  if (!id) return null;
  return activities.find((a) => a.id === id) ?? (isSportType(id) ? baseActivity(id) : null);
};

/**
 * Activité d'une session, d'après sa fiche.
 * - Elle en désigne une qui existe : celle-là.
 * - Elle en désigne une supprimée depuis : l'activité de base de son calcul
 *   (les sessions restent, sous le nom du calcul).
 * - Elle n'en désigne aucune (fiche d'avant les activités, import) : la
 *   première activité de son calcul, sinon l'activité de base.
 * - Sans calcul (session à classer) : `null`.
 */
export const sessionActivity = (
  activities: Activity[],
  activityId: string | null | undefined,
  sport: SportType | null
): Activity | null => {
  if (sport === null) return null;
  if (activityId) {
    const chosen = activities.find((a) => a.id === activityId);
    return chosen && chosen.base === sport ? chosen : baseActivity(sport);
  }
  return activities.find((a) => a.id === sport) ?? activities.find((a) => a.base === sport) ?? baseActivity(sport);
};

/**
 * Liste avec une activité de plus, rangée avec sa famille : après la dernière
 * de la même famille ; sans elle, avant la première d'une famille qui la suit
 * (ordre de `SPORT_FAMILIES`), sinon à la fin. Une liste rangée par famille
 * le reste.
 */
export const insertActivity = (activities: Activity[], activity: Activity): Activity[] => {
  const family = activityFamily(activity);
  const families = activities.map(activityFamily);
  const lastSame = families.lastIndexOf(family);
  const rank = SPORT_FAMILIES.indexOf(family);
  const firstLater = families.findIndex((f) => SPORT_FAMILIES.indexOf(f) > rank);
  const at = lastSame >= 0 ? lastSame + 1 : firstLater >= 0 ? firstLater : activities.length;
  return [...activities.slice(0, at), activity, ...activities.slice(at)];
};

/**
 * Identifiant d'une nouvelle activité, tiré de son nom et unique. Le préfixe
 * `a-` l'empêche de se confondre avec un calcul, donc avec une activité de base.
 */
export const newActivityId = (name: string, existing: Activity[]): string => {
  const slug =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'activite';
  const taken = new Set(existing.map((a) => a.id));
  let id = `a-${slug}`;
  for (let n = 2; taken.has(id); n++) id = `a-${slug}-${n}`;
  return id;
};

/**
 * Couleur d'une nouvelle activité de la famille : la première de ses nuances
 * qu'aucune activité ne porte encore ; les six prises, elles reviennent dans
 * l'ordre.
 */
export const nextActivityColor = (activities: Activity[], family: SportFamily): string => {
  const shades = FAMILY_SHADES[family];
  const used = new Set(activities.map((a) => a.color.toLowerCase()));
  return shades.find((c) => !used.has(c)) ?? shades[activitiesOfFamily(activities, family).length % shades.length];
};

export interface ActivityCount {
  activity: Activity;
  count: number;
}

/**
 * Onglets d'une liste filtrable par activité : les activités présentes parmi
 * `itemActivities` (une par élément, `null` s'il n'en a pas), dans l'ordre de
 * `ordered` puis dans l'ordre d'apparition, avec leur nombre d'éléments.
 */
export const activityCounts = (itemActivities: (Activity | null)[], ordered: Activity[]): ActivityCount[] => {
  const byId = new Map<string, ActivityCount>();
  for (const a of ordered) byId.set(a.id, { activity: a, count: 0 });
  for (const a of itemActivities) {
    if (!a) continue;
    const entry = byId.get(a.id) ?? { activity: a, count: 0 };
    byId.set(a.id, { ...entry, count: entry.count + 1 });
  }
  return [...byId.values()].filter((e) => e.count > 0);
};
