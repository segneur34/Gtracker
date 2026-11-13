import type { LatLon } from '../../core/types';
import { PLACE_RULES, choosePlace, firstTrackPoint, foundPlace, type PlaceRules, type SessionPlace } from '../../library/places';
import { reversePlaces, type PhotonFeature } from '../../planning/geocoding';
import { isPlaceSearchOn } from '../usePlaceSearch';
import { findSession, lib } from './memory';
import { readSessionGpx, updateSessionRecord } from './sessionRecords';

/**
 * File des lieux : cherche en ligne le lieu des sessions qui n'en ont jamais eu (`library/places.ts`),
 * sans bloquer l'affichage, et l'écrit dans leur fiche. Appelée à la fin d'un enregistrement, à l'import
 * de quelques fichiers, à l'ouverture d'une analyse et pour chaque ligne de la liste qui paraît à l'écran ;
 * jamais pour toute la mémoire d'un coup.
 *
 * - Une requête à la fois, espacées d'au moins `intervalMs`.
 * - Au plus `maxWaiting` sessions en attente : l'appel le plus récent passe devant, les plus anciennes
 *   sortent de la file (elles reviendront à leur prochain affichage). Pas de doublon.
 * - Un échec (réseau absent, service muet) suspend la file jusqu'au prochain appel, sans rien écrire : la
 *   session reste sans lieu et sera cherchée de nouveau.
 * - Recherche coupée dans Réglages : rien en file, rien d'envoyé, et rien d'écrit d'une réponse en route.
 * - Une session déjà cherchée (lieu trouvé ou non), en lecture seule ou disparue est sautée.
 */

/** Ce que la file sait d'une session : son lieu (`undefined` : jamais cherché), sa lecture seule, son début. */
export interface PlaceQueueSession {
  place: SessionPlace | undefined;
  readOnly: boolean;
  startMs: number;
}

/** Ce dont la file a besoin, remplaçable dans les tests. */
export interface PlaceQueueDeps {
  /** Recherche active (Réglages). */
  enabled: () => boolean;
  /** Session d'un fichier, `null` si la mémoire ne la connaît pas. */
  session: (file: string) => PlaceQueueSession | null;
  /** Point de départ de la session, lu dans son GPX ; `null` sans point ; lève une erreur si le GPX ne se lit pas. */
  startOf: (file: string) => Promise<LatLon | null>;
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
  /** Met la session en tête de file ; `start` : son point de départ, déjà lu (trace ouverte dans une analyse). */
  queue: (file: string, start?: LatLon | null) => void;
  /** Sessions en attente, la prochaine en tête. */
  waiting: () => readonly string[];
  /** Fin du passage en cours (rien si la file est au repos). */
  idle: () => Promise<void>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** File des lieux sur `deps` : voir l'en-tête. */
export const createPlaceQueue = (deps: PlaceQueueDeps): PlaceQueue => {
  let waiting: string[] = [];
  /** Points de départ déjà connus, avec le début de la session qu'ils décrivent (un dossier changé en a d'autres). */
  const starts = new Map<string, { start: LatLon; startMs: number }>();
  /** Sessions sans point lisible : pas de nouvel essai avant le prochain lancement. */
  const noStart = new Set<string>();
  let suspended = false;
  let lastRequestAt = -Infinity;
  let pass: Promise<void> | null = null;

  const drop = (file: string): void => {
    waiting = waiting.filter((f) => f !== file);
  };

  /** Vrai si la session est à chercher : connue, inscriptible, jamais cherchée. */
  const searchable = (s: PlaceQueueSession | null): s is PlaceQueueSession => s !== null && !s.readOnly && s.place === undefined;

  /** Point de départ ; `null` sans point, `undefined` si le GPX n'a pas pu être lu (nouvel essai à un prochain appel). */
  const startOf = async (file: string, s: PlaceQueueSession): Promise<LatLon | null | undefined> => {
    const known = starts.get(file);
    if (known && known.startMs === s.startMs) return known.start;
    try {
      const start = await deps.startOf(file);
      if (start) starts.set(file, { start, startMs: s.startMs });
      return start;
    } catch {
      return undefined;
    }
  };

  const runPass = async (): Promise<void> => {
    while (waiting.length > 0 && !suspended) {
      if (!deps.enabled()) {
        waiting = [];
        return;
      }
      const file = waiting[0];
      const s = deps.session(file);
      if (!searchable(s)) {
        drop(file);
        continue;
      }
      const start = await startOf(file, s);
      if (!start) {
        if (start === null) noStart.add(file);
        drop(file);
        continue;
      }
      const wait = lastRequestAt + deps.intervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      // Pendant l'attente, une autre session a pu passer devant, ou la recherche être coupée.
      if (waiting[0] !== file) continue;
      if (!deps.enabled()) continue;
      lastRequestAt = Date.now();
      let features: PhotonFeature[];
      try {
        features = await deps.search(start, deps.rules);
      } catch {
        suspended = true;
        return;
      }
      drop(file);
      starts.delete(file);
      const now = deps.session(file);
      if (deps.enabled() && searchable(now) && now.startMs === s.startMs) {
        deps.write(file, foundPlace(choosePlace(features, start, deps.rules), start));
      }
    }
  };

  const run = (): void => {
    if (pass) return;
    pass = runPass().finally(() => {
      pass = null;
      // Appel venu pendant la fin du passage : la file reprend.
      if (waiting.length > 0 && !suspended && deps.enabled()) run();
    });
  };

  return {
    queue: (file, start) => {
      if (!deps.enabled() || noStart.has(file)) return;
      const s = deps.session(file);
      if (!searchable(s)) return;
      if (start) starts.set(file, { start, startMs: s.startMs });
      waiting = [file, ...waiting.filter((f) => f !== file)];
      for (const dropped of waiting.splice(deps.maxWaiting)) starts.delete(dropped);
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
  session: (file) => {
    const s = findSession(file);
    return s ? { place: s.record.place, readOnly: s.readOnly, startMs: s.record.summary.startMs } : null;
  },
  startOf: async (file) => {
    const text = await readSessionGpx(file);
    if (text === null) throw new Error('GPX illisible');
    return firstTrackPoint(text);
  },
  search: (point, rules) => reversePlaces(point, { limit: rules.resultLimit, radiusM: rules.waterRadiusM }),
  write: (file, place) => updateSessionRecord(file, { place }),
  rules: PLACE_RULES,
  intervalMs: PLACE_REQUEST_INTERVAL_MS,
  maxWaiting: PLACE_QUEUE_MAX,
});

/**
 * Cherche le lieu d'une session de la mémoire s'il ne l'a jamais été (voir l'en-tête) ; `start` : son point
 * de départ, quand sa trace est déjà lue.
 */
export const queueSessionPlace = (file: string, start?: LatLon | null): void => placeQueue.queue(file, start);

// La file des lieux vient après l'import, qui la demande par `lib.onSessionsAdded`.
lib.onSessionsAdded = (files) => {
  for (const file of files) queueSessionPlace(file);
};
