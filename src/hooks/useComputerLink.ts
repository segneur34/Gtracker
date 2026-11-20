import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';
import { refusalText, shouldAutoConnect } from '../library/computerLink';
import { ComputerLinkRefused, computerLink, linkFolderOf, type ComputerLinkStatus, type LinkFolder } from '../platform/computerLink';
import { deviceFolderLocation } from '../platform/memoryFolder';
import { onAppResume } from '../platform/permissions';
import { isRecordingActive, useRecorderStatus } from './useRecorder';
import { useLibraryFields } from './useSessionLibrary';

/**
 * La liaison sans fil avec le programme Windows, côté téléphone (`platform/computerLink.ts`). Deux usages :
 * - `useComputerLinkLauncher`, monté une fois pour toute l'application, tente la liaison toute seule à l'ouverture, au
 *   retour au premier plan et quand le dossier mémoire devient accessible, sans rien afficher ;
 * - `useComputerLink`, pour le bloc « Ordinateur » de Réglages › Mémoire, seul endroit où l'état se dit.
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
 * un enregistrement. Une panne se note en console seulement : la page n'en dit rien hors de Réglages.
 */
export const autoConnect = async (folder: string): Promise<void> => {
  const link = computerLink();
  if (link === null || running > 0 || isRecordingActive()) return;
  await tracked(async () => {
    try {
      const status = await link.status();
      if (!shouldAutoConnect({ status, hasFolder: true, recording: isRecordingActive() })) return;
      await link.connect({ folder });
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

/** À monter une fois, dans l'application : tente la liaison à l'ouverture et à chaque retour au premier plan. */
export function useComputerLinkLauncher(): void {
  const folder = useLinkFolder();
  const uri = folder.state === 'ok' ? folder.uri : null;
  useEffect(() => {
    if (uri === null) return;
    void autoConnect(uri);
    return onAppResume(() => void autoConnect(uri));
  }, [uri]);
}

/** Relecture du temps écoulé depuis le dernier envoi (« il y a 2 min »). */
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
  const [status, setStatus] = useState<ComputerLinkStatus | null>(null);
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
  }, [link]);

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
  }, []);

  const uri = folder.state === 'ok' ? folder.uri : null;
  const ready = link !== null && uri !== null && !recording;

  const pair = useCallback(async (code: string, address: string) => {
    if (!ready) return;
    await act(() => link.pair({ code, address: address.trim() || undefined, folder: uri }));
  }, [act, link, ready, uri]);

  const search = useCallback(async (address: string) => {
    if (!ready) return;
    await act(() => link.connect({ address: address.trim() || undefined, folder: uri }));
  }, [act, link, ready, uri]);

  const forget = useCallback(async () => {
    if (link === null) return;
    await act(() => link.forget());
  }, [act, link]);

  return { available: link !== null, status, folder, recording, nowMs, busy, problem, pair, search, forget };
}
