import { isObject, parseJson } from '../core/basics';
import { isSportType } from '../core/sportProfiles';
import { LEARNED_PLACES_FILE, RESTING_HR_FILE, settingsPath } from './folderLayout';
import { learnedPlacesFileText, mergeLearnedPlaces, parseLearnedPlacesFile, sameLearnedPlaces } from './learnedPlaces';
import { PLACE_RULES, type LearnedPlace, type PlaceRules } from './places';
import {
  isNewerRestingHrFile, mergeRestingResults, parseRestingHrFile, restingHrFileText, sameRestingResults, type StoredRestingResult,
} from './restingHrStore';
import { SETTINGS_VERSION, parseSettingsFile, type SettingsFile } from './settingsFile';
import { SYNC_SIDES, otherSyncSide, type SyncSideName } from './syncBase';

/**
 * Ce que la synchronisation transporte à côté des sessions : les fichiers de réglages de chaque appareil
 * (`reglages/*.json`), les tests de FC repos (`fc-repos.json`) et les lieux appris (`lieux.json`). Plan pur, refait
 * en entier à chaque synchronisation d'après ce que les deux dossiers contiennent : une reprise après une coupure
 * ne refait que ce qui manque, sans base à tenir. Rien n'est jamais supprimé, d'aucun côté.
 *
 * Fichiers de réglages : recopiés comme des fichiers, jamais adoptés. Aucune valeur de réglage d'un appareil ne
 * change : les réglages reçus sont seulement proposés par l'appareil qui les reçoit, et ne s'adoptent que sur la
 * réponse de l'utilisateur.
 * - Un fichier que l'autre côté n'a pas lui est recopié, sauf s'il ne se lit pas, s'il porte l'identifiant de
 *   l'appareil qui le recevrait (chaque appareil écrit seul son fichier), ou si ce côté a déjà, sous un autre nom,
 *   un fichier du même appareil au moins aussi récent (appareil renommé : l'ancien nom ne revient pas ; renommé sans
 *   autre changement, à même date, aucun des deux noms ne voyage avant le changement suivant de ses réglages).
 * - Même nom des deux côtés, appareils différents : rien n'est écrasé, c'est dit.
 * - Même nom, même appareil, contenus différents : aucune date ne désigne le gagnant. Le fichier d'un appareil n'est
 *   écrit que par cet appareil, la copie de l'autre côté ne fait que le suivre : le fichier propre de l'ordinateur
 *   remplace la copie du téléphone ; celui de tout autre appareil, la copie du téléphone remplace celle de
 *   l'ordinateur. La date d'un fichier peut reculer (téléphone neuf qui a repris la date d'un fichier de
 *   l'ordinateur, horloge du téléphone remise en arrière) : la comparer laisserait une copie ancienne de
 *   l'ordinateur écraser le fichier propre du téléphone.
 * - Même nom sans pouvoir dire quel appareil a écrit les deux copies (aucune ne porte d'identifiant d'appareil, ou
 *   l'identifiant de l'ordinateur est inconnu) : on ne conclut pas au même appareil, rien n'est écrasé, c'est dit.
 * - Un fichier qui ne se lit pas n'est ni recopié ni écrasé ; un fichier d'une version plus récente n'est jamais
 *   écrasé (il peut être recopié là où il manque : rien n'est réécrit).
 *
 * Tests de FC repos et lieux appris : fondus par les fonctions de l'appareil (`mergeRestingResults`,
 * `mergeLearnedPlaces`), l'ordinateur passant d'abord, et écrits seulement du côté où le résultat diffère. Un fichier
 * illisible ou d'une version plus récente, d'un côté, n'est ni réécrit ni fondu : rien ne s'écrit d'aucun côté pour
 * ce fichier, c'est dit.
 */

/** Un fichier tel qu'un côté le montre : son nom, son texte (`null` s'il n'a pas pu être lu). */
export interface SyncNamedText {
  name: string;
  text: string | null;
}

export interface SyncExtrasInput {
  /** Fichiers de `reglages/` de chaque côté. */
  settings: Record<SyncSideName, readonly SyncNamedText[]>;
  /** Texte de `fc-repos.json` de chaque côté, `null` s'il manque. */
  restingHr: Record<SyncSideName, string | null>;
  /** Texte de `lieux.json` de chaque côté, `null` s'il manque. */
  places: Record<SyncSideName, string | null>;
  /** Identifiant de l'ordinateur (`device.id` de son fichier de réglages) ; inconnu : aucun fichier de même nom des deux côtés n'est remplacé. */
  computerDeviceId?: string | null;
  placeRules?: PlaceRules;
}

/** Sorte de fichier transporté. */
export type SyncExtraKind = 'settings' | 'restingHr' | 'places';

