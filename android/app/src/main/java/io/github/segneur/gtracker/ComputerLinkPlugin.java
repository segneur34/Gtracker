package io.github.segneur.gtracker;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import io.github.segneur.gtracker.ComputerLinkProtocol.Endpoint;
import io.github.segneur.gtracker.ComputerLinkProtocol.Frame;
import io.github.segneur.gtracker.ComputerLinkProtocol.FrameDecoder;
import io.github.segneur.gtracker.ComputerLinkProtocol.FrameException;
import io.github.segneur.gtracker.ComputerLinkProtocol.Incoming;
import io.github.segneur.gtracker.ComputerLinkProtocol.ProbeAnswer;
import io.github.segneur.gtracker.ComputerLinkProtocol.RemoteFile;
import java.io.BufferedOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.SSLException;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509ExtendedTrustManager;
import org.json.JSONObject;

/**
 * Liaison sans fil avec le programme Windows (format : ComputerLinkProtocol, et les en-têtes de bureau/trames.ts,
 * appairage.ts et sonde.ts). Le PC écoute, le téléphone se connecte, puis répond aux commandes du PC (`lister`,
 * `lire`, `ping`) en lisant le dossier mémoire désigné, sans jamais rien y écrire.
 *
 * - Réseaux : tout réseau local du téléphone à adresse IPv4 privée, sans condition sur le réseau actif : le Wi-Fi
 *   (point d'accès du PC compris) comme le point d'accès du téléphone, quand il partage sa connexion et que le PC
 *   en est client. Jamais le réseau mobile, un tunnel ou un VPN, jamais une adresse publique.
 * - Découverte : l'adresse donnée par la page si elle en donne une ; sinon la dernière adresse connue (1 s), si
 *   elle est sur un réseau local présent, puis une question en diffusion UDP sur chaque réseau local (3 s).
 * - TLS à empreinte fixée : aucune chaîne de confiance ; à l'appairage, l'empreinte reçue entre dans les preuves du
 *   code ; ensuite, tout certificat d'une autre empreinte est refusé avant le moindre message.
 * - Appairage par le code affiché sur le PC : le téléphone prouve le premier, puis vérifie la preuve du PC avant de
 *   rien garder. Jeton, empreinte, identifiant et nom du PC, dernière adresse : dans les préférences privées de ce
 *   greffon (exclues de toute sauvegarde), jamais rendus à la page. Un seul PC connu.
 * - Tout le réseau tourne hors du fil principal : un fil pour les tentatives, un fil par liaison pour les commandes,
 *   un fil pour les fermetures. Aucun service, aucune tâche de fond : la liaison se ferme quand l'application n'est
 *   plus à l'écran, et la page la rouvre au retour.
 *
 * Pour la page : `status()`, `pair({ code, address?, folder?, base? })`, `connect({ address?, folder?, base? })`,
 * `forget()`, qui rendent toutes l'état (`statusObject`), et l'événement `status`, du même contenu, à chaque
 * changement. `folder` est l'adresse SAF du dossier désigné, `base` le sous-dossier où est la mémoire (« Gtracker »),
 * absent ou vide quand c'est le dossier désigné lui-même.
 */
@CapacitorPlugin(
    name = "ComputerLink",
    permissions = { @Permission(alias = ComputerLinkPlugin.LOCAL_NETWORK, strings = { ComputerLinkPlugin.ACCESS_LOCAL_NETWORK }) }
)
public class ComputerLinkPlugin extends Plugin {

    private static final String TAG = "GtrackerLiaison";

    static final String LOCAL_NETWORK = "localNetwork";
    /** Accès au réseau local, demandé à l'utilisateur à partir d'Android 17 (API 37) seulement. */
    static final String ACCESS_LOCAL_NETWORK = "android.permission.ACCESS_LOCAL_NETWORK";
    private static final int LOCAL_NETWORK_SDK = 37;

    static final String EVENT_STATUS = "status";

    /** Préférences privées du greffon : rien d'autre ne les lit. */
    static final String PREFS = "gtracker.ordinateur";
    private static final String KEY_TOKEN = "jeton";
    private static final String KEY_FINGERPRINT = "empreinte";
    private static final String KEY_COMPUTER_ID = "identifiant";
    private static final String KEY_COMPUTER_NAME = "nom";
    private static final String KEY_ADDRESS = "adresse";
    private static final String KEY_LAST_SENT = "dernierEnvoi";

    /** États rendus à la page. */
    static final String STATE_UNPAIRED = "unpaired";
    static final String STATE_IDLE = "idle";
    static final String STATE_SEARCHING = "searching";
    static final String STATE_PAIRING = "pairing";
    static final String STATE_LINKED = "linked";
    static final String STATE_NOT_FOUND = "notFound";

    /** Raison du dernier échec, rendue à la page qui la dit en clair. */
    /** Aucun réseau local (Wi-Fi ou point d'accès du téléphone), ou adresse sur aucun d'eux. */
    static final String ERROR_NO_LOCAL_NETWORK = "noLocalNetwork";
    static final String ERROR_LOCAL_NETWORK = "localNetwork";
    static final String ERROR_CODE = "code";
    static final String ERROR_WINDOW = "window";
    static final String ERROR_NONCE = "nonce";
    static final String ERROR_TOKEN = "token";
    static final String ERROR_VERSION = "version";
    static final String ERROR_CERTIFICATE = "certificate";
    static final String ERROR_PROOF = "proof";
    static final String ERROR_NETWORK = "network";
    static final String ERROR_PROTOCOL = "protocol";

    /** Codes de refus d'un appel mal formé. */
    static final String REJECT_BAD_CODE = "BAD_CODE";
    static final String REJECT_BAD_ADDRESS = "BAD_ADDRESS";
    static final String REJECT_BAD_BASE = "BAD_BASE";

