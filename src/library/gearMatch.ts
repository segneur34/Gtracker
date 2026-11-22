import type { GearChoice, GearGroup, GearItem, GearMergedRef } from './notes';

/**
 * Matériel enregistré d'une activité relu et nettoyé, et rapprochement d'un
 * choix de matériel d'une fiche avec lui, purs. Un choix recopie l'identifiant et le nom de sa ligne
 * (groupe) et de son article : une ligne supprimée puis recréée, l'ancien
 * catalogue d'une activité refaite ou celui d'une autre activité portent
 * d'autres identifiants sous les mêmes noms. Le rapprochement se fait donc par
 * identifiant d'abord, puis par nom ; une pièce ou une ligne réunie à une autre
 * (`merged`) se range sous celle qui l'a reçue. La fiche n'est jamais réécrite ici.
 */

/**
 * Nom ramené à sa forme de comparaison : en minuscules, la virgule lue comme un
 * point, les espaces qui se suivent réduits à un seul, ceux des bords retirés.
 * Deux saisies du même matériel (« Unit 5,5 » et « unit  5.5 ») ne font qu'un.
 */
export const gearNameKey = (name: string): string =>
  name.toLocaleLowerCase('fr').replace(/,/g, '.').replace(/\s+/g, ' ').trim();

/** Même nom, à la casse, aux espaces et à la virgule décimale près. */
export const sameGearName = (a: string, b: string): boolean => gearNameKey(a) === gearNameKey(b);

// --- Liste relue : celle du magasin comme celle d'un fichier de réglages d'un autre appareil ---

/** Longueur d'un nom de groupe ou de pièce. */
export const MAX_GEAR_NAME_LENGTH = 30;

/** Nom d'un groupe ou d'une pièce : rogné, tronqué ; vide s'il n'est pas un texte. */
export const cleanGearName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_GEAR_NAME_LENGTH) : '';

/**
 * Pièces ou groupes réunis relus (`merged`) : noms rognés et tronqués, entrées
 * sans identifiant ou sans nom écartées, comme celle qui porte l'identifiant de
 * leur hôte (`ownerId`, déjà retrouvé par lui) et les identifiants en double
 * (la première gardée). `undefined` s'il ne reste rien : le champ est omis.
 */
export const cleanGearMerged = (value: unknown, ownerId: string): GearMergedRef[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>([ownerId]);
  const refs = value.flatMap((ref): GearMergedRef[] => {
    if (typeof ref !== 'object' || ref === null) return [];
    const { id, name } = ref as { id?: unknown; name?: unknown };
    const clean = cleanGearName(name);
    if (typeof id !== 'string' || id === '' || clean === '' || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: clean }];
  });
  return refs.length > 0 ? refs : undefined;
};

/** Objet avec ses réunis (`merged`), le champ omis s'il n'y en a aucun. */
export const withMergedRefs = <T extends object>(base: T, merged: GearMergedRef[] | undefined): T & { merged?: GearMergedRef[] } =>
  merged ? { ...base, merged } : base;

/**
 * Matériel enregistré relu : noms rognés et tronqués, groupes et pièces sans
 * identifiant ou sans nom écartés, identifiants en double écartés, ceux qui
 * restent gardés tels quels, avec leurs réunis nettoyés (`cleanGearMerged`) ;
 * `null` s'il n'est pas une liste (option coupée). Une liste vide est gardée :
 * l'option est cochée, rien n'est encore créé.
 */
export const sanitizeGearGroups = (value: unknown): GearGroup[] | null => {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const fresh = (id: unknown): id is string => {
    if (typeof id !== 'string' || id === '' || seen.has(id)) return false;
    seen.add(id);
    return true;
  };
  return value.flatMap((group): GearGroup[] => {
    if (typeof group !== 'object' || group === null) return [];
    const { id, name, items, merged } = group as { id?: unknown; name?: unknown; items?: unknown; merged?: unknown };
    const groupName = cleanGearName(name);
    if (groupName === '' || !fresh(id)) return [];
    const kept = (Array.isArray(items) ? items : []).flatMap((item): GearItem[] => {
      if (typeof item !== 'object' || item === null) return [];
      const raw = item as { id?: unknown; name?: unknown; merged?: unknown };
      const itemName = cleanGearName(raw.name);
      const itemId = raw.id;
      return itemName !== '' && fresh(itemId) ? [withMergedRefs({ id: itemId, name: itemName }, cleanGearMerged(raw.merged, itemId))] : [];
    });
    return [withMergedRefs({ id, name: groupName, items: kept }, cleanGearMerged(merged, id))];
  });
};

// --- Rapprochement d'un choix ---

/** Ligne et article du catalogue où se range un choix ; `null` : introuvable. */
export interface GearMatch {
  group: GearGroup | null;
  item: GearItem | null;
}

/** Ligne ou article qui a reçu, en le réunissant, celui d'identifiant `id`. */
const mergedById = (entry: GearGroup | GearItem, id: string): boolean => entry.merged?.some((ref) => ref.id === id) ?? false;