/**
 * Une écriture : `text` dans `path` (chemin depuis la racine du dossier) du côté `to`. `replaces` : le texte que le
 * fichier doit encore avoir au moment d'écrire (`null` : il ne doit pas exister) ; sinon l'écriture est abandonnée.
 * `added` : pour une fonte, le nombre d'entrées que ce côté n'avait pas.
 */
export interface SyncExtraOp {
  kind: SyncExtraKind;
  to: SyncSideName;
  path: string;
  text: string;
  replaces: string | null;
  added: number;
}

/**
 * Pourquoi un fichier est laissé : même nom et autre appareil (`otherDevice`), illisible (`unreadable`), d'une
 * version plus récente (`newer`), portant l'identifiant de l'appareil qui le recevrait (`ownFile`), déjà là sous un
 * autre nom dans une version au moins aussi récente (`outdated`), même nom sans qu'on puisse dire quel appareil a
 * écrit les deux copies (`unknownDevice`). L'exécutant y ajoute : changé depuis sa lecture (`changed`), erreur en
 * l'écrivant (`failed`).
 */
export type SyncExtraLeftReason = 'otherDevice' | 'unreadable' | 'newer' | 'ownFile' | 'outdated' | 'unknownDevice' | 'changed' | 'failed';

export interface SyncExtraLeft {
  kind: SyncExtraKind;
  path: string;
  /** Le côté du fichier en cause ; `null` : les deux. */
  side: SyncSideName | null;
  reason: SyncExtraLeftReason;
}

export interface SyncExtrasPlan {
  ops: SyncExtraOp[];
  left: SyncExtraLeft[];
}

interface SettingsCopy {
  name: string;
  text: string;
  file: SettingsFile | null;
}

/** Fichiers de réglages lisibles ou non d'un côté, rangés par nom sans majuscules (les deux systèmes de fichiers les confondent). */
const byLowerName = (files: readonly SyncNamedText[]): Map<string, SettingsCopy> => {
  const map = new Map<string, SettingsCopy>();
  for (const f of files) {
    if (f.text === null || !/\.json$/i.test(f.name)) continue;
    map.set(f.name.toLowerCase(), { name: f.name, text: f.text, file: parseSettingsFile(f.text) });
  }
  return map;
};

const deviceOf = (file: SettingsFile): string | null => file.device?.id ?? null;

const planSettings = (input: SyncExtrasInput, plan: SyncExtrasPlan): void => {
  const own = input.computerDeviceId ?? null;
  const sides: Record<SyncSideName, Map<string, SettingsCopy>> = {
    computer: byLowerName(input.settings.computer), phone: byLowerName(input.settings.phone),
  };
  const names = [...new Set([...sides.computer.keys(), ...sides.phone.keys()])].sort();
  const leave = (path: string, side: SyncSideName | null, reason: SyncExtraLeftReason): void => {
    plan.left.push({ kind: 'settings', path, side, reason });
  };
  const write = (to: SyncSideName, name: string, source: SettingsCopy, replaces: string | null): void => {
    plan.ops.push({ kind: 'settings', to, path: settingsPath(name), text: source.text, replaces, added: 0 });
  };
  for (const key of names) {
    const copies = { computer: sides.computer.get(key) ?? null, phone: sides.phone.get(key) ?? null };
    if (copies.computer && copies.phone) {
      const c = copies.computer;
      const p = copies.phone;
      if (c.text === p.text) continue;
      if (!c.file || !p.file) {
        leave(settingsPath(c.name), !c.file && !p.file ? null : !c.file ? 'computer' : 'phone', 'unreadable');
        continue;
      }
      const device = deviceOf(c.file);
      const phoneDevice = deviceOf(p.file);
      if (device === null && phoneDevice === null) {
        leave(settingsPath(c.name), null, 'unknownDevice');
        continue;
      }
      if (device !== phoneDevice) {
        leave(settingsPath(c.name), null, 'otherDevice');
        continue;
      }
      // Sans l'identifiant de l'ordinateur, ce fichier peut être le sien comme celui du téléphone : aucun ne suit l'autre.
      if (own === null) {
        leave(settingsPath(c.name), null, 'unknownDevice');
        continue;
      }
      const winner: SyncSideName = device === own ? 'computer' : 'phone';
      const loser = otherSyncSide(winner);
      const target = copies[loser] as SettingsCopy;
      if ((target.file as SettingsFile).version > SETTINGS_VERSION) {
        leave(settingsPath(target.name), loser, 'newer');
        continue;
      }
      write(loser, target.name, copies[winner] as SettingsCopy, target.text);
      continue;
    }
    const from: SyncSideName = copies.computer ? 'computer' : 'phone';
    const to = otherSyncSide(from);
    const source = copies[from] as SettingsCopy;
    if (!source.file) {
      leave(settingsPath(source.name), from, 'unreadable');
      continue;
    }
    const device = deviceOf(source.file);
    if (to === 'computer' && own !== null && device === own) {
      leave(settingsPath(source.name), from, 'ownFile');
      continue;
    }
    // Appareil renommé : l'autre côté a déjà, sous son nouveau nom, une version au moins aussi récente.
    const sameDevice = device !== null && [...sides[to].values()].some((f) => f.file && deviceOf(f.file) === device && f.file.savedAt >= (source.file as SettingsFile).savedAt);
    if (sameDevice) {
      leave(settingsPath(source.name), from, 'outdated');
      continue;
    }
    write(to, source.name, source, null);
  }
};

