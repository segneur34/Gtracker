import { useEffect, useRef, useState } from 'react';
import type { SpeedRangeMs } from '../core/speedGradient';
import { effectiveSpeedRange } from '../core/trackColor';
import type { TrackColorOptions } from '../library/analysisStore';
import { createLatestRequest } from '../library/latestRequest';
import { runInWorker } from '../library/trackWorkerClient';
import { sameFile, type AnalysisSource, type GpxAnalysisInput } from './useGpxSession';

/**
 * Analyse de la session ouverte, faite par le calcul en arrière-plan (`analyzeSailing`, `analyzeSurf`), rendue avec la
 * trace sur laquelle elle a été faite : jamais l'analyse d'une session sur la trace d'une autre, dont les indices
 * déborderaient. Tant qu'une trace neuve n'a pas sa première analyse, rien n'est montré (« Lecture de la session… ») ;
 * ensuite, pendant un recalcul (seuil, vent saisi, couleurs, trace relue), les derniers chiffres restent affichés et
 * l'analyse est dite en attente : rien n'en est recopié dans la fiche. La dernière demande gagne (`latestRequest.ts`) ;
 * quitter la page abandonne le calcul et vide sa mémoire (`release`).
 */

/** Une analyse et la trace sur laquelle elle a été faite, inséparables. */
export interface AnalysisPair<T> {
  source: AnalysisSource;
  /** Entrées de l'analyse mises en texte : seuil, vent, profil, couleurs… */
  inputs: string;
  result: T;
}

/** Ce que la page montre de l'analyse. */
export interface AnalysisView<T> {
  /** Analyse montrée et sa trace ; `null` : aucune (rien de lu, ou une trace neuve dont la première analyse n'est pas arrivée). */
  pair: AnalysisPair<T> | null;
  /** Une trace neuve attend sa première analyse : « Lecture de la session… ». */
  reading: boolean;
  /** L'analyse montrée n'est pas celle de la trace et des entrées demandées : rien n'en est recopié dans la fiche. */
  pending: boolean;
}

/**
 * La trace à analyser : celle affichée, sauf si la page attend un autre fichier (`expectedFile`, session demandée par
 * l'adresse) ; ses entrées (le brouillon de la session demandée) ne valent pas pour la trace d'une autre.
 */
export const analysisTarget = (source: AnalysisSource | null, expectedFile: string | null): AnalysisSource | null =>
  source !== null && (expectedFile === null || source.from.fileName === expectedFile) ? source : null;

/**
 * Ce que la page montre, d'après la dernière analyse reçue et la trace demandée. Une analyse d'un autre fichier n'est
 * jamais montrée, ni une trace autre que celle du fichier attendu (`expectedFile`, `null` : n'importe lequel) ; une
 * analyse du même fichier l'est, en attente si sa trace (relue pour une autre allure ou un autre support) ou ses
 * entrées ne sont plus celles demandées, ou si la lecture de la trace n'est pas à jour (`settled`). Le fichier attendu
 * dont l'ouverture a échoué (`expectedFailed` : absent de la mémoire, illisible) n'est plus en lecture : rien n'est
 * montré, ni la trace d'une autre session.
 */
export const analysisView = <T>(
  pair: AnalysisPair<T> | null, source: AnalysisSource | null, inputs: string, settled = true, expectedFile: string | null = null,
  expectedFailed = false
): AnalysisView<T> => {
  if (source === null) return { pair: null, reading: false, pending: false };
  if (analysisTarget(source, expectedFile) === null) return { pair: null, reading: !expectedFailed, pending: true };
  const shown = pair !== null && sameFile(pair.source.from, source.from) ? pair : null;
  return {
    pair: shown,
    reading: shown === null,
    pending: shown === null || shown.source.prepared !== source.prepared || shown.inputs !== inputs || !settled,
  };
};

/**
 * Bornes effectives des traits colorés d'une analyse, en texte : les bornes ordonnées comme le calcul les
 * ordonne (`effectiveSpeedRange`), avec la suggestion de l'analyse reçue ; sans couleurs, un texte vide.
 */
