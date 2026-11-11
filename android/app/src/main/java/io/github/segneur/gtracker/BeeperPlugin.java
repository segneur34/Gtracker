package io.github.segneur.gtracker;

import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Bips et vibrations : le guidage vers les balises d'un parcours de voile
 * (src/recording/markGuide.ts, src/platform/beeper.ts), et les motifs joués une
 * fois (test de FC repos, « Écouter » de Réglages).
 *
 * Le rythme des balises est tenu ici, sur un fil à lui : écran éteint, les
 * minuteries de la WebView sont bridées, pas celles d'Android, et le service
 * GPS de l'enregistrement garde le processeur éveillé. La couche web ne fait
 * que régler l'intervalle à chaque position reçue. Sons et vibrations :
 * TonePlayer.
 *
 * Veille du GPS de l'enregistrement (lot 115, src/recording/gpsWatch.ts) : la
 * couche web repousse un minuteur à chaque position (`watchGps`) ; s'il
 * échoit, le son « GPS perdu » est joué, les bips d'approche se taisent, puis
 * l'événement `gpsLost` prévient la page, qui pose l'alerte et récrit la
 * notification. Le minuteur est sur un second Handler du même fil, que
 * `stop()` (fin du guidage des balises) ne vide pas. Il n'a pas de verrou de
 * veille à lui : armé après une première position, désarmé en pause manuelle et
 * à l'arrêt, il ne court que service GPS lancé, et le verrou partiel de ce
 * service, sans échéance et tenu GPS muet compris, garde le processeur éveillé
 * (src/platform/nativeConstants.test.ts surveille ce point du greffon).
 */
@CapacitorPlugin(name = "Beeper")
public class BeeperPlugin extends Plugin {

    private static final String TAG = "GtrackerBeeper";

    /** Pause entre les trois bips de fin (comme beeper.ts), en millisecondes. */
    private static final int FINISH_GAP_MS = 250;

    private HandlerThread thread;
    private Handler handler;
    /** Second Handler du fil des bips, pour la veille du GPS : `stop()` ne vide que le premier. */
    private Handler gpsHandler;
    private TonePlayer tones;

    // État du rythme, lu et écrit sur le fil des bips seulement.
    /** Intervalle entre deux bips, en millisecondes ; 0 : silence. */
    private long intervalMs = 0;
    private boolean vibrate = false;
    private long lastBeepAt = 0;

    private final Runnable beep = new Runnable() {
        @Override
        public void run() {
            if (intervalMs <= 0) return;
            tones().playShort(vibrate);
            lastBeepAt = SystemClock.uptimeMillis();
            handler.postDelayed(this, intervalMs);
        }
    };

    /** Échéance de la veille du GPS, sur le fil des bips. */
    private final Runnable gpsLost = new Runnable() {
        @Override
        public void run() {
            silence();
            tones().playGpsLost();
            notifyListeners("gpsLost", new JSObject());
        }
    };

    /**
     * Échéance de la veille de la ceinture (lot 177), sur le fil des bips : les bips d'approche continuent.
     * Écran éteint, le verrou partiel est celui du service GPS.
     */
    private final Runnable beltLost = new Runnable() {
        @Override
        public void run() {
            tones().playBeltLost();
            notifyListeners("beltLost", new JSObject());
        }
    };

    private synchronized Handler handler() {
        if (handler == null) {
            thread = new HandlerThread("GtrackerBeeper");
            thread.start();
            handler = new Handler(thread.getLooper());
        }
        return handler;
    }

    private synchronized Handler gpsHandler() {
        if (gpsHandler == null) gpsHandler = new Handler(handler().getLooper());
        return gpsHandler;
    }

    private TonePlayer tones() {
        if (tones == null) tones = new TonePlayer(getContext());
        return tones;
    }

    // --- Méthodes ---

    @PluginMethod
    public void setInterval(PluginCall call) {
        Integer requested = call.getInt("intervalMs");
        boolean vibrateRequested = Boolean.TRUE.equals(call.getBoolean("vibrate", false));
        long next = requested == null || requested <= 0 ? 0 : requested;
        Handler h = handler();
        h.post(() -> {
            vibrate = vibrateRequested;
            if (next == intervalMs) return;
            intervalMs = next;
            h.removeCallbacks(beep);
            if (next == 0) return;
            // Le bip suivant tombe un intervalle après le précédent ; tout de suite s'il est déjà dépassé.
            h.postDelayed(beep, Math.max(0, lastBeepAt + next - SystemClock.uptimeMillis()));
        });
        call.resolve();
    }

    @PluginMethod
    public void validated(PluginCall call) {
        boolean vibrateRequested = Boolean.TRUE.equals(call.getBoolean("vibrate", false));
        Handler h = handler();
        h.post(() -> {
            silence();
            vibrate = vibrateRequested;
            tones().playLong(vibrate);
            // Le bip suivant attend la fin du bip long.
            lastBeepAt = SystemClock.uptimeMillis() + TonePlayer.LONG_MS;
        });
        call.resolve();
    }

