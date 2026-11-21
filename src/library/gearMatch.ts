import type { GearChoice, GearGroup, GearItem } from './notes';

/**
 * Rapprochement d'un choix de matériel d'une fiche avec le matériel enregistré
 * de l'activité, pur. Un choix recopie l'identifiant et le nom de sa ligne
 * (groupe) et de son article : une ligne supprimée puis recréée, l'ancien
 * catalogue d'une activité refaite ou celui d'une autre activité portent
 * d'autres identifiants sous les mêmes noms. Le rapprochement se fait donc par
 * identifiant d'abord, puis par nom ; la fiche n'est jamais réécrite ici.
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

/** Ligne et article du catalogue où se range un choix ; `null` : introuvable. */
export interface GearMatch {
  group: GearGroup | null;
  item: GearItem | null;
}

/**
 * Ligne et article d'un choix. L'article se cherche d'abord par son identifiant
 * dans tout le catalogue : un identifiant connu prime toujours (il garde un
 * renommage fait dans Réglages) et donne sa ligne. Sinon la ligne se cherche par
 * identifiant, puis par nom (la première du même nom), et l'article par son nom
 * dans cette ligne ; un article absent reste `null` (hors liste).
 */
export const matchGearChoice = (choice: GearChoice, groups: readonly GearGroup[]): GearMatch => {
  for (const group of groups) {
    const item = group.items.find((it) => it.id === choice.itemId);
    if (item) return { group, item };
  }
  const group = groups.find((g) => g.id === choice.groupId) ?? groups.find((g) => sameGearName(g.name, choice.groupName)) ?? null;
  const item = group?.items.find((it) => sameGearName(it.name, choice.itemName)) ?? null;
  return { group, item };
};

/** Choix retenu d'une ligne, avec sa ligne et son article du catalogue (`matchGearChoice`). */
export interface EffectiveGearChoice extends GearMatch {
  choice: GearChoice;
}

/**
 * Un choix par ligne : pour chaque ligne du catalogue, le dernier choix de la
 * fiche qui s'y range ; les choix sans ligne sont regroupés par nom de ligne,
 * le dernier gagne aussi (une fiche qui porte deux choix d'une même ligne garde
 * le dernier). Dans l'ordre des lignes du catalogue, puis celles hors catalogue
 * dans l'ordre de la fiche.
 */
export const effectiveGear = (gear: readonly GearChoice[] | null, groups: readonly GearGroup[]): EffectiveGearChoice[] => {
  const listed = new Map<string, EffectiveGearChoice>();
  const unlisted = new Map<string, EffectiveGearChoice>();
  for (const choice of gear ?? []) {
    const match = matchGearChoice(choice, groups);
    if (match.group) {
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
