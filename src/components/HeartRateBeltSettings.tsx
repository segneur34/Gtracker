import { t } from '../core/i18n';
import { plainError } from '../platform/errorText';
import { Fragment, useEffect, useRef, useState, type Ref } from 'react';
import { useBeltLive } from '../hooks/useBeltLive';
import { useRecorderStatus } from '../hooks/useRecorder';
import { beltLabels } from '../platform/beltList';
import {
  RECORDING_BELT_HOLDER, addSavedBelt, beltHeldBy, bluetoothReady, chooseSavedBelt, forgetSavedBelt, heartRateSupported, heldBeltAddress,
  holdBelt, releaseBelt, savedBelt, savedBelts, scanBelts, stopBeltScan,
  type FoundBelt, type HeartRateBelt,
} from '../platform/heartRate';
import BeltStatus from './BeltStatus';
import { HelpText, HelpToggle, SettingRow } from './Help';
import SettingsSection from './SettingsSection';
import Button from './ui/Button';

/** Nom de la connexion prise par l'essai, rendue en quittant la page. */
const HOLDER = 'reglages';

/** Force du signal, en dBm, au-dessus de laquelle un appareil est dit « proche », puis « à portée » ; en dessous, « loin ». */
const SIGNAL_NEAR_DBM = -60;
const SIGNAL_IN_RANGE_DBM = -80;
const signalLabel = (rssi: number): string => (rssi >= SIGNAL_NEAR_DBM ? t('proche') : rssi >= SIGNAL_IN_RANGE_DBM ? t('à portée') : t('loin'));

/**
 * La partie « Ceintures et montres » du bloc « Connexion » de Réglages (`sectionRef` la désigne) : les ceintures et
 * montres retenues sur ce téléphone, ajoutées par une recherche, essayées (fréquence en
 * direct), choisies ou oubliées. Hors du téléphone, elle n'est qu'une phrase sous son titre.
 * L'application s'en souvient de plusieurs et
 * n'en lit qu'une à la fois : celle « utilisée au prochain départ »
 * (`platform/heartRate.ts`), que chaque activité propose à l'enregistrement si sa case est cochée. L'état de la
 * connexion se lit toujours, essai ou enregistrement en cours ; une recherche
 * dit, pour chaque appareil retenu, s'il est à portée, et propose les autres.
 * Pendant un enregistrement, rien ne change l'appareil utilisé : « Utiliser »,
 * « Oublier » et l'essai d'un autre sont grisés.
 */
