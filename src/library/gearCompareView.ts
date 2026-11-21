import { activityDisplayName } from '../core/activities';
import { t } from '../core/i18n';
import { gearLooksAlike, type GearActivityComparison, type GearLineRow, type GearRow, type PhoneGearChanges } from './gearCompare';
import type { GearGroup, GearItem } from './notes';

/**
 * Ce que la fenêtre « Matériel des deux appareils » offre sur la comparaison (`gearCompare.ts`), pur : le geste de
 * chaque rangée et de chaque ligne, et les pièces de l'ordinateur qui se ressemblent dans une même ligne. Seule la
 * liste de l'ordinateur se modifie. Et la question de « Reprendre le matériel » (Réglages › Mémoire).
 */

/** Geste sur la liste de l'ordinateur : copier ce que le téléphone a seul, réunir deux noms qui se ressemblent, supprimer. */
export type GearGesture = 'copy' | 'merge' | 'remove';

/** Une activité se modifie si elle est des deux côtés ; celle d'un seul côté est montrée sans geste. */
export const gearGesturesAllowed = (c: GearActivityComparison): boolean => c.pc !== null && c.phone !== null;

/**
 * Geste d'une pièce : copier celle du seul téléphone, réunir deux pièces qui se ressemblent, supprimer toute autre
 * pièce de l'ordinateur (même nom, déjà réunie, absente du téléphone).
 */
export const gearRowGesture = (row: GearRow): GearGesture | null =>
  row.kind === 'phoneOnly' ? 'copy' : row.kind === 'alike' ? 'merge' : row.pc ? 'remove' : null;

/**
 * Geste d'une ligne : copier celle du seul téléphone (avec ses pièces), réunir deux lignes qui se ressemblent,
 * supprimer celle du seul ordinateur ; une ligne des deux côtés n'en a pas, ses pièces ont les leurs.
 */
export const gearLineGesture = (line: GearLineRow): GearGesture | null =>
  line.kind === 'phoneOnly' ? 'copy' : line.kind === 'alike' ? 'merge' : line.kind === 'pcOnly' ? 'remove' : null;

/**
 * Question de « Reprendre le matériel » : le matériel de `sourceName` (déjà traduit) remplace celui de cet appareil
 * (« ce téléphone », sinon « cet ordinateur ») pour les activités touchées, avec chaque ajout (+), retrait (−) et
 * réunion ; une ligne vide se nomme par elle-même.
 */
export const gearAdoptQuestion = (sourceName: string, changes: PhoneGearChanges, onPhone: boolean): string => {
  const activities = changes.activities.map(activityDisplayName).join(', ');
  const list = [
    ...changes.added.map((c) => `+ ${c.itemName ?? c.groupName}`),
    ...changes.removed.map((c) => `− ${c.itemName ?? c.groupName}`),
    ...changes.merged.map((c) => t('{from} réuni à {to}', { from: c.from, to: c.to })),
  ].join(' ; ');
  const head = onPhone
    ? t('Le matériel de « {name} » remplace celui de ce téléphone pour {activities} : {changes}.', { name: sourceName, activities, changes: list })
    : t('Le matériel de « {name} » remplace celui de cet ordinateur pour {activities} : {changes}.', { name: sourceName, activities, changes: list });
  return `${head} ${t('Les sessions gardent leur matériel.')}`;
};

/**
 * Pièces d'une même ligne qui se ressemblent (`gearLooksAlike`), à réunir comme deux pièces des deux appareils :
 * chaque paire une fois, dans l'ordre de la ligne.
 */
export const alikeItemsWithin = (group: GearGroup | null): [GearItem, GearItem][] =>
  (group?.items ?? []).flatMap((a, i, items) =>
    items.slice(i + 1).flatMap((b): [GearItem, GearItem][] => (gearLooksAlike(a.name, b.name) ? [[a, b]] : [])));
