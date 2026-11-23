import { dayMonthYearTime } from '../core/calendar';
import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { STORAGE_KEYS } from '../core/appIdentity';
import {
  adoptSettingsFile, adoptSettingsGear, importSettingsFile, keepOwnSettings, renameDevice, settingsFileValues,
  useLibraryFields, type SettingsFileInfo,
} from '../hooks/useSessionLibrary';
import { readStoredSettings, subscribeStoredSettings } from '../hooks/useSportSettings';
import { gearAdoptQuestion } from '../library/gearCompareView';
import { DEVICE_NAME_MAX, adoptedGearChanges, deviceNameText, gearListsDiffer } from '../library/settingsFile';
import { isDesktopApp, isNativeApp } from '../platform/runtime';
import GearCompareDialog from './GearCompareDialog';
import { HelpText, HelpToggle } from './Help';
import SettingsSection from './SettingsSection';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import { t, tn } from '../core/i18n';
import { tRich } from './tRich';

/**
 * Réglages par appareil, dans Réglages › Mémoire : le nom de
 * cet appareil, qui nomme son fichier dans `reglages/`, et la liste des
 * fichiers du dossier, avec « Reprendre » sur ceux des autres appareils, et
 * « Reprendre le matériel » quand leur liste de matériel diffère de celle-ci.
 * « Importer un fichier de réglages » range un fichier choisi à la main, puis
 * propose de le reprendre : seul moyen là où l'on ne peut rien déposer dans
 * la mémoire (celle du navigateur, sous Firefox). `SettingsOfferBanner` propose les réglages d'un autre appareil
 * quand ils diffèrent de ceux-ci (carte Mémoire, en tête des bibliothèques comme dans Réglages).
 */


const mutedStyle = { margin: 0, color: 'var(--muted)', fontSize: 'var(--text-s)', lineHeight: 1.5 } as const;

/**
 * Confirmation avant de prendre les réglages d'un autre appareil, depuis le bandeau, la liste ou un import :
 * « Remplacer » les prend (la page se recharge ensuite), « Annuler », × ou le fond ne changent rien.
 * `onClose` dit si l'on a pris.
 */
function AdoptSettingsDialog({ file, onClose }: { file: SettingsFileInfo; onClose: (adopted: boolean) => void }) {
  const name = deviceNameText(file.name);
  const cancel = () => onClose(false);
  const confirm = () => {
    void adoptSettingsFile(file.fileName);
    onClose(true);
  };
  return (
    <Dialog title={t('Prendre les réglages de « {name} » ?', { name })} onClose={cancel}>
      <div className="ui-stack-2">
        <p className="ui-m-0">
          {isNativeApp()
            ? t('Ils remplacent ceux de ce téléphone : activités et leurs réglages, profil du pratiquant, séances du compteur.')
            : t('Ils remplacent ceux de cet ordinateur : activités et leurs réglages, profil du pratiquant, séances du compteur.')}
        </p>
        <p className="ui-hint">{t('Le matériel seul peut aussi se reprendre, dans Réglages › Mémoire.')}</p>
      </div>
      <div className="ui-row-s2 ui-wrap ui-mt-12">
        <Button variant="ghost" onClick={cancel}>{t('Annuler')}</Button>
        <Button variant="primary" onClick={confirm}>{t('Remplacer')}</Button>
      </div>
    </Dialog>
  );
}

/**
 * Bandeau des réglages d'un autre appareil, montré seulement quand ils diffèrent de ceux-ci, sur l'ordinateur comme
 * sur le téléphone : « Garder les miens », ou « Prendre ceux de … » puis la confirmation. Il reste jusqu'à la réponse.
 */
