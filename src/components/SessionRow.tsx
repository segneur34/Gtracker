import { memo, useEffect, useRef, useState } from 'react';
import { plural } from '../core/basics';
import { weekdayDayMonthYear } from '../core/calendar';
import type { Activity } from '../core/activities';
import { sportFamily, sportTreatment, type SportFamily } from '../core/sportProfiles';
import { formatDistanceAuto, formatDuration, formatShortDuration, formatSpeed } from '../core/units';
import { useOpenSession } from '../hooks/useLibraryNavigation';
import { useLearnedPlaces } from '../hooks/learnedPlacesFile';
import { useNearViewport } from '../hooks/useNearViewport';
import { usePlaceSearch } from '../hooks/usePlaceSearch';
import { correctSessionPlace, queueSessionPlace, removeSession, updateSessionRecord } from '../hooks/useSessionLibrary';
import { effectiveDistanceUnit, effectiveSpeedUnit } from '../hooks/useSportSettings';
import { useThemedShade } from '../hooks/useTheme';
import { isPlaceToFind, placeDraftOf, type PlaceDraft } from '../library/places';
import type { LibrarySession } from '../library/record';
import { customName, sessionDisplayName } from '../library/sessionName';
import { ActivitySheet } from './ActivitySelect';
import SessionPlaceField from './SessionPlaceField';
import SessionPreviewMap from './SessionPreviewMap';
import SessionRenameField from './SessionRenameField';
import Button from './ui/Button';
import MoreMenu from './ui/MoreMenu';
import { dateLocale } from '../core/i18n';
import './SessionRow.css';

/** Marge de la ligne à l'écran pour la file des lieux : aucune, seules les lignes vues comptent. */
const ROW_PLACE_MARGIN = '0px';

const formatTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

/** Chiffres d'une ligne, selon le traitement de son calcul. */
const rowStats =(session: LibrarySession, activity: Activity | null): string[] => {
  const { summary } = session.record;
  const distanceUnit = activity ? effectiveDistanceUnit(activity) : 'km';
  const stats = [formatDuration(summary.endMs - summary.startMs), formatDistanceAuto(summary.distanceM, distanceUnit)];
  if (activity === null) return stats;
  if (sportTreatment(activity.base) === 'voile') {
    stats.push(`max ${formatSpeed(summary.maxSpeedMs, effectiveSpeedUnit(activity))}`);
    if (summary.maneuverCount !== undefined) stats.push(plural(summary.maneuverCount, 'manœuvre'));
  } else if (sportTreatment(activity.base) === 'surf') {
    // Vagues, plus longue vague ; sur foil, le plus long vol.
    if (summary.waveCount !== undefined) stats.push(`${summary.waveCount} vague${summary.waveCount > 1 ? 's' : ''}`);
    if (summary.longestWaveM != null) stats.push(`plus longue ${Math.round(summary.longestWaveM)} m`);
    if (summary.longestFlightS != null) stats.push(`vol ${formatShortDuration(summary.longestFlightS)}`);
  } else {
    if (summary.movingTimeS && summary.distanceM > 0) {
      stats.push(formatSpeed(summary.distanceM / summary.movingTimeS, effectiveSpeedUnit(activity)));
    }
    if (summary.elevationGainM !== null) stats.push(`D+ ${Math.round(summary.elevationGainM)} m`);
  }
  return stats;
};

/** Choix d'activité ouvert sur une session à classer : avant son analyse, ou depuis « Classer » du menu. */
type Sheet = 'open' | 'classify' | null;

/**
 * Ligne d'une session de la page Sessions : la pastille et le nom de l'activité avec la date, le nom montré de la
 * session en gras (`sessionDisplayName` : le nom donné, sinon l'activité et le lieu), ses chiffres, le commentaire et l'avertissement en petites
 * lignes, la vignette de la trace à droite, puis un « … » : Classer (session à classer), Renommer, Lieu (corrige le
 * lieu seul, `correctSessionPlace`), Supprimer (avec
 * confirmation), sauf avec `menu` faux (dernières sessions du Profil). Mémorisée, rappels stables : un balayage de la
 * mémoire ne redessine que les lignes dont la fiche change.
 */
