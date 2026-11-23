import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityDisplayName, type Activity } from '../core/activities';
import { sportFamily } from '../core/sportProfiles';
import { formatDistance, formatDuration } from '../core/units';
import type { BrushFrameProps } from './brushFrame';
import { HelpText, HelpToggle } from './Help';
import { IconChevronRight } from './icons';
import { sessionsPath } from '../core/parentPage';
import { useOpenSession } from '../hooks/useLibraryNavigation';
import { useOpenSections } from '../hooks/useOpenSections';
import { effectiveDistanceUnit, useVisibility } from '../hooks/useSportSettings';
import { useThemedShade } from '../hooks/useTheme';
import { useVisibleStatSessions } from '../hooks/useVisibleStatSessions';
import { activityBarUnit, buildActivityChart, type ChartRange, type ChartSession } from '../library/activityChart';
import './ActivityChart.css';
import { timeShort, weekdayDay } from '../core/calendar';
import { t, tn } from '../core/i18n';

/**
 * Graphe d'activités du profil, venu de l'accueil (maquette du 23 septembre 2026), sur la
 * période choisie en tête de la page : une barre par jour, par semaine ou par mois, une couleur par activité, les sessions d'un même
 * jour empilées ; numéros de semaine ISO en dessous. Toucher une barre
 * affiche ses sessions, chacune ouvrant son analyse. Sous le graphe, les
 * totaux de la période par activité, chacun ouvrant la bibliothèque filtrée
 * sur son activité, précédés de la légende (dates de la période, toucher une
 * barre) ; une ligne fine les replie ou les déplie tous d'un coup.
 * Les sessions d'une activité ou d'une famille cachée n'y sont pas.
 */

/** Hauteur de la zone des barres, en pixels (4 de marge en haut), hauteur maximale d'une session, et écart entre deux piles (`ActivityChart.css`). */
const PLOT_H = 62;
const UNIT_MAX_H = 17;
const STACK_GAP = 2;
/** Une pile reste visible, si tassée soit-elle. */
const STACK_MIN_H = 1;

/** Blanc minimal, en pixels, entre deux étiquettes de l'axe. */
const TICK_GAP_PX = 6;
/** Blanc minimal quand l'axe est écrit en plus petit : il suit la taille des lettres. */
const TIGHT_TICK_GAP_PX = 4;
/** Classe de l'axe écrit en plus petit, quand ses étiquettes ne tiennent pas à la taille normale. */
const TIGHT_AXIS_CLASS = 'actchart__axis--tight';

/** Totaux par activité dépliés tant qu'on ne les a pas repliés. */
const TOTALS_DEFAULT = { totaux: true };

/** Distance dans l'unité choisie pour l'activité dans Réglages. */
const distanceText = (m: number, activity: Activity): string => formatDistance(m, effectiveDistanceUnit(activity), 1);