    /** Attente de la dernière adresse connue : si le PC y est, il répond en quelques millisecondes. */
    private static final int LAST_ADDRESS_TIMEOUT_MS = 1_000;
    /** Durée de la découverte ; la question part deux fois, à 1 s d'écart, contre un paquet perdu. */
    private static final int DISCOVERY_MS = 3_000;
    private static final int DISCOVERY_RESEND_MS = 1_000;
    /** Écoute de chaque socket de la découverte à chaque tour. */
    private static final int DISCOVERY_POLL_MS = 50;
    /** Connexion TCP à une adresse trouvée ou saisie. */
    private static final int CONNECT_TIMEOUT_MS = 3_000;
    /** Poignée de main TLS et chaque réponse attendue pendant l'accueil. */
    private static final int HANDSHAKE_TIMEOUT_MS = 10_000;
    /** Silence du PC au-delà duquel la liaison est tenue pour morte : il envoie `ping` bien plus souvent. */
    private static final int IDLE_TIMEOUT_MS = 120_000;
    private static final int READ_BUFFER = 16_384;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService closer = Executors.newSingleThreadExecutor();
    private final SecureRandom random = new SecureRandom();

    // Sous le verrou de l'instance.
    private String state;
    private String error;
    private Connection link;
    private int sentFiles;
    /** Augmente à chaque fermeture voulue (arrière-plan, oubli, nouvel appairage) : une tentative plus ancienne s'arrête. */
    private int generation;
    /** Sockets de la tentative en cours, fermées par une fermeture voulue pour la débloquer. */
    private final Set<Closeable> attemptSockets = new LinkedHashSet<>();

    // ---------- méthodes de la page ----------

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    /** Appaire au PC dont le code est affiché, puis reste relié. Rend l'état une fois la tentative finie. */
    @PluginMethod
    public void pair(PluginCall call) {
        if (!ComputerLinkProtocol.codeAllowed(call.getString("code", ""))) {
            call.reject("Code d'appairage mal formé : 6 chiffres attendus.", REJECT_BAD_CODE);
            return;
        }
        if (!addressValid(call) || !baseValid(call)) return;
        if (needsLocalNetworkPermission()) {
            requestPermissionForAlias(LOCAL_NETWORK, call, "pairAfterPermission");
            return;
        }
        startPair(call);
    }

    @PermissionCallback
    private void pairAfterPermission(PluginCall call) {
        if (needsLocalNetworkPermission()) {
            refusedLocalNetwork(call);
            return;
        }
        startPair(call);
    }

    /** Relie le téléphone au PC appairé ; sans effet s'il l'est déjà. Rend l'état une fois la tentative finie. */
    @PluginMethod
    public void connect(PluginCall call) {
        if (!addressValid(call) || !baseValid(call)) return;
        if (needsLocalNetworkPermission()) {
            requestPermissionForAlias(LOCAL_NETWORK, call, "connectAfterPermission");
            return;
        }
        startConnect(call);
    }

    @PermissionCallback
    private void connectAfterPermission(PluginCall call) {
        if (needsLocalNetworkPermission()) {
            refusedLocalNetwork(call);
            return;
        }
        startConnect(call);
    }

    /** Ferme la liaison et oublie le PC : jeton, empreinte, adresse. */
    @PluginMethod
    public void forget(PluginCall call) {
        synchronized (this) {
            stopAll();
            prefs().edit().clear().commit();
            sentFiles = 0;
            state = STATE_UNPAIRED;
            error = null;
        }
        notifyStatus();
        call.resolve(statusObject());
    }

    // ---------- cycle de vie ----------

    /** L'application n'est plus à l'écran : liaison et tentative fermées, sans service pour les garder. */
    @Override
    protected void handleOnStop() {
        boolean changed;
        synchronized (this) {
            changed = link != null || !attemptSockets.isEmpty() || STATE_SEARCHING.equals(state) || STATE_PAIRING.equals(state);
            stopAll();
            if (changed) {
                state = restState();
                error = null;
            }
        }
        if (changed) notifyStatus();
        super.handleOnStop();
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (this) {
            stopAll();
        }
        worker.shutdownNow();
        closer.shutdown();
        super.handleOnDestroy();
    }

    /** Ferme liaison et tentative en cours ; appelé sous le verrou. */
    private void stopAll() {
        generation++;
        if (link != null) {
            link.closed = true;
            closeLater(link.socket);
            link = null;
        }
        for (Closeable s : attemptSockets) closeLater(s);
        attemptSockets.clear();
    }

    // ---------- tentatives ----------

    private void startPair(PluginCall call) {
        final String code = call.getString("code", "");
        final String address = blankToNull(call.getString("address"));
        final MemoryRoot root = rootOf(call);
        final int gen;
        synchronized (this) {
            stopAll();
            gen = generation;
        }
        worker.execute(() -> call.resolve(guarded(gen, () -> pairNow(gen, code, address, root))));
    }

    private void startConnect(PluginCall call) {
        final String address = blankToNull(call.getString("address"));
        final MemoryRoot root = rootOf(call);
        final int gen;
        synchronized (this) {
            gen = generation;
        }
        worker.execute(() -> call.resolve(guarded(gen, () -> connectNow(gen, address, root))));
    }

    /** Le dossier mémoire donné par l'appel ; `null` sans `folder`. `base` a passé `baseValid`. */
    private static MemoryRoot rootOf(PluginCall call) {
        String folder = blankToNull(call.getString("folder"));
        if (folder == null) return null;
        String base = call.getString("base");
        return new MemoryRoot(folder, base == null || base.isEmpty() ? null : base);
    }

    private interface Attempt {
        void run() throws IOException;
    }

    /** Une tentative, dont aucune erreur imprévue ne laisse l'appel sans réponse ni l'état en recherche. */
    private JSObject guarded(int gen, Attempt attempt) {
        try {
            attempt.run();
        } catch (IOException | RuntimeException e) {
            Log.w(TAG, "tentative interrompue", e);
            finish(gen, null, ERROR_NETWORK);
        }
        return statusObject();
    }

