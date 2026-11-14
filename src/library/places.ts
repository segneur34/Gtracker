import { isFiniteNumber, isObject } from '../core/basics';
import { haversineDistance } from '../core/geo';
import type { LatLon } from '../core/types';
import { roundedPoint, type PhotonFeature } from '../planning/geocoding';

/**
 * Lieu d'une session : le nom du plan d'eau (plage, port, marina, étang, baie) le plus proche de son point
 * de départ, sinon de la commune, trouvé une fois par la recherche inverse et gardé dans sa fiche
 * (`SessionRecord.place`). Il compose le nom montré de la session (`library/sessionName.ts`). Pur : la
 * recherche passe par la file des lieux, qui seule touche au réseau.
 */

/** D'où vient le lieu : trouvé sur la carte, repris d'un lieu appris, ou corrigé par l'utilisateur. */
export type PlaceSource = 'carte' | 'appris' | 'utilisateur';

const PLACE_SOURCES: readonly PlaceSource[] = ['carte', 'appris', 'utilisateur'];

/**
 * Un lieu nommé en un point. `name` nul : cherché, rien de nommé trouvé (la recherche ne se refait pas), ou
 * vidé par l'utilisateur. `lat` et `lon` : le point arrondi qui a servi à la recherche (`roundedPoint`).
 */
export interface PlaceSpot {
  name: string | null;
  source: PlaceSource;
  lat: number;
  lon: number;
}

/**
 * Lieu gardé dans la fiche : celui du départ, et `arrival`, celui de l'arrivée. `arrival` absent : pas encore
 * regardée (fiche plus ancienne, ou recherche interrompue) ; nul : arrivée à moins de `elsewhereM` du départ,
 * sans lieu à elle ; sinon le lieu de l'arrivée, qui ne se montre que s'il diffère de celui du départ.
 */
export interface SessionPlace extends PlaceSpot {
  arrival?: PlaceSpot | null;
}

/**
 * Lieu appris : un nom corrigé par l'utilisateur, retenu au point de départ (ou d'arrivée) de sa session ;
 * `savedAt`, l'instant de la correction, départage deux appareils. `replaces` : les anciens noms qu'il a
 * remplacés à cet endroit ; un de ces noms trouvé sur la carte à moins de `renameRadiusM` prend le sien.
 * Absent d'un fichier plus ancien ; une version qui ne le connaît pas le garde sans le lire, comme tout
 * champ inconnu.
 */
export interface LearnedPlace {
  name: string;
  lat: number;
  lon: number;
  savedAt: number;
  replaces?: string[];
}

/**
 * Distances du choix d'un lieu, en mètres : rayon où un plan d'eau nommé est retenu (`waterRadiusM`, aussi
 * le rayon demandé au service), rayon où une session prend un lieu appris (`learnedRadiusM`), distance
 * entre départ et arrivée à partir de laquelle l'arrivée compte comme un autre lieu (`elsewhereM`), rayon
 * où un lieu renommé renomme aussi les lieux du même nom des autres sessions (`renameRadiusM`) ; et nombre
 * d'objets demandés au service (`resultLimit`).
 */
export interface PlaceRules {
  waterRadiusM: number;
  learnedRadiusM: number;
  elsewhereM: number;
  renameRadiusM: number;
  resultLimit: number;
}

/**
 * Valeurs par défaut, passées en paramètre partout où elles servent. `renameRadiusM` vaut le double de
 * `waterRadiusM` : deux sessions qui ont trouvé le même plan d'eau sont chacune à `waterRadiusM` au plus de lui.
 */
export const PLACE_RULES: PlaceRules = {
  waterRadiusM: 1500,
  learnedRadiusM: 500,
  elsewhereM: 2000,
  renameRadiusM: 3000,
  resultLimit: 25,
};

/** Nom lisible : au moins une lettre, ni vide ni fait que de chiffres et de signes. */
export const isUsablePlaceName = (name: string | null | undefined): name is string =>
  typeof name === 'string' && /\p{L}/u.test(name);

