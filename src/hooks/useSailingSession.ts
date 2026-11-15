import { useMemo } from 'react';
import type { SpeedRangeMs } from '../core/speedGradient';
import type { ColoredSegment } from '../core/trackColor';
import { msToKnots } from '../core/units';
import { trackToPointData } from '../sailing/pointData';
import {
  retainedWind, runSailingAnalysis, sailingAnalysisResult, sailingAnalysisShown, type SailingAnalysisShown,
} from '../sailing/sailingSession';
import { resolveSailingThresholds } from '../sailing/sailingConfig';
import type { TrackColorOptions } from '../library/analysisStore';
import type { SessionRecord } from '../library/record';
import { sessionActivitySettings } from '../library/summaryOptions';
import { runInWorker } from '../library/trackWorkerClient';
import { useGpxSession } from './useGpxSession';
import type { useSportSettings } from './useSportSettings';
import { colorKeyOf, useKeptSegments, useTrackAnalysis } from './useTrackAnalysis';

/**
 * Orchestration d'une session à voile : ingestion générique d'un côté,
 * analyses vent, manœuvres et VMG de l'autre.
 *
 * Chaîne du vent : estimation automatique avec indice de confiance, ou saisie
 * manuelle. Si l'estimation n'est pas fiable et qu'aucune valeur n'a été
 * saisie, les analyses qui dépendent du vent sont suspendues plutôt que
 * calculées sur une direction fausse.
 *
 * Le seuil d'activité est propagé à tous les calculs qui en dépendent, et une
 * modification du seuil recalcule les statistiques sans relire le fichier :
 * seulement ce qui dépend du seuil (masque d'activité, classement des
 * manœuvres), la polaire, la détection des virages et le masque du ratio étant
 * préparés une fois par trace. Toute l'analyse se fait hors du fil de
 * l'affichage (`useTrackAnalysis`, `library/analysisStore.ts`) : le champ du
 * seuil reste fluide, les chiffres le rejoignent au retour du calcul, et la
 * trace montrée est toujours celle de l'analyse montrée.
 *
 * Le vent saisi, le seuil et l'allure propres à la session viennent du
 * module (son brouillon, `useSessionDraft`), qui les garde dans la fiche de
 * la session ; les réglages de l'activité aussi (`useSportSettings('voile')`,
 * lu une seule fois, par le module).
 */
export interface SailingSessionInput {
  /** Réglages de l'activité de voile, lus par le module. */
  settings: ReturnType<typeof useSportSettings>;
  /** Vent saisi, en degrés ; `null` : vent estimé. */
  windDeg: number | null;
  /** Seuil d'activité de la session, en nœuds ; `null` : celui du support, ou la suggestion. */
  activeThresholdKn: number | null;
  /** Allure de la session imposée, en m/s ; `null` : déduite de la trace. */
  referenceSpeedMs: number | null;
  /** Fiche de la session, `null` hors de la mémoire : le seuil de l'activité qu'elle porte. */
  record: SessionRecord | null;
  /** Bornes de couleur propres à la session (brouillon, puis fiche) ; `null` : aucune. */
  sessionSpeedRange: SpeedRangeMs | null;
  /**
   * Fichier de la session demandée par l'adresse, dont viennent le vent, le seuil et l'allure ; `null` : trace ouverte
   * à la main. La trace d'une autre session, encore affichée le temps de lire la nouvelle, n'est ni analysée ni montrée.
   */
  requestedFile: string | null;
  /** L'ouverture de la session demandée a échoué (absente de la mémoire, GPX illisible) : plus de lecture en cours. */
  requestedFailed: boolean;
}

/** Ce que la page lit d'une analyse à voile : ses chiffres dans la langue de l'interface, et les traits de la trace colorée. */
interface SailingShown {
  analysis: SailingAnalysisShown;
  segments: ColoredSegment[];
  /** Traitement et bornes effectives des traits (`colorKeyOf`). */
  colorKey: string;
}

/**
 * Seuil d'activité de l'appareil et celui de l'activité pour la session : le
 * seuil réglé ou pré-réglé sur l'appareil (`null` sans l'un ni l'autre), et
 * celui que la fiche de la session porte, qui prime sur lui. Le seuil
 * propre de la session prime encore sur le second (`resolveSailingThresholds`).
 */
export const sailingActivityThresholds = (
  record: SessionRecord | null,
  device: { isThresholdOverridden: boolean; activeThresholdKn: number; foil: boolean | null }
): { deviceThresholdKn: number | null; activityThresholdKn: number | null } => {
  const deviceThresholdKn = device.isThresholdOverridden ? device.activeThresholdKn : null;
  const activityThresholdKn =
    sessionActivitySettings(record, { thresholdOverride: deviceThresholdKn ?? undefined, foil: device.foil }).thresholdOverride ?? null;
  return { deviceThresholdKn, activityThresholdKn };
};

