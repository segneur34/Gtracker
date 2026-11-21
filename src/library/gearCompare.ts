import { readActivities } from '../core/activities';
import { isObject, newId } from '../core/basics';
import { cleanGearMerged, cleanGearName, gearNameKey, sanitizeGearGroups, withMergedRefs } from './gearMatch';
import type { GearGroup, GearItem, GearMergedRef } from './notes';

/**
 * Matériel de deux appareils comparé, pur : la liste de l'ordinateur (`pc`) et
 * celle du téléphone (`phone`), lue dans son fichier de réglages. Sur le
 * téléphone, qui reprend la liste de l'ordinateur, `pc` est la liste à
 * reprendre et `phone` la sienne. Seule la liste de l'ordinateur se modifie
 * (copier, réunir, supprimer) ; aucune fiche de session n'est réécrite : une
 * pièce ou une ligne réunie (`merged`) est retrouvée par le rapprochement
 * (`library/gearMatch.ts`).
 */

// --- Ressemblance de deux noms ---

/** Longueur, sans espaces ni ponctuation, à partir de laquelle un nom contenu dans l'autre le rappelle. */
const MIN_CONTAINED_LENGTH = 3;
/** Longueur, sans espaces ni ponctuation, à partir de laquelle une lettre d'écart passe pour une faute de frappe. */
const MIN_TYPO_LENGTH = 5;

/**
 * Longueur au plus d'un mot qui sert de taille ou de repère (« S », « XL », « A ») : une lettre d'écart sur un tel
 * mot sépare deux pièces (« Voile S » et « Voile M »), elle n'est pas une faute de frappe.
 */
const SIZE_WORD_MAX_LENGTH = 2;

/** Nombres d'un nom, la virgule lue comme un point, dans leur ordre : « Unit 5,5 » donne `5.5`. */
const numbersOf = (name: string): string =>
  (gearNameKey(name).match(/\d+(?:\.\d+)?/g) ?? []).map(Number).join(' ');

/** Nom sans accents, en minuscules. */
const plainName = (name: string): string => gearNameKey(name).normalize('NFD').replace(/\p{M}/gu, '');

/** Nom sans accents, sans espaces ni ponctuation, en minuscules. */
const compactName = (name: string): string => plainName(name).replace(/[^\p{L}\p{N}]+/gu, '');

/** Mots d'un nom, sans accents ni ponctuation. */
const wordsOf = (name: string): string[] => plainName(name).split(/[^\p{L}\p{N}]+/u).filter((w) => w !== '');

/** Mots où deux noms diffèrent, une fois retirés les mots communs du début et de la fin. */
const differingWords = (a: string, b: string): string[] => {
  const x = wordsOf(a);
  const y = wordsOf(b);
  let start = 0;
  while (start < x.length && start < y.length && x[start] === y[start]) start++;
  let end = 0;
  while (end < x.length - start && end < y.length - start && x[x.length - 1 - end] === y[y.length - 1 - end]) end++;
  return [...x.slice(start, x.length - end), ...y.slice(start, y.length - end)];
};

/** Une lettre d'écart au plus : une ajoutée, retirée, changée, ou deux voisines échangées. */
const oneEditApart = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].flatMap((c, k) => (c === b[k] ? [] : [k]));
    if (diff.length <= 1) return true;
    const [i, j] = diff;
    return diff.length === 2 && j === i + 1 && a[i] === b[j] && a[j] === b[i];
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let k = 0;
  while (k < short.length && short[k] === long[k]) k++;
  return short.slice(k) === long.slice(k + 1);
};

/**
 * Deux noms qui désignent peut-être la même pièce : égaux sans accents, espaces
 * ni ponctuation, ou l'un contenu dans l'autre (à partir de 3 caractères), ou
 * une seule lettre d'écart (à partir de 5), sauf sur un mot de taille
 * (« Voile S » et « Voile M »). Jamais si leurs nombres diffèrent, dans
 * l'ordre : « Unit 5 » et « Unit 6 » restent deux pièces.
 */
export const gearLooksAlike = (a: string, b: string): boolean => {
  if (numbersOf(a) !== numbersOf(b)) return false;
  const x = compactName(a);
  const y = compactName(b);
  if (x === '' || y === '') return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= MIN_CONTAINED_LENGTH && long.includes(short)) return true;
  return short.length >= MIN_TYPO_LENGTH && oneEditApart(x, y)
    && differingWords(a, b).every((w) => w.length > SIZE_WORD_MAX_LENGTH);
};

