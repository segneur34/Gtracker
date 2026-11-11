import { formatLocalDate } from '../core/calendar';
import type { SportType } from '../core/types';
import { isSportType } from '../core/sportProfiles';
import { imuFileName, recordFileName } from './record';

/**
 * Nom et support d'un GPX qui entre dans la mémoire.
 *
 * Un GPX importé est renommé comme une session enregistrée
 * (`sessionFileName`) : la liste des fichiers se lit alors dans l'ordre des
 * dates. Son support vient de la balise `<type>` de la trace quand on la
 * reconnaît ; sinon il reste inconnu et la session attend d'être classée.
 */

/**
 * Nom libre pour une session dans `sessions/` : `nom.gpx`, sinon `nom-2.gpx`,
 * `nom-3.gpx`… Le nom n'est libre que si sa fiche l'est aussi. La comparaison
 * ignore la casse, comme le système de fichiers de Windows.
 */
export const uniqueSessionFileName = (gpxName: string, taken: Iterable<string>): string => {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  // Ni le GPX, ni sa fiche, ni ses capteurs : un fichier resté seul ne doit pas être repris par une autre session.
  const isFree = (name: string) =>
    !used.has(name.toLowerCase()) && !used.has(recordFileName(name).toLowerCase()) && !used.has(imuFileName(name).toLowerCase());
  if (isFree(gpxName)) return gpxName;
  const base = gpxName.replace(/\.gpx$/i, '');
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}.gpx`;
    if (isFree(candidate)) return candidate;
  }
};

/**
 * Nom du GPX téléchargé d'une session nommée, sans extension :
 * `2026-10-10 Wingfoil - Carnon`, pour la retrouver dans Téléchargements. La
 * date est celle du début de la session (heure locale), sinon le préfixe daté
 * de son nom de fichier ; sans l'un ni l'autre, ni activité, il reste le nom.
 */
export const downloadBaseName = (sessionName: string, activityName: string | null, startMs: number | null, fileName: string): string => {
  const d = startMs === null ? null : new Date(startMs);
  const date = d ? formatLocalDate(d.getTime()) : /^(\d{4}-\d{2}-\d{2})/.exec(fileName)?.[1];
  const label = activityName ? `${activityName} - ${sessionName.trim()}` : sessionName.trim();
  return date ? `${date} ${label}` : label;
};

/**
 * Type d'activité ramené à sa clé : en minuscules, sans espace ni tiret ni souligné. `Trail Running`,
 * `trail_running` et `trail-running` se lisent `trailrunning`.
 */
const typeKey = (type: string): string => type.trim().toLowerCase().replace(/[\s_-]/g, '');

/**
 * Sports que Gtracker ne range pas : course, vélo et entraînement, tels que les autres applications les écrivent dans
 * le `<type>` d'un GPX, et tels que l'ancienne application les écrivait dans ses GPX et ses fiches (`running`,
 * `cycling`, `run-intervals`, `bike-intervals`, `run-test`, `muscu`). Par leur clé (`typeKey`). La seule liste : la
 * porte d'import refuse une session de l'un d'eux (`library/legacyImport.ts`, bibliothèque, FIT).
 */
const OTHER_SPORT_TYPES: ReadonlySet<string> = new Set([
  'running', 'run', 'trailrunning', 'treadmillrunning', 'course',
  'cycling', 'biking', 'bike', 'ride', 'roadcycling', 'roadbiking', 'mountainbiking', 'gravelcycling', 'ebikeride', 'ebiking', 'velo',
  'runintervals', 'bikeintervals', 'runtest', 'muscu',
]);

/** Vrai pour un sport que Gtracker ne range pas (`OTHER_SPORT_TYPES`) ; faux pour un type inconnu, qui reste « à classer ». */
export const isOtherSportType = (type: string | null | undefined): boolean => typeof type === 'string' && OTHER_SPORT_TYPES.has(typeKey(type));

/** Types d'activité des autres applications, ramenés à nos supports, par leur clé (`typeKey`). */
const FOREIGN_TYPES: Record<string, SportType> = {
  windsurfing: 'windsurf',
  windsurf: 'windsurf',
  kitesurfing: 'kite',
  kitesurf: 'kite',
  kiteboarding: 'kite',
  sailing: 'bateau',
  sail: 'bateau',
  voile: 'bateau',
  wingfoiling: 'wingfoil',
  wingfoil: 'wingfoil',
  surfing: 'surf',
  surf: 'surf',
  surffoiling: 'surf',
  foilsurfing: 'surf',
};

/** Support deviné depuis la balise `<type>` d'un GPX, ou `null` (type inconnu, ou sport que Gtracker ne range pas). */
export const guessSport = (gpxType: string | undefined): SportType | null => {
  if (!gpxType) return null;
  const raw = gpxType.trim();
  if (isSportType(raw)) return raw;
  return FOREIGN_TYPES[typeKey(raw)] ?? null;
};
