import { useState } from 'react';
import { t, tn } from '../core/i18n';
import { recoverFromPhone, usePhoneRecovery, type PhoneRecoveryStep } from '../hooks/useSessionLibrary';
import { describePhoneRecovery } from '../library/phoneRecovery';
import { phoneCableAvailable } from '../platform/phoneCable';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import './PhoneRecoverButton.css';

/**
 * « Récupérer », dans la barre du haut du programme Windows, avant « Enregistrer » : range sur le PC les sessions du
 * téléphone branché par câble qu'il n'a pas encore. Une fenêtre suit la récupération (recherche du téléphone,
 * fichiers lus) puis en dit l'issue, avec « Réessayer » quand le téléphone n'était pas prêt. Fermée en route, la
 * récupération continue ; le bouton la rouvre. Absent ailleurs (navigateur, téléphone, coquille plus ancienne).
 */
function PhoneRecoverButton() {
  const [available] = useState(phoneCableAvailable);
  const [open, setOpen] = useState(false);
  const step = usePhoneRecovery();
  if (!available) return null;

  const start = () => {
    setOpen(true);
    void recoverFromPhone();
  };

  return (
    <>
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
            <p>{t('Lecture du téléphone {phone}…', { phone: step.phone })}</p>
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
