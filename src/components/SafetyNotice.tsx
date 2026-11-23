import type { ReactNode } from 'react';
import { t } from '../core/i18n';
import { useSafetyNotice } from '../hooks/useSafetyNotice';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import './SafetyNotice.css';

/**
 * Mise en garde de la toute première ouverture, dans le cadre de toutes les pages, par-dessus ce qui s'ouvre
 * dessous (un enregistrement repris continue de tourner) : les deux phrases d'« À propos », et un seul bouton,
 * « J'ai compris », qui la ferme pour de bon sur cet appareil. Ni ×, ni fond, ni Échap, ni retour d'Android ne la
 * ferment. Les autres fenêtres et cartes d'ouverture attendent : le profil et les suivantes jusqu'au lancement
 * suivant (`safetyNoticeShownThisLaunch`), ce qu'elle enveloppe (`children` : la question d'import) jusqu'à
 * « J'ai compris ».
 */
function SafetyNotice({ children }: { children?: ReactNode }) {
  const { seen, acknowledge } = useSafetyNotice();
  if (seen) return <>{children}</>;
  return (
    <Dialog title={t('Avant de partir')} onClose={acknowledge} dismissible={false} className="safety-notice">
      <p className="safety-notice__text">
        {t("L'application n'est ni un instrument de navigation ni un équipement de sécurité : gardez le matériel et les précautions qu'exige votre sortie.")}
      </p>
      <p className="safety-notice__text">
        {t("L'application n'est pas un dispositif médical : la fréquence cardiaque et le test au repos donnent des repères pour votre pratique, pas un avis médical.")}
      </p>
      <div className="safety-notice__actions">
        {/* Le seul geste qui la ferme reçoit le focus : Entrée ou Espace au clavier, lecteur d'écran posé dessus. */}
        <Button variant="primary" onClick={acknowledge} autoFocus>{t("J'ai compris")}</Button>
      </div>
    </Dialog>
  );
}

export default SafetyNotice;
