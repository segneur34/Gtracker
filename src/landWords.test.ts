import { describe, expect, it } from 'vitest';

/**
 * Cliquet du vocabulaire de la terre (règle 13 de `CLAUDE.md`) : course, vélo et Entraînement sont partis ;
 * leurs mots ne doivent plus remonter dans `src/`, commentaires et tests compris. Pour chaque motif de
 * `outils/heritage.mjs`, le relevé `outils/heritage.json` fige un nombre par fichier : une hausse, ou une occurrence
 * dans un fichier absent du relevé, fait échouer ; une baisse est signalée pour qu'on la fige (`node outils/heritage.mjs
 * --figer`). Un motif à zéro est refusé en dur, de même que les chemins du poste et l'allure en min/km (`DURS`).
 * Un faux ami se traite par une exception nommée (`EXCLUS`), jamais en élargissant un motif en silence.
 * Ce fichier est exclu du compte : il nomme ces motifs.
 */

interface Fs {
  readFileSync(file: URL, encoding: 'utf8'): string;
}
interface Outil {
  CLIQUET: Record<string, RegExp>;
  DURS: Record<string, RegExp>;
  compter(motifs: Record<string, RegExp>): Record<string, Record<string, number>>;
}
// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;
const outil = (await import(/* @vite-ignore */ new URL('../outils/heritage.mjs', import.meta.url).href as string)) as Outil;

const COMMANDE = 'node outils/heritage.mjs --figer';
const frozen = JSON.parse(fs.readFileSync(new URL('../outils/heritage.json', import.meta.url), 'utf8')) as Record<string, Record<string, number>>;
const found = outil.compter(outil.CLIQUET);

describe('vocabulaire de la terre (cliquet)', () => {
  it('le relevé couvre exactement les motifs à cliquet, et aucun n\'est à zéro (sinon : en dur)', () => {
    expect(Object.keys(frozen).sort()).toEqual(Object.keys(outil.CLIQUET).sort());
    // Un motif tombé à zéro quitte CLIQUET pour DURS dans `outils/heritage.mjs`.
    expect(Object.entries(found).filter(([, files]) => Object.keys(files).length === 0).map(([name]) => name)).toEqual([]);
  });

  for (const name of Object.keys(outil.CLIQUET)) {
    it(`« ${name} » : aucun fichier ne dépasse son nombre figé, aucun fichier neuf`, () => {
      const ref = frozen[name] ?? {};
      const rises = Object.entries(found[name])
        .filter(([file, n]) => n > (ref[file] ?? 0))
        .map(([file, n]) => `${file} : figé ${ref[file] ?? 0}, trouvé ${n}`);
      expect(rises, `Vocabulaire de la terre qui remonte : retirez-le, ou lancez \`${COMMANDE}\` si c'est voulu.`).toEqual([]);
    });

    it(`« ${name} » : une baisse est signalée pour être figée`, () => {
      const ref = frozen[name] ?? {};
      const drops = Object.entries(ref).filter(([file, n]) => (found[name][file] ?? 0) < n);
      // Une baisse ne fait rien échouer : elle s'affiche, et `COMMANDE` fige le gain.
      if (drops.length > 0) console.warn(`« ${name} » a baissé dans ${drops.length} fichier(s) : lancez \`${COMMANDE}\` pour figer le gain.`);
      expect(true).toBe(true);
    });
  }
});

describe('motifs refusés en dur dans src/', () => {
  const hard = outil.compter(outil.DURS);
  for (const name of Object.keys(outil.DURS)) {
    it(`aucun « ${name} »`, () => {
      expect(Object.keys(hard[name])).toEqual([]);
    });
  }
});
