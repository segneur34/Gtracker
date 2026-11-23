import type { Ref } from 'react';
import { t } from '../core/i18n';
import { heartRateSupported } from '../platform/heartRate';
import ComputerLinkCard from './ComputerLinkCard';
import HeartRateBeltSettings from './HeartRateBeltSettings';
import PhoneAppCard from './PhoneAppCard';
import WirelessPhoneCard from './WirelessPhoneCard';
import './ConnectionSettings.css';

/**
 * Contenu du bloc « Connexion » de Réglages : ce qui relie Gtracker à un autre appareil. Chaque carte ne se montre que
 * là où elle existe : sur le programme Windows, « Téléphone » (`WirelessPhoneCard`) et « Application du téléphone »
 * (`PhoneAppCard`) ; sur le téléphone, « Ordinateur » (`ComputerLinkCard`) ; partout, en dernier, la ligne des ceintures
 * et montres (`HeartRateBeltSettings`), qui n'est qu'une phrase hors du téléphone et reçoit alors son titre ici.
 * `beltsRef` désigne cette dernière ligne, où mène `?bloc=capteurs`.
 */
function ConnectionSettings({ beltsRef }: { beltsRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="ui-stack-3">
      <WirelessPhoneCard />
      <PhoneAppCard />
      <ComputerLinkCard />
      <div ref={beltsRef}>
        {!heartRateSupported() && <strong className="connection-settings__title">{t('Ceintures et montres')}</strong>}
        <HeartRateBeltSettings />
      </div>
    </div>
  );
}

export default ConnectionSettings;