function ActivityChart({ period, nowMs, frame }: { period: ChartRange; nowMs: number; frame: BrushFrameProps }) {
  const { all, activityById } = useVisibleStatSessions();
  const openSession = useOpenSession();
  const navigate = useNavigate();
  const { activities } = useVisibility();
  const shown = useThemedShade();
  // Barre touchée ; la page remonte le graphe à chaque période (`key`), ce qui la referme.
  const [picked, setPicked] = useState<number | null>(null);
  // Totaux par activité : repliés ou dépliés d'un seul geste, choix gardé sur l'appareil.
  const { open, toggle } = useOpenSections('accueil.graphe', TOTALS_DEFAULT);

  // Sessions classées et visibles (les mêmes que le Profil) ; les sessions à classer n'apparaissent pas.
  const chartSessions = useMemo(
    () => all.map((s): ChartSession => ({ file: s.file, startMs: s.startMs, durationS: (s.endMs - s.startMs) / 1000, distanceM: s.distanceM, activityId: s.activityId })),
    [all]
  );

  const chart = useMemo(
    () => buildActivityChart(chartSessions, period, nowMs, activities.map((a) => a.id)),
    [chartSessions, period, nowMs, activities]
  );

  // Étiquettes de l'axe : d'après les largeurs réellement mesurées, donc quelle que soit la langue ou la taille du
  // texte. Si deux étiquettes se touchent à la taille normale, l'axe est écrit en plus petit pour les garder toutes ;
  // celle qui toucherait encore la précédente est alors masquée.
  const axisRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const axis = axisRef.current;
    if (!axis) return;
    const fit = () => {
      const ticks = (Array.from(axis.children) as HTMLElement[]).filter((el) => el.textContent);
      // Étiquettes qui toucheraient celle d'avant, à la taille en cours.
      const crowded = (gap: number): HTMLElement[] => {
        const out: HTMLElement[] = [];
        let lastRight = -Infinity;
        for (const el of ticks) {
          const text = document.createRange();
          text.selectNodeContents(el);
          const box = text.getBoundingClientRect();
          if (box.left < lastRight + gap) out.push(el);
          else lastRight = box.right;
        }
        return out;
      };
      for (const el of ticks) el.style.visibility = '';
      axis.classList.remove(TIGHT_AXIS_CLASS);
      if (crowded(TICK_GAP_PX).length === 0) return;
      axis.classList.add(TIGHT_AXIS_CLASS);
      for (const el of crowded(TIGHT_TICK_GAP_PX)) el.style.visibility = 'hidden';
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(axis);
    return () => observer.disconnect();
  }, [chart.bars]);

  const unitH = activityBarUnit(chart.bars, PLOT_H - 4, STACK_GAP, UNIT_MAX_H);
  const totalSessions = chart.totals.reduce((n, tot) => n + tot.sessions, 0);
  const bar = picked === null ? null : chart.bars[picked] ?? null;
  // Une barre par semaine ou par mois : le détail donne aussi le jour de chaque session.
  const weekly = period === 'sixmois' || period === 'annee' || period === 'tout';

  return (
    <section className={`actchart ui-card-col ${frame.className}`} style={frame.style} aria-label={t('Activités')}>
      <div className="actchart__head">
        <h2>{chart.title}<HelpToggle helpKey="profil:activites" label={chart.title} /></h2>
        <span className="num">{tn(totalSessions, '{n} session', '{n} sessions', { n: totalSessions })}</span>
      </div>
      <HelpText helpKey="profil:activites" note>{t('Toucher une barre pour le détail de ses sessions.')}</HelpText>

      <div className="actchart__plot" style={{ height: `${PLOT_H}px`, gap: chart.bars.length > 30 ? '2px' : '3px' }}>
        {chart.bars.map((b, i) => (
          <button
            key={b.startMs}
            type="button"
            className={`actchart__bar${picked === i ? ' actchart__bar--picked' : ''}${b.future ? ' actchart__bar--future' : ''}${b.weekStart ? ' actchart__bar--week' : ''}`}
            aria-label={b.sessions.length
              ? tn(b.sessions.length, '{title} : {n} session', '{title} : {n} sessions', { title: b.title, n: b.sessions.length })
              : t('{title} : aucune session', { title: b.title })}
            aria-pressed={picked === i}
            onClick={() => setPicked(picked === i ? null : i)}>
            {b.stacks.map((s) => (
              <span
                key={s.activityId}
                className="actchart__stack"
                style={{ height: `${Math.max(STACK_MIN_H, s.count * unitH)}px`, background: shown(activityById.get(s.activityId)?.color ?? '') }} />
            ))}
          </button>
        ))}
      </div>
      <div ref={axisRef} className="actchart__axis" aria-hidden="true" style={{ gap: chart.bars.length > 30 ? '2px' : '3px' }}>
        {chart.bars.map((b) => (
          <span key={b.startMs} className={chart.bars.length === 7 ? 'actchart__tick actchart__tick--center' : 'actchart__tick'}>
            {b.label}
          </span>
        ))}
      </div>

      {bar !== null && (
        <div className="actchart__detail">
          <strong>{bar.title}</strong>
          {bar.sessions.length === 0 ? (
            <span className="actchart__hint">{t('Aucune session.')}</span>
          ) : (
            <ul className="actchart__sessions">
              {bar.sessions.map((s) => {
                const activity = activityById.get(s.activityId)!;
                return (
                  <li key={s.file}>
                    <button type="button" onClick={() => openSession(s.file, sportFamily(activity.base))}>
                      <span className="ui-swatch" style={{ background: shown(activity.color) }} />
                      <span className="actchart__name">{activityDisplayName(activity)}</span>
                      <span className="actchart__meta num">
                        {weekly && `${weekdayDay(s.startMs)} · `}
                        {timeShort(s.startMs)} · {formatDuration(s.durationS * 1000)} · {distanceText(s.distanceM, activity)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {chart.totals.length > 0 && (
        <button type="button" className="actchart__fold" aria-expanded={open.totaux} onClick={() => toggle('totaux')}>
          <span className="actchart__name">{t('Par activité')}</span>
          <span className="actchart__meta num">
            {tn(chart.totals.length, '{n} activité', '{n} activités', { n: chart.totals.length })}
          </span>
          <IconChevronRight size={16} className="actchart__chevron" style={{ transform: `rotate(${open.totaux ? -90 : 90}deg)` }} />
        </button>
      )}
      {chart.totals.length > 0 && open.totaux && (
        <ul className="actchart__totals">
          <li className="actchart__hint actchart__legend">{chart.range}.</li>
          {chart.totals.map((tot) => {
            const activity = activityById.get(tot.activityId)!;
            return (
              <li key={tot.activityId}>
                <button type="button" onClick={() => navigate(sessionsPath(activity.id))}>
                  <span className="ui-swatch" style={{ background: shown(activity.color) }} />
                  <span className="actchart__name">{activityDisplayName(activity)}</span>
                  <span className="actchart__meta num">
                    {tn(tot.sessions, '{n} session', '{n} sessions', { n: tot.sessions })} · {formatDuration(tot.durationS * 1000)} · {distanceText(tot.distanceM, activity)}
                  </span>
                  <IconChevronRight size={16} className="actchart__chevron" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default ActivityChart;
