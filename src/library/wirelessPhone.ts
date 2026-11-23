import { dayMonthYearTime } from '../core/calendar';
import { t, tn } from '../core/i18n';
import { formatMinSec } from '../core/units';
import type { AuthorizationOutcome, WirelessPhone, WirelessPairing, WirelessState } from '../platform/wirelessPhone';

/**
 * Le sans-fil du programme Windows, partie pure : ce que dit l'état du PC, le pare-feu de Windows et l'issue de sa
 * demande d'autorisation, le décompte de la fenêtre de liaison d'un téléphone, l'issue de cette fenêtre, et la ligne
 * de chaque téléphone relié.
 */

/** Ce que le bloc dit de l'état du sans-fil. */
export interface WirelessStatus {
  kind: 'off' | 'listening' | 'no-network' | 'error';
  /** La phrase d'état. */
  text: string;
}

/** État du sans-fil en phrases ; le pare-feu se dit à part (`firewallNotice`). */
export const describeWireless = (state: WirelessState): WirelessStatus => {
  if (!state.actif) {
    return { kind: 'off', text: t("Le sans-fil est éteint : le téléphone ne peut pas se présenter à cet ordinateur.") };
  }
  // L'adresse ne sert qu'à la fenêtre du code, qui la montre.
  if (state.ecoute) return { kind: 'listening', text: t('Prêt : Gtracker attend votre téléphone.') };
  if (state.erreur !== null) {
    return {
      kind: 'error',
      text: t("Le sans-fil ne démarre pas : {detail}.", { detail: state.erreur.replace(/\.\s*$/, '') }),
    };
  }
  return {
    kind: 'no-network',
    text: t("Le sans-fil ne trouve pas encore de réseau : l'ordinateur est-il relié à une box Wi-Fi, ou partage-t-il sa connexion avec le téléphone ?"),
  };
};

/** Ce que le bloc dit du pare-feu de Windows : la phrase, et si le bouton « Autoriser Gtracker » l'accompagne. */
export interface FirewallNotice {
  text: string;
  canAuthorize: boolean;
}

/**
 * Le pare-feu en phrase, `null` s'il ne bloque pas : seul « bloqué » s'affirme, « ouvert » et « inconnu » ne disent
 * rien. Le bouton n'est proposé que si l'autorisation de Gtracker suffirait ; sinon, la phrase dit qu'un réglage de
 * l'administrateur l'empêche. Sans-fil éteint ou sans écoute : rien.
 */
export const firewallNotice = (state: WirelessState): FirewallNotice | null => {
  if (!state.actif || !state.ecoute || state.pareFeu !== 'bloque') return null;
  const blocked = t('Windows ne laisse pas passer votre téléphone sur ce réseau.');
  if (state.pareFeuReparable === true) return { text: blocked, canAuthorize: true };
  return { text: `${blocked} ${t("Un réglage de l'administrateur de cet ordinateur empêche de l'autoriser ici.")}`, canAuthorize: false };
};

/**
 * Phrase dite avant la demande d'autorisation de Windows (à l'allumage du sans-fil et près des boutons « Autoriser
 * Gtracker ») : la règle posée vaut aussi sur les réseaux publics, parce que le partage de connexion en est un.
 */
export const authorizationNoticeText = (): string =>
  t("Windows va demander de confirmer. L'autorisation vaut aussi sur les réseaux publics : le partage de connexion du téléphone en est un.");

/** Phrase de l'issue de la demande d'autorisation ; `null` quand elle est accordée (le message du pare-feu s'en va). */
export const authorizationOutcomeText = (outcome: AuthorizationOutcome, detail?: string): string | null => {
  if (outcome === 'accordee') return null;
  if (outcome === 'refusee') return t("Windows n'a pas donné l'autorisation : le téléphone ne pourra pas se présenter sur ce réseau.");
  return t("L'autorisation n'a pas pu être ajoutée : {detail}.", { detail: (detail ?? t('erreur inconnue')).replace(/\.\s*$/, '') });
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

/**
 * Les codes faux reçus pendant la dernière fenêtre, avec l'adresse d'où venait le dernier : l'utilisateur voit si un
 * autre appareil que son téléphone a tenté sa chance. `null` sans code faux, ou d'une coquille plus ancienne.
 */
export const wrongCodesText = (state: Pick<WirelessState, 'codesFaux'>): string | null => {
  const wrong = state.codesFaux;
  if (!wrong || wrong.nombre < 1) return null;
  return tn(wrong.nombre, "Code faux reçu de l'appareil {address}.", "{n} codes faux reçus, le dernier de l'appareil {address}.", { address: wrong.adresse });
};

/** Ligne d'un téléphone relié : relié en ce moment, ou la dernière fois qu'il s'est présenté. */
export const describePhoneSeen = (phone: Pick<WirelessPhone, 'relie' | 'vuLe' | 'ajouteLe'>): string =>
  phone.relie
    ? t('relié en ce moment')
    : t('vu pour la dernière fois le {date}', { date: dayMonthYearTime(phone.vuLe ?? phone.ajouteLe) });