export function SettingsOfferBanner() {
  const { settingsOffer } = useLibraryFields('settingsOffer');
  /** Fichier dont la confirmation est ouverte. */
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!settingsOffer) return null;
  const name = deviceNameText(settingsOffer.name);
  return (
    <div className="ui-alert ui-alert--warning ui-stack-2">
      <span>
        {isNativeApp()
          ? tRich('Les réglages de <strong>« {name} »</strong> sont différents de ceux de ce téléphone.', { name })
          : tRich('Les réglages de <strong>« {name} »</strong> sont différents de ceux de cet ordinateur.', { name })}
      </span>
      <span className="ui-row-s2 ui-wrap">
        <Button size="s" onClick={() => keepOwnSettings(settingsOffer.fileName)}>{t('Garder les miens')}</Button>
        <Button size="s" variant="primary" onClick={() => setConfirming(settingsOffer.fileName)}>{t('Prendre ceux de « {name} »', { name })}</Button>
      </span>
      {confirming === settingsOffer.fileName && <AdoptSettingsDialog file={settingsOffer} onClose={() => setConfirming(null)} />}
    </div>
  );
}

/** « Reprendre », et « Reprendre le matériel » si la liste de matériel de ce fichier diffère de celle de cet appareil. */
function OtherFileActions({ file, theirs, mine, onAdoptGear, onAdopt }: {
  file: SettingsFileInfo;
  theirs: Record<string, unknown> | null;
  mine: Record<string, unknown>;
  onAdoptGear: (file: SettingsFileInfo, theirs: Record<string, unknown>) => void;
  onAdopt: (file: SettingsFileInfo) => void;
}) {
  return (
    <span className="ui-row-s2 ui-wrap">
      {theirs && gearListsDiffer(theirs, mine) && (
        <Button size="s" onClick={() => onAdoptGear(file, theirs)}>{t('Reprendre le matériel')}</Button>
      )}
      <Button size="s" onClick={() => onAdopt(file)}>{t('Reprendre')}</Button>
    </span>
  );
}

