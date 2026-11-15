import { describe, expect, it } from 'vitest';
import { FILE_FORMATS, FORMAT_ID } from '../core/appIdentity';
import { MAX_LISTED_FILE_BYTES } from '../library/reconcile';
import { NATIVE_LOG_VERSION, parseNativeLog } from '../recording/nativeLog';

/**
 * Ce que le code Android de l'application suppose des greffons, sans moyen de
 * le lire autrement que dans leur source : une mise à jour qui le changerait
 * casserait la sortie écran éteint sans erreur de compilation.
 *
 * - `RecordingService.java` porte le numéro et le canal de la notification de
 *   l'enregistrement, et `RecordingNotificationPlugin.java` les lit chez lui ;
 *   ce sont ceux du service GPS du greffon, constantes privées, encore en
 *   service : les réglages d'écran verrouillé de l'utilisateur tiennent au canal.
 * - Le journal des positions a deux auteurs : `FixLog.java` l'écrit au
 *   téléphone, `recording/nativeLog.ts` le relit dans la page.
 * - La veille du GPS (`BeeperPlugin.java`) et la capture (`MotionPlugin.java`)
 *   n'ont pas de verrou de veille : elles comptent sur celui du service GPS,
 *   sans échéance, pris au démarrage, que le chien de garde ne rend pas.
 * - `IncomingFilePlugin.java` lit l'intention de départ dans `handleOnNewIntent`, parce que `BridgeActivity` l'y passe
 *   lui-même au démarrage.
 * - La reprise après une chute du moteur de la WebView passe par
 *   `window.Capacitor.fromNative`, qui reçoit les réponses des greffons
 *   (`adoptRunningService`), et compte sur l'appel gardé du greffon.
 */

// Les types de Node ne sont pas ceux de l'app (voir `hooks/mediaQueries.test.ts`) : le peu qui sert est décrit à la main.
interface Fs {
  existsSync(file: URL): boolean;
  readFileSync(file: URL, encoding: 'utf8'): string;
}
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;

/** Source d'un fichier d'un paquet, cherché en remontant les `node_modules` comme le fait Node. */
const packageSource = (path: string): string => {
  for (let dir = new URL('./', import.meta.url); ; dir = new URL('../', dir)) {
    const file = new URL(`node_modules/${path}`, dir);
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    if (new URL('../', dir).href === dir.href) throw new Error(`Introuvable dans node_modules : ${path}`);
  }
};

const appJava = (name: string): string =>
  fs.readFileSync(new URL(`../../android/app/src/main/java/io/github/segneur/gtracker/${name}`, import.meta.url), 'utf8');

const GPS_SERVICE = packageSource(
  '@capgo/background-geolocation/android/src/main/java/com/capgo/capacitor_background_geolocation/BackgroundGeolocationService.java'
);
const MESSAGE_HANDLER = packageSource('@capacitor/android/capacitor/src/main/java/com/getcapacitor/MessageHandler.java');
const RECORDING_NOTIFICATION = appJava('RecordingNotificationPlugin.java');
const GPS_PLUGIN = packageSource(
  '@capgo/background-geolocation/android/src/main/java/com/capgo/capacitor_background_geolocation/BackgroundGeolocation.java'
);
const BRIDGE = packageSource('@capacitor/android/capacitor/src/main/java/com/getcapacitor/Bridge.java');
const BRIDGE_ACTIVITY = packageSource('@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeActivity.java');
const WEBVIEW_LISTENER = packageSource('@capacitor/android/capacitor/src/main/java/com/getcapacitor/WebViewListener.java');
const NATIVE_BRIDGE = packageSource('@capacitor/android/capacitor/src/main/assets/native-bridge.js');
const MAIN_ACTIVITY = appJava('MainActivity.java');
const RECOVERY_PLUGIN = appJava('RecoveryPlugin.java');
const INCOMING_PLUGIN = appJava('IncomingFilePlugin.java');
const RECORDING_SERVICE = appJava('RecordingService.java');
const RECORDING_PLUGIN = appJava('RecordingPlugin.java');
const FIX_LOG = appJava('FixLog.java');
const FIX_LOG_TEST = fs.readFileSync(new URL('../../android/app/src/test/java/io/github/segneur/gtracker/FixLogTest.java', import.meta.url), 'utf8');

