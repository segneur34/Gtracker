import { errorMessage } from '../../core/basics';
import type { LatLon } from '../../core/types';
import {
  PLACE_RULES, choosePlace, correctedPlace, isElsewhere, isPlaceToFind, learnPlace, learnedSpot, nearestLearnedPlace,
  placesToLearn, trackEnds, type LearnedPlace, type PlaceRules, type PlaceSpot, type SessionPlace, type TrackEnds,
} from '../../library/places';
import { sameJson } from '../../library/record';
import { reversePlaces, roundedPoint, type PhotonFeature } from '../../planning/geocoding';
import { readDeviceLearnedPlaces, saveLearnedPlacesFile, writeDeviceLearnedPlaces } from '../learnedPlacesFile';
import { isPlaceSearchOn } from '../usePlaceSearch';
import { findSession, lib, writableFolder } from './memory';
import { readSessionGpx, updateSessionRecord } from './sessionRecords';
import { reportError } from './store';

/**
 * File des lieux : trouve le lieu des sessions qui n'en ont jamais eu (`library/places.ts`), sans bloquer
 * l'affichage, et l'écrit dans leur fiche. Appelée à la fin d'un enregistrement, à l'import de quelques
 * fichiers, à l'ouverture d'une analyse et pour chaque ligne de la liste qui paraît à l'écran ; jamais pour
 * toute la mémoire d'un coup.
 *
 * - Un lieu appris à moins de `learnedRadiusM` du point est pris sans interroger le service, recherche
 *   coupée comprise ; sinon le lieu est cherché en ligne.
 * - L'arrivée n'est regardée que si elle est à plus de `elsewhereM` du départ : une seule recherche de plus.
 * - Une requête à la fois, espacées d'au moins `intervalMs`.
 * - Au plus `maxWaiting` sessions en attente : l'appel le plus récent passe devant, les plus anciennes
 *   sortent de la file (elles reviendront à leur prochain affichage). Pas de doublon.
 * - Un échec (réseau absent, service muet) suspend la file jusqu'au prochain appel, sans rien écrire de ce
 *   qui manque : la session sera cherchée de nouveau.
 * - Recherche coupée dans Réglages : rien d'envoyé, rien d'écrit d'une réponse en route ; seuls les lieux
 *   appris servent. Une session qu'ils ne couvrent pas n'est plus regardée avant qu'un lieu soit appris ou
 *   la recherche rallumée.
 * - Une session au lieu déjà trouvé, en lecture seule ou disparue est sautée ; un lieu changé pendant la
 *   recherche (corrigé par l'utilisateur) n'est pas écrasé.
 */

/** Ce que la file sait d'une session : son lieu (`undefined` : jamais cherché), sa lecture seule, son début. */
export interface PlaceQueueSession {
  place: SessionPlace | undefined;
  readOnly: boolean;
  startMs: number;
}

/** Ce dont la file a besoin, remplaçable dans les tests. */
export interface PlaceQueueDeps {
  /** Recherche en ligne active (Réglages). */
  enabled: () => boolean;
  /** Lieux appris ; la même liste tant qu'elle ne change pas. */
  learned: () => readonly LearnedPlace[];
  /** Session d'un fichier, `null` si la mémoire ne la connaît pas. */
  session: (file: string) => PlaceQueueSession | null;
  /** Départ et arrivée de la session, lus dans son GPX ; `null` sans point ; lève une erreur si le GPX ne se lit pas. */
  pointsOf: (file: string) => Promise<TrackEnds | null>;
  /** Objets de la carte autour du point ; lève une erreur sans réponse. */
  search: (point: LatLon, rules: PlaceRules) => Promise<PhotonFeature[]>;
  /** Range le lieu dans la fiche. */
  write: (file: string, place: SessionPlace) => void;
  rules: PlaceRules;
  /** Écart minimal entre deux requêtes, en millisecondes. */
  intervalMs: number;
  maxWaiting: number;
}

export interface PlaceQueue {
  /** Met la session en tête de file ; `points` : son départ et son arrivée, déjà lus (trace ouverte dans une analyse). */
  queue: (file: string, points?: TrackEnds | null) => void;
  /** Sessions en attente, la prochaine en tête. */
  waiting: () => readonly string[];
  /** Fin du passage en cours (rien si la file est au repos). */
  idle: () => Promise<void>;
}

