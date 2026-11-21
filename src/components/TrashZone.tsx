import { useRef, useState } from 'react';
import { dayMonthYear } from '../core/calendar';
import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';
import { formatSessionDate } from '../core/units';
import { TRASH_ZONE_ID, sortedTrashEntries, trashCounts, trashSummaryText, type TrashEntry } from '../library/trash';
import { deleteTrashEntry, emptyTrash, restoreTrashEntry, useTrash } from '../hooks/useTrash';
import { IconTrash, IconUndo } from './icons';
import PanelTitle from './PanelTitle';
import Button from './ui/Button';
import HoldButton from './ui/HoldButton';

/**
 * Corbeille du programme Windows, dans Réglages › Mémoire : une ligne « Corbeille : n sessions, gardées 30 jours »,
 * (« Corbeille vide. » quand elle l'est, pour que l'arrivée depuis Sessions ne tombe pas sur rien) qui se déplie sur la liste (nom, date de la session, date de suppression) ;
 * pour chaque entrée « Restaurer » et « Supprimer définitivement », et « Vider la corbeille ». Les deux gestes qui
 * effacent se tiennent une seconde puis se confirment, comme « Tout supprimer ». Rien hors du programme Windows :
 * la corbeille y est toujours vide.
 */

/** Durée de l'appui : une seconde, puis la confirmation. */
const TRASH_HOLD_MS = 1000;
const trashHoldMs = (): number => TRASH_HOLD_MS;

/** Date montrée d'une entrée : celle de la session, rien pour un itinéraire. */
const entryDate = (entry: TrashEntry): string | null => (entry.startMs !== null ? formatSessionDate(entry.startMs) : null);

/** Date d'entrée dans la corbeille, accordée à ce qu'elle garde. */
const deletedOn = (entry: TrashEntry): string => {
  const date = dayMonthYear(entry.deletedAtMs);
  return entry.kind === 'session' ? t('session supprimée le {date}', { date }) : t('itinéraire supprimé le {date}', { date });
};

function TrashZone() {
  const { entries, error } = useTrash();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ text: string; failed: boolean } | null>(null);
  /** Un geste à la fois : les boutons sont grisés aussitôt, le verrou suit aussi un rendu en retard (`ref`). */
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const summary = trashSummaryText(trashCounts(entries));

  const run = async (action: () => Promise<string | null>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNote(null);
    try {
      const text = await action();
      if (text !== null) setNote({ text, failed: false });
    } catch (err) {
      setNote({ text: errorMessage(err, t('erreur inconnue')), failed: true });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const restore = (entry: TrashEntry) => void run(() => restoreTrashEntry(entry));

  const remove = (entry: TrashEntry) => void run(async () => {
    if (!window.confirm(t('Supprimer définitivement « {name} » ? Ses fichiers quittent la corbeille, sans retour possible.', { name: entry.name }))) return null;
    await deleteTrashEntry(entry);
    return t('Supprimé définitivement : « {name} ».', { name: entry.name });
  });

  const empty = () => void run(async () => {
    if (!window.confirm(t('Vider la corbeille ? Tout ce qu’elle garde est supprimé définitivement, sans retour possible.'))) return null;
    await emptyTrash();
    return t('Corbeille vidée.');
  });

  return (
    <div className="ui-stack-3" id={TRASH_ZONE_ID}>
      {summary === null && error === null && note === null && <p className="ui-muted ui-text-s ui-m-0">{t('Corbeille vide.')}</p>}
      {summary !== null && <PanelTitle label={summary} open={open} onToggle={() => setOpen((o) => !o)} />}
      {open && summary !== null && (
        <>
          <ul className="set-files-list">
            {sortedTrashEntries(entries).map((entry) => (
              <li key={entry.dir} className="set-files-row">
                <span className="ui-stack ui-min-w-0">
                  <strong className="ui-text-m">{entry.name}</strong>
                  <span className="num ui-muted ui-text-s">
                    {[entryDate(entry), deletedOn(entry)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="ui-row-s2 ui-wrap">
                  <Button size="s" onClick={() => restore(entry)} disabled={busy}>
                    <IconUndo size={16} /> {t('Restaurer')}
                  </Button>
                  <HoldButton onHold={() => remove(entry)} getHoldMs={trashHoldMs} size="s" label={t('Supprimer définitivement')}
                    lead={<IconTrash size={16} />} dialTitle={t('Supprimer définitivement')} icon={<IconTrash size={48} />}
                    action="supprimer" disabled={busy}
                    ariaLabel={t('Supprimer définitivement « {name} » : maintenir une seconde', { name: entry.name })} />
                </span>
              </li>
            ))}
          </ul>
          <div className="ui-row-s2 ui-wrap">
            <HoldButton onHold={empty} getHoldMs={trashHoldMs} label={t('Vider la corbeille')}
              lead={<IconTrash size={18} />} dialTitle={t('Vider la corbeille')} icon={<IconTrash size={48} />}
              action="vider la corbeille" disabled={busy} ariaLabel={t('Vider la corbeille : maintenir une seconde')} />
          </div>
        </>
      )}
      {error !== null && <p className="ui-muted ui-text-s ui-m-0">{error}</p>}
      {note !== null && <p className={note.failed ? 'ui-danger-text ui-text-s ui-m-0' : 'ui-muted ui-text-s ui-m-0'}>{note.text}</p>}
    </div>
  );
}

export default TrashZone;
