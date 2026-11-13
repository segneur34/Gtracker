import { useEffect, useState } from 'react';
import { dismissRecorderResult, useRecorderSelector } from '../hooks/useRecorder';
import { countGearReminderClose, gearReminderClosesOf } from '../hooks/useSportSettings';
import { shouldRemindGear } from '../settings/gearReminder';
import Button from './ui/Button';
import Dialog from './ui/Dialog';

export interface GearReminderProps {
  /** Fichier de la session ouverte (celui de l'adresse) ; `null` sans session. */
  file: string | null;
  /** Activité de la session : la liste de matériel et le compte des fermetures sont les siens. */
  activityId: string;
  /** L'activité a une liste de matériel (option cochée dans Réglages). */
  hasGearList: boolean;
  /** La session porte déjà du matériel. */
  sessionHasGear: boolean;
  /** La session est lue et son brouillon (notes comprises) est celui de `file`. */
  ready: boolean;
  /** L'onglet du matériel est montré par l'activité. */
  tabShown: boolean;
  /** Intitulé de l'onglet du matériel dans ce module, repris dans la phrase. */
  tabLabel: string;
  /** Une autre vue est posée sur la page (carte en plein écran, réglage du vent) : la fenêtre attend. */
  covered: boolean;
  /** « Oui » : ouvre l'onglet du matériel. */
  onAdd: () => void;
}

const ACTIONS_STYLE = { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' } as const;

/**
 * Rappel du matériel, commun aux deux analyses : à l'analyse d'une session tout juste enregistrée, une fenêtre
 * « Voulez-vous ajouter le matériel ? » quand l'activité a une liste de matériel et que la session n'en porte aucun
 * (`shouldRemindGear`). Le signal est celui des avertissements de l'arrêt : le compte rendu de l'enregistreur porte
 * le fichier de la session rangée (`saved.libraryFile`). Il est relevé dès le premier rendu, puis effacé : rouvrir
 * plus tard la même session ne rappelle rien. La fenêtre vient après l'avertissement de l'arrêt, une fois « Fermer »
 * touché, et après toute vue posée sur la page. « Oui » ouvre l'onglet ; « Non », la croix, Échap et le retour
 * d'Android comptent une fermeture sans ajout, et après deux la fenêtre ne s'ouvre plus pour cette activité.
 */
export default function GearReminder({ file, activityId, hasGearList, sessionHasGear, ready, tabShown, tabLabel, covered, onAdd }: GearReminderProps) {
  const followsRecording = useRecorderSelector((s) => file !== null && s.saved?.libraryFile === file);
  /** Un message de l'arrêt est encore à lire en tête de l'analyse. */
  const messageShown = useRecorderSelector((s) => file !== null && s.saved?.libraryFile === file && s.error !== null);
  /** Session dont le rappel est attendu : relevée dans le compte rendu de l'enregistreur, tenue ici même quand il est effacé. */
  const [armed, setArmed] = useState<string | null>(null);
  /** Session dont le rappel a été décidé (ouvert ou non) : il n'est plus relevé. */
  const [handled, setHandled] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  if (followsRecording && armed !== file && handled !== file) setArmed(file);
  // Tout est prêt : décision prise une fois, à ce rendu.
  if (armed !== null && armed === file && !messageShown && ready && !covered) {
    setArmed(null);
    setHandled(file);
    if (shouldRemindGear({ followsRecording: true, hasGearList, sessionHasGear, closes: gearReminderClosesOf(activityId), tabShown })) setOpen(true);
  }
  // Le compte rendu a servi : il ne rappellera rien à la réouverture de la session.
  const spent = handled !== null && handled === file && followsRecording && !messageShown;
  useEffect(() => {
    if (spent) dismissRecorderResult();
  }, [spent]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    countGearReminderClose(activityId);
  };
  const add = () => {
    setOpen(false);
    onAdd();
  };
  return (
    <Dialog title="Voulez-vous ajouter le matériel ?" onClose={close}>
      <p className="ui-hint">
        Cette session n'en porte pas encore. Il se choisit dans l'onglet « {tabLabel} ».
      </p>
      <div style={ACTIONS_STYLE}>
        <Button variant="primary" onClick={add}>Oui</Button>
        <Button variant="ghost" onClick={close}>Non</Button>
      </div>
    </Dialog>
  );
}