/** Issue d'une session : réglée (sortie de la file), une autre passée devant, ou la file suspendue. */
type Outcome = 'done' | 'later' | 'suspend';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** File des lieux sur `deps` : voir l'en-tête. */
export const createPlaceQueue = (deps: PlaceQueueDeps): PlaceQueue => {
  let waiting: string[] = [];
  /** Départs et arrivées déjà connus, avec le début de la session qu'ils décrivent (un dossier changé en a d'autres). */
  const ends = new Map<string, { points: TrackEnds; startMs: number }>();
  /** Sessions sans point lisible : pas de nouvel essai avant le prochain lancement. */
  const noStart = new Set<string>();
  /** Sessions que les lieux appris ne couvrent pas, recherche coupée ; oubliées dès que la liste apprise change. */
  const uncovered = new Set<string>();
  let uncoveredFor: readonly LearnedPlace[] | null = null;
  let suspended = false;
  let lastRequestAt = -Infinity;
  let pass: Promise<void> | null = null;

  const drop = (file: string): void => {
    waiting = waiting.filter((f) => f !== file);
  };

  /** Lieux appris ; un changement de la liste rend à la file les sessions qu'elle ne couvrait pas. */
  const learned = (): readonly LearnedPlace[] => {
    const list = deps.learned();
    if (list !== uncoveredFor) {
      uncovered.clear();
      uncoveredFor = list;
    }
    return list;
  };

  /** Vrai si la session est à regarder : connue, inscriptible, lieu à trouver. */
  const searchable = (s: PlaceQueueSession | null): s is PlaceQueueSession => s !== null && !s.readOnly && isPlaceToFind(s.place);

  /** Rien à faire : recherche coupée et aucun lieu appris, ou session déjà regardée ainsi. */
  const idleFor = (file: string): boolean => !deps.enabled() && (learned().length === 0 || uncovered.has(file));

  /** Départ et arrivée ; `null` sans point, `undefined` si le GPX n'a pas pu être lu (nouvel essai à un prochain appel). */
  const pointsOf = async (file: string, s: PlaceQueueSession): Promise<TrackEnds | null | undefined> => {
    const known = ends.get(file);
    if (known && known.startMs === s.startMs) return known.points;
    try {
      const points = await deps.pointsOf(file);
      if (points) ends.set(file, { points, startMs: s.startMs });
      return points;
    } catch {
      return undefined;
    }
  };

  /**
   * Lieu d'un point : un lieu appris, sinon une recherche en ligne. `null` : recherche coupée sans lieu appris
   * (ou coupée pendant la requête). `ahead` : la session doit rester en tête après l'attente entre deux requêtes.
   */
  const lookup = async (file: string, point: LatLon, ahead: boolean): Promise<PlaceSpot | null | 'later' | 'suspend'> => {
    const known = nearestLearnedPlace(point, learned(), deps.rules);
    if (known) return learnedSpot(known, point);
    if (!deps.enabled()) return null;
    const wait = lastRequestAt + deps.intervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    // Pendant l'attente, une autre session a pu passer devant, ou la recherche être coupée.
    if (ahead && waiting[0] !== file) return 'later';
    if (!deps.enabled()) return null;
    lastRequestAt = Date.now();
    let features: PhotonFeature[];
    try {
      features = await deps.search(point, deps.rules);
    } catch {
      return 'suspend';
    }
    if (!deps.enabled()) return null;
    return { name: choosePlace(features, point, deps.rules), source: 'carte', ...roundedPoint(point) };
  };

  /** Écrit `place` si la session n'a pas changé depuis `before` (même début, même lieu). */
  const commit = (file: string, before: PlaceQueueSession, place: SessionPlace): void => {
    if (sameJson(place, before.place)) return;
    const now = deps.session(file);
    if (!now || now.readOnly || now.startMs !== before.startMs || !sameJson(now.place, before.place)) return;
    deps.write(file, place);
  };

  const settle = async (file: string): Promise<Outcome> => {
    const s = deps.session(file);
    if (!searchable(s) || idleFor(file)) return 'done';
    const points = await pointsOf(file, s);
    if (!points) {
      if (points === null) noStart.add(file);
      return 'done';
    }
    const { start, end } = points;
    let place = s.place;
    if (place === undefined) {
      const found = await lookup(file, start, true);
      if (found === 'later' || found === 'suspend') return found;
      if (found === null) {
        uncovered.add(file);
        return 'done';
      }
      place = found;
    }
    if (place.arrival === undefined) {
      if (!isElsewhere(start, end, deps.rules)) {
        place = { ...place, arrival: null };
      } else {
        const found = await lookup(file, end, false);
        if (found === 'suspend' || found === 'later') {
          // Le départ trouvé est gardé ; l'arrivée sera regardée de nouveau.
          commit(file, s, place);
          return found;
        }
        if (found === null) uncovered.add(file);
        else place = { ...place, arrival: found };
      }
    }
    commit(file, s, place);
    ends.delete(file);
    return 'done';
  };

  const runPass = async (): Promise<void> => {
    while (waiting.length > 0 && !suspended) {
      const file = waiting[0];
      const outcome = await settle(file);
      if (outcome === 'suspend') {
        suspended = true;
        return;
      }
      if (outcome === 'done') drop(file);
    }
  };

  const run = (): void => {
    if (pass) return;
    pass = runPass().finally(() => {
      pass = null;
      // Appel venu pendant la fin du passage : la file reprend.
      if (waiting.length > 0 && !suspended) run();
    });
  };

  return {
    queue: (file, points) => {
      if (noStart.has(file) || idleFor(file)) return;
      const s = deps.session(file);
      if (!searchable(s)) return;
      if (points) ends.set(file, { points, startMs: s.startMs });
      waiting = [file, ...waiting.filter((f) => f !== file)];
      for (const dropped of waiting.splice(deps.maxWaiting)) ends.delete(dropped);
      suspended = false;
      run();
    },
    waiting: () => waiting,
    idle: () => pass ?? Promise.resolve(),
  };
};

