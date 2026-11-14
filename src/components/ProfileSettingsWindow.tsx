import { useCloseOnEscapeOrBack } from '../hooks/useDismiss';
import { t } from '../core/i18n';
import { IconClose } from './icons';
import ProfileScreenSettings from './ProfileScreenSettings';
import './ProfileScreenSettings.css';

/**
 * Fenêtre des réglages de l'écran Profil, ouverte sous l'en-tête en touchant la photo ronde : les mêmes réglages que
 * dans Réglages › Pratiquant (`ProfileScreenSettings`). Chaque choix s'applique tout de suite ; la fenêtre reste
 * ouverte et se ferme par son bouton, Échap ou le retour d'Android, sans quitter le Profil.
 */
export default function ProfileSettingsWindow({ onClose }: { onClose: () => void }) {
  useCloseOnEscapeOrBack(onClose);
  return (
    <section className="profile-settings-window" aria-labelledby="profile-settings-window-title">
      <div className="profile-settings-window__head">
        <h2 id="profile-settings-window-title" className="profile-settings-window__title">{t('Réglages du Profil')}</h2>
        <button type="button" className="profile-settings-window__close" aria-label={t('Fermer')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <ProfileScreenSettings />
    </section>
  );
}
