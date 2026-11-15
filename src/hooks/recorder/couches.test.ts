import { describe, expect, it } from 'vitest';

/**
 * Découpage de l'enregistreur : chaque partie de `hooks/recorder/` n'importe que les parties
 * avant elle (aucun cycle, aucun import à rebours) ; le point d'entrée `hooks/useRecorder.ts` garde ses
 * exports, et le code de l'application ne passe que par lui.
 */

interface Fs {
  readdirSync(dir: URL, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `hooks/mediaQueries.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const HERE = new URL('./', import.meta.url);
const SRC = new URL('../../', import.meta.url);

/** Les couches, de la plus basse à la plus haute. */
const LAYERS = ['store', 'journalBuffer', 'watches', 'live', 'recovery'] as const;

/** Valeurs exportées par le point d'entrée, les mêmes qu'avant le découpage (et deux types). */
const ENTRY_VALUES = [
  'BELT_LOST_ERROR', 'GPS_LOST_ERROR', 'acknowledgeRecordingLanding', 'addRecordingMark', 'analyzePendingSession',
  'changeRecordingActivity', 'continuePendingSession', 'discardPendingSession', 'dismissRecorderResult', 'finishPendingSession',
  'finishingPendingSession', 'getLastFix', 'getLiveFixes', 'getLiveHeadingFixes', 'getLivePosition', 'getLiveSegmentCount',
  'getLiveSegments', 'getRecorderState', 'isRecordingActive', 'markRecorderResultOpened', 'motionCaptureWarning', 'pauseRecording',
  'recoverInterruptedRecording', 'resumeRecording', 'retakeRecordingBelt', 'retryRecordingBelt', 'startRecording', 'stopRecording', 'stopRecordingBeltSearch', 'subscribeToFixes',
  'subscribeToRecorder', 'togglePauseRecording', 'useLivePosition', 'useRecorderSelector', 'useRecorderStatus', 'useRecordingClock',
];
const ENTRY_TYPES = ['RecorderState', 'RecorderStatus'];

const isCode = (name: string): boolean => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.fixture\.ts$/.test(name);

/** Modules importés ou réexportés par un texte (`from '…'`, `import('…')`). */
const importsOf = (text: string): string[] =>
  [...text.matchAll(/\bfrom\s+'([^']+)'|\bimport\(\s*'([^']+)'\s*\)/g)].map((m) => m[1] ?? m[2]);

/** Fichiers de code de `src/`, chemins relatifs à `src/`. */
const codeFiles = (dir: URL, prefix = ''): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === 'test' ? [] : codeFiles(new URL(`${e.name}/`, dir), `${prefix}${e.name}/`);
    return isCode(e.name) ? [`${prefix}${e.name}`] : [];
  });

describe("couches de l'enregistreur", () => {
  it('chaque partie est rangée dans une couche, et seules elles sont dans le dossier', () => {
    const parts = fs.readdirSync(HERE, { withFileTypes: true }).map((e) => e.name).filter(isCode).map((n) => n.replace(/\.ts$/, ''));
    expect([...parts].sort()).toEqual([...LAYERS].sort());
  });

  it("chaque partie n'importe que des couches plus basses", () => {
    const backwards: string[] = [];
    let read = 0;
    LAYERS.forEach((layer, index) => {
      const text = fs.readFileSync(new URL(`${layer}.ts`, HERE), 'utf8');
      for (const spec of importsOf(text)) {
        const m = /^\.\/([\w]+)$/.exec(spec);
        if (!m) {
          // Hors du dossier : jamais le point d'entrée, qui est au-dessus de toutes les couches.
          if (/useRecorder$/.test(spec)) backwards.push(`${layer} → ${spec}`);
          continue;
        }
        read += 1;
        const target = LAYERS.indexOf(m[1] as (typeof LAYERS)[number]);
        if (target < 0 || target >= index) backwards.push(`${layer} → ${m[1]}`);
      }
    });
    expect(backwards).toEqual([]);
    // Garde-fou du test lui-même : les imports entre parties sont bien lus.
    expect(read).toBeGreaterThan(LAYERS.length);
  });

  it("le code de l'application ne passe que par le point d'entrée", () => {
    const files = codeFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
    const direct = files.filter((file) => !file.startsWith('hooks/recorder/') && file !== 'hooks/useRecorder.ts')
      .filter((file) => importsOf(fs.readFileSync(new URL(file, SRC), 'utf8')).some((spec) => /recorder\//.test(spec)));
    expect(direct).toEqual([]);
  });

  it("le point d'entrée garde ses exports : les mêmes valeurs, et ses types réexportés", async () => {
    const entry = await import('../useRecorder');
    expect(Object.keys(entry).sort()).toEqual([...ENTRY_VALUES].sort());
    const text = fs.readFileSync(new URL('../useRecorder.ts', import.meta.url), 'utf8');
    const types = [...text.matchAll(/export type \{([^}]*)\}/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));
    expect(types.sort()).toEqual(ENTRY_TYPES);
  });
});
