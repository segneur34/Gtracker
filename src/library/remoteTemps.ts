/**
 * Les noms provisoires du dossier mémoire du téléphone, tels que son application les écrit et les relit
 * (`MemoryFolderPlugin.java`) :
 * - un fichier neuf est d'abord écrit sous `nom.gtracker-new`, puis renommé ; resté seul (création interrompue), il
 *   est caché, puis effacé à la lecture suivante du dossier ;
 * - un fichier remplacé est d'abord écrit sous `nom.gtracker-tmp`, à côté de l'original. Si l'original est encore là,
 *   le remplacement a été interrompu avant sa fin : le provisoire, peut-être incomplet, est caché puis effacé. Si
 *   l'original n'y est plus, il avait déjà été retiré : le provisoire, complet, est montré et reprend son nom
 *   (`finishInterruptedReplace`).
 * Les suffixes se comparent en casse exacte, comme sur le téléphone.
 *
 * Quiconque écrit dans ce dossier (le programme Windows par le câble) suit la même règle : `.gtracker-tmp` seulement
 * quand le fichier existe, sans quoi un provisoire incomplet laissé par une coupure serait pris pour un remplacement
 * achevé. La coquille Windows (`bureau/`), qui ne lit pas les sources de l'application, en garde une copie
 * (`commeLeTelephone`, `nomProvisoire` de `bureau/telephone.ts`), comparée à celle-ci par un test.
 */

/** Suffixe du fichier écrit à côté de celui qu'il remplace. */
export const REPLACE_SUFFIX = '.gtracker-tmp';

/** Suffixe d'un fichier neuf, le temps de l'écrire. */
export const NEW_SUFFIX = '.gtracker-new';

/** Un nom tel que le téléphone le montre, et le nom que le fichier porte vraiment. */
export interface VisibleName {
  name: string;
  actual: string;
}

const hasSuffix = (name: string, suffix: string): boolean => name.endsWith(suffix) && name.length > suffix.length;

/** Vrai si le nom est celui d'une écriture en cours sur le téléphone. */
export const isRemoteTemp = (name: string): boolean => hasSuffix(name, NEW_SUFFIX) || hasSuffix(name, REPLACE_SUFFIX);

/**
 * Les fichiers d'un dossier du téléphone tels que son application les voit, dans l'ordre des noms reçus : les
 * provisoires cachés, ou montrés sous le nom qu'ils reprennent.
 */
export const phoneVisibleNames = (names: readonly string[]): VisibleName[] => {
  const present = new Set(names);
  const visible: VisibleName[] = [];
  for (const actual of names) {
    if (hasSuffix(actual, NEW_SUFFIX)) continue;
    if (hasSuffix(actual, REPLACE_SUFFIX)) {
      const original = actual.slice(0, -REPLACE_SUFFIX.length);
      if (present.has(original)) continue;
      present.add(original);
      visible.push({ name: original, actual });
      continue;
    }
    visible.push({ name: actual, actual });
  }
  return visible;
};

/** Nom provisoire sous lequel écrire `path` : `.gtracker-tmp` s'il existe déjà, `.gtracker-new` sinon. */
export const tempNameFor = (path: string, exists: boolean): string => path + (exists ? REPLACE_SUFFIX : NEW_SUFFIX);
