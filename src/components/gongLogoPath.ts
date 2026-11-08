// Tracé du logo GONG complet (symbole et mot « GONG »), lu dans le fichier SVG : une seule source pour le composant
// `GongLogo` et pour l'image de partage (`Path2D`). Lu par `import.meta.glob` : `assets/` n'est pas un dossier de modules.
const files = import.meta.glob('../assets/logo/gong-logo-full.svg', { query: '?raw', import: 'default', eager: true });
const svg = Object.values(files)[0] as string;

/** Boîte du dessin (`viewBox` du SVG). */
export const GONG_LOGO_WIDTH = 235;
export const GONG_LOGO_HEIGHT = 41;

/** Attribut `d` du tracé. */
export const GONG_LOGO_PATH: string = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? '';
