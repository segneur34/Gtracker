import { XML } from '../core/appIdentity';
import { escapeXmlText } from '../core/xml';
import { sortMarks, type SessionMark } from '../core/sessionMarks';
import { base64ToBytes, bytesToBase64 } from '../core/base64';
import { LEGACY_BUNDLE, parseImportedRecord } from './legacyImport';
import { isWritableRecord, serializeRecord, type RecordUnreadable, type RecordWithoutSummary, type SessionRecord } from './record';

/**
 * GPX complet d'une session, pour la passer d'un appareil à l'autre en un seul
 * fichier : sa fiche (séances du compteur, nom, notes, réglages) et ses
 * capteurs (`.imu`) voyagent dans une extension posée juste avant `</gpx>`.
 * Les points ne sont pas touchés ; les autres applications, comme notre
 * lecteur (`core/gpxParser.ts`, qui ne lit que `trk`), ignorent ce bloc.
 * Une session nommée porte son nom dans `<metadata><name>` et `<trk><name>`,
 * ce que montrent les autres applications (Strava, Komoot), et ses repères
 * du bouton « Note » en `<wpt>`, avant la trace : les textes remplacés ou les
 * éléments ajoutés sont notés dans le bloc (élément `edit`).
 * À l'import, tout est défait à l'identique : la mémoire range le GPX
 * d'origine, octet pour octet. Un paquet sans ces notes se relit tel quel.
 * Le bloc de l'ancienne application, sous son préfixe, se lit à défaut du
 * nôtre (`library/legacyImport.ts`).
 */

/** Préfixe des éléments du bloc et son ouverture (`core/appIdentity.ts`). */
const PREFIX = XML.session.prefix;
const OPEN = `<extensions><${PREFIX}:session xmlns:${PREFIX}="${XML.session.ns}" version="1">`;
const closeOf = (prefix: string): string => `</${prefix}:session></extensions>`;
/** Élément `name` du bloc sous le préfixe `prefix`, et son contenu. */
const elementPattern = (prefix: string, name: string, attributes = ''): RegExp =>
  new RegExp(`<${prefix}:${name}${attributes}>([\\s\\S]*?)<\\/${prefix}:${name}>`, 'g');

const unescapeXml = (text: string): string => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export interface UnbundledGpx {
  /** Le GPX tel qu'il était avant l'empaquetage. */
  gpx: string;
  /**
   * Fiche du paquet, `null` sans paquet, illisible ou écrite par une version
   * plus récente ; son résumé, refait à l'import, peut manquer.
   */
  record: RecordWithoutSummary | null;
  /**
   * Champs de la fiche du paquet que cette version ne sait pas lire (`parseRecordWithRaw`), à
   * réécrire tels quels avec elle ; vide sans fiche.
   */
  unreadable: RecordUnreadable;
  /**
   * Texte de la fiche du paquet, telle qu'empaquetée, `null` s'il n'en porte pas : à ranger au caractère
   * près si on ne sait pas la réécrire (`record` nul, `recordToKeep` de la bibliothèque).
   */
  recordText: string | null;
  /** Capteurs du paquet, `null` s'il n'en porte pas ; tels qu'empaquetés (ceux de l'ancienne application se convertissent à l'import). */
  motion: Uint8Array | null;
  /** Sport de la fiche du paquet que Gtracker ne range pas (`parseImportedRecord`), `null` sinon. */
  otherSport: string | null;
}

/**
 * Retouche du GPX empaquetée : à la position `at` du GPX empaqueté, `length`
 * caractères remplacent le texte d'origine `original` (vide pour un ajout).
 */
interface GpxEdit {
  at: number;
  length: number;
  original: string;
}

/** Nom d'abord : le premier enfant de `<metadata>` et de `<trk>`, selon le schéma GPX 1.1. */
const LEADING_NAME = /^\s*<name>([\s\S]*?)<\/name>/;

/**
 * Repères en points de passage, nommés comme dans l'analyse : leur nom, sinon « Note N ». Un repère à
 * l'heure seule n'en a pas, faute de position : il reste dans la fiche, en extension.
 */
