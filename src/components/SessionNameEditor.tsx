import { plainError } from '../platform/errorText';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FAMILY_LABEL, sessionActivity } from '../core/activities';
import type { ShareStat } from '../core/shareImage';
import type { SportFamily } from '../core/sportProfiles';
import { dropLeaveWarning, hasLeaveWarning } from '../hooks/leaveGuard';
import { librarySession, readSessionExport, readSessionGpx, removeSession, updateSessionRecord, useSessionName } from '../hooks/useSessionLibrary';
import { readStoredActivities } from '../hooks/useSportSettings';
import { useTransientValue } from '../hooks/useTransientValue';
import { downloadBaseName } from '../library/naming';
import { bundleSessionGpx } from '../library/sessionBundle';
import { shareLabels } from '../library/shareStats';
import { safeFileName, saveToDownloads } from '../platform/files';
import { shareFile } from '../platform/share';
import { IconDownload, IconShare, IconTrash } from './icons';
import SessionRenameField from './SessionRenameField';
import ShareDialog from './ShareDialog';
import type { TrackSegment } from './TrackSegmentsLayer';
import Button from './ui/Button';
import HoldButton from './ui/HoldButton';
import MoreMenu from './ui/MoreMenu';

/** Ce que l'image de partage montre : la trace colorée de l'analyse et les chiffres de son onglet « général ». */
interface SessionShare {
  family: SportFamily;
  segments: ReadonlyArray<TrackSegment>;
  stats: ReadonlyArray<ShareStat>;
}

/** Durée d'affichage du compte rendu d'un téléchargement. */
const DOWNLOAD_NOTE_MS = 4000;

/** Durée de l'appui sur « Jeter » : une seconde, puis la confirmation. */
const DISCARD_HOLD_MS = 1000;
const discardHoldMs = (): number => DISCARD_HOLD_MS;

/** Question posée après l'appui tenu sur « Jeter » ; `drafted` : un brouillon de la session serait perdu. */
const discardQuestion = (drafted: boolean): string =>
  'Jeter cette session ? Elle sera supprimée de la mémoire, avec sa fiche et ses capteurs, et ne pourra pas être récupérée.'
  + (drafted ? ' Les modifications non enregistrées seront perdues.' : '');

/**
 * Nom d'une session de la mémoire, en tête de son analyse, son bouton
 * « Renommer » et son menu « … » (« Partager l'image », qui ouvre `ShareDialog` avec
 * ce que l'analyse passe dans `share` ; « Télécharger la session », dans
 * Téléchargements : un GPX complet, fiche et capteurs compris, que « Importer
 * des GPX » range tout entier sur un autre appareil ; « Jeter », en dernier,
 * tenu une seconde puis confirmé, qui supprime la session et mène à `back`,
 * la bibliothèque, où un échec de la suppression est dit). Le nom est écrit dans la fiche dès sa validation, comme un
 * changement de support (la bibliothèque offre le même renommage). Rien pour
 * un GPX ouvert hors de la mémoire ; ni renommage ni « Jeter » pour une fiche en
 * lecture seule, qui se télécharge quand même.
 */
