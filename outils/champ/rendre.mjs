// Fond de page : refait les quatre images WebP du champ de traînées (`src/assets/champ/`) depuis les deux SVG de ce
// dossier, pris tels quels : même dessin, mêmes couleurs, même transparence, même cadrage, aucune retouche. Le
// générateur d'origine des SVG n'est pas dans le dépôt : ces deux fichiers sont la source des images.
//
//   node outils/champ/rendre.mjs                refait les quatre images
//   node outils/champ/rendre.mjs --qualite 80   même chose à une autre qualité WebP (1 à 100 ; 100 : sans perte)
//   node outils/champ/rendre.mjs --sortie <dossier>   écrit les images ailleurs (essai, planche de comparaison)
//   node outils/champ/rendre.mjs --mesure       n'écrit rien : pour chaque qualité essayée, le poids des images et leur
//                                               écart au SVG sur quelques écrans, posées comme l'application les pose
//
// Rendu par le Chrome sans fenêtre du banc (même moteur que l'application ; `CHROME=<chemin>` s'il n'est pas à sa
// place ordinaire) : le SVG est dessiné dans un canevas à l'échelle voulue, puis encodé en WebP par le navigateur.
// L'image est posée sur le fond de la page (`--bg`) plutôt que laissée transparente : sous la couche du champ il n'y a
// que ce fond (`.shell` dans `AppShell.css`, la fenêtre « Sélection » des Statistiques sur `--surface`, égal à `--bg`),
// et l'opacité du champ (`--field-opacity`), toujours posée par le CSS, donne alors le même mélange qu'avec un fond
// transparent ; la transparence quintuplait le poids (canal alpha sans perte, chaque bord de trait adouci). Un `--bg`
// changé dans `tokens.css` demande de refaire les images (`rendre.test.mjs` compare les deux). Deux cadrages :
// - `champ-<thème>.webp`, l'image entière, pour l'ordinateur et le téléphone tourné ;
// - `champ-<thème>-portrait.webp`, la bande centrale de rapport 3/4, la seule que `background-size: cover` montre sur
//   un écran plus étroit que 3/4 ; `AppShell.css` la prend sous cette même requête (`max-aspect-ratio: 3/4`), le
//   cadrage ne change pas.
// Écart : par pixel, le plus grand écart des trois couleurs (sur 255) entre le SVG et l'image, posés sur le fond de la
// page à l'opacité du champ ; moyenne, 999 pour mille et maximum.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { DOSSIER_BANC, connect } from '../banc/lib/cdp.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
const SORTIE = resolve(option('--sortie') ?? join(ICI, '..', '..', 'src', 'assets', 'champ'));
/** Qualité WebP retenue (sur 100), la plus basse dont l'écart au SVG reste invisible (relevé de `--mesure`). */
const QUALITE = 80;
/** Qualités essayées par `--mesure`. */
const QUALITES_ESSAYEES = [100, 90, 80, 70, 60, 50, 40];
/** Rapport largeur sur hauteur de la bande du portrait, celui de la requête de `AppShell.css`. */
const RAPPORT_PORTRAIT = 3 / 4;
/** Pixels de l'image par unité du SVG, par cadrage : assez pour un écran d'ordinateur courant et un téléphone dense. */
const ECHELLES = { entier: 2, portrait: 2.4 };
/** Fond de la page et opacité du champ par thème, recopiés de `src/theme/tokens.css` (`--bg`, `--field-opacity`). */
const THEMES = { clair: { fond: '#f7f5f0', opacite: 0.62 }, sombre: { fond: '#0e0e0e', opacite: 0.85 } };
/** Écrans de `--mesure` : taille en pixels CSS, densité, cadrage que le CSS y prend. */
const ECRANS = [
  { nom: 'téléphone 412 × 915 ×2,625', largeur: 412, hauteur: 915, densite: 2.625, cadrage: 'portrait' },
  { nom: 'téléphone 390 × 844 ×3', largeur: 390, hauteur: 844, densite: 3, cadrage: 'portrait' },
  { nom: 'téléphone tourné 915 × 412 ×2,625', largeur: 915, hauteur: 412, densite: 2.625, cadrage: 'entier' },
  { nom: 'ordinateur 1440 × 900', largeur: 1440, hauteur: 900, densite: 1, cadrage: 'entier' },
  { nom: 'ordinateur 1920 × 1080 ×1,25', largeur: 1920, hauteur: 1080, densite: 1.25, cadrage: 'entier' },
];
const PORT = 9491;
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`].find((p) => p && existsSync(p));

const mesure = args.includes('--mesure');
const qualite = Number(option('--qualite') ?? QUALITE);
if (!(qualite >= 1 && qualite <= 100)) { console.error('qualité attendue entre 1 et 100'); process.exit(2); }
if (!CHROME) { console.error('Chrome introuvable : CHROME=<chemin du programme>'); process.exit(2); }

// Script de la page : SVG chargés en image, cadrages encodés, écart mesuré.
const PAGE = `window.__champ = (() => {
  const charger = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image illisible')); i.src = src; });
  const svgs = {};
  const toile = (l, h) => { const c = document.createElement('canvas'); c.width = l; c.height = h; return c; };
  return {
    async poser(theme, texte) { svgs[theme] = await charger(URL.createObjectURL(new Blob([texte], { type: 'image/svg+xml' }))); return 'ok'; },
    // Bande de x0 à x0 + bande (unités du SVG, pleine hauteur) à l'échelle donnée, en WebP.
    encoder(theme, dims, x0, bande, echelle, qualite, fond) {
      const c = toile(Math.round(bande * echelle), Math.round(dims.h * echelle));
      const g = c.getContext('2d', { alpha: false });
      g.fillStyle = fond; g.fillRect(0, 0, c.width, c.height);
      g.setTransform(c.width / bande, 0, 0, c.height / dims.h, -x0 * c.width / bande, 0);
      g.drawImage(svgs[theme], 0, 0, dims.w, dims.h);
      return c.toDataURL('image/webp', qualite / 100);
    },
    // Écran de l pixels sur h : SVG entier en cover, contre l'image de la bande posée à la même place.
    async ecart(theme, dims, url, x0, bande, l, h, fond, opacite) {
      const img = await charger(url);
      const s = Math.max(l / dims.w, h / dims.h);
      const ox = l / 2 - dims.w * s / 2;
      const oy = h / 2 - dims.h * s / 2;
      const peindre = (dessin) => {
        const g = toile(l, h).getContext('2d', { willReadFrequently: true });
        g.fillStyle = fond; g.fillRect(0, 0, l, h); g.globalAlpha = opacite; g.imageSmoothingQuality = 'medium';
        dessin(g);
        return g.getImageData(0, 0, l, h).data;
      };
      const a = peindre((g) => { g.setTransform(s, 0, 0, s, ox, oy); g.drawImage(svgs[theme], 0, 0, dims.w, dims.h); });
      const b = peindre((g) => g.drawImage(img, ox + x0 * s, oy, bande * s, dims.h * s));
      const histo = new Array(256).fill(0);
      let somme = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        histo[d]++; somme += d;
      }
      const n = a.length / 4;
      let cumul = 0, p999 = 0, max = 0;
      for (let d = 0; d < 256; d++) { if (histo[d]) max = d; cumul += histo[d]; if (cumul < n * 0.999) p999 = d + 1; }
      return { moyenne: somme / n, p999, max };
    },
  };
})(); 'ok'`;

const profil = join(tmpdir(), DOSSIER_BANC, 'champ-profil');
rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
mkdirSync(profil, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const arreter = () => {
  if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* déjà fini */ } }
  else chrome.kill();
};
const pret = async (url) => { for (let k = 0; k < 60; k++) { try { if ((await fetch(url)).ok) return true; } catch { /* pas encore */ } await new Promise((r) => setTimeout(r, 500)); } return false; };
const ko = (n) => Math.round(n / 1024);
const virgule = (x, d = 1) => x.toFixed(d).replace('.', ',');

let code = 1;
try {
  if (!(await pret(`http://127.0.0.1:${PORT}/json/version`))) throw new Error('Chrome sans fenêtre absent');
  const page = await connect({ port: PORT });
  if ((await page.evaluate(PAGE)) !== 'ok') throw new Error('script de la page refusé');
  for (const [theme, couleurs] of Object.entries(THEMES)) {
    const source = join(ICI, `champ-${theme}.svg`);
    const texte = readFileSync(source, 'utf8');
    const dims = { w: Number(/<svg[^>]*\bwidth="([\d.]+)"/.exec(texte)?.[1]), h: Number(/<svg[^>]*\bheight="([\d.]+)"/.exec(texte)?.[1]) };
    if (!(dims.w > 0 && dims.h > 0)) throw new Error(`${source} : largeur et hauteur du SVG introuvables`);
    if ((await page.evaluate(`window.__champ.poser(${JSON.stringify(theme)}, ${JSON.stringify(texte)})`)) !== 'ok') throw new Error(`${source} illisible`);
    const bandePortrait = dims.h * RAPPORT_PORTRAIT;
    const cadrages = {
      entier: { fichier: `champ-${theme}.webp`, x0: 0, bande: dims.w, echelle: ECHELLES.entier },
      portrait: { fichier: `champ-${theme}-portrait.webp`, x0: (dims.w - bandePortrait) / 2, bande: bandePortrait, echelle: ECHELLES.portrait },
    };
    const encoder = (c, q) => page.evaluate(`window.__champ.encoder(${JSON.stringify(theme)}, ${JSON.stringify(dims)}, ${c.x0}, ${c.bande}, ${c.echelle}, ${q}, ${JSON.stringify(couleurs.fond)})`);
    const brut = statSync(source).size;
    console.log(`${theme} : SVG ${ko(brut)} Ko, ${ko(gzipSync(readFileSync(source), { level: 9 }).length)} Ko compressé (gzip)`);
    if (!mesure) {
      mkdirSync(SORTIE, { recursive: true });
      for (const c of Object.values(cadrages)) {
        const url = await encoder(c, qualite);
        if (!url?.startsWith('data:image/webp')) throw new Error(`${c.fichier} : le navigateur n'a pas encodé de WebP`);
        const octets = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        writeFileSync(join(SORTIE, c.fichier), octets);
        console.log(`  ${c.fichier} : ${Math.round(c.bande * c.echelle)} × ${Math.round(dims.h * c.echelle)}, qualité ${qualite}, ${ko(octets.length)} Ko`);
      }
      continue;
    }
    for (const q of QUALITES_ESSAYEES) {
      const urls = {};
      const poids = [];
      for (const [nom, c] of Object.entries(cadrages)) {
        urls[nom] = await encoder(c, q);
        poids.push(`${nom} ${ko((urls[nom].length - urls[nom].indexOf(',') - 1) * 3 / 4)} Ko`);
      }
      console.log(`  qualité ${q} : ${poids.join(', ')}`);
      for (const e of ECRANS) {
        const c = cadrages[e.cadrage];
        const l = Math.round(e.largeur * e.densite);
        const h = Math.round(e.hauteur * e.densite);
        const r = await page.evaluate(`window.__champ.ecart(${JSON.stringify(theme)}, ${JSON.stringify(dims)}, ${JSON.stringify(urls[e.cadrage])}, ${c.x0}, ${c.bande}, ${l}, ${h}, ${JSON.stringify(couleurs.fond)}, ${couleurs.opacite})`);
        console.log(`    ${e.nom} (${e.cadrage}) : écart moyen ${virgule(r.moyenne, 2)}, 999 ‰ ${r.p999}, max ${r.max}`);
      }
    }
  }
  await page.close();
  code = 0;
} catch (err) {
  console.error(err.message);
} finally {
  arreter();
}
process.exit(code);
