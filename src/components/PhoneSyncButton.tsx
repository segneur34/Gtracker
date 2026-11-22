import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../core/i18n';
import { SETTINGS_PAIRING_PATH } from '../core/parentPage';
import { isRecordingActive } from '../hooks/useRecorder';
import {
  answerPhoneSyncQuestion, authorizePhoneSyncFirewall, cancelPhoneSyncWait, chooseFirstSyncFolder, declineFirstSync, leavePhoneSyncQuestion,
  openSafetyCopyFolder, phoneSyncStep, pickSafetyFolder, reopenPhoneSyncQuestion, startFirstSync, synchronizeWithPhone, usePhoneSync,
  type PhoneSyncAnswer, type PhoneSyncStep,
} from '../hooks/useSessionLibrary';
import { routeStore } from '../hooks/routeFiles';
import {
  computerScanText, describeFirstStart, describeNoPhone, describePhoneSync, describeQuestion, describeWait, linkedPhoneText,
  safetyCopyProgressText, safetyFolderChosenText, syncProgressText, syncRunningTitle, syncStepText, syncSubtitle, type SyncQuestion,
  type SyncReport, type SyncReportRow, type SyncWait,
} from '../library/syncReport';
import { phoneCableAvailable, safetyCopyFolderChoosable, safetyCopyOpenable } from '../platform/phoneCable';
import {
  onWirelessArrival, onWirelessDeparture, wirelessAuthorizable, wirelessAvailable, wirelessDeparturesNotified, wirelessPhones,
} from '../platform/wirelessPhone';
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
 * question attend : le bouton rouvre la fenêtre où elle en est. Téléphone pas là, liaison tombée, ordinateur occupé :
 * la fenêtre attend en disant quoi faire (pare-feu compris, avec « Autoriser Gtracker »), repart seule, et « Annuler »
 * arrête l'attente ; un ordinateur qui ne connaît aucun téléphone mène à Réglages › Mémoire, fenêtre du code ouverte.
 * Première synchronisation d'un téléphone : un écran de départ dit où ira la copie de sécurité, avec « Choisir un autre
 * dossier » et « Commencer » (le fermer arrête tout) ; le compte rendu redit où est la copie, avec « Ouvrir le
 * dossier », et une copie qui échoue propose un autre dossier avant « Recommencer ». À côté du bouton, « Redmi relié » tant que le sans-fil tient un téléphone ; rien ne se lance à son arrivée. Absent
 * ailleurs (navigateur, téléphone, coquille plus ancienne).
 */

/** Relecture des téléphones reliés, pour une coquille qui n'annonce pas les départs. */
const LINKED_REFRESH_MS = 5000;

const run = () => void synchronizeWithPhone({ recording: isRecordingActive });

/** Le téléphone que le sans-fil tient en ce moment, suivi par ses arrivées et ses départs ; `null` s'il n'y en a pas. */
const useLinkedPhone = (): { id: string; name: string } | null => {
  const [linked, setLinked] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!wirelessAvailable()) return;
    let alive = true;
    const read = () => {
      wirelessPhones().then((phones) => {
        const phone = phones.find((p) => p.relie);
        if (alive) setLinked(phone ? { id: phone.id, name: phone.nom } : null);
      }, () => undefined);
    };
    read();
    const stops = [
      onWirelessArrival((arrival) => setLinked({ id: arrival.id, name: arrival.name })),
      onWirelessDeparture((departure) => setLinked((now) => (now?.id === departure.id ? null : now))),
    ];
    const timer = wirelessDeparturesNotified() ? null : setInterval(read, LINKED_REFRESH_MS);
    return () => {
      alive = false;
      stops.forEach((stop) => stop());
      if (timer !== null) clearInterval(timer);
    };
  }, []);
  return linked;
};

