/**
 * Onglet « manœuvres » de la voile : tableau des virements et empannages, tableau par amure, explications
 * repliées sous le « ? », et « Détails » (podiums par métrique, liste de toutes les manœuvres d'un type).
 * Les vues (« Détails », genre du tableau par amure, listes dépliées) et les cases de la carte sont tenues
 * par le module : rendues telles quelles quand l'onglet se ferme puis se rouvre, et lues par la carte.
 */
import type { Dispatch, SetStateAction } from 'react';
import { t, tn } from '../../core/i18n';
import { formatDecimal, formatTimeOfDay } from '../../core/units';
import { MANEUVER_LOST_FLIGHT_S } from '../../sailing/sailingConfig';
import { MANEUVER_METRICS, TACK_LABELS, formatMetric, type ManeuverSummary, type windInputWarning } from '../../sailing/sailingAnalytics';
import type { ManeuverLocation, ManeuverStats } from '../../sailing/maneuvers';
import PanelTitle from '../PanelTitle';
import ResizablePanel from '../ResizablePanel';
import { useHelp } from '../helpContext';
import { tRich, tnRich } from '../tRich';
import { HIGHLIGHT_PODIUM_COLORS, PODIUM_RANKS } from '../highlightColors';
import { CARD_STYLE, HALF_PANEL_STYLE } from '../styles';
import Button from '../ui/Button';
import MapToggle from '../ui/MapToggle';
import SegmentedControl from '../ui/SegmentedControl';

type ManeuverKind = 'tack' | 'jibe';

/** Vues de l'onglet tenues par le module. */
export interface ManeuversView {
  /** « Détails » plutôt que « Résumé ». */
  details: boolean;
  setDetails: (details: boolean) => void;
  /** Genre montré dans le tableau par amure : virements ou empannages. */
  tackType: ManeuverKind;
  setTackType: (type: ManeuverKind) => void;
  /** Liste de toutes les manœuvres d'un type, sous « Détails » : repliée d'office, non mémorisée. */
  listOpen: Record<ManeuverKind, boolean>;
  setListOpen: Dispatch<SetStateAction<Record<ManeuverKind, boolean>>>;
}

/** Cases « Carte » du tableau : virements, empannages, sens incertain. */
export interface ManeuversOnMap {
  tack: boolean;
  jibe: boolean;
  undecided: boolean;
  toggle: (type: ManeuverKind | 'undecided') => void;
}

interface ManeuversPanelProps {
  stats: ManeuverStats;
  summary: ManeuverSummary;
  open: boolean;
  onToggle: () => void;
  /** Vitesse en nœuds vers l'unité de l'activité, sans le symbole. */
  showKn: (kn: number | string) => string;
  /** Seuil en nœuds, tel qu'il s'écrit (`showThreshold` du module). */
  showThreshold: (kn: number) => string;
  speedSymbol: string;
  /** Seuil d'activité de la session, en nœuds : en dessous, une manœuvre est ratée. */
  activeThresholdKn: number;
  foil: boolean;
  /** Vent saisi loin du vent calculé fiable, qui écarte des virages. */
  windWarning: ReturnType<typeof windInputWarning>;
  /** Intervalle médian de la trace, en secondes. */
  samplingS: number;
  pointCount: number;
  /** Vitesse d'entrée de virage retenue, en nœuds. */
  minEntrySpeedKn: number;
  /** Mentions d'une manœuvre (amures, vol perdu, décollage), les mêmes que dans la bulle de la carte. */
  notesOf: (loc: ManeuverLocation) => string[];
  onMap: ManeuversOnMap;
  /** Podium montré sur la carte (`tack:conservation`…), ou `null`. */
  selectedTop: string | null;
  onSelectTop: (key: string | null) => void;
  view: ManeuversView;
  /** Ancre du panneau, où défile la page quand une tuile de « général » l'ouvre (`tabAnchorId`). */
  anchorId?: string;
}

