import { t } from '../core/i18n';
import {
  desktopBridge,
  type DesktopAuthorizationOutcome,
  type DesktopWirelessAuthorization,
  type DesktopWirelessBridge,
  type DesktopWirelessPairing,
  type DesktopWirelessPhone,
  type DesktopWirelessState,
} from './desktopBridge';
import { bridgeValue } from './diskMemory';
import { isDesktopApp } from './runtime';

/**
 * Le sans-fil du programme Windows : le PC attend le téléphone sur le Wi-Fi de la maison, relié une fois par un code, et
 * range ensuite les sessions qu'il n'a pas (`phoneCable.ts` lit le téléphone par l'un ou l'autre canal). Ici : allumer
 * ou éteindre, ouvrir la fenêtre de liaison, lister et retirer les téléphones reliés, savoir quand l'un d'eux se
 * présente, et demander à Windows d'autoriser Gtracker sur le réseau. Rien n'existe ailleurs (navigateur, téléphone,
 * coquille plus ancienne) : `wirelessAvailable()` est faux et aucune des autres fonctions ne s'exécute ; une coquille
 * qui ne sait pas demander l'autorisation a `wirelessAuthorizable()` faux.
 */

export type WirelessState = DesktopWirelessState;
export type WirelessPairing = DesktopWirelessPairing;
export type WirelessPhone = DesktopWirelessPhone;
export type WirelessAuthorization = DesktopWirelessAuthorization;
export type AuthorizationOutcome = DesktopAuthorizationOutcome;

/** Un téléphone qui se présente au PC ; `isNew` : il vient d'être relié par le code. */
export interface WirelessArrival {
  id: string;
  name: string;
  isNew: boolean;
}

/** Le pont du sans-fil, `null` hors du programme Windows ou dans une coquille qui ne l'a pas. */
const wirelessBridge = (): DesktopWirelessBridge | null => {
  if (!isDesktopApp()) return null;
  const bridge = desktopBridge()?.sansFil;
  return bridge
    && typeof bridge.etat === 'function' && typeof bridge.activer === 'function' && typeof bridge.ouvrirAppairage === 'function'
    && typeof bridge.telephones === 'function' && typeof bridge.retirer === 'function' && typeof bridge.surArrivee === 'function'
    ? bridge
    : null;
};

/** Vrai dans le programme Windows dont la coquille sait recevoir un téléphone par le Wi-Fi. */
export const wirelessAvailable = (): boolean => wirelessBridge() !== null;

const requireWireless = (): DesktopWirelessBridge => {
  const bridge = wirelessBridge();
  if (!bridge) throw Object.assign(new Error(t('Ce programme ne sait pas recevoir un téléphone par le Wi-Fi.')), { code: 'UNKNOWN' });
  return bridge;
};

/** État du sans-fil ; lève sur une panne imprévue, avec la phrase à montrer. */
export const wirelessState = (): Promise<WirelessState> => bridgeValue(requireWireless().etat());

/** Allume ou éteint le sans-fil (le choix est retenu) ; rend l'état qui suit. */
export const setWirelessActive = (active: boolean): Promise<WirelessState> => bridgeValue(requireWireless().activer({ actif: active }));

/** Ouvre la fenêtre de liaison d'un téléphone ; lève si le sans-fil est éteint ou sans réseau. */
export const openWirelessPairing = (): Promise<WirelessPairing> => bridgeValue(requireWireless().ouvrirAppairage());

/** Téléphones reliés au PC, et lesquels le sont en ce moment. */
export const wirelessPhones = (): Promise<WirelessPhone[]> => bridgeValue(requireWireless().telephones());

/** Retire un téléphone : il ne pourra plus se présenter sans être relié de nouveau par un code. Vrai s'il était relié. */
export const removeWirelessPhone = (id: string): Promise<boolean> => bridgeValue(requireWireless().retirer({ id }));

/** Vrai si la coquille sait demander à Windows d'autoriser Gtracker sur le réseau. */
export const wirelessAuthorizable = (): boolean => typeof wirelessBridge()?.autoriser === 'function';

/**
 * Demande à Windows d'autoriser Gtracker sur le réseau (Windows demande de confirmer) ; rend l'issue et l'état relu
 * aussitôt. Lève si le sans-fil est éteint ou si la coquille ne sait pas le demander.
 */
export const authorizeWireless = (): Promise<WirelessAuthorization> => {
  const bridge = requireWireless();
  if (typeof bridge.autoriser !== 'function') {
    throw Object.assign(new Error(t('Ce programme ne sait pas demander cette autorisation à Windows.')), { code: 'UNKNOWN' });
  }
  return bridgeValue(bridge.autoriser());
};

/** Avis lu avec méfiance : ce qui n'a pas la forme attendue est ignoré. */
const arrivalOf = (notice: unknown): WirelessArrival | null => {
  if (typeof notice !== 'object' || notice === null) return null;
  const { id, nom, nouveau } = notice as Record<string, unknown>;
  return typeof id === 'string' && typeof nom === 'string' && typeof nouveau === 'boolean' ? { id, name: nom, isNew: nouveau } : null;
};

/**
 * Appelle `listener` chaque fois qu'un téléphone se présente au PC ; rend la fonction qui se désabonne. Sans effet (et
 * sans rien à désabonner) hors du programme Windows.
 */
export const onWirelessArrival = (listener: (arrival: WirelessArrival) => void): (() => void) => {
  const bridge = wirelessBridge();
  if (!bridge) return () => undefined;
  return bridge.surArrivee((notice) => {
    const arrival = arrivalOf(notice);
    if (arrival) listener(arrival);
  });
};
