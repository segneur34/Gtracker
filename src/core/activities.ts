import { isObject } from './basics';
import { t } from './i18n';
import {
  SPORT_FAMILIES, SPORT_PROFILES, isSportType, sportFamily, sportTreatment, type SportFamily, type Treatment,
} from './sportProfiles';
import type { SportType } from './types';
import { activityLogo, storedLogo, type LogoId } from './activityLogos';

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
 * rangés avant les activités, ils restent donc valables.
 */

export interface Activity {
  /** Identifiant stable, clé des réglages et des fiches ; jamais affiché. */
  id: string;
  name: string;
  /** Calcul sur lequel l'activité s'appuie. */
  base: SportType;
  /**
   * Couleur de l'activité (pastille, part de graphe), en `#rrggbb` : une de
   * `ACTIVITY_PALETTE`, dans sa version claire ; affichée par `shadeForTheme`.
   */
  color: string;
  /**
   * Cachée dans Réglages : ni proposée, ni listée, ses sessions comprises ;
   * rien n'est effacé, la ré-afficher rend tout.
   */
  hidden?: true;
  /**
   * Logo choisi dans Réglages parmi les onze ; absent, il est deviné du nom et du calcul (`activityLogo`). Une
   * ancienne icône enregistrée se relit en son logo (`storedLogo`).
   */
  icon?: LogoId;
}

/** Une couleur de la palette des activités : celle de la fiche, celle de nuit, son nom dans Réglages. */
export interface PaletteColor {
  /** Couleur rangée dans la fiche de l'activité, en minuscules. */
  light: string;
  /** Couleur montrée en thème sombre ; seule à l'écran, jamais rangée. */
  dark: string;
  name: string;
  /** Nom montré en thème sombre, quand la couleur y change d'aspect (le blanc devient noir). */
  darkName?: string;
}

/**
 * Palette des activités : douze couleurs, communes aux deux familles ; toute
 * activité peut prendre n'importe laquelle, deux activités la même. Le blanc
 * en tête, proposé d'abord à une activité créée (`nextActivityColor`). En
 * thème sombre, le noir devient blanc et le blanc noir, les dix autres ne
 * changent pas (le bleu océan reste tel quel, même peu contrasté sur le fond
 * noir). Une couleur d'activité ne remplit jamais une grande surface et ne
 * porte pas de texte : une pastille cernée de gris à côté du nom, une part de
 * graphe, un rond. Distinctes entre elles, et du vert et du rouge
 * d'Enregistrer (`palette.test.ts`).
 */
export const ACTIVITY_PALETTE: readonly PaletteColor[] = [
  { light: '#ffffff', dark: '#000000', name: 'Blanc', darkName: 'Noir' },
  { light: '#003e52', dark: '#003e52', name: 'Océan' },
  { light: '#72b0bd', dark: '#72b0bd', name: 'Lagon' },
  { light: '#1e88e5', dark: '#1e88e5', name: 'Bleu' },
  { light: '#6236c9', dark: '#6236c9', name: 'Violet' },
  { light: '#ff7a1a', dark: '#ff7a1a', name: 'Orange' },
  { light: '#e0218a', dark: '#e0218a', name: 'Magenta' },
  { light: '#8e1b2e', dark: '#8e1b2e', name: 'Bordeaux' },
  { light: '#000000', dark: '#ffffff', name: 'Noir', darkName: 'Blanc' },
  { light: '#e6c229', dark: '#e6c229', name: 'Jaune' },
  { light: '#646464', dark: '#646464', name: 'Graphite' },
  { light: '#0e8f4f', dark: '#0e8f4f', name: 'Vert' },
];

/**
 * Nom d'une couleur de la palette tel que l'écran le montre. Le nom français (`name`, `darkName`) reste la clé de
 * recherche (`paletteColor`) ; un nom inconnu ressort tel quel.
 */
export const paletteColorText = (name: string): string => {
  switch (name) {
    case 'Blanc': return t('Blanc', { ctx: 'couleur' });
    case 'Océan': return t('Océan', { ctx: 'couleur' });
    case 'Lagon': return t('Lagon', { ctx: 'couleur' });
    case 'Bleu': return t('Bleu', { ctx: 'couleur' });
    case 'Violet': return t('Violet', { ctx: 'couleur' });
    case 'Orange': return t('Orange', { ctx: 'couleur' });
    case 'Magenta': return t('Magenta', { ctx: 'couleur' });
    case 'Bordeaux': return t('Bordeaux', { ctx: 'couleur' });
    case 'Noir': return t('Noir', { ctx: 'couleur' });
    case 'Jaune': return t('Jaune', { ctx: 'couleur' });
    case 'Graphite': return t('Graphite', { ctx: 'couleur' });
    case 'Vert': return t('Vert', { ctx: 'couleur' });
    default: return name;
  }
};

