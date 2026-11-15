import type { BeltState } from '../platform/heartRate';

/**
 * Boutons de secours de la ceinture cardio sur la page Enregistrer : ce que la page propose selon l'état. Aucun ne
 * touche à la trace, au fichier des capteurs ni à la notification ; ils ne font que relancer, abandonner ou reprendre
 * la ceinture de la session.
 */

/**
 * Ceinture de la session laissée de côté pendant l'enregistrement : `failed`, injoignable (Bluetooth éteint,
 * permission refusée, au départ ou à une reprise) ; `stopped`, l'utilisateur a cessé de la chercher ; `null` sinon.
 */
export type BeltAside = 'failed' | 'stopped' | null;

export interface BeltRetryInput {
  /** Vrai pendant l'enregistrement, en cours ou en pause (ni au démarrage, ni à l'arrêt). */
  active: boolean;
  /** Ceinture tenue par l'enregistrement : état de la connexion ; `null` sans ceinture tenue. */
  heartRate: { state: BeltState } | null;
  /** Alerte de FC perdue en cours. */
  beltLost: boolean;
  beltAside: BeltAside;
}

export interface BeltRetryOffer {
  /** « Réessayer » : une tentative tout de suite, sans attendre la suivante du téléphone. */
  retry: boolean;
  /** « Arrêter de chercher » : l'enregistrement continue sans cardio, l'alerte se tait. */
  stop: boolean;
  /** « Reprendre la ceinture », après l'avoir laissée. */
  retake: boolean;
}

const NONE: BeltRetryOffer = { retry: false, stop: false, retake: false };

/** États d'une ceinture tenue que le téléphone n'a pas jointe : un nouvel essai peut devancer le sien. */
const UNJOINED: readonly BeltState[] = ['connecting', 'searching', 'lost', 'off'];

/**
 * Boutons de la ceinture pendant l'enregistrement. Jointe sans mesure (alerte de FC perdue, ceinture décollée) :
 * seulement l'abandon, une liaison établie n'ayant rien à relancer. Appareil sans fréquence cardiaque : l'abandon
 * aussi. Laissée de côté : la reprendre, ou, injoignable, réessayer ou retirer le message.
 */
export const beltRetryOffer = (input: BeltRetryInput): BeltRetryOffer => {
  if (!input.active) return NONE;
  if (input.beltAside === 'stopped') return { retry: false, stop: false, retake: true };
  if (input.beltAside === 'failed') return { retry: true, stop: true, retake: false };
  if (input.heartRate === null) return NONE;
  const { state } = input.heartRate;
  if (UNJOINED.includes(state)) return { retry: true, stop: true, retake: false };
  if (state === 'unsupported' || input.beltLost) return { retry: false, stop: true, retake: false };
  return NONE;
};

/** Les boutons se montrent aussi sous l'alerte rouge quand elle parle de la ceinture (FC perdue, ceinture injoignable). */
export const beltRetryUnderAlert = (input: BeltRetryInput): boolean =>
  input.active && (input.beltLost || input.beltAside === 'failed');

/**
 * Avant le départ, ceinture cochée : « Réessayer » après un échec de la connexion (`failed`), ou pendant qu'elle est
 * encore cherchée.
 */
export const warmupRetryShown = (state: BeltState, failed: boolean): boolean =>
  failed || state === 'connecting' || state === 'searching' || state === 'lost';
