import type { Ref } from 'react';
import ComputerLinkCard from './ComputerLinkCard';
import HeartRateBeltSettings from './HeartRateBeltSettings';
import PhoneAppCard from './PhoneAppCard';
import WirelessPhoneCard from './WirelessPhoneCard';

/**
 * Contenu du bloc « Connexion » de Réglages : ce qui relie Gtracker à un autre appareil, en parties (`SettingsSection`)
 * séparées par un trait. Chaque partie ne se montre que là où elle existe : sur le programme Windows, « Téléphone »
 * (`WirelessPhoneCard`) et « Application du téléphone » (`PhoneAppCard`) ; sur le téléphone, « Ordinateur »
 * (`ComputerLinkCard`) ; partout, en dernier, « Ceintures et montres » (`HeartRateBeltSettings`), qui n'est qu'une
 * phrase hors du téléphone. `beltsRef` désigne cette dernière partie, où mène `?bloc=capteurs`.
 */
function ConnectionSettings({ beltsRef }: { beltsRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="ui-stack-3">
      <WirelessPhoneCard />
      <PhoneAppCard />
      <ComputerLinkCard />
      <HeartRateBeltSettings sectionRef={beltsRef} />
    </div>
  );
}

export default ConnectionSettings;
