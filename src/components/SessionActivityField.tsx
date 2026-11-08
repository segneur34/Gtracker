import type { Activity } from '../core/activities';
import type { SportFamily } from '../core/sportProfiles';
import ActivitySelect from './ActivitySelect';

/**
 * Champ « Activité » de l'onglet réglages d'une analyse, le même dans les
 * deux modules. Les familles proposées sont celles du module, toutes pour une
 * session de la mémoire.
 */
export default function SessionActivityField({ activities, activity, families, onChange }: {
  /** Toutes les activités de l'utilisateur. */
  activities: Activity[];
  /** Activité de la session. */
  activity: Activity;
  families?: SportFamily[];
  onChange: (next: Activity) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-s)' }}>
      <strong>Activité :</strong>
      <ActivitySelect
        activities={activities}
        value={activity.id}
        extra={activity}
        families={families}
        onChange={onChange} />
    </label>
  );
}