    private void pairNow(int gen, String code, String address, MemoryRoot root) throws IOException {
        List<LocalLink> links = localLinks();
        if (links.isEmpty()) {
            finish(gen, STATE_NOT_FOUND, ERROR_NO_LOCAL_NETWORK);
            return;
        }
        if (!enter(gen, STATE_SEARCHING)) return;
        Found target;
        if (address != null) {
            target = onLocalLink(links, ComputerLinkProtocol.parseEndpoint(address));
            if (target == null) {
                finish(gen, STATE_NOT_FOUND, ERROR_NO_LOCAL_NETWORK);
                return;
            }
        } else {
            target = discover(gen, links, null);
            if (target == null) {
                finish(gen, STATE_NOT_FOUND, null);
                return;
            }
        }
        Connection c;
        try {
            c = openTls(gen, target, null, CONNECT_TIMEOUT_MS);
        } catch (IOException e) {
            Log.w(TAG, "PC injoignable pour l'appairage", e);
            finish(gen, STATE_NOT_FOUND, ERROR_NETWORK);
            return;
        }
        boolean kept = false;
        try {
            if (!enter(gen, STATE_PAIRING)) return;
            String name = ComputerLinkProtocol.deviceName(Build.MODEL);
            byte[] nonceTelephone = randomBytes(ComputerLinkProtocol.NONCE_SIZE);
            c.send(ComputerLinkProtocol.encodePair(name, nonceTelephone));
            Incoming defi = c.next();
            if (refused(gen, defi, false)) return;
            if (defi == null || !"defi".equals(defi.type)) throw new FrameException(ComputerLinkProtocol.UNKNOWN_MESSAGE, "Défi attendu.");
            c.send(ComputerLinkProtocol.encodeProof(ComputerLinkProtocol.phoneProof(code, c.fingerprint, nonceTelephone, defi.noncePc)));
            Incoming answer = c.next();
            if (refused(gen, answer, false)) return;
            if (answer == null || !"appaire".equals(answer.type)) throw new FrameException(ComputerLinkProtocol.UNKNOWN_MESSAGE, "Réponse d'appairage attendue.");
            byte[] expected = ComputerLinkProtocol.pcProof(code, c.fingerprint, nonceTelephone, defi.noncePc);
            if (!ComputerLinkProtocol.sameBytes(expected, answer.proof)) {
                // Le PC ne connaît pas le code : un autre appareil se fait passer pour lui. Rien n'est gardé.
                finish(gen, null, ERROR_PROOF);
                return;
            }
            synchronized (this) {
                if (gen != generation) return;
                prefs().edit()
                    .clear()
                    .putString(KEY_TOKEN, ComputerLinkProtocol.toHex(answer.token))
                    .putString(KEY_FINGERPRINT, ComputerLinkProtocol.toHex(c.fingerprint))
                    .putString(KEY_COMPUTER_ID, ComputerLinkProtocol.toHex(answer.computerId))
                    .putString(KEY_COMPUTER_NAME, answer.computerName)
                    .putString(KEY_ADDRESS, target.endpoint.toString())
                    .commit();
            }
            kept = startServing(gen, c, root);
        } catch (FrameException e) {
            Log.w(TAG, "appairage : message illisible", e);
            finish(gen, null, ERROR_PROTOCOL);
        } catch (IOException e) {
            Log.w(TAG, "appairage : liaison coupée", e);
            finish(gen, null, ERROR_NETWORK);
        } finally {
            if (!kept) c.close(this);
        }
    }

    private void connectNow(int gen, String address, MemoryRoot root) throws IOException {
        synchronized (this) {
            if (link != null) {
                if (root != null) link.root = root;
                return;
            }
        }
        SharedPreferences p = prefs();
        byte[] token = ComputerLinkProtocol.fromHex(p.getString(KEY_TOKEN, null), ComputerLinkProtocol.TOKEN_SIZE);
        byte[] pin = ComputerLinkProtocol.fromHex(p.getString(KEY_FINGERPRINT, null), ComputerLinkProtocol.FINGERPRINT_SIZE);
        byte[] computerId = ComputerLinkProtocol.fromHex(p.getString(KEY_COMPUTER_ID, null), ComputerLinkProtocol.COMPUTER_ID_SIZE);
        if (token == null || pin == null || computerId == null) {
            finish(gen, STATE_UNPAIRED, null);
            return;
        }
        List<LocalLink> links = localLinks();
        if (links.isEmpty()) {
            finish(gen, STATE_NOT_FOUND, ERROR_NO_LOCAL_NETWORK);
            return;
        }
        if (!enter(gen, STATE_SEARCHING)) return;
        Connection c = null;
        if (address != null) {
            Found typed = onLocalLink(links, ComputerLinkProtocol.parseEndpoint(address));
            if (typed == null) {
                finish(gen, STATE_NOT_FOUND, ERROR_NO_LOCAL_NETWORK);
                return;
            }
            c = openOrReport(gen, typed, pin, CONNECT_TIMEOUT_MS);
            if (c == null) return;
        } else {
            // La dernière adresse n'est essayée que si elle est sur un réseau local présent : jamais par le réseau mobile.
            Found last = onLocalLink(links, ComputerLinkProtocol.parseEndpoint(p.getString(KEY_ADDRESS, null)));
            if (last != null) {
                try {
                    c = openTls(gen, last, pin, LAST_ADDRESS_TIMEOUT_MS);
                } catch (IOException e) {
                    // Le PC a changé d'adresse, ou un autre appareil l'a prise : on le cherche.
                    c = null;
                }
            }
            if (c == null) {
                if (!alive(gen)) return;
                Found found = discover(gen, links, computerId);
                if (found == null) {
                    finish(gen, STATE_NOT_FOUND, null);
                    return;
                }
                c = openOrReport(gen, found, pin, CONNECT_TIMEOUT_MS);
                if (c == null) return;
            }
        }
        boolean kept = false;
        try {
            c.send(ComputerLinkProtocol.encodeHello(ComputerLinkProtocol.deviceName(Build.MODEL), token));
            Incoming answer = c.next();
            // Liaison épinglée sur l'empreinte gardée : un refus du jeton vient bien du PC appairé.
            if (refused(gen, answer, true)) return;
            if (answer == null || !"bienvenue".equals(answer.type)) throw new FrameException(ComputerLinkProtocol.UNKNOWN_MESSAGE, "Bienvenue attendue.");
            synchronized (this) {
                if (gen != generation) return;
                prefs().edit()
                    .putString(KEY_COMPUTER_ID, ComputerLinkProtocol.toHex(answer.computerId))
                    .putString(KEY_COMPUTER_NAME, answer.computerName)
                    .putString(KEY_ADDRESS, c.endpoint.toString())
                    .commit();
            }
            kept = startServing(gen, c, root);
        } catch (FrameException e) {
            Log.w(TAG, "accueil : message illisible", e);
            finish(gen, null, ERROR_PROTOCOL);
        } catch (IOException e) {
            Log.w(TAG, "accueil : liaison coupée", e);
            finish(gen, null, ERROR_NETWORK);
        } finally {
            if (!kept) c.close(this);
        }
    }

