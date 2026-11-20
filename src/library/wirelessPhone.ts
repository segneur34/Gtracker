import { dayMonthYearTime } from '../core/calendar';
import { t } from '../core/i18n';
import { formatMinSec } from '../core/units';
import type { WirelessPhone, WirelessPairing, WirelessState } from '../platform/wirelessPhone';

/**
 * Le sans-fil du programme Windows, partie pure : ce que dit l'état du PC, le décompte de la fenêtre de liaison d'un
 * téléphone, l'issue de cette fenêtre, et la ligne de chaque téléphone relié.
 */

/** Ce que le bloc dit de l'état du sans-fil. */
export interface WirelessStatus {
  kind: 'off' | 'listening' | 'no-network' | 'error';
  /** La phrase d'état. */
  text: string;
  /** Avertissement à part (Windows bloque Gtracker), `null` sinon : jamais écrit sans que l'essai ait dit « bloqué ». */
  warning: string | null;
  /** Aide à lire quand le PC attend et qu'aucun téléphone n'est là, `null` sinon. */
  hint: string | null;
}

/**
 * État du sans-fil en phrases. Le pare-feu n'est jamais présenté comme une certitude : « bloqué » s'affirme ; « ouvert »
 * ou « inconnu » ne disent rien (Windows ne filtre pas le trafic de l'ordinateur vers lui-même).
 */
export const describeWireless = (state: WirelessState): WirelessStatus => {
  if (!state.actif) {
    return { kind: 'off', text: t("Le sans-fil est éteint : le téléphone ne peut pas se présenter à cet ordinateur."), warning: null, hint: null };
  }
  if (state.ecoute) {
    const warning = state.pareFeu === 'bloque'
      ? t("Windows bloque Gtracker sur ce réseau. Autorisez-le dans le pare-feu de Windows, puis éteignez et rallumez le sans-fil.")
      : null;
    const hint = state.relies.length === 0
      ? t("Aucun téléphone ne se présente ? Ouvrez Gtracker sur le téléphone, relié au même réseau. Si rien ne se passe, le pare-feu de Windows peut bloquer Gtracker (surtout sur un partage de connexion, que Windows range parfois parmi les réseaux publics) : le câble reste possible.")
      : null;
    return {
      kind: 'listening',
      text: t("Gtracker attend votre téléphone sur le réseau (adresse {adresse}).", { adresse: state.adresses[0] ?? '' }),
      warning,
      hint,
    };
  }
  if (state.erreur !== null) {
    return {
      kind: 'error',
      text: t("Le sans-fil ne démarre pas : {detail}.", { detail: state.erreur.replace(/\.\s*$/, '') }),
      warning: null,
      hint: null,
    };
  }
  return {
    kind: 'no-network',
    text: t("Le sans-fil ne trouve pas encore de réseau : l'ordinateur est-il relié à une box Wi-Fi, ou partage-t-il sa connexion avec le téléphone ?"),
    warning: null,
    hint: null,
  };
};

/** Heure de fermeture de la fenêtre de liaison, sur l'horloge de la page : `nowMs` au moment où le PC a répondu. */
export const pairingDeadline = (pairing: Pick<WirelessPairing, 'restantMs'>, nowMs: number): number => nowMs + Math.max(0, pairing.restantMs);

/** Millisecondes restantes avant `deadlineMs`, jamais négatives. */
export const remainingMs = (deadlineMs: number, nowMs: number): number => Math.max(0, deadlineMs - nowMs);

/** Décompte « 1:45 » (secondes entières, arrondies vers le haut : « 0:00 » seulement à l'échéance). */
export const countdownText = (ms: number): string => formatMinSec(Math.ceil(Math.max(0, ms) / 1000));

/** Adresse à taper sur le téléphone : celle du PC et son numéro de porte, d'un seul tenant. */
export const pairingAddress = (pairing: Pick<WirelessPairing, 'adresse' | 'port'>): string => `${pairing.adresse}:${pairing.port}`;

/** Où en est une fenêtre de liaison. */
export type PairingStatus =
  | { kind: 'waiting' }
  /** Un téléphone vient d'être relié : `name` est son nom. */
  | { kind: 'linked'; name: string }
  /** Fermée sans téléphone : échéance, ou trois codes faux. */
  | { kind: 'closed' };

/**
 * Issue de la fenêtre ouverte à `sinceMs` : un téléphone relié depuis ce moment la conclut ; sinon elle se ferme à
 * l'échéance, ou quand le PC dit qu'elle n'est plus ouverte (`open` faux).
 */
export const pairingStatus = (input: { deadlineMs: number; nowMs: number; open: boolean; phones: readonly WirelessPhone[]; sinceMs: number }): PairingStatus => {
  const linked = input.phones.find((phone) => phone.ajouteLe >= input.sinceMs);
  if (linked) return { kind: 'linked', name: linked.nom };
  if (!input.open || input.nowMs >= input.deadlineMs) return { kind: 'closed' };
  return { kind: 'waiting' };
};

/** Ligne d'un téléphone relié : relié en ce moment, ou la dernière fois qu'il s'est présenté. */
export const describePhoneSeen = (phone: Pick<WirelessPhone, 'relie' | 'vuLe' | 'ajouteLe'>): string =>
  phone.relie
    ? t('relié en ce moment')
    : t('vu pour la dernière fois le {date}', { date: dayMonthYearTime(phone.vuLe ?? phone.ajouteLe) });
