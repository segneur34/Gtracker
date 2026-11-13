import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { findActivity, sessionActivity, type Activity } from '../core/activities';
import { sessionFamily, sessionsPath } from '../core/parentPage';
import { SPORT_FAMILIES } from '../core/sportProfiles';
import { useLibraryFields } from '../hooks/useSessionLibrary';
import { useVisibility } from '../hooks/useSportSettings';
import type { LibrarySession } from '../library/record';
import { sortSessions } from '../library/sessionSort';
import { filterChoices, filterSessions, ofActivity } from '../library/sessionsList';
import ActivityBubbles from './ActivityBubbles';
import SessionRow from './SessionRow';
import { IconChevronRight } from './icons';
import './ProfileActivities.css';

/** Dernières sessions montrées, par date décroissante. */
const RECENT_COUNT = 5;

/** Les lignes du Profil n'ont pas de « … » : rien à supprimer, des rappels stables pour la ligne mémorisée. */
const noDelete = () => undefined;

/** Famille d'une session pour son module et sa vignette ; une session à classer prend la première. */
const rowFamily = (session: LibrarySession) => sessionFamily(session, SPORT_FAMILIES[0]);

/**
 * « Vos activités », à droite du Profil sur ordinateur : la rangée des activités de la page Sessions, qui filtre sur
 * place les cinq dernières sessions dessous ; « Toutes les sessions » ouvre la page Sessions avec ce filtre. Mêmes
 * sessions que la page Sessions (ni celles d'une activité cachée, ni celles à classer), mêmes lignes, sans « … ».
 */
function ProfileActivities() {
  const { sessions, folderLabel, status, scanning } = useLibraryFields('sessions', 'folderLabel', 'status', 'scanning');
  const { activities, isShown, shownActivities } = useVisibility();
  /** Activité choisie dans la rangée, `null` pour « Toutes » : non retenue. */
  const [filterId, setFilterId] = useState<string | null>(null);
  const selected = useMemo(() => findActivity(activities, filterId), [activities, filterId]);

  const activityByFile = useMemo(
    () => new Map(sessions.map((s) => [s.file, sessionActivity(activities, s.record.activityId, s.record.sport)])),
    [sessions, activities]
  );
  const activityOf = useCallback((s: LibrarySession): Activity | null => activityByFile.get(s.file) ?? null, [activityByFile]);
  const everything = useMemo(() => filterSessions(sessions, activityOf, isShown, null), [sessions, activityOf, isShown]);
  const listed = useMemo(
    () => (selected ? filterSessions(sessions, activityOf, isShown, selected.id).listed : everything.listed),
    [selected, sessions, activityOf, isShown, everything]
  );
  const shownList = useMemo(() => shownActivities(), [shownActivities]);
  const choices = useMemo(
    () => filterChoices(shownList, everything.listed.map(activityOf), selected),
    [shownList, everything, activityOf, selected]
  );
  const recent = useMemo(() => sortSessions(listed, 'recent').slice(0, RECENT_COUNT), [listed]);
  const fromActivityId = selected?.id ?? null;

  return (
    <section className="profile-activities" aria-labelledby="profile-activities-title">
      <div className="profile-activities__head">
        <h2 id="profile-activities-title" className="profile-activities__title">Vos activités</h2>
        <Link to={sessionsPath(fromActivityId)} className="ui-btn ui-btn--secondary ui-btn--s">
          Toutes les sessions <IconChevronRight size={16} />
        </Link>
      </div>
      <ActivityBubbles total={everything.listed.length} choices={choices} selected={fromActivityId} onSelect={setFilterId} />
      {recent.length > 0 ? (
        <ul className="lib-list">
          {recent.map((session) => (
            <SessionRow
              key={session.file}
              session={session}
              activity={activityOf(session)}
              activities={activities}
              family={rowFamily(session)}
              fromActivityId={fromActivityId}
              folderLabel={folderLabel}
              confirming={false}
              onAskDelete={noDelete}
              onCancelDelete={noDelete}
              menu={false} />
          ))}
        </ul>
      ) : (
        status === 'ready' && !scanning && (
          <p className="ui-hint ui-hint--m">
            {selected ? `Aucune session ${ofActivity(selected.name)} pour l'instant.` : 'Aucune session pour l\'instant.'}
          </p>
        )
      )}
    </section>
  );
}

export default ProfileActivities;
