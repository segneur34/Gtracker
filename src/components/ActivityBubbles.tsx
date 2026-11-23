import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { activityDisplayName, type Activity } from '../core/activities';
import { activityLogo } from '../core/activityLogos';
import { t } from '../core/i18n';
import { usePrefersReducedMotion } from '../hooks/useNarrowScreen';
import { useThemedShade } from '../hooks/useTheme';
import { IconChevronRight } from './icons';
import { isDrag, pageScrollTarget, rowArrows, type RowArrows } from './activityRowScroll';
import ActivityLogo from './logos/ActivityLogo';
import './ActivityBubbles.css';

/** Côté du logo d'une activité dans la rangée, en pixels (son cadre au pinceau compris). */
const BUBBLE_LOGO_PX = 58;

/**
 * Rangée des activités de la page Sessions, qui filtre la liste : « Toutes » (le nombre de sessions dans un rond),
 * puis chaque activité par son logo dans son cadre au pinceau, son nom dessous. Le rond choisi a son nom en gras,
 * souligné. La rangée glisse de côté quand elle dépasse, sans entraîner la page ; le rond choisi est ramené à l'écran
 * à l'ouverture (retour d'une analyse). À la souris (pointeur fin), une flèche ronde par côté où des activités
 * restent cachées, et la rangée s'attrape et se tire ; au doigt, le défilement du système seul.
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
  const reduced = usePrefersReducedMotion();
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

  // Flèches : relues au défilement, au redimensionnement et quand la liste des activités change.
  const [arrows, setArrows] = useState<RowArrows>({ left: false, right: false });
  const refreshArrows = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const next = rowArrows(el.scrollLeft, el.clientWidth, el.scrollWidth);
    setArrows((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);
  useLayoutEffect(() => {
    refreshArrows();
    const el = row.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(refreshArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [refreshArrows, choices]);

  const page = (direction: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    el.scrollTo({
      left: pageScrollTarget(direction, el.scrollLeft, el.clientWidth, el.scrollWidth),
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  // Glissement à la souris seulement ; au doigt, le défilement du système reste seul.
  const drag = useRef<{ x: number; scroll: number; active: boolean; moved: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { x: e.clientX, scroll: e.currentTarget.scrollLeft, active: true, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d?.active) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (!isDrag(dx)) return;
      d.moved = true;
      e.currentTarget.dataset.dragging = 'true';
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.currentTarget.scrollLeft = d.scroll - dx;
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.active = false;
    delete e.currentTarget.dataset.dragging;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  // Un glissement ne choisit pas l'activité sous le pointeur.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!drag.current?.moved) return;
    drag.current = null;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="activity-bubbles-wrap">
      <div className="activity-bubbles" ref={row} role="group" aria-label={t('Filtrer par activité')}
        onScroll={refreshArrows} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={onClickCapture}>
        <button type="button" className="activity-bubble" aria-pressed={selected === null} onClick={() => onSelect(null)}>
          <span className="activity-bubble__all num" aria-hidden="true">{total}</span>
          <span className="activity-bubble__name">{t('Toutes')}</span>
        </button>
        {choices.map((activity) => (
          <button key={activity.id} type="button" className="activity-bubble" aria-pressed={selected === activity.id}
            onClick={() => onSelect(activity.id)}>
            <ActivityLogo logo={activityLogo(activity)} color={shade(activity.color)} size={BUBBLE_LOGO_PX} className="activity-bubble__logo" />
            <span className="activity-bubble__name">{activityDisplayName(activity)}</span>
          </button>
        ))}
      </div>
      {arrows.left && (
        <button type="button" className="activity-bubbles__arrow activity-bubbles__arrow--left"
          aria-label={t('Activités précédentes')} onClick={() => page(-1)}>
          <IconChevronRight size={18} />
        </button>
      )}
      {arrows.right && (
        <button type="button" className="activity-bubbles__arrow activity-bubbles__arrow--right"
          aria-label={t('Activités suivantes')} onClick={() => page(1)}>
          <IconChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

export default ActivityBubbles;