/** Couleur de la palette par son nom, pour les activités de départ et les calculs. */
const paletteColor = (name: string): string => ACTIVITY_PALETTE.find((c) => c.name === name)!.light;

/** Couleur de nuit de chaque couleur de la palette. */
const DARK_SHADE = new Map(ACTIVITY_PALETTE.map((c) => [c.light, c.dark] as const));

/** Couleur d'une activité à l'écran : en sombre, sa version de nuit ; une couleur hors palette reste telle quelle. */
export const shadeForTheme = (color: string, dark: boolean): string =>
  dark ? DARK_SHADE.get(color.toLowerCase()) ?? color : color;

/** Fond des pages, clair et sombre (`--bg` de `theme/tokens.css`, relu par `palette.test.ts`). */
export const THEME_BACKGROUND = { light: '#f7f5f0', dark: '#0e0e0e' } as const;

/** Sous ce contraste avec le fond, un dessin à la couleur d'une activité s'y confond (le blanc sur blanc, le noir sur noir). */
const LOST_ON_BACKGROUND = 1.5;

/** Les trois canaux d'une couleur `#rrggbb`, linéarisés ; `null` pour une autre écriture. */
const linearRgb = (color: string): [number, number, number] | null => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return null;
  const channel = (i: number) => {
    const c = parseInt(color.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel(0), channel(1), channel(2)];
};

/** Luminance relative (WCAG) d'une couleur `#rrggbb`, `null` pour une autre écriture. */
const luminance = (color: string): number | null => {
  const rgb = linearRgb(color);
  return rgb && 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};

