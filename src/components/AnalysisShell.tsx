import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../pages/analysisMobile.css';
import './BrushFrame.css';
import { brushColorFor } from '../core/brushColor';
import { t } from '../core/i18n';
import type { ShareStat } from '../core/shareImage';
import { shareableStats } from '../core/shareImage';
import type { SportFamily } from '../core/sportProfiles';
import { sessionsPath } from '../core/parentPage';
import { useScrollToTopOnMount } from '../hooks/useRetainedScroll';
import { useAppliedTheme } from '../hooks/useTheme';
import { dismissRecorderResult, useRecorderSelector } from '../hooks/useRecorder';
import type { useSessionDraft } from '../hooks/useSessionDraft';
import AnalysisMap, { ANALYSIS_MAP_ANCHOR, type AnalysisMapProps } from './AnalysisMap';
import CollapsibleSectionTabs from './CollapsibleSectionTabs';
import GearReminder, { type GearReminderProps } from './GearReminder';
import type { SectionDefinition } from './SectionTabs';
import SessionNameEditor from './SessionNameEditor';
import SessionSaveBar from './SessionSaveBar';
import { tRich } from './tRich';
import type { TrackSegment } from './TrackSegmentsLayer';
import Button from './ui/Button';
import PageHeader from './ui/PageHeader';

/** Carte de la page : les props d'`AnalysisMap` (l'ancre est posée ici), et le plan de sa rangée (la voile garde `zIndex: 0`). */
type ShellMap = Omit<AnalysisMapProps, 'anchorId'> & { rowZIndex?: number };

/** Barre d'onglets et panneaux, construits par le module seulement quand la session a ses chiffres. */
interface ShellTabs<K extends string> {
  sections: ReadonlyArray<SectionDefinition<K> & { primary?: true }>;
  open: Record<K, boolean>;
  onToggle: (key: K) => void;
  /** « tout fermer » : chaque onglet fermé, « général » compris. */
  onCloseAll: () => void;
  advanced: { open: boolean; toggle: () => void };
  accent?: string;
  /** Couleur de fiche de l'activité de la session : celle du trait de pinceau des panneaux (l'encre sans elle). */
  activityColor?: string;
  panels: ReactNode;
}

interface AnalysisShellProps<K extends string> {
  /** Titre de la page (« Analyse voile »…). */
  title: ReactNode;
  /** Famille : retour à sa bibliothèque, famille de l'image de partage. */
  family: SportFamily;
  /** Libellé du retour et du lien de la phrase « Aucune session ouverte ». */
  backLabel: string;
  /** Fichier de la session, nommé sous le titre ; `null` sans session. */
  file: string | null;
  /** Image de partage : trace colorée et chiffres de « général » ; sans chiffres, pas de partage. */
  share: { segments: ReadonlyArray<TrackSegment>; stats: readonly ShareStat[] };
  /** Erreur de la session (introuvable, illisible), sous le titre. */
  error: string | null;
  /** Brouillon de la session : sa barre ; `null` pour ne pas la poser. */
  draft: ReturnType<typeof useSessionDraft> | null;
  /** Erreur de lecture du GPX, sous la barre du brouillon. */
  loadError?: string | null;
  /** Alertes propres au module, sous l'erreur de lecture. */
  alerts?: ReactNode;
  /** Aucune session demandée : la phrase qui renvoie à la bibliothèque. */
  empty: boolean;
  /** Session demandée pas encore lue : « Lecture de la session… », à la place de la phrase d'`empty`. */
  reading?: boolean;
  /** Rappel du matériel (`GearReminder`) ; absent pour ne pas en poser. Le fichier est celui de la page. */
  gearReminder?: Omit<GearReminderProps, 'file'>;
  /** Rangée de la carte ; absente pour une session sans trace. */
  map?: ShellMap;
  tabs: ShellTabs<K> | null;
}

/**
 * Message de l'enregistreur sur la session qu'il vient de ranger et dont l'analyse s'ouvre :
 * avertissements de l'arrêt (capteurs…) ou ménage en échec, dits ici et non plus sur la page Enregistrer.
 * « Fermer » l'efface (`dismissRecorderResult`).
 */
