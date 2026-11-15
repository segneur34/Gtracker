import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { activityDisplayName, type Activity } from '../core/activities';
import { formatDistance } from '../core/units';
import { useGoOnRoute } from '../hooks/useGoOnRoute';
import type { SavedRoute } from '../hooks/useRouteLibrary';
import { effectiveDistanceUnit } from '../hooks/useSportSettings';
import { routeActivity, routeDistanceM } from '../planning/routeList';
import ActivityGlyph from './logos/ActivityGlyph';
import Button from './ui/Button';
import { dateLocale, t } from '../core/i18n';
import './RouteList.css';

/**
 * Liste d'itinéraires rangés : nom, activité, distance dans l'unité de son
 * activité, date. Commune à la planification et à la page des itinéraires
 * planifiés.
 *
 * Toucher un itinéraire l'ouvre dans la page Itinéraires
 * (`/itineraires?itineraire=<base>`), sauf si la page fournit `onOpen`.
 * « Partir » le suit et ouvre la page Enregistrer, son activité proposée : il
 * reste à toucher « Démarrer ». Grisé pendant un enregistrement, où la trace
 * suivie ne se change pas.
 */

interface RouteListProps {
  routes: SavedRoute[];
  activities: Activity[];
  onOpen?: (saved: SavedRoute) => void;
  /** Itinéraire ouvert, souligné. */
  currentBase?: string | null;
  /** Actions au bout de chaque ligne (Supprimer, dans la page Itinéraires). */
  actions?: (saved: SavedRoute) => ReactNode;
  /** Bouton « Partir » sur chaque ligne ; oui par défaut. */
  go?: boolean;
}

const routePath = (saved: SavedRoute): string => `/itineraires?itineraire=${encodeURIComponent(saved.base)}`;

function RouteList({ routes, activities, onOpen, currentBase = null, actions, go: withGo = true }: RouteListProps) {
  const distances = useMemo(() => new Map(routes.map((s) => [s.base, routeDistanceM(s.record)])), [routes]);
  const { go, canGo } = useGoOnRoute();

  return (
    <ul className="route-list">
      {routes.map((saved) => {
        const activity = routeActivity(saved, activities);
        const body = (
          <>
            <strong>{saved.record.name}</strong>
            <span className="route-list__meta">
              {activity
                ? <ActivityGlyph activity={activity} size={14} className="route-list__icon" />
                : <span className="route-list__dot" style={{ background: 'var(--faint)' }} />}
              <span>{activity ? activityDisplayName(activity) : t('Sans activité')}</span>
              <span className="num">
                {' · '}
                {formatDistance(distances.get(saved.base) ?? 0, activity ? effectiveDistanceUnit(activity) : 'km')}
                {' · '}
                {new Date(saved.record.updatedAt).toLocaleDateString(dateLocale())}
              </span>
            </span>
          </>
        );
        return (
          <li key={saved.base} className={`route-list__item${currentBase === saved.base ? ' route-list__item--current' : ''}`}>
            {onOpen ? (
              <button type="button" className="route-list__open" onClick={() => onOpen(saved)}>{body}</button>
            ) : (
              <Link to={routePath(saved)} className="route-list__open">{body}</Link>
            )}
            {withGo && (
              <Button size="s" variant="record" disabled={!canGo} onClick={() => go(saved)}
                title={canGo ? undefined : t('Un enregistrement est en cours')} aria-label={t('Partir sur {name}', { name: saved.record.name })}>
                {t('Partir')}
              </Button>
            )}
            {actions?.(saved)}
          </li>
        );
      })}
    </ul>
  );
}

export default RouteList;