function HeartRateBeltSettings({ sectionRef }: { sectionRef?: Ref<HTMLDivElement> }) {
  const [belts, setBelts] = useState<HeartRateBelt[]>(savedBelts);
  const [active, setActive] = useState<HeartRateBelt | null>(savedBelt);
  const [found, setFound] = useState<FoundBelt[] | null>(null);
  const [scanning, setScanning] = useState(false);
  /** Adresse de l'appareil en essai, `null` sans essai. */
  const [testing, setTesting] = useState<string | null>(null);
  const live = useBeltLive();
  const { state } = live;
  const busy = useRecorderStatus() !== 'idle';
  const [bluetoothOff, setBluetoothOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  /** Numéro de la dernière recherche : une recherche annulée ne montre pas ses résultats. */
  const searchGeneration = useRef(0);

  useEffect(() => {
    alive.current = true;
    if (heartRateSupported()) {
      bluetoothReady().then((ready) => { if (alive.current) setBluetoothOff(!ready); }).catch(() => undefined);
    }
    return () => {
      alive.current = false;
      releaseBelt(HOLDER);
      // Page quittée pendant une recherche : elle s'arrête.
      if (searchGeneration.current > 0) void stopBeltScan();
    };
  }, []);

  if (!heartRateSupported()) {
    return (
      <SettingsSection title={t('Ceintures et montres')} ref={sectionRef}>
        <p className="ui-hint">{t("Sur l'application Android seulement.")}</p>
      </SettingsSection>
    );
  }

  /** Relit la liste et l'appareil actif, après un changement. */
  const reload = () => {
    setBelts(savedBelts());
    setActive(savedBelt());
  };

  const search = async () => {
    const mine = ++searchGeneration.current;
    setScanning(true);
    setError(null);
    setFound(null);
    try {
      const list = await scanBelts();
      if (alive.current && searchGeneration.current === mine) {
        setFound(list);
        setBluetoothOff(false);
      }
    } catch (err) {
      if (alive.current && searchGeneration.current === mine) setError(t('Recherche impossible : {error}.', { error: plainError(err, t('erreur inconnue')) }));
    } finally {
      if (alive.current && searchGeneration.current === mine) setScanning(false);
    }
  };

  /** « Annuler » : la recherche s'arrête, ses résultats ne sont pas montrés. */
  const cancelSearch = () => {
    searchGeneration.current += 1;
    setScanning(false);
    setFound(null);
    void stopBeltScan();
  };

  /** Retient un appareil trouvé ; il devient celui du prochain départ, sauf pendant un enregistrement. */
  const add = (next: FoundBelt) => {
    addSavedBelt({ address: next.address, name: next.name, ...(next.random !== undefined && { random: next.random }) }, !busy);
    reload();
    setFound(null);
  };

  const choose = (belt: HeartRateBelt) => {
    chooseSavedBelt(belt);
    reload();
  };

  const stopTest = () => {
    releaseBelt(HOLDER);
    setTesting(null);
  };

  const startTest = async (belt: HeartRateBelt) => {
    setError(null);
    // Un seul appareil à la fois : l'essai d'un autre rend d'abord le précédent.
    if (testing !== null) stopTest();
    try {
      const release = await holdBelt(HOLDER, belt);
      // Page quittée pendant la connexion : son nettoyage est déjà passé, la ceinture est rendue tout de suite.
      if (!alive.current) {
        release();
        return;
      }
      setTesting(belt.address);
      setBluetoothOff(false);
    } catch (err) {
      if (alive.current) setError(t('Connexion impossible : {error}.', { error: plainError(err, t('erreur inconnue')) }));
    }
  };

  const forget = (belt: HeartRateBelt) => {
    if (testing === belt.address) stopTest();
    forgetSavedBelt(belt.address);
    reload();
  };

  const recording = beltHeldBy(RECORDING_BELT_HOLDER);
  const held = heldBeltAddress();
  // L'état se lit sous l'appareil essayé, sinon sous celui que tient l'enregistrement, sinon sous celui du prochain départ.
  const statusAddress = testing ?? (recording ? held ?? active?.address : active?.address) ?? null;
  const labels = beltLabels(belts);
  const others = found ? found.filter((f) => !belts.some((b) => b.address === f.address)) : [];

  /** Ce que la dernière recherche dit d'un appareil retenu. */
  const searchMark = (belt: HeartRateBelt): string | null => {
    if (!found) return null;
    const mine = found.find((f) => f.address === belt.address);
    if (mine) return t('trouvée, {signal}', { signal: signalLabel(mine.rssi) });
    if (held === belt.address && state === 'connected') return t("connectée, donc absente de la recherche : un appareil connecté ne s'annonce plus");
    return t('pas trouvée : est-elle portée ?');
  };

  return (
    <SettingsSection title={t('Ceintures et montres')} extra={<HelpToggle helpKey="capteurs:ceinture" label={t('Ceintures et montres')} />} ref={sectionRef}>
      <HelpText helpKey="capteurs:ceinture">
        {t("Ceinture ou montre qui diffuse sa fréquence cardiaque en Bluetooth (basse consommation), sans appairage ni application de sa marque : portez-la, électrodes humidifiées, puis « Ajouter ». L'application s'en souvient de plusieurs et n'en lit qu'une à la fois, celle « utilisée au prochain départ » : « Utiliser » la change ici, « Changer » à la page Enregistrer. Elle est proposée à l'enregistrement des activités où « Ceinture cardio » est cochée.")}
      </HelpText>
      {belts.map((b, i) => {
        const isActive = active?.address === b.address;
        const usedByRecording = recording && held === b.address;
        const mark = searchMark(b);
        const signal = found?.find((f) => f.address === b.address)?.rssi;
        return (
          <Fragment key={b.address}>
            <div className="settings-row settings-row--sub">
              <span className="settings-row__label">{labels[i]}</span>
              <div className="settings-sports__pair">
                {usedByRecording
                  ? <span className="settings-sports__mark">{t("utilisée par l'enregistrement")}</span>
                  : isActive && <span className="settings-sports__mark">{t('utilisée au prochain départ')}</span>}
                {mark && <span className="settings-sports__mark" title={signal === undefined ? undefined : `${signal} dBm`}>{mark}</span>}
                {!isActive && <Button size="s" disabled={busy} onClick={() => choose(b)}>{t('Utiliser')}</Button>}
                <Button size="s" disabled={busy && testing !== b.address && held !== null && held !== b.address}
                  onClick={() => (testing === b.address ? stopTest() : void startTest(b))}>
                  {testing === b.address ? t("Arrêter l'essai") : t('Essayer')}
                </Button>
                <Button size="s" disabled={busy} onClick={() => forget(b)}>{t('Oublier')}</Button>
              </div>
            </div>
            {statusAddress === b.address && (
              <SettingRow sub label={t('État')} helpKey="capteurs:etat"
                help={t("Connectée par l'essai ou par un enregistrement ; une recherche dit aussi si chaque appareil retenu est à portée.")}>
                <BeltStatus state={state} bpm={live.bpm} offText={bluetoothOff ? t('Bluetooth éteint') : null} />
              </SettingRow>
            )}
          </Fragment>
        );
      })}
      <div className="settings-row settings-row--sub">
        <div className="settings-sports__pair">
          {belts.length === 0 && <span className="settings-sports__mark">{t('aucune')}</span>}
          <Button size="s" disabled={scanning} onClick={() => void search()}>{scanning ? t('Recherche…') : t('Ajouter')}</Button>
          {scanning && <Button size="s" onClick={cancelSearch}>{t('Annuler')}</Button>}
        </div>
      </div>
      {found && (
        <div className="settings-row settings-row--sub">
          <span className="settings-row__label">{t('À ajouter')}</span>
          <div className="settings-sports__pair">
            {others.length === 0
              ? <span className="settings-sports__mark">{t('aucun nouvel appareil : est-il porté, et le Bluetooth allumé ?')}</span>
              : others.map((f) => (
                <Button size="s" key={f.address} title={t("{rssi} dBm : l'ajouter", { rssi: f.rssi })} onClick={() => add(f)}>
                  {f.name} · {signalLabel(f.rssi)}
                </Button>
              ))}
          </div>
        </div>
      )}
      {error && <div className="ui-alert ui-alert--warning">{error}</div>}
    </SettingsSection>
  );
}

export default HeartRateBeltSettings;
