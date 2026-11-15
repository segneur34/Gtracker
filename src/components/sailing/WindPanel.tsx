/**
 * Onglet « vent » de la voile : moyenne, plage, régularité et tendance du vent lu aux manœuvres, la méthode
 * repliée sous le « ? », et sa courbe sur la session, au zoom commun des graphes sur le temps.
 */
import type { ReactNode } from 'react';
import { t, tn } from '../../core/i18n';
import { tRich } from '../tRich';
import { formatDecimal } from '../../core/units';
import type { ChartZoomSource } from '../../hooks/useChartZoom';
import type { SailingChartRows } from '../../hooks/useSailingChartRows';
import type { TimeChartAxis } from '../../hooks/useTimeChartAxis';
import type { WindStats } from '../../sailing/sailingAnalytics';
import { HoverReadout } from '../ChartReadout';
import PanelTitle from '../PanelTitle';
import ResizablePanel from '../ResizablePanel';
import ZoomView from '../ZoomView';
import { useHelp } from '../helpContext';
import { PANEL_BLOCK_STYLE } from '../styles';
import { SailingWindChart } from './SailingCharts';
import { FILL_STYLE, WIND_COLOR, type SailingChartReaders } from './sailingChartParts';

interface WindPanelProps {
  windStats: WindStats;
  open: boolean;
  onToggle: () => void;
  /** Zoom commun aux graphes sur le temps de la session. */
  chartZoom: ChartZoomSource;
  rows: SailingChartRows;
  readers: SailingChartReaders;
  timeX: TimeChartAxis['timeX'];
  markLines: ReactNode;
  onShowOnMap: () => void;
  /** Comment zoomer, au bout de l'aide. */
  zoomText: string;
}

export default function WindPanel({ windStats, open, onToggle, chartZoom, rows, readers, timeX, markLines, onShowOnMap, zoomText }: WindPanelProps) {
  /** Explication de la lecture du vent, repliée derrière le « ? ». */
  const windHelpOpen = useHelp('voile:vent')?.open ?? false;
  return (
    <div style={{ ...PANEL_BLOCK_STYLE, display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 300px', minWidth: '250px' }}>
        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PanelTitle
            label={t('Variations du Vent')}
            open={open}
            onToggle={onToggle}
            extra={<span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>{' '}{tn(windStats.count, '(mesurées sur {n} manœuvre)', '(mesurées sur {n} manœuvres)')}</span>}
            helpKey="voile:vent" />
        </div>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>{tRich('<strong>Moyenne :</strong> {v}°', { v: windStats.avgWind })}</li>
          <li>{tRich('<strong>Plage de variation :</strong> {range}° (de {min}° à {max}°)', { range: windStats.range, min: windStats.minWind, max: windStats.maxWind })}</li>
          <li>{tRich('<strong>Régularité (écart-type circulaire) :</strong> ± {v}° <em>(faible = vent laminaire, élevé = vent oscillant)</em>', { v: windStats.stdDev })}</li>
          <li>{windStats.slopePerHour > 0
            ? tRich('<strong>Tendance temporelle :</strong> {v}°/heure (rotation droite / horaire)', { v: formatDecimal(Math.abs(windStats.slopePerHour), 1) })
            : tRich('<strong>Tendance temporelle :</strong> {v}°/heure (rotation gauche / anti-horaire)', { v: formatDecimal(Math.abs(windStats.slopePerHour), 1) })}</li>
          <li style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>
            {t('{p}% des manœuvres ont des caps stabilisés avant et après : ce sont les mesures les plus nettes, mais toutes comptent.', { p: Math.round(windStats.stableShare * 100) })}
          </li>
        </ul>
        {windHelpOpen && <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 'var(--text-xs)', lineHeight: '1.5' }}>
          {t("Chaque virement et chaque empannage donne une lecture du vent local, sans exception. Une manœuvre symétrique, entrée et sortie au même angle du vent, place son milieu sur l'axe du vent et mesure juste ; entrer au largue pour ressortir au près décale ce milieu d'autant. Ce biais ne peut pas se corriger manœuvre par manœuvre, mais il change de signe d'une fois sur l'autre : les manœuvres les plus symétriques pèsent davantage dans la moyenne et l'écart-type, et l'ensemble compense. Entre deux manœuvres la courbe est interpolée ; avant la première et après la dernière, elle garde la valeur la plus proche. Elle s'interrompt au-delà de 30 minutes sans manœuvre. Sur le graphe, les points marquent les manœuvres : c'est là, et là seulement, que le vent est mesuré. Le graphe garde le même zoom que celui de la vitesse. {zoomText}", { zoomText })}
        </p>}
      </div>

      <ResizablePanel id="sailing.graph.vent" defaultHeight={250} minWidth={300} minHeight={180} style={{ flex: '2 1 500px', overflow: 'hidden', border: '1px dashed var(--line-strong)', padding: '10px', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <ZoomView zoom={chartZoom}>
          {(z) => (
            <>
              <div className="chart-head" style={{ marginBottom: '10px' }}>
                <HoverReadout read={readers.windReadout(z)} label={t('Évolution du Vent')} color={WIND_COLOR} />
              </div>
              <div style={{ flexGrow: 1, width: '100%', position: 'relative' }}>
                <SailingWindChart rows={rows} z={z} timeX={timeX} markLines={markLines} onShowOnMap={onShowOnMap} style={FILL_STYLE} />
              </div>
            </>
          )}
        </ZoomView>
      </ResizablePanel>
    </div>
  );
}
