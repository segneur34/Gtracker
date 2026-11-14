import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createSchoolPlanner, fishCount, SCHOOL_RULES, sessionOfFish, type SchoolFish, type SchoolPlanner, type SchoolStyle } from '../../core/fishSchool';
import { waterMaps, waterOutline, type WaterMaps, type WaterOutline } from '../../core/schoolWater';
import FishSprite from './FishSprite';
import { fishScale, fishSymbolId } from './fishSymbols';
import { measureSchoolLayout, type MeasuredSchool } from './measureSchoolLayout';
import './FishSchool.css';

/**
 * Banc de poissons du Profil : la couche qui mesure la page (`measureSchoolLayout`), demande les places et l'eau au
 * calcul (`core/fishSchool.ts`, `core/schoolWater.ts`) et les dessine en un seul SVG, sous le contenu. Chargée à part
 * (`lazy`), avec ses dessins : rien du banc ne pèse sur l'ouverture de l'application.
 *
 * Les places ne dépendent que de la page : un planificateur par mise en page, gardé en mémoire, si bien qu'une session
 * de plus ne calcule que ses poissons et le contour de l'eau. La page se relit à chaque changement de taille (largeur,
 * rotation, cadre déplié), regroupé à l'image suivante ; le calcul passe quand le navigateur est libre, et l'ancien banc
 * reste affiché jusque-là. Le temps du dernier calcul est écrit dans `data-ms`.
 */

interface Props {
  /** Nombre de sessions du banc (toutes celles de la bibliothèque, ou le réglage d'essai). */
  sessions: number;
  /** Couleur d'activité de chaque session, de la plus ancienne à la plus récente ; `null` : l'encre. */
  colors: readonly (string | null)[];
  style: SchoolStyle;
  /** La page est prête à être mesurée : mémoire lue, fiches calculées. La mesure commence la première fois. */
  ready: boolean;
  /** Le banc est-il dessiné (voiles repeints compris) : la page rend alors ses cadres transparents. */
  onShown: (shown: boolean) => void;
}

interface Drawn {
  key: string;
  fish: SchoolFish[];
  water: WaterOutline;
  ms: number;
}

/** Planificateurs et cartes de l'eau des dernières mises en page, par clé : un retour à une largeur déjà vue ne recalcule rien. */
const CACHE_SIZE = 4;
const cache = new Map<string, { planner: SchoolPlanner; maps: WaterMaps | null }>();
const plannerFor = (measured: MeasuredSchool) => {
  let entry = cache.get(measured.key);
  if (!entry) {
    entry = { planner: createSchoolPlanner(measured.layout), maps: null };
    cache.set(measured.key, entry);
    while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  }
  return entry;
};

/** Le calcul quand le navigateur est libre (au plus tard une demi-seconde après), sinon au tour suivant. */
const IDLE_TIMEOUT_MS = 500;
const whenIdle = (run: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 0);
  return () => window.clearTimeout(id);
};

const n1 = (v: number): string => v.toFixed(1);

function FishSchool({ sessions, colors, style, ready, onShown }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [measured, setMeasured] = useState<MeasuredSchool | null>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);

  // Mesure : dès que la page est prête une première fois, polices chargées, puis à chaque changement de taille de la page,
  // de sa colonne ou de « Vos activités » (ordinateur, chargée à part, qui change de hauteur seule) ; toujours, même
  // pendant une nouvelle lecture de la bibliothèque, pour que les voiles repeints suivent les cadres.
  const [armed, setArmed] = useState(ready);
  if (ready && !armed) setArmed(true);
  useLayoutEffect(() => {
    const page = svgRef.current?.parentElement;
    if (!armed || !page) return;
    let frame = 0;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const next = measureSchoolLayout(page);
      setMeasured((prev) => (prev && next && prev.key === next.key && prev.top === next.top && sameBoxes(prev.veils, next.veils) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    void document.fonts?.ready.then(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(page);
    const column = page.querySelector('.ui-page.profile');
    if (column) observer.observe(column);
    // « Vos activités » arrive après la page : un regard sur les seuls enfants du corps de la page, pour l'observer dès
    // qu'elle paraît (une nouvelle mesure ne change pas ces enfants : pas de boucle).
    let activities: Element | null = null;
    const watchActivities = () => {
      const next = page.querySelector('.profile-activities');
      if (next === activities) return;
      if (activities) observer.unobserve(activities);
      activities = next;
      if (activities) observer.observe(activities);
      schedule();
    };
    watchActivities();
    const body = page.querySelector('.profile-body');
    const arrivals = new MutationObserver(watchActivities);
    if (body) arrivals.observe(body, { childList: true });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      arrivals.disconnect();
    };
  }, [armed]);

  // Calcul des places et de l'eau, au repos du navigateur ; l'ancien dessin reste jusqu'au nouveau.
  const total = fishCount(sessions);
  useEffect(() => {
    if (!measured) return;
    return whenIdle(() => {
      const t0 = performance.now();
      const entry = plannerFor(measured);
      const fish = entry.planner.places(total);
      entry.maps ??= waterMaps(measured.layout);
      const water = waterOutline(measured.layout, fish, undefined, undefined, entry.maps);
      setDrawn({ key: measured.key, fish, water, ms: performance.now() - t0 });
    });
  }, [measured, total]);

  const shown = measured !== null && drawn !== null;
  useLayoutEffect(() => {
    onShown(shown);
  }, [shown, onShown]);
  useLayoutEffect(() => () => onShown(false), [onShown]);

  const svgStyle: CSSProperties | undefined = measured
    ? { top: `${measured.top}px`, width: `${measured.layout.zone.w}px`, height: `${measured.layout.zone.h}px` }
    : undefined;

  return (
    <svg ref={svgRef} className="fish-school" style={svgStyle} aria-hidden="true" focusable="false"
      data-ms={drawn ? Math.round(drawn.ms) : undefined} data-fish={drawn ? drawn.fish.length : undefined}>
      {shown && (
        <>
          <FishSprite style={style} />
          {measured.veils.map((v, i) => (
            <rect key={i} className="fish-school__veil" x={v.x} y={v.y} width={v.r - v.x} height={v.b - v.y} />
          ))}
          {drawn.water.edge && (
            <>
              <path className="fish-school__water" d={drawn.water.edge} />
              <path className="fish-school__edge" d={drawn.water.edge} />
              {drawn.water.tides.map((d, i) => d && <path key={i} className="fish-school__tide" d={d} />)}
            </>
          )}
          {drawn.fish.map((f, i) => {
            const session = sessionOfFish(i);
            const color = colors.length > 0 ? colors[session % colors.length] : null;
            return (
              <use key={i} href={`#${fishSymbolId(style, f.shape)}`}
                transform={`translate(${n1(f.x)} ${n1(f.y)}) rotate(${n1(f.angle)}) scale(${fishScale(f.size).toFixed(3)})`}
                opacity={f.inFrame ? SCHOOL_RULES.frameOpacity : undefined}
                style={color ? ({ '--fish-act': color } as CSSProperties) : undefined} />
            );
          })}
        </>
      )}
    </svg>
  );
}

const sameBoxes = (a: readonly { x: number; y: number; r: number; b: number }[], b: readonly { x: number; y: number; r: number; b: number }[]): boolean =>
  a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y && p.r === b[i].r && p.b === b[i].b);

export default FishSchool;
