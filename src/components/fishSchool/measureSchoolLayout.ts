import type { Box } from '../../core/rootPath';
import { brushCorner, schoolLayoutKey, type SchoolFrame, type SchoolLayout } from '../../core/fishSchool';

/**
 * Lecture de la page du Profil pour le banc de poissons : la zone sous la photo d'en-tête, l'angle d'où le banc entre,
 * les cadres peints (boîte, angle ouvert, trait), ce que le banc ne touche jamais (photo ronde, bouton de période,
 * textes, chiffres, dessins, boutons) et les cadres dont le voile est repeint sous le banc. Tout en px relatifs à la
 * zone, origine en haut à gauche ; le calcul (`core/fishSchool.ts`) ne lit jamais la page.
 */

/** Cadres de la colonne du Profil : ses cartes, et celles d'un conteneur sans boîte (cartes d'ouverture). */
const FRAME_SELECTOR = ':scope > :is(.ui-card, .ui-card-col), :scope > .brush-frames > :is(.ui-card, .ui-card-col)';
/** Cadres au voile de la page, rendus transparents sous le banc et repeints dans son dessin (`ProfilePage.css`). */
const VEILED_SELECTOR = '.profile-favs, .profile-split, .actchart';
/** Ce qui compte pour un dessin ou un chiffre en plus des textes : on n'y pose aucun poisson. */
const SOLID_SELECTOR = 'svg, canvas, img, button, input, select, textarea, [role="img"]';

export interface SchoolMeasureRules {
  /** Angle de départ : rentré de tant de px du bord droit et du haut de la zone. */
  cornerInset: { x: number; y: number };
  /** Textes, dessins et obstacles rigides gonflés de tant de px, puis arrondis vers l'extérieur au multiple de `snapPx`. */
  textMarginPx: number;
  snapPx: number;
  /** Épaisseur du trait peint quand la page ne la dit pas (`--brush-trait`). */
  defaultTraitPx: number;
  /** « Vos activités » (ordinateur) monte de tant de px au-dessus de la zone : plus que le débord de l'eau (`WATER_RULES.marginPx`). */
  aboveZonePx: number;
  /** Écart laissé entre l'angle de départ et « Vos activités » quand elle borde la colonne du Profil, en px. */
  frameMarginPx: number;
}

export const SCHOOL_MEASURE: SchoolMeasureRules = {
  cornerInset: { x: 4, y: 6 },
  textMarginPx: 3,
  snapPx: 8,
  defaultTraitPx: 12,
  aboveZonePx: 100,
  frameMarginPx: 8,
};

/** La page mesurée : le calcul, sa clé, la place du dessin dans la page et les voiles à repeindre. */
export interface MeasuredSchool {
  layout: SchoolLayout;
  key: string;
  /** Haut de la zone dans la page, en px (bas de la photo d'en-tête). */
  top: number;
  veils: Box[];
}

const snapOut = (b: Box, margin: number, snap: number): Box => ({
  x: Math.floor((b.x - margin) / snap) * snap,
  y: Math.floor((b.y - margin) / snap) * snap,
  r: Math.ceil((b.r + margin) / snap) * snap,
  b: Math.ceil((b.b + margin) / snap) * snap,
});

const hasArea = (r: DOMRect): boolean => r.width > 0 && r.height > 0;

export const measureSchoolLayout = (page: HTMLElement, rules: SchoolMeasureRules = SCHOOL_MEASURE): MeasuredSchool | null => {
  const column = page.querySelector<HTMLElement>('.ui-page.profile');
  if (!column) return null;
  const pageRect = page.getBoundingClientRect();
  const hero = page.querySelector('.profile-hero');
  const top = hero ? hero.getBoundingClientRect().bottom - pageRect.top : 0;
  const ox = pageRect.left;
  const oy = pageRect.top + top;
  const zone = { w: pageRect.width, h: pageRect.height - top };
  if (zone.w <= 0 || zone.h <= 0) return null;
  const boxOf = (r: DOMRect): Box => ({ x: r.left - ox, y: r.top - oy, r: r.right - ox, b: r.bottom - oy });
  const snapped = (r: DOMRect): Box => snapOut(boxOf(r), rules.textMarginPx, rules.snapPx);

  /** Rectangles des textes, dessins et boutons d'un bloc. */
  const contentBoxes = (root: Element): Box[] => {
    const out: Box[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (hasArea(r)) out.push(snapped(r));
    }
    for (const el of root.querySelectorAll(SOLID_SELECTOR)) {
      const r = el.getBoundingClientRect();
      if (hasArea(r)) out.push(snapped(r));
    }
    return out;
  };

  const masked = typeof CSS !== 'undefined' && CSS.supports('-webkit-mask-box-image', 'none');
  const frameEls = [...column.querySelectorAll<HTMLElement>(FRAME_SELECTOR)].filter((el) => hasArea(el.getBoundingClientRect()));
  const frames: SchoolFrame[] = frameEls.map((el) => {
    const style = getComputedStyle(el);
    const fx = Number.parseFloat(style.getPropertyValue('--brush-fx')) || 1;
    const fy = Number.parseFloat(style.getPropertyValue('--brush-fy')) || 1;
    const trait = Number.parseFloat(style.getPropertyValue('--brush-trait')) || rules.defaultTraitPx;
    return { box: boxOf(el.getBoundingClientRect()), corner: masked ? brushCorner(fx, fy) : null, trait };
  });
  const texts = frameEls.flatMap(contentBoxes);

  // Hors des cadres : l'en-tête et tout autre bloc de la colonne (aide, état de la mémoire), par leurs textes et
  // boutons. Une fenêtre posée par-dessus la page ne compte pas.
  const blocks = [...column.children].flatMap((el) => (getComputedStyle(el).display === 'contents' ? [...el.children] : [el]));
  const rigid = blocks
    .filter((el) => !frameEls.includes(el as HTMLElement))
    .filter((el) => !['fixed', 'absolute'].includes(getComputedStyle(el).position))
    .flatMap(contentBoxes);
  // Sur ordinateur, « Vos activités » en entier, comme un cadre fermé qui monte jusqu'à la photo : ni poisson ni eau
  // n'y entrent, et l'eau la contourne par le même chemin que le banc au lieu de passer dessous ou au-dessus.
  const activities = page.querySelector('.profile-activities');
  const columnBox = boxOf(column.getBoundingClientRect());
  let right = zone.w;
  if (activities && hasArea(activities.getBoundingClientRect())) {
    const box = boxOf(activities.getBoundingClientRect());
    frames.push({ box: { ...box, y: Math.min(box.y, -rules.aboveZonePx) }, corner: null, trait: rules.defaultTraitPx });
    // À côté de la colonne du Profil (deux colonnes) : le banc naît en haut à droite de celle-ci, contre « Vos activités ».
    if (box.x >= columnBox.r) right = Math.min(box.x - rules.frameMarginPx, zone.w);
  }

  const layout: SchoolLayout = {
    zone,
    corner: { x: right - rules.cornerInset.x, y: rules.cornerInset.y },
    rigid,
    frames,
    texts,
  };
  const veils = frameEls.filter((el) => el.matches(VEILED_SELECTOR)).map((el) => boxOf(el.getBoundingClientRect()));
  return { layout, key: schoolLayoutKey(layout, 'all'), top, veils };
};
