import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './runtime';

/**
 * Notification de l'enregistrement : seul accès à elle (règle 12).
 *
 * Sur le téléphone, la notification permanente du service GPS (greffon
 * `@capgo/background-geolocation`, qui n'offre aucun moyen de la changer)
 * est récrite par un greffon maison sur le même numéro : visible écran
 * verrouillé, titre, chiffres du direct, chronomètre d'Android. Pendant une
 * pause manuelle, le greffon la pose lui-même (`standalone`), que le
 * service GPS tourne ou non. Dans le navigateur, chaque envoi est consigné en
 * `console.debug` (« [notification] … »), pour le banc.
 */

/** Contenu de la notification. */
export interface RecordingNotificationContent {
  title: string;
  /** Ligne repliée. */
  text: string;
  /** Lignes du texte déplié. */
  lines: string[];
  /** Chronomètre de l'en-tête : son instant de base, en ms (il compte la durée en montant) ; `null` : aucun. */
  chrono: { baseMs: number } | null;
}

/** Greffon maison, `android/app/src/main/java/io/github/segneur/gtracker/RecordingNotificationPlugin.java`. */
interface RecordingNotificationPlugin {
  show(options: {
    title: string;
    text: string;
    lines: string[];
    chronoMs: number | null;
    standalone: boolean;
  }): Promise<void>;
  clear(): Promise<void>;
}

const nativePlugin = registerPlugin<RecordingNotificationPlugin>('RecordingNotification');

/**
 * Récrit la notification. Hors `standalone`, le téléphone ne la pose que si
 * celle du service GPS est affichée : jamais de notification orpheline une
 * fois le service arrêté.
 */
export const updateRecordingNotification = async (
  content: RecordingNotificationContent,
  { standalone }: { standalone: boolean }
): Promise<void> => {
  if (!isNativeApp()) {
    const chrono = content.chrono ? ` [durée ${content.chrono.baseMs}]` : '';
    console.debug(`[notification] ${content.title} | ${content.text}${chrono}${standalone ? ' (seule)' : ''}`);
    return;
  }
  await nativePlugin.show({
    title: content.title,
    text: content.text,
    lines: content.lines,
    chronoMs: content.chrono?.baseMs ?? null,
    standalone,
  });
};

/** Efface la notification posée pendant une pause manuelle ; celle du service GPS part avec lui. */
export const clearRecordingNotification = async (): Promise<void> => {
  if (!isNativeApp()) {
    console.debug('[notification] effacée');
    return;
  }
  await nativePlugin.clear();
};
