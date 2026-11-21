package io.github.segneur.gtracker;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Liaison sans fil avec le programme Windows, côté téléphone : trames, messages, preuves d'appairage, paquets de la
 * découverte et contrôle des chemins demandés par le PC. Calcul pur, sans Android ni réseau, éprouvé en JVM sur les
 * jeux d'essai communs aux deux côtés (bureau/sansFil.vecteurs.json).
 *
 * Le format est celui que décrivent les en-têtes de bureau/trames.ts (trames et messages), bureau/appairage.ts
 * (preuves et jeton) et bureau/sonde.ts (découverte UDP) ; ce fichier le reproduit octet pour octet :
 * - trame : longueur de l'en-tête puis longueur du corps, deux entiers non signés de 32 bits gros-boutistes, puis
 *   l'en-tête (objet JSON en UTF-8 strict, sans marque d'ordre d'octets, champ `type` texte non vide), puis le corps ;
 * - le JSON est lu et écrit ici, sans org.json : sa lecture est aussi stricte que celle du PC (pas d'apostrophes, de
 *   clés nues ni de virgule finale), son écriture est celle de JSON.stringify (ordre des champs gardé, sans espace) ;
 * - les nombres JSON sont des doubles, comme en JavaScript : un entier y est exact jusqu'à 2^53 - 1.
 *
 * Le téléphone ne reçoit que de petits en-têtes (défi, réponses de l'accueil, commandes) : il lit le flux du PC avec
 * les limites de l'accueil, puis, une fois relié, avec un corps d'un bloc au plus (`COMMAND_LIMITS`), le seul corps
 * reçu étant celui de `ecrire`. Il n'envoie de corps que dans `bloc`.
 *
 * Écriture : le téléphone annonce la capacité « ecriture » (`CAPABILITIES`) ; il liste alors aussi `itineraires/` et
 * `reglages/`, et reçoit `ecrire`, `valider` et `effacer`, bornés à la liste blanche `writeAllowed`. L'ordre des blocs
 * d'une écriture est tenu par `WriteSession`.
 */
final class ComputerLinkProtocol {

    private ComputerLinkProtocol() {}

    // ---------- constantes partagées avec le PC ----------

    /** Version du protocole, portée par `appairer` et `bonjour`. */
    static final int PROTOCOL_VERSION = 1;
    /** Port TCP où le PC écoute d'abord. */
    static final int PORT = 48217;
    /** Port UDP où le PC attend les questions de la découverte. */
    static final int PROBE_PORT = 48218;
    /** Taille d'un bloc de lecture : une commande `lire` ne demande jamais plus. */
    static final int BLOCK_SIZE = 1_048_576;
    /** Taille des deux longueurs qui ouvrent chaque trame. */
    static final int PREFIX_SIZE = 8;
    /** Plus grand identifiant de commande. */
    static final long ID_MAX = 2_147_483_647L;
    /** Plus grand entier exact d'un nombre JSON (Number.MAX_SAFE_INTEGER). */
    static final long MAX_SAFE_INTEGER = 9_007_199_254_740_991L;
    /** Plus long nom d'appareil admis, en caractères. */
    static final int NAME_MAX = 100;
    /** Plus long message d'erreur envoyé, en caractères ; au-delà, il est coupé. */
    static final int MESSAGE_MAX = 500;

    /** Limites d'une liaison où le téléphone s'est présenté. */
    static final Limits LIMITS = new Limits(8_388_608, BLOCK_SIZE);
    /** Limites de l'accueil : en-tête court, aucun corps. */
    static final Limits WELCOME_LIMITS = new Limits(16_384, 0);
    /**
     * Limites des commandes du PC une fois relié : l'en-tête court de l'accueil (une commande porte au plus un chemin
     * de 512 caractères), et le corps d'un bloc d'écriture.
     */
    static final Limits COMMAND_LIMITS = new Limits(WELCOME_LIMITS.header, BLOCK_SIZE);

    /** Capacité annoncée dans `appairer` et `bonjour` : listage des quatre dossiers et écriture, jamais l'un sans l'autre. */
    static final String CAPABILITY_WRITE = "ecriture";
    /** Capacités annoncées par le téléphone, dans l'ordre où elles partent. */
    static final List<String> CAPABILITIES = Collections.unmodifiableList(Arrays.asList(CAPABILITY_WRITE));

    /** Sous-dossiers du dossier mémoire dont les fichiers sont listés et lus, en plus de ceux de la racine. */
    static final String SESSIONS_DIR = "sessions";
    static final String ITINERARIES_DIR = "itineraires";
    static final String SETTINGS_DIR = "reglages";
    static final List<String> LISTED_DIRS = Collections.unmodifiableList(Arrays.asList(SESSIONS_DIR, ITINERARIES_DIR, SETTINGS_DIR));

    /** Liste blanche des écritures et effacements, la même que `cheminEcrivable` (bureau/telephone.ts). */
    static final List<String> WRITABLE_DIRS = Collections.unmodifiableList(Arrays.asList(SESSIONS_DIR, ITINERARIES_DIR, SETTINGS_DIR));
    static final List<String> WRITABLE_ROOT_FILES = Collections.unmodifiableList(Arrays.asList("gtracker.json", "fc-repos.json", "lieux.json"));
    /** Longueur au-delà de laquelle un chemin à écrire est refusé sans examen, en caractères. */
    static final int WRITE_PATH_MAX = 512;
    /** Suffixes des écritures en cours du dossier mémoire (MemoryTree) : jamais listés, lus ni écrits par le PC. */
    static final String TEMP_SUFFIX = ".gtracker-tmp";
    static final String NEW_SUFFIX = ".gtracker-new";

    /** Codes d'erreur d'une réponse `erreur`, les mêmes que ceux du dossier mémoire. */
    static final String ERROR_NOT_FOUND = "NOT_FOUND";
    static final String ERROR_PERMISSION = "PERMISSION";
    static final String ERROR_NO_SPACE = "NO_SPACE";
    static final String ERROR_UNKNOWN = "UNKNOWN";

    /** Raisons d'un refus du PC. */
    static final String REFUSED_CODE = "code";
    static final String REFUSED_WINDOW = "fenetre";
    static final String REFUSED_NONCE = "nonce";
    static final String REFUSED_TOKEN = "jeton";
    static final String REFUSED_VERSION = "version";

    /**
     * Vrai si un refus du PC doit faire oublier l'appairage gardé (jeton, empreinte, identifiant).
     * Seul un refus du jeton le fait, et seulement sur une liaison épinglée sur l'empreinte gardée :
     * c'est alors le vrai PC qui ne reconnaît plus le jeton. Pendant un appairage, la liaison n'est
     * pas encore épinglée et le téléphone n'a envoyé aucun jeton : n'importe quel hôte du réseau
     * peut répondre, son refus fait seulement échouer la tentative et l'ancien appairage reste.
     */
    static boolean refusalForgetsPairing(String reason, boolean pinnedLink) {
        return pinnedLink && REFUSED_TOKEN.equals(reason);
    }

    // ---------- erreurs ----------

    /** Ce qui ne va pas dans le flux ou dans un message : mêmes raisons que `RaisonTrame` côté PC. */
    static final String EMPTY_HEADER = "EN_TETE_VIDE";
    static final String HEADER_TOO_LONG = "EN_TETE_TROP_LONG";
    static final String BODY_TOO_LONG = "CORPS_TROP_LONG";
    static final String UNREADABLE_HEADER = "EN_TETE_ILLISIBLE";
    static final String TRUNCATED = "TRONQUEE";
    static final String UNKNOWN_MESSAGE = "MESSAGE_INCONNU";
    static final String INVALID_MESSAGE = "MESSAGE_INVALIDE";

    /** Erreur de la liaison : on la ferme. */
    static final class FrameException extends IOException {
        final String reason;

        FrameException(String reason, String message) {
            super(message);
            this.reason = reason;
        }
    }

    /** Tailles admises d'une trame, en octets. */
    static final class Limits {
        final int header;
        final int body;

        Limits(int header, int body) {
            this.header = header;
            this.body = body;
        }
    }

    /** Une trame reçue en entier : son en-tête relu (champs dans l'ordre reçu) et son corps. */
    static final class Frame {
        final Map<String, Object> header;
        final byte[] body;

        Frame(Map<String, Object> header, byte[] body) {
            this.header = header;
            this.body = body;
        }

        String type() {
            return (String) header.get("type");
        }
    }

    // ---------- trames ----------

    private static void checkSizes(long n, long m, Limits limits) throws FrameException {
        if (n == 0) throw new FrameException(EMPTY_HEADER, "Trame sans en-tête.");
        if (n > limits.header) throw new FrameException(HEADER_TOO_LONG, "En-tête de " + n + " octets, plus que les " + limits.header + " admis.");
        if (m > limits.body) throw new FrameException(BODY_TOO_LONG, "Corps de " + m + " octets, plus que les " + limits.body + " admis.");
    }

    /** Octets d'une trame. Lève `FrameException` si elle dépasse les limites. */
    static byte[] encodeFrame(Map<String, Object> header, byte[] body, Limits limits) throws FrameException {
        byte[] text = Json.write(header).getBytes(StandardCharsets.UTF_8);
        checkSizes(text.length, body.length, limits);
        ByteBuffer out = ByteBuffer.allocate(PREFIX_SIZE + text.length + body.length);
        out.putInt(text.length);
        out.putInt(body.length);
        out.put(text);
        out.put(body);
        return out.array();
    }

    private static Map<String, Object> readHeader(byte[] bytes) throws FrameException {
        Object value;
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString();
            // Une marque d'ordre d'octets reste dans le texte (U+FEFF) : le JSON la refuse, comme le format le veut.
            value = Json.parse(text);
        } catch (CharacterCodingException | Json.JsonException e) {
            throw new FrameException(UNREADABLE_HEADER, "En-tête illisible : ni de l'UTF-8 valide ni du JSON.");
        }
        if (!(value instanceof Map)) throw new FrameException(UNREADABLE_HEADER, "L'en-tête n'est pas un objet JSON.");
        @SuppressWarnings("unchecked")
        Map<String, Object> header = (Map<String, Object>) value;
        Object type = header.get("type");
        if (!(type instanceof String) || ((String) type).isEmpty()) throw new FrameException(UNREADABLE_HEADER, "L'en-tête n'a pas de champ « type ».");
        return header;
    }

    /**
     * Découpe un flux d'octets en trames, quels que soient les morceaux reçus. Après une erreur, le décodeur est hors
     * d'usage : chaque appel relève la même erreur.
     */
    static final class FrameDecoder {
        /** Limites appliquées aux trames dont les longueurs ne sont pas encore lues. */
        Limits limits;
        private byte[] buffer = new byte[256];
        private int start;
        private int end;
        private boolean prefixRead;
        private int headerLength;
        private int bodyLength;
        private FrameException error;

        FrameDecoder(Limits limits) {
            this.limits = limits;
        }

        /** Octets reçus et pas encore rendus en trame. */
        long pending() {
            return (end - start) + (prefixRead ? PREFIX_SIZE : 0);
        }

        /** Ajoute un morceau du flux et rend les trames qu'il complète, dans l'ordre. */
        List<Frame> push(byte[] data, int offset, int length) throws FrameException {
            if (error != null) throw error;
            append(data, offset, length);
            List<Frame> frames = new ArrayList<>();
            for (;;) {
                if (!prefixRead) {
                    if (end - start < PREFIX_SIZE) break;
                    long n = unsigned32(buffer, start);
                    long m = unsigned32(buffer, start + 4);
                    start += PREFIX_SIZE;
                    try {
                        checkSizes(n, m, limits);
                    } catch (FrameException e) {
                        throw fail(e);
                    }
                    headerLength = (int) n;
                    bodyLength = (int) m;
                    prefixRead = true;
                }
                if ((long) end - start < (long) headerLength + bodyLength) break;
                byte[] header = new byte[headerLength];
                byte[] body = new byte[bodyLength];
                System.arraycopy(buffer, start, header, 0, headerLength);
                System.arraycopy(buffer, start + headerLength, body, 0, bodyLength);
                start += headerLength + bodyLength;
                prefixRead = false;
                try {
                    frames.add(new Frame(readHeader(header), body));
                } catch (FrameException e) {
                    throw fail(e);
                }
            }
            if (start == end) {
                start = 0;
                end = 0;
            }
            return frames;
        }

        /** Fin du flux : lève `TRONQUEE` si une trame était commencée. */
        void end() throws FrameException {
            if (error != null) throw error;
            if (pending() > 0) throw fail(new FrameException(TRUNCATED, "Liaison coupée au milieu d'une trame (" + pending() + " octets en attente)."));
        }

        private FrameException fail(FrameException e) {
            error = e;
            buffer = new byte[0];
            start = 0;
            end = 0;
            prefixRead = false;
            return e;
        }

        private void append(byte[] data, int offset, int length) {
            if (length <= 0) return;
            if (end + length > buffer.length) {
                int kept = end - start;
                byte[] grown = kept + length > buffer.length ? new byte[Math.max(buffer.length * 2, kept + length)] : buffer;
                System.arraycopy(buffer, start, grown, 0, kept);
                buffer = grown;
                start = 0;
                end = kept;
            }
            System.arraycopy(data, offset, buffer, end, length);
            end += length;
        }

        private static long unsigned32(byte[] b, int at) {
            return ((b[at] & 0xffL) << 24) | ((b[at + 1] & 0xffL) << 16) | ((b[at + 2] & 0xffL) << 8) | (b[at + 3] & 0xffL);
        }
    }

    // ---------- messages reçus du PC ----------

    /** Un message du PC, champs vérifiés ; seuls ceux de son `type` sont remplis. */
    static final class Incoming {
        final String type;
        long id = -1;
        String path;
        long start;
        int length;
        /** Taille totale du fichier, pour `ecrire` et `valider`. */
        long size;
        /** Octets du bloc de `ecrire`. */
        byte[] body;
        byte[] noncePc;
        byte[] proof;
        byte[] token;
        byte[] computerId;
        String computerName;
        String reason;

        Incoming(String type) {
            this.type = type;
        }
    }

    private static FrameException invalid(String type, String field) {
        return new FrameException(INVALID_MESSAGE, "Message « " + type + " » mal formé : champ « " + field + " ».");
    }

    private static long integer(Map<String, Object> header, String field, long min, long max) throws FrameException {
        Object v = header.get(field);
        if (!(v instanceof Double)) throw invalid((String) header.get("type"), field);
        double d = (Double) v;
        if (Double.isNaN(d) || Double.isInfinite(d) || d != Math.rint(d) || Math.abs(d) > MAX_SAFE_INTEGER) throw invalid((String) header.get("type"), field);
        long value = (long) d;
        if (value < min || value > max) throw invalid((String) header.get("type"), field);
        return value;
    }

    private static byte[] hexField(Map<String, Object> header, String field, int size) throws FrameException {
        Object v = header.get(field);
        byte[] bytes = v instanceof String ? fromHex((String) v, size) : null;
        if (bytes == null) throw invalid((String) header.get("type"), field);
        return bytes;
    }

    private static String nameField(Map<String, Object> header, String field) throws FrameException {
        Object v = header.get(field);
        if (!(v instanceof String) || !nameAllowed((String) v)) throw invalid((String) header.get("type"), field);
        return (String) v;
    }

    private static String pathField(Map<String, Object> header, boolean write) throws FrameException {
        Object v = header.get("chemin");
        if (!(v instanceof String) || !(write ? writeAllowed((String) v) : pathAllowed((String) v))) throw invalid((String) header.get("type"), "chemin");
        return (String) v;
    }

    /**
     * Le message du PC porté par une trame, champs vérifiés comme le fait le PC (`lireMessage`). Lève
     * `MESSAGE_INCONNU` sur un `type` que le PC n'envoie pas au téléphone, `MESSAGE_INVALIDE` sur un champ manquant,
     * mal typé ou hors bornes, et sur un corps ailleurs que dans `ecrire`. Le corps d'un `ecrire` n'est vide que pour
     * un fichier vide et ne déborde jamais la taille annoncée.
     */
    static Incoming readMessage(Frame frame) throws FrameException {
        Map<String, Object> h = frame.header;
        String type = frame.type();
        Incoming m = new Incoming(type);
        switch (type) {
            case "defi":
            case "appaire":
            case "bienvenue":
            case "refus":
            case "lister":
            case "lire":
            case "ping":
            case "ecrire":
            case "valider":
            case "effacer":
                break;
            default:
                throw new FrameException(UNKNOWN_MESSAGE, "Message inconnu : « " + (type.length() > 40 ? type.substring(0, 40) : type) + " ».");
        }
        if (frame.body.length > 0 && !"ecrire".equals(type)) throw invalid(type, "corps");
        switch (type) {
            case "defi":
                m.noncePc = hexField(h, "noncePc", 32);
                break;
            case "appaire":
                m.proof = hexField(h, "preuve", 32);
                m.token = hexField(h, "jeton", 32);
                m.computerId = hexField(h, "identifiantPc", 16);
                m.computerName = nameField(h, "nomPc");
                break;
            case "bienvenue":
                m.computerId = hexField(h, "identifiantPc", 16);
                m.computerName = nameField(h, "nomPc");
                break;
            case "refus": {
                Object raison = h.get("raison");
                boolean known = REFUSED_CODE.equals(raison) || REFUSED_WINDOW.equals(raison) || REFUSED_NONCE.equals(raison)
                    || REFUSED_TOKEN.equals(raison) || REFUSED_VERSION.equals(raison);
                if (!known) throw invalid(type, "raison");
                m.reason = (String) raison;
                break;
            }
            case "lire":
                m.path = pathField(h, false);
                m.id = integer(h, "id", 0, ID_MAX);
                m.start = integer(h, "debut", 0, MAX_SAFE_INTEGER);
                m.length = (int) integer(h, "longueur", 1, BLOCK_SIZE);
                break;
            case "ecrire": {
                m.id = integer(h, "id", 0, ID_MAX);
                m.path = pathField(h, true);
                m.start = integer(h, "debut", 0, MAX_SAFE_INTEGER);
                m.size = integer(h, "taille", 0, MAX_SAFE_INTEGER);
                int n = frame.body.length;
                if ((n == 0 && m.size != 0) || m.start + n > m.size) throw invalid(type, "corps");
                m.body = frame.body;
                m.length = n;
                break;
            }
            case "valider":
                m.id = integer(h, "id", 0, ID_MAX);
                m.path = pathField(h, true);
                m.size = integer(h, "taille", 0, MAX_SAFE_INTEGER);
                break;
            case "effacer":
                m.id = integer(h, "id", 0, ID_MAX);
                m.path = pathField(h, true);
                break;
            default:
                m.id = integer(h, "id", 0, ID_MAX);
                break;
        }
        return m;
    }

    // ---------- messages envoyés au PC ----------

    private static Map<String, Object> header(String type) {
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("type", type);
        return h;
    }

    /** Demande d'appairage par le code affiché sur le PC, capacités en dernier champ. */
    static byte[] encodePair(String name, byte[] nonceTelephone) throws FrameException {
        Map<String, Object> h = header("appairer");
        h.put("version", (long) PROTOCOL_VERSION);
        h.put("nom", name);
        h.put("nonceTelephone", toHex(nonceTelephone));
        h.put("capacites", new ArrayList<Object>(CAPABILITIES));
        return encodeFrame(h, new byte[0], LIMITS);
    }

    /** Téléphone déjà appairé qui présente son jeton, capacités en dernier champ. */
    static byte[] encodeHello(String name, byte[] token) throws FrameException {
        Map<String, Object> h = header("bonjour");
        h.put("version", (long) PROTOCOL_VERSION);
        h.put("nom", name);
        h.put("jeton", toHex(token));
        h.put("capacites", new ArrayList<Object>(CAPABILITIES));
        return encodeFrame(h, new byte[0], LIMITS);
    }

    /** Preuve du téléphone. */
    static byte[] encodeProof(byte[] proof) throws FrameException {
        Map<String, Object> h = header("preuve");
        h.put("preuve", toHex(proof));
        return encodeFrame(h, new byte[0], LIMITS);
    }

    /** Réponse à `lister` : les fichiers admis, triés par chemin (`allowedFiles`). */
    static byte[] encodeList(long id, List<RemoteFile> files) throws FrameException {
        Map<String, Object> h = header("liste");
        h.put("id", id);
        List<Object> list = new ArrayList<>();
        for (RemoteFile f : allowedFiles(files)) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("chemin", f.path);
            entry.put("taille", f.size);
            entry.put("dateMs", f.dateMs);
            list.add(entry);
        }
        h.put("fichiers", list);
        return encodeFrame(h, new byte[0], LIMITS);
    }

    /** Réponse à `lire` : les `length` premiers octets de `data`, lus à partir de `start`. */
    static byte[] encodeBlock(long id, long start, byte[] data, int length) throws FrameException {
        Map<String, Object> h = header("bloc");
        h.put("id", id);
        h.put("debut", start);
        h.put("longueur", (long) length);
        byte[] body = length == data.length ? data : java.util.Arrays.copyOf(data, length);
        return encodeFrame(h, body, LIMITS);
    }

    /** Réponse à `ping` ; `recording` vrai quand le téléphone enregistre une session et refuse donc d'écrire. */
    static byte[] encodePong(long id, boolean recording) throws FrameException {
        Map<String, Object> h = header("pong");
        h.put("id", id);
        h.put("enregistre", recording);
        return encodeFrame(h, new byte[0], LIMITS);
    }

    /** Réponse à `ecrire` et à `effacer`. */
    static byte[] encodeDone(long id) throws FrameException {
        Map<String, Object> h = header("fait");
        h.put("id", id);
        return encodeFrame(h, new byte[0], LIMITS);
    }

    /** Réponse à `valider` : le fichier tel qu'il est désormais sur le téléphone. */
    static byte[] encodeWritten(long id, String path, long size, long dateMs) throws FrameException {
        Map<String, Object> h = header("ecrit");
        h.put("id", id);
        h.put("chemin", path);
        h.put("taille", size);
        h.put("dateMs", Math.max(0, dateMs));
        return encodeFrame(h, new byte[0], LIMITS);
    }

    /** Réponse d'échec à une commande ; un code inconnu devient UNKNOWN, le message est coupé à 500 caractères. */
    static byte[] encodeError(long id, String code, String message) throws FrameException {
        Map<String, Object> h = header("erreur");
        h.put("id", id);
        boolean known = ERROR_NOT_FOUND.equals(code) || ERROR_PERMISSION.equals(code) || ERROR_NO_SPACE.equals(code);
        h.put("code", known ? code : ERROR_UNKNOWN);
        String text = message == null ? "" : message;
        h.put("message", text.length() > MESSAGE_MAX ? text.substring(0, MESSAGE_MAX) : text);
        return encodeFrame(h, new byte[0], LIMITS);
    }

    // ---------- noms et chemins ----------

    /** Vrai pour un nom d'appareil : 1 à 100 caractères, sans caractère de contrôle (C0, effacement, C1). */
    static boolean nameAllowed(String name) {
        if (name.isEmpty() || name.length() > NAME_MAX) return false;
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return false;
        }
        return true;
    }

    /** Nom du téléphone tel qu'il part dans `appairer` et `bonjour` : le modèle, nettoyé, « Android » s'il n'en reste rien. */
    static String deviceName(String model) {
        StringBuilder out = new StringBuilder();
        if (model != null) {
            for (int i = 0; i < model.length(); i++) {
                char c = model.charAt(i);
                if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) continue;
                out.append(c);
            }
        }
        String name = out.toString().trim();
        if (name.length() > NAME_MAX) {
            name = name.substring(0, NAME_MAX);
            if (Character.isHighSurrogate(name.charAt(NAME_MAX - 1))) name = name.substring(0, NAME_MAX - 1);
        }
        return name.isEmpty() ? "Android" : name;
    }

    /** Caractères refusés par Windows dans un nom de fichier (barre oblique inverse et deux-points compris). */
    private static final String FORBIDDEN_CHARACTERS = "\\:<>\"|?*";
    /** Noms réservés de Windows, seuls ou suivis d'une extension (`CON`, `nul.txt`, `COM1.json`). */
    private static final Pattern RESERVED_NAMES = Pattern.compile("^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]) *(\\.|$)", Pattern.CASE_INSENSITIVE);

    /** Vrai pour un segment de chemin admis sur le disque du PC, mêmes refus que `segmentAdmis` (bureau/disque.ts). */
    static boolean segmentAllowed(String segment) {
        if (segment.isEmpty() || segment.equals(".") || segment.equals("..")) return false;
        for (int i = 0; i < segment.length(); i++) {
            char c = segment.charAt(i);
            if (c < 0x20 || c == 0x7f || FORBIDDEN_CHARACTERS.indexOf(c) >= 0) return false;
        }
        // Windows retire en silence un point ou une espace finale : `a.` et `a` seraient le même fichier.
        if (segment.endsWith(".") || segment.endsWith(" ")) return false;
        if (RESERVED_NAMES.matcher(segment).find()) return false;
        String lower = segment.toLowerCase(Locale.ROOT);
        return !lower.endsWith(TEMP_SUFFIX) && !lower.endsWith(NEW_SUFFIX);
    }

    /**
     * Vrai pour un chemin que le PC peut lire et que `liste` peut porter : un fichier de la racine du dossier mémoire
     * ou de l'un des `LISTED_DIRS`, séparé par `/`, chaque segment admis ; mêmes refus que `cheminDuCable`
     * (bureau/telephone.ts). Rien hors du dossier : ni `..`, ni chemin absolu, ni autre sous-dossier.
     */
    static boolean pathAllowed(String path) {
        String[] segments = path.split("/", -1);
        if (segments.length == 2 && !LISTED_DIRS.contains(segments[0])) return false;
        if (segments.length != 1 && segments.length != 2) return false;
        for (String s : segments) if (!segmentAllowed(s)) return false;
        return true;
    }

    /**
     * Vrai pour un chemin que le PC peut écrire ou effacer, mêmes règles que `cheminEcrivable` (bureau/telephone.ts) :
     * 1 à 512 caractères, un fichier posé directement dans l'un des `WRITABLE_DIRS` (nom admis par `segmentAllowed`),
     * ou l'un des `WRITABLE_ROOT_FILES`, en casse exacte. Tout le reste est refusé.
     */
    static boolean writeAllowed(String path) {
        if (path == null || path.isEmpty() || path.length() > WRITE_PATH_MAX) return false;
        String[] segments = path.split("/", -1);
        if (segments.length == 1) return WRITABLE_ROOT_FILES.contains(path);
        return segments.length == 2 && WRITABLE_DIRS.contains(segments[0]) && segmentAllowed(segments[1]);
    }

    /** Nom provisoire d'une écriture : `nom.gtracker-tmp` pour remplacer un fichier qui existe, `nom.gtracker-new` sinon. */
    static String provisionalName(String name, boolean replacing) {
        return name + (replacing ? TEMP_SUFFIX : NEW_SUFFIX);
    }

    /**
     * Une écriture en cours sur la liaison : le fichier visé, sa taille annoncée, ce qui est déjà écrit, et s'il
     * remplace un fichier existant. Le premier bloc (debut 0) en ouvre une, en abandonnant celle d'avant ; chaque
     * bloc suivant doit viser le même chemin, annoncer la même taille et commencer où le précédent finit ; `valider`
     * n'est admis qu'une fois tous les octets reçus. Calcul pur : les fichiers sont ailleurs (MemoryWriter).
     */
    static final class WriteSession {
        final String path;
        final long size;
        final boolean replacing;
        private long written;

        WriteSession(String path, long size, boolean replacing) {
            this.path = path;
            this.size = size;
            this.replacing = replacing;
        }

        /** Octets reçus jusqu'ici. */
        long written() {
            return written;
        }

        /** Vrai pour un bloc qui ouvre une écriture : celle d'avant, non validée, est alors abandonnée. */
        static boolean opens(long start) {
            return start == 0;
        }

        /** Vrai si un bloc de `length` octets à `start`, d'un fichier `path` de `size` octets, continue cette écriture. */
        boolean continues(String path, long start, long size, int length) {
            return this.path.equals(path) && this.size == size && start == written && start + length <= size;
        }

        /** Note un bloc reçu, déjà admis par `continues` ou ouvrant l'écriture. */
        void wrote(int length) {
            if (length < 0 || written + length > size) throw new IllegalArgumentException("Bloc au-delà de la taille annoncée.");
            written += length;
        }

        /** Vrai si `valider` peut mettre le fichier en place : même chemin, même taille, tous les octets reçus. */
        boolean completes(String path, long size) {
            return this.path.equals(path) && this.size == size && written == size;
        }

        /** Suffixe du provisoire : remplacement ou création. */
        String suffix() {
            return replacing ? TEMP_SUFFIX : NEW_SUFFIX;
        }
    }

    /** Segments au plus du sous-dossier où est la mémoire (la page n'en donne qu'un, « Gtracker »). */
    static final int BASE_SEGMENTS_MAX = 8;

    /**
     * Vrai pour le sous-dossier du dossier désigné où est la mémoire, donné par la page (`base` de
     * `platform/memoryFolder.ts`) : vide ou absent (le dossier désigné est la mémoire elle-même), sinon des segments
     * admis séparés par `/`. Rien hors de l'arbre : ni `..` ni `.`, ni barre en tête ou en fin, ni segment vide, ni
     * chemin absolu (le deux-points de `C:` ou de `content:` et la barre oblique inverse sont refusés par segment).
     */
    static boolean baseAllowed(String base) {
        if (base == null || base.isEmpty()) return true;
        String[] segments = base.split("/", -1);
        if (segments.length > BASE_SEGMENTS_MAX) return false;
        for (String s : segments) if (!segmentAllowed(s)) return false;
        return true;
    }

    /** Chemin depuis la racine de l'arbre d'un fichier du dossier mémoire : `path` sous `base` quand il y en a un. */
    static String inBase(String base, String path) {
        return base == null || base.isEmpty() ? path : base + "/" + path;
    }

    /** Un fichier du dossier mémoire : chemin relatif, taille en octets, date de modification en millisecondes. */
    static final class RemoteFile {
        final String path;
        final long size;
        final long dateMs;

        RemoteFile(String path, long size, long dateMs) {
            this.path = path;
            this.size = size;
            this.dateMs = dateMs;
        }
    }

    /** Fichiers admis, triés par chemin ; un chemin vu deux fois est écarté, comme `fichiersAdmis` côté PC. */
    static List<RemoteFile> allowedFiles(List<RemoteFile> files) {
        Map<String, Integer> seen = new HashMap<>();
        for (RemoteFile f : files) seen.merge(f.path, 1, Integer::sum);
        List<RemoteFile> kept = new ArrayList<>();
        for (RemoteFile f : files) {
            if (pathAllowed(f.path) && seen.get(f.path) == 1 && f.size >= 0 && f.size <= MAX_SAFE_INTEGER) kept.add(f);
        }
        Collections.sort(kept, (a, b) -> a.path.compareTo(b.path));
        return kept;
    }

    // ---------- appairage ----------

    static final int CODE_DIGITS = 6;
    static final int NONCE_SIZE = 32;
    static final int TOKEN_SIZE = 32;
    static final int FINGERPRINT_SIZE = 32;
    static final int COMPUTER_ID_SIZE = 16;
    /** Étiquettes qui séparent la preuve du téléphone de celle du PC. */
    static final String PHONE_LABEL = "gtracker-appairage-telephone";
    static final String PC_LABEL = "gtracker-appairage-pc";

    /** Vrai pour un code : exactement 6 chiffres ASCII. */
    static boolean codeAllowed(String code) {
        if (code == null || code.length() != CODE_DIGITS) return false;
        for (int i = 0; i < code.length(); i++) {
            char c = code.charAt(i);
            if (c < '0' || c > '9') return false;
        }
        return true;
    }

    /** Preuve que le téléphone connaît le code. */
    static byte[] phoneProof(String code, byte[] fingerprint, byte[] nonceTelephone, byte[] noncePc) {
        return proof(PHONE_LABEL, code, fingerprint, nonceTelephone, noncePc);
    }

    /** Preuve que le PC connaît le code, telle que le téléphone l'attend. */
    static byte[] pcProof(String code, byte[] fingerprint, byte[] nonceTelephone, byte[] noncePc) {
        return proof(PC_LABEL, code, fingerprint, nonceTelephone, noncePc);
    }

    /** HMAC-SHA256(code en ASCII, étiquette ‖ 0x00 ‖ empreinte ‖ nonceTelephone ‖ noncePc), octets bruts. */
    private static byte[] proof(String label, String code, byte[] fingerprint, byte[] nonceTelephone, byte[] noncePc) {
        if (!codeAllowed(code)) throw new IllegalArgumentException("Code d'appairage mal formé : 6 chiffres attendus.");
        requireSize(fingerprint, FINGERPRINT_SIZE, "Empreinte du certificat");
        requireSize(nonceTelephone, NONCE_SIZE, "Nonce du téléphone");
        requireSize(noncePc, NONCE_SIZE, "Nonce du PC");
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(code.getBytes(StandardCharsets.US_ASCII), "HmacSHA256"));
            mac.update(label.getBytes(StandardCharsets.US_ASCII));
            mac.update((byte) 0);
            mac.update(fingerprint);
            mac.update(nonceTelephone);
            mac.update(noncePc);
            return mac.doFinal();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** SHA-256 d'octets : empreinte d'un certificat (ses octets DER), hachage d'un jeton. */
    static byte[] sha256(byte[] bytes) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(bytes);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Hachage d'un jeton tel que le PC le garde : SHA-256 de ses 32 octets, en hexadécimal minuscule. */
    static String tokenHash(byte[] token) {
        requireSize(token, TOKEN_SIZE, "Jeton");
        return toHex(sha256(token));
    }

    /** Égalité de deux suites d'octets dont la durée ne dépend que des longueurs. */
    static boolean sameBytes(byte[] a, byte[] b) {
        if (a == null || b == null || a.length != b.length) return false;
        int diff = 0;
        for (int i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }

    private static void requireSize(byte[] bytes, int size, String what) {
        if (bytes == null || bytes.length != size) throw new IllegalArgumentException(what + " : " + size + " octets attendus.");
    }

    // ---------- hexadécimal ----------

    private static final char[] HEX = "0123456789abcdef".toCharArray();

    /** Octets en hexadécimal minuscule. */
    static String toHex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            out[2 * i] = HEX[(bytes[i] >> 4) & 0xf];
            out[2 * i + 1] = HEX[bytes[i] & 0xf];
        }
        return new String(out);
    }

    /** Octets d'un texte hexadécimal minuscule d'exactement `size` octets, `null` s'il n'en est pas un. */
    static byte[] fromHex(String text, int size) {
        if (text == null || text.length() != size * 2) return null;
        byte[] out = new byte[size];
        for (int i = 0; i < size; i++) {
            int hi = hexDigit(text.charAt(2 * i));
            int lo = hexDigit(text.charAt(2 * i + 1));
            if (hi < 0 || lo < 0) return null;
            out[i] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    private static int hexDigit(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        return -1;
    }

    // ---------- découverte UDP ----------

    static final byte[] PROBE_SIGNATURE = { 0x47, 0x54, 0x52, 0x4b };
    static final int PROBE_VERSION = 1;
    static final int PROBE_QUESTION = 0x01;
    static final int PROBE_ANSWER = 0x02;
    static final int PROBE_NONCE_SIZE = 16;
    /** Plus long nom du PC dans une réponse, en octets UTF-8. */
    static final int PC_NAME_MAX_BYTES = 64;
    private static final int QUESTION_SIZE = 6 + PROBE_NONCE_SIZE;
    private static final int ANSWER_FIXED_SIZE = 6 + PROBE_NONCE_SIZE + 2 + COMPUTER_ID_SIZE + 1;

    /** Réponse d'un PC : nonce recopié, port TCP, identifiant, nom. L'adresse est celle d'où vient le paquet. */
    static final class ProbeAnswer {
        final byte[] nonce;
        final int port;
        final byte[] computerId;
        final String name;

        ProbeAnswer(byte[] nonce, int port, byte[] computerId, String name) {
            this.nonce = nonce;
            this.port = port;
            this.computerId = computerId;
            this.name = name;
        }
    }

    private static boolean hasProbeHeader(byte[] packet, int kind) {
        for (int i = 0; i < PROBE_SIGNATURE.length; i++) if (packet[i] != PROBE_SIGNATURE[i]) return false;
        return packet[4] == PROBE_VERSION && packet[5] == kind;
    }

    /** Octets d'une question. */
    static byte[] encodeQuestion(byte[] nonce) {
        requireSize(nonce, PROBE_NONCE_SIZE, "Nonce de la question");
        ByteBuffer out = ByteBuffer.allocate(QUESTION_SIZE);
        out.put(PROBE_SIGNATURE).put((byte) PROBE_VERSION).put((byte) PROBE_QUESTION).put(nonce);
        return out.array();
    }

    /** Le nonce d'une question, `null` pour un paquet étranger. */
    static byte[] decodeQuestion(byte[] packet) {
        if (packet.length != QUESTION_SIZE || !hasProbeHeader(packet, PROBE_QUESTION)) return null;
        return java.util.Arrays.copyOfRange(packet, 6, QUESTION_SIZE);
    }

    /** Octets d'une réponse ; le nom doit tenir en 64 octets UTF-8, sans caractère de contrôle. */
    static byte[] encodeAnswer(ProbeAnswer answer) {
        requireSize(answer.nonce, PROBE_NONCE_SIZE, "Nonce de la question");
        requireSize(answer.computerId, COMPUTER_ID_SIZE, "Identifiant du PC");
        if (answer.port < 1 || answer.port > 65535) throw new IllegalArgumentException("Port hors bornes : " + answer.port + ".");
        byte[] name = answer.name.getBytes(StandardCharsets.UTF_8);
        if (name.length > PC_NAME_MAX_BYTES || (name.length > 0 && !nameAllowed(answer.name))) throw new IllegalArgumentException("Nom du PC refusé dans une réponse.");
        ByteBuffer out = ByteBuffer.allocate(ANSWER_FIXED_SIZE + name.length);
        out.put(PROBE_SIGNATURE).put((byte) PROBE_VERSION).put((byte) PROBE_ANSWER).put(answer.nonce);
        out.putShort((short) answer.port).put(answer.computerId).put((byte) name.length).put(name);
        return out.array();
    }

    /** La réponse d'un PC, `null` pour un paquet étranger. */
    static ProbeAnswer decodeAnswer(byte[] packet) {
        if (packet.length < ANSWER_FIXED_SIZE || !hasProbeHeader(packet, PROBE_ANSWER)) return null;
        int nameLength = packet[ANSWER_FIXED_SIZE - 1] & 0xff;
        if (nameLength > PC_NAME_MAX_BYTES || packet.length != ANSWER_FIXED_SIZE + nameLength) return null;
        int port = ((packet[6 + PROBE_NONCE_SIZE] & 0xff) << 8) | (packet[7 + PROBE_NONCE_SIZE] & 0xff);
        if (port == 0) return null;
        String name;
        try {
            name = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(packet, ANSWER_FIXED_SIZE, nameLength))
                .toString();
        } catch (CharacterCodingException e) {
            return null;
        }
        if (!name.isEmpty() && !nameAllowed(name)) return null;
        return new ProbeAnswer(
            java.util.Arrays.copyOfRange(packet, 6, 6 + PROBE_NONCE_SIZE),
            port,
            java.util.Arrays.copyOfRange(packet, 8 + PROBE_NONCE_SIZE, 8 + PROBE_NONCE_SIZE + COMPUTER_ID_SIZE),
            name
        );
    }

    // ---------- adresses IPv4 ----------

    /** Une adresse IPv4 écrite « a.b.c.d » en entier non signé de 32 bits, -1 si elle est mal écrite. */
    static long parseIpv4(String text) {
        if (text == null) return -1;
        String[] parts = text.split("\\.", -1);
        if (parts.length != 4) return -1;
        long value = 0;
        for (String part : parts) {
            if (part.isEmpty() || part.length() > 3) return -1;
            for (int i = 0; i < part.length(); i++) if (part.charAt(i) < '0' || part.charAt(i) > '9') return -1;
            int octet = Integer.parseInt(part);
            if (octet > 255) return -1;
            value = (value << 8) | octet;
        }
        return value;
    }

    /** Un entier non signé de 32 bits écrit « a.b.c.d ». */
    static String formatIpv4(long n) {
        return ((n >>> 24) & 0xff) + "." + ((n >>> 16) & 0xff) + "." + ((n >>> 8) & 0xff) + "." + (n & 0xff);
    }

    /** Vrai pour une adresse privée de la RFC 1918 (10/8, 172.16/12, 192.168/16), les seules où le PC écoute. */
    static boolean privateIpv4(long n) {
        if (n < 0) return false;
        return (n >>> 16) == 0xc0a8 || (n >>> 24) == 10 || (n >>> 20) == 0xac1;
    }

    private static long mask(int prefixLength) {
        return prefixLength <= 0 ? 0 : (0xffffffffL << (32 - Math.min(prefixLength, 32))) & 0xffffffffL;
    }

    /** Adresse de diffusion du réseau d'une adresse et de la longueur de son préfixe (0 à 32). */
    static String broadcastAddress(long address, int prefixLength) {
        return formatIpv4((address | ~mask(prefixLength)) & 0xffffffffL);
    }

    /** Vrai si deux adresses sont dans le même réseau pour ce préfixe. */
    static boolean sameSubnet(long a, long b, int prefixLength) {
        long m = mask(prefixLength);
        return a >= 0 && b >= 0 && (a & m) == (b & m);
    }

    /**
     * Vrai pour le nom d'une interface du réseau mobile, d'un tunnel ou d'un VPN : jamais employée pour joindre le
     * PC, même si l'opérateur lui donne une adresse privée. Le greffon écarte aussi celles qu'Android range dans le
     * réseau mobile ou un VPN ; ces noms couvrent les fabricants (Qualcomm, MediaTek, Samsung).
     */
    static boolean mobileInterfaceName(String name) {
        if (name == null) return true;
        String n = name.toLowerCase(Locale.ROOT);
        return n.contains("rmnet") || n.startsWith("ccmni") || n.startsWith("pdp") || n.startsWith("v4-") || n.startsWith("clat")
            || n.startsWith("tun") || n.startsWith("ppp") || n.startsWith("ipsec") || n.startsWith("dummy") || n.startsWith("lo")
            || n.startsWith("seth") || n.startsWith("ccinet") || n.startsWith("wwan");
    }

    /** Adresse et port d'un PC. */
    static final class Endpoint {
        final String host;
        final int port;

        Endpoint(String host, int port) {
            this.host = host;
            this.port = port;
        }

        @Override
        public String toString() {
            return host + ":" + port;
        }
    }

    /**
     * Adresse saisie ou gardée, « a.b.c.d » ou « a.b.c.d:port » (port 48217 par défaut) ; `null` si elle est mal
     * écrite ou n'est pas une adresse privée : le téléphone ne se connecte jamais hors du réseau local.
     */
    static Endpoint parseEndpoint(String text) {
        if (text == null) return null;
        String t = text.trim();
        int port = PORT;
        int colon = t.indexOf(':');
        if (colon >= 0) {
            String p = t.substring(colon + 1);
            if (p.isEmpty() || p.length() > 5) return null;
            for (int i = 0; i < p.length(); i++) if (p.charAt(i) < '0' || p.charAt(i) > '9') return null;
            port = Integer.parseInt(p);
            if (port < 1 || port > 65535) return null;
            t = t.substring(0, colon);
        }
        long address = parseIpv4(t);
        if (!privateIpv4(address)) return null;
        return new Endpoint(formatIpv4(address), port);
    }

    // ---------- JSON ----------

    /** JSON strict, lu et écrit comme JSON.parse et JSON.stringify. */
    static final class Json {
        /** Valeur `null` du JSON, distincte d'un champ absent. */
        static final Object NULL = new Object() {
            @Override
            public String toString() {
                return "null";
            }
        };
        /** Profondeur d'imbrication au-delà de laquelle un texte est refusé : les messages en ont trois au plus. */
        static final int MAX_DEPTH = 32;

        static final class JsonException extends Exception {
            JsonException(String message) {
                super(message);
            }
        }

        private final String text;
        private int at;

        private Json(String text) {
            this.text = text;
        }

        /** Objet (LinkedHashMap), tableau (ArrayList), texte, nombre (Double), booléen ou `NULL`. */
        static Object parse(String text) throws JsonException {
            Json p = new Json(text);
            p.skipSpaces();
            Object value = p.value(0);
            p.skipSpaces();
            if (p.at != text.length()) throw new JsonException("Caractères après la valeur.");
            return value;
        }

        private void skipSpaces() {
            while (at < text.length()) {
                char c = text.charAt(at);
                if (c != ' ' && c != '\t' && c != '\n' && c != '\r') return;
                at++;
            }
        }

        private Object value(int depth) throws JsonException {
            if (depth > MAX_DEPTH) throw new JsonException("Imbrication trop profonde.");
            if (at >= text.length()) throw new JsonException("Fin inattendue.");
            char c = text.charAt(at);
            switch (c) {
                case '{':
                    return object(depth);
                case '[':
                    return array(depth);
                case '"':
                    return string();
                case 't':
                    return literal("true", Boolean.TRUE);
                case 'f':
                    return literal("false", Boolean.FALSE);
                case 'n':
                    return literal("null", NULL);
                default:
                    if (c == '-' || (c >= '0' && c <= '9')) return number();
                    throw new JsonException("Caractère inattendu.");
            }
        }

        private Object literal(String word, Object value) throws JsonException {
            if (!text.startsWith(word, at)) throw new JsonException("Mot inconnu.");
            at += word.length();
            return value;
        }

        private Map<String, Object> object(int depth) throws JsonException {
            Map<String, Object> map = new LinkedHashMap<>();
            at++;
            skipSpaces();
            if (at < text.length() && text.charAt(at) == '}') {
                at++;
                return map;
            }
            for (;;) {
                skipSpaces();
                if (at >= text.length() || text.charAt(at) != '"') throw new JsonException("Clé attendue.");
                String key = string();
                skipSpaces();
                expect(':');
                skipSpaces();
                Object v = value(depth + 1);
                // Comme JSON.parse : une clé répétée garde sa dernière valeur, à la place de la première.
                map.remove(key);
                map.put(key, v);
                skipSpaces();
                if (at < text.length() && text.charAt(at) == ',') {
                    at++;
                    continue;
                }
                expect('}');
                return map;
            }
        }

        private List<Object> array(int depth) throws JsonException {
            List<Object> list = new ArrayList<>();
            at++;
            skipSpaces();
            if (at < text.length() && text.charAt(at) == ']') {
                at++;
                return list;
            }
            for (;;) {
                skipSpaces();
                list.add(value(depth + 1));
                skipSpaces();
                if (at < text.length() && text.charAt(at) == ',') {
                    at++;
                    continue;
                }
                expect(']');
                return list;
            }
        }

        private void expect(char c) throws JsonException {
            if (at >= text.length() || text.charAt(at) != c) throw new JsonException("« " + c + " » attendu.");
            at++;
        }

        private String string() throws JsonException {
            at++;
            StringBuilder out = new StringBuilder();
            for (;;) {
                if (at >= text.length()) throw new JsonException("Texte non fermé.");
                char c = text.charAt(at++);
                if (c == '"') return out.toString();
                if (c < 0x20) throw new JsonException("Caractère de contrôle dans un texte.");
                if (c != '\\') {
                    out.append(c);
                    continue;
                }
                if (at >= text.length()) throw new JsonException("Échappement non fermé.");
                char e = text.charAt(at++);
                switch (e) {
                    case '"': out.append('"'); break;
                    case '\\': out.append('\\'); break;
                    case '/': out.append('/'); break;
                    case 'b': out.append('\b'); break;
                    case 'f': out.append('\f'); break;
                    case 'n': out.append('\n'); break;
                    case 'r': out.append('\r'); break;
                    case 't': out.append('\t'); break;
                    case 'u': {
                        if (at + 4 > text.length()) throw new JsonException("Échappement \\u incomplet.");
                        int v = 0;
                        for (int i = 0; i < 4; i++) {
                            char h = text.charAt(at++);
                            int d = Character.digit(h, 16);
                            if (d < 0 || h > 'f') throw new JsonException("Échappement \\u illisible.");
                            v = (v << 4) | d;
                        }
                        out.append((char) v);
                        break;
                    }
                    default:
                        throw new JsonException("Échappement inconnu.");
                }
            }
        }

        private Double number() throws JsonException {
            int begin = at;
            if (text.charAt(at) == '-') at++;
            if (at >= text.length()) throw new JsonException("Nombre incomplet.");
            if (text.charAt(at) == '0') {
                at++;
            } else if (text.charAt(at) >= '1' && text.charAt(at) <= '9') {
                while (at < text.length() && isDigit(text.charAt(at))) at++;
            } else {
                throw new JsonException("Nombre illisible.");
            }
            if (at < text.length() && text.charAt(at) == '.') {
                at++;
                int digits = at;
                while (at < text.length() && isDigit(text.charAt(at))) at++;
                if (at == digits) throw new JsonException("Nombre illisible.");
            }
            if (at < text.length() && (text.charAt(at) == 'e' || text.charAt(at) == 'E')) {
                at++;
                if (at < text.length() && (text.charAt(at) == '+' || text.charAt(at) == '-')) at++;
                int digits = at;
                while (at < text.length() && isDigit(text.charAt(at))) at++;
                if (at == digits) throw new JsonException("Nombre illisible.");
            }
            return Double.parseDouble(text.substring(begin, at));
        }

        private static boolean isDigit(char c) {
            return c >= '0' && c <= '9';
        }

        /** Texte JSON d'une valeur, tel que JSON.stringify l'écrit : sans espace, champs dans l'ordre de la table. */
        static String write(Object value) {
            StringBuilder out = new StringBuilder();
            write(value, out);
            return out.toString();
        }

        @SuppressWarnings("unchecked")
        private static void write(Object value, StringBuilder out) {
            if (value == null || value == NULL) {
                out.append("null");
            } else if (value instanceof String) {
                quote((String) value, out);
            } else if (value instanceof Boolean) {
                out.append(value.toString());
            } else if (value instanceof Integer || value instanceof Long) {
                out.append(value.toString());
            } else if (value instanceof Double) {
                double d = (Double) value;
                if (Double.isNaN(d) || Double.isInfinite(d)) out.append("null");
                else if (d == Math.rint(d) && Math.abs(d) <= MAX_SAFE_INTEGER) out.append((long) d);
                else out.append(d);
            } else if (value instanceof Map) {
                out.append('{');
                boolean first = true;
                for (Map.Entry<String, Object> e : ((Map<String, Object>) value).entrySet()) {
                    if (!first) out.append(',');
                    first = false;
                    quote(e.getKey(), out);
                    out.append(':');
                    write(e.getValue(), out);
                }
                out.append('}');
            } else if (value instanceof List) {
                out.append('[');
                boolean first = true;
                for (Object item : (List<Object>) value) {
                    if (!first) out.append(',');
                    first = false;
                    write(item, out);
                }
                out.append(']');
            } else {
                throw new IllegalArgumentException("Valeur sans écriture JSON : " + value.getClass().getName());
            }
        }

        /** Texte entre guillemets, échappé comme JSON.stringify : contrôles et demi-paires de substitution en \\u. */
        private static void quote(String s, StringBuilder out) {
            out.append('"');
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                switch (c) {
                    case '"': out.append("\\\""); break;
                    case '\\': out.append("\\\\"); break;
                    case '\b': out.append("\\b"); break;
                    case '\f': out.append("\\f"); break;
                    case '\n': out.append("\\n"); break;
                    case '\r': out.append("\\r"); break;
                    case '\t': out.append("\\t"); break;
                    default:
                        boolean lone = Character.isSurrogate(c) && !(
                            (Character.isHighSurrogate(c) && i + 1 < s.length() && Character.isLowSurrogate(s.charAt(i + 1)))
                            || (Character.isLowSurrogate(c) && i > 0 && Character.isHighSurrogate(s.charAt(i - 1)))
                        );
                        if (c < 0x20 || lone) {
                            out.append("\\u");
                            for (int shift = 12; shift >= 0; shift -= 4) out.append(HEX[(c >> shift) & 0xf]);
                        } else {
                            out.append(c);
                        }
                }
            }
            out.append('"');
        }
    }
}