export const useSailingSession = ({
  settings,
  windDeg,
  activeThresholdKn: sessionThresholdKn,
  referenceSpeedMs: sessionReferenceMs,
  record,
  sessionSpeedRange,
  requestedFile,
  requestedFailed,
}: SailingSessionInput) => {
  const {
    sport,
    profile,
    activeThreshold: rawActiveThresholdKn,
    isThresholdOverridden,
    speedRange,
    defaultSpeedRange,
    speedUnit,
    distanceUnit,
    foil: activityFoil,
    pumping: activityPumping,
    gearGroups,
  } = settings;

  // Les seuils de filtrage suivent l'allure de la session, pas seulement le
  // support : sur une trace lente, l'accélération et le plafond du wingfoil
  // laissent passer des pics d'enregistrement qui fabriquent des manœuvres.
  const gpx = useGpxSession({ profile, referenceSpeedOverrideMs: sessionReferenceMs ?? undefined });
  // Allure de la trace lue : le seuil demandé au calcul s'y accorde (règle 4).
  const referenceSpeedKn = msToKnots(gpx.referenceSpeedMs);

  /**
   * Seuil d'activité effectif : celui de la session, sinon celui de l'activité
   * que sa fiche porte, sinon celui de l'appareil (réglé ou pré-réglé), sinon la
   * suggestion selon l'allure ; le bateau, sans seuil, garde son seuil fixe de
   * réussite (`resolveSailingThresholds`).
   */
  const { deviceThresholdKn, activityThresholdKn } = sailingActivityThresholds(record, {
    isThresholdOverridden,
    activeThresholdKn: rawActiveThresholdKn,
    foil: activityFoil,
  });
  const thresholds = resolveSailingThresholds(profile, activityThresholdKn, sessionThresholdKn, referenceSpeedKn);
  const { withThreshold, defaultKn: defaultActiveThresholdKn, activeKn: activeThresholdKn } = thresholds;

  /**
   * Couleurs de la trace, aux bornes de la session (brouillon, puis fiche), sinon de l'activité, sinon la suggestion
   * accordée à la session, sinon le défaut : le calcul les ordonne (`effectiveSpeedRange`), comme la légende du module.
   */
  const color = useMemo(
    (): TrackColorOptions => ({ treatment: 'voile', sessionRange: sessionSpeedRange, activityRange: speedRange, fallback: defaultSpeedRange }),
    [sessionSpeedRange, speedRange, defaultSpeedRange]
  );
  const profileText = useMemo(() => JSON.stringify(profile), [profile]);
  /**
   * Seuil, vent saisi, calcul et couleurs : un changement redemande l'analyse au calcul en arrière-plan, qui ne refait
   * que ce qui en dépend (`analysisStore.ts`). Le champ et ses libellés lisent `activeThresholdKn` tout de suite ; les
   * chiffres le rejoignent au retour du calcul.
   */
  const inputs = JSON.stringify([sport, profileText, activeThresholdKn, windDeg, color]);
  const view = useTrackAnalysis(gpx.analysis, inputs, (source) =>
    runInWorker('analyzeSailing', source.from.text, {
      key: source.key, prepare: source.prepare, sport, profile, thresholdKn: activeThresholdKn, windDeg, color,
    }).then((reply): SailingShown => ({
      analysis: sailingAnalysisShown(reply.analysis),
      segments: reply.segments,
      colorKey: colorKeyOf(color, reply.analysis.suggestedSpeedRangeMs),
    })), requestedFile, requestedFailed
  );

  /** Trace de l'analyse montrée ; sans analyse, une trace sans point. */
  const base = view.pair?.source.prepared ?? gpx.emptyPrepared;
  // Sans analyse reçue, celle d'une trace sans point, faite sur place : les mêmes valeurs qu'avant toute lecture.
  const emptyShown = useMemo(
    (): SailingShown => {
      const empty = gpx.emptyPrepared;
      const stages = runSailingAnalysis(
        empty.track, { sport, profile, referenceSpeedMs: empty.referenceSpeedMs, cumulative: empty.cumulative }, activeThresholdKn, windDeg
      );
      return { analysis: sailingAnalysisShown(sailingAnalysisResult(stages)), segments: [], colorKey: '' };
    },
    [gpx.emptyPrepared, sport, profile, activeThresholdKn, windDeg]
  );
  const shown = view.pair?.result ?? emptyShown;
  const { analysis } = shown;
  const mapSegments = useKeptSegments(shown.segments, base.track, shown.colorKey);
  const {
    stats, flights, windEstimate, autoWind, currentWindValue, windInputRequired, maneuverStats, maneuverSummary, windStats,
    vmgStats, vmgSeries, polarGraphData, suggestedSpeedRangeMs, maneuverThresholds,
  } = analysis;
  /** Vue en nœuds de la trace montrée, attendue par les analyses voile (règle 5) : une fois par trace. */
  const trackData = useMemo(() => trackToPointData(base.track), [base.track]);
  const { cumulative } = base;

  return {
    trackData,
    /** Trace en unités SI, pour les calculs du noyau (sauts). */
    track: base.track,
    /** Distance et temps cumulés le long de la trace, calculés une fois pour le hook et le module. */
    cumulative,
    stats,
    /** Vols de la session au seuil d'activité (pumping sur foil) ; vide si le calcul ne mesure pas le pumping. */
    flights,
    /** Vent retenu par l'analyse montrée : celui des chiffres calculés (manœuvres, VMG, polaire) et de la fiche. */
    currentWindValue,
    /**
     * Vent retenu à montrer et d'où part un réglage (boussole, champ, « Inverser », image de partage) : le vent saisi
     * dès qu'il l'est, sans attendre le recalcul, sinon l'estimation fiable de l'analyse montrée ; la même valeur que
     * `currentWindValue` une fois l'analyse à jour.
     */
    shownWind: retainedWind(windDeg, windEstimate),
    autoWind,
    windEstimate,
    windInputRequired,
    loadGpxContent: gpx.loadGpxContent,
    /** Fichier de la trace montrée, `null` sans analyse : la fiche ne reçoit que les chiffres de sa propre trace. */
    fileName: view.pair?.source.from.fileName ?? null,
    sessionKey: base.sessionKey,
    hasDeviceSpeed: base.hasDeviceSpeed,
    loadError: gpx.error,
    /** Trace remise encore en préparation, ou trace neuve sans sa première analyse : « Lecture de la session… ». */
    reading: gpx.reading || view.reading,
    /** Trace lue, sa première analyse pas encore arrivée : la session est ouverte, pas encore montrée. */
    awaitingAnalysis: view.reading,
    maneuverStats,
    maneuverSummary,
    vmgStats,
    /** Courbe de la VMG, en nœuds par point de la trace ; vide sans vent. */
    vmgSeries,
    windStats,
    polarGraphData,
    // Réglages de l'activité
    sport,
    profile,
    /** Support sur foil de l'activité, réglé dans Réglages ; une session peut avoir le sien. */
    activityFoil,
    /** Pumping de l'activité, réglé dans Réglages ; une session peut avoir le sien. */
    activityPumping,
    /** Matériel enregistré de l'activité, choisi par groupe dans « matos et conditions » ; `null` : option coupée. */
    gearGroups,
    /** Unités d'affichage, choisies dans Réglages pour l'activité. */
    speedUnit,
    distanceUnit,
    activeThresholdKn,
    /** Seuil de l'activité réglé sur cet appareil, `null` sans réglage : pour dire s'il diffère de celui que la session garde. */
    deviceThresholdKn,
    /**
     * Vrai tant que les chiffres n'ont pas rejoint le seuil du champ, le vent saisi, les couleurs ou la trace relue :
     * rien n'en est recopié dans la fiche entre-temps.
     */
    analysisPending: view.pending,
    /** Traits de la trace colorée, faits avec l'analyse montrée ; vides sans elle. */
    mapSegments,
    /** Seuil d'activité réglable : faux en bateau, où toute la session compte en navigation. */
    hasActiveThreshold: withThreshold,
    /** Seuil hors réglage de la session : celui du support s'il est surchargé, sinon la suggestion. */
    defaultActiveThresholdKn,
    /** Bornes du dégradé réglées pour le support dans Réglages, ou `null` pour la suggestion accordée à la session. */
    speedRange,
    /** Bornes de couleur suggérées à partir de l'allure de la session et du pic de vitesse sur 2 s. */
    suggestedSpeedRangeMs,
    /** Allure de la session, en m/s : déduite de la trace, ou imposée. */
    referenceSpeedMs: base.referenceSpeedMs,
    /** Intervalle médian entre deux points, en secondes. */
    samplingS: base.samplingS,
    /** Seuils de manœuvre effectivement retenus, accordés à l'allure de la session. */
    maneuverThresholds,
    /** Nombre de points du fichier, avant tout filtrage. */
    pointCount: base.pointCount,
  };
};