    /** Liaison TLS à une adresse ; `null` après avoir dit l'échec (certificat d'une autre empreinte, PC injoignable). */
    private Connection openOrReport(int gen, Found target, byte[] pin, int timeoutMs) {
        try {
            return openTls(gen, target, pin, timeoutMs);
        } catch (PinMismatchException e) {
            Log.w(TAG, "certificat inattendu à " + target.endpoint);
            finish(gen, null, ERROR_CERTIFICATE);
        } catch (IOException e) {
            Log.w(TAG, "PC injoignable à " + target.endpoint, e);
            finish(gen, STATE_NOT_FOUND, ERROR_NETWORK);
        }
        return null;
    }

    /**
     * Vrai si le PC a refusé : la raison est dite à la page. Un jeton refusé n'est oublié que sur une
     * liaison épinglée (reconnexion, `pinnedLink` vrai) ; pendant un appairage, où l'hôte qui répond
     * n'a encore rien prouvé, ce refus n'a pas de sens et fait seulement échouer la tentative comme
     * une preuve fausse, sans toucher à l'appairage gardé.
     */
    private boolean refused(int gen, Incoming m, boolean pinnedLink) {
        if (m == null || !"refus".equals(m.type)) return false;
        switch (m.reason) {
            case ComputerLinkProtocol.REFUSED_TOKEN:
                if (ComputerLinkProtocol.refusalForgetsPairing(m.reason, pinnedLink)) {
                    synchronized (this) {
                        if (gen == generation) prefs().edit().clear().commit();
                    }
                    finish(gen, STATE_UNPAIRED, ERROR_TOKEN);
                } else {
                    finish(gen, null, ERROR_PROOF);
                }
                break;
            case ComputerLinkProtocol.REFUSED_CODE:
                finish(gen, null, ERROR_CODE);
                break;
            case ComputerLinkProtocol.REFUSED_WINDOW:
                finish(gen, null, ERROR_WINDOW);
                break;
            case ComputerLinkProtocol.REFUSED_NONCE:
                finish(gen, null, ERROR_NONCE);
                break;
            default:
                finish(gen, null, ERROR_VERSION);
                break;
        }
        return true;
    }

    /** La liaison est établie : un fil à elle répond aux commandes du PC. Faux si une fermeture voulue est passée. */
    private boolean startServing(int gen, Connection c, MemoryRoot root) {
        synchronized (this) {
            if (gen != generation) return false;
            c.root = root;
            link = c;
            sentFiles = 0;
            state = STATE_LINKED;
            error = null;
        }
        notifyStatus();
        Thread thread = new Thread(() -> serve(c), "Gtracker-liaison");
        thread.setDaemon(true);
        thread.start();
        return true;
    }

    // ---------- commandes du PC ----------

    private void serve(Connection c) {
        String failure = null;
        try {
            c.socket.setSoTimeout(IDLE_TIMEOUT_MS);
            for (;;) {
                Incoming m = c.next();
                if (m == null) break;
                switch (m.type) {
                    case "ping":
                        c.send(ComputerLinkProtocol.encodePong(m.id));
                        break;
                    case "lister":
                        c.send(listFiles(c, m.id));
                        break;
                    case "lire":
                        c.send(readBlock(c, m));
                        break;
                    default:
                        throw new FrameException(ComputerLinkProtocol.UNKNOWN_MESSAGE, "Message inattendu une fois relié : " + m.type);
                }
            }
        } catch (FrameException e) {
            Log.w(TAG, "liaison : message illisible", e);
            failure = ERROR_PROTOCOL;
        } catch (IOException | RuntimeException e) {
            if (!c.closed) Log.w(TAG, "liaison coupée", e);
            failure = ERROR_NETWORK;
        }
        boolean wasCurrent;
        synchronized (this) {
            wasCurrent = link == c;
            if (wasCurrent) {
                link = null;
                state = restState();
                error = c.closed ? null : failure;
            }
        }
        c.close(this);
        if (wasCurrent) notifyStatus();
    }

