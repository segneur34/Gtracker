import { registerPlugin } from '@capacitor/core';
import {
  BELT_LOST_NOTES, BELT_LOST_TOTAL_MS, BEEP_FINISH_GAP_MS, BEEP_LONG_MS, BEEP_SHORT_MS, GPS_LOST_GAP_MS, GPS_LOST_HIGH_MS, GPS_LOST_LOW_MS, GPS_LOST_NOTES, GPS_LOST_TOTAL_MS, TONE_MS,
  type ToneKind,
} from '../core/beepDurations';
import { isNativeApp } from './runtime';

/**
 * Bips et vibrations : seul accès au son et au vibreur (règle 12). Quatre
 * usages : le guidage vers les balises (`getBeeper`), un motif joué une fois
 * (`playPattern` : zone visée, test de FC repos, « Écouter » de Réglages), le
 * retour du bouton « Note » (`buzz`) et la veille du GPS et de la ceinture de
 * l'enregistrement (`armGpsWatch`, lot 115). La hauteur de tous les sons se
 * règle d'un coup (`setBeepPitch`, 24/10).
 *
 * Sur le téléphone, un greffon Android tient le rythme sur un fil à lui :
 * écran éteint, les minuteries de la WebView sont bridées (point 40), pas
 * celles d'Android. Pour les balises, le service GPS de l'enregistrement
 * garde le processeur éveillé. Le son passe par le flux des alarmes : audible
 * téléphone en silencieux, au volume des alarmes. Dans le navigateur, Web
 * Audio et `navigator.vibrate` le remplacent, pour éprouver l'un et l'autre
 * au banc ; chaque son y est consigné en `console.debug` (« [bips] … »).
 */

export interface Beeper {
  /**
   * Bips répétés toutes les `intervalMs` ; `null` : silence. Le rythme
   * change dès le bip suivant ; un intervalle plus court que le temps déjà
   * écoulé depuis le dernier bip en déclenche un tout de suite.
   */
  setInterval(intervalMs: number | null, vibrate: boolean): Promise<void>;
  /** Bip long : une balise vient d'être validée. Les bips répétés s'arrêtent. */
  validated(vibrate: boolean): Promise<void>;
  /** Trois bips longs : le parcours est fini. Les bips répétés s'arrêtent. */
  finished(vibrate: boolean): Promise<void>;
  /** Silence, ressources libérées. */
  stop(): Promise<void>;
}

/** Un son d'un motif, après `delayMs` : bref, court, long, ou le long double. */
export interface PatternTone {
  delayMs: number;
  tone: ToneKind;
}

/** Greffon maison, `android/app/src/main/java/io/github/segneur/gtracker/BeeperPlugin.java`. */
interface BeeperPlugin {
  setInterval(options: { intervalMs: number | null; vibrate: boolean }): Promise<void>;
  validated(options: { vibrate: boolean }): Promise<void>;
  finished(options: { vibrate: boolean }): Promise<void>;
  stop(): Promise<void>;
  buzz(options: { durationMs: number }): Promise<void>;
  pattern(options: { tones: PatternTone[]; vibrate: boolean }): Promise<void>;
  setPitch(options: { hz: number }): Promise<void>;
  watchGps(options: { delayMs: number }): Promise<void>;
  unwatchGps(): Promise<void>;
  watchBelt(options: { delayMs: number }): Promise<void>;
  unwatchBelt(): Promise<void>;
  addListener(event: 'gpsLost' | 'beltLost', listener: () => void): Promise<{ remove: () => Promise<void> }>;
}

const nativePlugin = registerPlugin<BeeperPlugin>('Beeper');

const nativeBeeper: Beeper = {
  setInterval: (intervalMs, vibrate) => nativePlugin.setInterval({ intervalMs, vibrate }),
  validated: (vibrate) => nativePlugin.validated({ vibrate }),
  finished: (vibrate) => nativePlugin.finished({ vibrate }),
  stop: () => nativePlugin.stop(),
};

/** Hauteur des bips du navigateur, en hertz : celle choisie dans Réglages, reçue par `setBeepPitch`. */
let browserHz = 2000;

/** Contexte audio du navigateur, partagé par les bips. */
let browserAudio: AudioContext | null = null;

/** Une note du navigateur, à `hz`, dans `atMs` millisecondes, sans journal. */
const browserNote = (durationMs: number, hz: number, atMs = 0) => {
  try {
    browserAudio ??= new AudioContext();
    const start = browserAudio.currentTime + atMs / 1000;
    const oscillator = browserAudio.createOscillator();
    const gain = browserAudio.createGain();
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.setValueAtTime(0, start + durationMs / 1000);
    oscillator.connect(gain).connect(browserAudio.destination);
    oscillator.start(start);
    oscillator.stop(start + durationMs / 1000 + 0.05);
  } catch {
    // Pas de son dans ce navigateur : le journal suffit au banc.
  }
};