const SessionRow = memo(function SessionRow({
  session, activity, activities, family, fromActivityId, folderLabel, confirming, onAskDelete, onCancelDelete, menu = true,
}: {
  session: LibrarySession;
  activity: Activity | null;
  /** Toutes les activités, pour classer une session. */
  activities: Activity[];
  /** Famille de la session (`sessionFamily`) : module ouvert et vignette. */
  family: SportFamily;
  /** Filtre d'activité de la liste, rendu au retour de l'analyse. */
  fromActivityId: string | null;
  folderLabel: string | null;
  confirming: boolean;
  onAskDelete: (file: string) => void;
  onCancelDelete: () => void;
  /** Le « … » des actions sur la session ; faux : la ligne ne fait qu'ouvrir l'analyse. */
  menu?: boolean;
}) {
  const openSession = useOpenSession();
  const shade = useThemedShade();
  const { record } = session;
  const { startMs } = record.summary;
  const unclassified = record.sport === null;
  /** Nom en cours de saisie ; `null` hors renommage. */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  /** Lieu en cours de saisie ; `null` hors correction. */
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  // Une ligne qui paraît à l'écran met sa session dans la file des lieux, si son lieu reste à trouver.
  const rowRef = useRef<HTMLLIElement>(null);
  const placeUnknown = isPlaceToFind(record.place) && !session.readOnly;
  const near = useNearViewport(rowRef, !placeUnknown, ROW_PLACE_MARGIN);
  // Un lieu appris ou la recherche rallumée : la ligne visible regarde de nouveau son lieu.
  const learned = useLearnedPlaces();
  const [searchOn] = usePlaceSearch();
  useEffect(() => {
    if (near && placeUnknown) queueSessionPlace(session.file);
  }, [near, placeUnknown, session.file, learned, searchOn]);

  /**
   * Ouvre l'analyse. Une session à classer (le fichier ne dit pas son
   * activité) la demande d'abord : sans elle, le module et ses seuils
   * seraient pris au hasard. Une fiche en lecture seule ne peut pas la
   * garder : la session s'ouvre dans le module de sa famille par défaut.
   */
  const open = () => {
    if (unclassified && !session.readOnly) setSheet('open');
    else openSession(session.file, family, fromActivityId);
  };
  const classify = (chosen: Activity) => {
    const thenOpen = sheet === 'open';
    setSheet(null);
    updateSessionRecord(session.file, { sport: chosen.base, activityId: chosen.id });
    if (thenOpen) openSession(session.file, sportFamily(chosen.base));
  };

  const saveName = () => {
    if (nameDraft === null) return;
    updateSessionRecord(session.file, { name: nameDraft });
    setNameDraft(null);
  };
  const savePlace = () => {
    if (placeDraft === null) return;
    void correctSessionPlace(session.file, placeDraft.departure, placeDraft.arrival ?? undefined);
    setPlaceDraft(null);
  };

  // Une seule action en cours par ligne : en lancer une abandonne l'autre, rien ne revient tout seul.
  const startRename = () => {
    if (confirming) onCancelDelete();
    setPlaceDraft(null);
    setNameDraft(record.name ?? '');
  };
  const startPlace = () => {
    if (confirming) onCancelDelete();
    setNameDraft(null);
    setPlaceDraft(placeDraftOf(record.place));
  };
  const startClassify = () => {
    if (confirming) onCancelDelete();
    setNameDraft(null);
    setPlaceDraft(null);
    setSheet('classify');
  };
  const askDelete = () => {
    setNameDraft(null);
    setPlaceDraft(null);
    onAskDelete(session.file);
  };

  const activityLabel = activity ? activity.name : 'À classer';
  const date = `${weekdayDayMonthYear(startMs)} · ${formatTime(startMs)}`;
  // Sous un nom donné, l'activité reste écrite à côté de la date ; le nom calculé la porte déjà.
  const named = customName(record) !== null;

  return (
    <li className="lib-row" ref={rowRef}>
      <div className="lib-row__head-line">
        <button type="button" className="lib-row__main" onClick={open}>
          <span className="lib-row__head">
            {activity && <span className="ui-swatch lib-row__icon" style={{ background: shade(activity.color) }} />}
            {named && <span className="lib-row__sport lib-row__sport--sub">{activityLabel}</span>}
            <span className="lib-row__date">{named ? `· ${date}` : date}</span>
          </span>
          <span className={`lib-row__title ${named ? 'lib-row__name' : 'lib-row__sport'}`}>{sessionDisplayName(record, activityLabel)}</span>
          <span className="lib-row__stats num">{rowStats(session, activity).join(' · ')}</span>
          {record.notes?.comment && <span className="lib-row__note">{record.notes.comment}</span>}
          {session.warning && <span className="lib-row__warning">{session.warning}</span>}
        </button>
        <SessionPreviewMap session={session} activity={activity} family={family} folderLabel={folderLabel} onOpen={open} />
        {menu && !session.readOnly && (
          <MoreMenu label="Plus d'actions sur la session">
            {unclassified && <Button size="s" variant="ghost" onClick={startClassify}>Classer…</Button>}
            <Button size="s" variant="ghost" onClick={startRename}>Renommer</Button>
            <Button size="s" variant="ghost" onClick={startPlace}>Lieu</Button>
            <Button size="s" variant="ghost" onClick={askDelete}>Supprimer</Button>
          </MoreMenu>
        )}
      </div>
      {sheet !== null && (
        <ActivitySheet
          activities={activities}
          value={null}
          heading={sheet === 'open'
            ? { title: 'Quelle activité ?', hint: "Le fichier ne la dit pas : choisissez-la avant l'analyse. Elle reste dans la fiche de la session." }
            : { title: 'Classer la session', hint: 'Le fichier ne dit pas son activité : choisissez-la. Elle reste dans la fiche de la session.' }}
          onChoose={classify}
          onClose={() => setSheet(null)} />
      )}

      {nameDraft !== null && (
        <div className="lib-row__actions">
          <SessionRenameField value={nameDraft} onChange={setNameDraft} onSave={saveName} onCancel={() => setNameDraft(null)}
            className="ui-field ui-field--s lib-row__rename" />
        </div>
      )}
      {placeDraft !== null && (
        <div className="lib-row__actions">
          <SessionPlaceField value={placeDraft} onChange={setPlaceDraft} onSave={savePlace} onCancel={() => setPlaceDraft(null)}
            className="ui-field ui-field--s lib-row__place" />
        </div>
      )}
      {confirming && !session.readOnly && (
        <div className="lib-row__actions">
          <span className="lib-row__confirm">Supprimer cette session de la mémoire ?</span>
          <Button size="s" variant="danger" onClick={() => void removeSession(session.file)}>Confirmer</Button>
          <Button size="s" variant="ghost" onClick={onCancelDelete}>Annuler</Button>
        </div>
      )}
    </li>
  );
});

export default SessionRow;
