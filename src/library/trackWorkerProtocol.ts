import { prepareTrack, type PreparedTrack, type PrepareTrackOptions } from '../core/prepareTrack';
import type { SportFamily } from '../core/sportProfiles';
import type { SportType } from '../core/types';
import {
  createAnalysisStore,
  type AnalyzeSailingOptions,
  type AnalyzeSurfOptions,
  type SailingAnalysisReply,
  type SurfAnalysisReply,
} from './analysisStore';
import { isRouteGpx } from '../planning/routeImport';
import { fitToGpx, type FitConversion } from './fitToGpx';
import { sessionColorTrack, type SessionColorTrack } from './sessionTrack';
import { summarizeGpx, type SummarizeGpxOptions } from './summarizeGpx';
import type { AnalyzedGpx } from './summaryOptions';

/**
 * Messages entre l'application et le worker des traces : lire un GPX et préparer sa trace pour
 * l'analyse (`prepare`), le résumer pour sa fiche (`summarize`), ou tirer sa trace colorée pour une vignette ou une
 * image partagée (`colorTrack`) ; analyser la session ouverte, à voile (`analyzeSailing`) ou de surf (`analyzeSurf`),
 * et oublier sa mémoire quand la page la quitte (`release`) ; convertir un fichier de montre en GPX (`convertFit`) ;
 * dire si le GPX d'un fichier reçu est un itinéraire (`routeCheck`).
 * Le worker et le calcul en ligne passent par le même
 * aiguillage (`runTrackJob`) : mêmes chiffres par construction.
 */

/**
 * Mémoire de la session ouverte (`analysisStore.ts`) : dans le worker, celle du worker ; en ligne, celle du fil de
 * l'affichage. Un worker recréé, ou une demande refaite en ligne, la trouve vide : la tâche relit alors la trace.
 */
const analysisMemory = createAnalysisStore();

/** Clé de la session gardée dans la mémoire de ce fil, `null` : aucune (tests du client). */
export const analysisMemoryKey = (): string | null => analysisMemory.key;

/** Options de `prepare` : celles de `prepareTrack`, et la clé sous laquelle garder la trace pour l'analyse qui suit. */
export interface PrepareJobOptions extends PrepareTrackOptions {
  /** Clé de la session donnée par la page : la trace lue est gardée pour `analyzeSailing` et `analyzeSurf`. Absente : rien n'est gardé. */
  analysisKey?: string;
}

/** Options de `release` : la clé de la session quittée. */
export interface ReleaseOptions {
  key: string;
}

/** Ce que prend la trace colorée d'une session (`sessionColorTrack`) : son calcul, son allure imposée, sa famille. */
export interface ColorTrackOptions {
  sport: SportType | null;
  referenceOverrideMs: number | null;
  family: SportFamily;
}

/** Options de `convertFit` : le contenu du fichier de montre, copié vers le worker. */
export interface ConvertFitOptions {
  bytes: Uint8Array;
}

/** Ce que prend et rend chaque calcul. */
export interface TrackJobs {
  prepare: { options: PrepareJobOptions; result: PreparedTrack };
  summarize: { options: SummarizeGpxOptions; result: AnalyzedGpx | null };
  colorTrack: { options: ColorTrackOptions; result: SessionColorTrack | null };
  analyzeSailing: { options: AnalyzeSailingOptions; result: SailingAnalysisReply };
  analyzeSurf: { options: AnalyzeSurfOptions; result: SurfAnalysisReply };
  /** Le texte du GPX n'y sert pas : une chaîne vide. */
  release: { options: ReleaseOptions; result: null };
  /** Le texte du GPX n'y sert pas : une chaîne vide ; le FIT est dans les options. */
  convertFit: { options: ConvertFitOptions; result: FitConversion };
  /** Le GPX d'un fichier reçu est-il un itinéraire (`isRouteGpx`) ? Aucune option. */
  routeCheck: { options: Record<string, never>; result: boolean };
}

export type TrackJobKind = keyof TrackJobs;

export type TrackRequest = {
  [K in TrackJobKind]: { id: number; kind: K; gpxText: string; options: TrackJobs[K]['options'] };
}[TrackJobKind];

/** Erreur d'un calcul, rendue par son nom et son message : une `Error` ne garde que cela d'un clonage à l'autre. */
export interface TrackJobError {
  name: string;
  message: string;
}

export type TrackResponse =
  | { id: number; result: TrackJobs[TrackJobKind]['result'] }
  | { id: number; error: TrackJobError };

/** Le calcul demandé, sur le fil où il est appelé. */
export const runTrackJob = <K extends TrackJobKind>(kind: K, gpxText: string, options: TrackJobs[K]['options']): TrackJobs[K]['result'] => {
  // Chaque branche rend le type de son calcul ; TypeScript ne relie pas `kind` au type rendu.
  if (kind === 'prepare') {
    const { analysisKey, ...prepare } = options as PrepareJobOptions;
    const prepared = prepareTrack(gpxText, prepare);
    if (analysisKey !== undefined) analysisMemory.keepTrack(analysisKey, gpxText, prepare, prepared);
    return prepared as TrackJobs[K]['result'];
  }
  if (kind === 'analyzeSailing') return analysisMemory.analyzeSailing(gpxText, options as AnalyzeSailingOptions) as TrackJobs[K]['result'];
  if (kind === 'analyzeSurf') return analysisMemory.analyzeSurf(gpxText, options as AnalyzeSurfOptions) as TrackJobs[K]['result'];
  if (kind === 'release') {
    analysisMemory.release((options as ReleaseOptions).key);
    return null as TrackJobs[K]['result'];
  }
  if (kind === 'colorTrack') {
    const { sport, referenceOverrideMs, family } = options as ColorTrackOptions;
    return sessionColorTrack(gpxText, sport, referenceOverrideMs, family) as TrackJobs[K]['result'];
  }
  if (kind === 'convertFit') return fitToGpx((options as ConvertFitOptions).bytes) as TrackJobs[K]['result'];
  if (kind === 'routeCheck') return isRouteGpx(gpxText) as TrackJobs[K]['result'];
  return summarizeGpx(gpxText, options as SummarizeGpxOptions) as TrackJobs[K]['result'];
};

/** Erreur d'un calcul, en nom et message ; une valeur levée qui n'est pas une `Error` devient son texte. */
const jobErrorOf = (err: unknown): TrackJobError =>
  err instanceof Error ? { name: err.name, message: err.message } : { name: 'Error', message: String(err) };

/** `Error` refaite d'une erreur rendue par le worker : même nom, même message que celle levée en ligne. */
export const errorFromJob = ({ name, message }: TrackJobError): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

/** Réponse du worker à une demande : le résultat, ou l'erreur levée par le calcul, jamais une exception. */
export const handleTrackRequest = (request: TrackRequest): TrackResponse => {
  try {
    return { id: request.id, result: runTrackJob(request.kind, request.gpxText, request.options) };
  } catch (err) {
    return { id: request.id, error: jobErrorOf(err) };
  }
};
