import { useEffect, useState } from 'react';
import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';
import { chooseSafetyCopyFolder, safetyCopyFolder, safetyCopyFolderChoosable } from '../platform/phoneCable';
import { HelpText, HelpToggle } from './Help';
import SettingsSection from './SettingsSection';
import Button from './ui/Button';

/**
 * Dossier des copies de sécurité, dans Réglages › Mémoire, programme Windows seulement (et coquille qui le laisse
 * choisir) : le dossier où Gtracker copie les deux mémoires avant la première synchronisation d'un téléphone, et
 * « Choisir un autre dossier », qui ouvre la fenêtre de choix de Windows ; le programme retient le dossier choisi et
 * refuse un dossier de la mémoire, ce que la ligne sous les boutons dit.
 */
function SafetyCopyFolderSetting() {
  const [available] = useState(safetyCopyFolderChoosable);
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    safetyCopyFolder().then(
      (read) => { if (alive) setFolder(read); },
      (err: unknown) => { if (alive) setProblem(errorMessage(err)); },
    );
    return () => { alive = false; };
  }, [available]);

  if (!available) return null;

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const choice = await chooseSafetyCopyFolder(t('Dossier des copies de sécurité'));
      setFolder(choice.folder);
      if (choice.outcome === 'insideMemory') {
        setProblem(t('Les copies ne peuvent pas aller dans la mémoire de cet ordinateur : choisissez un autre dossier.'));
      }
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title={t('Copies de sécurité')} extra={<HelpToggle helpKey="memoire:copies" label={t('Copies de sécurité')} />}>
      <HelpText helpKey="memoire:copies">
        {t("Avant la première synchronisation avec un téléphone, Gtracker copie les deux mémoires par sécurité dans ce dossier. Rien n'y est jamais effacé.")}
      </HelpText>
      {folder !== null && <p className="ui-hint ui-hint--m set-safety-folder">{folder}</p>}
      <div className="ui-row-s2 ui-wrap">
        <Button disabled={busy} onClick={() => void choose()}>{t('Choisir un autre dossier')}</Button>
      </div>
      {problem !== null && <p className="ui-text-s ui-m-0 ui-danger-text" role="status">{problem}</p>}
    </SettingsSection>
  );
}

export default SafetyCopyFolderSetting;
