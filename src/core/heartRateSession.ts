import { sampledIndices } from './chartZoom';
import { pointTimeMs } from './kinematics';
import type { HeartRatePoint } from './heartRate';
import type { TimedTrackPoint } from './types';

/**
 * Points d'une session sans trace (muscu, lot I du 25/10) : la FC de la
 * ceinture, horodatée, sans position ni cinématique, et sa durée hors pauses.
 * Tout se mesure en temps (règle 2). Le résumé (`library/summary.ts`) et la
 * dépense cardio (`core/hrEnergy.ts`, voile et surf aussi) les lisent, et
 * la courbe de FC des vignettes de la bibliothèque (`heartRatePreviewPath`).
 * L'analyse de la séance, propre à l'Entraînement, est partie au lot 303.
 */

/** Point d'une session sans trace : l'heure, la FC éventuelle, et la reprise après une pause. */
export interface HeartRateSessionPoint extends HeartRatePoint {
  segmentStart?: true;
}

/**
 * Points horodatés lus dans le GPX (`ParsedGpx.timedPoints`), en millisecondes ;
 * un point à l'heure illisible, ou qui n'est pas plus tard que le précédent, est
 * écarté (sa reprise passe au suivant gardé).
 */
export const heartRatePointsFrom = (timed: readonly TimedTrackPoint[]): HeartRateSessionPoint[] => {
  const out: HeartRateSessionPoint[] = [];
  let resume = false;
  for (const p of timed) {
    resume ||= p.segmentStart === true;
    const timeMs = pointTimeMs(p.time);
    if (!isFinite(timeMs) || (out.length > 0 && timeMs <= out[out.length - 1].timeMs)) continue;
    out.push({ timeMs, ...(p.hr !== undefined ? { hr: p.hr } : {}), ...(resume && out.length > 0 ? { segmentStart: true as const } : {}) });
    resume = false;
  }
  return out;
};

/** Durée hors pauses, en secondes : la somme des pas, sauf celui qui mène à une reprise. */
export const activeDurationS = (points: readonly HeartRateSessionPoint[]): number => {
  let totalMs = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].segmentStart) continue;
    totalMs += points[i].timeMs - points[i - 1].timeMs;
  }
  return totalMs / 1000;
};

/**
 * Courbe de FC d'une vignette (bibliothèque), en chemin SVG dans un cadre
 * `width` × `height` : le temps en abscisse, la FC lissée en ordonnée, de la
 * plus basse (en bas) à la plus haute ; `maxPoints` points au plus, coupée là
 * où la FC manque. `null` sans deux FC.
 */
export const heartRatePreviewPath = (
  points: readonly HeartRatePoint[],
  smoothed: readonly (number | null)[],
  width: number,
  height: number,
  maxPoints: number
): string | null => {
  const shown = smoothed.filter((v): v is number => v !== null);
  if (shown.length < 2 || points.length < 2) return null;
  const t0 = points[0].timeMs;
  const spanMs = Math.max(1, points[points.length - 1].timeMs - t0);
  // Boucle plutôt que Math.min(...série) : une longue séance dépasserait la
  // limite d'arguments d'un appel de fonction.
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of shown) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const spanBpm = Math.max(1, hi - lo);
  const parts: string[] = [];
  let pen = false;
  for (const i of sampledIndices(0, points.length - 1, maxPoints, smoothed)) {
    const bpm = smoothed[i];
    if (bpm === null) {
      pen = false;
      continue;
    }
    const x = ((points[i].timeMs - t0) / spanMs) * width;
    const y = height - ((bpm - lo) / spanBpm) * height;
    parts.push(`${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
    pen = true;
  }
  return parts.length > 1 ? parts.join('') : null;
};