/** Ligne ou article qui a reçu, en le réunissant, un autre du nom `name`. */
const mergedByName = (entry: GearGroup | GearItem, name: string): boolean => entry.merged?.some((ref) => sameGearName(ref.name, name)) ?? false;

/**
 * Ligne et article d'un choix. L'article se cherche d'abord par son identifiant
 * dans tout le catalogue : un identifiant connu prime toujours (il garde un
 * renommage fait dans Réglages) et donne sa ligne ; puis parmi les identifiants
 * réunis (`merged`) à un article. Sinon la ligne se cherche par identifiant,
 * parmi les identifiants réunis, par nom (la première du même nom), puis parmi
 * les noms réunis ; et l'article par son nom dans cette ligne, puis parmi ses
 * noms réunis. Un article absent reste `null` (hors liste).
 */
export const matchGearChoice = (choice: GearChoice, groups: readonly GearGroup[]): GearMatch => {
  for (const pick of [(it: GearItem) => it.id === choice.itemId, (it: GearItem) => mergedById(it, choice.itemId)]) {
    for (const group of groups) {
      const item = group.items.find(pick);
      if (item) return { group, item };
    }
  }
  const group = groups.find((g) => g.id === choice.groupId)
    ?? groups.find((g) => mergedById(g, choice.groupId))
    ?? groups.find((g) => sameGearName(g.name, choice.groupName))
    ?? groups.find((g) => mergedByName(g, choice.groupName))
    ?? null;
  const item = group?.items.find((it) => sameGearName(it.name, choice.itemName))
    ?? group?.items.find((it) => mergedByName(it, choice.itemName))
    ?? null;
  return { group, item };
};

/** Choix retenu d'une ligne, avec sa ligne et son article du catalogue (`matchGearChoice`). */
export interface EffectiveGearChoice extends GearMatch {
  choice: GearChoice;
}

/**
 * Un choix par ligne : pour chaque ligne du catalogue, parmi les choix de la
 * fiche qui s'y rangent, celui dont l'article est au catalogue plutôt qu'un
 * article hors liste, et à égalité le dernier ; les choix sans ligne sont
 * regroupés par nom de ligne, le dernier gagne. Une fiche peut porter deux
 * choix d'une même ligne : l'ancien choix du matériel ne retirait que ceux de
 * même identifiant de ligne, et laissait derrière le choix neuf, rangé par nom,
 * celui d'un catalogue refait ; c'est le choix neuf, pris dans le catalogue,
 * qui compte. Dans l'ordre des lignes du catalogue, puis celles hors catalogue
 * dans l'ordre de la fiche. La fiche n'est pas réécrite.
 */
export const effectiveGear = (gear: readonly GearChoice[] | null, groups: readonly GearGroup[]): EffectiveGearChoice[] => {
  const listed = new Map<string, EffectiveGearChoice>();
  const unlisted = new Map<string, EffectiveGearChoice>();
  for (const choice of gear ?? []) {
    const match = matchGearChoice(choice, groups);
    if (match.group) {
      const kept = listed.get(match.group.id);
      if (kept?.item && !match.item) continue;
      listed.set(match.group.id, { choice, ...match });
    } else {
      const key = gearNameKey(choice.groupName);
      unlisted.delete(key);
      unlisted.set(key, { choice, ...match });
    }
  }
  return [...groups.flatMap((g) => listed.get(g.id) ?? []), ...unlisted.values()];
};

/** Rang d'un choix pour le tri : celui de sa ligne dans le catalogue, après toutes les lignes s'il n'en a pas. */
const lineRank = (choice: GearChoice, groups: readonly GearGroup[]): number => {
  const group = matchGearChoice(choice, groups).group;
  return group ? groups.indexOf(group) : groups.length;
};

/**
 * Matériel avec ce choix pour la ligne `groupId` : tout choix qui s'y range
 * (par identifiant ou par nom) est retiré, puis le nouveau posé (rien pour
 * « Aucun ») ; trié dans l'ordre des lignes, `null` s'il ne reste rien. Une
 * ligne hors catalogue (celle d'un choix dont la ligne a disparu) se reconnaît
 * à l'identifiant du choix, et retire les choix sans ligne du même nom.
 */
export const withLineChoice = (
  gear: readonly GearChoice[] | null, groups: readonly GearGroup[], groupId: string, choice: GearChoice | null
): GearChoice[] | null => {
  const catalogued = groups.find((g) => g.id === groupId) ?? null;
  const orphanName = catalogued ? null : (gear ?? []).find((c) => c.groupId === groupId)?.groupName ?? choice?.groupName ?? null;
  const onLine = (c: GearChoice): boolean => {
    const { group } = matchGearChoice(c, groups);
    if (catalogued) return group === catalogued;
    return group === null && (c.groupId === groupId || (orphanName !== null && sameGearName(c.groupName, orphanName)));
  };
  const kept = (gear ?? []).filter((c) => !onLine(c));
  const next = [...kept, ...(choice ? [choice] : [])]
    .map((c, k) => ({ c, k, rank: lineRank(c, groups) }))
    .sort((a, b) => a.rank - b.rank || a.k - b.k)
    .map(({ c }) => c);
  return next.length > 0 ? next : null;
};
