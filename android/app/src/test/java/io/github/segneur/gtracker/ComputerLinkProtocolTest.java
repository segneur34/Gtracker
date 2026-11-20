package io.github.segneur.gtracker;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import io.github.segneur.gtracker.ComputerLinkProtocol.Endpoint;
import io.github.segneur.gtracker.ComputerLinkProtocol.Frame;
import io.github.segneur.gtracker.ComputerLinkProtocol.FrameDecoder;
import io.github.segneur.gtracker.ComputerLinkProtocol.FrameException;
import io.github.segneur.gtracker.ComputerLinkProtocol.Incoming;
import io.github.segneur.gtracker.ComputerLinkProtocol.Json;
import io.github.segneur.gtracker.ComputerLinkProtocol.ProbeAnswer;
import io.github.segneur.gtracker.ComputerLinkProtocol.RemoteFile;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.BeforeClass;
import org.junit.Test;

/**
 * La liaison sans fil côté téléphone, éprouvée sur les jeux d'essai que les tests du PC relisent aussi
 * (bureau/sansFil.vecteurs.json, lu dans le dépôt sans copie) : trames valides et invalides, preuves d'appairage,
 * hachage du jeton, paquets de la découverte ; puis ce que le téléphone ajoute de son côté (messages reçus, chemins
 * demandés, adresses, JSON strict).
 */
public class ComputerLinkProtocolTest {

    private static Map<String, Object> vectors;

    /** Le fichier des jeux d'essai, cherché en remontant depuis le dossier où Gradle lance les tests (android/app). */
    @BeforeClass
    public static void readVectors() throws Exception {
        File dir = new File(System.getProperty("user.dir")).getAbsoluteFile();
        File found = null;
        for (File d = dir; d != null && found == null; d = d.getParentFile()) {
            File candidate = new File(d, "bureau/sansFil.vecteurs.json");
            if (candidate.isFile()) found = candidate;
        }
        assertNotNull("bureau/sansFil.vecteurs.json introuvable au-dessus de " + dir, found);
        vectors = map(Json.parse(new String(Files.readAllBytes(found.toPath()), StandardCharsets.UTF_8)));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object v) {
        return (Map<String, Object>) v;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Object v) {
        return (List<Object>) v;
    }

