import { useCallback, useMemo } from 'react';
import { SPORT_FAMILIES, type SportFamily } from '../core/sportProfiles';
import {
  EMPTY_TUTORIAL_STATE, dismissToday, markOpened, markRead, readTutorialState, shownLessons, type TutorialState,
} from '../tutorials/tutorials';
import { readStoredRecord, useStoredRecord } from './useStoredRecord';
import { useVisibility } from './useSportSettings';
import { STORAGE_KEYS } from '../core/appIdentity';

/** Rangé sur cet appareil seulement (pas dans le fichier de réglages du dossier mémoire). */
const NAMESPACE = STORAGE_KEYS.tutoriels;
const KEY = 'etat';

/**
 * Tutoriels : l'état de l'appareil (jours d'ouverture, leçons lues,
 * carte du jour fermée) et les leçons montrées, celles des familles cachées
 * retirées. Une écriture qui ne change rien n'est pas faite.
 */
export function useTutorials() {
  const { value: state, update } = useStoredRecord<TutorialState>(NAMESPACE, KEY, EMPTY_TUTORIAL_STATE, readTutorialState);
  const { families } = useVisibility();
  const hiddenFamilies = useMemo<SportFamily[]>(() => SPORT_FAMILIES.filter((f) => !families.includes(f)), [families]);
  const lessons = useMemo(() => shownLessons(hiddenFamilies), [hiddenFamilies]);
  const change = useCallback((next: (s: TutorialState) => TutorialState) => {
    const current = readStoredRecord(NAMESPACE, KEY, EMPTY_TUTORIAL_STATE, readTutorialState);
    const changed = next(current);
    if (changed !== current) update(changed);
  }, [update]);
  return {
    state,
    hiddenFamilies,
    lessons,
    open: useCallback((today: string) => change((s) => markOpened(s, today)), [change]),
    dismiss: useCallback((today: string) => change((s) => dismissToday(s, today)), [change]),
    read: useCallback((id: string) => change((s) => markRead(s, id)), [change]),
  };
}