/** Un son du navigateur, consigné pour le banc. */
const browserTone = (durationMs: number, vibrate: boolean, label: string) => {
  console.debug(`[bips] ${label} ${durationMs} ms à ${Date.now()}`);
  if (vibrate && typeof navigator.vibrate === 'function') navigator.vibrate(durationMs);
  browserNote(durationMs, browserHz);
};

const createBrowserBeeper = (): Beeper => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Les trois bips de la fin, annulés par `stop()`. */
  let finishTimers: ReturnType<typeof setTimeout>[] = [];
  let intervalMs: number | null = null;
  let vibrateOn = false;
  let lastBeepMs = -Infinity;

  const tone = browserTone;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const loop = () => {
    if (intervalMs === null) return;
    tone(BEEP_SHORT_MS, vibrateOn, 'court');
    lastBeepMs = Date.now();
    timer = setTimeout(loop, intervalMs);
  };

  return {
    setInterval: async (next, vibrate) => {
      vibrateOn = vibrate;
      if (next === intervalMs) return;
      intervalMs = next;
      clear();
      if (next === null) return;
      timer = setTimeout(loop, Math.max(0, lastBeepMs + next - Date.now()));
    },
    validated: async (vibrate) => {
      intervalMs = null;
      clear();
      tone(BEEP_LONG_MS, vibrate, 'long');
      // Le bip suivant attend la fin du bip long.
      lastBeepMs = Date.now() + BEEP_LONG_MS;
    },
    finished: async (vibrate) => {
      intervalMs = null;
      clear();
      for (let k = 0; k < 3; k++) {
        const at = k * (BEEP_LONG_MS + BEEP_FINISH_GAP_MS);
        finishTimers.push(setTimeout(() => tone(BEEP_LONG_MS, vibrate, 'fin'), at));
      }
      lastBeepMs = Date.now() + 3 * BEEP_LONG_MS + 2 * BEEP_FINISH_GAP_MS;
    },
    stop: async () => {
      intervalMs = null;
      clear();
      finishTimers.forEach(clearTimeout);
      finishTimers = [];
      await browserAudio?.close().catch(() => {});
      browserAudio = null;
    },
  };
};

/**
 * Un motif joué une fois, chaque son à son délai : ne touche pas au rythme des
 * balises. Sur le téléphone, joué sur le fil des
 * bips, écran éteint compris tant qu'un service garde le processeur éveillé.
 */
export const playPattern = (tones: PatternTone[], vibrate: boolean): Promise<void> => {
  if (isNativeApp()) return nativePlugin.pattern({ tones, vibrate });
  for (const t of tones) {
    const play = () => browserTone(TONE_MS[t.tone], vibrate, t.tone);
    if (t.delayMs > 0) setTimeout(play, t.delayMs);
    else play();
  }
  return Promise.resolve();
};

/** Hauteur de tous les sons, en hertz (Réglages) ; le téléphone la garde pour ses services. */
export const setBeepPitch = (hz: number): Promise<void> => {
  if (isNativeApp()) return nativePlugin.setPitch({ hz });
  browserHz = hz;
  return Promise.resolve();
};

/** Vibration brève, sans son : n'interrompt pas les bips des balises. */
export const buzz = (durationMs: number): Promise<void> => {
  if (isNativeApp()) return nativePlugin.buzz({ durationMs });
  console.debug(`[bips] vibreur ${durationMs} ms à ${Date.now()}`);
  if (typeof navigator.vibrate === 'function') navigator.vibrate(durationMs);
  return Promise.resolve();
};

let beeper: Beeper | null = null;

/** Bips du téléphone, ou du navigateur. */
export const getBeeper = (): Beeper => {
  beeper ??= isNativeApp() ? nativeBeeper : createBrowserBeeper();
  return beeper;
};

// --- Veille du GPS de l'enregistrement (lot 115) ---

/** Minuteur de la veille dans le navigateur ; `null` désarmé. */
let gpsTimer: ReturnType<typeof setTimeout> | null = null;
/** Abonnés à l'échéance, dans le navigateur. */
const gpsLostListeners = new Set<() => void>();