/** Au plus une requête par seconde. */
const PLACE_REQUEST_INTERVAL_MS = 1000;

/** Au plus vingt sessions en attente. */
const PLACE_QUEUE_MAX = 20;

const placeQueue = createPlaceQueue({
  enabled: isPlaceSearchOn,
  learned: readDeviceLearnedPlaces,
  session: (file) => {
    const s = findSession(file);
    return s ? { place: s.record.place, readOnly: s.readOnly, startMs: s.record.summary.startMs } : null;
  },
  pointsOf: async (file) => {
    const text = await readSessionGpx(file);
    if (text === null) throw new Error('GPX illisible');
    return trackEnds(text);
  },
  search: (point, rules) => reversePlaces(point, { limit: rules.resultLimit, radiusM: rules.waterRadiusM }),
  write: (file, place) => updateSessionRecord(file, { place }),
  rules: PLACE_RULES,
  intervalMs: PLACE_REQUEST_INTERVAL_MS,
  maxWaiting: PLACE_QUEUE_MAX,
});

/**
 * Trouve le lieu d'une session de la mémoire s'il reste à trouver (voir l'en-tête) ; `points` : son départ et son
 * arrivée, quand sa trace est déjà lue.
 */
export const queueSessionPlace = (file: string, points?: TrackEnds | null): void => placeQueue.queue(file, points);

/**
 * « Lieu » d'une session : son lieu de départ devient `departure`, celui de son arrivée `arrival` (absent : inchangé),
 * `source: 'utilisateur'` ; ils ne sont plus jamais cherchés ni remplacés. Chaque nom corrigé, non vide, est appris
 * au point de la session (`learnPlace`), sur l'appareil puis dans `lieux.json` du dossier ; un échec d'écriture du
 * dossier est dit sans rien défaire. Un nom vidé laisse la session sans lieu, rien n'est appris ni désappris.
 */
export const correctSessionPlace = async (file: string, departure: string, arrival?: string): Promise<void> => {
  let session = findSession(file);
  if (!session || session.readOnly) return;
  let start: LatLon | null = null;
  if (session.record.place === undefined) {
    const text = await readSessionGpx(file);
    start = text === null ? null : trackEnds(text)?.start ?? null;
    if (start === null) return;
    // La fiche a pu changer pendant la lecture (lieu trouvé entre-temps) : c'est sur elle que porte la correction.
    session = findSession(file);
    if (!session || session.readOnly) return;
  }
  const before = session.record.place;
  const at = before ?? start;
  if (!at) return;
  const after = correctedPlace(before, at, departure, arrival);
  if (after === before) return;
  updateSessionRecord(file, { place: after });
  const spots = placesToLearn(before, after);
  if (spots.length === 0) return;
  const now = Date.now();
  const learned = spots.reduce<LearnedPlace[]>((list, spot) => learnPlace(list, spot, PLACE_RULES, now), [...readDeviceLearnedPlaces()]);
  writeDeviceLearnedPlaces(learned);
  await lib.opening;
  const folder = writableFolder();
  if (!folder) return;
  await saveLearnedPlacesFile(folder, learned, PLACE_RULES).catch((err: unknown) =>
    reportError(`Lieux appris non recopiés dans le dossier : ${errorMessage(err, 'erreur inconnue')}`));
};

// La file des lieux vient après l'import, qui la demande par `lib.onSessionsAdded`.
lib.onSessionsAdded = (files) => {
  for (const file of files) queueSessionPlace(file);
};