/** Contraste WCAG de deux couleurs `#rrggbb` (de 1 à 21) ; `null` si l'une n'en est pas une. */
export const contrastRatio = (a: string, b: string): number | null => {
  const [la, lb] = [luminance(a), luminance(b)];
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Texte lisible sur une couleur d'activité : le noir ou le blanc, celui qui contraste le plus. */
export const readableInk = (color: string): '#000000' | '#ffffff' =>
  (contrastRatio(color, '#000000') ?? 0) >= (contrastRatio(color, '#ffffff') ?? 0) ? '#000000' : '#ffffff';

/**
 * Couleur déjà celle du thème (`shadeForTheme`) qui se confond avec le fond de la page : le blanc le jour, le noir la
 * nuit. Une couleur hors de l'écriture `#rrggbb` (une variable du thème) ne s'y confond pas.
 */
export const isLostOnBackground = (shade: string, dark: boolean): boolean => {
  const ratio = contrastRatio(shade, dark ? THEME_BACKGROUND.dark : THEME_BACKGROUND.light);
  return ratio !== null && ratio < LOST_ON_BACKGROUND;
};

/**
 * Couleur d'un dessin (icône) à la couleur d'une activité : sa couleur du
 * thème, ou l'encre quand elle se confond avec le fond de la page.
 */
export const drawnShadeForTheme = (color: string, dark: boolean): string => {
  const shade = shadeForTheme(color, dark);
  return isLostOnBackground(shade, dark) ? 'var(--ink)' : shade;
};

/** Couleur de chaque calcul, pour ses activités de base : celle de son activité principale. */
export const BASE_COLOR: Record<SportType, string> = {
  wingfoil: paletteColor('Océan'),
  windsurf: paletteColor('Bleu'),
  kite: paletteColor('Orange'),
  bateau: paletteColor('Bordeaux'),
  surf: paletteColor('Noir'),
};

/** Activités de la famille Surf ; le foil de « Surf foil » et de « Pumping » est coché d'office (`settings/activityPresets.ts`). */
export const SURF_ACTIVITY: Activity = { id: 'surf', name: 'Surf', base: 'surf', color: BASE_COLOR.surf };
export const SURF_FOIL_ACTIVITY: Activity = { id: 'a-surf-foil', name: 'Surf foil', base: 'surf', color: paletteColor('Graphite'), hidden: true };

/**
 * Au premier lancement : onze activités, quatre visibles (Wingfoil,
 * Kite, Surf, Pumping) et sept cachées, que l'œil de Réglages ré-affiche. La
 * principale de chaque calcul porte l'identifiant du calcul (celui des anciens
 * réglages), les autres le préfixe `a-`. Le foil et le pumping d'office sont dans
 * `settings/activityPresets.ts`. Chacune a sa couleur de la palette, toutes
 * différentes ; le blanc reste libre pour la première activité créée.
 */
export const DEFAULT_ACTIVITIES: Activity[] = [
  { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: BASE_COLOR.wingfoil },
  { id: 'a-parawing', name: 'Parawing', base: 'wingfoil', color: paletteColor('Lagon'), hidden: true },
  { id: 'windsurf', name: 'Windsurf', base: 'windsurf', color: BASE_COLOR.windsurf, hidden: true },
  { id: 'a-windfoil', name: 'Windfoil', base: 'windsurf', color: paletteColor('Violet'), hidden: true },
  { id: 'kite', name: 'Kite', base: 'kite', color: BASE_COLOR.kite },
  { id: 'a-kitefoil', name: 'Kitefoil', base: 'kite', color: paletteColor('Magenta'), hidden: true },
  { id: 'bateau', name: 'Bateau', base: 'bateau', color: BASE_COLOR.bateau, hidden: true },
  SURF_ACTIVITY,
  { id: 'a-paddle', name: 'Paddle', base: 'surf', color: paletteColor('Jaune'), hidden: true },
  SURF_FOIL_ACTIVITY,
  { id: 'a-pumping', name: 'Pumping', base: 'surf', color: paletteColor('Vert') },
];

/**
 * Couleur d'un logo choisi hors d'une activité (photo du Profil) : celle de la première activité de la liste qui le
 * porte, sinon celle de l'activité de départ qui le porte. Couleur claire, à passer par `shadeForTheme` pour l'afficher.
 */
export const logoColor = (logo: LogoId, activities: readonly Activity[]): string =>
  (activities.find((a) => activityLogo(a) === logo) ?? DEFAULT_ACTIVITIES.find((a) => activityLogo(a) === logo) ?? DEFAULT_ACTIVITIES[0]).color;

/**
 * Nuances de l'ancienne palette, par famille, claires puis sombres : une
 * activité enregistrée qui en porte encore une est reprise à la lecture
 * (`withPaletteColors`). Figées : elles ne servent qu'à les reconnaître.
 */
const OLD_SHADES: ReadonlySet<string> = new Set([
  '#004aad', '#014e86', '#5b87f2', '#4458c2', '#192f94', '#0c92ce',
  '#5b6670', '#8292a6', '#847c6e', '#223246', '#2e2610', '#0a1a2e',
  '#2f6fd6', '#3c7cb7', '#7c98ff', '#86afff',
  '#627386', '#92a5be', '#746b52', '#a4b9d4',
]);

/**
 * Activités enregistrées avec l'ancienne palette, reprises sans remise à
 * zéro : une activité de départ (reconnue par son identifiant) qui porte une
 * ancienne nuance prend sa couleur de départ ; puis, dans l'ordre de la liste,
 * une activité créée qui en porte une prend la première couleur que personne
 * ne porte (`nextActivityColor`). Une couleur de la palette ou inconnue ne
 * bouge pas. Rend la liste elle-même quand rien ne change.
 */
export const withPaletteColors = (activities: Activity[]): Activity[] => {
  const isOld = (a: Activity) => OLD_SHADES.has(a.color.toLowerCase());
  if (!activities.some(isOld)) return activities;
  const defaults = new Map(DEFAULT_ACTIVITIES.map((a) => [a.id, a.color]));
  const list = activities.map((a) => {
    const start = defaults.get(a.id);
    return start !== undefined && isOld(a) ? { ...a, color: start } : a;
  });
  for (let i = 0; i < list.length; i++) {
    if (isOld(list[i])) list[i] = { ...list[i], color: nextActivityColor(list) };
  }
  return list;
};

/** Calcul par défaut d'une famille, pour un module sans activité. */
export const FAMILY_BASE: Record<SportFamily, SportType> = { voile: 'wingfoil', surf: 'surf' };

/** Nom d'une famille, tel que l'interface l'affiche. */
export const FAMILY_LABEL: Record<SportFamily, string> = { voile: t('Voile'), surf: t('Surf') };

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
    const { id, name, base, color, hidden } = item;
    const icon = storedLogo(item.icon);
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    if (typeof name !== 'string' || name.trim() === '' || !isSportType(base)) continue;
    seen.add(id);
    list.push({
      id, name: name.trim(), base, color: isColor(color) ? color : BASE_COLOR[base],
      ...(hidden === true ? { hidden } : {}),
      ...(icon ? { icon } : {}),
    });
  }
  // Rien n'est réécrit ici : la nouvelle forme s'enregistre à la prochaine écriture des activités.
  return withPaletteColors(list);
};

