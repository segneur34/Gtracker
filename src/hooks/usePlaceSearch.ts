import { useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '../core/appIdentity';
import { jsonStore } from '../platform/storage';

/**
 * Recherche en ligne du lieu des sessions (Réglages › Mémoire), propre à cet appareil : active d'office.
 * Coupée, rien n'est envoyé et le nom d'une session sans lieu reste son activité.
 */

const KEY = STORAGE_KEYS.rechercheLieu;

/** Vrai sauf si l'utilisateur l'a coupée sur cet appareil. */
export const isPlaceSearchOn = (): boolean => jsonStore.read<boolean>(KEY) !== false;

export const setPlaceSearch = (on: boolean): void => jsonStore.write(KEY, on);

const subscribe = (listener: () => void): (() => void) => jsonStore.subscribeKey(KEY, listener);

/** La recherche du lieu est-elle active, et son changement. */
export const usePlaceSearch = (): [boolean, (on: boolean) => void] => [useSyncExternalStore(subscribe, isPlaceSearchOn), setPlaceSearch];
