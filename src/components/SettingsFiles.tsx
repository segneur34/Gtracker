import { dayMonthYearTime } from '../core/calendar';
import { useState, type ChangeEvent } from 'react';
import {
  adoptSettingsFile, dismissSettingsOffer, importSettingsFile, renameDevice, useLibraryFields, type SettingsFileInfo,
} from '../hooks/useSessionLibrary';
import { DEVICE_NAME_MAX, deviceNameText } from '../library/settingsFile';
import { HelpText, HelpToggle } from './Help';
import Button from './ui/Button';
import { t, tn } from '../core/i18n';
import { tRich } from './tRich';

/**
 * Réglages par appareil, dans Réglages › Mémoire : le nom de
 * cet appareil, qui nomme son fichier dans `reglages/`, et la liste des
 * fichiers du dossier, avec « Reprendre » sur ceux des autres appareils.
 * « Importer un fichier de réglages » range un fichier choisi à la main, puis
 * propose de le reprendre : seul moyen là où l'on ne peut rien déposer dans
 * la mémoire (celle du navigateur, sous Firefox). `SettingsOfferBanner` propose, une fois, celui d'un autre appareil apparu
 * dans le dossier (carte Mémoire, en tête des bibliothèques comme dans
 * Réglages).
 */


const mutedStyle = { margin: 0, color: 'var(--muted)', fontSize: 'var(--text-s)', lineHeight: 1.5 } as const;

/** « Reprendre », après confirmation : depuis la liste, le bandeau ou un import. Rend faux si l'on a renoncé. */
const adopt = (file: SettingsFileInfo): boolean => {
  const question = `${t('Reprendre les réglages de « {name} » ?', { name: deviceNameText(file.name) })}\n\n`
    + t('Ils remplacent ceux de cet appareil : activités et leurs réglages, profil du pratiquant, séances du compteur.') + ' '
    + t("Une session dont l'activité n'existe pas dans ces réglages s'affichera sous le nom de son calcul.");
  if (!window.confirm(question)) return false;
  void adoptSettingsFile(file.fileName);
  return true;
};

/** Bandeau « Nouveau fichier de réglages » : « Reprendre » ou « Fermer » ; le fichier reste dans la liste. */
export function SettingsOfferBanner() {
  const { settingsOffer } = useLibraryFields('settingsOffer');
  if (!settingsOffer) return null;
  return (
    <div className="ui-alert ui-alert--warning ui-row-s2 ui-center ui-wrap">
      <span className="set-files-grow">{tRich('Nouveau fichier de réglages : <strong>{name}</strong>.', { name: deviceNameText(settingsOffer.name) })}</span>
      <Button size="s" onClick={() => adopt(settingsOffer)}>{t('Reprendre')}</Button>
      <Button size="s" variant="ghost" onClick={dismissSettingsOffer}>{t('Fermer')}</Button>
    </div>
  );
}

function SettingsFiles() {
  const { deviceName, settingsFiles, folderKind } = useLibraryFields('deviceName', 'settingsFiles', 'folderKind');
  /** Nom en cours de saisie ; `null` : celui de l'appareil. */
  const [draft, setDraft] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  /** Compte rendu du dernier import d'un fichier de réglages. */
  const [importNote, setImportNote] = useState<{ text: string; failed: boolean } | null>(null);

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
    if (adopt(result.file)) setImportNote(null);
    else setImportNote({ text: t('« {name} » est dans la liste : « Reprendre » quand vous voudrez.', { name: deviceNameText(result.file.name) }), failed: false });
  };

  return (
    <div className="ui-stack-2">
      <strong className="set-files-title">
        {t('Réglages')}<HelpToggle helpKey="memoire:reglages" label={t('Réglages par appareil')} />
      </strong>
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
              <strong className="ui-text-m">{deviceNameText(file.name)}</strong>
              <span className="num" style={mutedStyle}>
                {tn(file.activityCount, '{n} activité', '{n} activités')} · {t('modifiés le {date}', { date: dayMonthYearTime(file.savedAt) })}
              </span>
            </span>
            {file.own
              ? <span style={{ ...mutedStyle, fontWeight: 600 }}>{t('cet appareil')}</span>
              : <Button size="s" onClick={() => adopt(file)}>{t('Reprendre')}</Button>}
          </li>
        ))}
      </ul>
      <div>
        <label className="ui-btn ui-btn--secondary ui-btn--s">
          {t('Importer un fichier de réglages')}
          <input type="file" accept=".json,application/json" hidden onChange={(e) => void handleImport(e)} />
        </label>
      </div>
      {importNote && <p style={{ ...mutedStyle, color: importNote.failed ? 'var(--danger)' : 'var(--muted)' }}>{importNote.text}</p>}
    </div>
  );
}

export default SettingsFiles;
