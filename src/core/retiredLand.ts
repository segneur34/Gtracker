import type { BikeType } from './domainTypes';

/**
 * Restes de la terre gardés par les types : la course et le vélo sont retirés
 * de cette version voile et surf (lot 303), mais `StoredSettings` et la fiche
 * d'une session (`SessionRecord`) gardent encore leurs champs (modèle de
 * dépense, charge portée, type et poids du vélo), lus et réécrits tels quels.
 * Module de transition : retiré au lot 305, avec les unions.
 */

/** Modèle de dépense d'une activité à pied : course (Minetti) ou marche (Pandolf). */
export type EnergyModel = 'course' | 'marche';

export const isEnergyModel = (value: unknown): value is EnergyModel => value === 'course' || value === 'marche';

/** Charge portée plausible (sac, affaires), en kg ; 0 : aucune. */
export const isValidCarriedLoad = (value: unknown): value is number =>
  typeof value === 'number' && isFinite(value) && value >= 0 && value <= 50;

/** Poids du vélo par défaut de chaque type, en kg (valeurs de l'ancien calcul du vélo). */
export const BIKE_DEFAULT_KG: Record<BikeType, number> = { route: 8.5, gravel: 12, vtt: 13, ville: 16 };

export const isBikeType = (value: unknown): value is BikeType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(BIKE_DEFAULT_KG, value);

/** Poids de vélo plausible, en kg, bagages compris pour celui d'une session. */
export const isValidBikeWeight = (value: unknown): value is number =>
  typeof value === 'number' && isFinite(value) && value >= 3 && value <= 60;