// --- Listes des deux appareils ---

/** Activité d'un appareil, telle que la comparaison la nomme. */
export interface GearActivityRef {
  id: string;
  name: string;
}

/** Matériel enregistré d'une activité d'un appareil ; `null` : option coupée. */
export interface GearActivityList {
  activity: GearActivityRef;
  groups: GearGroup[] | null;
}

/**
 * Activités et leur matériel, relus d'un objet de réglages des supports (celui
 * du magasin de l'appareil, ou la valeur `gtracker.sportSettings` d'un fichier
 * de réglages) ; sans liste d'activités rangée, celles du premier lancement.
 */
export const activityGearLists = (sport: unknown): GearActivityList[] => {
  const raw = isObject(sport) ? sport : {};
  const gear = isObject(raw.gearGroups) ? raw.gearGroups : {};
  return readActivities(raw.activities).map((a) => ({ activity: { id: a.id, name: a.name }, groups: sanitizeGearGroups(gear[a.id]) }));
};

// --- Comparaison ---

/**
 * Rangée de la comparaison : même nom (`same`) ; pièce que l'ordinateur a reçue
 * en la réunissant (`merged`, le téléphone suivra) ; noms qui se ressemblent,
 * ou même identifiant sous deux noms (`alike`) ; pièce d'un seul côté
 * (`pcOnly`, `phoneOnly`).
 */
export type GearRowKind = 'same' | 'merged' | 'alike' | 'pcOnly' | 'phoneOnly';

/** Pièce de l'un, de l'autre, ou des deux. */
export interface GearRow {
  kind: GearRowKind;
  pc: GearItem | null;
  phone: GearItem | null;
}

/** Ligne (groupe) de l'un, de l'autre, ou des deux, avec ses pièces ; une ligne d'un seul côté a toutes ses pièces de ce côté. */
export interface GearLineRow {
  kind: GearRowKind;
  pc: GearGroup | null;
  phone: GearGroup | null;
  rows: GearRow[];
}

/** Une activité des deux appareils ; `pc` ou `phone` `null` : activité absente de cet appareil. */
export interface GearActivityComparison {
  pc: GearActivityList | null;
  phone: GearActivityList | null;
  lines: GearLineRow[];
  /** Activité des deux côtés, toutes ses lignes et pièces aux mêmes noms. */
  equal: boolean;
}

interface Named {
  id: string;
  name: string;
  merged?: GearMergedRef[];
}

interface Pair<T> {
  kind: GearRowKind;
  pc: T | null;
  phone: T | null;
  /** Réunie à une pièce de l'ordinateur qui a déjà sa rangée. */
  extra?: true;
}

const sameKey = (a: Named, b: Named): boolean => gearNameKey(a.name) === gearNameKey(b.name);

/** `host` a reçu `other` en le réunissant : son identifiant, ou son nom, est parmi les réunis. */
const knows = (host: Named, other: Named): boolean =>
  host.merged?.some((ref) => ref.id === other.id || gearNameKey(ref.name) === gearNameKey(other.name)) ?? false;

/**
 * Rapprochement de deux listes, en passes successives : même identifiant (même
 * nom : `same`, sinon `alike`), même nom, pièce reçue par l'ordinateur en la
 * réunissant (`merged` ; une pièce de l'ordinateur peut en avoir reçu
 * plusieurs, chacune sa rangée), noms qui se ressemblent. Dans l'ordre de
 * l'ordinateur, chacune suivie de ses réunies, puis ce qui reste du téléphone.
 */
const pairUp = <T extends Named>(pc: readonly T[], phone: readonly T[]): Pair<T>[] => {
  const main: (Pair<T> | null)[] = pc.map(() => null);
  const extra: Pair<T>[][] = pc.map(() => []);
  const used = new Set<number>();
  const pass = (match: (p: T, q: T) => boolean, kind: (p: T, q: T) => GearRowKind) => {
    pc.forEach((p, k) => {
      if (main[k]) return;
      const j = phone.findIndex((q, n) => !used.has(n) && match(p, q));
      if (j < 0) return;
      used.add(j);
      main[k] = { kind: kind(p, phone[j]), pc: p, phone: phone[j] };
    });
  };
  pass((p, q) => p.id === q.id, (p, q) => (sameKey(p, q) ? 'same' : 'alike'));
  pass(sameKey, () => 'same');
  phone.forEach((q, n) => {
    if (used.has(n)) return;
    const k = pc.findIndex((p) => knows(p, q));
    if (k < 0) return;
    used.add(n);
    if (main[k]) extra[k].push({ kind: 'merged', pc: pc[k], phone: q, extra: true });
    else main[k] = { kind: 'merged', pc: pc[k], phone: q };
  });
  pass((p, q) => gearLooksAlike(p.name, q.name), () => 'alike');
  return [
    ...pc.flatMap((p, k) => [main[k] ?? { kind: 'pcOnly' as const, pc: p, phone: null }, ...extra[k]]),
    ...phone.flatMap((q, n) => (used.has(n) ? [] : [{ kind: 'phoneOnly' as const, pc: null, phone: q }])),
  ];
};