    /** Réponse à `lister` : fichiers de la racine et de `sessions/`, sans dossier ni écriture en cours. */
    private byte[] listFiles(Connection c, long id) throws FrameException {
        MemoryRoot root = c.root;
        if (root == null) return ComputerLinkProtocol.encodeError(id, ComputerLinkProtocol.ERROR_NOT_FOUND, "Aucun dossier mémoire désigné sur le téléphone.");
        try {
            Uri tree = Uri.parse(root.folder);
            MemoryTree memory = new MemoryTree(getContext().getContentResolver());
            String rootId = memory.baseDir(tree, root.base);
            if (rootId == null) return ComputerLinkProtocol.encodeError(id, ComputerLinkProtocol.ERROR_NOT_FOUND, "Dossier mémoire introuvable sur le téléphone : " + root.base);
            List<RemoteFile> files = new ArrayList<>();
            String sessionsId = null;
            for (MemoryTree.Child child : memory.children(tree, rootId)) {
                if (child.isDir) {
                    if (ComputerLinkProtocol.SESSIONS_DIR.equals(child.name)) sessionsId = child.id;
                } else if (child.sizeKnown) {
                    files.add(new RemoteFile(child.name, child.size, child.mtimeMs));
                }
            }
            if (sessionsId != null) {
                for (MemoryTree.Child child : memory.children(tree, sessionsId)) {
                    if (!child.isDir && child.sizeKnown) files.add(new RemoteFile(ComputerLinkProtocol.SESSIONS_DIR + "/" + child.name, child.size, child.mtimeMs));
                }
            }
            return ComputerLinkProtocol.encodeList(id, files);
        } catch (FrameException e) {
            return ComputerLinkProtocol.encodeError(id, ComputerLinkProtocol.ERROR_UNKNOWN, "Liste trop longue pour une trame.");
        } catch (Exception e) {
            Log.w(TAG, "lister", e);
            return ComputerLinkProtocol.encodeError(id, MemoryTree.errorCode(e), "Lecture du dossier impossible : " + e.getMessage());
        }
    }