function RecorderNotice({ file }: { file: string | null }) {
  const savedFile = useRecorderSelector((s) => s.saved?.libraryFile ?? null);
  const error = useRecorderSelector((s) => s.error);
  if (file === null || savedFile !== file || error === null) return null;
  return (
    <div className="ui-alert ui-alert--warning ui-mb-10 ui-max-520 ui-row-10 ui-center">
      <span className="ui-grow">{error}</span>
      <Button size="s" variant="ghost" onClick={dismissRecorderResult}>{t('Fermer')}</Button>
    </div>
  );
}

/** Rangée de la carte : un appel de fonction, pas un composant, pour ne rien ajouter à l'arbre de la page. */
const mapRow = ({ rowZIndex, ...props }: ShellMap) => (
  <div className="an-map-row" style={{ marginTop: '10px', zIndex: rowZIndex }}>
    <AnalysisMap {...props} anchorId={ANALYSIS_MAP_ANCHOR} />
  </div>
);

/**
 * Mise en page commune des analyses (`docs/MISE_EN_PAGE.md`) : feuille de
 * l'en-tête, barre du brouillon, alertes, phrase « Aucune session ouverte »
 * ou « Lecture de la session… », rangée de la carte, puis colonne des onglets et de leurs panneaux. Rendu
 * seul, sans état : les modules gardent leurs hooks. Chaque emplacement a sa
 * place fixe, pour que la carte ne soit jamais remontée ; les classes `an-*`
 * sont celles d'`analysisMobile.css`.
 */
function AnalysisShell<K extends string>({
  title, family, backLabel, file, share, error, draft, loadError, alerts, empty, reading = false, gearReminder, map, tabs,
}: AnalysisShellProps<K>) {
  // Le filtre d'activité de la page Sessions d'où l'on vient est rendu au retour.
  const [params] = useSearchParams();
  const back = sessionsPath(params.get('activite'));
  useScrollToTopOnMount();
  // Trait de pinceau des panneaux : la couleur de l'activité, vue du thème appliqué.
  const dark = useAppliedTheme().theme === 'dark';
  const activityColor = tabs?.activityColor;
  const panelsStyle = useMemo(
    () => ({ '--brush': activityColor ? brushColorFor(activityColor, dark) : 'var(--ink)' }) as CSSProperties,
    [activityColor, dark]
  );
  return (
    <div className="an-page ui-p-20">
      <div className="an-sheet">
        <div className="an-sheet__head">
          <PageHeader title={title} subtitle={file ? (
            <SessionNameEditor file={file} back={back}
              share={share.stats.length > 0 ? { family, segments: share.segments, stats: shareableStats(share.stats) } : undefined} />
          ) : undefined} back={{ to: back, label: backLabel }} />
          {error && <div className="ui-alert ui-alert--warning ui-mt-10">{error}</div>}
        </div>
      </div>

      {draft && <SessionSaveBar draft={draft} />}

      {loadError && (
        <div className="ui-alert ui-alert--danger ui-mb-10 ui-max-520">
          {loadError}
        </div>
      )}

      <RecorderNotice file={file} />
      {gearReminder && <GearReminder file={file} {...gearReminder} />}

      {alerts}

      {empty && (
        <p className="ui-muted">
          {tRich('Aucune session ouverte : choisissez-en une dans {lien}.', { lien: <Link to={back}>{backLabel}</Link> })}
        </p>
      )}

      {reading && (
        <p role="status" aria-live="polite" className="ui-muted">
          {t('Lecture de la session…')}
        </p>
      )}

      {map && mapRow(map)}

      {tabs && (
        <div className="an-carte-col" style={map ? undefined : { marginTop: '10px' }}>
          <CollapsibleSectionTabs sections={tabs.sections} open={tabs.open} onToggle={tabs.onToggle} onCloseAll={tabs.onCloseAll}
            advancedOpen={tabs.advanced.open} onToggleAdvanced={tabs.advanced.toggle} accent={tabs.accent} />
          <div className="an-carte-panels brush-panels" style={panelsStyle}>
            {tabs.panels}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisShell;
