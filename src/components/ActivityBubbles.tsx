import { useLayoutEffect, useRef } from 'react';
import type { Activity } from '../core/activities';
import { activityLogo } from '../core/activityLogos';
import { t } from '../core/i18n';
import { useThemedShade } from '../hooks/useTheme';
import ActivityLogo from './logos/ActivityLogo';
import './ActivityBubbles.css';

/** Côté du logo d'une activité dans la rangée, en pixels (son cadre au pinceau compris). */
const BUBBLE_LOGO_PX = 58;

/**
 * Rangée des activités de la page Sessions, qui filtre la liste : « Toutes » (le nombre de sessions dans un rond),
 * puis chaque activité par son logo dans son cadre au pinceau, son nom dessous. Le rond choisi a son nom en gras,
 * souligné. La rangée glisse de côté quand elle dépasse, sans entraîner la page ; le rond choisi est ramené à l'écran
 * à l'ouverture (retour d'une analyse).
 */
function ActivityBubbles({ total, choices, selected, onSelect }: {
  /** Sessions de la liste entière, écrites dans le rond « Toutes ». */
  total: number;
  choices: readonly Activity[];
  /** Activité choisie, `null` pour « Toutes ». */
  selected: string | null;
  onSelect: (activityId: string | null) => void;
}) {
  const shade = useThemedShade();
  const row = useRef<HTMLDivElement>(null);

  // Une fois, à l'ouverture : le rond choisi dans la partie visible de la rangée, sans faire défiler la page.
  useLayoutEffect(() => {
    const el = row.current;
    const chosen = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !chosen) return;
    const left = chosen.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + chosen.offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, left - (el.clientWidth - chosen.offsetWidth) / 2);
    }
  }, []);

  return (
    <div className="activity-bubbles" ref={row} role="group" aria-label={t('Filtrer par activité')}>
      <button type="button" className="activity-bubble" aria-pressed={selected === null} onClick={() => onSelect(null)}>
        <span className="activity-bubble__all num" aria-hidden="true">{total}</span>
        <span className="activity-bubble__name">{t('Toutes')}</span>
      </button>
      {choices.map((activity) => (
        <button key={activity.id} type="button" className="activity-bubble" aria-pressed={selected === activity.id}
          onClick={() => onSelect(activity.id)}>
          <ActivityLogo logo={activityLogo(activity)} color={shade(activity.color)} size={BUBBLE_LOGO_PX} className="activity-bubble__logo" />
          <span className="activity-bubble__name">{activity.name}</span>
        </button>
      ))}
    </div>
  );
}

export default ActivityBubbles;
