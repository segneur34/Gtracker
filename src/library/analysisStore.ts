import { prepareTrack, type PreparedTrack, type PrepareTrackOptions } from '../core/prepareTrack';
import type { SpeedRangeMs } from '../core/speedGradient';
import type { SportProfile, Treatment } from '../core/sportProfiles';
import { effectiveSpeedRange, trackColorSegments, type ColoredSegment } from '../core/trackColor';
import type { SportType } from '../core/types';
import { runSailingAnalysis, sailingAnalysisResult, type SailingAnalysisResult, type SailingAnalysisStages } from '../sailing/sailingSession';
import { runSurfSession, surfProfileOf, type SurfSessionResult, type SurfSessionSettings } from '../surfing/surfSession';

/**
 * Mémoire de l'analyse ouverte, dans le calcul en arrière-plan (ou en ligne, sur le fil de l'affichage, quand il n'y a
 * pas de worker) : une seule session à la fois, désignée par une clé que donne la page. Elle garde la trace préparée,
 * la préparation voile tant que calcul, profil et trace ne changent pas, le dernier résultat au seuil tant que le seuil
 * ne change pas (un vent seul changé ne refait que les manœuvres, la VMG et la polaire), et les dernières couleurs de la
 * trace. La préparation voile porte des fonctions (détection des virages, étage polaire du vent) : elle ne traverse pas
 * un message, d'où cette mémoire sur place.
 *
 * Clé absente ou trace d'une autre source (calcul recréé, repli en ligne, autre session ouverte), la trace est refaite
 * par `prepareTrack`, avec les options données : mêmes fonctions, mêmes arguments, mêmes chiffres. Aucun seuil n'est
 * résolu ici : la page passe un seuil déjà accordé à l'allure de la session (règle 4).
 */

/** Ce que prennent les couleurs de la trace (`trackColorSegments`) : traitement et bornes, avant leur ordre de priorité. */
export interface TrackColorOptions {
  treatment: Treatment;
  /** Bornes de la session (brouillon, puis fiche) ; `null` : aucune. */
  sessionRange: SpeedRangeMs | null;
  /** Bornes de l'activité, réglées ou pré-réglées ; `null` : aucune. */
  activityRange: SpeedRangeMs | null;
  /** Bornes par défaut de l'activité ou du calcul. */
  fallback: SpeedRangeMs;
}

/** La session visée : sa clé, et les options de lecture de sa trace (`prepareTrack`), celles de la tâche `prepare`. */
interface AnalysisTarget {
  key: string;
  prepare: PrepareTrackOptions;
}

/** Une analyse à voile demandée : calcul, profil, seuil des calculs déjà résolu, vent saisi, couleurs. */
export interface AnalyzeSailingOptions extends AnalysisTarget {
  sport: SportType;
  profile: SportProfile;
  /** Seuil des calculs, en nœuds, déjà résolu et accordé à l'allure (`resolveSailingThresholds`). */
  thresholdKn: number;
  /** Vent saisi, en degrés ; `null` : vent estimé. */
  windDeg: number | null;
  /** Couleurs de la trace ; `null` : pas de traits. */
  color: TrackColorOptions | null;
}

/** Une analyse de surf demandée : profil, réglages de la session (`runSurfSession`), couleurs. */
export interface AnalyzeSurfOptions extends AnalysisTarget {
  profile: SportProfile;
  settings: SurfSessionSettings;
  color: TrackColorOptions | null;
}

/** Réponse d'une analyse à voile : ses chiffres et les traits de la trace colorée (vides sans couleurs demandées). */
export interface SailingAnalysisReply {
  analysis: SailingAnalysisResult;
  segments: ColoredSegment[];
}

/** Ce qu'une analyse de surf rend à la page : ses vagues et son résumé, sans le masque de glisse qu'elle ne lit pas. */
export type SurfAnalysisShown = Pick<SurfSessionResult, 'analysis' | 'summary'>;

/** Réponse d'une analyse de surf ; `analysis` à `null` pour un calcul sans profil de surf ou une trace de moins de deux points. */
export interface SurfAnalysisReply {
  analysis: SurfAnalysisShown | null;
  segments: ColoredSegment[];
}

/** Calculs faits par la mémoire, par étape : ce qu'elle évite se lit là. */
export interface AnalysisWork {
  prepareTrack: number;
  prepareSailing: number;
  atThreshold: number;
  wind: number;
  surf: number;
  colors: number;
}

interface SailingMemory {
  /** Calcul et profil de la préparation. */
  sig: string;
  stages: SailingAnalysisStages;
  thresholdKn: number;
  windDeg: number | null;
}

interface SurfMemory {
  /** Profil du calcul. */
  sig: string;
  settings: SurfSessionSettings;
  result: SurfAnalysisShown | null;
}

interface ColorMemory {
  treatment: Treatment;
  minMs: number;
  maxMs: number;
  segments: ColoredSegment[];
}

interface Memory {
  key: string;
  gpxText: string;
  /** Options de lecture de la trace, mises en texte (`prepareSignature`). */
  prepareSig: string;
  track: PreparedTrack;
  sailing: SailingMemory | null;
  surf: SurfMemory | null;
  colors: ColorMemory | null;
}

/** Options de lecture en texte, champ par champ : deux objets aux mêmes valeurs, dans un autre ordre, donnent le même texte. */
const prepareSignature = ({ fileName, profile, referenceSpeedOverrideMs }: PrepareTrackOptions): string =>
  JSON.stringify([
    fileName ?? null,
    profile ? [profile.id, profile.medianWindowSeconds, profile.maxDetourRatio, profile.maxPlausibleSpeedMs, profile.maxGapS] : null,
    referenceSpeedOverrideMs ?? null,
  ]);

