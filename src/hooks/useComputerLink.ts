import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';
import {
  EXCHANGE_SCREEN_ON_MS, exchangeScreenOnUntil, linkSettled, refusalText, shouldAutoConnect, shownLinkStatus,
} from '../library/computerLink';
import { pairWithComputer } from '../library/computerPairing';
import {
  ComputerLinkRefused, computerLink, linkFolderOf, type ComputerLinkPort, type ComputerLinkStatus, type LinkFolder,
} from '../platform/computerLink';
import { deviceFolderLocation } from '../platform/memoryFolder';
import { onAppResume } from '../platform/permissions';
import { isForeground, keepScreenOn } from '../platform/screen';
import { isRecordingActive, useRecorderStatus } from './useRecorder';
import { useLibraryFields } from './useSessionLibrary';

/**
 * La liaison sans fil avec le programme Windows, côté téléphone (`platform/computerLink.ts`). Deux usages :
 * - `useComputerLinkLauncher`, monté une fois pour toute l'application, tente la liaison toute seule à l'ouverture, au
 *   retour au premier plan, quand le dossier mémoire devient accessible et à intervalle régulier tant que Gtracker est
 *   affiché, sans rien afficher ; il garde l'écran allumé pendant un échange avec l'ordinateur ;
 * - `useComputerLink`, pour le bloc « Ordinateur » de Réglages › Connexion, seul endroit où l'état se dit.
 * Rien n'est tenté pendant un enregistrement. Le greffon garde seul le jumelage, et ferme la liaison quand
 * l'application quitte l'écran.
 */

/** Tentatives en cours de la page : la liaison automatique n'en lance pas une de plus par-dessus. */
let running = 0;

const tracked = async <T,>(job: () => Promise<T>): Promise<T> => {
  running++;
  try {
    return await job();
  } finally {
    running--;
  }
};

/**
 * Relie le téléphone à l'ordinateur connu si la règle (`shouldAutoConnect`) le permet : l'état est relu au dernier
 * moment, le réseau ayant pu changer depuis. Sans effet hors du téléphone, avec une tentative déjà en cours et pendant
 * un enregistrement. Une panne se note en console seulement : la page n'en dit rien hors de Réglages. `folder` : le
 * dossier désigné ; `base` : le sous-dossier où est la mémoire, vide si c'est lui-même. La recherche qu'elle lance
 * ne se voit pas non plus dans le bloc de Réglages (`shownLinkStatus`).
 */
export const autoConnect = async (folder: string, base = ''): Promise<void> => {
  const link = computerLink();
  if (link === null || running > 0 || isRecordingActive()) return;
  await tracked(async () => {
    try {
      const status = await link.status();
      if (!shouldAutoConnect({ status, hasFolder: true, recording: isRecordingActive() })) return;
      await link.connect({ folder, base });
    } catch (err) {
      console.warn('Liaison avec l\'ordinateur : tentative automatique en échec', err);
    }
  });
};

/** Le dossier mémoire désigné, tel que la liaison le lit ; relu quand la mémoire change d'état. */
export const useLinkFolder = (): LinkFolder => {
  const { status, folderKind } = useLibraryFields('status', 'folderKind');
  return useMemo<LinkFolder>(
    // Dossier mémoire inaccessible ou autre que celui du téléphone : rien à lire pour l'ordinateur.
    () => (status === 'ready' && folderKind === 'device' ? linkFolderOf(deviceFolderLocation()) : { state: 'none' }),
    [status, folderKind],
  );
};

/**
 * Écart entre deux tentatives tant que Gtracker est affiché : le téléphone resté à l'écran après une coupure du réseau,
 * ou allumé avant l'ordinateur, se relie de lui-même sans attendre un retour au premier plan.
 */
export const RELINK_INTERVAL_MS = 20_000;

/**
 * Tente la liaison tout de suite, à chaque retour au premier plan, puis toutes les `RELINK_INTERVAL_MS` tant que
 * Gtracker est à l'écran ; rend l'arrêt. Chaque tentative passe par `autoConnect` et ses gardes (jamais pendant un
 * enregistrement, ni par-dessus une autre tentative). Déjà relié, une tentative ne fait que redonner le dossier.
 */
export const keepLinking = (folder: string, base = ''): (() => void) => {
  void autoConnect(folder, base);
  const stopResume = onAppResume(() => void autoConnect(folder, base));
  const timer = setInterval(() => {
    if (isForeground()) void autoConnect(folder, base);
  }, RELINK_INTERVAL_MS);
  return () => {
    stopResume();
    clearInterval(timer);
  };
};

/**
 * Garde l'écran allumé pendant un échange avec l'ordinateur (`exchangeScreenOnUntil`) : la liaison se ferme quand
 * l'écran s'éteint, ce qui arrêterait une synchronisation en route. L'écran est demandé pour la raison
 * `computerLink` seulement : celui que tient l'enregistreur n'est jamais rendu ici. Rend l'arrêt, qui le rend.
 */
