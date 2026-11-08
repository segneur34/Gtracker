import { REFERENCE_HEART_RATE, SPORT_PROFILES, type SportProfile } from '../core/sportProfiles';
import { kmhToMs } from '../core/units';

/** Fichier de test seulement : le code de l'application ne l'importe pas. */

/**
 * Profil synthétique d'un calcul « à pied » : les valeurs de l'ancien profil de la course (retiré au lot 305),
 * gelées ici pour éprouver les calculs génériques (masque d'activité, hystérésis, plancher d'arrêt, direct) avec
 * des réglages qu'aucun calcul de voile ou de surf ne réunit : seuil en km/h, confirmation sur 3 s, médiane sur
 * 5 s. Il emprunte l'identifiant du surf, sans ses vagues ni son pumping.
 */
export const WALK_PROFILE: SportProfile = {
  ...SPORT_PROFILES.surf,
  label: 'À pied',
  speedRange: { minMs: kmhToMs(4), maxMs: kmhToMs(15) },
  speedUnit: 'minkm',
  thresholdUnit: 'kmh',
  defaultActiveThreshold: 3,
  activeHysteresis: { enterOffset: 1, exitOffset: -1 },
  stillThreshold: 1,
  minStateDurationS: 3,
  medianWindowSeconds: 5,
  maxPlausibleSpeedMs: 12,
  defaultPolarMinSpeed: 0,
  activeRatioLabel: 'Ratio en mouvement',
  recording: SPORT_PROFILES.wingfoil.recording,
  heartRate: REFERENCE_HEART_RATE,
  jumps: null,
  hrEnergy: null,
  surf: null,
  pump: null,
};