    /** Réponse à `lire` : les octets demandés, plus courts seulement à la fin du fichier. */
    private byte[] readBlock(Connection c, Incoming m) throws FrameException {
        MemoryRoot root = c.root;
        if (root == null) return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_NOT_FOUND, "Aucun dossier mémoire désigné sur le téléphone.");
        try {
            Uri tree = Uri.parse(root.folder);
            MemoryTree memory = new MemoryTree(getContext().getContentResolver());
            // Le chemin a passé `pathAllowed` et le sous-dossier `baseAllowed` : il ne désigne qu'un fichier de la
            // racine du dossier mémoire ou de son `sessions/`, cherché nom par nom depuis la racine de l'arbre.
            String docId = memory.resolveExisting(tree, ComputerLinkProtocol.inBase(root.base, m.path));
            long size = docId == null ? -1 : memory.fileSize(tree, docId);
            if (size < 0) return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_NOT_FOUND, "Fichier absent : " + m.path);
            int wanted = (int) Math.max(0, Math.min(m.length, size - m.start));
            byte[] data = new byte[wanted];
            int read = 0;
            if (wanted > 0) {
                try (InputStream in = memory.open(tree, docId)) {
                    skipFully(in, m.start);
                    while (read < wanted) {
                        int n = in.read(data, read, wanted - read);
                        if (n < 0) break;
                        read += n;
                    }
                }
            }
            if (read > 0 && m.start + read >= size) fileSent();
            return ComputerLinkProtocol.encodeBlock(m.id, m.start, data, read);
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "lire", e);
            return ComputerLinkProtocol.encodeError(m.id, MemoryTree.errorCode(e), "Lecture impossible : " + e.getMessage());
        }
    }

    private static void skipFully(InputStream in, long count) throws IOException {
        long left = count;
        byte[] scrap = null;
        while (left > 0) {
            long skipped = in.skip(left);
            if (skipped > 0) {
                left -= skipped;
                continue;
            }
            if (scrap == null) scrap = new byte[8192];
            int n = in.read(scrap, 0, (int) Math.min(scrap.length, left));
            if (n < 0) return;
            left -= n;
        }
    }

    /** Un fichier vient de partir jusqu'à son dernier octet. */
    private void fileSent() {
        synchronized (this) {
            sentFiles++;
            prefs().edit().putLong(KEY_LAST_SENT, System.currentTimeMillis()).apply();
        }
        notifyStatus();
    }

    // ---------- réseau ----------

    /**
     * Un réseau local du téléphone : une adresse IPv4 privée d'une interface qui n'est ni mobile, ni tunnel, ni VPN.
     * Le Wi-Fi où le téléphone est client (point d'accès du PC compris) porte son `Network` d'Android ; le point
     * d'accès du téléphone (partage de connexion) n'en a pas, ses routes sont dans la table locale d'Android.
     */
    private static final class LocalLink {
        final String interfaceName;
        final InetAddress address;
        final long ip;
        final int prefixLength;
        /** Réseau d'Android de l'interface, `null` pour le point d'accès du téléphone. */
        final Network network;

        LocalLink(String interfaceName, InetAddress address, long ip, int prefixLength, Network network) {
            this.interfaceName = interfaceName;
            this.address = address;
            this.ip = ip;
            this.prefixLength = prefixLength;
            this.network = network;
        }
    }

    /** Un PC à joindre et le réseau local par lequel le joindre. */
    private static final class Found {
        final Endpoint endpoint;
        final LocalLink link;

        Found(Endpoint endpoint, LocalLink link) {
            this.endpoint = endpoint;
            this.link = link;
        }
    }

    /**
     * Réseaux locaux du téléphone, sans condition sur le réseau actif : le Wi-Fi comme le point d'accès du
     * téléphone, dont le réseau actif est alors le réseau mobile. Écartés : les interfaces qu'Android range dans le
     * réseau mobile ou un VPN, celles dont le nom est celui d'une interface mobile ou d'un tunnel, les liaisons point
     * à point, et toute adresse qui n'est pas privée.
     */
    @SuppressWarnings("deprecation")
    private List<LocalLink> localLinks() {
        java.util.Map<String, Network> networks = new java.util.HashMap<>();
        Set<String> excluded = new java.util.HashSet<>();
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            try {
                for (Network n : cm.getAllNetworks()) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(n);
                    LinkProperties lp = cm.getLinkProperties(n);
                    String name = lp == null ? null : lp.getInterfaceName();
                    if (caps == null || name == null) continue;
                    if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) || caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) excluded.add(name);
                    else networks.put(name, n);
                }
            } catch (SecurityException e) {
                Log.w(TAG, "état du réseau illisible", e);
            }
        }
        List<LocalLink> links = new ArrayList<>();
        try {
            java.util.Enumeration<NetworkInterface> all = NetworkInterface.getNetworkInterfaces();
            while (all != null && all.hasMoreElements()) {
                NetworkInterface ni = all.nextElement();
                String name = ni.getName();
                if (excluded.contains(name) || ComputerLinkProtocol.mobileInterfaceName(name)) continue;
                if (!ni.isUp() || ni.isLoopback() || ni.isPointToPoint()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress a = ia.getAddress();
                    if (!(a instanceof Inet4Address)) continue;
                    long ip = ipv4(a.getAddress());
                    if (!ComputerLinkProtocol.privateIpv4(ip)) continue;
                    links.add(new LocalLink(name, a, ip, ia.getNetworkPrefixLength(), networks.get(name)));
                }
            }
        } catch (IOException | RuntimeException e) {
            Log.w(TAG, "interfaces réseau illisibles", e);
        }
        return links;
    }

    /** Le réseau local où se trouve l'adresse, `null` si elle n'est sur aucun : elle partirait par une autre route. */
    private static Found onLocalLink(List<LocalLink> links, Endpoint endpoint) {
        if (endpoint == null) return null;
        long ip = ComputerLinkProtocol.parseIpv4(endpoint.host);
        for (LocalLink link : links) {
            if (link.ip != ip && ComputerLinkProtocol.sameSubnet(link.ip, ip, link.prefixLength)) return new Found(endpoint, link);
        }
        return null;
    }

    /** Socket UDP ou TCP attachée à un réseau local : au `Network` d'Android s'il en a un, et à l'adresse locale. */
    private static void attach(LocalLink link, DatagramSocket socket) throws IOException {
        if (link.network != null) link.network.bindSocket(socket);
        socket.bind(new InetSocketAddress(link.address, 0));
    }

    private static void attach(LocalLink link, Socket socket) throws IOException {
        if (link.network != null) link.network.bindSocket(socket);
        socket.bind(new InetSocketAddress(link.address, 0));
    }

    private static long ipv4(byte[] b) {
        return ((b[0] & 0xffL) << 24) | ((b[1] & 0xffL) << 16) | ((b[2] & 0xffL) << 8) | (b[3] & 0xffL);
    }

    /**
     * Cherche le PC par une question diffusée sur chaque réseau local, depuis une socket attachée à ce réseau, vers
     * son adresse de diffusion (255.255.255.255 suivrait la route par défaut, le réseau mobile quand le téléphone
     * partage sa connexion) ; le Wi-Fi d'Android reçoit en plus la diffusion générale, que son `Network` attache.
     * Avec `computerId`, seul ce PC est retenu. `null` si aucun n'a répondu à temps. Une réponse n'est pas une
     * preuve : l'empreinte du certificat, vérifiée ensuite, l'est.
     */
    private Found discover(int gen, List<LocalLink> links, byte[] computerId) throws IOException {
        byte[] nonce = randomBytes(ComputerLinkProtocol.PROBE_NONCE_SIZE);
        byte[] question = ComputerLinkProtocol.encodeQuestion(nonce);
        List<DatagramSocket> sockets = new ArrayList<>();
        List<LocalLink> socketLinks = new ArrayList<>();
        List<List<InetAddress>> targets = new ArrayList<>();
        try {
            for (LocalLink link : links) {
                List<InetAddress> to = new ArrayList<>();
                if (link.prefixLength < 31) to.add(InetAddress.getByName(ComputerLinkProtocol.broadcastAddress(link.ip, link.prefixLength)));
                if (link.network != null) to.add(InetAddress.getByName("255.255.255.255"));
                if (to.isEmpty()) continue;
                DatagramSocket socket = new DatagramSocket((java.net.SocketAddress) null);
                if (!track(gen, socket)) return null;
                sockets.add(socket);
                try {
                    attach(link, socket);
                    socket.setBroadcast(true);
                } catch (IOException e) {
                    Log.w(TAG, "diffusion impossible sur " + link.interfaceName, e);
                    sockets.remove(socket);
                    untrack(socket);
                    socket.close();
                    continue;
                }
                socketLinks.add(link);
                targets.add(to);
            }
            if (sockets.isEmpty()) return null;
            long now = SystemClock.elapsedRealtime();
            long deadline = now + DISCOVERY_MS;
            long nextSend = now;
            int sends = 0;
            byte[] buffer = new byte[512];
            while (alive(gen)) {
                now = SystemClock.elapsedRealtime();
                if (now >= deadline) return null;
                if (sends < 2 && now >= nextSend) {
                    for (int i = 0; i < sockets.size(); i++) {
                        for (InetAddress target : targets.get(i)) {
                            try {
                                sockets.get(i).send(new DatagramPacket(question, question.length, target, ComputerLinkProtocol.PROBE_PORT));
                            } catch (IOException e) {
                                // Une adresse de diffusion refusée n'empêche pas les autres.
                            }
                        }
                    }
                    sends++;
                    nextSend = now + DISCOVERY_RESEND_MS;
                }
                // Chaque socket écoutée à tour de rôle, brièvement : les réponses attendent dans sa file.
                for (int i = 0; i < sockets.size(); i++) {
                    DatagramSocket socket = sockets.get(i);
                    socket.setSoTimeout(DISCOVERY_POLL_MS);
                    DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                    try {
                        socket.receive(packet);
                    } catch (SocketTimeoutException e) {
                        continue;
                    }
                    ProbeAnswer answer = ComputerLinkProtocol.decodeAnswer(Arrays.copyOfRange(packet.getData(), packet.getOffset(), packet.getOffset() + packet.getLength()));
                    if (answer == null || !ComputerLinkProtocol.sameBytes(answer.nonce, nonce)) continue;
                    if (computerId != null && !ComputerLinkProtocol.sameBytes(answer.computerId, computerId)) continue;
                    if (!(packet.getAddress() instanceof Inet4Address)) continue;
                    long ip = ipv4(packet.getAddress().getAddress());
                    LocalLink link = socketLinks.get(i);
                    // Le PC doit être sur le réseau d'où vient sa réponse : jamais une adresse publique ou d'ailleurs.
                    if (!ComputerLinkProtocol.privateIpv4(ip) || !ComputerLinkProtocol.sameSubnet(ip, link.ip, link.prefixLength)) continue;
                    return new Found(new Endpoint(ComputerLinkProtocol.formatIpv4(ip), answer.port), link);
                }
            }
            return null;
        } finally {
            for (DatagramSocket socket : sockets) {
                untrack(socket);
                socket.close();
            }
        }
    }

    /** Le certificat présenté n'a pas l'empreinte gardée. */
    private static final class PinMismatchException extends SSLException {
        PinMismatchException() {
            super("Empreinte du certificat inattendue");
        }
    }

    /**
     * Liaison TLS par le réseau local où est le PC, socket attachée à ce réseau : elle ne part jamais par le réseau
     * mobile. Avec `pin`, le certificat doit avoir cette empreinte ; sans, il est admis et son empreinte retenue,
     * pour entrer dans les preuves de l'appairage.
     */
    private Connection openTls(int gen, Found found, byte[] pin, int connectTimeoutMs) throws IOException {
        Endpoint target = found.endpoint;
        PinningTrustManager trust = new PinningTrustManager(pin);
        Socket plain = new Socket();
        if (!track(gen, plain)) throw new IOException("Liaison fermée.");
        try {
            attach(found.link, plain);
            plain.connect(new InetSocketAddress(InetAddress.getByName(target.host), target.port), connectTimeoutMs);
            plain.setSoTimeout(HANDSHAKE_TIMEOUT_MS);
            plain.setTcpNoDelay(true);
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, new TrustManager[] { trust }, random);
            SSLSocket ssl = (SSLSocket) context.getSocketFactory().createSocket(plain, target.host, target.port, true);
            ssl.setUseClientMode(true);
            ssl.setEnabledProtocols(modernProtocols(ssl.getSupportedProtocols()));
            // Une fermeture voulue ferme la socket TCP dessous, ce qui débloque la poignée de main.
            ssl.startHandshake();
            byte[] fingerprint = trust.seen;
            if (fingerprint == null) throw new SSLException("Aucun certificat présenté.");
            if (!alive(gen)) throw new IOException("Liaison fermée.");
            untrack(plain);
            return new Connection(ssl, target, fingerprint);
        } catch (GeneralSecurityException e) {
            untrack(plain);
            closeQuietly(plain);
            throw new IOException(e);
        } catch (IOException e) {
            untrack(plain);
            closeQuietly(plain);
            if (trust.mismatch) throw new PinMismatchException();
            throw e;
        }
    }

    /** TLS 1.3 et 1.2 seulement, parmi ceux que le téléphone sait parler. */
    private static String[] modernProtocols(String[] supported) {
        List<String> kept = new ArrayList<>();
        for (String p : supported) if ("TLSv1.3".equals(p) || "TLSv1.2".equals(p)) kept.add(p);
        return kept.toArray(new String[0]);
    }

    /** Confiance réduite à une empreinte : aucune autorité, aucun nom, seul le certificat attendu passe. */
    private static final class PinningTrustManager extends X509ExtendedTrustManager {
        private final byte[] pin;
        volatile byte[] seen;
        volatile boolean mismatch;

        PinningTrustManager(byte[] pin) {
            this.pin = pin;
        }

        private void check(X509Certificate[] chain) throws CertificateException {
            if (chain == null || chain.length == 0) throw new CertificateException("Aucun certificat présenté.");
            byte[] fingerprint = ComputerLinkProtocol.sha256(chain[0].getEncoded());
            if (pin != null && !ComputerLinkProtocol.sameBytes(pin, fingerprint)) {
                mismatch = true;
                throw new CertificateException("Empreinte du certificat inattendue.");
            }
            seen = fingerprint;
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            check(chain);
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType, Socket socket) throws CertificateException {
            check(chain);
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType, SSLEngine engine) throws CertificateException {
            check(chain);
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            throw new CertificateException("Le téléphone n'accepte aucune connexion.");
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType, Socket socket) throws CertificateException {
            throw new CertificateException("Le téléphone n'accepte aucune connexion.");
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType, SSLEngine engine) throws CertificateException {
            throw new CertificateException("Le téléphone n'accepte aucune connexion.");
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
        }
    }

    /**
     * Le dossier mémoire que lit la liaison, posé d'un bloc : l'arbre désigné (adresse SAF) et le sous-dossier où est
     * la mémoire, `null` quand c'est l'arbre lui-même.
     */
    private static final class MemoryRoot {
        final String folder;
        final String base;

        MemoryRoot(String folder, String base) {
            this.folder = folder;
            this.base = base;
        }
    }

    /** Une liaison TLS avec le PC : flux, décodeur aux limites de l'accueil (le PC n'envoie jamais de corps). */
    private static final class Connection {
        final SSLSocket socket;
        final Endpoint endpoint;
        final byte[] fingerprint;
        final InputStream in;
        final OutputStream out;
        final FrameDecoder decoder = new FrameDecoder(ComputerLinkProtocol.WELCOME_LIMITS);
        final ArrayDeque<Frame> frames = new ArrayDeque<>();
        final byte[] buffer = new byte[READ_BUFFER];
        /** Dossier mémoire lu pour les commandes ; donné par la page. */
        volatile MemoryRoot root;
        /** Vrai une fois fermée exprès : l'erreur de lecture qui suit n'en est pas une. */
        volatile boolean closed;

        Connection(SSLSocket socket, Endpoint endpoint, byte[] fingerprint) throws IOException {
            this.socket = socket;
            this.endpoint = endpoint;
            this.fingerprint = fingerprint;
            this.in = socket.getInputStream();
            this.out = new BufferedOutputStream(socket.getOutputStream(), 65_536);
        }

        /** Message suivant du PC ; `null` si le PC a fermé la liaison entre deux trames. */
        Incoming next() throws IOException {
            while (frames.isEmpty()) {
                int n = in.read(buffer);
                if (n < 0) {
                    decoder.end();
                    return null;
                }
                frames.addAll(decoder.push(buffer, 0, n));
            }
            return ComputerLinkProtocol.readMessage(frames.poll());
        }

        void send(byte[] bytes) throws IOException {
            out.write(bytes);
            out.flush();
        }

        void close(ComputerLinkPlugin owner) {
            closed = true;
            owner.closeLater(socket);
        }
    }

    // ---------- état ----------

    /** Note une socket de la tentative en cours ; faux si une fermeture voulue est passée depuis son début. */
    private synchronized boolean track(int gen, Closeable socket) {
        if (gen != generation) {
            closeLater(socket);
            return false;
        }
        attemptSockets.add(socket);
        return true;
    }

    private synchronized void untrack(Closeable socket) {
        attemptSockets.remove(socket);
    }

    private synchronized boolean alive(int gen) {
        return gen == generation;
    }

    /** Passe à un état de la tentative, si elle vaut encore. */
    private boolean enter(int gen, String next) {
        synchronized (this) {
            if (gen != generation) return false;
            state = next;
            error = null;
        }
        notifyStatus();
        return true;
    }

    /** Fin d'une tentative : `next` nul rend l'état de repos (appairé ou non). Sans effet après une fermeture voulue. */
    private void finish(int gen, String next, String failure) {
        synchronized (this) {
            if (gen != generation) return;
            state = next != null ? next : restState();
            error = failure;
        }
        notifyStatus();
    }

    private void refusedLocalNetwork(PluginCall call) {
        synchronized (this) {
            state = restState();
            error = ERROR_LOCAL_NETWORK;
        }
        notifyStatus();
        call.resolve(statusObject());
    }

    private String restState() {
        return prefs().contains(KEY_TOKEN) ? STATE_IDLE : STATE_UNPAIRED;
    }

    /**
     * L'état pour la page : `state`, `error` (raison du dernier échec ou null), `paired`, `computerName`, `address`
     * (« a.b.c.d:port », dernière adresse connue), `lastSentMs` (dernier fichier envoyé jusqu'au bout, ou null),
     * `sentFiles` (fichiers envoyés pendant la liaison en cours), `onLocalNetwork` (un réseau local est là : Wi-Fi ou
     * point d'accès du téléphone). Jamais le jeton ni l'empreinte.
     */
    private JSObject statusObject() {
        SharedPreferences p = prefs();
        JSObject ret = new JSObject();
        synchronized (this) {
            boolean paired = p.contains(KEY_TOKEN);
            String shown = state == null || ((STATE_IDLE.equals(state) || STATE_UNPAIRED.equals(state))) ? (paired ? STATE_IDLE : STATE_UNPAIRED) : state;
            ret.put("state", shown);
            ret.put("error", error == null ? JSONObject.NULL : error);
            ret.put("paired", paired);
            ret.put("sentFiles", sentFiles);
            ret.put("computerName", orNull(paired ? p.getString(KEY_COMPUTER_NAME, null) : null));
            ret.put("address", orNull(paired ? p.getString(KEY_ADDRESS, null) : null));
            ret.put("lastSentMs", paired && p.contains(KEY_LAST_SENT) ? (Object) p.getLong(KEY_LAST_SENT, 0) : JSONObject.NULL);
        }
        ret.put("onLocalNetwork", !localLinks().isEmpty());
        return ret;
    }

    private void notifyStatus() {
        JSObject data = statusObject();
        try {
            notifyListeners(EVENT_STATUS, data);
        } catch (RuntimeException e) {
            // Pont fermé avec l'activité : la page relira l'état à son retour.
        }
    }

    // ---------- outils ----------

    private boolean needsLocalNetworkPermission() {
        return Build.VERSION.SDK_INT >= LOCAL_NETWORK_SDK && getPermissionState(LOCAL_NETWORK) != PermissionState.GRANTED;
    }

    /** Refuse l'appel si l'adresse donnée n'est pas une adresse privée du réseau local. */
    private boolean addressValid(PluginCall call) {
        String address = blankToNull(call.getString("address"));
        if (address != null && ComputerLinkProtocol.parseEndpoint(address) == null) {
            call.reject("Adresse refusée : une adresse du réseau local est attendue (192.168.x.x, 10.x.x.x ou 172.16 à 31.x.x).", REJECT_BAD_ADDRESS);
            return false;
        }
        return true;
    }

    /** Refuse l'appel si le sous-dossier donné sortirait du dossier désigné (`ComputerLinkProtocol.baseAllowed`). */
    private boolean baseValid(PluginCall call) {
        if (!ComputerLinkProtocol.baseAllowed(call.getString("base"))) {
            call.reject("Sous-dossier du dossier mémoire refusé : un nom de dossier relatif est attendu.", REJECT_BAD_BASE);
            return false;
        }
        return true;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private byte[] randomBytes(int size) {
        byte[] bytes = new byte[size];
        random.nextBytes(bytes);
        return bytes;
    }

    private void closeLater(Closeable socket) {
        try {
            closer.execute(() -> closeQuietly(socket));
        } catch (RuntimeException e) {
            // Fil des fermetures arrêté avec l'activité : fermée ici.
            closeQuietly(socket);
        }
    }

    private static void closeQuietly(Closeable c) {
        try {
            c.close();
        } catch (IOException | RuntimeException e) {
            // Déjà fermée.
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.trim().isEmpty() ? null : s.trim();
    }

    private static Object orNull(String s) {
        return s == null ? JSONObject.NULL : s;
    }
}