export const holdScreenDuringExchange = (link: ComputerLinkPort): (() => void) => {
  let live = true;
  let heard = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const apply = (status: ComputerLinkStatus): void => {
    if (!live) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const until = exchangeScreenOnUntil(status);
    // Borné à la durée prévue : une horloge du téléphone remise en arrière ne garde pas l'écran plus longtemps.
    const left = until === null ? 0 : Math.min(until - Date.now(), EXCHANGE_SCREEN_ON_MS);
    keepScreenOn(left > 0, 'computerLink');
    if (left > 0) {
      timer = setTimeout(() => {
        timer = null;
        keepScreenOn(false, 'computerLink');
      }, left);
    }
  };
  const stopStatus = link.onStatus((status) => {
    heard = true;
    apply(status);
  });
  // L'état lu à l'ouverture ne remplace pas un événement plus récent arrivé entre-temps.
  void link.status().then((status) => {
    if (!heard) apply(status);
  }).catch((err: unknown) => console.warn('Liaison avec l\'ordinateur : état illisible', err));
  return () => {
    live = false;
    stopStatus();
    if (timer !== null) clearTimeout(timer);
    keepScreenOn(false, 'computerLink');
  };
};

/**
 * À monter une fois, dans l'application : tente la liaison à l'ouverture, à chaque retour au premier plan et à
 * intervalle régulier tant que Gtracker est affiché (`keepLinking`) ; garde l'écran allumé pendant un échange.
 */
export function useComputerLinkLauncher(): void {
  const folder = useLinkFolder();
  const uri = folder.state === 'ok' ? folder.uri : null;
  const base = folder.state === 'ok' ? folder.base : '';
  useEffect(() => {
    if (uri === null) return;
    return keepLinking(uri, base);
  }, [uri, base]);
  useEffect(() => {
    const link = computerLink();
    if (link === null) return;
    return holdScreenDuringExchange(link);
  }, []);
}

/** Relecture du temps écoulé depuis la dernière synchronisation (« il y a 2 min »). */
const CLOCK_MS = 30_000;

export interface ComputerLinkView {
  /** Faux hors du téléphone : le bloc ne s'affiche pas. */
  available: boolean;
  /** `null` tant que le greffon n'a pas répondu. */
  status: ComputerLinkStatus | null;
  folder: LinkFolder;
  /** Un enregistrement est en cours : rien n'est tenté. */
  recording: boolean;
  /** Horloge de la page, pour le temps écoulé. */
  nowMs: number;
  /** Un geste du bloc est en cours : ses boutons sont grisés. */
  busy: boolean;
  /** Phrase du dernier geste refusé ou en panne, `null` sinon. */
  problem: string | null;
  /** Appaire à l'ordinateur dont le code est affiché ; sans adresse, il est cherché sur le réseau. */
  pair(code: string, address: string): Promise<void>;
  /** Relance la recherche de l'ordinateur connu, avec l'adresse tapée s'il y en a une. */
  search(address: string): Promise<void>;
  /** Oublie l'ordinateur. */
  forget(): Promise<void>;
}

export function useComputerLink(): ComputerLinkView {
  const link = computerLink();
  const folder = useLinkFolder();
  const recording = useRecorderStatus() !== 'idle';
  /** L'état du greffon, et le dernier qui n'était pas une tentative en cours (`shownLinkStatus`). */
  const [seen, setSeen] = useState<{ status: ComputerLinkStatus; settled: ComputerLinkStatus | null } | null>(null);
  const setStatus = useCallback((next: ComputerLinkStatus) => {
    setSeen((prev) => ({ status: next, settled: linkSettled(next) ? next : (prev?.settled ?? null) }));
  }, []);
  const [nowMs, setNowMs] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (link === null) return;
    let live = true;
    const refresh = () => {
      void link.status().then((next) => {
        if (live) {
          setStatus(next);
          setNowMs(Date.now());
        }
      }).catch((err: unknown) => console.warn('Liaison avec l\'ordinateur : état illisible', err));
    };
    refresh();
    const stopStatus = link.onStatus((next) => {
      if (live) setStatus(next);
    });
    const stopResume = onAppResume(refresh);
    const clock = setInterval(() => setNowMs(Date.now()), CLOCK_MS);
    return () => {
      live = false;
      stopStatus();
      stopResume();
      clearInterval(clock);
    };
  }, [link, setStatus]);

  /** Un geste à la fois ; un refus ou une panne devient la phrase du bloc. */
  const act = useCallback(async (gesture: () => Promise<ComputerLinkStatus>) => {
    setBusy(true);
    setProblem(null);
    try {
      const next = await tracked(gesture);
      if (alive.current) {
        setStatus(next);
        setNowMs(Date.now());
      }
    } catch (err) {
      if (alive.current) {
        setProblem(err instanceof ComputerLinkRefused
          ? refusalText(err.refusal)
          : t("La liaison avec l'ordinateur a échoué : {why}.", { why: errorMessage(err, t('erreur inconnue')) }));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [setStatus]);

  const uri = folder.state === 'ok' ? folder.uri : null;
  const base = folder.state === 'ok' ? folder.base : '';
  const ready = link !== null && uri !== null && !recording;

  const pair = useCallback(async (code: string, address: string) => {
    if (!ready) return;
    await act(() => pairWithComputer(link, { code, address: address.trim() || undefined, folder: uri, base }));
  }, [act, link, ready, uri, base]);

  const search = useCallback(async (address: string) => {
    if (!ready) return;
    await act(() => link.connect({ address: address.trim() || undefined, folder: uri, base }));
  }, [act, link, ready, uri, base]);

  const forget = useCallback(async () => {
    if (link === null) return;
    await act(() => link.forget());
  }, [act, link]);

  const status = seen === null ? null : shownLinkStatus(seen.status, seen.settled, busy);
  return { available: link !== null, status, folder, recording, nowMs, busy, problem, pair, search, forget };
}