    private static byte[] hex(Object text) {
        String s = (String) text;
        byte[] out = new byte[s.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
        return out;
    }

    private static List<Frame> decodeAll(byte[] bytes, ComputerLinkProtocol.Limits limits) throws FrameException {
        FrameDecoder decoder = new FrameDecoder(limits);
        List<Frame> frames = decoder.push(bytes, 0, bytes.length);
        decoder.end();
        return frames;
    }

    private static Frame frameOf(String json, byte[] body) throws Exception {
        return new Frame(map(Json.parse(json)), body);
    }

    private static String reasonOf(Runnable action) {
        try {
            action.run();
        } catch (Failure f) {
            return f.reason;
        }
        return null;
    }

    /** Une `FrameException` passée dans une exception non vérifiée, pour les tableaux de cas. */
    private static final class Failure extends RuntimeException {
        final String reason;

        Failure(FrameException e) {
            super(e);
            reason = e.reason;
        }
    }

    private static String readReason(String json, byte[] body) {
        return reasonOf(() -> {
            try {
                ComputerLinkProtocol.readMessage(frameOf(json, body));
            } catch (FrameException e) {
                throw new Failure(e);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    // ---------- jeux d'essai communs ----------

    @Test
    public void tramesDuPcDecodeesEtReencodeesOctetPourOctet() throws Exception {
        for (Object o : list(vectors.get("trames"))) {
            Map<String, Object> v = map(o);
            byte[] bytes = hex(v.get("octetsHex"));
            List<Frame> frames = decodeAll(bytes, ComputerLinkProtocol.LIMITS);
            assertEquals((String) v.get("nom"), 1, frames.size());
            assertEquals((String) v.get("nom"), v.get("enTete"), frames.get(0).header);
            assertArrayEquals((String) v.get("nom"), hex(v.get("corpsHex")), frames.get(0).body);
            assertArrayEquals((String) v.get("nom"), bytes, ComputerLinkProtocol.encodeFrame(map(v.get("enTete")), hex(v.get("corpsHex")), ComputerLinkProtocol.LIMITS));
        }
    }

    @Test
    public void tramesRecuesOctetParOctetEtToutesEnUnSeulMorceau() throws Exception {
        List<Object> all = list(vectors.get("trames"));
        java.io.ByteArrayOutputStream stream = new java.io.ByteArrayOutputStream();
        for (Object o : all) stream.write(hex(map(o).get("octetsHex")));
        byte[] bytes = stream.toByteArray();

        FrameDecoder byByte = new FrameDecoder(ComputerLinkProtocol.LIMITS);
        List<Frame> frames = new ArrayList<>();
        for (byte b : bytes) frames.addAll(byByte.push(new byte[] { b }, 0, 1));
        byByte.end();
        assertEquals(all.size(), frames.size());

        List<Frame> together = decodeAll(bytes, ComputerLinkProtocol.LIMITS);
        assertEquals(all.size(), together.size());
        for (int i = 0; i < all.size(); i++) {
            assertEquals(map(all.get(i)).get("enTete"), frames.get(i).header);
            assertEquals(map(all.get(i)).get("enTete"), together.get(i).header);
        }
    }

    @Test
    public void tramesInvalidesRefuseesAvecLaRaisonDuPc() {
        for (Object o : list(vectors.get("tramesInvalides"))) {
            Map<String, Object> v = map(o);
            byte[] bytes = hex(v.get("octetsHex"));
            FrameDecoder decoder = new FrameDecoder(ComputerLinkProtocol.LIMITS);
            String reason = null;
            boolean atPush = false;
            try {
                decoder.push(bytes, 0, bytes.length);
                decoder.end();
            } catch (FrameException e) {
                reason = e.reason;
            }
            try {
                decoder.push(new byte[0], 0, 0);
            } catch (FrameException e) {
                atPush = true;
            }
            assertEquals((String) v.get("nom"), v.get("erreur"), reason);
            assertTrue((String) v.get("nom") + " : décodeur hors d'usage après l'erreur", atPush);
        }
    }

    @Test
    public void tronqueeSeulementQuandLeFluxSArrete() throws Exception {
        byte[] ping = hex("00000016000000007b2274797065223a2270696e67222c226964223a31");
        FrameDecoder decoder = new FrameDecoder(ComputerLinkProtocol.LIMITS);
        assertEquals(0, decoder.push(ping, 0, ping.length).size());
        assertEquals(1, decoder.push(new byte[] { 0x7d }, 0, 1).size());
        decoder.end();
    }

    @Test
    public void preuvesDAppairageDuPc() {
        for (Object o : list(vectors.get("appairage"))) {
            Map<String, Object> v = map(o);
            String code = (String) v.get("code");
            byte[] fp = hex(v.get("empreinteHex"));
            byte[] nt = hex(v.get("nonceTelephoneHex"));
            byte[] np = hex(v.get("noncePcHex"));
            assertEquals(v.get("preuveTelephoneHex"), ComputerLinkProtocol.toHex(ComputerLinkProtocol.phoneProof(code, fp, nt, np)));
            assertEquals(v.get("preuvePcHex"), ComputerLinkProtocol.toHex(ComputerLinkProtocol.pcProof(code, fp, nt, np)));
        }
    }

    @Test
    public void hachageDuJeton() {
        for (Object o : list(vectors.get("jetons"))) {
            Map<String, Object> v = map(o);
            assertEquals(v.get("hachageHex"), ComputerLinkProtocol.tokenHash(hex(v.get("jetonHex"))));
        }
    }

    @Test
    public void questionsEtReponsesDeLaDecouverte() {
        Map<String, Object> sondes = map(vectors.get("sondes"));
        for (Object o : list(sondes.get("questions"))) {
            Map<String, Object> v = map(o);
            byte[] bytes = hex(v.get("octetsHex"));
            assertArrayEquals(bytes, ComputerLinkProtocol.encodeQuestion(hex(v.get("nonceHex"))));
            assertArrayEquals(hex(v.get("nonceHex")), ComputerLinkProtocol.decodeQuestion(bytes));
            assertNull(ComputerLinkProtocol.decodeAnswer(bytes));
        }
        for (Object o : list(sondes.get("reponses"))) {
            Map<String, Object> v = map(o);
            byte[] bytes = hex(v.get("octetsHex"));
            int port = ((Double) v.get("port")).intValue();
            ProbeAnswer answer = new ProbeAnswer(hex(v.get("nonceHex")), port, hex(v.get("identifiantHex")), (String) v.get("nom"));
            assertArrayEquals(bytes, ComputerLinkProtocol.encodeAnswer(answer));
            ProbeAnswer read = ComputerLinkProtocol.decodeAnswer(bytes);
            assertNotNull(read);
            assertArrayEquals(answer.nonce, read.nonce);
            assertEquals(port, read.port);
            assertArrayEquals(answer.computerId, read.computerId);
            assertEquals(answer.name, read.name);
            assertNull(ComputerLinkProtocol.decodeQuestion(bytes));
        }
        for (Object o : list(sondes.get("etrangers"))) {
            Map<String, Object> v = map(o);
            byte[] bytes = hex(v.get("octetsHex"));
            assertNull((String) v.get("nom"), ComputerLinkProtocol.decodeQuestion(bytes));
            assertNull((String) v.get("nom"), ComputerLinkProtocol.decodeAnswer(bytes));
        }
    }

    /** La trame d'un jeu d'essai, par son nom. */
    private static byte[] vectorFrame(String name) {
        for (Object o : list(vectors.get("trames"))) if (name.equals(map(o).get("nom"))) return hex(map(o).get("octetsHex"));
        throw new AssertionError("jeu d'essai absent : " + name);
    }

    @Test
    public void messagesDuTelephoneEcritsCommeLeFaitLePc() throws Exception {
        assertArrayEquals(vectorFrame("appairer"), ComputerLinkProtocol.encodePair("Pixel 8", hex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")));
        assertArrayEquals(vectorFrame("bloc de 5 octets"), ComputerLinkProtocol.encodeBlock(7, 0, "hello-et-plus".getBytes(StandardCharsets.UTF_8), 5));
        List<RemoteFile> files = Arrays.asList(new RemoteFile("sessions/été.gpx", 1234, 1790000000000L));
        assertArrayEquals(vectorFrame("liste, chemin accentué"), ComputerLinkProtocol.encodeList(2, files));
    }

    // ---------- messages reçus du PC ----------

    @Test
    public void commandesDuPcLues() throws Exception {
        Incoming lire = ComputerLinkProtocol.readMessage(decodeAll(vectorFrame("lire, deuxième bloc"), ComputerLinkProtocol.WELCOME_LIMITS).get(0));
        assertEquals("lire", lire.type);
        assertEquals(7, lire.id);
        assertEquals("sessions/2026-11-20.gpx", lire.path);
        assertEquals(1048576, lire.start);
        assertEquals(1048576, lire.length);
        assertEquals(1, ComputerLinkProtocol.readMessage(decodeAll(vectorFrame("ping"), ComputerLinkProtocol.WELCOME_LIMITS).get(0)).id);
        assertEquals("code", ComputerLinkProtocol.readMessage(decodeAll(vectorFrame("refus"), ComputerLinkProtocol.WELCOME_LIMITS).get(0)).reason);
        // Un entier écrit 1.0 est un entier pour JSON.parse comme ici.
        assertEquals(3, ComputerLinkProtocol.readMessage(frameOf("{\"type\":\"lister\",\"id\":3.0}", new byte[0])).id);

        String id16 = "101112131415161718191a1b1c1d1e1f";
        String h32 = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
        Incoming appaire = ComputerLinkProtocol.readMessage(frameOf(
            "{\"type\":\"appaire\",\"preuve\":\"" + h32 + "\",\"jeton\":\"" + h32 + "\",\"identifiantPc\":\"" + id16 + "\",\"nomPc\":\"Bureau\",\"inconnu\":true}", new byte[0]));
        assertEquals("Bureau", appaire.computerName);
        assertArrayEquals(hex(id16), appaire.computerId);
        assertArrayEquals(hex(h32), appaire.token);
    }

    @Test
    public void messagesDuPcMalFormesRefuses() {
        String inv = ComputerLinkProtocol.INVALID_MESSAGE;
        String unk = ComputerLinkProtocol.UNKNOWN_MESSAGE;
        assertEquals(unk, readReason("{\"type\":\"liste\",\"id\":1,\"fichiers\":[]}", new byte[0]));
        assertEquals(unk, readReason("{\"type\":\"bloc\",\"id\":1,\"debut\":0,\"longueur\":0}", new byte[0]));
        assertEquals(unk, readReason("{\"type\":\"ecrire\",\"id\":1}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"ping\",\"id\":1}", new byte[] { 1 }));
        assertEquals(inv, readReason("{\"type\":\"ping\"}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"ping\",\"id\":\"1\"}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"ping\",\"id\":-1}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"ping\",\"id\":1.5}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"ping\",\"id\":2147483648}", new byte[0]));
        assertNull(readReason("{\"type\":\"ping\",\"id\":2147483647}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"lire\",\"id\":1,\"chemin\":\"a.gpx\",\"debut\":0,\"longueur\":0}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"lire\",\"id\":1,\"chemin\":\"a.gpx\",\"debut\":0,\"longueur\":1048577}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"lire\",\"id\":1,\"chemin\":\"a.gpx\",\"debut\":9007199254740992,\"longueur\":1}", new byte[0]));
        assertNull(readReason("{\"type\":\"lire\",\"id\":1,\"chemin\":\"a.gpx\",\"debut\":9007199254740991,\"longueur\":1048576}", new byte[0]));
        for (String path : new String[] { "../a.gpx", "sessions/../../a", "/a.gpx", "sessions/a/b.gpx", "autre/a.gpx", "sessions/a.gpx.gtracker-tmp", "A.GTRACKER-NEW", "CON.txt", "a.", "c:x", "sessions\\a.gpx", "", "sessions/" }) {
            assertEquals(path, inv, readReason("{\"type\":\"lire\",\"id\":1,\"chemin\":" + Json.write(path) + ",\"debut\":0,\"longueur\":1}", new byte[0]));
        }
        assertEquals(inv, readReason("{\"type\":\"defi\",\"noncePc\":\"00\"}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"defi\",\"noncePc\":\"000102030405060708090A0B0C0D0E0F101112131415161718191a1b1c1d1e1f\"}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"refus\",\"raison\":\"autre\"}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"bienvenue\",\"identifiantPc\":\"101112131415161718191a1b1c1d1e1f\",\"nomPc\":\"\"}", new byte[0]));
        assertEquals(inv, readReason("{\"type\":\"bienvenue\",\"identifiantPc\":\"101112131415161718191a1b1c1d1e1f\",\"nomPc\":\"a\\u0085b\"}", new byte[0]));
    }

    @Test
    public void limitesDeLAccueilSansCorpsEtEnTeteCourt() {
        byte[] withBody = hex("0000000f00000001");
        String reason = null;
        try {
            new FrameDecoder(ComputerLinkProtocol.WELCOME_LIMITS).push(withBody, 0, withBody.length);
        } catch (FrameException e) {
            reason = e.reason;
        }
        assertEquals(ComputerLinkProtocol.BODY_TOO_LONG, reason);
        byte[] longHeader = hex("0000400100000000");
        try {
            new FrameDecoder(ComputerLinkProtocol.WELCOME_LIMITS).push(longHeader, 0, longHeader.length);
            fail();
        } catch (FrameException e) {
            assertEquals(ComputerLinkProtocol.HEADER_TOO_LONG, e.reason);
        }
    }

    // ---------- chemins et fichiers ----------

    @Test
    public void cheminsAdmis() {
        for (String ok : new String[] { "a.gpx", "sessions/2026-11-20.gpx", "sessions/été.json", "index.json", "sessions/x.imu" }) {
            assertTrue(ok, ComputerLinkProtocol.pathAllowed(ok));
        }
        for (String no : new String[] { "sessions/a/b", "x/a.gpx", "..", ".", "a/", "/a", "a//b", "nul", "Com1.json", "lpt¹.txt", "a ", "a?b", "a\u0001b", "a\u007fb", "x.gtracker-tmp", "sessions/x.Gtracker-New" }) {
            assertFalse(no, ComputerLinkProtocol.pathAllowed(no));
        }
        // « sessions » seul est un nom admis, comme côté PC : c'est la lecture qui refuse un dossier (NOT_FOUND).
        assertTrue(ComputerLinkProtocol.pathAllowed("sessions"));
    }

    @Test
    public void fichiersListesTriesSansDoublonNiTemporaire() {
        List<RemoteFile> files = Arrays.asList(
            new RemoteFile("sessions/b.gpx", 10, 1),
            new RemoteFile("index.json", 5, 2),
            new RemoteFile("sessions/a.gpx", 7, 3),
            new RemoteFile("sessions/a.gpx.gtracker-tmp", 7, 3),
            new RemoteFile("sessions/d.gpx", 1, 4),
            new RemoteFile("sessions/d.gpx", 2, 4),
            new RemoteFile("sessions/n.gpx", -1, 4)
        );
        List<RemoteFile> kept = ComputerLinkProtocol.allowedFiles(files);
        List<String> paths = new ArrayList<>();
        for (RemoteFile f : kept) paths.add(f.path);
        assertEquals(Arrays.asList("index.json", "sessions/a.gpx", "sessions/b.gpx"), paths);
    }

    @Test
    public void erreurCoupeeEtCodeInconnuRendu() throws Exception {
        StringBuilder longText = new StringBuilder();
        for (int i = 0; i < 600; i++) longText.append('x');
        Frame frame = decodeAll(ComputerLinkProtocol.encodeError(4, "TOO_LARGE", longText.toString()), ComputerLinkProtocol.LIMITS).get(0);
        assertEquals("erreur", frame.type());
        assertEquals("UNKNOWN", frame.header.get("code"));
        assertEquals(500, ((String) frame.header.get("message")).length());
        assertEquals(4.0, frame.header.get("id"));
        assertEquals("NOT_FOUND", decodeAll(ComputerLinkProtocol.encodeError(1, "NOT_FOUND", "absent"), ComputerLinkProtocol.LIMITS).get(0).header.get("code"));
        Frame pong = decodeAll(ComputerLinkProtocol.encodePong(9), ComputerLinkProtocol.LIMITS).get(0);
        assertEquals("pong", pong.type());
        assertEquals(9.0, pong.header.get("id"));
    }

    // ---------- appairage ----------

    @Test
    public void seulUnRefusDuJetonSurLiaisonEpingleeOublieLAppairage() {
        assertTrue(ComputerLinkProtocol.refusalForgetsPairing(ComputerLinkProtocol.REFUSED_TOKEN, true));
        // Pendant un appairage, un faux PC qui répond « jeton » n'efface rien.
        assertFalse(ComputerLinkProtocol.refusalForgetsPairing(ComputerLinkProtocol.REFUSED_TOKEN, false));
        String[] others = { ComputerLinkProtocol.REFUSED_CODE, ComputerLinkProtocol.REFUSED_WINDOW, ComputerLinkProtocol.REFUSED_NONCE,
            ComputerLinkProtocol.REFUSED_VERSION, "autre", null };
        for (String reason : others) {
            assertFalse(String.valueOf(reason), ComputerLinkProtocol.refusalForgetsPairing(reason, true));
            assertFalse(String.valueOf(reason), ComputerLinkProtocol.refusalForgetsPairing(reason, false));
        }
    }

    @Test
    public void codeDeSixChiffresSeulement() {
        assertTrue(ComputerLinkProtocol.codeAllowed("042917"));
        for (String no : new String[] { "42917", "0429170", "04291a", "０４２９１７", " 42917", null }) assertFalse(String.valueOf(no), ComputerLinkProtocol.codeAllowed(no));
        try {
            ComputerLinkProtocol.phoneProof("12345", new byte[32], new byte[32], new byte[32]);
            fail();
        } catch (IllegalArgumentException e) {
            // attendu
        }
        assertTrue(ComputerLinkProtocol.sameBytes(new byte[] { 1, 2 }, new byte[] { 1, 2 }));
        assertFalse(ComputerLinkProtocol.sameBytes(new byte[] { 1, 2 }, new byte[] { 1, 3 }));
        assertFalse(ComputerLinkProtocol.sameBytes(new byte[] { 1 }, new byte[] { 1, 2 }));
    }

    @Test
    public void hexadecimalMinusculeDeLaTailleDite() {
        assertArrayEquals(new byte[] { 0x0a, (byte) 0xff }, ComputerLinkProtocol.fromHex("0aff", 2));
        assertNull(ComputerLinkProtocol.fromHex("0AFF", 2));
        assertNull(ComputerLinkProtocol.fromHex("0aff", 3));
        assertNull(ComputerLinkProtocol.fromHex("0g", 1));
        assertEquals("0aff", ComputerLinkProtocol.toHex(new byte[] { 0x0a, (byte) 0xff }));
    }

    // ---------- adresses ----------

    @Test
    public void adressesPriveesSeulement() {
        Endpoint e = ComputerLinkProtocol.parseEndpoint(" 192.168.1.20 ");
        assertEquals("192.168.1.20:48217", e.toString());
        assertEquals("10.0.0.5:48218", ComputerLinkProtocol.parseEndpoint("10.0.0.5:48218").toString());
        assertEquals("172.16.0.1:48217", ComputerLinkProtocol.parseEndpoint("172.16.0.1").toString());
        assertEquals("172.31.255.255:48217", ComputerLinkProtocol.parseEndpoint("172.31.255.255").toString());
        for (String no : new String[] { "8.8.8.8", "172.15.0.1", "172.32.0.1", "169.254.1.1", "127.0.0.1", "100.64.0.1", "192.168.1.300", "192.168.1", "pc.local", "192.168.1.2:0", "192.168.1.2:70000", "192.168.1.2:", "192.168.01.2x", "" }) {
            assertNull(no, ComputerLinkProtocol.parseEndpoint(no));
        }
    }

    @Test
    public void adresseDeDiffusion() {
        long a = ComputerLinkProtocol.parseIpv4("192.168.1.20");
        assertEquals("192.168.1.255", ComputerLinkProtocol.broadcastAddress(a, 24));
        assertEquals("192.168.255.255", ComputerLinkProtocol.broadcastAddress(a, 16));
        assertEquals("192.168.1.23", ComputerLinkProtocol.broadcastAddress(a, 30));
        assertEquals("192.168.1.20", ComputerLinkProtocol.broadcastAddress(a, 32));
        assertEquals("255.255.255.255", ComputerLinkProtocol.broadcastAddress(a, 0));
    }

    @Test
    public void memeReseauEtInterfacesMobilesEcartees() {
        long pc = ComputerLinkProtocol.parseIpv4("192.168.137.1");
        long phone = ComputerLinkProtocol.parseIpv4("192.168.137.54");
        assertTrue(ComputerLinkProtocol.sameSubnet(pc, phone, 24));
        assertFalse(ComputerLinkProtocol.sameSubnet(pc, ComputerLinkProtocol.parseIpv4("192.168.43.1"), 24));
        assertTrue(ComputerLinkProtocol.sameSubnet(pc, ComputerLinkProtocol.parseIpv4("192.168.43.1"), 16));
        assertFalse(ComputerLinkProtocol.sameSubnet(pc, -1, 24));
        for (String mobile : new String[] { "rmnet_data0", "rev_rmnet0", "ccmni1", "pdp_ip0", "v4-rmnet_data0", "clat4", "tun0", "ppp0", "ipsec0", "dummy0", "lo", "seth_lte0", "wwan0", null }) {
            assertTrue(String.valueOf(mobile), ComputerLinkProtocol.mobileInterfaceName(mobile));
        }
        for (String local : new String[] { "wlan0", "wlan1", "ap0", "swlan0", "eth0", "rndis0", "bt-pan" }) {
            assertFalse(local, ComputerLinkProtocol.mobileInterfaceName(local));
        }
    }

    @Test
    public void nomDuTelephone() {
        assertEquals("Pixel 8", ComputerLinkProtocol.deviceName("  Pixel 8\n"));
        assertEquals("Android", ComputerLinkProtocol.deviceName("\u0001\u0002"));
        assertEquals("Android", ComputerLinkProtocol.deviceName(null));
        StringBuilder longName = new StringBuilder();
        for (int i = 0; i < 99; i++) longName.append('a');
        longName.append("\uD83D\uDE00");
        String name = ComputerLinkProtocol.deviceName(longName.toString());
        assertEquals(99, name.length());
        assertTrue(ComputerLinkProtocol.nameAllowed(name));
    }

    // ---------- JSON ----------

    @Test
    public void jsonStrictCommeJsonParse() throws Exception {
        for (String no : new String[] { "{'a':1}", "{a:1}", "[1,]", "{\"a\":1,}", "01", "1.", ".5", "+1", "\"\t\"", "\"\\x\"", "\"\\u12\"", "tru", "1 2", "\uFEFF{}", "{\"a\" 1}" }) {
            try {
                Json.parse(no);
                fail(no);
            } catch (Json.JsonException e) {
                // attendu
            }
        }
        StringBuilder deep = new StringBuilder();
        for (int i = 0; i < 100; i++) deep.append('[');
        for (int i = 0; i < 100; i++) deep.append(']');
        try {
            Json.parse(deep.toString());
            fail("imbrication");
        } catch (Json.JsonException e) {
            // attendu
        }
        Map<String, Object> m = map(Json.parse(" {\"a\":1,\"b\":[true,false,null],\"a\":\"\\u00e9\\/\"} "));
        assertEquals("é/", m.get("a"));
        assertEquals(Arrays.asList(Boolean.TRUE, Boolean.FALSE, Json.NULL), m.get("b"));
        assertEquals(-12.5e3, (Double) Json.parse("-12.5e3"), 0);
    }

    @Test
    public void jsonEcritCommeJsonStringify() {
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("type", "x");
        h.put("t", "a\"\\\n\u0001\u007f\uD800é\uD83D\uDE00");
        h.put("n", 1790000000000.0);
        h.put("l", 7L);
        assertEquals("{\"type\":\"x\",\"t\":\"a\\\"\\\\\\n\\u0001\u007f\\ud800é\uD83D\uDE00\",\"n\":1790000000000,\"l\":7}", Json.write(h));
    }
}
