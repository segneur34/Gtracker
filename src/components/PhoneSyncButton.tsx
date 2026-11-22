import { useEffect, useState } from 'react';
import { t } from '../core/i18n';
import { isRecordingActive } from '../hooks/useRecorder';
import {
  answerPhoneSyncQuestion, clearPhoneArrivalNote, leavePhoneSyncQuestion, notePhoneArrival, phoneSyncStep, reopenPhoneSyncQuestion,
  synchronizeWithPhone, usePhoneArrivalNote, usePhoneSync, type PhoneSyncAnswer, type PhoneSyncStep,
} from '../hooks/useSessionLibrary';
import { routeStore } from '../hooks/routeFiles';
import {
  describePhoneSync, describeQuestion, firstSyncText, syncProgressText, syncRunningTitle, syncStepText, syncSubtitle,
  type SyncQuestion, type SyncReport, type SyncReportRow,
} from '../library/syncReport';
import { phoneCableAvailable } from '../platform/phoneCable';
import { onWirelessArrival } from '../platform/wirelessPhone';
import { IconChevronRight } from './icons';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import './PhoneSyncButton.css';

/**
 * « Synchroniser », dans la barre du haut du programme Windows, avant « Enregistrer » : met à jour l'ordinateur et le
 * téléphone, relié par le Wi-Fi ou branché par câble. Une fenêtre suit la synchronisation : son titre dit l'étape, le
 * sous-titre le téléphone et par où il est lu ; une phrase et une barre pendant l'avancement ; la seule question
 * possible (suppressions en nombre, ou sessions de la corbeille encore sur le téléphone), à deux réponses qui la
 * règlent ; puis le compte rendu, une ligne par geste qui se déplie en noms, les exceptions dans un encadré, et
 * « Fermer », accompagné de « Recommencer » quand quelque chose a mal tourné. Fermer la question ne décide rien : le
 * compte rendu de ce qui est fait le rappelle, avec « Répondre ». Fermée en route, la synchronisation continue, et une
 * question attend : le bouton rouvre la fenêtre où elle en est. Quand un téléphone relié se présente, rien ne se
 * lance : une ligne discrète, à côté du bouton, invite à synchroniser. Absent ailleurs (navigateur, téléphone,
 * coquille plus ancienne).
 */

/** Temps pendant lequel la ligne de l'arrivée reste affichée. */
const ARRIVAL_NOTE_MS = 12_000;

const run = () => void synchronizeWithPhone({ recording: isRecordingActive });

/** Titre et sous-titre de la fenêtre à cette étape, et le compte rendu quand elle en est à l'issue. */
const windowOf = (step: PhoneSyncStep): { title: string; subtitle: string | null; said: SyncReport | null } => {
  switch (step.step) {
    case 'idle':
    case 'searching':
      return { title: t('Synchroniser avec le téléphone'), subtitle: null, said: null };
    case 'comparing':
    case 'safetyCopy':
    case 'copying':
      return { title: syncRunningTitle(), subtitle: syncSubtitle(step.phone, step.channel), said: null };
    case 'question':
      return { title: describeQuestion(step.question).title, subtitle: syncSubtitle(step.result.phone, step.result.channel), said: null };
    default: {
      const said = describePhoneSync(step.result, step.unanswered ?? null, step.answerFailed ?? null);
      const subtitle = step.result.kind === 'synced' ? syncSubtitle(step.result.phone, step.result.channel) : null;
      return { title: said.title, subtitle, said };
    }
  }
};

function PhoneSyncButton() {
  const [available] = useState(phoneCableAvailable);
  const [open, setOpen] = useState(false);
  const step = usePhoneSync();
  const note = usePhoneArrivalNote();

  useEffect(() => onWirelessArrival(() => notePhoneArrival()), []);

  // La synchronisation a pu changer les itinéraires de l'ordinateur : leur liste est relue à son issue, question
  // comprise (les itinéraires sont faits avant qu'elle soit posée).
  const ended = step.step === 'over' || step.step === 'question';
  useEffect(() => {
    if (ended) routeStore.reload();
  }, [ended]);

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
  const close = () => setOpen(false);
  const view = windowOf(step);

  return (
    <>
      {note !== null && <span className="phone-sync__arrival" role="status" title={note.text}>{note.text}</span>}
      <Button variant="secondary" className="phone-sync" onClick={start}>{t('Synchroniser')}</Button>
      {open && (
        // Fermer la question ne décide rien : la fenêtre passe au compte rendu de ce qui est fait, qui la rappelle.
        <Dialog title={view.title} onClose={step.step === 'question' ? leavePhoneSyncQuestion : close} className="phone-sync__dialog">
          {view.subtitle !== null && <p className="phone-sync__subtitle">{view.subtitle}</p>}
          {step.step === 'question'
            ? <QuestionView question={step.question} />
            : view.said !== null
              ? <ReportView said={view.said} onClose={close} />
              : <ProgressView step={step} />}
        </Dialog>
      )}
    </>
  );
}

