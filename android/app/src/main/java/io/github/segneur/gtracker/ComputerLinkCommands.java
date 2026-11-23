package io.github.segneur.gtracker;

import android.content.ContentResolver;
import android.net.Uri;
import android.util.Log;
import io.github.segneur.gtracker.ComputerLinkPlugin.MemoryRoot;
import io.github.segneur.gtracker.ComputerLinkProtocol.FrameException;
import io.github.segneur.gtracker.ComputerLinkProtocol.Incoming;
import io.github.segneur.gtracker.ComputerLinkProtocol.RemoteFile;
import io.github.segneur.gtracker.ComputerLinkProtocol.WriteSession;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;

/**
 * Réponses du téléphone aux commandes du PC une fois relié (`ping`, `lister`, `lire`, `ecrire`, `valider`,
 * `effacer`), dans le dossier mémoire désigné, et l'écriture en cours de la liaison : une instance par liaison, que
 * seul le fil de la liaison touche. Le réseau, l'état rendu à la page et ses annonces restent dans ComputerLinkPlugin,
 * qui donne ici l'état « enregistre » (`recording`) et ce qu'il fait d'une demande du PC (`exchanged`) et d'un
 * fichier parti jusqu'à son dernier octet (`fileSent`).
 *
 * Rien n'est écrit ni effacé pendant un enregistrement (`erreur` PERMISSION). Un fichier arrive bloc par bloc dans
 * son provisoire (`.gtracker-new`, ou `.gtracker-tmp` s'il remplace un fichier), une écriture à la fois ; `valider`
 * relit la taille puis le met en place (MemoryWriter). Bloc hors d'ordre, taille fausse ou liaison coupée
 * (`abandon`) : provisoire effacé, original intact.
 */
final class ComputerLinkCommands {

    private static final String TAG = "GtrackerLiaison";

    private static final String RECORDING_REFUSAL = "Le téléphone enregistre une session : rien n'y est écrit ni effacé.";
    private static final String NO_MEMORY_FOLDER = "Aucun dossier mémoire désigné sur le téléphone.";

    private final ContentResolver resolver;
    /** Vrai pendant un enregistrement : le téléphone n'écrit ni n'efface rien pour le PC. */
    private final BooleanSupplier recording;
    /** Une demande du PC (hors `ping`) vient d'arriver. */
    private final Runnable exchanged;
    /** Un fichier vient de partir jusqu'à son dernier octet. */
    private final Runnable fileSent;

    /** Écriture en cours : l'ordre de ses blocs, son provisoire ouvert et qui l'écrit ; tous nuls sinon. */
    private WriteSession writing;
    private MemoryWriter.Provisional provisional;
    private MemoryWriter writer;

    ComputerLinkCommands(ContentResolver resolver, BooleanSupplier recording, Runnable exchanged, Runnable fileSent) {
        this.resolver = resolver;
        this.recording = recording;
        this.exchanged = exchanged;
        this.fileSent = fileSent;
    }

    /**
     * La réponse à une commande du PC, dans le dossier mémoire `root` (`null` si la page n'en a désigné aucun). Lève
     * `MESSAGE_INCONNU` sur un message que le PC n'envoie pas une fois relié.
     */
    byte[] answer(Incoming m, MemoryRoot root) throws FrameException {
        if (!"ping".equals(m.type)) exchanged.run();
        switch (m.type) {
            case "ping":
                return ComputerLinkProtocol.encodePong(m.id, recording.getAsBoolean());
            case "lister":
                return listFiles(root, m.id);
            case "lire":
                return readBlock(root, m);
            case "ecrire":
                return writeBlock(root, m);
            case "valider":
                return commitWrite(m);
            case "effacer":
                return eraseFile(root, m);
            default:
                throw new FrameException(ComputerLinkProtocol.UNKNOWN_MESSAGE, "Message inattendu une fois relié : " + m.type);
        }
    }

