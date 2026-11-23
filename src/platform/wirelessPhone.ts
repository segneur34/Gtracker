import { t } from '../core/i18n';
import {
  desktopBridge,
  type DesktopAuthorizationOutcome,
  type DesktopDepartureReason,
  type DesktopWirelessAuthorization,
  type DesktopWirelessBridge,
  type DesktopWirelessPairing,
  type DesktopWirelessPhone,
  type DesktopWirelessState,
} from './desktopBridge';
import { bridgeValue } from './diskMemory';
import { nativeText } from './nativeMessages';
import { isDesktopApp } from './runtime';

/**
 * Le sans-fil du programme Windows : le PC attend le téléphone sur le Wi-Fi de la maison, relié une fois par un code, et
 * range ensuite les sessions qu'il n'a pas (`phoneCable.ts` lit le téléphone par l'un ou l'autre canal). Ici : allumer
 * ou éteindre, ouvrir la fenêtre de liaison, lister et retirer les téléphones reliés, savoir quand l'un d'eux se
 * présente ou s'en va (et depuis quand, pourquoi), et demander à Windows d'autoriser Gtracker sur le réseau. Rien
 * n'existe ailleurs (navigateur, téléphone, coquille plus ancienne) : `wirelessAvailable()` est faux et aucune des
 * autres fonctions ne s'exécute ; une coquille qui ne sait pas demander l'autorisation a `wirelessAuthorizable()` faux,
 * une coquille qui n'annonce pas les départs `wirelessDeparturesNotified()` faux.
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

/**
 * Pourquoi un téléphone relié est parti : il a fermé la liaison lui-même (`closedByPhone` : Gtracker a quitté l'écran du
 * téléphone), il ne répondait plus (`noAnswer` : écran éteint, Wi-Fi perdu), il a été retiré de ce PC (`removed`), le
 * sans-fil du PC a été éteint (`wirelessOff`), ou la liaison a cassé autrement (`broken`, aussi pour une raison qu'une
 * coquille plus récente ajouterait).
 */
export type WirelessDepartureReason = 'closedByPhone' | 'noAnswer' | 'removed' | 'wirelessOff' | 'broken';

/** Un téléphone relié qui s'en va ; `atMs` : heure du départ, en millisecondes depuis 1970 (horloge du PC). */
export interface WirelessDeparture {
  id: string;
  name: string;
  reason: WirelessDepartureReason;
  atMs: number;
}

const DEPARTURE_REASONS: Record<DesktopDepartureReason, WirelessDepartureReason> = {
  ferme: 'closedByPhone',
  silence: 'noAnswer',
  retire: 'removed',
  eteint: 'wirelessOff',
  coupure: 'broken',
};

const departureReasonOf = (raison: unknown): WirelessDepartureReason =>
  typeof raison === 'string' && Object.hasOwn(DEPARTURE_REASONS, raison) ? DEPARTURE_REASONS[raison as DesktopDepartureReason] : 'broken';

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

/** État rendu par la coquille, dont la phrase `erreur` (écrite en français) passe dans la langue de l'interface. */
const stateOf = (state: WirelessState): WirelessState =>
  typeof state.erreur === 'string' ? { ...state, erreur: nativeText(state.erreur) } : state;

/** État du sans-fil ; lève sur une panne imprévue, avec la phrase à montrer. */
export const wirelessState = (): Promise<WirelessState> => bridgeValue(requireWireless().etat()).then(stateOf);

/** Allume ou éteint le sans-fil (le choix est retenu) ; rend l'état qui suit. */
export const setWirelessActive = (active: boolean): Promise<WirelessState> =>
  bridgeValue(requireWireless().activer({ actif: active })).then(stateOf);

/** Ouvre la fenêtre de liaison d'un téléphone ; lève si le sans-fil est éteint ou sans réseau. */
export const openWirelessPairing = (): Promise<WirelessPairing> => bridgeValue(requireWireless().ouvrirAppairage());

/** Téléphones reliés au PC, et lesquels le sont en ce moment. */
export const wirelessPhones = (): Promise<WirelessPhone[]> => bridgeValue(requireWireless().telephones());

/**
 * Dernier départ d'un téléphone de la liste, pendant ce lancement du programme : heure et raison ; `null` s'il est relié
 * en ce moment, s'il n'est pas parti depuis le lancement, ou si la coquille, plus ancienne, ne le dit pas.
 */
export const phoneDeparture = (phone: WirelessPhone): { atMs: number; reason: WirelessDepartureReason } | null =>
  !phone.relie && typeof phone.partiLe === 'number' ? { atMs: phone.partiLe, reason: departureReasonOf(phone.raisonDepart) } : null;

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
  return bridgeValue(bridge.autoriser()).then((result) => ({
    ...result,
    ...(result.detail === undefined ? {} : { detail: nativeText(result.detail) }),
    etat: stateOf(result.etat),
  }));
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

/** Vrai si la coquille annonce les départs (`onWirelessDeparture`) ; faux hors du programme Windows ou dans une coquille plus ancienne. */
export const wirelessDeparturesNotified = (): boolean => typeof wirelessBridge()?.surDepart === 'function';

/** Avis de départ lu avec méfiance : ce qui n'a pas la forme attendue est ignoré ; une raison inconnue devient `broken`. */
const departureOf = (notice: unknown): WirelessDeparture | null => {
  if (typeof notice !== 'object' || notice === null) return null;
  const { id, nom, raison, heure } = notice as Record<string, unknown>;
  return typeof id === 'string' && typeof nom === 'string' && typeof heure === 'number' && Number.isFinite(heure)
    ? { id, name: nom, reason: departureReasonOf(raison), atMs: heure }
    : null;
};

/**
 * Appelle `listener` chaque fois qu'un téléphone relié s'en va (pas quand il revient aussitôt par une liaison plus
 * récente) ; rend la fonction qui se désabonne. Sans effet hors du programme Windows et dans une coquille qui n'annonce
 * pas les départs (`wirelessDeparturesNotified()` faux).
 */
export const onWirelessDeparture = (listener: (departure: WirelessDeparture) => void): (() => void) => {
  const bridge = wirelessBridge();
  if (typeof bridge?.surDepart !== 'function') return () => undefined;
  return bridge.surDepart((notice) => {
    const departure = departureOf(notice);
    if (departure) listener(departure);
  });
};
