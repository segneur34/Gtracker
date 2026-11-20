import { dayMonthYearTime } from '../core/calendar';
import { t } from '../core/i18n';
import type { ComputerLinkError, ComputerLinkRefusal, ComputerLinkStatus } from '../platform/computerLink';

/**
 * La liaison sans fil vue du téléphone, partie pure : les phrases de l'état (en français courant, sans le vocabulaire
 * du protocole), le temps écoulé depuis le dernier envoi, la saisie du code et de l'adresse, et la règle qui dit
 * quand la liaison se tente toute seule.
 */

/** Longueur du code que l'ordinateur affiche. */
export const CODE_LENGTH = 6;

/** Le code tapé réduit à ses chiffres, au plus `CODE_LENGTH`. */
export const cleanCode = (raw: string): string => raw.replace(/\D/g, '').slice(0, CODE_LENGTH);

export const codeComplete = (code: string): boolean => code.length === CODE_LENGTH;

/**
 * Adresse que l'ordinateur affiche, « 192.168.1.20:48217 » : quatre nombres de 0 à 255, et le numéro de porte
 * (1 à 65535) sans lequel le greffon prend celui par défaut. Le greffon refuse en plus toute adresse hors du réseau
 * local ; ici, seule la forme est vérifiée.
 */
export const addressWellFormed = (address: string): boolean => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d{1,5}))?$/.exec(address.trim());
  if (match === null) return false;
  if (match.slice(1, 5).some((part) => Number(part) > 255)) return false;
  return match[5] === undefined || (Number(match[5]) >= 1 && Number(match[5]) <= 65535);
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** « à l'instant », « il y a 2 min », « il y a 3 h », puis la date au-delà d'un jour. */
export const elapsedText = (thenMs: number, nowMs: number): string => {
  const ago = nowMs - thenMs;
  if (ago < MINUTE_MS) return t("à l'instant");
  if (ago < HOUR_MS) return t('il y a {n} min', { n: Math.floor(ago / MINUTE_MS) });
  if (ago < DAY_MS) return t('il y a {n} h', { n: Math.floor(ago / HOUR_MS) });
  return t('le {date}', { date: dayMonthYearTime(thenMs) });
};

/** Chaque raison d'échec du greffon, en phrase : ce qui s'est passé, puis quoi faire. */
export const linkErrorText = (error: ComputerLinkError): string => {
  switch (error) {
    case 'code':
      return t("Le code est faux. Vérifiez les 6 chiffres affichés sur l'ordinateur.");
    case 'window':
      return t("Le code a expiré. Sur l'ordinateur, touchez de nouveau « Relier un téléphone » pour en avoir un nouveau.");
    case 'nonce':
      return t("L'ordinateur a refusé cette tentative. Touchez de nouveau « Relier un téléphone » sur l'ordinateur, puis tapez le nouveau code.");
    case 'proof':
      return t("Cet appareil ne connaît pas le code : ce n'est peut-être pas votre ordinateur. Rien n'a été gardé. Vérifiez le code et réessayez.");
    case 'token':
      return t("L'ordinateur ne reconnaît plus ce téléphone. Reliez-le de nouveau : sur l'ordinateur, Réglages, Mémoire, « Relier un téléphone », puis tapez ici le code affiché.");
    case 'certificate':
      return t("L'ordinateur qui répond n'est plus celui que ce téléphone connaît : il a peut-être été réinstallé. Oubliez-le, puis reliez-le de nouveau.");
    case 'version':
      return t("Gtracker n'est pas à la même version sur le téléphone et sur l'ordinateur : mettez à jour celui des deux qui est le plus ancien.");
    case 'noLocalNetwork':
      return t("Le téléphone n'est pas sur un réseau local. Mettez-le sur la même box Wi-Fi que l'ordinateur, ou sur un partage de connexion avec lui.");
    case 'localNetwork':
      return t("Gtracker n'a pas l'autorisation d'accéder au réseau local. Accordez-la dans les réglages du téléphone, à la page de Gtracker, puis réessayez.");
    case 'protocol':
      return t("L'ordinateur a répondu de façon incompréhensible : vérifiez que Gtracker est à jour sur le téléphone et sur l'ordinateur.");
    default:
      return t("La liaison avec l'ordinateur s'est coupée. Elle est retentée à l'ouverture de Gtracker, ou touchez « Chercher l'ordinateur ».");
  }
};

