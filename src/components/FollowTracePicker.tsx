import { plainError } from '../platform/errorText';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { activityDisplayName, sessionActivity } from '../core/activities';
import { parseGpx } from '../core/gpxParser';
import { useRouteLibrary, type SavedRoute } from '../hooks/useRouteLibrary';
import { followTrace } from '../hooks/useFollowedTrace';
import { readSessionGpx, useLibraryFields } from '../hooks/useSessionLibrary';
import { useVisibility } from '../hooks/useSportSettings';
import { sessionDisplayName } from '../library/sessionName';
import { routeDisplayName } from '../library/routeName';
import { shownRoutes } from '../planning/routeList';
import { followedTraceFromRoute, followedTraceFromSession, type FollowedTrace } from '../recording/followedTrace';
import ActivitySelect from './ActivitySelect';
import Button from './ui/Button';
import Card from './ui/Card';
import SegmentedControl from './ui/SegmentedControl';
import { dateLocale, t } from '../core/i18n';
import { tRich } from './tRich';

/**
 * Choix de la trace à suivre pendant l'enregistrement : un itinéraire rangé
 * (page Itinéraires) ou une session déjà enregistrée, pour refaire un
 * parcours. La trace choisie va dans `useFollowedTrace`, avec son activité ;
 * `onPicked` la reçoit aussi, pour proposer cette activité.
 */

type PickerTab = 'route' | 'session';

/** Sessions montrées d'un coup ; « Afficher plus » en ajoute autant. */
const PAGE_SIZE = 20;

const ROW_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '2px',
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-m)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
} as const;

const DETAIL_STYLE = { color: 'var(--muted)', fontSize: 'var(--text-s)' } as const;
const LIST_STYLE = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 0, padding: 0, listStyle: 'none' } as const;

const formatDate = (ms: number | string) => new Date(ms).toLocaleDateString(dateLocale());

function FollowTracePicker({ onClose, onPicked }: { onClose: () => void; onPicked?: (trace: FollowedTrace) => void }) {
  const { status, sessions } = useLibraryFields('status', 'sessions');
  const library = useRouteLibrary();
  const [tab, setTab] = useState<PickerTab>('route');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ni itinéraire ni session d'une activité cachée dans Réglages.
  const { activities, isShown } = useVisibility();
  const routes = useMemo(() => shownRoutes(library.routes, activities, isShown), [library.routes, activities, isShown]);
  /** Activité retenue dans l'onglet Sessions ; `null` : toutes. */
  const [activityFilter, setActivityFilter] = useState<string | null>(null);

  /** Sessions de la plus récente à la plus ancienne, chacune avec son activité. */
  const sortedSessions = useMemo(
    () => [...sessions]
      .sort((a, b) => b.record.summary.startMs - a.record.summary.startMs)
      .map((session) => ({ ...session, activity: sessionActivity(activities, session.record.activityId, session.record.sport) }))
      .filter((s) => s.activity === null || isShown(s.activity)),
    [sessions, activities, isShown]
  );
  /** Activités présentes parmi les sessions, dans l'ordre des Réglages. */
  const sessionActivities = useMemo(
    () => activities.filter((a) => sortedSessions.some((s) => s.activity?.id === a.id)),
    [activities, sortedSessions]
  );
  const filteredSessions = activityFilter === null
    ? sortedSessions
    : sortedSessions.filter((s) => s.activity?.id === activityFilter);

  const pickRoute = (saved: SavedRoute) => {
    const trace = followedTraceFromRoute(saved.record, routeDisplayName(saved.record));
    if (!trace) {
      setError(t('Cet itinéraire n\'a pas assez de points.'));
      return;
    }
    followTrace(trace);
    onPicked?.(trace);
    onClose();
  };

  const pickSession = async (file: string, name: string, activityId: string | null) => {
    setLoading(file);
    setError(null);
    try {
      const text = await readSessionGpx(file);
      if (text === null) throw new Error(t('Session introuvable dans la mémoire.'));
      const trace = followedTraceFromSession(parseGpx(text).rawPoints, name, activityId);
      if (!trace) throw new Error(t('Cette session n\'a pas assez de points.'));
      followTrace(trace);
      onPicked?.(trace);
      onClose();
    } catch (err) {
      setError(plainError(err, t('Lecture de la session impossible.')));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card heading={t('Suivre une trace')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--text-m)' }}>
        <SegmentedControl<PickerTab> fit label={t('Trace à suivre')} value={tab} onChange={setTab}
          items={[{ key: 'route', label: library.loaded ? t('Itinéraires ({n})', { n: routes.length }) : t('Itinéraires') }, { key: 'session', label: t('Sessions ({n})', { n: sortedSessions.length }) }]} />

        {status !== 'ready' && (
          <div className="ui-alert ui-alert--warning">
            {tRich('Aucun dossier mémoire ouvert : choisissez-le dans <lien>Réglages</lien> pour retrouver vos traces.', undefined,
              { lien: (children) => <Link to="/parametres">{children}</Link> })}
          </div>
        )}
        {error && <div className="ui-alert ui-alert--danger">{error}</div>}

        {tab === 'route' && status === 'ready' && library.loaded && (routes.length === 0 ? (
          <p className="ui-muted ui-m-0">
            {t('Aucun itinéraire enregistré : planifiez-en un depuis la page Sessions (« Planification », à côté de « Tris », puis « Planifier »).')}
          </p>
        ) : (
          <ul style={LIST_STYLE}>
            {routes.map((saved) => (
              <li key={saved.base}>
                <button type="button" style={ROW_STYLE} onClick={() => pickRoute(saved)}>
                  <strong>{routeDisplayName(saved.record)}</strong>
                  <span style={DETAIL_STYLE}>{t('Enregistré le {date}', { date: formatDate(saved.record.updatedAt) })}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}

        {tab === 'session' && status === 'ready' && (sortedSessions.length === 0 ? (
          <p className="ui-muted ui-m-0">{t('Aucune session enregistrée pour l\'instant.')}</p>
        ) : (
          <>
            {sessionActivities.length > 1 && (
              <label className="ui-row-10 ui-center ui-wrap">
                <span className="ui-eyebrow">{t('Activité')}</span>
                <ActivitySelect activities={sessionActivities} value={activityFilter} label={t('Activité')} className="ui-field"
                  placeholder={t('Toutes ({n})', { n: sortedSessions.length })}
                  reset={{ label: t('Toutes ({n})', { n: sortedSessions.length }), onChoose: () => { setActivityFilter(null); setShown(PAGE_SIZE); } }}
                  onChange={(next) => { setActivityFilter(next.id); setShown(PAGE_SIZE); }} />
              </label>
            )}
            <ul style={LIST_STYLE}>
              {filteredSessions.slice(0, shown).map(({ file, record, activity }) => {
                const activityName = activity ? activityDisplayName(activity) : null;
                const name = sessionDisplayName(record, activityName, record.title ?? file);
                return (
                  <li key={file}>
                    <button type="button" style={ROW_STYLE} disabled={loading !== null}
                      onClick={() => void pickSession(file, name, activity?.id ?? null)}>
                      <strong>{name}</strong>
                      <span style={DETAIL_STYLE}>
                        {loading === file ? t('Lecture…') : [activityName, formatDate(record.summary.startMs)].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {filteredSessions.length > shown && (
              <Button variant="ghost" onClick={() => setShown((n) => n + PAGE_SIZE)}>{t('Afficher plus')}</Button>
            )}
          </>
        ))}

        <Button variant="ghost" onClick={onClose}>{t('Fermer')}</Button>
      </div>
    </Card>
  );
}

export default FollowTracePicker;
