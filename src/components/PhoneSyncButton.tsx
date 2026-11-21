import { useEffect, useState } from 'react';
import { t, tn } from '../core/i18n';
import { isRecordingActive } from '../hooks/useRecorder';
import {
  answerPhoneSyncQuestion, clearPhoneArrivalNote, notePhoneArrival, phoneSyncStep, synchronizeWithPhone, usePhoneArrivalNote,
  usePhoneSync, type PhoneSyncAnswer, type PhoneSyncStep,
} from '../hooks/useSessionLibrary';
import { describePhoneSync, firstSyncText, syncProgressText, syncStepText, type SyncQuestion } from '../library/syncReport';
import { phoneCableAvailable } from '../platform/phoneCable';
import { onWirelessArrival } from '../platform/wirelessPhone';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import './PhoneSyncButton.css';

/**
 * « Synchroniser », dans la barre du haut du programme Windows, avant « Enregistrer » : met à jour l'ordinateur et le
 * téléphone, relié par le Wi-Fi ou branché par câble. Une fenêtre suit la synchronisation (recherche du téléphone,
 * comparaison, copie de sécurité, fichiers copiés), pose ses questions (suppressions retenues par le garde-fou, sessions
 * de la corbeille de l'ordinateur encore sur le téléphone), puis en donne le compte rendu, avec « Réessayer » quand il
 * reste quelque chose à finir. Fermée en route, la synchronisation continue, et une question attend : le bouton rouvre
 * la fenêtre où elle en est. Quand un téléphone relié se présente, rien ne se lance : une ligne discrète, à côté du
 * bouton, invite à synchroniser. Absent ailleurs (navigateur, téléphone, coquille plus ancienne).
 */

/** Temps pendant lequel la ligne de l'arrivée reste affichée. */
const ARRIVAL_NOTE_MS = 12_000;

const run = () => void synchronizeWithPhone({ recording: isRecordingActive });

function PhoneSyncButton() {
  const [available] = useState(phoneCableAvailable);
  const [open, setOpen] = useState(false);
  const step = usePhoneSync();
  const note = usePhoneArrivalNote();

  useEffect(() => onWirelessArrival(() => notePhoneArrival()), []);

  useEffect(() => {
    if (note === null) return;
    const timer = setTimeout(clearPhoneArrivalNote, Math.max(0, note.atMs + ARRIVAL_NOTE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [note]);

  if (!available) return null;

  // Une question en attente se rouvre telle quelle ; une synchronisation en cours n'est pas doublée.
  const start = () => {
    setOpen(true);
    const now = phoneSyncStep().step;
    if (now === 'idle' || now === 'over') run();
  };

  return (
    <>
      {note !== null && <span className="phone-sync__arrival" role="status" title={note.text}>{note.text}</span>}
      <Button variant="secondary" className="phone-sync" onClick={start}>{t('Synchroniser')}</Button>
      {open && (
        <Dialog title={t('Synchroniser avec le téléphone')} onClose={() => setOpen(false)} className="phone-sync__dialog">
          <StepView step={step} onClose={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  );
}

const answer = (a: PhoneSyncAnswer) => () => void answerPhoneSyncQuestion(a);

function StepView({ step, onClose }: { step: PhoneSyncStep; onClose: () => void }) {
  if (step.step === 'question') return <QuestionView question={step.question} />;
  const said = step.step === 'over' ? describePhoneSync(step.result) : null;
  return (
    <>
      <div className="phone-sync__body" aria-live="polite">
        {(step.step === 'idle' || step.step === 'searching' || step.step === 'comparing') && (
          <p>{syncStepText(step.step === 'comparing' ? 'comparing' : 'searching')}</p>
        )}
        {step.step === 'safetyCopy' && (
          <>
            <p>{firstSyncText()}</p>
            <p>{syncStepText('safetyCopy')}</p>
          </>
        )}
        {step.step === 'copying' && (
          <>
            {step.first && <p>{firstSyncText()}</p>}
            <p>{step.channel === 'sansFil'
              ? t('Synchronisation avec le téléphone {phone} par le Wi-Fi…', { phone: step.phone })
              : t('Synchronisation avec le téléphone {phone} par le câble…', { phone: step.phone })}</p>
            {step.total > 0 && <p className="phone-sync__count num">{syncProgressText(step.done, step.total)}</p>}
          </>
        )}
        {said?.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
        {said?.folder && <code className="phone-sync__folder">{said.folder}</code>}
      </div>
      <div className="phone-sync__actions">
        {said?.retry && <Button variant="primary" onClick={run}>{t('Réessayer')}</Button>}
        <Button variant="secondary" onClick={onClose}>{t('Fermer')}</Button>
      </div>
    </>
  );
}

/** Les sessions nommées par une question : date et heure de départ, et pour le garde-fou ce qui leur arriverait. */
function SessionList({ question }: { question: SyncQuestion }) {
  return (
    <ul className="phone-sync__sessions num">
      {question.sessions.map((s) => (
        <li key={`${s.side}-${s.startMs}-${s.file}`}>
          {question.kind === 'inTrash'
            ? s.label
            : s.side === 'computer'
              ? t("{date} : mise dans la corbeille de l'ordinateur", { date: s.label })
              : t('{date} : retirée du téléphone', { date: s.label })}
        </li>
      ))}
    </ul>
  );
}

function QuestionView({ question }: { question: SyncQuestion }) {
  const n = question.count;
  if (question.kind === 'guard') {
    return (
      <>
        <div className="phone-sync__body">
          <p>{question.text}</p>
          <details className="phone-sync__details">
            <summary>{tn(n, 'Voir la session', 'Voir les {n} sessions')}</summary>
            <SessionList question={question} />
          </details>
        </div>
        <div className="phone-sync__actions">
          <Button variant="secondary" onClick={answer('cancel')}>{t('Annuler')}</Button>
          <Button variant="danger" onClick={answer('confirmDeletions')}>{tn(n, 'Supprimer cette session', 'Supprimer ces {n} sessions')}</Button>
          <Button variant="primary" onClick={answer('withoutDeletions')}>{t('Synchroniser sans rien supprimer')}</Button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="phone-sync__body">
        <p>{question.text}</p>
        <SessionList question={question} />
      </div>
      <div className="phone-sync__actions">
        <Button variant="secondary" onClick={answer('leave')}>{tn(n, 'La laisser', 'Les laisser')}</Button>
        <Button variant="danger" onClick={answer('removeHeld')}>{t('Retirer du téléphone')}</Button>
      </div>
    </>
  );
}

export default PhoneSyncButton;