/**
 * Ligne de la comparaison et ses pièces. Une ligne du téléphone réunie à une
 * ligne de l'ordinateur qui a déjà sa rangée ne montre que ses propres pièces :
 * celles de l'ordinateur sont sous la première rangée.
 */
const lineRow = ({ kind, pc, phone, extra }: Pair<GearGroup>): GearLineRow => {
  const rows = pairUp(pc?.items ?? [], phone?.items ?? []).map(({ kind: k, pc: p, phone: q }) => ({ kind: k, pc: p, phone: q }));
  return { kind, pc, phone, rows: extra ? rows.filter((r) => r.kind !== 'pcOnly') : rows };
};

/**
 * Matériel des deux appareils, activité par activité : celles qui ont une liste
 * d'au moins un côté, rapprochées par identifiant puis par nom, dans l'ordre de
 * l'ordinateur puis celles du seul téléphone ; dans chacune, lignes et pièces
 * rapprochées (identifiant, nom aux espaces, à la casse et à la virgule près,
 * réunies, ressemblantes).
 */
export const compareGear = (pc: readonly GearActivityList[], phone: readonly GearActivityList[]): GearActivityComparison[] => {
  const partner: (GearActivityList | null)[] = pc.map(() => null);
  const used = new Set<number>();
  const pass = (same: (a: GearActivityRef, b: GearActivityRef) => boolean) => pc.forEach((a, k) => {
    if (partner[k]) return;
    const n = phone.findIndex((b, m) => !used.has(m) && same(a.activity, b.activity));
    if (n < 0) return;
    used.add(n);
    partner[k] = phone[n];
  });
  pass((a, b) => a.id === b.id);
  pass((a, b) => gearNameKey(a.name) === gearNameKey(b.name));
  const pairs: [GearActivityList | null, GearActivityList | null][] = [
    ...pc.map((a, k): [GearActivityList, GearActivityList | null] => [a, partner[k]]),
    ...phone.flatMap((b, n): [null, GearActivityList][] => (used.has(n) ? [] : [[null, b]])),
  ];
  return pairs
    .filter(([a, b]) => (a?.groups?.length ?? 0) > 0 || (b?.groups?.length ?? 0) > 0)
    .map(([a, b]) => {
      const lines = pairUp(a?.groups ?? [], b?.groups ?? []).map(lineRow);
      const equal = a !== null && b !== null && lines.every((l) => l.kind === 'same' && l.rows.every((r) => r.kind === 'same'));
      return { pc: a, phone: b, lines, equal };
    });
};

/**
 * Activité dont le téléphone reprendrait la liste (« Reprendre le matériel ») :
 * connue des deux côtés, avec une liste du côté de l'ordinateur. Une activité
 * d'un seul côté se reprend avec tous les réglages.
 */
export const isAdoptableGear = (c: GearActivityComparison): c is GearActivityComparison & { pc: GearActivityList; phone: GearActivityList } =>
  c.pc !== null && c.phone !== null && c.pc.groups !== null;

// --- Gestes de la fenêtre, sur la liste de l'ordinateur ---

/** Identifiants déjà portés par une liste : lignes, pièces et réunis. */
const takenIds = (groups: readonly GearGroup[]): Set<string> => {
  const ids = new Set<string>();
  for (const g of groups) {
    ids.add(g.id);
    g.merged?.forEach((ref) => ids.add(ref.id));
    for (const it of g.items) {
      ids.add(it.id);
      it.merged?.forEach((ref) => ids.add(ref.id));
    }
  }
  return ids;
};

