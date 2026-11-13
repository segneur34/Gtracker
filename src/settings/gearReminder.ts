import type { SailingSessionNotes } from '../library/notes';

/**
 * Rappel du matériel à l'analyse, pur : la fenêtre « Voulez-vous ajouter le matériel ? » qui s'ouvre à l'analyse
 * d'une session tout juste enregistrée quand l'activité a une liste de matériel et que la session n'en porte aucun.
 * Le compte des fermetures est tenu par activité (`gearReminderCloses`, `settings/activitySettings.ts`).
 */

/** Fermetures sans ajout après lesquelles la fenêtre ne s'ouvre plus. */
export const GEAR_REMINDER_MAX_CLOSES = 2;

/** Ce qu'il faut savoir pour décider d'ouvrir la fenêtre. */
export interface GearReminderInput {
  /** L'analyse suit la fin d'un enregistrement (et non la réouverture d'une ancienne session). */
  followsRecording: boolean;
  /** L'activité a une liste de matériel : l'option est cochée dans Réglages, avec ou sans pièce. */
  hasGearList: boolean;
  /** La session porte déjà du matériel (pièce choisie ou texte saisi). */
  sessionHasGear: boolean;
  /** Fermetures sans ajout déjà comptées pour l'activité. */
  closes: number;
  /** L'onglet du matériel est montré par l'activité : sans lui, « Oui » n'aurait rien à ouvrir. */
  tabShown: boolean;
}

/** Vrai si la fenêtre doit s'ouvrir. */
export const shouldRemindGear = ({ followsRecording, hasGearList, sessionHasGear, closes, tabShown }: GearReminderInput): boolean =>
  followsRecording && hasGearList && tabShown && !sessionHasGear && closes < GEAR_REMINDER_MAX_CLOSES;

/** Champ de texte du matériel d'une note (ceux de `GearField`). */
type GearTextField = 'foil' | 'mast' | 'wing' | 'gear1' | 'gear2';

/** Vrai si les notes portent du matériel : une pièce choisie, ou l'un des champs de texte de l'activité rempli. */
export const notesHaveGear = (
  notes: Pick<SailingSessionNotes, 'gear' | GearTextField>, fields: ReadonlyArray<{ field: GearTextField }>
): boolean => (notes.gear?.length ?? 0) > 0 || fields.some(({ field }) => notes[field].trim() !== '');
