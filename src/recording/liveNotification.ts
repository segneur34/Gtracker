import { formatClock } from '../core/units';
import type { RecordingNotificationContent } from '../platform/notification';
import { liveFieldLabel, liveFieldShortLabel, liveFieldValue, type LiveFieldContext, type LiveFieldKey } from './liveFields';

/**
 * Texte de la notification de l'enregistrement, visible écran verrouillé.
 *
 * - Titre : l'activité, puis l'état s'il y en a un : « GPS perdu » (lot 115), « FC perdue » (lot 177),
 *   la pause.
 * - Chronomètre d'Android dans l'en-tête, qui tourne seul : la durée de la session (depuis
 *   son premier point, pauses comprises, comme `recordingDurationMs`). Aucun
 *   en pause manuelle : la durée figée passe dans le titre, après « en pause »,
 *   pour que la ligne repliée garde ses deux chiffres.
 * - Ligne repliée : les chiffres choisis, libellé court et valeur.
 * - Texte déplié : un chiffre par ligne, libellé complet.
 */

export interface LiveNotificationInput {
  activityName: string;
  /** Chiffres choisis pour la notification, dans l'ordre. */
  fields: LiveFieldKey[];
  context: LiveFieldContext;
  /** Pause en cours : manuelle (rien n'est gardé, le GPS reste allumé pour la carte), automatique (immobilité), ou aucune. */
  paused: 'manual' | 'auto' | null;
  /** GPS perdu : plus de position depuis le délai du profil (`recording/gpsWatch.ts`). */
  gpsLost: boolean;
  /** FC perdue : plus de mesure lisible d'une ceinture qui en donnait (`hooks/useRecorder.ts`). */
  beltLost: boolean;
  /** Premier point de la session, en ms ; `null` avant lui. */
  startedAtMs: number | null;
}

const SEPARATOR = ' · ';

/** Arrondi à la seconde : un même chronomètre recalculé ne doit pas passer pour un changement. */
const toSecond = (ms: number): number => Math.round(ms / 1000) * 1000;

export const liveNotification = ({
  activityName, fields, context, paused, gpsLost, beltLost, startedAtMs,
}: LiveNotificationInput): RecordingNotificationContent => {
  const titleParts = [activityName];
  if (gpsLost) titleParts.push('GPS perdu');
  if (beltLost) titleParts.push('FC perdue');
  if (paused === 'manual') titleParts.push(`en pause ${formatClock(context.durationMs)}`);
  else if (paused === 'auto') titleParts.push('pause auto');

  const values = fields.map((key) => ({
    short: liveFieldShortLabel(key, context),
    label: liveFieldLabel(key, context),
    value: liveFieldValue(key, context),
  }));
  const text = values.map((v) => `${v.short} ${v.value}`);
  const lines = values.map((v) => `${v.label} : ${v.value}`);

  let chrono: RecordingNotificationContent['chrono'] = null;
  if (paused !== 'manual' && startedAtMs !== null) chrono = { baseMs: toSecond(startedAtMs), countDown: false };

  return { title: titleParts.join(SEPARATOR), text: text.join(SEPARATOR), lines, chrono };
};

/**
 * État qui commande un envoi immédiat de la notification : statut et pause de
 * l'enregistreur, GPS perdu, FC perdue, activité, et le premier calcul du direct
 * (`computed`), pour ne pas attendre avec des « — ». Deux états de même clé
 * n'appellent pas d'envoi.
 */
export const notificationStateKey = ({ status, pausedReason, gpsLost, beltLost, activityId, computed }: {
  status: string;
  pausedReason: 'manual' | 'auto' | null;
  gpsLost: boolean;
  beltLost: boolean;
  activityId: string | null;
  computed: boolean;
}): string =>
  // Le champ vide tient la place de l'ancienne phase du compteur (retiré au lot 302) : les clés ne changent pas.
  `${status}|${pausedReason ?? ''}|${activityId ?? ''}||${computed}${gpsLost ? '|gps-perdu' : ''}${beltLost ? '|fc-perdue' : ''}`;

/** Clé d'une notification : deux notifications de même clé disent la même chose. */
export const liveNotificationKey = (content: RecordingNotificationContent, standalone: boolean): string =>
  JSON.stringify([content.title, content.text, content.lines, content.chrono, standalone]);