    @PluginMethod
    public void finished(PluginCall call) {
        boolean vibrateRequested = Boolean.TRUE.equals(call.getBoolean("vibrate", false));
        Handler h = handler();
        h.post(() -> {
            silence();
            vibrate = vibrateRequested;
            for (int k = 0; k < 3; k++) {
                h.postDelayed(() -> tones().playLong(vibrate), (long) k * (TonePlayer.LONG_MS + FINISH_GAP_MS));
            }
            lastBeepAt = SystemClock.uptimeMillis() + 3L * TonePlayer.LONG_MS + 2L * FINISH_GAP_MS;
        });
        call.resolve();
    }

    /**
     * Un motif joué une fois, chaque son (court, long) à son délai en
     * millisecondes : « Écouter » de Réglages, test de FC repos. Il
     * ne touche pas au rythme des balises.
     */
    @PluginMethod
    public void pattern(PluginCall call) {
        JSArray list = call.getArray("tones", new JSArray());
        boolean vibrateRequested = Boolean.TRUE.equals(call.getBoolean("vibrate", false));
        try {
            long[] delays = new long[list.length()];
            int[] kinds = new int[list.length()];
            for (int i = 0; i < list.length(); i++) {
                JSONObject tone = list.getJSONObject(i);
                delays[i] = Math.max(0, tone.getLong("delayMs"));
                kinds[i] = TonePlayer.toneKind(tone.optString("tone", "court"));
            }
            Handler h = handler();
            for (int i = 0; i < delays.length; i++) {
                int kind = kinds[i];
                h.postDelayed(() -> {
                    if (kind == TonePlayer.TONE_LONG) tones().playLong(vibrateRequested);
                    else tones().playShort(vibrateRequested);
                }, delays[i]);
            }
            call.resolve();
        } catch (JSONException e) {
            Log.w(TAG, "Motif de sons illisible", e);
            call.reject("Motif de sons illisible.");
        }
    }

    /** Hauteur de tous les bips, en hertz (Réglages). */
    @PluginMethod
    public void setPitch(PluginCall call) {
        Integer hz = call.getInt("hz");
        if (hz == null) {
            call.reject("Hauteur manquante.");
            return;
        }
        TonePlayer.setPitch(getContext(), hz);
        call.resolve();
    }

    /** Vibration seule, sans son ni effet sur le rythme des balises : le bouton « Note ». */
    @PluginMethod
    public void buzz(PluginCall call) {
        int durationMs = Math.max(1, Math.min(1000, call.getInt("durationMs", 80)));
        handler().post(() -> tones().vibrate(durationMs));
        call.resolve();
    }

    /**
     * Veille du GPS : arme, ou repousse, le minuteur à `delayMs`. À
     * l'échéance : son « GPS perdu », bips d'approche coupés, événement
     * `gpsLost`.
     */
    @PluginMethod
    public void watchGps(PluginCall call) {
        long delayMs = Math.max(1000, call.getInt("delayMs", 60_000));
        Handler g = gpsHandler();
        g.removeCallbacks(gpsLost);
        g.postDelayed(gpsLost, delayMs);
        call.resolve();
    }

    /** Désarme la veille du GPS (pause manuelle, arrêt de l'enregistrement). */
    @PluginMethod
    public void unwatchGps(PluginCall call) {
        Handler g = gpsHandler;
        if (g != null) g.removeCallbacks(gpsLost);
        call.resolve();
    }

    /** Veille de la ceinture : arme, ou repousse, le minuteur à `delayMs` ; à l'échéance, son « FC perdue » et événement `beltLost`. */
    @PluginMethod
    public void watchBelt(PluginCall call) {
        long delayMs = Math.max(1000, call.getInt("delayMs", 60_000));
        Handler g = gpsHandler();
        g.removeCallbacks(beltLost);
        g.postDelayed(beltLost, delayMs);
        call.resolve();
    }

    /** Désarme la veille de la ceinture (pause manuelle, fin de l'enregistrement). */
    @PluginMethod
    public void unwatchBelt(PluginCall call) {
        Handler g = gpsHandler;
        if (g != null) g.removeCallbacks(beltLost);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Handler h = handler();
        h.post(() -> {
            silence();
            h.removeCallbacksAndMessages(null);
            if (tones != null) tones.release();
            tones = null;
        });
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (gpsHandler != null) gpsHandler.removeCallbacksAndMessages(null);
        Handler h = handler;
        if (h != null) {
            h.removeCallbacksAndMessages(null);
            h.post(() -> {
                if (tones != null) tones.release();
                tones = null;
            });
            thread.quitSafely();
        }
    }

    private void silence() {
        intervalMs = 0;
        handler.removeCallbacks(beep);
    }
}