const waypoints = (marks: readonly SessionMark[]): string =>
  sortMarks(marks).map((m, k) => (m.lat === null || m.lon === null ? ''
    : `<wpt lat="${m.lat}" lon="${m.lon}"><time>${new Date(m.timeMs).toISOString()}</time>`
      + `<name>${escapeXmlText(m.label ?? `Note ${k + 1}`)}</name></wpt>`)).join('');

/**
 * Nom de la session écrit dans `<metadata>` (créé s'il manque) et dans la
 * première `<trk>`, repères en `<wpt>` juste avant la première route ou
 * trace, à leur place dans le schéma GPX 1.1 : le GPX retouché et les
 * retouches, dans l'ordre du texte.
 */
const retouchGpx = (gpx: string, name: string | null, marks: readonly SessionMark[]): { gpx: string; edits: GpxEdit[] } => {
  /** Retouches sur le GPX d'origine : `from`..`to` remplacé par `insert`. */
  const changes: { from: number; to: number; insert: string }[] = [];
  const points = waypoints(marks);
  if (points !== '') {
    const first = /<(rte|trk)[\s>]/.exec(gpx);
    if (first) changes.push({ from: first.index, to: first.index, insert: points });
  }
  if (name !== null) writeName(gpx, escapeXmlText(name), changes);

  let out = '';
  let cursor = 0;
  const edits: GpxEdit[] = [];
  for (const c of changes.sort((a, b) => a.from - b.from)) {
    out += gpx.slice(cursor, c.from);
    edits.push({ at: out.length, length: c.insert.length, original: gpx.slice(c.from, c.to) });
    out += c.insert;
    cursor = c.to;
  }
  return { gpx: out + gpx.slice(cursor), edits };
};

/** Retouches du nom (`text`, déjà échappé), ajoutées à `changes`. */
const writeName = (gpx: string, text: string, changes: { from: number; to: number; insert: string }[]): void => {
  /** Le nom en tête de l'élément ouvert juste avant `at` : remplacé s'il y est, ajouté sinon. */
  const nameAfter = (at: number) => {
    const found = LEADING_NAME.exec(gpx.slice(at));
    if (found) {
      const from = at + found[0].length - found[1].length - '</name>'.length;
      changes.push({ from, to: from + found[1].length, insert: text });
    } else {
      changes.push({ from: at, to: at, insert: `<name>${text}</name>` });
    }
  };
  const metadata = /<metadata(\s[^>]*)?>/.exec(gpx);
  if (metadata) {
    if (!metadata[0].endsWith('/>')) nameAfter(metadata.index + metadata[0].length);
  } else {
    const root = /<gpx(\s[^>]*)?>/.exec(gpx);
    if (root && !root[0].endsWith('/>')) {
      const at = root.index + root[0].length;
      changes.push({ from: at, to: at, insert: `<metadata><name>${text}</name></metadata>` });
    }
  }
  const trk = /<trk(\s[^>]*)?>/.exec(gpx);
  if (trk && !trk[0].endsWith('/>')) nameAfter(trk.index + trk[0].length);
};

/**
 * GPX empaqueté avec sa fiche et ses capteurs. `unreadable` : champs de la fiche illisibles à sa
 * lecture, écrits tels quels (`serializeRecord`). Un GPX sans `</gpx>` est rendu tel quel.
 */
export const bundleSessionGpx = (gpx: string, record: SessionRecord, motion: Uint8Array | null, unreadable?: RecordUnreadable): string => {
  if (gpx.lastIndexOf('</gpx>') < 0) return gpx;
  const named = retouchGpx(gpx, record.name?.trim() || null, record.marks ?? []);
  const at = named.gpx.lastIndexOf('</gpx>');
  const block = OPEN
    + `<${PREFIX}:record>${escapeXmlText(serializeRecord(record, unreadable))}</${PREFIX}:record>`
    + (motion ? `<${PREFIX}:imu>${bytesToBase64(motion)}</${PREFIX}:imu>` : '')
    + named.edits.map((e) => `<${PREFIX}:edit at="${e.at}" length="${e.length}">${escapeXmlText(e.original)}</${PREFIX}:edit>`).join('')
    + closeOf(PREFIX);
  return named.gpx.slice(0, at) + block + named.gpx.slice(at);
};