function SessionNameEditor({ file, share, back }: { file: string | null; share?: SessionShare; back: string }) {
  const navigate = useNavigate();
  /** Session jetée : supprimée quand l'analyse quitte l'écran, pas avant. */
  const discarded = useRef<string | null>(null);
  useEffect(() => () => {
    const gone = discarded.current;
    discarded.current = null;
    if (gone !== null) void removeSession(gone);
  }, []);
  const name = useSessionName(file);
  const [sharing, setSharing] = useState(false);
  /** Nom en cours de saisie ; `null` hors renommage. */
  const [draft, setDraft] = useState<string | null>(null);
  /** Compte rendu du dernier téléchargement, effacé après quelques secondes. */
  const [note, setNote] = useTransientValue<{ text: string; error: boolean }>(DOWNLOAD_NOTE_MS);
  const session = file === null ? undefined : librarySession(file);
  if (!session || file === null) return null;

  const { record } = session;
  const activityName = sessionActivity(readStoredActivities(), record.activityId, record.sport)?.name ?? null;

  const save = () => {
    if (draft === null) return;
    updateSessionRecord(file, { name: draft });
    setDraft(null);
  };

  /**
   * Le GPX tel que rangé, avec sa fiche et ses capteurs. Une session nommée part sous
   * `AAAA-MM-JJ Activité - Nom.gpx`, son nom écrit dans le GPX ; les autres, sous leur nom de fichier.
   */
  const download = async () => {
    try {
      const session = await readSessionExport(file);
      if (session === null) throw new Error('GPX illisible dans la mémoire.');
      const named = name?.trim() ? safeFileName(downloadBaseName(name, activityName, session.record.summary.startMs, file)) : '';
      await saveToDownloads(named ? `${named}.gpx` : file, bundleSessionGpx(session.gpx, session.record, session.motion, session.unreadable));
      setNote({ text: 'Session enregistrée dans Téléchargements.', error: false });
    } catch (err) {
      setNote({ text: `Téléchargement impossible : ${plainError(err, 'erreur inconnue')}`, error: true });
    }
  };

  /** Le GPX rangé tel quel (un brouillon ne le change pas), confié au partage d'Android ; repli : téléchargement. */
  const shareTrace = async () => {
    try {
      const text = await readSessionGpx(file);
      if (text === null) throw new Error('GPX introuvable dans la mémoire.');
      const labels = shareLabels(name, activityName, (share ? FAMILY_LABEL[share.family] : 'Session'), record.summary.startMs, file);
      const outcome = await shareFile(new Blob([text], { type: 'application/gpx+xml' }), `${safeFileName(labels.baseName)}.gpx`, labels.title);
      if (outcome === 'downloaded') setNote({ text: 'Ce navigateur ne partage pas de fichier : le GPX est téléchargé.', error: false });
    } catch (err) {
      setNote({ text: `Partage impossible : ${plainError(err, 'erreur inconnue')}`, error: true });
    }
  };

  /**
   * « Jeter », après l'appui tenu : confirmé, le brouillon de la session est abandonné sans autre question (sa garde
   * de l'historique retirée d'abord), la page remplacée par la bibliothèque (le retour n'y ramène pas), puis la
   * session supprimée une fois l'analyse démontée (`removeSession`) : elle ne s'y dit jamais introuvable.
   */
  const discard = async () => {
    if (!window.confirm(discardQuestion(hasLeaveWarning()))) return;
    await dropLeaveWarning();
    discarded.current = file;
    navigate(back, { replace: true });
  };

  if (draft !== null) {
    return (
      <span className="an-name-row">
        <SessionRenameField value={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)}
          className="an-name-input" />
      </span>
    );
  }

  return (
    // Une seule ligne : un nom long se tronque, « Renommer » et « … » restent à droite (le menu s'ouvre à l'écran).
    <span className="ui-stack ui-min-w-0">
      <span className="an-name-line">
        <span
          title={name ?? undefined}
          style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(name ? { color: 'var(--ink)', fontWeight: 600 } : {}) }}>
          {name ?? 'Sans nom'}
        </span>
        <span className="ui-row-s2 ui-center ui-no-shrink">
          {!session.readOnly && (
            <Button size="s" variant="ghost" onClick={() => setDraft(name ?? '')}>Renommer</Button>
          )}
          <MoreMenu label="Plus d'actions sur la session">
            {share && (
              <Button onClick={() => setSharing(true)}>
                <IconShare size={18} />
                Partager l'image
              </Button>
            )}
            <Button onClick={() => void shareTrace()}>
              <IconShare size={18} />
              Partager la trace
            </Button>
            <Button onClick={() => void download()}>
              <IconDownload size={18} />
              Télécharger la session
            </Button>
            {!session.readOnly && (
              <HoldButton onHold={() => void discard()} getHoldMs={discardHoldMs} label="Jeter" lead={<IconTrash size={18} />}
                dialTitle="Jeter" icon={<IconTrash size={48} />} action="jeter" keepMenuOpen
                ariaLabel="Jeter la session : maintenir une seconde" />
            )}
          </MoreMenu>
        </span>
      </span>
      {sharing && share && (() => {
        const labels = shareLabels(name, activityName, FAMILY_LABEL[share.family], record.summary.startMs, file);
        return (
          <ShareDialog
            family={share.family}
            file={file}
            activityId={record.activityId ?? record.sport ?? share.family}
            title={labels.title}
            subtitle={labels.subtitle}
            fileName={safeFileName(labels.baseName)}
            segments={share.segments}
            stats={share.stats}
            onClose={() => setSharing(false)} />
        );
      })()}
      {note && (
        <span role="status" style={{ fontSize: 'var(--text-s)', color: note.error ? 'var(--danger)' : 'var(--muted)' }}>
          {note.text}
        </span>
      )}
    </span>
  );
}

export default SessionNameEditor;
