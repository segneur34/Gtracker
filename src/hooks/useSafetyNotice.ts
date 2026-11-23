import { useCallback } from 'react';
import { STORAGE_KEYS } from '../core/appIdentity';
import { SAFETY_NOTICE_UNSEEN, readSafetyNotice, type SafetyNoticeRecord } from '../library/profilePrompt';
import { readStoredRecord, useStoredRecord } from './useStoredRecord';

/**
 * Mise en garde de la première ouverture (« Avant de partir », `components/SafetyNotice.tsx`) : lue ou non sur cet
 * appareil, gardée par `useStoredRecord` sous `STORAGE_KEYS.miseEnGarde`, clé `fenetre`. Elle ne voyage ni dans le
 * fichier de réglages du dossier mémoire ni par la synchronisation : chaque appareil la montre une fois. « Tout
 * supprimer » la fait revenir, « Réglages d'usine » la garde (`library/resetPlan.ts`).
 */

const NAMESPACE = STORAGE_KEYS.miseEnGarde;
const KEY = 'fenetre';

/**
 * La mise en garde paraît-elle à ce lancement ? Lu une fois, au premier appel (avant tout « J'ai compris »), puis
 * figé jusqu'au lancement suivant : les cartes d'ouverture qui viennent après elle (profil, carte du jour,
 * application du téléphone) attendent alors le lancement suivant, même une fois la mise en garde lue.
 */
let shownThisLaunch: boolean | null = null;

export const safetyNoticeShownThisLaunch = (): boolean => {
  if (shownThisLaunch === null) shownThisLaunch = !readStoredRecord(NAMESPACE, KEY, SAFETY_NOTICE_UNSEEN, readSafetyNotice).vue;
  return shownThisLaunch;
};

/** `seen` : déjà lue sur cet appareil ; `acknowledge` la tient pour lue (« J'ai compris »). */
export const useSafetyNotice = (): { seen: boolean; acknowledge: () => void } => {
  // Figé dès le premier rendu, donc avant que « J'ai compris » puisse être touché.
  safetyNoticeShownThisLaunch();
  const { value, update } = useStoredRecord<SafetyNoticeRecord>(NAMESPACE, KEY, SAFETY_NOTICE_UNSEEN, readSafetyNotice);
  const acknowledge = useCallback(() => update({ vue: true }), [update]);
  return { seen: value.vue, acknowledge };
};
