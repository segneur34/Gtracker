import type { Activity } from '../core/activities';
import { dateLocale, t, tn } from '../core/i18n';
import { DISTANCE_UNIT_SYMBOL, formatDuration, toDisplayDistance, type DistanceUnit } from '../core/units';

/**
 * Page Sessions : la rangée des activités qui filtre la liste, les sessions listées et la ligne des totaux sous le
 * titre. Calculs purs : la page leur passe l'activité de chaque session, ce qui est montré et le filtre de l'adresse.
 */

/** Ce qu'une session doit porter pour être comptée : le résumé de sa fiche. */
interface Summarized {
  record: { summary: { startMs: number; endMs: number; distanceM: number } };
}

/**
 * Activités de la rangée, dans l'ordre : toutes celles montrées (`shown`, même sans session), puis celles des sessions
 * listées qui n'y sont pas (le calcul d'une activité supprimée), enfin l'activité choisie par l'adresse si elle
 * manque encore (une activité cachée, ouverte par son adresse). Chacune une seule fois, par son identifiant.
 */
export const filterChoices = (
  shown: readonly Activity[],
  listedActivities: readonly (Activity | null)[],
  selected: Activity | null
): Activity[] => {
  const choices = [...shown];
  const ids = new Set(choices.map((a) => a.id));
  for (const activity of [...listedActivities, selected]) {
    if (!activity || ids.has(activity.id)) continue;
    ids.add(activity.id);
    choices.push(activity);
  }
  return choices;
};

/**
 * Sessions de la liste et nombre de celles qu'elle laisse de côté. Une session à classer (sans activité) n'y est
 * jamais : elle a sa carte à part. Sans filtre (`selectedId` nul), les sessions des activités montrées, et `hidden`
 * compte celles des activités cachées ; avec un filtre, toutes les sessions de cette activité, même cachée (une
 * adresse s'ouvre toujours), et `hidden` vaut 0.
 */
export const filterSessions = <T>(
  sessions: readonly T[],
  activityOf: (session: T) => Activity | null,
  isShown: (activity: Activity) => boolean,
  selectedId: string | null
): { listed: T[]; hidden: number } => {
  const listed: T[] = [];
  let hidden = 0;
  for (const session of sessions) {
    const activity = activityOf(session);
    if (!activity) continue;
    if (selectedId !== null) {
      if (activity.id === selectedId) listed.push(session);
    } else if (isShown(activity)) listed.push(session);
    else hidden++;
  }
  return { listed, hidden };
};

export interface SessionsTotals {
  count: number;
  distanceM: number;
  /** Somme des durées de session, du premier au dernier point, comme au Profil. */
  durationMs: number;
}

/** Nombre, distance et durée des sessions listées. */
export const sessionsTotals = (sessions: readonly Summarized[]): SessionsTotals => {
  let distanceM = 0;
  let durationMs = 0;
  for (const { record: { summary } } of sessions) {
    if (Number.isFinite(summary.distanceM)) distanceM += summary.distanceM;
    const span = summary.endMs - summary.startMs;
    if (Number.isFinite(span) && span > 0) durationMs += span;
  }
  return { count: sessions.length, distanceM, durationMs };
};

/** Unité des totaux : celle que partagent toutes les activités listées, sinon le kilomètre. */
export const commonDistanceUnit = (units: readonly DistanceUnit[]): DistanceUnit =>
  units.length > 0 && units.every((u) => u === units[0]) ? units[0] : 'km';

/** À partir de 10 h, la durée en heures entières ; en dessous, en heures et minutes. */
const WHOLE_HOURS_FROM_MS = 10 * 3600_000;
/** À partir de 100 unités, la distance sans décimale. */
const WHOLE_DISTANCE_FROM = 100;

const totalDistance = (m: number, unit: DistanceUnit): string => {
  const value = toDisplayDistance(m, unit);
  return `${value.toLocaleString(dateLocale(), { maximumFractionDigits: value < WHOLE_DISTANCE_FROM ? 1 : 0 })} ${DISTANCE_UNIT_SYMBOL[unit]}`;
};

const totalDuration = (ms: number): string =>
  ms >= WHOLE_HOURS_FROM_MS ? `${Math.round(ms / 3600_000).toLocaleString(dateLocale())} h` : formatDuration(ms);

/**
 * Le nom de l'activité dans une phrase (majuscule retirée sauf pour un sigle), et si « de » s'élide devant lui
 * (« de wingfoil », « d'optimist », « de SUP ») : l'appelant choisit entre deux phrases entières.
 */
const activityWord = (name: string): { word: string; elided: boolean } => {
  const word = /^\p{Lu}\p{Ll}/u.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
  return { word, elided: /^[aeiouyàâéèêëîïôöûü]/i.test(word) };
};

/** Phrase d'une liste vide filtrée sur une activité : « Aucune session de wingfoil pour l'instant. », « … d'optimist … ». */
export const emptyOfActivity = (activityName: string): string => {
  const { word, elided } = activityWord(activityName);
  return elided ? t("Aucune session d'{word} pour l'instant.", { word }) : t("Aucune session de {word} pour l'instant.", { word });
};

/**
 * Ligne sous le titre : « 102 sessions · 2 846 km · 187 h sur l'eau » ; filtrée sur une activité, « 42 sessions de
 * wingfoil · 1 204 km · 61 h ». Sans session : « Aucune session », « Aucune session de kite ».
 */
export const totalsLine = (totals: SessionsTotals, unit: DistanceUnit, activityName: string | null = null): string => {
  let count: string;
  if (activityName === null) {
    count = totals.count === 0 ? t('Aucune session') : tn(totals.count, '{n} session', '{n} sessions');
  } else {
    const { word, elided } = activityWord(activityName);
    if (totals.count === 0) count = elided ? t("Aucune session d'{word}", { word }) : t('Aucune session de {word}', { word });
    else if (elided) count = tn(totals.count, "{n} session d'{word}", "{n} sessions d'{word}", { word });
    else count = tn(totals.count, '{n} session de {word}', '{n} sessions de {word}', { word });
  }
  if (totals.count === 0) return count;
  const parts = [count, totalDistance(totals.distanceM, unit), totalDuration(totals.durationMs)].join(' · ');
  return activityName === null ? t("{parts} sur l'eau", { parts }) : parts;
};
