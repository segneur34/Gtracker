import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';
import { pairingDeadline, pairingStatus, type PairingStatus } from '../library/wirelessPhone';
import {
  onWirelessArrival, openWirelessPairing, removeWirelessPhone, setWirelessActive, wirelessAvailable, wirelessPhones, wirelessState,
  type WirelessPairing, type WirelessPhone, type WirelessState,
} from '../platform/wirelessPhone';

/**
 * Le sans-fil du programme Windows, vu du bloc de Réglages › Mémoire : l'état du PC et les téléphones reliés, relus
 * toutes les 5 secondes (chaque seconde pendant qu'une fenêtre de liaison est ouverte) et à chaque arrivée d'un
 * téléphone ; la fenêtre de liaison et son issue ; allumer ou éteindre, retirer un téléphone. Rien d'écrit ici : le
 * PC garde tout.
 */

/** Relecture de l'état, au repos et pendant une fenêtre de liaison. */
const REFRESH_IDLE_MS = 5000;
const REFRESH_PAIRING_MS = 1000;

/** Fenêtre de liaison ouverte par ce bloc. */
export interface PairingView extends WirelessPairing {
  /** Heure de fermeture sur l'horloge de la page. */
  deadlineMs: number;
  /** Heure de l'ouverture : un téléphone relié depuis ce moment conclut la fenêtre. */
  sinceMs: number;
}

export interface WirelessPhonesView {
  /** Faux hors du programme Windows ou dans une coquille sans sans-fil : le bloc ne s'affiche pas. */
  available: boolean;
  state: WirelessState | null;
  phones: WirelessPhone[];
  /** Phrase d'une panne du pont, `null` sinon. */
  error: string | null;
  /** Fenêtre de liaison ouverte par ce bloc (encore ouverte ou conclue : voir `pairingStatus`), `null` sinon. */
  pairing: PairingView | null;
  /** Où en est cette fenêtre ; `null` s'il n'y en a pas. */
  pairingStatus: PairingStatus | null;
  /** Horloge de la page, au dernier relevé (décompte de la fenêtre). */
  nowMs: number;
  /** Un geste est en cours : les boutons sont grisés. */
  busy: boolean;
  setActive(active: boolean): Promise<void>;
  startPairing(): Promise<void>;
  removePhone(id: string): Promise<void>;
}

export function useWirelessPhones(): WirelessPhonesView {
  const [available] = useState(wirelessAvailable);
  const [state, setState] = useState<WirelessState | null>(null);
  const [phones, setPhones] = useState<WirelessPhone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingView | null>(null);
  const [nowMs, setNowMs] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Relit l'état puis les téléphones, dans cet ordre : une fenêtre vue fermée a déjà inscrit le téléphone qui l'a fermée. */
  const read = useCallback(async (): Promise<{ state: WirelessState; phones: WirelessPhone[] }> => {
    const nextState = await wirelessState();
    return { state: nextState, phones: await wirelessPhones() };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await read();
      if (!alive.current) return;
      setState(next.state);
      setPhones(next.phones);
      setError(null);
    } catch (err) {
      if (alive.current) setError(errorMessage(err, t('erreur inconnue')));
    }
    if (alive.current) setNowMs(Date.now());
  }, [read]);

  const status = useMemo<PairingStatus | null>(
    () => (pairing && state ? pairingStatus({ deadlineMs: pairing.deadlineMs, nowMs, open: state.appairage !== null, phones, sinceMs: pairing.sinceMs }) : null),
    [pairing, state, phones, nowMs],
  );
  const waiting = status?.kind === 'waiting';

  useEffect(() => {
    if (!available) return;
    // Premier relevé aussitôt (hors de l'effet lui-même), puis à intervalle.
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), waiting ? REFRESH_PAIRING_MS : REFRESH_IDLE_MS);
    const unsubscribe = onWirelessArrival(() => void refresh());
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      unsubscribe();
    };
  }, [available, waiting, refresh]);

  /** Un geste à la fois ; une panne devient la phrase d'erreur du bloc. */
  const act = useCallback(async (gesture: () => Promise<void>) => {
    setBusy(true);
    try {
      await gesture();
      if (alive.current) setError(null);
    } catch (err) {
      if (alive.current) setError(errorMessage(err, t('erreur inconnue')));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, []);

  const setActive = useCallback((active: boolean) => act(async () => {
    const next = await setWirelessActive(active);
    if (!alive.current) return;
    setState(next);
    if (!active) setPairing(null);
    setPhones(await wirelessPhones());
  }), [act]);

  const startPairing = useCallback(() => act(async () => {
    const sinceMs = Date.now();
    const opened = await openWirelessPairing();
    const next = await read();
    if (!alive.current) return;
    setState(next.state);
    setPhones(next.phones);
    setNowMs(Date.now());
    setPairing({ ...opened, deadlineMs: pairingDeadline(opened, Date.now()), sinceMs });
  }), [act, read]);

  const removePhone = useCallback((id: string) => act(async () => {
    await removeWirelessPhone(id);
    const next = await read();
    if (!alive.current) return;
    setState(next.state);
    setPhones(next.phones);
  }), [act, read]);

  return { available, state, phones, error, pairing, pairingStatus: status, nowMs, busy, setActive, startPairing, removePhone };
}