const sameSurfSettings = (a: SurfSessionSettings, b: SurfSessionSettings): boolean =>
  Object.is(a.threshold, b.threshold) && a.foil === b.foil && Object.is(a.waveThreshold, b.waveThreshold);

export interface AnalysisStore {
  /** Garde la trace que la tâche `prepare` vient de lire, sous la clé de la page : elle remplace toute la mémoire. */
  keepTrack(key: string, gpxText: string, prepare: PrepareTrackOptions, track: PreparedTrack): void;
  analyzeSailing(gpxText: string, options: AnalyzeSailingOptions): SailingAnalysisReply;
  analyzeSurf(gpxText: string, options: AnalyzeSurfOptions): SurfAnalysisReply;
  /** Vide la mémoire si elle tient cette clé : une page quittée ne libère pas la session d'une page ouverte depuis. */
  release(key: string): void;
  /** Clé de la session en mémoire, `null` : aucune. */
  readonly key: string | null;
  readonly work: Readonly<AnalysisWork>;
}

export const createAnalysisStore = (): AnalysisStore => {
  let memory: Memory | null = null;
  const work: AnalysisWork = { prepareTrack: 0, prepareSailing: 0, atThreshold: 0, wind: 0, surf: 0, colors: 0 };

  const keepTrack = (key: string, gpxText: string, prepare: PrepareTrackOptions, track: PreparedTrack): Memory => {
    memory = { key, gpxText, prepareSig: prepareSignature(prepare), track, sailing: null, surf: null, colors: null };
    return memory;
  };

  /** La mémoire de la session visée, sa trace refaite si la clé, le texte ou les options de lecture ont changé. */
  const memoryFor = (gpxText: string, { key, prepare }: AnalysisTarget): Memory => {
    if (memory && memory.key === key && memory.gpxText === gpxText && memory.prepareSig === prepareSignature(prepare)) return memory;
    work.prepareTrack += 1;
    return keepTrack(key, gpxText, prepare, prepareTrack(gpxText, prepare));
  };

  /** Traits de la trace colorée, aux bornes effectives (`effectiveSpeedRange`), comme les modules les dessinent. */
  const colorsFor = (target: Memory, color: TrackColorOptions | null, suggested: SpeedRangeMs | null): ColoredSegment[] => {
    if (!color) return [];
    const { minMs, maxMs } = effectiveSpeedRange({
      sessionRange: color.sessionRange, activityRange: color.activityRange, suggested, fallback: color.fallback,
    });
    const kept = target.colors;
    if (kept && kept.treatment === color.treatment && Object.is(kept.minMs, minMs) && Object.is(kept.maxMs, maxMs)) return kept.segments;
    work.colors += 1;
    const segments = trackColorSegments(target.track.track, color.treatment, { minMs, maxMs });
    target.colors = { treatment: color.treatment, minMs, maxMs, segments };
    return segments;
  };

  const analyzeSailing = (gpxText: string, options: AnalyzeSailingOptions): SailingAnalysisReply => {
    const target = memoryFor(gpxText, options);
    const { sport, profile, thresholdKn, windDeg } = options;
    const sig = JSON.stringify([sport, profile]);
    const kept = target.sailing?.sig === sig ? target.sailing : null;
    // Une étape n'est reprise qu'avec celles dont elle découle, et si ses propres entrées n'ont pas bougé.
    const reuse: Partial<SailingAnalysisStages> = {};
    if (kept) {
      reuse.prepared = kept.stages.prepared;
      if (Object.is(kept.thresholdKn, thresholdKn)) {
        reuse.atThreshold = kept.stages.atThreshold;
        if (Object.is(kept.windDeg, windDeg)) {
          reuse.wind = kept.stages.wind;
          reuse.polarGraphData = kept.stages.polarGraphData;
        }
      }
    }
    if (!reuse.prepared) work.prepareSailing += 1;
    if (!reuse.atThreshold) work.atThreshold += 1;
    if (!reuse.wind) work.wind += 1;
    const { track, referenceSpeedMs, cumulative } = target.track;
    const stages = runSailingAnalysis(track, { sport, profile, referenceSpeedMs, cumulative }, thresholdKn, windDeg, reuse);
    target.sailing = { sig, stages, thresholdKn, windDeg };
    return { analysis: sailingAnalysisResult(stages), segments: colorsFor(target, options.color, stages.prepared.suggestedSpeedRangeMs) };
  };

  const analyzeSurf = (gpxText: string, options: AnalyzeSurfOptions): SurfAnalysisReply => {
    const target = memoryFor(gpxText, options);
    const { profile, settings } = options;
    const sig = JSON.stringify(profile);
    let kept = target.surf;
    if (!kept || kept.sig !== sig || !sameSurfSettings(kept.settings, settings)) {
      work.surf += 1;
      const surfProfile = surfProfileOf(profile);
      const { track, cumulative } = target.track;
      const result = surfProfile && track.length > 1
        ? runSurfSession(track, cumulative, surfProfile, { threshold: settings.threshold, foil: settings.foil, waveThreshold: settings.waveThreshold })
        : null;
      kept = { sig, settings: { ...settings }, result: result ? { analysis: result.analysis, summary: result.summary } : null };
      target.surf = kept;
    }
    return { analysis: kept.result, segments: colorsFor(target, options.color, null) };
  };

  return {
    keepTrack: (key, gpxText, prepare, track) => {
      keepTrack(key, gpxText, prepare, track);
    },
    analyzeSailing,
    analyzeSurf,
    release: (key) => {
      if (memory?.key === key) memory = null;
    },
    get key() {
      return memory?.key ?? null;
    },
    work,
  };
};
