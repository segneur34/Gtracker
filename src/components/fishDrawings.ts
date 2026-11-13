import { FISH_LEVELS, type FishPath, type FishStyle } from '../library/fishGrowth';

/**
 * Dessins du poisson du Profil : 64 SVG statiques (`assets/poisson/<style>/`), l'alevin commun (`depart-1`) puis
 * cinq niveaux par voie (`<voie>-<n>`), lus à la demande : chacun est un morceau à part, rien dans le paquet
 * principal. Ils sont dessinés une fois hors de l'application ; l'encre y est `currentColor`, le papier les classes
 * `pz-p` (remplissage) et `pz-ps` (trait), le verre du pinceau `pz-b` et `pz-bs` (`ProfileFish.css`). Le style
 * estampe garde ses couleurs et sa feuille, jour et nuit. Chaque identifiant commence par `pz-`.
 */

const DRAWINGS = import.meta.glob<string>('../assets/poisson/*/*.svg', { query: '?raw', import: 'default' });

/** Préfixe du chemin d'un dessin dans `DRAWINGS`. */
const DIR = '../assets/poisson/';

/** Le filtre de pinceau du style B est-il peint ? Sinon le dessin est montré figé, sans filtre (mode Économe : `ProfileFish.css`). */
export const FISH_BRUSH_FILTER = true;

/** Nom d'un dessin, `<style>/<fichier>` : le niveau 1 est l'alevin commun, quelle que soit la voie. */
export const fishDrawingKey = (style: FishStyle, path: FishPath, level: number): string => {
  const n = Math.min(FISH_LEVELS, Math.max(1, Math.round(level)));
  return `${style}/${n === 1 ? 'depart-1' : `${path}-${n}`}`;
};

/** Noms des dessins livrés avec l'application. */
export const FISH_DRAWING_KEYS: readonly string[] = Object.keys(DRAWINGS).map((p) => p.slice(DIR.length, -'.svg'.length));

/** Texte SVG d'un dessin, lu à la demande. */
export const loadFishDrawing = (style: FishStyle, path: FishPath, level: number): Promise<string> => {
  const key = fishDrawingKey(style, path, level);
  const load = DRAWINGS[`${DIR}${key}.svg`];
  return load ? load() : Promise.reject(new Error(`Dessin du poisson introuvable : ${key}`));
};

/**
 * Identifiants d'un dessin suffixés de `suffix` : deux copies du même dessin dans la page (le bocal et la fenêtre de
 * choix) ne se volent pas leurs découpes. `suffix` : lettres, chiffres, tirets.
 */
export const withInstanceIds = (svg: string, suffix: string): string =>
  svg.replace(/(\sid="|url\(#|href="#)(pz-[^")]+)/g, `$1$2-${suffix}`);

/** Le dessin sans son filtre de pinceau : figé, plus léger à peindre. */
export const withoutBrushFilter = (svg: string): string => svg.replace(/\sfilter="url\(#[^)]*\)"/g, '');

/** Texte prêt à injecter : identifiants propres à cette copie, filtre de pinceau ôté s'il est coupé. */
export const fishMarkup = (svg: string, suffix: string): string => {
  const own = withInstanceIds(svg, suffix);
  return FISH_BRUSH_FILTER ? own : withoutBrushFilter(own);
};
