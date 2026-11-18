import { normalizeDeg, toDeg, toRad } from '../core/angles';
import { median } from '../core/basics';
import { planeProjection, type PlanePoint } from '../core/geo';
import type { LatLon, TrackPoint } from '../core/types';
import type { WaveSense } from './waveSense';

/**
 * Zone du pic d'une session de surf : une ellipse qui contient les départs des
 * glisses (début remonté d'une vague, décollage d'un vol sur foil), une seule
 * pour toute la session. Pur, en SI.
 *
 * Son grand axe court en travers du sens des vagues, le long de la ligne de
 * déferlement où le pic s'étale ; son petit axe suit le sens des vagues. Les
 * demi-axes partent de la boîte des départs dans ce repère, plus une marge, le
 * grand axe vaut au moins `ZONE_MIN_ASPECT` fois le petit, puis l'ellipse
 * grandit jusqu'à garder la marge autour de chaque départ : la zone ne fait que
 * grandir.
 *
 * Un départ loin vers la plage (une vague de l'intérieur, reprise en chemin)
 * n'entre pas dans la zone : il est à plus de `ZONE_INSIDE_M` de la médiane des
 * départs, le long du sens des vagues. Sans sens estimé, l'axe de la zone est
 * l'axe principal des départs (trois au moins), sinon la zone est un cercle ;
 * la plage n'est alors pas connue, et aucun départ n'est écarté.
 *
 * Le retour au pic se mesure jusqu'à l'entrée dans la zone (`zoneEntry`),
 * calculée sur le segment entre deux points : un long pas qui traverse le bord
 * compte (règle 10), mais pas un trou de la trace, jamais interpolé.
 */

/**
 * Marge ajoutée aux demi-axes, en mètres : une zone d'un seul départ n'est pas
 * un point, et un départ au bord n'est pas hors zone pour le bruit du GPS.
 */
export const ZONE_MARGIN_M = 15;

/** Rapport minimal du grand axe au petit : la zone reste oblongue, en travers des vagues. */
export const ZONE_MIN_ASPECT = 1.5;

/**
 * Distance vers la plage, en mètres le long du sens des vagues, au-delà de
 * laquelle un départ est une vague de l'intérieur, comptée depuis la médiane
 * des départs : il ne fait pas la zone.
 */
export const ZONE_INSIDE_M = 40;

/** Constantes de la zone du pic, surchargeables pour les tests. */
export interface PeakZoneOptions {
  zoneMarginM?: number;
  zoneMinAspect?: number;
  zoneInsideM?: number;
}

/** D'où vient l'axe de la zone : le sens des vagues, l'axe principal des départs, ou aucun (un cercle). */
export type PeakZoneOrientation = 'vagues' | 'departs' | 'cercle';

export interface PeakZone {
  center: LatLon;
  /** Demi-grand axe, en mètres, en travers des vagues. */
  semiMajorM: number;
  /** Demi-petit axe, en mètres, le long du sens des vagues. */
  semiMinorM: number;
  /** Cap du grand axe, en degrés depuis le nord, de 0 à 180. */
  majorAxisDeg: number;
  orientation: PeakZoneOrientation;
  /** Points de la trace des départs qui font la zone. */
  departures: number[];
  /** Points de la trace des départs de l'intérieur, écartés de la zone. */
  insideDepartures: number[];
}

/** Entrée dans la zone : l'instant et la position, interpolés sur le pas qui franchit le bord. */
export interface ZoneEntry extends LatLon {
  timeMs: number;
}

/** Vecteurs unitaires du grand axe, au cap `majorAxisDeg`, et du petit axe, 90° plus loin dans le sens inverse des aiguilles. */
const axesOf = (majorAxisDeg: number): { major: PlanePoint; minor: PlanePoint } => {
  const phi = toRad(majorAxisDeg);
  return { major: { x: Math.sin(phi), y: Math.cos(phi) }, minor: { x: -Math.cos(phi), y: Math.sin(phi) } };
};

const dot = (a: PlanePoint, b: PlanePoint): number => a.x * b.x + a.y * b.y;

