import { describe, expect, it } from 'vitest';
import { FISH_PATHS, FISH_STYLES } from '../library/fishGrowth';
import { FISH_DRAWING_KEYS, fishDrawingKey, withInstanceIds, withoutBrushFilter } from './fishDrawings';

interface Fs {
  readdirSync(dir: URL): string[];
  readFileSync(file: URL, encoding: 'utf8'): string;
}
// Les types de Node ne sont pas ceux de l'app (voir `hooks/mediaQueries.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

const DIR = new URL('../assets/poisson/', import.meta.url);
const files = FISH_STYLES.flatMap(({ id: style }) =>
  fs.readdirSync(new URL(`${style}/`, DIR)).filter((f) => f.endsWith('.svg'))
    .map((f) => ({ style, name: f.slice(0, -4), svg: fs.readFileSync(new URL(`${style}/${f}`, DIR), 'utf8') })));

/** Balises ouvrantes d'un dessin. */
const tags = (svg: string): string[] => svg.match(/<[a-zA-Z]+\s[^>]*>/g) ?? [];
const attr = (tag: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]?.toLowerCase();

describe('dessins du poisson', () => {
  it('64 dessins : l’alevin et cinq niveaux par voie, dans chacun des quatre styles', () => {
    expect(files).toHaveLength(64);
    const expected = FISH_STYLES.flatMap(({ id: s }) => [`${s}/depart-1`, ...FISH_PATHS.flatMap(({ id: p }) => [2, 3, 4, 5, 6].map((n) => `${s}/${p}-${n}`))]);
    expect(files.map((f) => `${f.style}/${f.name}`).sort()).toEqual(expected.sort());
    expect([...FISH_DRAWING_KEYS].sort()).toEqual(expected.sort());
  });

  it('un carré de 240, sans taille imposée, caché au lecteur d’écran', () => {
    for (const f of files) {
      const root = /^<svg [^>]*>/.exec(f.svg)?.[0] ?? '';
      expect(root, f.name).toContain('viewBox="0 0 240 240"');
      expect(root, f.name).toContain('aria-hidden="true"');
      expect(root, f.name).not.toMatch(/\s(width|height)=/);
    }
  });

  it('identifiants préfixés par leur fichier, uniques partout, chaque renvoi résolu dans son fichier', () => {
    const all = new Set<string>();
    for (const f of files) {
      const ids = [...f.svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      const prefix = `pz-${f.style}-${f.name}-`;
      for (const id of ids) {
        expect(id.startsWith(prefix), `${f.style}/${f.name} : ${id}`).toBe(true);
        expect(all.has(id), id).toBe(false);
        all.add(id);
      }
      for (const [, ref] of f.svg.matchAll(/(?:url\(#|href="#)([^")]+)/g)) expect(ids, `${f.style}/${f.name} : ${ref}`).toContain(ref);
    }
  });

  it('le pinceau porte son propre filtre', () => {
    for (const f of files.filter((x) => x.style === 'B')) expect(f.svg, f.name).toMatch(/<filter id="pz-B-[^"]+-rugueux"/);
  });

  it('ni encre ni papier en dur en trait fin, pinceau et pictogramme, hors du pourtour du vert et des pupilles', () => {
    for (const f of files.filter((x) => x.style !== 'F')) {
      for (const t of tags(f.svg)) {
        const fill = attr(t, 'fill');
        const stroke = attr(t, 'stroke');
        expect([fill, stroke], `${f.style}/${f.name} : ${t.slice(0, 80)}`).not.toContain('#f7f5f0');
        expect([fill, stroke], `${f.style}/${f.name}`).not.toContain('#161616');
        expect([fill, stroke], `${f.style}/${f.name}`).not.toContain('#72b0bd');
        if (stroke === '#000') expect(fill, `${f.style}/${f.name} : ${t.slice(0, 80)}`).toBe('#aaff00');
        if (fill === '#000') expect(f.style === 'A' && t.startsWith('<circle') && stroke === undefined, `${f.style}/${f.name} : ${t.slice(0, 80)}`).toBe(true);
      }
    }
  });
});

describe('fishDrawingKey', () => {
  it('le niveau 1 est l’alevin commun, quelle que soit la voie', () => {
    expect(fishDrawingKey('A', 'beau', 1)).toBe('A/depart-1');
    expect(fishDrawingKey('G', 'agressif', 1)).toBe('G/depart-1');
  });

  it('les niveaux 2 à 6 suivent la voie, bornés', () => {
    expect(fishDrawingKey('B', 'lesDeux', 4)).toBe('B/lesDeux-4');
    expect(fishDrawingKey('F', 'beau', 9)).toBe('F/beau-6');
    expect(fishDrawingKey('F', 'beau', 0)).toBe('F/depart-1');
  });
});

describe('copies d’un dessin', () => {
  const svg = '<svg><defs><clipPath id="pz-A-beau-2-w"><path d="M0,0"/></clipPath><filter id="pz-B-x-rugueux"/></defs>'
    + '<g clip-path="url(#pz-A-beau-2-w)" filter="url(#pz-B-x-rugueux)"><use href="#pz-A-beau-2-w"/></g></svg>';

  it('chaque copie a ses identifiants, et ses renvois les suivent', () => {
    const a = withInstanceIds(svg, 'r1');
    expect(a).toContain('id="pz-A-beau-2-w-r1"');
    expect(a).toContain('url(#pz-A-beau-2-w-r1)');
    expect(a).toContain('href="#pz-A-beau-2-w-r1"');
    expect(a).toContain('url(#pz-B-x-rugueux-r1)');
    expect(withInstanceIds(svg, 'r2')).not.toContain('-r1');
  });

  it('le filtre de pinceau s’ôte sans toucher aux découpes', () => {
    const plain = withoutBrushFilter(svg);
    expect(plain).not.toContain('filter="');
    expect(plain).toContain('clip-path="url(#pz-A-beau-2-w)"');
  });
});