function SettingsFiles() {
  const { deviceName, settingsFiles, folderKind } = useLibraryFields('deviceName', 'settingsFiles', 'folderKind');
  /** Nom en cours de saisie ; `null` : celui de l'appareil. */
  const [draft, setDraft] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  /** Compte rendu du dernier import d'un fichier de réglages. */
  const [importNote, setImportNote] = useState<{ text: string; failed: boolean } | null>(null);
  const [comparing, setComparing] = useState(false);
  /** Fichier dont la confirmation « Prendre les réglages » est ouverte ; `imported` : il vient d'être importé. */
  const [adopting, setAdopting] = useState<{ file: SettingsFileInfo; imported: boolean } | null>(null);
  /** « Comparer le matériel » : programme Windows, quand le dossier porte le fichier de réglages d'un autre appareil. */
  const canCompareGear = isDesktopApp() && settingsFiles.some((f) => !f.own);

  // Valeurs des fichiers des autres appareils, relues à chaque nouvelle version, pour « Reprendre le matériel ».
  const [otherValues, setOtherValues] = useState<Record<string, Record<string, unknown> | null>>({});
  const othersKey = settingsFiles.filter((f) => !f.own).map((f) => `${f.savedAt}\t${f.fileName}`).join('\n');
  useEffect(() => {
    if (othersKey === '') return;
    let current = true;
    const names = othersKey.split('\n').map((line) => line.slice(line.indexOf('\t') + 1));
    void Promise.all(names.map(async (name) => [name, await settingsFileValues(name)] as const)).then((pairs) => {
      if (current) setOtherValues(Object.fromEntries(pairs));
    });
    return () => { current = false; };
  }, [othersKey]);
  // Réglages de cet appareil, suivis : une liste reprise ou modifiée refait aussitôt la comparaison.
  const stored = useSyncExternalStore(subscribeStoredSettings, readStoredSettings);
  const mine = useMemo(() => ({ [STORAGE_KEYS.sportSettings]: stored }), [stored]);

  /** « Reprendre le matériel », après la question qui dit ce qui change. */
  const adoptGear = (file: SettingsFileInfo, theirs: Record<string, unknown>) => {
    if (!window.confirm(gearAdoptQuestion(deviceNameText(file.name), adoptedGearChanges(theirs, mine), isNativeApp()))) return;
    void adoptSettingsGear(file.fileName);
  };

  const commit = async () => {
    if (draft === null) return;
    const reason = await renameDevice(draft);
    setRefusal(reason);
    if (reason === null) setDraft(null);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    const result = await importSettingsFile(picked);
    if ('refusal' in result) {
      setImportNote({ text: result.refusal, failed: true });
      return;
    }
    setImportNote(null);
    setAdopting({ file: result.file, imported: true });
  };

  /** Confirmation fermée : un fichier importé et laissé reste dans la liste, et la phrase le dit. */
  const closeAdopting = (adopted: boolean) => {
    if (adopting?.imported && !adopted) {
      setImportNote({ text: t('« {name} » est dans la liste : « Reprendre » quand vous voudrez.', { name: deviceNameText(adopting.file.name) }), failed: false });
    }
    setAdopting(null);
  };

  return (
    <SettingsSection title={t('Réglages')} extra={<HelpToggle helpKey="memoire:reglages" label={t('Réglages par appareil')} />}>
      <HelpText helpKey="memoire:reglages">
        {folderKind === 'browser'
          ? t("Chaque appareil range ses réglages sous son nom (Gtracker › reglages). Pour reprendre ceux d'un autre : « Importer un fichier de réglages », puis choisissez son fichier.")
          : t("Chaque appareil range ses réglages sous son nom (Gtracker › reglages). Pour reprendre ceux d'un autre : copiez son fichier dans ce dossier, puis « Mettre à jour » et « Reprendre », ou « Importer un fichier de réglages ».")}
      </HelpText>
      <label className="ui-row-s2 ui-center ui-wrap ui-text-s">
        <span>{t('Nom de cet appareil')}<HelpToggle helpKey="memoire:appareil" label={t('Nom de cet appareil')} /></span>
        <input value={draft ?? deviceNameText(deviceName)} maxLength={DEVICE_NAME_MAX} className="ui-field ui-field--s ui-w-180"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') { setDraft(null); setRefusal(null); }
          }} />
      </label>
      <HelpText helpKey="memoire:appareil">{t('Nomme le fichier de réglages de cet appareil.')}</HelpText>
      {refusal && <p style={{ ...mutedStyle, color: 'var(--danger)' }}>{refusal}</p>}
      <ul className="set-files-list">
        {settingsFiles.map((file) => (
          <li key={file.fileName} className="set-files-row">
            <span className="ui-stack ui-min-w-0">
              <strong className="ui-text-s">{deviceNameText(file.name)}</strong>
              <span className="num" style={mutedStyle}>
                {tn(file.activityCount, '{n} activité', '{n} activités')} · {t('modifiés le {date}', { date: dayMonthYearTime(file.savedAt) })}
              </span>
            </span>
            {file.own
              ? <span style={{ ...mutedStyle, fontWeight: 600 }}>{t('cet appareil')}</span>
              : <OtherFileActions file={file} theirs={otherValues[file.fileName] ?? null} mine={mine} onAdoptGear={adoptGear}
                onAdopt={(f) => setAdopting({ file: f, imported: false })} />}
          </li>
        ))}
      </ul>
      <div className="ui-row-s2 ui-wrap">
        <label className="ui-btn ui-btn--secondary ui-btn--s">
          {t('Importer un fichier de réglages')}
          <input type="file" accept=".json,application/json" hidden onChange={(e) => void handleImport(e)} />
        </label>
        {canCompareGear && <Button size="s" onClick={() => setComparing(true)}>{t('Comparer le matériel')}</Button>}
      </div>
      {comparing && <GearCompareDialog onClose={() => setComparing(false)} />}
      {adopting && <AdoptSettingsDialog file={adopting.file} onClose={closeAdopting} />}
      {importNote && <p style={{ ...mutedStyle, color: importNote.failed ? 'var(--danger)' : 'var(--muted)' }}>{importNote.text}</p>}
    </SettingsSection>
  );
}

export default SettingsFiles;