/** Phrase d'un appel refusé avant toute tentative : code ou adresse mal formés. */
export const refusalText = (refusal: ComputerLinkRefusal): string =>
  refusal === 'code'
    ? t('Le code se compose de 6 chiffres, affichés sur l\'ordinateur.')
    : t("L'adresse n'est pas valable : tapez celle que l'ordinateur affiche, par exemple 192.168.1.20:48217.");

/** Ce que le bloc dit de l'état : une phrase d'état, ce qui ne va pas, et le dernier envoi. */
export interface LinkLine {
  /** La phrase d'état, `null` quand rien n'est relié ni connu. */
  headline: string | null;
  /** Ce qui ne va pas et quoi faire, `null` sinon. */
  problem: string | null;
  /** Dernier envoi de sessions, `null` si aucun ordinateur n'est connu. */
  sent: string | null;
}

/**
 * L'état du greffon en phrases. Sans réseau local (et sans liaison en cours), la phrase du réseau passe avant toute
 * autre raison : rien d'autre ne peut aboutir.
 */
export const describeLink = (status: ComputerLinkStatus, nowMs: number): LinkLine => {
  const name = status.computerName ?? t("l'ordinateur");
  const busy = status.state === 'searching' || status.state === 'pairing' || status.state === 'linked';
  let problem: string | null = status.error === null ? null : linkErrorText(status.error);
  if (!busy && !status.onLocalNetwork) problem = linkErrorText('noLocalNetwork');

  let headline: string | null = null;
  switch (status.state) {
    case 'searching':
      headline = status.paired ? t('Recherche de {name} sur le réseau…', { name }) : t("Recherche de l'ordinateur sur le réseau…");
      break;
    case 'pairing':
      headline = t("Liaison à l'ordinateur en cours…");
      break;
    case 'linked':
      headline = t('Relié à {name} en ce moment.', { name });
      break;
    case 'notFound':
      headline = status.paired ? t('{name} est introuvable sur le réseau.', { name }) : t("Gtracker n'a pas trouvé l'ordinateur sur le réseau.");
      break;
    case 'idle':
      headline = t("{name} : pas relié pour l'instant.", { name });
      break;
    default:
      break;
  }

  let sent: string | null = null;
  if (status.paired) {
    sent = status.lastSentMs === null
      ? t("Aucune session envoyée pour l'instant.")
      : t('Dernier envoi : {quand}.', { quand: elapsedText(status.lastSentMs, nowMs) });
  }
  return { headline, problem, sent };
};

/** Le champ « Adresse » se montre quand l'ordinateur n'a pas été trouvé tout seul : l'adresse affichée par l'ordinateur le remplace. */
export const addressFieldShown = (status: ComputerLinkStatus): boolean =>
  status.state === 'notFound' && status.error !== 'noLocalNetwork' && status.onLocalNetwork;

/**
 * Faut-il tenter la liaison toute seule (à l'ouverture, au retour au premier plan, quand le dossier mémoire change) ?
 * Oui quand un ordinateur est connu, qu'un réseau local est là (partage de connexion compris : jamais « Wi-Fi
 * seulement »), qu'un dossier mémoire est désigné, et qu'aucune tentative n'est en cours. Jamais pendant un
 * enregistrement : rien ne doit gêner le GPS. Déjà relié, l'appel ne fait que donner le dossier à la liaison.
 */
export const shouldAutoConnect = (input: { status: ComputerLinkStatus; hasFolder: boolean; recording: boolean }): boolean => {
  const { status } = input;
  if (input.recording || !input.hasFolder || !status.paired || !status.onLocalNetwork) return false;
  return status.state === 'idle' || status.state === 'notFound' || status.state === 'linked';
};
