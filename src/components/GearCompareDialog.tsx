import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { activityDisplayName } from '../core/activities';
import { dayMonthYearTime } from '../core/calendar';
import { STORAGE_KEYS } from '../core/appIdentity';
import { t, tn } from '../core/i18n';
import { MISSING } from '../core/units';
import { settingsFileValues, useLibraryFields, type SettingsFileInfo } from '../hooks/useSessionLibrary';
import { readStoredSettings, subscribeStoredSettings, useAllSportSettings } from '../hooks/useSportSettings';
import {
  activityGearLists, compareGear, phoneGearChanges, withGearCopied, withGearMerged, withGearRemoved,
  type GearActivityComparison, type GearLineRow, type GearRow, type GearRowKind,
} from '../library/gearCompare';
import { alikeItemsWithin, gearGesturesAllowed, gearLineGesture, gearRowGesture } from '../library/gearCompareView';
import type { GearGroup, GearItem } from '../library/notes';
import { deviceNameText } from '../library/settingsFile';
import Button from './ui/Button';
import ChoiceButtons from './ui/ChoiceButtons';
import Dialog from './ui/Dialog';
import './GearCompareDialog.css';

/**
 * « Matériel des deux appareils », dans Réglages › Mémoire du programme Windows : la liste de matériel de
 * l'ordinateur et celle d'un autre appareil (son fichier de réglages, la copie du dossier, sans téléphone branché),
 * activité par activité, rangée par rangée (`library/gearCompare.ts`). Chaque geste (copier, réunir, supprimer)
 * modifie la liste de l'ordinateur seule, écrite comme dans Réglages › Activités ; son fichier de réglages suit,
 * et le téléphone la reprend par un geste. Aucune fiche de session n'est réécrite.
 */

/** Deux pièces ou deux lignes à réunir : celle qui reste (`keepId`, de l'ordinateur) et celle qu'elle reçoit. */
interface MergeQuestion {
  activityId: string;
  keepId: string;
  absorbed: GearGroup | GearItem;
  names: [string, string];
}

/** Ce que dit la première colonne d'une rangée de pièce. */
const rowKindText = (kind: GearRowKind): string => {
  switch (kind) {
    case 'same': return '=';
    case 'merged': return t('= réuni ici');
    case 'alike': return t('≈ se ressemblent');
    case 'phoneOnly': return t('← manque ici');
    case 'pcOnly': return t('→ manque au téléphone');
  }
};

/** Ce que dit une ligne qui n'est pas la même des deux côtés, sous son nom. */
const lineKindText = (line: GearLineRow): string | null => {
  switch (line.kind) {
    case 'pcOnly': return t('ligne absente du téléphone');
    case 'phoneOnly': return t("ligne absente de l'ordinateur");
    case 'alike': return t('≈ se ressemble à « {name} »', { name: line.phone?.name ?? '' });
    case 'merged': return t('« {name} » réunie ici', { name: line.phone?.name ?? '' });
    default: return null;
  }
};

const activityKey = (c: GearActivityComparison): string => `${c.pc?.activity.id ?? ''}|${c.phone?.activity.id ?? ''}`;

const activityName = (c: GearActivityComparison): string => {
  const ref = c.pc?.activity ?? c.phone?.activity;
  return ref ? activityDisplayName(ref) : '';
};