/** Cap de l'axe principal d'un nuage de points, de 0 à 180 ; `null` s'il n'en a pas (points confondus ou nuage rond). */
const principalAxisDeg = (points: PlanePoint[]): number | null => {
  const mx = points.reduce((s, q) => s + q.x, 0) / points.length;
  const my = points.reduce((s, q) => s + q.y, 0) / points.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const q of points) {
    sxx += (q.x - mx) ** 2;
    syy += (q.y - my) ** 2;
    sxy += (q.x - mx) * (q.y - my);
  }
  const spread = sxx + syy;
  if (spread === 0 || Math.hypot(sxx - syy, 2 * sxy) <= 1e-9 * spread) return null;
  // Angle de l'axe depuis l'est, sens inverse des aiguilles ; le cap se compte depuis le nord, sens des aiguilles.
  const alpha = Math.atan2(2 * sxy, sxx - syy) / 2;
  return normalizeDeg(90 - toDeg(alpha)) % 180;
};

/**
 * Directions où se vérifie la marge autour de chaque départ : le disque de la
 * marge, approché par ce nombre de points, l'est à 0,5 % de son rayon près.
 */
const MARGIN_DIRECTIONS = 32;

/**
 * Zone du pic, faite des départs `departures` (points de la trace), orientée
 * par le sens des vagues `sense` s'il est estimé. `null` sans départ.
 */
export const buildPeakZone = (
  track: readonly TrackPoint[], departures: readonly number[], sense: WaveSense | null, opts: PeakZoneOptions = {}
): PeakZone | null => {
  if (departures.length === 0) return null;
  const marginM = opts.zoneMarginM ?? ZONE_MARGIN_M;
  const origin = {
    lat: departures.reduce((s, i) => s + track[i].lat, 0) / departures.length,
    lon: departures.reduce((s, i) => s + track[i].lon, 0) / departures.length,
  };
  const proj = planeProjection(origin.lat, origin);
  const points = departures.map((i) => proj.to(track[i]));

  let orientation: PeakZoneOrientation;
  let majorAxisDeg = 0;
  let kept = departures.map((_, k) => k);
  if (sense !== null) {
    orientation = 'vagues';
    majorAxisDeg = normalizeDeg(sense.directionDeg + 90) % 180;
    // Position de chaque départ le long du sens des vagues, croissante vers la plage.
    const toBeach = { x: Math.sin(toRad(sense.directionDeg)), y: Math.cos(toRad(sense.directionDeg)) };
    const along = points.map((q) => dot(q, toBeach));
    const mid = median(along);
    const insideM = opts.zoneInsideM ?? ZONE_INSIDE_M;
    kept = kept.filter((k) => along[k] - mid <= insideM);
  } else {
    const axis = departures.length >= 3 ? principalAxisDeg(points) : null;
    orientation = axis === null ? 'cercle' : 'departs';
    majorAxisDeg = axis ?? 0;
  }

  const { major, minor } = axesOf(majorAxisDeg);
  const s = kept.map((k) => dot(points[k], major));
  const a = kept.map((k) => dot(points[k], minor));
  const sMid = (Math.min(...s) + Math.max(...s)) / 2;
  const aMid = (Math.min(...a) + Math.max(...a)) / 2;
  const sHalf = (Math.max(...s) - Math.min(...s)) / 2;
  const aHalf = (Math.max(...a) - Math.min(...a)) / 2;

  let semiMajorM: number;
  let semiMinorM: number;
  if (orientation === 'cercle') {
    semiMajorM = Math.max(...kept.map((_, j) => Math.hypot(s[j] - sMid, a[j] - aMid))) + marginM;
    semiMinorM = semiMajorM;
  } else {
    // La boîte des départs et la marge, puis l'allongement minimal.
    semiMinorM = aHalf + marginM;
    semiMajorM = Math.max(sHalf + marginM, (opts.zoneMinAspect ?? ZONE_MIN_ASPECT) * semiMinorM);
    // Le disque de la marge autour de chaque départ tient dans la zone : là où l'ellipse se resserre (au bout du
    // grand axe, dans les coins de la boîte), elle grandit d'un même facteur sur ses deux axes.
    let k = 1;
    for (let j = 0; j < kept.length; j++) {
      for (let d = 0; d < MARGIN_DIRECTIONS; d++) {
        const angle = (2 * Math.PI * d) / MARGIN_DIRECTIONS;
        const ds = s[j] - sMid + marginM * Math.cos(angle);
        const da = a[j] - aMid + marginM * Math.sin(angle);
        k = Math.max(k, Math.hypot(ds / semiMajorM, da / semiMinorM));
      }
    }
    semiMajorM *= k;
    semiMinorM *= k;
  }
  const center = proj.from({ x: sMid * major.x + aMid * minor.x, y: sMid * major.y + aMid * minor.y });
  return {
    center, semiMajorM, semiMinorM, majorAxisDeg, orientation,
    departures: kept.map((k) => departures[k]),
    insideDepartures: departures.filter((_, k) => !kept.includes(k)),
  };
};

