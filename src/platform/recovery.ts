import { deviceLocationState } from './location';

/**
 * Preuve que le service de position a survécu à la page : il dit lui-même s'il tourne, pour quelle session, et s'il
 * est en pause manuelle (`Recording.state()`, par `platform/location.ts`). Android ne le relance jamais seul : le
 * voir en route veut dire qu'il n'a pas cessé de recevoir et d'écrire ses positions. Dans le navigateur, ou si la
 * lecture échoue, rien ne tourne : la reprise silencieuse n'a jamais lieu sur un doute.
 */

/** Ce que le service de position dit de lui à la page qui revient. */
export interface RecoveryServices {
  /** Le service de position tourne. */
  gps: boolean;
  /** Session qu'il enregistre : le `startedAtMs` de l'en-tête de son journal ; `null` s'il ne tourne pas. */
  session: number | null;
  /** Il se sait en pause manuelle. */
  paused: boolean;
}

const NONE: RecoveryServices = { gps: false, session: null, paused: false };

export const readRecoveryServices = async (): Promise<RecoveryServices> => {
  try {
    const { running, session, paused } = await deviceLocationState();
    return running ? { gps: true, session, paused } : NONE;
  } catch (err) {
    console.warn('État du service de position illisible', err);
    return NONE;
  }
};
