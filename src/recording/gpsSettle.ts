import type { LocationFix } from '../platform/location';

/**
 * Calage du GPS au départ d'un enregistrement. Les premières positions d'un GPS qui vient de s'allumer peuvent être
 * loin de la vraie, de quelques dizaines de mètres, et s'en rapprocher en quelques secondes : sans vitesse donnée par
 * le GPS, la vitesse tirée de ces positions part d'un pic, qui fausse la vitesse maximale et la distance, et la trace
 * commence par un trait droit. Tant que le GPS se cale, la trace ne commence pas : la position reçue ne sert qu'à la
 * carte. Elle démarre à la première position jugée calée, sur son incertitude et sur le temps écoulé, jamais sur un
 * nombre de positions (la cadence varie). Le calage ne vaut qu'au départ : une fois une position gardée, il ne joue
 * plus.
 */

/**
 * Incertitude, en mètres, sous laquelle une position est jugée calée : celle d'un GPS qui a trouvé ses satellites
 * (quelques mètres en plein air), quand la première position, tirée des antennes ou du wifi, en annonce des dizaines.
 */
export const SETTLED_ACCURACY_M = 10;

/**
 * Délai, en secondes depuis la première position reçue, au bout duquel la trace démarre quand même : un GPS qui ne
 * descend jamais sous `SETTLED_ACCURACY_M` (ciel masqué, téléphone qui l'annonce large) ne bloque pas
 * l'enregistrement, et la trace n'est amputée que de ce délai.
 */
export const SETTLE_MAX_WAIT_S = 10;

export interface SettleOptions {
  /** Incertitude jugée calée, en mètres. */
  accuracyM: number;
  /** Délai au bout duquel la trace démarre quand même, en secondes. */
  maxWaitS: number;
}

export const SETTLE_DEFAULTS: SettleOptions = { accuracyM: SETTLED_ACCURACY_M, maxWaitS: SETTLE_MAX_WAIT_S };

/** Verdict sur une position reçue pendant le calage : calée ou non, et l'heure de la première position vue, à garder. */
export interface SettleVerdict {
  settled: boolean;
  /** Heure de la première position vue pendant ce calage, en millisecondes : à rendre au jugement suivant. */
  firstSeenMs: number;
}

/**
 * Juge une position reçue tant qu'aucune n'est gardée. `firstSeenMs` : l'heure de la première position vue pendant ce
 * calage, `null` pour la première. Calée si son incertitude est d'au plus `accuracyM`, si elle n'en porte aucune
 * (navigateur, rejeu d'un fichier : rien ne permet d'en juger, elle est gardée comme avant), ou si `maxWaitS`
 * secondes se sont écoulées depuis la première, à l'heure des positions.
 */
export const judgeSettle = (
  firstSeenMs: number | null,
  fix: Pick<LocationFix, 'timeMs' | 'accuracyM'>,
  options: SettleOptions = SETTLE_DEFAULTS
): SettleVerdict => {
  const first = firstSeenMs ?? fix.timeMs;
  const settled = fix.accuracyM === undefined
    || fix.accuracyM <= options.accuracyM
    || fix.timeMs - first >= options.maxWaitS * 1000;
  return { settled, firstSeenMs: first };
};

/**
 * Positions d'un départ, celles d'avant le calage retirées : la trace commence à la première position jugée calée,
 * et toutes les suivantes sont gardées, quelle que soit leur incertitude.
 */
export const fromSettledStart = <F extends Pick<LocationFix, 'timeMs' | 'accuracyM'>>(
  fixes: ReadonlyArray<F>,
  options: SettleOptions = SETTLE_DEFAULTS
): F[] => {
  let firstSeenMs: number | null = null;
  for (let i = 0; i < fixes.length; i++) {
    const verdict = judgeSettle(firstSeenMs, fixes[i], options);
    if (verdict.settled) return fixes.slice(i);
    firstSeenMs = verdict.firstSeenMs;
  }
  return [];
};