/** Un fichier fondu relu d'un côté : absent, lisible (sa liste), illisible ou d'une version plus récente. */
type RootReadable<T> = { state: 'absent' | 'ok'; list: T[]; text: string | null };
type RootRead<T> = RootReadable<T> | { state: 'unreadable' | 'newer' };

const isReadable = <T,>(r: RootRead<T>): r is RootReadable<T> => r.state === 'absent' || r.state === 'ok';

interface RootRules<T> {
  kind: SyncExtraKind;
  path: string;
  read: (text: string | null) => RootRead<T>;
  merge: (computer: readonly T[], phone: readonly T[]) => T[];
  same: (a: readonly T[], b: readonly T[]) => boolean;
  textOf: (list: readonly T[]) => string;
  keyOf: (item: T) => string;
}

const planRoot = <T,>(texts: Record<SyncSideName, string | null>, rules: RootRules<T>, plan: SyncExtrasPlan): void => {
  const computer = rules.read(texts.computer);
  const phone = rules.read(texts.phone);
  const read = { computer, phone };
  for (const side of SYNC_SIDES) {
    const r = read[side];
    if (r.state === 'unreadable' || r.state === 'newer') plan.left.push({ kind: rules.kind, path: rules.path, side, reason: r.state });
  }
  if (!isReadable(computer) || !isReadable(phone)) return;
  const sides: Record<SyncSideName, RootReadable<T>> = { computer, phone };
  const merged = rules.merge(sides.computer.list, sides.phone.list);
  for (const side of SYNC_SIDES) {
    const r = sides[side];
    if (r.state === 'absent' ? merged.length === 0 : rules.same(merged, r.list)) continue;
    const had = new Set(r.list.map(rules.keyOf));
    const added = merged.filter((item) => !had.has(rules.keyOf(item))).length;
    plan.ops.push({ kind: rules.kind, to: side, path: rules.path, text: rules.textOf(merged), replaces: r.text, added });
  }
};

const restingRules: RootRules<StoredRestingResult> = {
  kind: 'restingHr',
  path: RESTING_HR_FILE,
  read: (text) => {
    if (text === null) return { state: 'absent', list: [], text };
    if (isNewerRestingHrFile(text)) return { state: 'newer' };
    const list = parseRestingHrFile(text);
    return list === null ? { state: 'unreadable' } : { state: 'ok', list, text };
  },
  merge: mergeRestingResults,
  same: sameRestingResults,
  textOf: restingHrFileText,
  keyOf: (r) => String(r.startedAtMs),
};

const placesRules = (rules: PlaceRules): RootRules<LearnedPlace> => ({
  kind: 'places',
  path: LEARNED_PLACES_FILE,
  read: (text) => {
    if (text === null) return { state: 'absent', list: [], text };
    const file = parseLearnedPlacesFile(text);
    if (file === null) return { state: 'unreadable' };
    return file.writable ? { state: 'ok', list: file.places, text } : { state: 'newer' };
  },
  merge: (computer, phone) => mergeLearnedPlaces(computer, phone, rules),
  same: sameLearnedPlaces,
  textOf: learnedPlacesFileText,
  keyOf: (p) => JSON.stringify([p.name, p.lat, p.lon, p.savedAt]),
});

/** Plan des fichiers de réglages, des tests de FC repos et des lieux appris, d'après ce que les deux côtés tiennent. */
export const planSyncExtras = (input: SyncExtrasInput): SyncExtrasPlan => {
  const plan: SyncExtrasPlan = { ops: [], left: [] };
  planSettings(input, plan);
  planRoot(input.restingHr, restingRules, plan);
  planRoot(input.places, placesRules(input.placeRules ?? PLACE_RULES), plan);
  return plan;
};

/**
 * Activité d'une fiche que l'appareil qui la reçoit ne connaît pas : son identifiant, s'il n'est ni dans `known`
 * (les identifiants des activités de cet appareil) ni celui d'un calcul (toujours reconnu : l'activité de base) ;
 * `null` sinon, ou si la fiche ne nomme aucune activité.
 */
export const unknownSyncActivity = (recordText: string, known: readonly string[]): string | null => {
  const record = parseJson(recordText);
  const id = isObject(record) ? record.activityId : undefined;
  if (typeof id !== 'string' || id === '' || isSportType(id) || known.includes(id)) return null;
  return id;
};