/**
 * Liste de l'ordinateur avec la pièce `phoneItem` de la ligne `phoneGroup` du
 * téléphone copiée dans sa ligne `pcGroupId` ; sans ligne (`null` ou
 * introuvable), la ligne du téléphone est d'abord créée. Sans pièce (`null`),
 * toutes celles de la ligne du téléphone sont copiées. Chaque copie garde
 * l'identifiant du téléphone s'il est libre (ses fiches se retrouvent alors par
 * lui), sinon en reçoit un neuf ; une pièce du même nom déjà dans la ligne
 * n'est pas doublée.
 */
export const withGearCopied = (
  groups: readonly GearGroup[], pcGroupId: string | null, phoneGroup: GearGroup, phoneItem: GearItem | null,
  makeId: () => string = newId
): GearGroup[] => {
  const taken = takenIds(groups);
  const idFor = (id: string): string => {
    const free = taken.has(id) ? makeId() : id;
    taken.add(free);
    return free;
  };
  const existing = pcGroupId === null ? undefined : groups.find((g) => g.id === pcGroupId);
  const target: GearGroup = existing ?? (() => {
    const id = idFor(phoneGroup.id);
    return withMergedRefs({ id, name: cleanGearName(phoneGroup.name), items: [] as GearItem[] }, cleanGearMerged(phoneGroup.merged, id));
  })();
  const items = [...target.items];
  for (const item of phoneItem ? [phoneItem] : phoneGroup.items) {
    if (items.some((it) => sameKey(it, item))) continue;
    const id = idFor(item.id);
    items.push(withMergedRefs({ id, name: cleanGearName(item.name) }, cleanGearMerged(item.merged, id)));
  }
  const next = { ...target, items };
  return existing ? groups.map((g) => (g === existing ? next : g)) : [...groups, next];
};

/** Identifiant et nom d'une pièce ou d'une ligne, suivis de ceux qu'elle avait reçus. */
const refsOf = (entry: Named): GearMergedRef[] => [{ id: entry.id, name: entry.name }, ...(entry.merged ?? [])];

/**
 * Liste de l'ordinateur où la pièce ou la ligne `keepId` reçoit `absorbed`,
 * sous le nom `name` (le sien si vide) : son identifiant et son nom, et ceux
 * qu'il avait reçus, rejoignent ses réunis (`merged`). Un `absorbed` de cette
 * liste en est retiré ; une ligne retirée confie ses pièces à celle qui la
 * reçoit (une pièce du même nom y est réunie à la sienne). Un `absorbed` du
 * téléphone n'y est pas : une ligne du téléphone réunie n'apporte pas ses
 * pièces. Même identifiant des deux côtés : le nom seul change. `keepId`
 * introuvable : liste inchangée.
 */
export const withGearMerged = (
  groups: readonly GearGroup[], keepId: string, absorbed: GearGroup | GearItem, name: string
): GearGroup[] => {
  const extraRefs = absorbed.id === keepId ? absorbed.merged ?? [] : refsOf(absorbed);
  const keptName = (keep: Named): string => cleanGearName(name) || keep.name;
  const keptRefs = (keep: Named): GearMergedRef[] | undefined => cleanGearMerged([...(keep.merged ?? []), ...extraRefs], keep.id);
  const keepGroup = groups.find((g) => g.id === keepId);
  if (keepGroup) {
    const gone = absorbed.id === keepId ? undefined : groups.find((g) => g.id === absorbed.id);
    const items = [...keepGroup.items];
    for (const item of gone?.items ?? []) {
      const k = items.findIndex((it) => sameKey(it, item));
      if (k < 0) items.push(item);
      else items[k] = withMergedRefs({ id: items[k].id, name: items[k].name }, cleanGearMerged([...(items[k].merged ?? []), ...refsOf(item)], items[k].id));
    }
    const next: GearGroup = withMergedRefs({ id: keepGroup.id, name: keptName(keepGroup), items }, keptRefs(keepGroup));
    return groups.filter((g) => g !== gone).map((g) => (g === keepGroup ? next : g));
  }
  const keepItem = groups.flatMap((g) => g.items).find((it) => it.id === keepId);
  if (!keepItem) return [...groups];
  const next: GearItem = withMergedRefs({ id: keepItem.id, name: keptName(keepItem) }, keptRefs(keepItem));
  const goneId = absorbed.id === keepId ? null : absorbed.id;
  return groups.map((g) => ({
    ...g,
    items: g.items.flatMap((it) => (it === keepItem ? [next] : it.id === goneId ? [] : [it])),
  }));
};

/**
 * Liste de l'ordinateur sans la ligne ou la pièce d'identifiant `id` : ses
 * fiches gardent son nom, hors liste. `id` introuvable : liste inchangée.
 */
