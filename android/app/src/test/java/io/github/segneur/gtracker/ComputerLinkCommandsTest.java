package io.github.segneur.gtracker;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import io.github.segneur.gtracker.ComputerLinkPlugin.MemoryRoot;
import io.github.segneur.gtracker.ComputerLinkProtocol.Frame;
import io.github.segneur.gtracker.ComputerLinkProtocol.FrameDecoder;
import io.github.segneur.gtracker.ComputerLinkProtocol.FrameException;
import io.github.segneur.gtracker.ComputerLinkProtocol.Incoming;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

/**
 * Le téléphone qui répond aux commandes du PC (ComputerLinkCommands), de la trame reçue à la trame rendue, sur un
 * faux fournisseur de documents (FakeDocuments) : écriture bloc par bloc et mise en place, coupure, effacement,
 * chemins refusés, garde-fous, fournisseur sans renommage, lecture par blocs. Ce que le PC attend de ces réponses est
 * éprouvé de son côté (bureau/sansFil.test.ts, bureau/disque.test.ts) ; ici, ce qui reste sur le téléphone.
 *
 * Une seule version d'Android simulée, dont Robolectric télécharge l'image une fois.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class ComputerLinkCommandsTest {

    @Rule
    public TemporaryFolder folder = new TemporaryFolder();

    private FakeDocuments documents;
    private final AtomicBoolean recording = new AtomicBoolean();
    private final AtomicInteger exchanges = new AtomicInteger();
    private final AtomicInteger sent = new AtomicInteger();
    private ComputerLinkCommands commands;
    /** Le dossier mémoire désigné : la racine du faux fournisseur, sans sous-dossier. */
    private MemoryRoot root;
    private long nextId = 1;

    @Before
    public void setUp() throws Exception {
        documents = FakeDocuments.install(folder.newFolder("memoire"));
        commands = newCommands();
        root = rootIn(null);
    }

    /** Toute écriture finie, validée ou abandonnée, a rendu le nom de son provisoire. */
    @After
    public void noWritingLeft() throws Exception {
        commands.abandon();
        Map<String, Integer> left = writings();
        try {
            assertTrue("provisoires encore tenus : " + left, left.isEmpty());
        } finally {
            left.clear();
        }
    }

    private ComputerLinkCommands newCommands() {
        return new ComputerLinkCommands(RuntimeEnvironment.getApplication().getContentResolver(), recording::get, exchanges::incrementAndGet, sent::incrementAndGet);
    }

    private static MemoryRoot rootIn(String base) {
        return new MemoryRoot(FakeDocuments.tree().toString(), base);
    }

    /** Les provisoires tenus par une écriture (`MemoryTree.startWriting`), registre de tout le processus. */
    @SuppressWarnings("unchecked")
    private static Map<String, Integer> writings() throws Exception {
        Field f = MemoryTree.class.getDeclaredField("WRITING");
        f.setAccessible(true);
        return (Map<String, Integer>) f.get(null);
    }

    // ---------- trames ----------

    private static byte[] utf8(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    private Map<String, Object> header(String type) {
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("type", type);
        h.put("id", nextId++);
        return h;
    }

    /** Le message tel que le fil de la liaison le reçoit : trame encodée, découpée, relue (`readMessage`). */
    private static Incoming incoming(Map<String, Object> header, byte[] body) throws FrameException {
        byte[] bytes = ComputerLinkProtocol.encodeFrame(header, body, ComputerLinkProtocol.LIMITS);
        List<Frame> frames = new FrameDecoder(ComputerLinkProtocol.COMMAND_LIMITS).push(bytes, 0, bytes.length);
        assertEquals(1, frames.size());
        return ComputerLinkProtocol.readMessage(frames.get(0));
    }

    /** La réponse du téléphone, relue comme le PC la lit. */
    private Frame send(Map<String, Object> header, byte[] body) throws Exception {
        byte[] reply = commands.answer(incoming(header, body), root);
        List<Frame> frames = new FrameDecoder(ComputerLinkProtocol.LIMITS).push(reply, 0, reply.length);
        assertEquals(1, frames.size());
        Frame f = frames.get(0);
        assertEquals(((Number) header.get("id")).doubleValue(), (Double) f.header.get("id"), 0);
        return f;
    }

    private Frame write(String path, long start, long size, String block) throws Exception {
        Map<String, Object> h = header("ecrire");
        h.put("chemin", path);
        h.put("debut", start);
        h.put("taille", size);
        return send(h, utf8(block));
    }

    private Frame commit(String path, long size) throws Exception {
        Map<String, Object> h = header("valider");
        h.put("chemin", path);
        h.put("taille", size);
        return send(h, new byte[0]);
    }

    private Frame erase(String path) throws Exception {
        Map<String, Object> h = header("effacer");
        h.put("chemin", path);
        return send(h, new byte[0]);
    }

    private Frame read(String path, long start, int length) throws Exception {
        Map<String, Object> h = header("lire");
        h.put("chemin", path);
        h.put("debut", start);
        h.put("longueur", (long) length);
        return send(h, new byte[0]);
    }

    /** Chemin et taille de chaque fichier de la réponse à `lister`. */
    private Map<String, Long> list() throws Exception {
        Frame f = send(header("lister"), new byte[0]);
        assertEquals("liste", f.type());
        Map<String, Long> files = new TreeMap<>();
        for (Object o : (List<?>) f.header.get("fichiers")) {
            Map<?, ?> entry = (Map<?, ?>) o;
            files.put((String) entry.get("chemin"), ((Double) entry.get("taille")).longValue());
        }
        return files;
    }

    /** Le fichier entier, en blocs de `block` caractères (un seul, vide, pour un fichier vide), puis `valider`. */
    private Frame writeWhole(String path, String content, int block) throws Exception {
        long size = utf8(content).length;
        int at = 0;
        do {
            Frame f = write(path, at, size, content.substring(at, Math.min(content.length(), at + block)));
            assertEquals("fait", f.type());
            at += block;
        } while (at < content.length());
        return commit(path, size);
    }

    private static void assertError(String code, Frame f) {
        assertEquals("erreur", f.type());
        assertEquals(f.header.get("message").toString(), code, f.header.get("code"));
    }

    private static Map<String, Long> files(Object... pathsAndSizes) {
        Map<String, Long> m = new TreeMap<>();
        for (int i = 0; i < pathsAndSizes.length; i += 2) m.put((String) pathsAndSizes[i], ((Number) pathsAndSizes[i + 1]).longValue());
        return m;
    }

    // ---------- écriture d'un fichier neuf ----------

    @Test
    public void ecritUnFichierNeufEnDeuxBlocsPuisLeMetEnPlace() throws Exception {
        assertEquals("fait", write("sessions/a.json", 0, 10, "012345").type());
        // Le provisoire porte la suffixe d'une création ; la liste ne le montre pas tant qu'il s'écrit.
        assertArrayEquals(new String[] { "a.json.gtracker-new" }, documents.names("sessions"));
        assertEquals(files(), list());
        assertEquals("fait", write("sessions/a.json", 6, 10, "6789").type());
        Frame done = commit("sessions/a.json", 10);
        assertEquals("ecrit", done.type());
        assertEquals("sessions/a.json", done.header.get("chemin"));
        assertEquals(10.0, (Double) done.header.get("taille"), 0);
        assertEquals((double) documents.file("sessions/a.json").lastModified(), (Double) done.header.get("dateMs"), 0);
        assertTrue((Double) done.header.get("dateMs") > 0);
        assertEquals("0123456789", documents.read("sessions/a.json"));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
        assertEquals(files("sessions/a.json", 10), list());
    }

    @Test
    public void ecritUnFichierVide() throws Exception {
        assertEquals("ecrit", writeWhole("itineraires/vide.json", "", 4).type());
        assertEquals("", documents.read("itineraires/vide.json"));
        assertArrayEquals(new String[] { "vide.json" }, documents.names("itineraires"));
    }

    // ---------- remplacement ----------

    @Test
    public void remplaceUnFichierSansToucherLOriginalAvantValider() throws Exception {
        root = rootIn("Gtracker");
        documents.put("Gtracker/sessions/a.json", "ancien contenu");
        assertEquals("fait", write("sessions/a.json", 0, 9, "nouv").type());
        assertArrayEquals(new String[] { "a.json", "a.json.gtracker-tmp" }, documents.names("Gtracker/sessions"));
        assertEquals("ancien contenu", documents.read("Gtracker/sessions/a.json"));
        // Une liste en pleine écriture montre l'original, sans toucher au provisoire.
        assertEquals(files("sessions/a.json", 14), list());
        assertEquals("fait", write("sessions/a.json", 4, 9, "eau !").type());
        assertEquals("ancien contenu", documents.read("Gtracker/sessions/a.json"));
        assertEquals("ecrit", commit("sessions/a.json", 9).type());
        assertEquals("nouveau !", documents.read("Gtracker/sessions/a.json"));
        assertArrayEquals(new String[] { "a.json" }, documents.names("Gtracker/sessions"));
    }

    @Test
    public void remplaceUnFichierDeLaRacineDeLaMemoire() throws Exception {
        root = rootIn("Gtracker");
        documents.put("Gtracker/gtracker.json", "{\"v\":1}");
        assertEquals("ecrit", writeWhole("gtracker.json", "{\"v\":22}", 3).type());
        assertEquals("{\"v\":22}", documents.read("Gtracker/gtracker.json"));
        assertArrayEquals(new String[] { "gtracker.json" }, documents.names("Gtracker"));
        assertArrayEquals(new String[] { "Gtracker" }, documents.names(""));
    }

    // ---------- coupure ----------

    @Test
    public void uneCoupureEffaceLeProvisoireEtGardeLOriginal() throws Exception {
        // Création coupée après un bloc sur deux.
        assertEquals("fait", write("sessions/neuf.json", 0, 8, "1234").type());
        commands.abandon();
        assertArrayEquals(new String[0], documents.names("sessions"));
        // Remplacement coupé de même.
        documents.put("sessions/a.json", "ancien");
        assertEquals("fait", write("sessions/a.json", 0, 8, "1234").type());
        commands.abandon();
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
        assertEquals("ancien", documents.read("sessions/a.json"));
        // La suite de l'écriture coupée n'est plus admise.
        assertError(ComputerLinkProtocol.ERROR_UNKNOWN, write("sessions/a.json", 4, 8, "5678"));
        assertEquals("ancien", documents.read("sessions/a.json"));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
    }

    @Test
    public void unNouveauPremierBlocAbandonneLEcritureNonValidee() throws Exception {
        documents.put("sessions/a.json", "ancien");
        assertEquals("fait", write("sessions/neuf.json", 0, 8, "1234").type());
        assertEquals("fait", write("sessions/a.json", 0, 3, "abc").type());
        assertArrayEquals(new String[] { "a.json", "a.json.gtracker-tmp" }, documents.names("sessions"));
        assertError(ComputerLinkProtocol.ERROR_UNKNOWN, write("sessions/neuf.json", 4, 8, "5678"));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
        assertEquals("ancien", documents.read("sessions/a.json"));
    }

    /**
     * Ce qu'un arrêt brutal de l'application laisse dans le dossier (provisoires sans écriture qui les tienne), remis
     * en ordre par la liste d'une liaison suivante : création interrompue effacée, remplacement interrompu avant le
     * retrait de l'original défait, après lui terminé.
     */
    @Test
    public void listerRemetEnOrdreCeQuUnArretBrutalALaisse() throws Exception {
        documents.put("sessions/x.json.gtracker-new", "moit");
        documents.put("sessions/a.json", "ancien");
        documents.put("sessions/a.json.gtracker-tmp", "nouv");
        documents.put("sessions/b.json.gtracker-tmp", "complet");
        documents.put("fc-repos.json.gtracker-tmp", "[1,2]");
        commands = newCommands();
        assertEquals(files("fc-repos.json", 5, "sessions/a.json", 6, "sessions/b.json", 7), list());
        assertArrayEquals(new String[] { "a.json", "b.json" }, documents.names("sessions"));
        assertEquals("ancien", documents.read("sessions/a.json"));
        assertEquals("complet", documents.read("sessions/b.json"));
        assertEquals("[1,2]", documents.read("fc-repos.json"));
    }

    // ---------- effacement ----------

    @Test
    public void effaceLeFichierEtLeProvisoireLaisseACote() throws Exception {
        documents.put("sessions/a.json", "ancien");
        documents.put("sessions/a.json.gtracker-tmp", "nouv");
        documents.put("sessions/garde.json", "reste");
        assertEquals("fait", erase("sessions/a.json").type());
        assertArrayEquals(new String[] { "garde.json" }, documents.names("sessions"));
        // Un fichier absent, ou dans un dossier absent, est déjà effacé ; le dossier n'est pas créé.
        assertEquals("fait", erase("sessions/absent.json").type());
        assertEquals("fait", erase("itineraires/absent.json").type());
        assertArrayEquals(new String[] { "sessions" }, documents.names(""));
        assertEquals("reste", documents.read("sessions/garde.json"));
    }

    @Test
    public void effacerAbandonneLEcritureDuMemeCheminSeulement() throws Exception {
        documents.put("sessions/a.json", "ancien");
        assertEquals("fait", write("sessions/a.json", 0, 8, "1234").type());
        assertEquals("fait", erase("sessions/a.json").type());
        assertArrayEquals(new String[0], documents.names("sessions"));
        assertError(ComputerLinkProtocol.ERROR_UNKNOWN, write("sessions/a.json", 4, 8, "5678"));
        assertArrayEquals(new String[0], documents.names("sessions"));
        // L'écriture d'un autre chemin continue.
        assertEquals("fait", write("sessions/c.json", 0, 8, "1234").type());
        assertEquals("fait", erase("sessions/d.json").type());
        assertEquals("fait", write("sessions/c.json", 4, 8, "5678").type());
        assertEquals("ecrit", commit("sessions/c.json", 8).type());
        assertEquals("12345678", documents.read("sessions/c.json"));
    }

    // ---------- chemins refusés ----------

    /** Le refus d'un chemin, dès la relecture de la trame : rien n'arrive jusqu'aux commandes. */
    private String refusalOf(Map<String, Object> header, byte[] body) {
        try {
            commands.answer(incoming(header, body), root);
        } catch (FrameException e) {
            return e.reason;
        }
        fail("chemin admis : " + header);
        return null;
    }

    @Test
    public void refuseLesCheminsHorsDesDossiersPermis() throws Exception {
        documents.put("sessions/a.json", "ancien");
        documents.put("corbeille/x", "jeté");
        String[] refused = {
            "../x", "sessions/../gtracker.json", "corbeille/x", "a/b/c", "sessions/CON.gpx", "/gtracker.json",
            "sessions/a.json.gtracker-tmp", "sessions/", "Gtracker.json", "sessions\\a.json", "autre.json",
        };
        for (String path : refused) {
            Map<String, Object> w = header("ecrire");
            w.put("chemin", path);
            w.put("debut", 0L);
            w.put("taille", 2L);
            assertEquals(path, ComputerLinkProtocol.INVALID_MESSAGE, refusalOf(w, utf8("xy")));
            Map<String, Object> v = header("valider");
            v.put("chemin", path);
            v.put("taille", 2L);
            assertEquals(path, ComputerLinkProtocol.INVALID_MESSAGE, refusalOf(v, new byte[0]));
            Map<String, Object> e = header("effacer");
            e.put("chemin", path);
            assertEquals(path, ComputerLinkProtocol.INVALID_MESSAGE, refusalOf(e, new byte[0]));
        }
        for (String path : new String[] { "../x", "corbeille/x", "a/b/c", "sessions/../gtracker.json", "sessions/a.json.gtracker-tmp" }) {
            Map<String, Object> r = header("lire");
            r.put("chemin", path);
            r.put("debut", 0L);
            r.put("longueur", 10L);
            assertEquals(path, ComputerLinkProtocol.INVALID_MESSAGE, refusalOf(r, new byte[0]));
        }
        assertArrayEquals(new String[] { "corbeille", "sessions" }, documents.names(""));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
        assertEquals("jeté", documents.read("corbeille/x"));
        assertArrayEquals(new String[] { "memoire" }, folder.getRoot().list());
    }

    @Test
    public void unSousDossierDeLaMemoireRefuseNeDesigneRien() throws Exception {
        documents.put("gtracker.json", "racine");
        for (String base : new String[] { "../dehors", "a/../..", "/Gtracker", "Gtracker/", "C:\\Gtracker" }) {
            root = rootIn(base);
            assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, send(header("lister"), new byte[0]));
            assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, write("gtracker.json", 0, 2, "xy"));
            assertEquals("fait", erase("gtracker.json").type());
        }
        assertArrayEquals(new String[] { "gtracker.json" }, documents.names(""));
        assertEquals("racine", documents.read("gtracker.json"));
        assertArrayEquals(new String[] { "memoire" }, folder.getRoot().list());
    }

    // ---------- ordre inconnu ----------

    @Test
    public void refuseUnOrdreInconnu() throws Exception {
        // Un message que le PC n'envoie qu'à l'accueil, plus une fois relié.
        Map<String, Object> welcome = new LinkedHashMap<>();
        welcome.put("type", "bienvenue");
        welcome.put("identifiantPc", "00112233445566778899aabbccddeeff");
        welcome.put("nomPc", "PC");
        assertEquals(ComputerLinkProtocol.UNKNOWN_MESSAGE, refusalOf(welcome, new byte[0]));
        // Un type que personne n'envoie : refusé dès la relecture de la trame.
        assertEquals(ComputerLinkProtocol.UNKNOWN_MESSAGE, refusalOf(header("formater"), new byte[0]));
        assertArrayEquals(new String[0], documents.names(""));
    }

    // ---------- garde-fous ----------

    @Test
    public void pendantUnEnregistrementRienNEstEcritNiEfface() throws Exception {
        documents.put("sessions/a.json", "ancien");
        assertEquals("fait", write("sessions/a.json", 0, 8, "1234").type());
        recording.set(true);
        // L'écriture commencée est abandonnée au premier ordre refusé.
        assertError(ComputerLinkProtocol.ERROR_PERMISSION, write("sessions/a.json", 4, 8, "5678"));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
        assertError(ComputerLinkProtocol.ERROR_PERMISSION, write("sessions/b.json", 0, 2, "xy"));
        assertError(ComputerLinkProtocol.ERROR_PERMISSION, erase("sessions/a.json"));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
        assertEquals("ancien", documents.read("sessions/a.json"));
        Frame pong = send(header("ping"), new byte[0]);
        assertEquals("pong", pong.type());
        assertEquals(Boolean.TRUE, pong.header.get("enregistre"));
        // Un fichier entier reçu, puis l'enregistrement commence avant `valider` : rien n'est mis en place.
        recording.set(false);
        assertEquals("fait", write("sessions/a.json", 0, 4, "1234").type());
        recording.set(true);
        assertError(ComputerLinkProtocol.ERROR_PERMISSION, commit("sessions/a.json", 4));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
        assertEquals("ancien", documents.read("sessions/a.json"));
        recording.set(false);
        assertError(ComputerLinkProtocol.ERROR_UNKNOWN, commit("sessions/a.json", 4));
    }

    @Test
    public void unBlocHorsDOrdreAbandonneLEcriture() throws Exception {
        documents.put("sessions/a.json", "ancien");
        // Sans écriture ouverte.
        assertError(ComputerLinkProtocol.ERROR_UNKNOWN, write("sessions/a.json", 4, 8, "5678"));
        // Un trou, une autre taille annoncée, un autre chemin.
        for (int variant = 0; variant < 3; variant++) {
            assertEquals("fait", write("sessions/a.json", 0, 10, "123456").type());
            Frame f;
            if (variant == 0) f = write("sessions/a.json", 8, 10, "90");
            else if (variant == 1) f = write("sessions/a.json", 6, 11, "7890");
            else f = write("sessions/b.json", 6, 10, "7890");
            assertError(ComputerLinkProtocol.ERROR_UNKNOWN, f);
            assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
            assertEquals("ancien", documents.read("sessions/a.json"));
        }
    }

    @Test
    public void validerDemandeLeCheminLaTailleEtTousLesOctets() throws Exception {
        documents.put("sessions/a.json", "ancien");
        // Rien en cours.
        assertError(ComputerLinkProtocol.ERROR_UNKNOWN, commit("sessions/a.json", 6));
        // Avant le dernier bloc, avec une autre taille, pour un autre chemin.
        String[] cases = { "partiel", "taille", "chemin" };
        for (String c : cases) {
            assertEquals("fait", write("sessions/a.json", 0, 10, "123456").type());
            if (!c.equals("partiel")) assertEquals("fait", write("sessions/a.json", 6, 10, "7890").type());
            Frame f = c.equals("taille") ? commit("sessions/a.json", 12) : commit(c.equals("chemin") ? "sessions/b.json" : "sessions/a.json", 10);
            assertError(ComputerLinkProtocol.ERROR_UNKNOWN, f);
            assertArrayEquals(c, new String[] { "a.json" }, documents.names("sessions"));
            assertEquals("ancien", documents.read("sessions/a.json"));
        }
    }

    @Test
    public void sansDossierMemoireRienNEstLuNiEcrit() throws Exception {
        root = null;
        assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, send(header("lister"), new byte[0]));
        assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, read("gtracker.json", 0, 10));
        assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, write("gtracker.json", 0, 2, "xy"));
        assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, erase("gtracker.json"));
        // Un sous-dossier de la mémoire désigné mais absent n'est pas créé.
        root = rootIn("Gtracker");
        assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, send(header("lister"), new byte[0]));
        assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, write("sessions/a.json", 0, 2, "xy"));
        assertArrayEquals(new String[0], documents.names(""));
    }

    @Test
    public void unDossierAuNomDuFichierNEstPasRemplace() throws Exception {
        documents.put("sessions/a.json/dedans.json", "garde");
        assertError(ComputerLinkProtocol.ERROR_UNKNOWN, write("sessions/a.json", 0, 2, "xy"));
        assertEquals("garde", documents.read("sessions/a.json/dedans.json"));
        assertArrayEquals(new String[] { "a.json" }, documents.names("sessions"));
    }

    // ---------- fournisseur sans renommage ----------

    @Test
    public void sansRenommageLeContenuEstRecopieSansResteDeLAncien() throws Exception {
        documents.renames = false;
        documents.put("sessions/a.json", "un ancien contenu bien plus long");
        assertEquals("ecrit", writeWhole("sessions/a.json", "court", 3).type());
        assertEquals("court", documents.read("sessions/a.json"));
        assertEquals("ecrit", writeWhole("sessions/neuf.json", "tout neuf", 4).type());
        assertEquals("tout neuf", documents.read("sessions/neuf.json"));
        assertArrayEquals(new String[] { "a.json", "neuf.json" }, documents.names("sessions"));
        assertEquals(files("sessions/a.json", 5, "sessions/neuf.json", 9), list());
    }

    @Test
    public void renommageAnnoncePuisRefuseLeContenuEstRecopie() throws Exception {
        documents.refusesRename = true;
        documents.put("sessions/a.json", "un ancien contenu bien plus long");
        assertEquals("ecrit", writeWhole("sessions/a.json", "court", 3).type());
        assertEquals("court", documents.read("sessions/a.json"));
        assertEquals("ecrit", writeWhole("sessions/neuf.json", "tout neuf", 4).type());
        assertEquals("tout neuf", documents.read("sessions/neuf.json"));
        assertArrayEquals(new String[] { "a.json", "neuf.json" }, documents.names("sessions"));
    }

    // ---------- lecture ----------

    @Test
    public void litParBlocsEtNAnnonceLeFichierQuAuDernierOctet() throws Exception {
        root = rootIn("Gtracker");
        byte[] content = new byte[2500];
        for (int i = 0; i < content.length; i++) content[i] = (byte) ('a' + i % 26);
        documents.put("Gtracker/sessions/s.gpx", new String(content, StandardCharsets.UTF_8));
        int before = exchanges.get();
        for (int start = 0; start < 2500; start += 1024) {
            Frame f = read("sessions/s.gpx", start, 1024);
            assertEquals("bloc", f.type());
            int expected = Math.min(1024, 2500 - start);
            assertEquals((double) start, (Double) f.header.get("debut"), 0);
            assertEquals((double) expected, (Double) f.header.get("longueur"), 0);
            assertArrayEquals(Arrays.copyOfRange(content, start, start + expected), f.body);
            assertEquals(start + expected == 2500 ? 1 : 0, sent.get());
        }
        // Au-delà de la fin : un bloc vide, sans nouvelle annonce.
        Frame end = read("sessions/s.gpx", 2500, 1024);
        assertEquals(0.0, (Double) end.header.get("longueur"), 0);
        assertEquals(0, end.body.length);
        assertEquals(1, sent.get());
        assertError(ComputerLinkProtocol.ERROR_NOT_FOUND, read("sessions/absent.gpx", 0, 1024));
        assertEquals(before + 5, exchanges.get());
        // `ping` n'est pas une demande : il ne compte pas comme un échange.
        Frame pong = send(header("ping"), new byte[0]);
        assertEquals(Boolean.FALSE, pong.header.get("enregistre"));
        assertEquals(before + 5, exchanges.get());
    }

    @Test
    public void listerNeMontreQueLesFichiersDesDossiersPermis() throws Exception {
        documents.put("gtracker.json", "{}");
        documents.put("sessions/a.json", "abc");
        documents.put("sessions/sous/b.json", "x");
        documents.put("itineraires/i.json", "ij");
        documents.put("corbeille/c.json", "cc");
        documents.put("photos/p.jpg", "pp");
        assertEquals(files("gtracker.json", 2, "itineraires/i.json", 2, "sessions/a.json", 3), list());
    }
}