const answer = (a: PhoneSyncAnswer) => () => void answerPhoneSyncQuestion(a);

/** Avancement : une phrase et une barre, sans nombres tant que le total n'est pas connu. */
function ProgressView({ step }: { step: PhoneSyncStep }) {
  const first = (step.step === 'copying' && step.first) || step.step === 'safetyCopy';
  const text = step.step === 'copying' ? syncProgressText(step.done, step.total)
    : syncStepText(step.step === 'comparing' ? 'comparing' : step.step === 'safetyCopy' ? 'safetyCopy' : 'searching');
  const counted = step.step === 'copying' && step.total > 0;
  return (
    <div className="phone-sync__body" aria-live="polite">
      {first && <p>{firstSyncText()}</p>}
      <p className="num">{text}</p>
      <progress className="phone-sync__bar" value={counted ? step.done : undefined} max={counted ? step.total : undefined} aria-label={text} />
      <p className="phone-sync__hint">{t('Vous pouvez fermer cette fenêtre : la synchronisation continue.')}</p>
    </div>
  );
}

/** Lignes qui se déplient en noms : le geste, ce qu'il a touché, puis la liste. */
function Rows({ rows, open = false }: { rows: SyncReportRow[]; open?: boolean }) {
  return (
    <div className="phone-sync__rows">
      {rows.map((row, i) => (
        <details key={`${row.label}-${i}`} className="phone-sync__row" open={open}>
          <summary>
            <strong className="phone-sync__row-label">{row.label}</strong>
            <span className="phone-sync__row-text num">{row.text}</span>
            <IconChevronRight size={14} className="phone-sync__row-mark" aria-hidden="true" />
          </summary>
          <ul className="phone-sync__names num">
            {row.names.map((name, j) => <li key={`${name}-${j}`}>{name}</li>)}
          </ul>
        </details>
      ))}
    </div>
  );
}

/** Une raison technique, repliée sous « Détail ». */
function Detail({ text }: { text: string }) {
  return (
    <details className="phone-sync__detail">
      <summary>{t('Détail')}</summary>
      <p>{text}</p>
    </details>
  );
}

function ReportView({ said, onClose }: { said: SyncReport; onClose: () => void }) {
  const extra = said.action === 'restart' ? { label: t('Recommencer'), onClick: run }
    : said.action === 'retry' ? { label: t('Réessayer'), onClick: run }
      : said.action === 'answer' ? { label: t('Répondre'), onClick: reopenPhoneSyncQuestion }
        : null;
  return (
    <>
      <div className="phone-sync__body" aria-live="polite">
        {said.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
        {said.folder && <code className="phone-sync__folder">{said.folder}</code>}
        {said.detail && <Detail text={said.detail} />}
        {said.rows.length > 0 && <Rows rows={said.rows} />}
        {said.notes.map((note, i) => (
          <div key={i} className="phone-sync__note">
            <p>{note.text}</p>
            {note.detail && <Detail text={note.detail} />}
          </div>
        ))}
      </div>
      <div className="phone-sync__actions">
        {extra && <Button variant="primary" onClick={extra.onClick}>{extra.label}</Button>}
        <Button variant={extra ? 'secondary' : 'primary'} onClick={onClose}>{t('Fermer')}</Button>
      </div>
    </>
  );
}

function QuestionView({ question }: { question: SyncQuestion }) {
  const text = describeQuestion(question);
  const guard = question.kind === 'guard';
  return (
    <>
      <div className="phone-sync__body">
        <p>{text.intro}</p>
        {text.rows.length > 0 && <Rows rows={text.rows} open />}
        {text.names.length > 0 && (
          <ul className="phone-sync__names phone-sync__names--list num">
            {text.names.map((name, i) => <li key={`${name}-${i}`}>{name}</li>)}
          </ul>
        )}
        {text.ask !== null && <p>{text.ask}</p>}
      </div>
      <div className="phone-sync__actions">
        <Button variant="secondary" onClick={answer(guard ? 'keepAll' : 'keepHeld')}>{text.keepLabel}</Button>
        <Button variant="danger" onClick={answer(guard ? 'deleteBoth' : 'removeHeld')}>{text.removeLabel}</Button>
      </div>
      <p className="phone-sync__hint">{text.hint}</p>
    </>
  );
}

export default PhoneSyncButton;
