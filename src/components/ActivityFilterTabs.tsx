import type { CSSProperties } from 'react';
import { activityDisplayName, type Activity } from '../core/activities';
import { t } from '../core/i18n';
import ActivityGlyph from './logos/ActivityGlyph';

/**
 * Onglets de filtre par activité d'une liste (sessions, itinéraires) : « tous »,
 * puis une pastille par activité avec son nombre, et « sans activité » quand
 * des éléments n'en ont pas (`withoutCount`, identifiant `withoutId`). `selected`
 * vaut `null` pour « tous ». À poser quand il y a plus d'un onglet.
 */
export default function ActivityFilterTabs({ total, counts, selected, onSelect, withoutCount = 0, withoutId = '', accent }: {
  /** Nombre d'éléments de la liste entière. */
  total: number;
  counts: readonly { activity: Activity; count: number }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  withoutCount?: number;
  /** Identifiant de l'onglet « sans activité ». */
  withoutId?: string;
  /** Couleur des onglets, si la page ne la pose pas déjà. */
  accent?: string;
}) {
  return (
    <div className="ui-tabs" style={accent ? ({ '--tab-accent': accent } as CSSProperties) : undefined}>
      <button type="button" className="ui-tab" aria-pressed={selected === null} onClick={() => onSelect(null)}>
        {t('tous ({total})', { total })}
      </button>
      {counts.map(({ activity, count }) => (
        <button key={activity.id} type="button" className="ui-tab" aria-pressed={selected === activity.id} onClick={() => onSelect(activity.id)}>
          <ActivityGlyph activity={activity} className="ui-tab__icon" />
          {activityDisplayName(activity)} ({count})
        </button>
      ))}
      {withoutCount > 0 && (
        <button type="button" className="ui-tab" aria-pressed={selected === withoutId} onClick={() => onSelect(withoutId)}>
          {t('sans activité ({withoutCount})', { withoutCount })}
        </button>
      )}
    </div>
  );
}
