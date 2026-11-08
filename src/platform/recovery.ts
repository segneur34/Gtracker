import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './runtime';

/**
 * Preuve qu'un service au premier plan a survécu à la page (lot 156) : seul passage vers
 * `android/…/RecoveryPlugin.java`, qui lit la liste des services de l'application. Un service vivant veut dire que
 * le processus aussi : ceux-ci ne sont pas relancés par Android après sa mort. Dans le navigateur, ou si la lecture
 * échoue, aucun : la reprise silencieuse n'a jamais lieu sur un doute.
 */

/** Services au premier plan vus vivants : le GPS (le service de la ceinture seule est parti avec la muscu, lot 302). */
export interface RecoveryServices {
  gps: boolean;
}

interface RecoveryPlugin {
  state(): Promise<{ gps?: boolean }>;
}

const plugin = registerPlugin<RecoveryPlugin>('Recovery');

export const readRecoveryServices = async (): Promise<RecoveryServices> => {
  if (!isNativeApp()) return { gps: false };
  try {
    const { gps } = await plugin.state();
    return { gps: gps === true };
  } catch (err) {
    console.warn('Services de l\'enregistrement illisibles', err);
    return { gps: false };
  }
};