/** Position en coordonnées de l'ellipse ramenée au cercle unité : dedans si la norme ne dépasse pas 1. */
const unitFrameOf = (zone: PeakZone): ((p: LatLon) => PlanePoint) => {
  const proj = planeProjection(zone.center.lat, zone.center);
  const { major, minor } = axesOf(zone.majorAxisDeg);
  return (p) => {
    const q = proj.to(p);
    return { x: dot(q, major) / zone.semiMajorM, y: dot(q, minor) / zone.semiMinorM };
  };
};

const insideUnit = (u: PlanePoint): boolean => dot(u, u) <= 1;

/** La position est-elle dans la zone (bord compris) ? */
export const isInZone = (zone: PeakZone, p: LatLon): boolean => insideUnit(unitFrameOf(zone)(p));

/**
 * Premier instant, de 0 à 1 le long du segment `u0` → `u1` (coordonnées du
 * cercle unité, `u0` dehors), où il entre dans le cercle ; `null` s'il n'y entre pas.
 */
const firstInside = (u0: PlanePoint, u1: PlanePoint): number | null => {
  const d = { x: u1.x - u0.x, y: u1.y - u0.y };
  const qa = dot(d, d);
  if (qa === 0) return null;
  const qb = 2 * dot(u0, d);
  const qc = dot(u0, u0) - 1;
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return null;
  const t = (-qb - Math.sqrt(disc)) / (2 * qa);
  return t >= 0 && t <= 1 ? t : null;
};

/**
 * Première entrée dans la zone entre les points `from` et `to` : le point
 * `from` lui-même s'il y est déjà, sinon le franchissement du bord, interpolé
 * dans le temps et l'espace sur le pas qui le porte. Un pas plus long que
 * `maxGapS`, ou la reprise d'une pause (`segmentStart`), n'est pas interpolé :
 * seul son point d'arrivée compte. `null` si la trace n'y entre pas.
 */
export const zoneEntry = (
  track: readonly TrackPoint[], zone: PeakZone, from: number, to: number, maxGapS: number
): ZoneEntry | null => {
  const unit = unitFrameOf(zone);
  const at = (i: number): ZoneEntry => ({ timeMs: track[i].timeMs, lat: track[i].lat, lon: track[i].lon });
  let prev = unit(track[from]);
  if (insideUnit(prev)) return at(from);
  for (let i = from + 1; i <= to; i++) {
    const cur = unit(track[i]);
    const a = track[i - 1];
    const b = track[i];
    if (b.segmentStart || (b.timeMs - a.timeMs) / 1000 > maxGapS) {
      if (insideUnit(cur)) return at(i);
    } else {
      const t = firstInside(prev, cur);
      if (t !== null) {
        return { timeMs: a.timeMs + t * (b.timeMs - a.timeMs), lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) };
      }
    }
    prev = cur;
  }
  return null;
};

/** Contour de la zone, `n` points répartis sur l'ellipse, pour la dessiner. */
export const peakZoneOutline = (zone: PeakZone, n = 64): LatLon[] => {
  const proj = planeProjection(zone.center.lat, zone.center);
  const { major, minor } = axesOf(zone.majorAxisDeg);
  return Array.from({ length: n }, (_, k) => {
    const angle = (2 * Math.PI * k) / n;
    const s = zone.semiMajorM * Math.cos(angle);
    const a = zone.semiMinorM * Math.sin(angle);
    return proj.from({ x: s * major.x + a * minor.x, y: s * major.y + a * minor.y });
  });
};
