import { t } from '../core/i18n';
import { desktopBridge, type BridgeAnswer, type DesktopAppBridge, type DesktopAppInstall, type DesktopAppRefusal } from './desktopBridge';
import { bridgeValue } from './diskMemory';
import { isDesktopApp } from './runtime';

/**
 * L'application du téléphone que le programme Windows emporte : l'APK de la même version, que l'utilisateur enregistre
 * sur le disque pour la copier sur le téléphone, ou installe par le câble (débogage USB). La coquille retient, par
 * version, si elle a déjà été proposée à la première ouverture. Ailleurs (navigateur, téléphone, coquille plus
 * ancienne ou sans ce canal), rien de cela n'existe.
 */

export interface PhoneAppInfo {
  /** Version du programme, celle de l'APK qu'il emporte. */
  version: string;
  /** Vrai si le programme a bien l'APK. */
  available: boolean;
  /** Vrai si l'application a déjà été proposée pour cette version. */
  proposed: boolean;
}

export type PhoneAppInstall = DesktopAppInstall;
export type PhoneAppRefusal = DesktopAppRefusal;

/** Le canal de l'application, `null` hors du programme Windows ou dans une coquille qui ne l'a pas. */
const appBridge = (): DesktopAppBridge | null => {
  if (!isDesktopApp()) return null;
  const app = desktopBridge()?.application;
  return app && typeof app.etat === 'function' && typeof app.enregistrer === 'function'
    && typeof app.installer === 'function' && typeof app.marquerProposee === 'function'
    ? app
    : null;
};

/** Vrai dans le programme Windows dont la coquille offre l'application du téléphone. */
export const phoneAppAvailable = (): boolean => appBridge() !== null;

const requireApp = (): DesktopAppBridge => {
  const app = appBridge();
  if (!app) throw Object.assign(new Error(t("Ce programme n'a pas l'application du téléphone.")), { code: 'UNKNOWN' });
  return app;
};

/** Valeur de la réponse ; l'APK absente lève avec sa propre phrase, plutôt que celle d'un fichier introuvable. */
const appValue = async <T,>(call: Promise<BridgeAnswer<T>>): Promise<T> => {
  const answer = await call;
  if (!answer.ok && answer.code === 'NOT_FOUND') {
    throw Object.assign(new Error(t("Ce programme n'a pas l'application du téléphone.")), { code: 'NOT_FOUND' });
  }
  return bridgeValue(Promise.resolve(answer));
};

/** Version, présence de l'APK et proposition déjà faite ; lève sur une panne, avec la phrase à montrer. */
export const phoneAppInfo = async (): Promise<PhoneAppInfo> => {
  const state = await bridgeValue(requireApp().etat());
  return { version: state.version, available: state.disponible === true, proposed: state.proposee === true };
};

/**
 * Ouvre la fenêtre « Enregistrer sous » (titre dans la langue de la page) puis y copie l'APK ; rend le chemin écrit,
 * `null` si l'utilisateur a renoncé. Lève, avec la phrase à montrer, sans APK ou si la copie échoue.
 */
export const savePhoneApp = (title: string): Promise<string | null> => appValue(requireApp().enregistrer({ titre: title }));

/** Installe l'APK par le câble ; lève, avec la phrase à montrer, sans APK, sur un délai dépassé ou une panne. */
export const installPhoneApp = (): Promise<PhoneAppInstall> => appValue(requireApp().installer());

/** Retient que l'application a été proposée pour cette version ; elle ne le sera plus avant la suivante. */
export const markPhoneAppProposed = async (): Promise<void> => {
  await bridgeValue(requireApp().marquerProposee());
};

/** Raison d'un refus, en fin de phrase ; `autre` : le message d'Android, tel quel. */
const refusalText = (reason: PhoneAppRefusal, detail: string): string => {
  switch (reason) {
    case 'versionPlusRecente': return t('une version plus récente y est déjà');
    case 'signature': return t("l'application installée n'a pas la même signature");
    case 'usbCoupee': return t("l'installation par USB est coupée dans les options pour les développeurs");
    case 'memoirePleine': return t('mémoire pleine');
    default: return detail.trim().replace(/\.+$/, '') || t('raison inconnue');
  }
};

/** Ce qu'une installation a donné, en une phrase ; `ok` : l'application est sur le téléphone. */
export const describePhoneAppInstall = (result: PhoneAppInstall): { ok: boolean; text: string } => {
  switch (result.etat) {
    case 'installee': return { ok: true, text: t('Application installée sur {nom}.', { nom: result.nom }) };
    case 'refusee': return { ok: false, text: t("Le téléphone a refusé l'installation : {raison}.", { raison: refusalText(result.raison, result.detail) }) };
    case 'absent': return { ok: false, text: t('Aucun téléphone branché.') };
    case 'autorisation': return { ok: false, text: t("Acceptez cet ordinateur sur l'écran du téléphone, puis réessayez.") };
    case 'horsLigne': return { ok: false, text: t('Le téléphone ne répond pas : débranchez-le et rebranchez-le.') };
    case 'adbIntrouvable': return { ok: false, text: t("L'outil du débogage USB n'est pas sur ce PC : enregistrez l'APK et copiez-la sur le téléphone.") };
    case 'occupe': return { ok: false, text: t('Un autre programme tient la liaison avec le téléphone : fermez-le et réessayez.') };
  }
};