/** Position lisible : latitude et longitude finies, dans leurs bornes. */
const isLatLon = (lat: unknown, lon: unknown): lat is number =>
  isFiniteNumber(lat) && isFiniteNumber(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** Lieu en un point relu, `null` s'il est mal formé. */
const readPlaceSpot = (raw: unknown): PlaceSpot | null => {
  if (!isObject(raw)) return null;
  const { name, source, lat, lon } = raw;
  if (!PLACE_SOURCES.includes(source as PlaceSource)) return null;
  if (!isLatLon(lat, lon)) return null;
  if (name !== null && typeof name !== 'string') return null;
  const trimmed = typeof name === 'string' ? name.trim() : null;
  return { name: isUsablePlaceName(trimmed) ? trimmed : null, source: source as PlaceSource, lat, lon: lon as number };
};

/**
 * Lieu relu dans la fiche, `null` s'il est absent ou mal formé (il sera cherché de nouveau). Une arrivée mal
 * formée est lue comme pas encore regardée.
 */
export const readSessionPlace = (raw: unknown): SessionPlace | null => {
  const spot = readPlaceSpot(raw);
  if (!spot || !isObject(raw)) return null;
  if (raw.arrival === null) return { ...spot, arrival: null };
  const arrival = readPlaceSpot(raw.arrival);
  return arrival ? { ...spot, arrival } : spot;
};

/**
 * Vrai si le lieu d'une session reste à trouver : jamais cherché, ou son arrivée pas encore regardée. La file
 * des lieux ne prend que ces sessions.
 */
export const isPlaceToFind = (place: SessionPlace | undefined): boolean => place === undefined || place.arrival === undefined;

/** Vrai si l'arrivée est assez loin du départ pour avoir son propre lieu (`rules.elsewhereM`). */
export const isElsewhere = (start: LatLon, end: LatLon | null, rules: PlaceRules): end is LatLon =>
  end !== null && haversineDistance(start.lat, start.lon, end.lat, end.lon) > rules.elsewhereM;

/** Le lieu appris le plus proche de `point`, à moins de `rules.learnedRadiusM` ; `null` s'il n'y en a pas. */
export const nearestLearnedPlace = (point: LatLon, learned: readonly LearnedPlace[], rules: PlaceRules): LearnedPlace | null => {
  let best: LearnedPlace | null = null;
  let bestD = rules.learnedRadiusM;
  for (const place of learned) {
    const d = haversineDistance(point.lat, point.lon, place.lat, place.lon);
    if (d < bestD) {
      best = place;
      bestD = d;
    }
  }
  return best;
};

/** Lieu d'une session pris d'un lieu appris, au point arrondi. */
export const learnedSpot = (place: LearnedPlace, point: LatLon): PlaceSpot => ({ name: place.name, source: 'appris', ...roundedPoint(point) });

/** Nom saisi pour un lieu : rogné, `null` s'il est vide ou sans lettre. */
const typedPlaceName = (text: string): string | null => {
  const trimmed = text.trim();
  return isUsablePlaceName(trimmed) ? trimmed : null;
};

/** Lieu corrigé en un point : le nom saisi, `source: 'utilisateur'` ; le même lieu si le nom ne change pas. */
const correctedSpot = (spot: PlaceSpot, text: string): PlaceSpot => {
  const name = typedPlaceName(text);
  return name === spot.name ? spot : { ...spot, name, source: 'utilisateur' };
};

/**
 * Lieu d'une session après « Lieu » : le départ prend `departure` ; l'arrivée, si elle a un lieu à elle,
 * `arrival` (absent : inchangée). Un nom vidé laisse le lieu sans nom, et le nom de la session à son
 * activité. `start` : le point de départ, pour une session dont le lieu n'a jamais été cherché. Rend
 * `current` si rien ne change.
 */
export const correctedPlace = (
  current: SessionPlace | undefined, start: LatLon, departure: string, arrival?: string
): SessionPlace => {
  // Jamais cherché : le lieu saisi, même vide, est celui de l'utilisateur, et le départ n'est plus cherché.
  const base: SessionPlace = current ?? { name: null, source: 'utilisateur', ...roundedPoint(start) };
  const head = correctedSpot(base, departure);
  const tail = base.arrival && arrival !== undefined ? correctedSpot(base.arrival, arrival) : base.arrival;
  if (current && head === base && tail === base.arrival) return current;
  const { arrival: _previous, ...spot } = base;
  return { ...spot, name: head.name, source: head.source, ...(tail === undefined ? {} : { arrival: tail }) };
};

type NamedSpot = PlaceSpot & { name: string };

/** Lieu en cours de saisie (« Lieu ») : celui du départ, et celui de l'arrivée quand elle a un lieu à elle (`null` sinon). */
export interface PlaceDraft {
  departure: string;
  arrival: string | null;
}

/** Saisie de départ d'après le lieu de la fiche : son nom, et celui de l'arrivée si elle est loin du départ. */
export const placeDraftOf = (place: SessionPlace | undefined): PlaceDraft => ({
  departure: place?.name ?? '',
  arrival: place?.arrival ? (place.arrival.name ?? '') : null,
});

/**
 * Lieux à apprendre d'une correction : chaque point dont le nom a été corrigé par l'utilisateur et n'est pas
 * vide (un lieu vidé n'apprend ni ne désapprend rien).
 */
export const placesToLearn = (before: SessionPlace | undefined, after: SessionPlace): NamedSpot[] => {
  const learned: NamedSpot[] = [];
  const changed = (a: PlaceSpot | null | undefined, b: PlaceSpot | null | undefined): b is NamedSpot =>
    !!b && b.source === 'utilisateur' && b.name !== null && (a?.name !== b.name || a?.source !== 'utilisateur');
  if (changed(before, after)) learned.push(after);
  if (changed(before?.arrival, after.arrival)) learned.push(after.arrival);
  return learned;
};

/** Noms distincts de `names`, sans `name` lui-même. */
const otherNames = (names: readonly string[], name: string): string[] => [...new Set(names)].filter((n) => n !== name);

/**
 * Lieux appris après une correction en `spot` : ceux à moins de `rules.learnedRadiusM` sont remplacés (corriger
 * deux fois au même endroit ne garde que la dernière), le nouveau en tête ; `replaces`, les anciens noms qu'il
 * remplace (absent s'il n'y en a pas).
 */
export const learnPlace = (
  learned: readonly LearnedPlace[], spot: NamedSpot, rules: PlaceRules, nowMs: number, replaces: readonly string[] = []
): LearnedPlace[] => {
  const names = otherNames(replaces, spot.name);
  return [
    { name: spot.name, lat: spot.lat, lon: spot.lon, savedAt: nowMs, ...(names.length > 0 ? { replaces: names } : {}) },
    ...learned.filter((p) => haversineDistance(p.lat, p.lon, spot.lat, spot.lon) >= rules.learnedRadiusM),
  ];
};

/** Un nom de lieu changé par « Lieu » : `from` devient `to`, au point arrondi du lieu corrigé. */
export interface PlaceRename {
  from: string;
  to: string;
  lat: number;
  lon: number;
}

/**
 * Noms changés par une correction : chaque point (départ, arrivée) dont un nom non vide devient un autre nom
 * non vide. Un lieu vidé ne renomme rien.
 */
export const placeRenames = (before: SessionPlace | undefined, after: SessionPlace): PlaceRename[] => {
  const renames: PlaceRename[] = [];
  const add = (a: PlaceSpot | null | undefined, b: PlaceSpot | null | undefined): void => {
    if (a?.name && b?.name && a.name !== b.name) renames.push({ from: a.name, to: b.name, lat: b.lat, lon: b.lon });
  };
  add(before, after);
  add(before?.arrival, after.arrival);
  return renames;
};

/**
 * Changement de nom qui vaut pour un lieu nommé `name` en `point` : celui dont l'ancien nom s'écrit exactement
 * pareil (accents et casse compris) et dont le point est à moins de `rules.renameRadiusM`, le plus proche ;
 * départs et arrivées se répondent dans les deux sens. `null` sinon.
 */
const renameFor = (name: string | null, point: LatLon, renames: readonly PlaceRename[], rules: PlaceRules): PlaceRename | null => {
  let best: PlaceRename | null = null;
  let bestD = rules.renameRadiusM;
  for (const r of renames) {
    if (r.from !== name) continue;
    const d = haversineDistance(point.lat, point.lon, r.lat, r.lon);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
};

/** Lieu en un point renommé (`renameFor`) : `appris`, sauf corrigé par l'utilisateur, qui le reste ; le même s'il ne bouge pas. */
const renamedSpot = <T extends PlaceSpot>(spot: T, renames: readonly PlaceRename[], rules: PlaceRules): T => {
  const r = renameFor(spot.name, spot, renames, rules);
  return r ? { ...spot, name: r.to, source: spot.source === 'utilisateur' ? 'utilisateur' : 'appris' } : spot;
};

/**
 * Lieu d'une autre session après une correction : son départ et son arrivée prennent le nouveau nom s'ils
 * portaient exactement l'ancien, à moins de `rules.renameRadiusM` du lieu corrigé ; un autre nom, même tout
 * près, ne bouge pas. Rend `place` si rien ne change.
 */
export const renamedPlace = (place: SessionPlace, renames: readonly PlaceRename[], rules: PlaceRules): SessionPlace => {
  const head = renamedSpot(place, renames, rules);
  const arrival = place.arrival ? renamedSpot(place.arrival, renames, rules) : place.arrival;
  if (head === place && arrival === place.arrival) return place;
  return { ...head, ...(arrival === undefined ? {} : { arrival }) };
};

/**
 * Lieux appris après une correction : ceux qui portaient exactement l'ancien nom, à moins de
 * `rules.renameRadiusM`, prennent le nouveau, datés de `nowMs` (la fusion entre appareils garde le plus
 * récent) et retiennent l'ancien nom dans `replaces`. Rend `learned` si rien ne change.
 */
export const renamedLearnedPlaces = (
  learned: readonly LearnedPlace[], renames: readonly PlaceRename[], rules: PlaceRules, nowMs: number
): readonly LearnedPlace[] => {
  let changed = false;
  const list = learned.map((p) => {
    const r = renameFor(p.name, p, renames, rules);
    if (!r) return p;
    changed = true;
    return { ...p, name: r.to, savedAt: nowMs, replaces: otherNames([r.from, ...(p.replaces ?? [])], r.to) };
  });
  return changed ? list : learned;
};

/**
 * Lieux appris après « Lieu » : les lieux appris de l'ancien nom renommés (`renamedLearnedPlaces`), puis chaque
 * nom corrigé appris à son point (`learnPlace`), qui retient l'ancien nom de ce point et ceux que retenaient les
 * lieux appris du même nom qu'il remplace : un nom de la carte remplacé deux fois mène au dernier.
 */
export const learnedAfterCorrection = (
  learned: readonly LearnedPlace[], before: SessionPlace | undefined, after: SessionPlace, rules: PlaceRules, nowMs: number
): readonly LearnedPlace[] => {
  const renames = placeRenames(before, after);
  let list = renamedLearnedPlaces(learned, renames, rules, nowMs);
  for (const spot of placesToLearn(before, after)) {
    const replaced = [
      ...renames.filter((r) => r.to === spot.name && r.lat === spot.lat && r.lon === spot.lon).map((r) => r.from),
      ...list
        .filter((p) => p.name === spot.name && haversineDistance(p.lat, p.lon, spot.lat, spot.lon) < rules.learnedRadiusM)
        .flatMap((p) => p.replaces ?? []),
    ];
    list = learnPlace(list, spot, rules, nowMs, replaced);
  }
  return list;
};

/**
 * Lieu appris qui remplace `name`, trouvé sur la carte en `point` : celui qui retient exactement ce nom dans
 * `replaces`, à moins de `rules.renameRadiusM`, le plus proche ; `null` sinon.
 */
export const learnedReplacing = (
  name: string | null, point: LatLon, learned: readonly LearnedPlace[], rules: PlaceRules
): LearnedPlace | null => {
  if (name === null) return null;
  let best: LearnedPlace | null = null;
  let bestD = rules.renameRadiusM;
  for (const p of learned) {
    if (!p.replaces?.includes(name)) continue;
    const d = haversineDistance(point.lat, point.lon, p.lat, p.lon);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
};

/**
 * Étiquettes OpenStreetMap d'un plan d'eau nommé, `clé` ou `clé:valeur` : plage, baie, marina, port,
 * étang ou lac.
 */
const WATER_TAGS: ReadonlySet<string> = new Set([
  'natural:beach', 'natural:bay', 'natural:water', 'leisure:marina', 'leisure:beach_resort', 'landuse:harbour',
  'harbour', 'water:lake', 'water:lagoon', 'water:pond', 'water:reservoir',
]);

/** Étiquettes d'une localité dont le nom vaut pour la commune. */
const TOWN_VALUES: ReadonlySet<string> = new Set(['city', 'town', 'village', 'hamlet']);

const isWater = (f: PhotonFeature): boolean =>
  f.osmKey !== null && (WATER_TAGS.has(f.osmKey) || (f.osmValue !== null && WATER_TAGS.has(`${f.osmKey}:${f.osmValue}`)));

/** Nom de commune d'un objet : le sien si c'est une localité, sinon sa commune. */
const townOf = (f: PhotonFeature): string | null =>
  f.osmKey === 'place' && f.osmValue !== null && TOWN_VALUES.has(f.osmValue) && isUsablePlaceName(f.name) ? f.name : f.city;

/**
 * Lieu retenu parmi les objets rendus autour de `start` : le plan d'eau nommé le plus proche, à
 * `rules.waterRadiusM` au plus ; sinon la commune de l'objet le plus proche qui en a une ; sinon `null`.
 * Un nom vide ou sans lettre est écarté.
 */
export const choosePlace = (features: readonly PhotonFeature[], start: LatLon, rules: PlaceRules): string | null => {
  const byDistance = features
    .map((f) => ({ f, d: haversineDistance(start.lat, start.lon, f.lat, f.lon) }))
    .sort((a, b) => a.d - b.d);
  for (const { f, d } of byDistance) {
    if (d <= rules.waterRadiusM && isWater(f) && isUsablePlaceName(f.name)) return f.name.trim();
  }
  for (const { f } of byDistance) {
    const town = townOf(f);
    if (isUsablePlaceName(town)) return town.trim();
  }
  return null;
};

/** Lieu à ranger dans la fiche après une recherche autour de `start` : le nom choisi, la position arrondie envoyée. */
export const foundPlace = (name: string | null, start: LatLon): SessionPlace => ({ name, source: 'carte', ...roundedPoint(start) });

/**
 * Premier point de la trace d'un GPX, lu sans tout analyser : la première balise `<trkpt>` qui porte une
 * latitude et une longitude lisibles. `null` sans point.
 */
export const firstTrackPoint = (gpxText: string): LatLon | null => {
  const pattern = /<(?:\w+:)?trkpt\b([^>]*)>/g;
  for (let m = pattern.exec(gpxText); m !== null; m = pattern.exec(gpxText)) {
    const point = pointOfAttributes(m[1]);
    if (point) return point;
  }
  return null;
};

/** Position lue dans les attributs d'une balise `<trkpt>`, `null` si elle ne se lit pas. */
const pointOfAttributes = (attributes: string): LatLon | null => {
  const attr = (name: string): number => {
    const found = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(attributes);
    return found ? Number(found[1]) : NaN;
  };
  const lat = attr('lat');
  const lon = attr('lon');
  return isLatLon(lat, lon) ? { lat, lon } : null;
};

/**
 * Dernier point de la trace d'un GPX, cherché depuis la fin sans tout analyser : la dernière balise `<trkpt>`
 * qui porte une position lisible. `null` sans point.
 */
export const lastTrackPoint = (gpxText: string): LatLon | null => {
  const tag = /<(?:\w+:)?trkpt\b([^>]*)>/y;
  for (let at = gpxText.lastIndexOf('trkpt'); at > 0; at = gpxText.lastIndexOf('trkpt', at - 1)) {
    const open = gpxText.lastIndexOf('<', at);
    if (open < 0) break;
    tag.lastIndex = open;
    const m = tag.exec(gpxText);
    const point = m ? pointOfAttributes(m[1]) : null;
    if (point) return point;
  }
  return null;
};

/** Premier et dernier point d'une trace. */
export interface TrackEnds {
  start: LatLon;
  end: LatLon | null;
}

/** Départ et arrivée d'un GPX (`firstTrackPoint`, `lastTrackPoint`), `null` sans point. */
export const trackEnds = (gpxText: string): TrackEnds | null => {
  const start = firstTrackPoint(gpxText);
  return start ? { start, end: lastTrackPoint(gpxText) } : null;
};