/** Première capture de `pattern` dans `text` ; échoue si le source a changé de forme. */
const captured = (text: string, pattern: RegExp): string => {
  const match = pattern.exec(text);
  expect(match, `${pattern} introuvable`).not.toBeNull();
  return match![1];
};

/** Le source compris entre deux repères, le premier compris. */
const between = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  expect(start, `${from} introuvable`).toBeGreaterThanOrEqual(0);
  expect(end, `${to} introuvable`).toBeGreaterThan(start);
  return text.slice(start, end);
};

describe("notification de l'enregistrement : un seul propriétaire, notre service, aux valeurs du greffon", () => {
  it('même numéro que le service GPS du greffon', () => {
    expect(captured(RECORDING_SERVICE, /\bNOTIFICATION_ID = (\d+);/))
      .toBe(captured(GPS_SERVICE, /\bNOTIFICATION_ID = (\d+);/));
  });

  it('même canal : le greffon le nomme de son paquet, pas par un texte', () => {
    expect(GPS_SERVICE).toContain('NOTIFICATION_CHANNEL_ID = BackgroundGeolocationService.class.getPackage().getName();');
    expect(captured(RECORDING_SERVICE, /\bCHANNEL_ID = "([^"]+)";/))
      .toBe(captured(GPS_SERVICE, /^package ([\w.]+);/m));
  });

  it('le greffon qui la récrit lit les deux chez le service, sans les recopier', () => {
    expect(RECORDING_NOTIFICATION).toContain('NOTIFICATION_ID = RecordingService.NOTIFICATION_ID;');
    expect(RECORDING_NOTIFICATION).toContain('CHANNEL_ID = RecordingService.CHANNEL_ID;');
    expect(RECORDING_NOTIFICATION).not.toMatch(/\b(NOTIFICATION_ID = \d|CHANNEL_ID = ")/);
  });

  it("la notification laissée par la garde a son propre numéro : elle survit à l'arrêt du service", () => {
    expect(captured(RECORDING_SERVICE, /\bSTOPPED_NOTIFICATION_ID = (\d+);/)).not.toBe(captured(RECORDING_SERVICE, /\bNOTIFICATION_ID = (\d+);/));
  });

  it("le nom du canal vient des textes du téléphone, dans ses trois langues", () => {
    const name = captured(between(RECORDING_SERVICE, 'static void ensureChannel(', 'static void cancelStoppedNotification('), /R\.string\.(\w+)/);
    for (const values of ['values', 'values-fr', 'values-es']) {
      const strings = fs.readFileSync(new URL(`../../android/app/src/main/res/${values}/strings.xml`, import.meta.url), 'utf8');
      expect(strings, values).toContain(`<string name="${name}">`);
    }
  });
});

describe("service de l'enregistrement", () => {
  it('le greffon est déclaré, sous le nom que la page enregistre', () => {
    expect(MAIN_ACTIVITY).toContain('registerPlugin(RecordingPlugin.class);');
    expect(RECORDING_PLUGIN).toMatch(/@CapacitorPlugin\(\s*name = "Recording",/);
  });

  it("verrou de veille pris au départ, sans échéance, rendu à l'arrêt", () => {
    expect(between(RECORDING_SERVICE, 'private void begin(Settings next)', 'private void end()')).toContain('acquireWakeLock();');
    expect(between(RECORDING_SERVICE, 'private void acquireWakeLock()', 'private void releaseWakeLock()')).toContain('wakeLock.acquire();');
    expect(between(RECORDING_SERVICE, 'private void end()', 'private void onLocation(')).toContain('releaseWakeLock();');
  });

  it('chaque position va au journal avant la page', () => {
    const received = between(RECORDING_SERVICE, 'private void onLocation(', 'private boolean pause(');
    expect(received.indexOf('append(line, now);')).toBeGreaterThanOrEqual(0);
    expect(received.indexOf('append(line, now);')).toBeLessThan(received.indexOf('target.onFix(fix);'));
  });

  it('ni texte ni seuil de la page en dur : rien que la page ne donne au départ', () => {
    for (const name of ['title', 'text', 'closedText', 'gpsLostTitle', 'stoppedTitle', 'stoppedText', 'gpsLostDelayS', 'gpsLostRearmS', 'guardStillRadiusM', 'guardStillDelayS', 'guardMaxClosedS', 'intervalMs', 'distanceFilterM']) {
      expect(RECORDING_PLUGIN, name).toContain(`"${name}"`);
    }
  });

  it('le journal est dans le dossier privé que ni la sauvegarde ni le transfert n\'emportent', () => {
    expect(between(RECORDING_SERVICE, 'static File logFile(', 'static Snapshot snapshot()')).toContain('context.getNoBackupFilesDir()');
  });
});

/** Un texte tel que le source Java l'écrit entre guillemets. */
const javaLiteral = (text: string): string => `"${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

describe('journal des positions : ce que le Java écrit, la page le relit', () => {
  it('même nom de format et même version', () => {
    expect(captured(FIX_LOG, /\bFORMAT = "([^"]+)";/)).toBe(FILE_FORMATS.positions);
    expect(captured(FIX_LOG, /\bVERSION = (\d+);/)).toBe(String(NATIVE_LOG_VERSION));
  });

  it('mêmes raisons d\'arrêt par la garde', () => {
    expect(captured(FIX_LOG, /\bSTOP_STILL = "([^"]+)";/)).toBe('still');
    expect(captured(FIX_LOG, /\bSTOP_TIMEOUT = "([^"]+)";/)).toBe('timeout');
  });

  // Chaque ligne ci-dessous est attendue telle quelle par `FixLogTest.java`, qui la compare à ce que `FixLog` écrit.
  const HEADER = '{"format":"gtracker-positions","version":1,"session":1794819600000}\n';
  const LINES = [
    '[1794819601000,48.123456789,-4.5,3.9,12.25,5.14,271.5]\n',
    '[1000,48.0,-4.0,null,null,null,null]\n',
    '[1,1.0E-5,0.0,1.0E10,-0.0,1.0E-4,0.0]\n',
    '["pause",1794819700000]\n',
    '["resume",1794819760000]\n',
    '\n["start",1794819800000]\n',
    '["stop",1794819900000,"still"]\n',
    '["stop",1794819900000,"timeout"]\n',
  ];

  it('les lignes relues ici sont bien celles que le test Java attend de FixLog', () => {
    for (const line of [HEADER, ...LINES]) expect(FIX_LOG_TEST, line).toContain(javaLiteral(line));
  });

  it('la page relit chacune : en-tête, positions brutes, valeurs absentes, exposants, ordres, relance, arrêt', () => {
    const log = parseNativeLog(HEADER + LINES.join(''));
    expect(log?.session).toBe(1794819600000);
    expect(log?.entries).toEqual([
      { kind: 'fix', fix: { timeMs: 1794819601000, lat: 48.123456789, lon: -4.5, accuracyM: 3.9, altitudeM: 12.25, speedMs: 5.14, bearingDeg: 271.5 } },
      { kind: 'fix', fix: { timeMs: 1000, lat: 48, lon: -4, accuracyM: undefined, altitudeM: undefined, speedMs: undefined, bearingDeg: undefined } },
      { kind: 'fix', fix: { timeMs: 1, lat: 0.00001, lon: 0, accuracyM: 1e10, altitudeM: -0, speedMs: 0.0001, bearingDeg: 0 } },
      { kind: 'pause', atMs: 1794819700000 },
      { kind: 'resume', atMs: 1794819760000 },
      { kind: 'start', atMs: 1794819800000 },
      { kind: 'stop', atMs: 1794819900000, reason: 'still' },
      { kind: 'stop', atMs: 1794819900000, reason: 'timeout' },
    ]);
  });
});

describe('verrou de veille du service GPS, seul à tenir le processeur pendant une sortie', () => {
  it('pris au démarrage du service', () => {
    expect(between(GPS_SERVICE, 'void start(', 'void updateHeaders(')).toContain('acquireWakeLock();');
  });

  it("sans échéance : il dure ce que dure le service, et le chien de garde des 60 s ne le rend pas", () => {
    expect(between(GPS_SERVICE, 'private void acquireWakeLock()', 'private void releaseWakeLock()')).toContain('wakeLock.acquire();');
    expect(between(GPS_SERVICE, 'private void restartLocationUpdates()', 'private void stopWatchdog()')).not.toContain('releaseWakeLock');
  });
});

describe('pont de Capacitor', () => {
  it('les réponses des greffons entrent dans la page par window.Capacitor.fromNative', () => {
    expect(MESSAGE_HANDLER).toContain('window.Capacitor.fromNative(');
    expect(NATIVE_BRIDGE).toContain('cap.fromNative = (result) =>');
  });

  it("seule voie, sur l'ancien pont : le nouveau passerait par un autre chemin, sans fromNative", () => {
    const config = fs.readFileSync(new URL('../../capacitor.config.ts', import.meta.url), 'utf8');
    expect(config).toContain('useLegacyBridge: true');
    expect(between(MESSAGE_HANDLER, 'sendResponseMessage(', 'private void legacySendResponseMessage')).toContain('isUsingLegacyBridge()');
  });

  it('un message dit son greffon, sa méthode, et si son appel reste gardé', () => {
    const response = between(MESSAGE_HANDLER, 'sendResponseMessage(', 'private void legacySendResponseMessage');
    expect(response).toContain('data.put("save", call.isKeptAlive());');
    expect(response).toContain('data.put("pluginId", call.getPluginId());');
    expect(response).toContain('data.put("methodName", call.getMethodName());');
    expect(GPS_PLUGIN).toContain('name = "BackgroundGeolocation"');
  });
});

describe('chute du moteur de rendu', () => {
  it("l'appel gardé du greffon survit à la recharge : `start` le garde, et une position le répond", () => {
    expect(between(GPS_PLUGIN, 'public void start(final PluginCall call)', 'private void proceedWithStart')).toContain('watchCall = call;');
    expect(between(GPS_PLUGIN, 'public void onLocation(', 'public void onGeofenceTransition(')).toContain('call.resolve(formatLocation(location));');
  });

  it("recréer l'activité arrête le service GPS : c'est pourquoi la page se recharge sur la même WebView", () => {
    expect(between(GPS_PLUGIN, 'protected void handleOnDestroy()', 'super.handleOnDestroy();')).toContain('BackgroundGeolocationService.LocalBinder::stop');
    expect(BRIDGE).toContain('private final WebView webView;');
  });

  it('le service GPS ne redémarre pas seul hors du mode natif : le voir vivant prouve le processus', () => {
    expect(GPS_SERVICE).toContain('return START_NOT_STICKY;');
  });

  it("écouteur posé sur les signatures de Capacitor, avant le démarrage du pont", () => {
    expect(BRIDGE).toContain('public Builder addWebViewListener(WebViewListener webViewListener)');
    expect(BRIDGE).toContain('public void reload()');
    expect(BRIDGE_ACTIVITY).toContain('protected final Bridge.Builder bridgeBuilder');
    expect(BRIDGE_ACTIVITY).toContain('protected Bridge bridge;');
    expect(WEBVIEW_LISTENER).toContain('public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail)');
    expect(WEBVIEW_LISTENER).toContain('public void onPageLoaded(WebView webView)');
    expect(MAIN_ACTIVITY.indexOf('bridgeBuilder.addWebViewListener(')).toBeGreaterThanOrEqual(0);
    expect(MAIN_ACTIVITY.indexOf('bridgeBuilder.addWebViewListener(')).toBeLessThan(MAIN_ACTIVITY.indexOf('super.onCreate(savedInstanceState);'));
  });

  it('le greffon de la preuve est déclaré, et nomme le service tel que le greffon GPS le déclare', () => {
    expect(MAIN_ACTIVITY).toContain('registerPlugin(RecoveryPlugin.class);');
    const named = captured(RECOVERY_PLUGIN, /\bGPS_SERVICE = "([^"]+)";/);
    expect(named).toBe(`${captured(GPS_SERVICE, /^package ([\w.]+);/m)}.BackgroundGeolocationService`);
    expect(GPS_SERVICE).toContain('class BackgroundGeolocationService extends Service');
  });

  it("onPageLoaded ne fait que retirer l'échéance, deux appels ne comptent pas deux fois", () => {
    const loaded = between(MAIN_ACTIVITY, 'public void onPageLoaded(WebView webView)', 'super.onCreate(savedInstanceState);');
    expect(loaded).toContain('main.removeCallbacks(pageLoadMissed);');
    expect(loaded).not.toContain('RENDER_RELOADS');
  });
});

describe('fichiers reçus d\'une autre application', () => {
  it('Capacitor passe l\'intention de départ à onNewIntent, une fois le pont créé, et relaie vers les greffons', () => {
    const load = between(BRIDGE_ACTIVITY, 'protected void load()', 'public void registerPlugin(');
    expect(load.indexOf('this.onNewIntent(getIntent());')).toBeGreaterThan(load.indexOf('bridge = bridgeBuilder'));
    expect(between(BRIDGE, 'public void onNewIntent(Intent intent)', 'public void onConfigurationChanged')).toContain('plugin.getInstance().handleOnNewIntent(intent);');
  });

  it('le greffon est déclaré, et oublie l\'intention d\'une activité restaurée avant que le pont la lise', () => {
    expect(MAIN_ACTIVITY).toContain('registerPlugin(IncomingFilePlugin.class);');
    expect(MAIN_ACTIVITY.indexOf('IncomingFilePlugin.forgetReplayedFile(this, savedInstanceState);')).toBeGreaterThanOrEqual(0);
    expect(MAIN_ACTIVITY.indexOf('IncomingFilePlugin.forgetReplayedFile(this, savedInstanceState);')).toBeLessThan(MAIN_ACTIVITY.indexOf('super.onCreate(savedInstanceState);'));
  });

  it('même plafond qu\'au listage de la mémoire', () => {
    expect(captured(INCOMING_PLUGIN, /\bMAX_BYTES = (\d+L \* 1024 \* 1024);/)).toBe(`${MAX_LISTED_FILE_BYTES / (1024 * 1024)}L * 1024 * 1024`);
  });

  it('les motifs de refus sont ceux que la page connaît', () => {
    expect(captured(INCOMING_PLUGIN, /\bREFUSED_FORMAT = "([^"]+)";/)).toBe('format');
    expect(captured(INCOMING_PLUGIN, /\bREFUSED_TOO_LARGE = "([^"]+)";/)).toBe('trop-gros');
    expect(captured(INCOMING_PLUGIN, /\bREFUSED_UNREADABLE = "([^"]+)";/)).toBe('illisible');
  });

  it('un partage sans fichier a le refus « ni GPX ni FIT » : rien à rouvrir ; une intention mal formée reste « illisible »', () => {
    expect(between(INCOMING_PLUGIN, 'protected void handleOnNewIntent(Intent intent)', 'private static File directory'))
      .toContain('carriesNoFile(intent) ? REFUSED_FORMAT : REFUSED_UNREADABLE');
    expect(between(INCOMING_PLUGIN, 'private static boolean carriesNoFile', 'protected void handleOnNewIntent'))
      .toMatch(/addressIn\(intent\) == null;[\s\S]*catch \(RuntimeException e\)[\s\S]*return false;/);
  });

  it('la copie ne passe ni par le fil de l\'interface ni par celui des greffons : une tâche à elle, gardée contre une chute', () => {
    const entry = between(INCOMING_PLUGIN, 'protected void handleOnNewIntent(Intent intent)', 'private static File directory');
    expect(entry).toContain('runOnWorker(() -> {');
    expect(entry.indexOf('receive(context, uri, refusalWithoutFile);')).toBeGreaterThan(entry.indexOf('runOnWorker(() -> {'));
    expect(between(INCOMING_PLUGIN, 'private static void runOnWorker', 'public void load()')).toContain('catch (Exception | OutOfMemoryError e)');
  });
});

/**
 * Noms techniques écrits en dur dans le Java, qui ne peut pas importer `core/appIdentity.ts` : ils portent le nom
 * technique de l'application comme ceux du TypeScript.
 */
describe('noms techniques du Java', () => {
  it('fichiers temporaires du dossier mémoire', () => {
    const memory = appJava('MemoryFolderPlugin.java');
    expect(captured(memory, /\bTEMP_SUFFIX = "([^"]+)";/)).toBe(`.${FORMAT_ID}-tmp`);
    expect(captured(memory, /\bNEW_SUFFIX = "([^"]+)";/)).toBe(`.${FORMAT_ID}-new`);
  });

  it('préférences des bips', () => {
    expect(captured(appJava('TonePlayer.java'), /\bPREFS = "([^"]+)";/)).toBe(`${FORMAT_ID}.sons`);
  });
});
