import { WAVE_SENSE_MIN_R, type WaveSense } from '../../surfing/waveSense';

export interface WaveSenseView {
  /** Sens montré, en degrés entiers : le saisi, ou le calculé quand ses mesures vont assez dans le même sens ; sinon `null`. */
  shownDeg: number | null;
  /** Vrai quand le sens est saisi. */
  manual: boolean;
  /** Vrai quand le sens montré est sûr (un sens saisi l'est toujours). */
  reliable: boolean;
  /** Sens calculé, rappelé à côté d'un sens saisi ; `null` sans saisie ou sans calcul exploitable. */
  autoDeg: number | null;
}

const wholeDeg = (deg: number): number => Math.round(deg) % 360;

/**
 * Ce que la boussole et la ligne des réglages montrent du sens des vagues.
 * Le sens saisi se lit dans le brouillon, qui est à jour tout de suite ; seul
 * le sens calculé vient de l'analyse, dont les chiffres retardent pendant un recalcul.
 */
export const waveSenseView = (entered: number | null, estimated: WaveSense | null): WaveSenseView => {
  const usable = estimated !== null && estimated.R >= WAVE_SENSE_MIN_R ? estimated : null;
  if (entered !== null) {
    return { shownDeg: wholeDeg(entered), manual: true, reliable: true, autoDeg: usable === null ? null : wholeDeg(usable.directionDeg) };
  }
  return { shownDeg: usable === null ? null : wholeDeg(usable.directionDeg), manual: false, reliable: estimated?.reliable ?? false, autoDeg: null };
};
