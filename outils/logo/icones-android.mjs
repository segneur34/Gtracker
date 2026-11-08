// Icônes de l'application à partir du symbole GONG, `src/assets/logo/gong-symbol.svg` (lot 310) : symbole noir
// centré sur fond blanc, jamais une autre couleur (brief du DA de GONG, § 5 : marge d'environ 22 %, noir ou blanc
// seulement). Sortent : icône Android (classique carrée arrondie, ronde, avant-plan de l'icône adaptative),
// `public/favicon.png` (repli des navigateurs sans SVG ; `public/favicon.svg` est la copie du favicon GONG) et
// l'icône du raccourci de bureau.
//
// Règles de taille : le symbole fait 56 % de la largeur d'une icône classique ou ronde (donc 22 % de marge de
// chaque côté), et 37 % de la couche adaptative de 108 dp, soit 56 % du cercle visible de 72 dp. Le fond de
// l'icône adaptative est blanc uni (`drawable/ic_launcher_background.xml`) ; `mipmap-anydpi-v26/` reste celui de
// Capacitor. `assets/logo.png` ne sert plus qu'à l'écran de démarrage (lot 311).
//
// Les icônes : `node <chemin>/icones-android.mjs <racine du dépôt>`.
//
// L'écran de démarrage, s'il change : refaire `assets/splash.png` (logo de 900 px au centre d'un carré de
// 2732 px, fond #f6f5f2), puis `npx @capacitor/assets@3 generate --android --splashBackgroundColor #f6f5f2`,
// et défaire ce que l'outil fait de trop : `git checkout` d'`AndroidManifest.xml`, de `mipmap-*` et de
// `mipmap-anydpi-v26/`, suppression des dossiers `*night*` et `*ldpi*`.
//
// Il faut `sharp`, absent du projet : l'installer dans un dossier de brouillon hors du dépôt
// (`%TEMP%gtracker-sharp`, avec son propre `package.json`, puis `npm i sharp`) et y lancer le script.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = process.argv[2];
const sharp = createRequire(join(process.cwd(), 'x.js'))('sharp');
// Le SVG peint en `currentColor` : ici toujours en noir.
const symbolSvg = readFileSync(join(root, 'src/assets/logo/gong-symbol.svg'), 'utf8').replaceAll('currentColor', '#000000');
const res = join(root, 'android/app/src/main/res');
/** Icône classique (48 dp) et couche adaptative (108 dp, dont un cercle de 72 dp visible), par densité. */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
/** Part de la largeur de l'icône prise par le symbole (classique, ronde, favicon, bureau), et de la couche adaptative. */
const SYMBOL_SHARE = 0.56;
const LAYER_SHARE = 0.37;
/** Rayon des coins de l'icône classique, en part de son côté. */
const CORNER = 0.2;

/** Symbole noir de la largeur donnée, sur fond transparent. */
const symbol = (width) => sharp(Buffer.from(symbolSvg), { density: 1200 }).resize({ width }).png().toBuffer();
/** Fond blanc d'un carré de `size` px : `shape` vaut 'square', 'rounded' ou 'round'. */
const plate = (size, shape) => {
  const radius = shape === 'round' ? size / 2 : shape === 'rounded' ? size * CORNER : 0;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#ffffff"/></svg>`);
};
const transparent = (size) => ({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
/** Icône : fond blanc de la forme voulue, symbole centré. Sans `shape`, couche transparente (avant-plan adaptatif). */
const icon = async (size, share, shape) => {
  const layers = [{ input: await symbol(Math.round(size * share)), gravity: 'centre' }];
  const base = shape ? sharp(plate(size, shape)) : sharp(transparent(size));
  return base.composite(layers).png();
};

for (const [density, scale] of Object.entries(DENSITIES)) {
  const dir = join(res, `mipmap-${density}`);
  const legacy = Math.round(48 * scale);
  const layer = Math.round(108 * scale);
  await (await icon(legacy, SYMBOL_SHARE, 'rounded')).toFile(join(dir, 'ic_launcher.png'));
  await (await icon(legacy, SYMBOL_SHARE, 'round')).toFile(join(dir, 'ic_launcher_round.png'));
  await (await icon(layer, LAYER_SHARE)).toFile(join(dir, 'ic_launcher_foreground.png'));
}
// Favicon de repli : carré blanc plein, comme les navigateurs l'attendent.
await (await icon(192, SYMBOL_SHARE, 'square')).toFile(join(root, 'public/favicon.png'));
/** Image de l'icône du bureau (carré arrondi blanc), PNG de `size` px. */
const disc = async (size) => (await icon(size, SYMBOL_SHARE, 'rounded')).toBuffer();

// Icône du raccourci de bureau (`outils/icone-tracker.ico`) : une image par taille, en BMP 32 bits sous
// 256 px, en PNG à 256. L'explorateur de Windows lit mal le PNG aux petites tailles : un .ico tout en
// PNG y garde l'ancienne icône, même après redémarrage.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const bmp = async (size) => {
  const rgba = await sharp(await disc(size)).ensureAlpha().raw().toBuffer();
  const maskRow = Math.ceil(size / 32) * 4;
  const out = Buffer.alloc(40 + size * size * 4 + maskRow * size);
  out.writeUInt32LE(40, 0);
  out.writeInt32LE(size, 4);
  out.writeInt32LE(size * 2, 8); // hauteur doublée : image puis masque
  out.writeUInt16LE(1, 12);
  out.writeUInt16LE(32, 14);
  out.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = ((size - 1 - y) * size + x) * 4; // lignes de bas en haut
      const to = 40 + (y * size + x) * 4;
      out[to] = rgba[from + 2];
      out[to + 1] = rgba[from + 1];
      out[to + 2] = rgba[from];
      out[to + 3] = rgba[from + 3];
    }
  }
  return out; // masque ET laissé à zéro : la transparence vient du canal alpha
};
const images = await Promise.all(ICO_SIZES.map((size) => (size < 256 ? bmp(size) : disc(size))));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(ICO_SIZES[i] % 256, at);
  header.writeUInt8(ICO_SIZES[i] % 256, at + 1);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
writeFileSync(join(root, 'outils/icone-tracker.ico'), Buffer.concat([header, ...images]));
console.log('icônes Android, favicon et icône du bureau refaites');