/**
 * Retouches (nom, repères) défaites, de la dernière à la première. Le GPX
 * rendu doit redonner exactement le texte reçu une fois retouché de nouveau
 * avec le nom et les repères de la fiche (`record`) : sinon le texte a changé
 * en route (fins de ligne passées en CRLF, réindentation), les positions ne
 * tombent plus juste, et le GPX est gardé tel que reçu, qui reste lisible.
 * Sans fiche lisible, de même. `prefix` : celui des éléments du bloc.
 */
const undoEdits = (gpx: string, body: string, prefix: string, record: Pick<RecordWithoutSummary, 'name' | 'marks'> | null): string => {
  const edits = [...body.matchAll(elementPattern(prefix, 'edit', ' at="(\\d+)" length="(\\d+)"'))]
    .map((m) => ({ at: Number(m[1]), length: Number(m[2]), original: unescapeXml(m[3]) }));
  if (edits.length === 0 || !record) return gpx;
  let out = gpx;
  let limit = gpx.length;
  for (const e of edits.reverse()) {
    if (e.at + e.length > limit) return gpx;
    out = out.slice(0, e.at) + e.original + out.slice(e.at + e.length);
    limit = e.at;
  }
  return retouchGpx(out, record.name?.trim() || null, record.marks ?? []).gpx === gpx ? out : gpx;
};

/** Le dernier bloc du texte : le nôtre, à défaut celui de l'ancienne application ; `null` sans bloc ou sans sa fin. */
const findBlock = (text: string): { prefix: string; start: number; bodyStart: number; end: number; close: string } | null => {
  const ownStart = text.lastIndexOf(OPEN);
  if (ownStart >= 0) {
    const close = closeOf(PREFIX);
    const end = text.indexOf(close, ownStart);
    return end < 0 ? null : { prefix: PREFIX, start: ownStart, bodyStart: ownStart + OPEN.length, end, close };
  }
  const legacy = [...text.matchAll(LEGACY_BUNDLE.open)].pop();
  if (!legacy) return null;
  const close = closeOf(LEGACY_BUNDLE.prefix);
  const bodyStart = legacy.index + legacy[0].length;
  const end = text.indexOf(close, bodyStart);
  return end < 0 ? null : { prefix: LEGACY_BUNDLE.prefix, start: legacy.index, bodyStart, end, close };
};

/** Retire le paquet d'un GPX et rend ce qu'il portait. Un bloc abîmé est retiré, puis ignoré. */
export const unbundleSessionGpx = (text: string): UnbundledGpx => {
  const block = findBlock(text);
  if (!block) return { gpx: text, record: null, unreadable: {}, recordText: null, motion: null, otherSport: null };
  const { prefix, start, bodyStart, end, close } = block;
  const body = text.slice(bodyStart, end);
  const escapedRecord = elementPattern(prefix, 'record').exec(body)?.[1];
  const recordText = escapedRecord === undefined ? null : unescapeXml(escapedRecord);
  // Fiche de cette version ou de l'ancienne application (`parseImportedRecord`).
  const read = recordText === null ? null : parseImportedRecord(recordText);
  const parsed = read?.parsed && isWritableRecord(read.parsed.parts) ? read.parsed : null;
  // Une fiche d'une version plus récente dit aussi le nom et les repères écrits dans le GPX.
  const gpx = undoEdits(text.slice(0, start) + text.slice(end + close.length), body, prefix, read?.parsed?.parts ?? null);
  const imuText = new RegExp(`<${prefix}:imu>([A-Za-z0-9+/=\\s]*)<\\/${prefix}:imu>`).exec(body)?.[1];
  let motion: Uint8Array | null = null;
  try {
    motion = imuText ? base64ToBytes(imuText.replace(/\s/g, '')) : null;
  } catch {
    motion = null;
  }
  return { gpx, record: parsed?.parts ?? null, unreadable: parsed?.unreadable ?? {}, recordText, motion, otherSport: read?.otherSport ?? null };
};
