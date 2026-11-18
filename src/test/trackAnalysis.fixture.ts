import type { Dictionary } from '../core/i18n';
import { kinematicsProfileOf, prepareTrack, type PrepareTrackOptions } from '../core/prepareTrack';
import { defaultActiveThresholdOf, getSportProfile, type SportProfile } from '../core/sportProfiles';
import { effectiveSpeedRange, trackColorSegments } from '../core/trackColor';
import type { SportType } from '../core/types';
import { msToKnots } from '../core/units';
import type { AnalyzeSailingOptions, AnalyzeSurfOptions, SailingAnalysisReply, TrackColorOptions } from '../library/analysisStore';
import { resolveSailingThresholds } from '../sailing/sailingConfig';
import {
  analyzeSailingAtThreshold, analyzeSailingWind, prepareSailingTrack, sailingAnalysisShown, sailingPolarGraph,
} from '../sailing/sailingSession';
import type { WindStats } from '../sailing/sailingAnalytics';
import { runSurfSession, surfProfileOf, type SurfSessionSettings } from '../surfing/surfSession';

/**
 * Analyse d'une session telle que les modules la faisaient sur le fil de l'affichage (`useGpxSession`, `useSailingSession`,
 * `SailingModule`, `SurfModule`) : les mêmes fonctions, dans le même ordre, avec les mêmes arguments. C'est la
 * référence à laquelle les tâches d'analyse du calcul en arrière-plan sont comparées. Fichier de test seulement : le
 * code de l'application ne l'importe pas.
 */

/** Ce que `useGpxSession` passe à `prepareTrack` pour un profil et une allure imposée. */
export const prepareOptionsOf = (profile: SportProfile, fileName: string | null, referenceSpeedOverrideMs?: number): PrepareTrackOptions => ({
  fileName, profile: kinematicsProfileOf(profile), referenceSpeedOverrideMs,
});

/** Couleurs d'une analyse : bornes de la session et de l'activité, ou aucune, puis le défaut du calcul. */
export const colorOptionsOf = (sport: SportType, over: Partial<TrackColorOptions> = {}): TrackColorOptions => ({
  sessionRange: null, activityRange: null, fallback: getSportProfile(sport).speedRange, ...over,
});

/** Seuil des calculs d'une session à voile, résolu comme le hook le résout, sans seuil de session ni d'activité par défaut. */
export const sailingThresholdOf = (gpxText: string, options: PrepareTrackOptions, sport: SportType, sessionKn: number | null = null): number => {
  const prepared = prepareTrack(gpxText, options);
  return resolveSailingThresholds(getSportProfile(sport), null, sessionKn, msToKnots(prepared.referenceSpeedMs)).activeKn;
};

/** Demande d'analyse à voile, profil du calcul, seuil donné. */
export const sailingRequest = (
  key: string, gpxText: string, sport: SportType, over: Partial<Omit<AnalyzeSailingOptions, 'key'>> = {}
): AnalyzeSailingOptions => {
  const profile = getSportProfile(sport);
  const prepare = over.prepare ?? prepareOptionsOf(profile, `${key}.gpx`);
  return {
    key, prepare, sport, profile, thresholdKn: over.thresholdKn ?? sailingThresholdOf(gpxText, prepare, sport), windDeg: null,
    color: colorOptionsOf(sport), ...over,
  };
};

/** Demande d'analyse de surf, seuil par défaut du calcul (de vague, ou de vol sur foil). */
export const surfRequest = (key: string, sport: SportType, over: Partial<Omit<AnalyzeSurfOptions, 'key'>> = {}): AnalyzeSurfOptions => {
  const profile = getSportProfile(sport);
  const foil = over.settings?.foil ?? false;
  const settings: SurfSessionSettings = { threshold: defaultActiveThresholdOf(profile, foil), foil, waveThreshold: null, waveDirectionDeg: null, ...over.settings };
  return { key, prepare: prepareOptionsOf(profile, `${key}.gpx`), profile, color: colorOptionsOf(sport), ...over, settings };
};

/** Variations du vent sans leur fonction, écrites ici sans passer par le code comparé : `windAt` se compare à part. */
const windStatsData = (stats: WindStats | null) => {
  if (!stats) return null;
  const { windAt: _windAt, ...data } = stats;
  return data;
};

/**
 * Ce que la page lira d'une réponse d'analyse à voile : `sailingAnalysisShown` (durées écrites, résumé des manœuvres,
 * fonction du vent rebâtis dans la langue posée), la fonction du vent ôtée pour comparer par `toStrictEqual`.
 */
