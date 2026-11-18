import { angleDiff, circularMean, normalizeDeg, toDeg } from '../core/angles';
import { planeProjection } from '../core/geo';
import type { ActiveRun } from '../core/sessionStats';
import type { TrackPoint } from '../core/types';

/**
 * Sens des vagues d'une session de surf : le cap vers lequel elles déferlent,
 * vers la plage, estimé sur les vagues prises comme le vent l'est sur les
 * manœuvres en voile, par une moyenne vectorielle pondérée, sans filtre. Pur,
 * en SI.
 *
 * Une mesure par glisse : son déplacement pendant les `WAVE_SENSE_WINDOW_S`
 * premières secondes, la descente, avant les virages. Les gauches et les
 * droites partent en biais de part et d'autre du sens et se compensent vers
 * lui. Chaque déplacement pèse sa longueur en mètres : une vague courte ou
 * lente compte moins, sans être écartée. La corde de toute la vague, trop
 * latérale, n'est pas retenue.
 *
 * Sur foil, une remontée faite en vol, pompée assez vite pour passer le seuil
 * de vague, va contre ce sens : `isAgainstWaveSense` la reconnaît.
 */

/** Fenêtre de la mesure, en secondes depuis le début de la glisse : la descente, avant que la vague ne tourne le long de la ligne de déferlement. */
export const WAVE_SENSE_WINDOW_S = 5;

/** Nombre de mesures sous lequel le sens n'est pas jugé fiable : trois vagues ne disent pas où va la houle. */
export const WAVE_SENSE_MIN_WAVES = 4;

/**
 * Longueur moyenne du vecteur (`R` de `circularMean`) sous laquelle le sens
 * n'est pas jugé fiable : des vagues parties dans tous les sens. Des gauches et des
 * droites à 50° de part et d'autre du sens donnent environ 0,64.
 */
export const WAVE_SENSE_MIN_R = 0.5;

/**
 * Écart au sens des vagues, en degrés, au-delà duquel une vague sur foil va
 * contre lui : une remontée pompée vers le large. Large, pour qu'une vague
 * prise très en biais reste une vague.
 */
export const WAVE_AGAINST_DEG = 120;

/** Constantes du sens des vagues, surchargeables pour les tests. */
export interface WaveSenseOptions {
  waveSenseWindowS?: number;
  waveSenseMinWaves?: number;
  waveSenseMinR?: number;
  waveAgainstDeg?: number;
}

export interface WaveSense {
  /** Cap vers lequel les vagues déferlent, en degrés depuis le nord, de 0 à 360. */
  directionDeg: number;
  /** Concentration des mesures, de 0 (tous les sens) à 1 (un seul). */
  R: number;
  /** Nombre de glisses mesurées. */
  samples: number;
  /** Vrai quand les mesures sont assez nombreuses et assez concentrées pour écarter des remontées pompées : au moins `waveSenseMinWaves` mesures et `R` d'au moins `waveSenseMinR`. */
  reliable: boolean;
  /** `saisi` : donné par l'utilisateur pour la session (`R` à 1, aucune mesure, fiable) ; `estime` : tiré de la trace. */
  source: 'saisi' | 'estime';
}

/** Sens des vagues saisi pour la session, cap vers lequel elles vont : il vaut un sens mesuré sans doute. */
export const enteredWaveSense = (directionDeg: number): WaveSense =>
  ({ directionDeg: normalizeDeg(directionDeg), R: 1, samples: 0, reliable: true, source: 'saisi' });

interface Displacement {
  bearingDeg: number;
  lengthM: number;
}

/** Position au temps `atMs`, entre les points `from` et `to`, interpolée sur le pas qui le contient : un long pas suffit (règle 10). */
const positionAt = (track: readonly TrackPoint[], from: number, to: number, atMs: number): { lat: number; lon: number } => {
  let j = from;
  while (j < to && track[j].timeMs < atMs) j++;
  const b = track[j];
  if (j === from || b.timeMs <= atMs) return b;
  const a = track[j - 1];
  const f = (atMs - a.timeMs) / (b.timeMs - a.timeMs);
  return { lat: a.lat + f * (b.lat - a.lat), lon: a.lon + f * (b.lon - a.lon) };
};

/** Déplacement du point `from` jusqu'à la position donnée, en mètres, et son cap. */
const displacementTo = (track: readonly TrackPoint[], from: number, to: { lat: number; lon: number }): Displacement => {
  const origin = track[from];
  const q = planeProjection(origin.lat, origin).to(to);
  return { bearingDeg: normalizeDeg(toDeg(Math.atan2(q.x, q.y))), lengthM: Math.hypot(q.x, q.y) };
};

/** Déplacement des `windowS` premières secondes d'une glisse, bornées à sa fin. */
const earlyDisplacement = (track: readonly TrackPoint[], run: ActiveRun, windowS: number): Displacement => {
  const atMs = Math.min(track[run.start].timeMs + windowS * 1000, track[run.end].timeMs);
  return displacementTo(track, run.start, positionAt(track, run.start, run.end, atMs));
};

/**
 * Sens des vagues tiré des glisses `rides` (sans foil, les vagues ; sur foil,
 * la vague qui lance chaque vol). `null` seulement sans aucune mesure ; sinon
 * le sens est rendu, avec `reliable` à faux quand il y a moins de
 * `waveSenseMinWaves` mesures ou que `R` est sous `waveSenseMinR`.
 */
export const estimateWaveSense = (
  track: readonly TrackPoint[], rides: readonly ActiveRun[], opts: WaveSenseOptions = {}
): WaveSense | null => {
  const windowS = opts.waveSenseWindowS ?? WAVE_SENSE_WINDOW_S;
  const measures = rides.map((r) => earlyDisplacement(track, r, windowS)).filter((d) => d.lengthM > 0);
  if (measures.length === 0) return null;
  const { mean, R } = circularMean(measures.map((d) => d.bearingDeg), measures.map((d) => d.lengthM));
  const reliable = measures.length >= (opts.waveSenseMinWaves ?? WAVE_SENSE_MIN_WAVES) && R >= (opts.waveSenseMinR ?? WAVE_SENSE_MIN_R);
  return { directionDeg: mean, R, samples: measures.length, reliable, source: 'estime' };
};

/**
 * Le passage `run` va-t-il contre le sens des vagues ? Sa corde, du début à la
 * fin, s'en écarte de plus de `waveAgainstDeg`. Un passage revenu à son point
 * de départ n'a pas de cap : il n'est pas jugé contre.
 */
export const isAgainstWaveSense = (
  track: readonly TrackPoint[], run: ActiveRun, sense: WaveSense, opts: WaveSenseOptions = {}
): boolean => {
  const chord = displacementTo(track, run.start, track[run.end]);
  return chord.lengthM > 0 && Math.abs(angleDiff(chord.bearingDeg, sense.directionDeg)) > (opts.waveAgainstDeg ?? WAVE_AGAINST_DEG);
};