/** Activité de base d'un calcul : son libellé, sa couleur, son identifiant. */
export const baseActivity = (sport: SportType): Activity => ({
  id: sport,
  name: SPORT_PROFILES[sport].label,
  base: sport,
  color: BASE_COLOR[sport],
});

/**
 * Nom d'origine (activité de départ, libellé de calcul) tel que l'écran le montre ; un autre nom ressort tel quel.
 * Évalué à l'appel : la langue est celle du moment.
 */
const defaultNameText = (name: string): string => {
  switch (name) {
    case 'Wingfoil': return t('Wingfoil');
    case 'Parawing': return t('Parawing');
    case 'Windsurf': return t('Windsurf');
    case 'Windfoil': return t('Windfoil');
    case 'Kite': return t('Kite');
    case 'Kitefoil': return t('Kitefoil');
    case 'Bateau': return t('Bateau');
    case 'Surf': return t('Surf');
    case 'Paddle': return t('Paddle');
    case 'Surf foil': return t('Surf foil');
    case 'Pumping': return t('Pumping');
    case 'Planche à voile': return t('Planche à voile');
    case 'Kitesurf': return t('Kitesurf');
    default: return name;
  }
};

/** Libellé d'un calcul tel que l'écran le montre. */
export const sportDisplayName = (sport: SportType): string => defaultNameText(SPORT_PROFILES[sport].label);

/**
 * Nom d'une activité tel que l'écran le montre. Le nom gardé (réglages, GPX, journal) reste le français d'origine :
 * seul un nom d'origine se traduit, celui d'une activité de départ jamais renommée, ou le libellé du calcul d'une
 * activité de base (`baseActivity`). Une activité renommée ou créée garde son nom, même s'il ressemble à un nom
 * d'origine.
 */
export const activityDisplayName = (a: Pick<Activity, 'id' | 'name'>): string => {
  const original =
    DEFAULT_ACTIVITIES.some((d) => d.id === a.id && d.name === a.name) ||
    (isSportType(a.id) && SPORT_PROFILES[a.id].label === a.name);
  return original ? defaultNameText(a.name) : a.name;
};

export const activityFamily = (activity: Activity): SportFamily => sportFamily(activity.base);

export const activityTreatment = (activity: Activity): Treatment => sportTreatment(activity.base);

export const activitiesOfFamily = (activities: Activity[], family: SportFamily): Activity[] =>
  activities.filter((a) => activityFamily(a) === family);

/**
 * Famille cachée : cachée dans Réglages, ou sans activité
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
 * - Elle en désigne une qui n'existe plus, ou d'un autre calcul que la session :
 *   l'activité de départ de son calcul (celle dont l'identifiant est le calcul)
 *   si elle existe encore, avec son nom, sa couleur et ses réglages ; sinon
 *   l'activité de base (les sessions restent, sous le nom du calcul).
 * - Elle n'en désigne aucune (fiche d'avant les activités, import) : la
 *   première activité de son calcul, sinon l'activité de base.
 * - Sans calcul (session à classer) : `null`.
 * Rien n'est réécrit dans la fiche : la règle joue à la lecture.
 */
export const sessionActivity = (
  activities: Activity[],
  activityId: string | null | undefined,
  sport: SportType | null
): Activity | null => {
  if (sport === null) return null;
  if (activityId) {
    const chosen = activities.find((a) => a.id === activityId);
    if (chosen && chosen.base === sport) return chosen;
    return activities.find((a) => a.id === sport) ?? baseActivity(sport);
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
 * Couleur d'une nouvelle activité, de voile ou de surf : la première de la
 * palette qu'aucune activité ne porte encore, le blanc d'abord ; les douze
 * prises, elles reviennent dans l'ordre.
 */
export const nextActivityColor = (activities: Activity[]): string => {
  const used = new Set(activities.map((a) => a.color.toLowerCase()));
  return (ACTIVITY_PALETTE.find((c) => !used.has(c.light)) ?? ACTIVITY_PALETTE[activities.length % ACTIVITY_PALETTE.length]).light;
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