/** Son « GPS perdu » du navigateur : deux notes descendantes, deux fois, avec vibration ; consigné une fois. */
const playBrowserGpsLost = () => {
  console.debug(`[bips] gps perdu ${GPS_LOST_TOTAL_MS} ms à ${Date.now()}`);
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    const on = GPS_LOST_HIGH_MS + GPS_LOST_LOW_MS;
    navigator.vibrate([on, GPS_LOST_GAP_MS, on]);
  }
  for (const note of GPS_LOST_NOTES) browserNote(note.durationMs, browserHz * note.ratio, note.atMs);
};

/**
 * Arme, ou repousse, la veille du GPS : sans nouvel appel dans `delayMs`, le
 * son « GPS perdu » est joué (avec vibration), les bips d'approche des
 * balises se taisent, puis les abonnés de `onGpsLost` sont prévenus. Sur le
 * téléphone, le minuteur est natif (`BeeperPlugin.watchGps`) : il échoit à
 * l'heure écran éteint, où ceux de la WebView ralentissent.
 */
export const armGpsWatch = (delayMs: number): Promise<void> => {
  if (isNativeApp()) return nativePlugin.watchGps({ delayMs });
  if (gpsTimer !== null) clearTimeout(gpsTimer);
  gpsTimer = setTimeout(() => {
    gpsTimer = null;
    playBrowserGpsLost();
    gpsLostListeners.forEach((listener) => listener());
  }, delayMs);
  return Promise.resolve();
};

/** Désarme la veille du GPS. */
export const disarmGpsWatch = (): Promise<void> => {
  if (isNativeApp()) return nativePlugin.unwatchGps();
  if (gpsTimer !== null) clearTimeout(gpsTimer);
  gpsTimer = null;
  return Promise.resolve();
};

/** Échéance de la veille du GPS (le son est déjà parti) ; rend le désabonnement. */
export const onGpsLost = (listener: () => void): (() => void) => {
  if (!isNativeApp()) {
    gpsLostListeners.add(listener);
    return () => gpsLostListeners.delete(listener);
  }
  let removed = false;
  let remove: (() => void) | null = null;
  void nativePlugin.addListener('gpsLost', listener).then((handle) => {
    if (removed) void handle.remove();
    else remove = () => void handle.remove();
  }).catch(() => {});
  return () => {
    removed = true;
    remove?.();
  };
};

// --- Veille de la ceinture de l'enregistrement (lot 177) ---

/** Minuteur de la veille de la ceinture dans le navigateur ; `null` désarmé. */
let beltTimer: ReturnType<typeof setTimeout> | null = null;
/** Abonnés à l'échéance, dans le navigateur. */
const beltLostListeners = new Set<() => void>();

/** Son « FC perdue » du navigateur : trois notes descendantes, avec vibration ; consigné une fois. */
const playBrowserBeltLost = () => {
  console.debug(`[bips] fc perdue ${BELT_LOST_TOTAL_MS} ms à ${Date.now()}`);
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(BELT_LOST_TOTAL_MS);
  for (const note of BELT_LOST_NOTES) browserNote(note.durationMs, browserHz * note.ratio, note.atMs);
};

/**
 * Arme, ou repousse, la veille de la ceinture : sans nouvel appel dans
 * `delayMs`, le son « FC perdue » est joué (avec vibration), puis les abonnés de
 * `onBeltLost` sont prévenus. Sur le téléphone, le minuteur est natif
 * (`BeeperPlugin.watchBelt`), comme celui du GPS. Les bips d'approche des
 * balises, eux, continuent : ils ne dépendent pas de la ceinture.
 */
export const armBeltWatch = (delayMs: number): Promise<void> => {
  if (isNativeApp()) return nativePlugin.watchBelt({ delayMs });
  if (beltTimer !== null) clearTimeout(beltTimer);
  beltTimer = setTimeout(() => {
    beltTimer = null;
    playBrowserBeltLost();
    beltLostListeners.forEach((listener) => listener());
  }, delayMs);
  return Promise.resolve();
};

/** Désarme la veille de la ceinture. */
export const disarmBeltWatch = (): Promise<void> => {
  if (isNativeApp()) return nativePlugin.unwatchBelt();
  if (beltTimer !== null) clearTimeout(beltTimer);
  beltTimer = null;
  return Promise.resolve();
};

/** Échéance de la veille de la ceinture (le son est déjà parti) ; rend le désabonnement. */
export const onBeltLost = (listener: () => void): (() => void) => {
  if (!isNativeApp()) {
    beltLostListeners.add(listener);
    return () => beltLostListeners.delete(listener);
  }
  let removed = false;
  let remove: (() => void) | null = null;
  void nativePlugin.addListener('beltLost', listener).then((handle) => {
    if (removed) void handle.remove();
    else remove = () => void handle.remove();
  }).catch(() => {});
  return () => {
    removed = true;
    remove?.();
  };
};