export const colorKeyOf = (color: TrackColorOptions | null, suggested: SpeedRangeMs | null): string => {
  if (!color) return '';
  const { minMs, maxMs } = effectiveSpeedRange({
    sessionRange: color.sessionRange, activityRange: color.activityRange, suggested, fallback: color.fallback,
  });
  return JSON.stringify([minMs, maxMs]);
};

/**
 * Traits de la trace colorée gardés tels quels tant que leur trace et leurs bornes (`colorKeyOf`) ne changent pas : ce
 * sont alors les mêmes traits, mais chaque réponse du calcul en apporte une copie, que la carte redessinerait sinon à
 * chaque seuil ou vent touché.
 */
export const useKeptSegments = <S>(segments: S, track: object, colorKey: string): S => {
  const [kept, setKept] = useState({ segments, track, colorKey });
  if (kept.track === track && kept.colorKey === colorKey) return kept.segments;
  setKept({ segments, track, colorKey });
  return segments;
};

/** Demandes d'analyse d'une page : la dernière gagne, et quitter vide la mémoire du calcul. */
export interface TrackAnalysisRequests<T> {
  /** Lance un calcul ; rend sa paire s'il est resté la dernière demande à son retour, `null` s'il a été dépassé. */
  request(source: AnalysisSource, inputs: string, compute: () => Promise<T>): Promise<AnalysisPair<T> | null>;
  /** Page quittée : demandes en cours dépassées, mémoire de la session `key` vidée dans le calcul. */
  leave(key: string): Promise<void>;
}

export const createTrackAnalysisRequests = <T>(): TrackAnalysisRequests<T> => {
  const latest = createLatestRequest((compute: () => Promise<T>) => compute());
  return {
    request: (source, inputs, compute) =>
      latest.run(compute).then((outcome) => (outcome.current ? { source, inputs, result: outcome.value } : null)),
    leave: (key) => {
      latest.cancel();
      return runInWorker('release', '', { key }).then(() => undefined);
    },
  };
};

/**
 * Analyse de la trace affichée par `useGpxSession` (`gpx.analysis`) : `compute` la demande au calcul pour une trace ;
 * `inputs` met en texte tout ce dont elle dépend hors de la trace, un autre texte la redemande. `expectedFile` : fichier
 * de la session demandée, dont les entrées viennent ; la trace d'un autre n'est ni analysée ni montrée ; `expectedFailed` :
 * son ouverture a échoué, plus rien n'est en lecture. Une erreur du calcul remonte au rendu, comme quand l'analyse se
 * faisait sur le fil de l'affichage.
 */
export const useTrackAnalysis = <T>(
  gpx: GpxAnalysisInput, inputs: string, compute: (source: AnalysisSource) => Promise<T>, expectedFile: string | null = null,
  expectedFailed = false
): AnalysisView<T> => {
  const { key, settled } = gpx;
  const source = analysisTarget(gpx.source, expectedFile);
  const [requests] = useState(() => createTrackAnalysisRequests<T>());
  const [pair, setPair] = useState<AnalysisPair<T> | null>(null);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  // Le calcul du dernier rendu : ses options sont celles que `inputs` décrit.
  const computeRef = useRef(compute);
  useEffect(() => {
    computeRef.current = compute;
  });

  useEffect(() => {
    if (source === null) return;
    let alive = true;
    const run = computeRef.current;
    requests.request(source, inputs, () => run(source)).then(
      (reply) => {
        if (alive && reply) setPair(reply);
      },
      (error: unknown) => {
        if (alive) setFailure({ error });
      }
    );
    return () => {
      alive = false;
    };
  }, [requests, source, inputs]);

  useEffect(() => () => {
    void requests.leave(key);
  }, [requests, key]);

  if (failure) throw failure.error;
  return analysisView(pair, gpx.source, inputs, settled, expectedFile, expectedFailed);
};