    /**
     * Réponse à `lister` : fichiers de la racine et des `LISTED_DIRS`, sans dossier ni provisoire. Chaque dossier est
     * d'abord remis en ordre comme l'application le fait en le lisant (`MemoryWriter.settle`) : un remplacement
     * interrompu est terminé et son fichier listé sous son nom, une création interrompue effacée.
     */
    private byte[] listFiles(MemoryRoot root, long id) throws FrameException {
        if (root == null) return ComputerLinkProtocol.encodeError(id, ComputerLinkProtocol.ERROR_NOT_FOUND, NO_MEMORY_FOLDER);
        try {
            Uri tree = Uri.parse(root.folder);
            MemoryTree memory = new MemoryTree(resolver);
            MemoryWriter writer = new MemoryWriter(resolver);
            String rootId = memory.baseDir(tree, root.base);
            if (rootId == null) return ComputerLinkProtocol.encodeError(id, ComputerLinkProtocol.ERROR_NOT_FOUND, "Dossier mémoire introuvable sur le téléphone : " + root.base);
            List<RemoteFile> files = new ArrayList<>();
            java.util.Map<String, String> dirs = new java.util.LinkedHashMap<>();
            for (MemoryWriter.Shown shown : writer.settle(tree, memory.children(tree, rootId))) {
                if (shown.child.isDir) {
                    if (ComputerLinkProtocol.LISTED_DIRS.contains(shown.name)) dirs.put(shown.name, shown.child.id);
                } else if (shown.child.sizeKnown) {
                    files.add(new RemoteFile(shown.name, shown.child.size, shown.child.mtimeMs));
                }
            }
            for (java.util.Map.Entry<String, String> dir : dirs.entrySet()) {
                for (MemoryWriter.Shown shown : writer.settle(tree, memory.children(tree, dir.getValue()))) {
                    if (!shown.child.isDir && shown.child.sizeKnown) files.add(new RemoteFile(dir.getKey() + "/" + shown.name, shown.child.size, shown.child.mtimeMs));
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
    private byte[] readBlock(MemoryRoot root, Incoming m) throws FrameException {
        if (root == null) return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_NOT_FOUND, NO_MEMORY_FOLDER);
        try {
            Uri tree = Uri.parse(root.folder);
            MemoryTree memory = new MemoryTree(resolver);
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
            if (read > 0 && m.start + read >= size) fileSent.run();
            return ComputerLinkProtocol.encodeBlock(m.id, m.start, data, read);
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "lire", e);
            return ComputerLinkProtocol.encodeError(m.id, MemoryTree.errorCode(e), "Lecture impossible : " + e.getMessage());
        }
    }

    // ---------- écritures du PC ----------

    /** Le dossier où écrire un chemin admis par `writeAllowed`, et le nom du fichier dedans. */
    private static final class Target {
        final Uri tree;
        final String parentId;
        final String name;

        Target(Uri tree, String parentId, String name) {
            this.tree = tree;
            this.parentId = parentId;
            this.name = name;
        }
    }

    /**
     * Le dossier d'un chemin admis par `writeAllowed`, sous le sous-dossier de la mémoire (`baseAllowed`) : la racine
     * de la mémoire, ou l'un des `WRITABLE_DIRS`, créé avec `create` s'il manque. `null` si la mémoire est
     * introuvable, ou, sans `create`, si le sous-dossier manque.
     */
    private static Target targetOf(MemoryWriter writer, MemoryTree memory, MemoryRoot root, String path, boolean create) throws Exception {
        Uri tree = Uri.parse(root.folder);
        String rootId = memory.baseDir(tree, root.base);
        if (rootId == null) return null;
        int slash = path.indexOf('/');
        String parentId = slash < 0 ? rootId : writer.resolveFrom(tree, rootId, path.substring(0, slash), create);
        return parentId == null ? null : new Target(tree, parentId, path.substring(slash + 1));
    }

    /**
     * Réponse à `ecrire`. Le premier bloc (debut 0) abandonne l'écriture non validée d'avant et ouvre le provisoire :
     * `.gtracker-tmp` si le fichier existe, `.gtracker-new` sinon. Chaque bloc suivant doit continuer l'écriture
     * (`WriteSession.continues`) ; sinon, ou sur toute erreur, l'écriture est abandonnée, l'original intact.
     */
    private byte[] writeBlock(MemoryRoot root, Incoming m) throws FrameException {
        if (recording.getAsBoolean()) {
            abandon();
            return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_PERMISSION, RECORDING_REFUSAL);
        }
        if (root == null) {
            abandon();
            return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_NOT_FOUND, NO_MEMORY_FOLDER);
        }
        try {
            if (WriteSession.opens(m.start)) {
                abandon();
                MemoryWriter writer = new MemoryWriter(resolver);
                MemoryTree memory = new MemoryTree(resolver);
                Target t = targetOf(writer, memory, root, m.path, true);
                if (t == null) return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_NOT_FOUND, "Dossier mémoire introuvable sur le téléphone : " + root.base);
                String existing = memory.findChild(t.tree, t.parentId, t.name);
                MemoryTree.Child current = existing == null ? null : memory.describe(t.tree, existing);
                if (current != null && current.isDir) return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_UNKNOWN, m.path + " est un dossier sur le téléphone.");
                boolean replacing = current != null;
                provisional = writer.open(t.tree, t.parentId, t.name, ComputerLinkProtocol.provisionalName(t.name, replacing), m.path);
                this.writer = writer;
                writing = new WriteSession(m.path, m.size, replacing);
            } else if (writing == null || !writing.continues(m.path, m.start, m.size, m.length)) {
                abandon();
                return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_UNKNOWN, "Bloc hors d'ordre pour " + m.path + " : écriture abandonnée.");
            }
            provisional.out.write(m.body);
            writing.wrote(m.length);
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "ecrire", e);
            abandon();
            return ComputerLinkProtocol.encodeError(m.id, MemoryTree.errorCode(e), "Écriture impossible : " + e.getMessage());
        }
        return ComputerLinkProtocol.encodeDone(m.id);
    }

    /**
     * Réponse à `valider` : l'écriture en cours doit viser ce chemin, de cette taille, tous ses octets reçus ; le
     * provisoire, sa taille relue, prend alors la place du fichier (`MemoryWriter.commit`). Rend le fichier tel qu'il
     * est désormais, avec la taille et la date que `lister` montrera.
     */
    private byte[] commitWrite(Incoming m) throws FrameException {
        if (recording.getAsBoolean()) {
            abandon();
            return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_PERMISSION, RECORDING_REFUSAL);
        }
        if (writing == null || provisional == null || !writing.completes(m.path, m.size)) {
            abandon();
            return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_UNKNOWN, "Validation refusée pour " + m.path + " : aucune écriture complète de " + m.size + " octets en cours.");
        }
        MemoryTree.Child done;
        try {
            done = writer.commit(provisional, m.size, m.path);
        } catch (Exception | OutOfMemoryError e) {
            Log.w(TAG, "valider", e);
            abandon();
            return ComputerLinkProtocol.encodeError(m.id, MemoryTree.errorCode(e), "Mise en place impossible : " + e.getMessage());
        }
        provisional = null;
        writer = null;
        writing = null;
        return ComputerLinkProtocol.encodeWritten(m.id, m.path, done.sizeKnown ? done.size : m.size, done.mtimeMs);
    }

    /**
     * Réponse à `effacer` : le fichier et le provisoire d'un remplacement interrompu laissé à côté
     * (`MemoryWriter.erase`) ; sans effet sur un fichier absent. L'écriture en cours du même chemin est abandonnée.
     */
    private byte[] eraseFile(MemoryRoot root, Incoming m) throws FrameException {
        if (recording.getAsBoolean()) return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_PERMISSION, RECORDING_REFUSAL);
        if (root == null) return ComputerLinkProtocol.encodeError(m.id, ComputerLinkProtocol.ERROR_NOT_FOUND, NO_MEMORY_FOLDER);
        if (writing != null && writing.path.equals(m.path)) abandon();
        try {
            MemoryWriter writer = new MemoryWriter(resolver);
            Target t = targetOf(writer, new MemoryTree(resolver), root, m.path, false);
            if (t != null) writer.erase(t.tree, t.parentId, t.name, m.path);
        } catch (Exception e) {
            Log.w(TAG, "effacer", e);
            return ComputerLinkProtocol.encodeError(m.id, MemoryTree.errorCode(e), "Effacement impossible : " + e.getMessage());
        }
        return ComputerLinkProtocol.encodeDone(m.id);
    }

    /** Abandonne l'écriture en cours, s'il y en a une : flux fermé, provisoire effacé. Ne lève jamais. */
    void abandon() {
        MemoryWriter.Provisional p = provisional;
        MemoryWriter w = writer;
        provisional = null;
        writer = null;
        writing = null;
        if (p != null && w != null) w.abandon(p);
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
}