/** Titre et sous-titre de la fenêtre à cette étape, et le compte rendu quand elle en est à l'issue. */
const windowOf = (step: PhoneSyncStep): { title: string; subtitle: string | null; said: SyncReport | null } => {
  switch (step.step) {
    case 'idle':
    case 'searching':
      return { title: t('Synchroniser avec le téléphone'), subtitle: null, said: null };
    case 'waiting': {
      const text = describeWait(step.wait, step.atMs);
      return { title: text.title, subtitle: text.subtitle, said: null };
    }
    case 'noPhone':
      return { title: describeNoPhone().title, subtitle: null, said: null };
    case 'firstStart':
      return { title: describeFirstStart(step.phone, step.folder).title, subtitle: syncSubtitle(step.phone, step.channel), said: null };
    case 'computerBusy':
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
  const linked = useLinkedPhone();
  const navigate = useNavigate();

  // La synchronisation a pu changer les itinéraires de l'ordinateur : leur liste est relue à son issue, question
  // comprise (les itinéraires sont faits avant qu'elle soit posée).
  const ended = step.step === 'over' || step.step === 'question';
  useEffect(() => {
    if (ended) routeStore.reload();
  }, [ended]);

  if (!available) return null;

  // Une question en attente se rouvre telle quelle ; une synchronisation en cours n'est pas doublée.
  const start = () => {
    setOpen(true);
    const now = phoneSyncStep().step;
    if (now === 'idle' || now === 'over') run();
  };
  const close = () => setOpen(false);
  // Annuler l'attente (ou fermer pendant l'attente) : la fenêtre se ferme, sauf si une passe partielle laisse un compte
  // rendu de ce qui est fait, qu'elle montre alors.
  const cancel = () => {
    void cancelPhoneSyncWait().then(() => {
      if (phoneSyncStep().step === 'idle') close();
    });
  };
  const pair = () => {
    cancel();
    navigate(SETTINGS_PAIRING_PATH);
  };
  const declineStart = () => {
    declineFirstSync();
    close();
  };
  const view = windowOf(step);
  // Fermer la question ne décide rien : la fenêtre passe au compte rendu de ce qui est fait, qui la rappelle. Fermer
  // l'écran de départ arrête la synchronisation, rien n'étant fait.
  const onClose = step.step === 'question' ? leavePhoneSyncQuestion
    : step.step === 'firstStart' ? declineStart
      : step.step === 'waiting' || step.step === 'noPhone' ? cancel : close;

  return (
    <>
      {linked !== null && (
        <span className="phone-sync__linked" role="status" title={linkedPhoneText(linked.name)}>
          <span className="phone-sync__dot" aria-hidden="true" />{linkedPhoneText(linked.name)}
        </span>
      )}
      <Button variant="secondary" className="phone-sync" onClick={start}>{t('Synchroniser')}</Button>
      {open && (
        // Fermer la question ne décide rien : la fenêtre passe au compte rendu de ce qui est fait, qui la rappelle.
        // Fermer pendant une attente vaut « Annuler » ; pendant l'échange, la synchronisation continue.
        <Dialog title={view.title} onClose={onClose} className="phone-sync__dialog">
          {view.subtitle !== null && <p className="phone-sync__subtitle">{view.subtitle}</p>}
          {step.step === 'question' ? <QuestionView question={step.question} />
            : step.step === 'waiting' ? <WaitView wait={step.wait} atMs={step.atMs} firewallMessage={step.firewallMessage} onCancel={cancel} />
              : step.step === 'noPhone' ? <NoPhoneView onClose={cancel} onPair={pair} />
                : step.step === 'firstStart' ? <FirstStartView step={step} />
                  : view.said !== null ? <ReportView said={view.said} onClose={close} />
                    : <ProgressView step={step} />}
        </Dialog>
      )}
    </>
  );
}

const answer = (a: PhoneSyncAnswer) => () => void answerPhoneSyncQuestion(a);

/** Avancement : une phrase et une barre, sans nombres tant que le total n'est pas connu. */
function ProgressView({ step }: { step: PhoneSyncStep }) {
  const busy = step.step === 'computerBusy';
  const text = step.step === 'copying' ? syncProgressText(step.done, step.total)
    : busy ? computerScanText(step.done, step.total)
      : step.step === 'safetyCopy' ? safetyCopyProgressText(step.done, step.total)
        : syncStepText(step.step === 'comparing' ? 'comparing' : 'searching');
  const counted = (step.step === 'copying' || step.step === 'safetyCopy' || busy) && step.total > 0;
  return (
    <div className="phone-sync__body" aria-live="polite">
      <p className="num">{text}</p>
      <progress className="phone-sync__bar" value={counted ? step.done : undefined} max={counted ? step.total : undefined} aria-label={text} />
      <p className="phone-sync__hint">
        {busy ? t("L'échange avec le téléphone commence juste après.") : t('Vous pouvez fermer cette fenêtre : la synchronisation continue.')}
      </p>
    </div>
  );
}

/** L'attente : quoi faire sur le téléphone, le pare-feu qui bloque, et « Annuler ». Elle repart seule. */
function WaitView({ wait, atMs, firewallMessage, onCancel }: { wait: SyncWait; atMs: number; firewallMessage: string | null; onCancel: () => void }) {
  const text = describeWait(wait, atMs);
  const authorize = wait.firewall?.canAuthorize === true && wirelessAuthorizable();
  return (
    <>
      <div className="phone-sync__body" aria-live="polite">
        {wait.firewall !== null && (
          <div className="phone-sync__note">
            <p>
              <strong>{wait.firewall.text}</strong>
              {authorize && <> {t('Autorisez Gtracker : Windows vous demandera de confirmer.')}</>}
            </p>
            {firewallMessage !== null && <p className="ui-danger-text">{firewallMessage}</p>}
          </div>
        )}
        {text.lead !== null && <p>{text.lead}</p>}
        {text.steps.length > 0 && (
          <>
            <p>{t('Sur le téléphone :')}</p>
            <ul className="phone-sync__steps">{text.steps.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
        {text.closing !== null && <p><strong>{text.closing}</strong></p>}
        {text.notes.map((note) => <p key={note} className="phone-sync__hint">{note}</p>)}
        {wait.detail !== null && <Detail text={wait.detail} />}
      </div>
      <div className="phone-sync__actions">
        <Button variant={authorize ? 'secondary' : 'primary'} onClick={onCancel}>{t('Annuler')}</Button>
        {authorize && <Button variant="primary" onClick={() => void authorizePhoneSyncFirewall()}>{t('Autoriser Gtracker')}</Button>}
      </div>
    </>
  );
}

/** Aucun téléphone connu : cela se fait une fois, par un code, dans Réglages › Mémoire. */
function NoPhoneView({ onClose, onPair }: { onClose: () => void; onPair: () => void }) {
  return (
    <>
      <div className="phone-sync__body">
        <p>{describeNoPhone().text}</p>
      </div>
      <div className="phone-sync__actions">
        <Button variant="secondary" onClick={onClose}>{t('Fermer')}</Button>
        <Button variant="primary" onClick={onPair}>{t('Relier mon téléphone')}</Button>
      </div>
    </>
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

/** Écran de départ d'une première synchronisation : ce qui va se passer, où ira la copie de sécurité, puis « Commencer ». */
function FirstStartView({ step }: { step: Extract<PhoneSyncStep, { step: 'firstStart' }> }) {
  const text = describeFirstStart(step.phone, step.folder);
  return (
    <>
      <div className="phone-sync__body">
        <p>{text.lead}</p>
        <p>{text.copy}</p>
        {step.folder !== null && <code className="phone-sync__folder">{step.folder}</code>}
        {step.problem !== null && <p className="ui-danger-text" role="status">{step.problem}</p>}
      </div>
      <div className="phone-sync__actions">
        {safetyCopyFolderChoosable() && (
          <Button variant="secondary" disabled={step.choosing} onClick={() => void chooseFirstSyncFolder()}>{t('Choisir un autre dossier')}</Button>
        )}
        <Button variant="primary" disabled={step.choosing} onClick={startFirstSync}>{t('Commencer')}</Button>
      </div>
    </>
  );
}

function ReportView({ said, onClose }: { said: SyncReport; onClose: () => void }) {
  const [openProblem, setOpenProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ folder: string | null; problem: string | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const extra = said.action === 'restart' ? { label: t('Recommencer'), onClick: run }
    : said.action === 'retry' ? { label: t('Réessayer'), onClick: run }
      : said.action === 'answer' ? { label: t('Répondre'), onClick: reopenPhoneSyncQuestion }
        : null;
  const openFolder = (folder: string) => {
    setOpenProblem(null);
    void openSafetyCopyFolder(folder).then(setOpenProblem);
  };
  const choose = async () => {
    if (picking) return;
    setPicking(true);
    setPicked(await pickSafetyFolder());
    setPicking(false);
  };
  return (
    <>
      <div className="phone-sync__body" aria-live="polite">
        {said.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
        {said.folder && <code className="phone-sync__folder">{said.folder}</code>}
        {said.folder && safetyCopyOpenable() && (
          <div className="ui-row-s2 ui-wrap">
            <Button size="s" onClick={() => openFolder(said.folder ?? '')}>{t('Ouvrir le dossier')}</Button>
          </div>
        )}
        {openProblem !== null && <p className="ui-danger-text" role="status">{openProblem}</p>}
        {picked !== null && (picked.problem !== null
          ? <p className="ui-danger-text" role="status">{picked.problem}</p>
          : picked.folder !== null && <p role="status">{safetyFolderChosenText(picked.folder)}</p>)}
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
        {said.chooseFolder && safetyCopyFolderChoosable() && (
          <Button variant="secondary" disabled={picking} onClick={() => void choose()}>{t('Choisir un autre dossier')}</Button>
        )}
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