export default function ManeuversPanel({
  stats: m, summary: maneuverSummary, open, onToggle, showKn, showThreshold, speedSymbol, activeThresholdKn, foil, windWarning,
  samplingS, pointCount, minEntrySpeedKn, notesOf: maneuverNotes, onMap, selectedTop: selectedManeuverTop, onSelectTop, view, anchorId,
}: ManeuversPanelProps) {
  /** Explications repliées derrière le « ? » : enregistrement, virages écartés, lecture des podiums. */
  const maneuverHelpOpen = useHelp('voile:manoeuvres')?.open ?? false;
  return (
    <ResizablePanel id={view.details ? 'sailing.carte.manoeuvres.details' : 'sailing.carte.manoeuvres'} anchorId={anchorId} style={{ ...CARD_STYLE, ...(view.details ? { flex: '1 1 100%' } : HALF_PANEL_STYLE), padding: '12px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <PanelTitle label={t('Manœuvres')} open={open} onToggle={onToggle} helpKey="voile:manoeuvres" />
        <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>{t('ratée si moins de {v} {unit} pendant au moins {s} s', { v: showThreshold(activeThresholdKn), unit: speedSymbol, s: MANEUVER_LOST_FLIGHT_S })}</span>
      </div>

      <div className="an-man-scroll">
      <table className="an-man-summary" style={{ borderCollapse: 'collapse', fontSize: 'var(--text-s)', backgroundColor: 'var(--surface)', border: '1px solid var(--line)', marginBottom: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--surface-sunken)' }}>
            <th style={{ textAlign: 'left' }}>{t('Type')}</th>
            <th>{t('Réussis')}</th>
            <th>{t('Ratés')}</th>
            <th title={t('Vitesse minimale pendant la manœuvre, moyenne sur toutes les manœuvres')}>{t('Vmin moy. ({unit})', { unit: speedSymbol })}</th>
            <th title={t('Meilleure vitesse minimale conservée sur une manœuvre')}>{t('Vmin max ({unit})', { unit: speedSymbol })}</th>
            <th style={{ padding: '7px 10px' }}>{t('Carte')}</th>
          </tr>
        </thead>
        <tbody>
          {([
            [t('Virements'), maneuverSummary.tack, onMap.tack, () => onMap.toggle('tack'), undefined, t('Afficher les virements sur la carte')],
            [t('Empannages'), maneuverSummary.jibe, onMap.jibe, () => onMap.toggle('jibe'), undefined, t('Afficher les empannages sur la carte')],
            // Virages vus en un seul pas de la trace : la ligne n'apparaît que s'il y en a.
            ...(maneuverSummary.undecided
              ? [[t('Sens incertain'), maneuverSummary.undecided, onMap.undecided, () => onMap.toggle('undecided'),
                t('Virage vu en un seul pas de la trace : on connaît le cap avant et après, pas le côté par lequel il est passé. Compté, ni virement ni empannage, et hors du vent.'),
                t('Afficher les manœuvres de sens incertain sur la carte')] as const]
              : []),
          ] as const).map(([label, summary, shown, toggle, hint, mapTitle]) => (
            <tr key={label} className="ui-table__row">
              <td style={{ fontWeight: 700 }} title={hint}>{label}</td>
              <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700, fontSize: 'var(--text-m)' }}>{summary?.success ?? 0}</td>
              <td style={{ textAlign: 'center', color: 'var(--danger)', fontSize: 'var(--text-m)' }}>{summary?.fail ?? 0}</td>
              <td style={{ textAlign: 'center' }}>{summary ? showKn(summary.vminAvg) : '-'}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{summary ? showKn(summary.vminMax) : '-'}</td>
              <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                <MapToggle shown={shown} color="var(--voile)" ink="var(--on-ink)" title={mapTitle} onClick={toggle}
                  style={{ padding: '3px 10px', border: 'none' }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Vent saisi loin du vent calculé fiable : les virages tombent en « sens incertain », on le dit. */}
      {windWarning && (
        <p style={{ margin: '0 0 10px', padding: '8px', backgroundColor: 'var(--warning-soft)', borderLeft: '3px solid var(--warning-line)', borderRadius: 'var(--radius-s)', color: 'var(--ink-2)', fontSize: 'var(--text-xs)', lineHeight: '1.6' }}>
          {tnRich(windWarning.unclassified,
            'Le vent saisi ({manual}°) écarte <strong>{n}</strong> virage, ni virement ni empannage ; le vent calculé est à {auto}°. Vérifier la direction.',
            'Le vent saisi ({manual}°) écarte <strong>{n}</strong> virages, ni virement ni empannage ; le vent calculé est à {auto}°. Vérifier la direction.',
            { manual: formatDecimal(windWarning.manualDeg, 0), auto: formatDecimal(windWarning.autoDeg, 0) })}
        </p>
      )}

      {/* Par amure : virements ou empannages selon l'amure d'avant la manœuvre, médianes. */}
      {(maneuverSummary.tack || maneuverSummary.jibe) && (
        <div className="an-man-scroll" style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <strong className="ui-subtitle">{t('Par amure')}</strong>
            <SegmentedControl<'tack' | 'jibe'> label={t('Manœuvres par amure')} accent="var(--voile)" value={view.tackType} onChange={view.setTackType}
              items={[{ key: 'tack', label: t('Virements') }, { key: 'jibe', label: t('Empannages') }]} />
          </div>
          <table className="an-man-summary" style={{ borderCollapse: 'collapse', fontSize: 'var(--text-s)', backgroundColor: 'var(--surface)', border: '1px solid var(--line)' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-sunken)' }}>
                <th style={{ textAlign: 'left' }} title={t("Amure avant la manœuvre : d'où vient le vent")}>{t('Amure')}</th>
                <th title={t('Manœuvres réussies sur le total de cette amure')}>{t('Réussis')}</th>
                <th title={t('Vitesse minimale pendant la manœuvre, médiane sur cette amure')}>{t('Vmin méd. ({unit})', { unit: speedSymbol })}</th>
                <th title={t("Vitesse minimale sur vitesse d'approche, médiane sur cette amure")}>{t('Conservation')}</th>
              </tr>
            </thead>
            <tbody>
              {(['starboard', 'port'] as const).map((tack) => {
                const onTack = maneuverSummary.byTack[view.tackType][tack];
                return (
                  <tr key={tack} className="ui-table__row">
                    <td style={{ fontWeight: 700 }}>{TACK_LABELS[tack]}</td>
                    <td style={{ textAlign: 'center' }}>
                      {onTack ? <><span style={{ color: 'var(--success)', fontWeight: 700 }}>{onTack.success}</span>{` / ${onTack.count}`}</> : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>{onTack ? showKn(onTack.vminMedian) : '-'}</td>
                    <td style={{ textAlign: 'center' }}>{onTack ? formatMetric('conservation', onTack.conservationMedian) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {maneuverHelpOpen && (<>
      <p style={{ margin: '0 0 10px', padding: '8px', backgroundColor: 'var(--bg)', borderLeft: '3px solid var(--line-strong)', borderRadius: 'var(--radius-s)', color: 'var(--ink-2)', fontSize: 'var(--text-xs)', lineHeight: '1.6' }}>
        {tnRich(pointCount,
          "<strong>Enregistrement :</strong> {n} point, un toutes les {s} s en médiane. Entrée de virage retenue au-dessus de {v} {unit}, d'après l'allure de la session.",
          "<strong>Enregistrement :</strong> {n} points, un toutes les {s} s en médiane. Entrée de virage retenue au-dessus de {v} {unit}, d'après l'allure de la session.",
          { s: samplingS < 10 ? formatDecimal(samplingS, 1) : Math.round(samplingS), v: showKn(minEntrySpeedKn), unit: speedSymbol }, {}, true)}
        {samplingS > 10 && (
          <>
            {' '}{t('Cadence économique : les manœuvres se lisent encore, mais leur qualité (Vmin, relance) et les tops courts reposent sur des moyennes de plusieurs dizaines de secondes.')}
          </>
        )}
      </p>

      {(m.rejected.unclassified > 0 ||
        m.rejected.slowEntry > 0 ||
        m.rejected.incoherent > 0 ||
        m.rejected.still > 0 ||
        m.rejected.tooShort > 0 ||
        m.rejected.noFlight > 0 ||
        m.rejected.fullTurn > 0) && (
        <p style={{ margin: '0 0 10px', padding: '8px', backgroundColor: 'var(--bg)', borderLeft: '3px solid var(--line-strong)', borderRadius: 'var(--radius-s)', color: 'var(--ink-2)', fontSize: 'var(--text-xs)', lineHeight: '1.6' }}>
          {tnRich(m.locations.length,
            "<strong>{n} virage retenu</strong>, et d'autres écartés en chemin :",
            "<strong>{n} virages retenus</strong>, et d'autres écartés en chemin :")}
          {m.rejected.noFlight > 0 && (
            <>
              <br />
              {foil
                ? tnRich(m.rejected.noFlight,
                  '<strong>{n}</strong> demi-tour hors vol : entamé sous le seuil de vol, ni réussi ni raté.',
                  '<strong>{n}</strong> demi-tours hors vol : entamés sous le seuil de vol, ni réussis ni ratés.')
                : tnRich(m.rejected.noFlight,
                  '<strong>{n}</strong> demi-tour hors navigation : entamé sous le seuil de navigation, ni réussi ni raté.',
                  '<strong>{n}</strong> demi-tours hors navigation : entamés sous le seuil de navigation, ni réussis ni ratés.')}
            </>
          )}
          {m.rejected.fullTurn > 0 && (
            <>
              <br />
              {tnRich(m.rejected.fullTurn, '<strong>{n}</strong> tour complet, non compté.', '<strong>{n}</strong> tours complets, non comptés.')}
            </>
          )}
          {m.rejected.unclassified > 0 && (
            <>
              <br />
              {tnRich(m.rejected.unclassified,
                "<strong>{n}</strong> franc et net, mais sans changer d'amures ou ni face au vent ni au vent arrière : ce sont des abattées ou des remontées — ou le vent retenu est faux, ce qui range tous les demi-tours au travers.",
                "<strong>{n}</strong> francs et nets, mais sans changer d'amures ou ni face au vent ni au vent arrière : ce sont des abattées ou des remontées — ou le vent retenu est faux, ce qui range tous les demi-tours au travers.")}
            </>
          )}
          {m.rejected.slowEntry > 0 && (
            <>
              <br />
              {tnRich(m.rejected.slowEntry,
                "<strong>{n}</strong> entamé trop lentement (moins de {v} {unit} à l'entrée).",
                "<strong>{n}</strong> entamés trop lentement (moins de {v} {unit} à l'entrée).",
                { v: showKn(minEntrySpeedKn), unit: speedSymbol })}
            </>
          )}
          {m.rejected.incoherent > 0 && (
            <>
              <br />
              {tRich('<strong>{n}</strong> dont le cap partait dans tous les sens : chute ou hésitation.', { n: m.rejected.incoherent })}
            </>
          )}
          {m.rejected.still > 0 && (
            <>
              <br />
              {tnRich(m.rejected.still,
                "<strong>{n}</strong> lu planche arrêtée, avant ou après le virage : à l'arrêt le cap n'est que du bruit de position.",
                "<strong>{n}</strong> lus planche arrêtée, avant ou après le virage : à l'arrêt le cap n'est que du bruit de position.")}
            </>
          )}
          {m.rejected.tooShort > 0 && (
            <>
              <br />
              {tnRich(m.rejected.tooShort,
                "<strong>{n}</strong> sur place (moins de 10 m parcourus : à cette distance le cap n'est que du bruit de position) ou entamé dans les dernières secondes de la trace.",
                "<strong>{n}</strong> sur place (moins de 10 m parcourus : à cette distance le cap n'est que du bruit de position) ou entamés dans les dernières secondes de la trace.")}
            </>
          )}
        </p>
      )}
      {view.details && (
        <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 'var(--text-xs)', lineHeight: 1.45 }}>
          {t("Survolez une ligne pour la définition, une case du podium pour l'heure de la manœuvre. Le podium retient la meilleure valeur : conservation la plus haute, relance la plus courte, cap (virements seulement) et distance les plus faibles, gain au vent le plus grand ; à égalité, la meilleure conservation.")}
        </p>
      )}
      </>)}

      <SegmentedControl<'resume' | 'details'> label={t('Détails des manœuvres')} accent="var(--voile)"
        value={view.details ? 'details' : 'resume'} onChange={(key) => view.setDetails(key === 'details')}
        items={[{ key: 'resume', label: t('Résumé') }, { key: 'details', label: t('Détails') }]} />

      {view.details && (
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '12px' }}>
        {([
          ['tack', t('Virements'), maneuverSummary.tack],
          ['jibe', t('Empannages'), maneuverSummary.jibe],
        ] as const).map(([type, title, summary]) => {
          const ofType = m.locations.filter((loc) => loc.type === type);
          const listOpen = view.listOpen[type];
          return (
          <div key={type} className="an-man-detail" style={{ flex: '1 1 380px', backgroundColor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <strong className="ui-subtitle">{title}</strong>
              {summary ? (
                <span style={{ fontSize: 'var(--text-s)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{tn(summary.success, '{n} réussi', '{n} réussis')}</span>
                  {' · '}
                  <span style={{ color: 'var(--danger)' }}>{tn(summary.fail, '{n} raté', '{n} ratés')}</span>
                  {' · '}{tRich('Vmin moy. {avg} {unit}, max <strong>{max}</strong> {unit}', { avg: showKn(summary.vminAvg), unit: speedSymbol, max: showKn(summary.vminMax) })}
                </span>
              ) : (
                <span style={{ color: 'var(--muted)', fontSize: 'var(--text-s)' }}>{t('aucun')}</span>
              )}
            </div>

            {summary && (
              <table className="an-man-podium" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                <thead>
                  <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 'normal' }}>{t('Métrique')}</th>
                    <th style={{ padding: '3px 4px', fontWeight: 'normal' }}>{t('Moyenne')}</th>
                    {PODIUM_RANKS.map((rank, idx) => (
                      <th key={rank} style={{ padding: '3px 4px', fontWeight: 'normal', color: HIGHLIGHT_PODIUM_COLORS[idx] }}>{rank}</th>
                    ))}
                    <th style={{ padding: '3px 4px' }} />
                  </tr>
                </thead>
                <tbody>
                  {MANEUVER_METRICS.map((metric, rowIdx) => {
                    const key = `${type}:${metric.key}`;
                    const active = selectedManeuverTop === key;
                    const tops = summary.tops[metric.key];
                    const ranked = metric.ranked.includes(type);
                    return (
                      <tr key={metric.key} title={metric.hint} style={{ borderTop: rowIdx > 0 ? 'var(--trait-encre)' : undefined, backgroundColor: active ? 'var(--voile-soft)' : 'transparent' }}>
                        <td style={{ padding: '4px', textAlign: 'left' }}>{metric.label}</td>
                        <td style={{ padding: '4px', textAlign: 'center', fontWeight: 700 }}>
                          {summary.averages[metric.key]}
                          {metric.key === 'relaunch' && summary.withoutRelaunch > 0 && (
                            <span style={{ display: 'block', fontWeight: 'normal', color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>
                              {t('{n} sans relance', { n: summary.withoutRelaunch })}
                            </span>
                          )}
                        </td>
                        {[0, 1, 2].map((rank) => (
                          <td key={rank} title={tops[rank] ? formatTimeOfDay(tops[rank].timeMs) : undefined} style={{ padding: '4px', textAlign: 'center' }}>
                            {ranked ? tops[rank]?.label ?? '-' : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                          <MapToggle
                            shown={active} color="var(--voile)" ink="var(--on-ink)" labels={[t('Carte'), t('Masquer')]} disabled={tops.length === 0}
                            onClick={() => onSelectTop(active ? null : key)}
                            style={{ padding: '2px 7px', opacity: tops.length === 0 ? 0.5 : 1 }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {summary && ofType.length > 0 && (
              <Button size="s" style={{ marginTop: '8px' }} aria-expanded={listOpen}
                onClick={() => view.setListOpen((prev) => ({ ...prev, [type]: !prev[type] }))}>
                {listOpen
                  ? (type === 'tack' ? t('Replier les virements ▲') : t('Replier les empannages ▲'))
                  : (type === 'tack' ? t('Tous les virements ({n}) ▼', { n: ofType.length }) : t('Tous les empannages ({n}) ▼', { n: ofType.length }))}
              </Button>
            )}
            {summary && listOpen && ofType.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: 'var(--text-xs)', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {ofType.map((loc) => (
                  <li key={loc.timeMs}>
                    {formatTimeOfDay(loc.timeMs)}{' · '}
                    <span style={{ color: loc.success ? 'var(--success)' : 'var(--danger)' }}>{loc.success ? t('réussi') : t('raté')}</span>
                    {' · '}{t('Vmin {v} {unit}', { v: showKn(loc.vmin), unit: speedSymbol })}
                    {maneuverNotes(loc).map((note) => ` · ${note}`).join('')}
                  </li>
                ))}
              </ul>
            )}
          </div>
          );
        })}
      </div>
      )}
    </ResizablePanel>
  );
}