export const sailingPageView = (reply: SailingAnalysisReply) => {
  const shown = sailingAnalysisShown(reply.analysis);
  return { analysis: { ...shown, windStats: windStatsData(shown.windStats) }, segments: reply.segments };
};

/**
 * Analyse à voile comme la page la fait : `prepareTrack` (`useGpxSession`), puis les étapes de `useSailingSession`,
 * puis les couleurs de `SailingModule`. `view` est ce que la page lit, comparable à `sailingPageView` d'une réponse ;
 * `windAt`, la fonction du vent, à part.
 */
export const directSailing = (gpxText: string, o: AnalyzeSailingOptions) => {
  const gpx = prepareTrack(gpxText, o.prepare);
  const prepared = prepareSailingTrack(gpx.track, { sport: o.sport, profile: o.profile, referenceSpeedMs: gpx.referenceSpeedMs, cumulative: gpx.cumulative });
  const atThreshold = analyzeSailingAtThreshold(prepared, o.thresholdKn);
  const { stats, flights, windEstimate } = atThreshold;
  const wind = analyzeSailingWind(prepared, atThreshold, o.windDeg);
  const { autoWind, currentWindValue, windInputRequired, maneuverStats, maneuverSummary, windStats, vmgStats, vmgSeries } = wind;
  const polarGraphData = sailingPolarGraph(prepared, currentWindValue, maneuverStats?.locations);
  const { suggestedSpeedRangeMs, maneuverThresholds } = prepared;
  const segments = o.color
    ? (() => {
      const colorRange = effectiveSpeedRange({
        sessionRange: o.color.sessionRange, activityRange: o.color.activityRange, suggested: suggestedSpeedRangeMs, fallback: o.color.fallback,
      });
      return trackColorSegments(gpx.track, { minMs: colorRange.minMs, maxMs: colorRange.maxMs });
    })()
    : [];
  return {
    view: {
      analysis: {
        suggestedSpeedRangeMs, maneuverThresholds,
        computeThresholdKn: atThreshold.computeThresholdKn, flightThresholdKn: atThreshold.flightThresholdKn,
        stats, flights, windEstimate, autoWind, currentWindValue, windInputRequired, maneuverStats, maneuverSummary,
        windStats: windStatsData(windStats), vmgStats, vmgSeries, polarGraphData,
      },
      segments,
    },
    windAt: windStats?.windAt ?? null,
    track: gpx.track,
  };
};

/** Analyse de surf comme `SurfModule` la fait : `prepareTrack`, `runSurfSession` sur plus d'un point, puis les couleurs. */
export const directSurf = (gpxText: string, o: AnalyzeSurfOptions) => {
  const { track, cumulative } = prepareTrack(gpxText, o.prepare);
  const surfProfile = surfProfileOf(o.profile);
  const { threshold, foil, waveThreshold, waveDirectionDeg } = o.settings;
  const result = surfProfile && track.length > 1
    ? runSurfSession(track, cumulative, surfProfile, { threshold, foil, waveThreshold, waveDirectionDeg })
    : null;
  const segments = o.color
    ? (() => {
      const range = effectiveSpeedRange({ sessionRange: o.color.sessionRange, activityRange: o.color.activityRange, suggested: null, fallback: o.color.fallback });
      return trackColorSegments(track, { minMs: range.minMs, maxMs: range.maxMs });
    })()
    : [];
  return { analysis: result ? { analysis: result.analysis, summary: result.summary } : null, segments };
};

// Les types de Node ne sont pas ceux de l'app (voir `architecture.test.ts`) : le peu qui sert est décrit à la main.
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync(file: URL, encoding: 'utf8'): string };

/** Le dictionnaire anglais de l'application, tel que `main.tsx` le pose. */
export const englishDictionary = (): Dictionary =>
  JSON.parse(fs.readFileSync(new URL('../locales/en.json', import.meta.url), 'utf8')) as Dictionary;

/** Chemins des nombres qui diffèrent au sens d'`Object.is` (`-0` et `NaN` compris), et des formes qui diffèrent. */
export const numberMismatches = (a: unknown, b: unknown, path = '$'): string[] => {
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b) ? [] : [`${path} : ${String(a)} ≠ ${String(b)}`];
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b ? [] : [`${path} : forme`];
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path} : forme`];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => numberMismatches((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`));
};

/** Chemins des fonctions d'une valeur : ce qu'un message ne peut pas porter. */
export const functionPaths = (value: unknown, path = '$', seen = new Set<unknown>()): string[] => {
  if (typeof value === 'function') return [path];
  if (value === null || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  return Object.entries(value).flatMap(([k, v]) => functionPaths(v, `${path}.${k}`, seen));
};
