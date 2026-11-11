/**
 * Moyenne glissante de la FC en temps actif : une fenêtre de mesures récentes, et sa moyenne pondérée par le temps
 * sur les dernières secondes. Sert à l'alerte de zone cardiaque ; rien n'y dépend d'un sport (règle 2 : tout en secondes).
 */

/** Une mesure en temps actif (pauses ôtées), avec la FC si elle y est. */
export interface WindowSample {
  activeMs: number;
  hrBpm?: number;
}

/**
 * Moyenne pondérée par le temps de la FC sur les `windowS` dernières
 * secondes actives : chaque mesure vaut depuis la précédente. `null` si la
 * fenêtre n'en couvre pas la moitié (départ, reprise après un trou).
 * `endMs` : fenêtre finissant à cet instant passé plutôt qu'à `nowMs`.
 */
export const windowMean = (
  window: WindowSample[], windowS: number, nowMs: number, endMs: number = nowMs
): number | null => {
  const fromMs = endMs - windowS * 1000;
  let sum = 0;
  let dur = 0;
  for (let i = window.length - 1; i > 0; i--) {
    const cur = window[i];
    const prevMs = window[i - 1].activeMs;
    if (cur.activeMs <= fromMs) break;
    if (prevMs >= endMs) continue;
    const value = cur.hrBpm;
    if (value === undefined) continue;
    const w = Math.min(cur.activeMs, endMs) - Math.max(prevMs, fromMs);
    sum += value * w;
    dur += w;
  }
  return dur >= (windowS * 1000) / 2 ? sum / dur : null;
};