export const withGearRemoved = (groups: readonly GearGroup[], id: string): GearGroup[] =>
  groups.some((g) => g.id === id)
    ? groups.filter((g) => g.id !== id)
    : groups.map((g) => (g.items.some((it) => it.id === id) ? { ...g, items: g.items.filter((it) => it.id !== id) } : g));

// --- Ce que le téléphone recevrait ---

/** Pièce, ou ligne entière (`itemName` `null`), qui arriverait ou partirait du téléphone. */
export interface GearChange {
  /** Activité du téléphone. */
  activity: GearActivityRef;
  groupName: string;
  itemName: string | null;
}

/** Pièce (ou ligne, `groupName` `null`) du téléphone réunie à une de l'ordinateur. */
export interface GearMergeChange {
  activity: GearActivityRef;
  /** Ligne de l'ordinateur où les deux pièces se rejoignent ; `null` : deux lignes réunies. */
  groupName: string | null;
  from: string;
  to: string;
}

/** Changements de la liste du téléphone s'il reprenait celle de l'ordinateur. */
export interface PhoneGearChanges {
  /** Activités touchées, dans l'ordre de la comparaison. */
  activities: GearActivityRef[];
  added: GearChange[];
  removed: GearChange[];
  merged: GearMergeChange[];
}

/** Pièces d'une ligne une à une, ou la ligne seule si elle est vide. */
const lineEntries = (activity: GearActivityRef, group: GearGroup): GearChange[] =>
  group.items.length > 0
    ? group.items.map((it) => ({ activity, groupName: group.name, itemName: it.name }))
    : [{ activity, groupName: group.name, itemName: null }];

/**
 * Ajouts, retraits et réunions que la reprise de la liste de l'ordinateur
 * ferait sur le téléphone, pour les activités qui se reprennent
 * (`isAdoptableGear`). Une ligne d'un seul côté compte pour toutes ses pièces ;
 * deux lignes ou deux pièces qui se ressemblent sans être réunies comptent pour
 * un retrait et un ajout (les fiches de celle du téléphone deviendraient hors
 * liste) ; une ligne ou une pièce réunie compte pour une réunion. Une pièce de
 * l'ordinateur que le téléphone a déjà (même nom ou réunie, sous une autre
 * rangée) ou déjà comptée n'est pas un ajout : une ligne du téléphone réunie à
 * une ligne de l'ordinateur qui a déjà sa rangée la compare de nouveau.
 */
export const phoneGearChanges = (comparisons: readonly GearActivityComparison[]): PhoneGearChanges => {
  const out: PhoneGearChanges = { activities: [], added: [], removed: [], merged: [] };
  for (const c of comparisons) {
    if (!isAdoptableGear(c)) continue;
    const activity = c.phone.activity;
    const before = out.added.length + out.removed.length + out.merged.length;
    const counted = new Set<string>();
    for (const line of c.lines) {
      if (line.pc && line.phone && line.kind !== 'alike') {
        for (const row of line.rows) if (row.pc && row.phone && (row.kind === 'same' || row.kind === 'merged')) counted.add(row.pc.id);
      }
    }
    for (const line of c.lines) {
      if (line.kind === 'pcOnly' || line.kind === 'alike') out.added.push(...lineEntries(activity, line.pc as GearGroup));
      if (line.kind === 'phoneOnly' || line.kind === 'alike') out.removed.push(...lineEntries(activity, line.phone as GearGroup));
      if (!line.pc || !line.phone || line.kind === 'alike') continue;
      if (line.kind === 'merged') out.merged.push({ activity, groupName: null, from: line.phone.name, to: line.pc.name });
      for (const row of line.rows) {
        if (row.pc && (row.kind === 'pcOnly' || row.kind === 'alike') && !counted.has(row.pc.id)) {
          counted.add(row.pc.id);
          out.added.push({ activity, groupName: line.pc.name, itemName: row.pc.name });
        }
        if (row.phone && (row.kind === 'phoneOnly' || row.kind === 'alike')) out.removed.push({ activity, groupName: line.phone.name, itemName: row.phone.name });
        if (row.kind === 'merged' && row.pc && row.phone) out.merged.push({ activity, groupName: line.pc.name, from: row.phone.name, to: row.pc.name });
      }
    }
    if (out.added.length + out.removed.length + out.merged.length > before) out.activities.push(activity);
  }
  return out;
};