/** Ajouts, retraits et réunions que le téléphone recevrait, en une phrase. */
const changesText = (comparisons: readonly GearActivityComparison[], ownName: string): string => {
  const { added, removed, merged } = phoneGearChanges(comparisons);
  const parts = [
    added.length > 0 ? tn(added.length, '{n} ajout', '{n} ajouts') : null,
    removed.length > 0 ? tn(removed.length, '{n} retrait', '{n} retraits') : null,
    merged.length > 0 ? tn(merged.length, '{n} réunion', '{n} réunions') : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return t('Pour le téléphone : rien à changer.');
  return `${t('Pour le téléphone : {changes}.', { changes: parts.join(', ') })} `
    + t('Après « Synchroniser », sur le téléphone : Réglages › Mémoire › « {name} » › « Reprendre le matériel ».', { name: ownName });
};

function GearCompareDialog({ onClose }: { onClose: () => void }) {
  const { settingsFiles, deviceName } = useLibraryFields('settingsFiles', 'deviceName');
  const others = useMemo(() => settingsFiles.filter((f) => !f.own), [settingsFiles]);
  const [fileName, setFileName] = useState<string | null>(null);
  const file: SettingsFileInfo | undefined = others.find((f) => f.fileName === fileName) ?? others[0];
  /** Valeurs du fichier de l'autre appareil, relues à son choix ; `values` `null` : illisible ou absent. */
  const [read, setRead] = useState<{ fileName: string; values: Record<string, unknown> | null } | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [merging, setMerging] = useState<MergeQuestion | null>(null);
  const [keptName, setKeptName] = useState<'0' | '1'>('0');

  const { setFor } = useAllSportSettings();
  const stored = useSyncExternalStore(subscribeStoredSettings, readStoredSettings);
  const pcLists = useMemo(() => activityGearLists(stored), [stored]);

  // Relu à chaque nouvelle version du fichier (une synchronisation pendant que la fenêtre est ouverte).
  const wanted = file?.fileName ?? null;
  const wantedAt = file?.savedAt ?? null;
  useEffect(() => {
    if (wanted === null) return;
    let current = true;
    void settingsFileValues(wanted).then((values) => {
      if (current) setRead({ fileName: wanted, values });
    });
    return () => { current = false; };
  }, [wanted, wantedAt]);

  const phoneLists = useMemo(
    () => (read && read.fileName === wanted && read.values ? activityGearLists(read.values[STORAGE_KEYS.sportSettings]) : null),
    [read, wanted],
  );
  const comparisons = useMemo(() => (phoneLists ? compareGear(pcLists, phoneLists) : []), [pcLists, phoneLists]);
  const loaded = read !== null && read.fileName === wanted;
  const phoneHasList = phoneLists?.some((l) => (l.groups?.length ?? 0) > 0) ?? false;
  const shown = comparisons.find((c) => activityKey(c) === activity) ?? comparisons[0];
  const otherName = file ? deviceNameText(file.name) : '';

  /** Liste de l'ordinateur pour une activité, relue au dernier rendu ; une option coupée part d'une liste vide. */
  const pcGroupsOf = (activityId: string): GearGroup[] => pcLists.find((l) => l.activity.id === activityId)?.groups ?? [];
  const write = (activityId: string, groups: GearGroup[]) => setFor(activityId, 'gearGroups', groups);

  const askRemove = (activityId: string, entry: GearGroup | GearItem) => {
    if (!window.confirm(t("Supprimer « {name} » de la liste de l'ordinateur ? Ses sessions le gardent, « (hors liste) » dans les Statistiques.", { name: entry.name }))) return;
    write(activityId, withGearRemoved(pcGroupsOf(activityId), entry.id));
  };

  const askMerge = (activityId: string, keep: GearGroup | GearItem, absorbed: GearGroup | GearItem) => {
    setKeptName('0');
    setMerging({ activityId, keepId: keep.id, absorbed, names: [keep.name, absorbed.name] });
  };

  const confirmMerge = () => {
    if (!merging) return;
    const name = merging.names[Number(keptName)];
    write(merging.activityId, withGearMerged(pcGroupsOf(merging.activityId), merging.keepId, merging.absorbed, name));
    setMerging(null);
  };

  if (merging) {
    return (
      <Dialog title={t('Matériel des deux appareils')} onClose={() => setMerging(null)} className="gear-compare">
        <p className="gear-compare__text">{t('Réunir « {a} » et « {b} » ?', { a: merging.names[0], b: merging.names[1] })}</p>
        <div className="gear-compare__choice">
          <span>{t('Nom gardé :')}</span>
          <ChoiceButtons small label={t('Nom gardé')} value={keptName} onChange={setKeptName}
            items={[{ key: '0', label: merging.names[0] }, { key: '1', label: merging.names[1] }]} />
        </div>
        <p className="gear-compare__text">{t("Les sessions ne sont pas réécrites : celles qui portent l'autre nom comptent pour celui-ci.")}</p>
        <div className="gear-compare__actions">
          <Button variant="secondary" onClick={() => setMerging(null)}>{t('Annuler')}</Button>
          <Button variant="primary" onClick={confirmMerge}>{t('Réunir')}</Button>
        </div>
      </Dialog>
    );
  }

  /** Bouton du geste d'une rangée ou d'une ligne ; `null` sans geste. */
  const gestureButton = (c: GearActivityComparison, line: GearLineRow, row: GearRow | null) => {
    if (!c.pc || !gearGesturesAllowed(c)) return null;
    const activityId = c.pc.activity.id;
    const gesture = row ? gearRowGesture(row) : gearLineGesture(line);
    const pcEntry = row ? row.pc : line.pc;
    const phoneEntry = row ? row.phone : line.phone;
    const phoneLine = line.phone;
    if (gesture === 'copy' && phoneLine) {
      return (
        <Button size="s" onClick={() => write(activityId, withGearCopied(pcGroupsOf(activityId), line.pc?.id ?? null, phoneLine, row ? row.phone : null))}>
          {t("Copier vers l'ordinateur")}
        </Button>
      );
    }
    if (gesture === 'merge' && pcEntry && phoneEntry) {
      return <Button size="s" onClick={() => askMerge(activityId, pcEntry, phoneEntry)}>{t('Réunir')}</Button>;
    }
    if (gesture === 'remove' && pcEntry) {
      return <Button size="s" variant="danger" onClick={() => askRemove(activityId, pcEntry)}>{t('Supprimer')}</Button>;
    }
    return null;
  };

  const lineRows = (c: GearActivityComparison, line: GearLineRow, index: number) => {
    const note = lineKindText(line);
    const pcActivityId = gearGesturesAllowed(c) ? c.pc?.activity.id ?? null : null;
    const gesturesOn = pcActivityId !== null;
    return (
      <tbody key={`${line.pc?.id ?? ''}|${line.phone?.id ?? ''}|${index}`}>
        <tr className="gear-compare__line">
          <th scope="rowgroup">
            <span className="gear-compare__line-name">{line.pc?.name ?? line.phone?.name}</span>
            {note && <span className="gear-compare__note">{note}</span>}
          </th>
          <th scope="col">{t('Ordinateur')}</th>
          <th scope="col">{otherName}</th>
          <td className="gear-compare__act">{gestureButton(c, line, null)}</td>
        </tr>
        {line.rows.map((row, k) => (
          <tr key={`${row.pc?.id ?? ''}|${row.phone?.id ?? ''}|${k}`}>
            <td className="gear-compare__kind">{rowKindText(row.kind)}</td>
            <td>{row.pc?.name ?? MISSING}</td>
            <td>
              {row.phone?.name ?? MISSING}
              {row.kind === 'pcOnly' && <span className="gear-compare__note">{t('(lui sera proposé)')}</span>}
            </td>
            <td className="gear-compare__act">
              {gestureButton(c, line, row)}
              {row.kind === 'phoneOnly' && gesturesOn && (
                <span className="gear-compare__note">{t("(quittera le téléphone s'il reprend la liste sans copie)")}</span>
              )}
            </td>
          </tr>
        ))}
        {pcActivityId !== null && alikeItemsWithin(line.pc).map(([a, b]) => (
          <tr key={`${a.id}|${b.id}`}>
            <td className="gear-compare__kind">{t('≈ se ressemblent ici')}</td>
            <td>{a.name}<span className="gear-compare__note">{b.name}</span></td>
            <td />
            <td className="gear-compare__act">
              <Button size="s" onClick={() => askMerge(pcActivityId, a, b)}>{t('Réunir')}</Button>
            </td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <Dialog title={t('Matériel des deux appareils')} onClose={onClose} className="gear-compare">
      {others.length > 1 && file && (
        <ChoiceButtons small label={t('Autre appareil')} value={file.fileName} onChange={(name) => { setFileName(name); setActivity(null); }}
          items={others.map((f) => ({ key: f.fileName, label: deviceNameText(f.name) }))} />
      )}
      {(!file || loaded) && (
        file && phoneHasList ? (
          <>
            <p className="gear-compare__text gear-compare__muted num">
              {t('Liste de « {name} », modifiée le {date} : la copie du dossier, à jour de la dernière synchronisation.', { name: otherName, date: dayMonthYearTime(file.savedAt) })}
            </p>
            {shown && (
              <ChoiceButtons small label={t('Activité')} value={activityKey(shown)} onChange={setActivity}
                items={comparisons.map((c) => ({ key: activityKey(c), label: activityName(c) }))} />
            )}
            {shown && !shown.phone && (
              <p className="gear-compare__text">{t('Activité « {name} » absente du téléphone : reprenez tous les réglages.', { name: activityName(shown) })}</p>
            )}
            {shown && !shown.pc && (
              <p className="gear-compare__text">{t("Activité « {name} » absente de l'ordinateur : créez-la dans Activités, ou reprenez tous les réglages du téléphone.", { name: activityName(shown) })}</p>
            )}
            {shown?.equal && <p className="gear-compare__text">{t('Les deux listes sont les mêmes.')}</p>}
            {shown && (
              <div className="gear-compare__scroll">
                <table className="gear-compare__table">
                  {shown.lines.map((line, k) => lineRows(shown, line, k))}
                </table>
              </div>
            )}
            <p className="gear-compare__text gear-compare__summary">{changesText(comparisons, deviceNameText(deviceName))}</p>
          </>
        ) : (
          <p className="gear-compare__text">{t("Aucune liste du téléphone dans ce dossier. Branchez-le et touchez « Synchroniser » : sa liste arrive avec ses réglages.")}</p>
        )
      )}
      <div className="gear-compare__actions">
        <Button variant="secondary" onClick={onClose}>{t('Fermer')}</Button>
      </div>
    </Dialog>
  );
}

export default GearCompareDialog;
