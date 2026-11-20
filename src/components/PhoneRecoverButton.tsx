import { useEffect, useState } from 'react';
import { t, tn } from '../core/i18n';
import { clearArrivalNote, recoverFromPhone, recoverOnArrival, useArrivalNote, usePhoneRecovery, type PhoneRecoveryStep } from '../hooks/useSessionLibrary';
import { describePhoneRecovery } from '../library/phoneRecovery';
import { phoneCableAvailable } from '../platform/phoneCable';
import { onWirelessArrival } from '../platform/wirelessPhone';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import './PhoneRecoverButton.css';

/**
 * « Récupérer », dans la barre du haut du programme Windows, avant « Enregistrer » : range sur le PC les sessions du
 * téléphone qu'il n'a pas encore, par le Wi-Fi quand un téléphone y est relié, sinon par le câble. Une fenêtre suit la
 * récupération (recherche du téléphone, fichiers lus, canal) puis en dit l'issue, avec « Réessayer » quand le téléphone
 * n'était pas prêt. Fermée en route, la récupération continue ; le bouton la rouvre. Quand un téléphone relié se
 * présente, la récupération se lance seule et une ligne discrète, à côté du bouton, en dit le résultat quelques
 * secondes. Absent ailleurs (navigateur, téléphone, coquille plus ancienne).
 */

/** Temps pendant lequel la ligne de l'arrivée reste affichée. */
const ARRIVAL_NOTE_MS = 12_000;

function PhoneRecoverButton() {
  const [available] = useState(phoneCableAvailable);
  const [open, setOpen] = useState(false);
  const step = usePhoneRecovery();
  const note = useArrivalNote();

  useEffect(() => onWirelessArrival((phone) => void recoverOnArrival(phone.name)), []);

  useEffect(() => {
    if (note === null) return;
    const timer = setTimeout(clearArrivalNote, Math.max(0, note.atMs + ARRIVAL_NOTE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [note]);

  if (!available) return null;

  const start = () => {
    setOpen(true);
    void recoverFromPhone();
  };

  return (
    <>
      {note !== null && <span className="phone-recover__arrival" role="status" title={note.text}>{note.text}</span>}
      <Button variant="secondary" className="phone-recover" onClick={start}>{t('Récupérer')}</Button>
      {open && (
        <Dialog title={t('Récupérer les sessions du téléphone')} onClose={() => setOpen(false)} className="phone-recover__dialog">
          <StepView step={step} onRetry={() => void recoverFromPhone()} onClose={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  );
}

function StepView({ step, onRetry, onClose }: { step: PhoneRecoveryStep; onRetry: () => void; onClose: () => void }) {
  const running = step.step === 'searching' || step.step === 'reading' || step.step === 'idle';
  const said = step.step === 'over' ? describePhoneRecovery(step.outcome) : null;
  return (
    <>
      <div className="phone-recover__body" aria-live="polite">
        {running && step.step !== 'reading' && <p>{t('Recherche du téléphone…')}</p>}
        {step.step === 'reading' && (
          <>
            <p>{step.channel === 'sansFil'
              ? t('Lecture du téléphone {phone} par le Wi-Fi…', { phone: step.phone })
              : step.channel === 'cable'
                ? t('Lecture du téléphone {phone} par le câble…', { phone: step.phone })
                : t('Lecture du téléphone {phone}…', { phone: step.phone })}</p>
            <p className="phone-recover__count num">{tn(step.done, '{n} fichier sur {total}', '{n} fichiers sur {total}', { total: step.total })}</p>
          </>
        )}
        {said?.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
        {said?.folder && <code className="phone-recover__folder">{said.folder}</code>}
      </div>
      <div className="phone-recover__actions">
        {said?.retry && <Button variant="primary" onClick={onRetry}>{t('Réessayer')}</Button>}
        <Button variant="secondary" onClick={onClose}>{t('Fermer')}</Button>
      </div>
    </>
  );
}

export default PhoneRecoverButton;
