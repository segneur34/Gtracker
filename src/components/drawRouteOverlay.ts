import { cardTop, fitView, fullView, mapHeight, projectPoint, SHARE_IMAGE, type ShareView } from '../core/shareImage';
import { END_COLOR, ROUTE_COLOR, START_COLOR } from '../planning/routeColors';
import { placeLegPills, type RouteImageMark, type RouteShareContent } from '../planning/routeShareImage';

/**
 * Itinéraire sur l'image de partage (`drawShareImage`) : le tracé bleu sur un
 * liseré blanc, les balises numérotées (départ vert, arrivée rouge, les autres
 * bleues, le départ d'une boucle moitié vert, moitié rouge), une pastille
 * blanche « distance · cap » par bord, et la flèche du nord en haut à droite.
 * Ce qui se montre et la place des pastilles se calculent dans
 * `planning/routeShareImage.ts`.
 */

/** Ce que le dessin reprend de l'image : la police et deux couleurs de l'interface (palette claire). */
export interface RouteOverlayStyle {
  font: string;
  ink: string;
  /** Contour des pastilles et de la rose. */
  line: string;
}

/** Marge entre l'itinéraire et le bord de sa zone de cadrage : la place d'une pastille de chaque côté. */
const ROUTE_PADDING_PX = 130;
/** Tracé et son liseré blanc. */
const LINE_PX = 10;
const HALO_PX = 18;
/** Balises : rayon, cerne blanc et chiffre. */
const MARK_RADIUS_PX = 26;
const MARK_RING_PX = 5;
const MARK_FONT_PX = 26;
/** Pastilles : hauteur, marge du texte de chaque côté, taille du texte. */
const PILL_HEIGHT_PX = 52;
const PILL_PAD_X_PX = 22;
const PILL_FONT_PX = 28;
/** Écart des pastilles avec les bords de l'image et le haut du cartouche. */
const PILL_FRAME_MARGIN_PX = 16;
/** Rose du nord : rayon, et centre sous le haut de l'image, entre titre et sous-titre. */
const NORTH_RADIUS_PX = 40;
const NORTH_CENTER_Y_PX = 118;

/** Place que la rose du nord prend à droite du titre et du sous-titre. */
export const NORTH_ARROW_ROOM_PX = 2 * NORTH_RADIUS_PX + 30;

/** Rectangle aux coins arrondis, ajouté au chemin courant ; coins droits sur un canevas trop ancien. */
const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

const markFill = (role: RouteImageMark['role']): string =>
  role === 'start' ? START_COLOR : role === 'end' ? END_COLOR : ROUTE_COLOR;

/** Une balise : un rond plein cerné de blanc, son numéro en blanc. */
const drawMark = (ctx: CanvasRenderingContext2D, mark: RouteImageMark, p: { x: number; y: number }, font: string) => {
  ctx.save();
  if (mark.role === 'loop') {
    // Départ d'une boucle, qui en est aussi l'arrivée : moitié gauche verte, moitié droite rouge.
    ctx.beginPath();
    ctx.arc(p.x, p.y, MARK_RADIUS_PX, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.fillStyle = START_COLOR;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, MARK_RADIUS_PX, -Math.PI / 2, Math.PI / 2);
    ctx.fillStyle = END_COLOR;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, MARK_RADIUS_PX, 0, 2 * Math.PI);
    ctx.fillStyle = markFill(mark.role);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, MARK_RADIUS_PX, 0, 2 * Math.PI);
  ctx.lineWidth = MARK_RING_PX;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${MARK_FONT_PX}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mark.label, p.x, p.y + 1);
  ctx.restore();
};

/**
 * Cadrage de l'itinéraire entre le titre et le cartouche de `count` chiffres,
 * la carte s'étendant à toute l'image, et son dessin.
 */
export const routeOverlay = (
  ctx: CanvasRenderingContext2D,
  course: RouteShareContent,
  count: number,
  style: RouteOverlayStyle
): { view: ShareView | null; draw: () => void } => {
  const points = [
    ...course.paths.flatMap((path) => path.map((p): [number, number] => [p.lat, p.lon])),
    ...course.marks.map((m): [number, number] => [m.lat, m.lon]),
  ];
  const fitted = fitView(points, SHARE_IMAGE.widthPx, mapHeight(count), ROUTE_PADDING_PX);
  const view = fitted && fullView(fitted, SHARE_IMAGE.frameTopPx, SHARE_IMAGE.heightPx);
  return { view, draw: () => {
    if (!view) return;
    const at = (p: { lat: number; lon: number }) => projectPoint(view, p.lat, p.lon);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Liseré blanc de tout le tracé d'abord, puis le tracé : une jonction de tronçons ne coupe pas le trait.
    for (const [color, width] of [['rgba(255, 255, 255, 0.9)', HALO_PX], [ROUTE_COLOR, LINE_PX]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (const path of course.paths) {
        if (path.length < 2) continue;
        ctx.beginPath();
        path.forEach((p, i) => {
          const { x, y } = at(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    ctx.restore();

    const marks = course.marks.map((m) => ({ mark: m, p: at(m) }));
    for (const { mark, p } of marks) drawMark(ctx, mark, p, style.font);

    ctx.save();
    ctx.font = `600 ${PILL_FONT_PX}px ${style.font}`;
    const requests = course.pills.map((pill) => {
      const anchor = at(pill.anchor);
      const before = at(pill.before);
      const after = at(pill.after);
      return {
        x: anchor.x, y: anchor.y, dx: after.x - before.x, dy: after.y - before.y,
        width: ctx.measureText(pill.text).width + 2 * PILL_PAD_X_PX, height: PILL_HEIGHT_PX,
      };
    });
    const bottom = count > 0 ? cardTop(count) : SHARE_IMAGE.heightPx - SHARE_IMAGE.footerVeilPx;
    const placed = placeLegPills(
      requests,
      marks.map(({ p }) => ({ x: p.x, y: p.y, radius: MARK_RADIUS_PX + MARK_RING_PX })),
      {
        left: PILL_FRAME_MARGIN_PX, top: SHARE_IMAGE.frameTopPx,
        right: SHARE_IMAGE.widthPx - PILL_FRAME_MARGIN_PX, bottom: bottom - PILL_FRAME_MARGIN_PX,
      }
    );
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    placed.forEach((box, i) => {
      ctx.beginPath();
      roundedRect(ctx, box.x - box.width / 2, box.y - box.height / 2, box.width, box.height, box.height / 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = style.line;
      ctx.stroke();
      ctx.fillStyle = style.ink;
      ctx.fillText(course.pills[i].text, box.x, box.y + 1);
    });
    ctx.restore();
  } };
};

/** Rose du nord, en haut à droite : un rond blanc cerné, une flèche à l'encre pointée vers le haut de l'image. */
export const drawNorthArrow = (ctx: CanvasRenderingContext2D, style: RouteOverlayStyle) => {
  const x = SHARE_IMAGE.widthPx - SHARE_IMAGE.marginPx - NORTH_RADIUS_PX;
  const y = NORTH_CENTER_Y_PX;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, NORTH_RADIUS_PX, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.line;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x + 13, y + 18);
  ctx.lineTo(x, y + 9);
  ctx.lineTo(x - 13, y + 18);
  ctx.closePath();
  ctx.fillStyle = style.ink;
  ctx.fill();
  ctx.restore();
};
