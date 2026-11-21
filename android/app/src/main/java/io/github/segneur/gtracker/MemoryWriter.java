package io.github.segneur.gtracker;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Écriture dans l'arbre du dossier mémoire désigné (accès SAF), commune au dossier mémoire (MemoryFolderPlugin, un
 * fichier entier reçu de la page) et à la liaison avec l'ordinateur (ComputerLinkPlugin, un fichier reçu bloc par
 * bloc). La lecture est dans MemoryTree.
 *
 * Un fichier existant n'est jamais réécrit sur place : le nouveau contenu va d'abord à côté (« nom.gtracker-tmp »),
 * puis prend sa place. Un fichier neuf est écrit de même sous « nom.gtracker-new », puis renommé. Une coupure en plein
 * échange est reprise à la lecture suivante du dossier (`settle`) : un remplacement interrompu est terminé, une
 * création interrompue effacée, et un provisoire tenu ouvert par une écriture en cours épargné.
 */
final class MemoryWriter {

    /** Type des fichiers créés : Android n'ajoute alors aucune extension au nom demandé. */
    private static final String FILE_MIME = "application/octet-stream";
    /** Tampon de la recopie d'un provisoire chez un fournisseur qui ne sait pas renommer. */
    private static final int COPY_BUFFER = 65_536;

    private final ContentResolver resolver;
    private final MemoryTree memory;

    MemoryWriter(ContentResolver resolver) {
        this.resolver = resolver;
        this.memory = new MemoryTree(resolver);
    }

    // ---------- chemins ----------

    /**
     * Identifiant du document au chemin donné depuis la racine de l'arbre, `null` s'il n'existe pas. Avec `create`,
     * les dossiers manquants sont créés.
     */
    String resolve(Uri tree, String path, boolean create) throws Exception {
        return resolveFrom(tree, DocumentsContract.getTreeDocumentId(tree), path, create);
    }

    /** Comme `resolve`, depuis le dossier d'identifiant `startId`. */
    String resolveFrom(Uri tree, String startId, String path, boolean create) throws Exception {
        String id = startId;
        for (String part : path.split("/")) {
            if (part.isEmpty()) continue;
            String child = memory.findChild(tree, id, part);
            if (child == null) {
                if (!create) return null;
                Uri created = DocumentsContract.createDocument(
                    resolver,
                    DocumentsContract.buildDocumentUriUsingTree(tree, id),
                    Document.MIME_TYPE_DIR,
                    part
                );
                if (created == null) throw new Exception("création du dossier " + part + " refusée");
                child = DocumentsContract.getDocumentId(created);
            }
            id = child;
        }
        return id;
    }

    // ---------- un fichier entier ----------

    /**
     * Remplace un fichier existant sans jamais le laisser à moitié écrit : le
     * contenu va d'abord dans « nom.gtracker-tmp », puis l'ancien fichier est
     * retiré et le nouveau prend son nom. Si l'application est tuée entre deux
     * étapes, `settle` termine l'échange. Un fournisseur qui ne sait pas renommer
     * reçoit l'écriture en place, comme avant.
     */
    void replace(Uri tree, String parentId, String name, Uri target, byte[] data, String path) throws Exception {
        String tempName = name + MemoryTree.TEMP_SUFFIX;
        // Noté en cours d'écriture du début à la fin : un listage de la liaison ne le reprend pas en route.
        MemoryTree.startWriting(tempName);
        try {
            replaceNoted(tree, parentId, name, tempName, target, data, path);
        } finally {
            MemoryTree.stopWriting(tempName);
        }
    }

    private void replaceNoted(Uri tree, String parentId, String name, String tempName, Uri target, byte[] data, String path) throws Exception {
        String tempId = memory.findChild(tree, parentId, tempName);
        Uri temp = tempId != null ? DocumentsContract.buildDocumentUriUsingTree(tree, tempId) : create(tree, parentId, tempName, path);
        writeTo(temp, data, path);
        if (!supportsRename(temp)) {
            writeTo(target, data, path);
            DocumentsContract.deleteDocument(resolver, temp);
            return;
        }
        DocumentsContract.deleteDocument(resolver, target);
        Uri renamed;
        try {
            renamed = DocumentsContract.renameDocument(resolver, temp, name);
        } catch (Exception e) {
            renamed = null;
        }
        if (renamed == null) {
            // Renommage refusé malgré l'annonce du fournisseur : le contenu est écrit sous son nom.
            writeTo(create(tree, parentId, name, path), data, path);
            DocumentsContract.deleteDocument(resolver, temp);
        }
    }

    /**
     * Crée un fichier sans jamais le laisser à moitié écrit sous son nom : le
     * contenu va d'abord dans « nom.gtracker-new », qui prend ensuite le nom
     * demandé. Si l'application est tuée avant, `settle` efface le fichier neuf
     * resté seul. Un fournisseur qui ne sait pas renommer reçoit l'écriture en
     * place, comme `replace`.
     */
    void createNew(Uri tree, String parentId, String name, byte[] data, String path) throws Exception {
        String newName = name + MemoryTree.NEW_SUFFIX;
        // Noté en cours d'écriture du début à la fin : un listage de la liaison ne l'efface pas en route.
        MemoryTree.startWriting(newName);
        try {
            createNewNoted(tree, parentId, name, newName, data, path);
        } finally {
            MemoryTree.stopWriting(newName);
        }
    }

    private void createNewNoted(Uri tree, String parentId, String name, String newName, byte[] data, String path) throws Exception {
        String leftover = memory.findChild(tree, parentId, newName);
        if (leftover != null) DocumentsContract.deleteDocument(resolver, DocumentsContract.buildDocumentUriUsingTree(tree, leftover));
        Uri temp = create(tree, parentId, newName, path);
        if (!supportsRename(temp)) {
            DocumentsContract.deleteDocument(resolver, temp);
            writeTo(create(tree, parentId, name, path), data, path);
            return;
        }
        try {
            writeTo(temp, data, path);
        } catch (Exception e) {
            deleteQuietly(temp);
            throw e;
        }
        Uri renamed;
        try {
            renamed = DocumentsContract.renameDocument(resolver, temp, name);
        } catch (Exception e) {
            renamed = null;
        }
        if (renamed == null) {
            // Renommage refusé malgré l'annonce du fournisseur : le contenu est écrit sous son nom.
            writeTo(create(tree, parentId, name, path), data, path);
            DocumentsContract.deleteDocument(resolver, temp);
        }
    }

    // ---------- un fichier reçu bloc par bloc ----------

    /** Le provisoire d'une écriture bloc par bloc, flux tenu ouvert jusqu'à `commit` ou `abandon`. */
    static final class Provisional {
        final Uri tree;
        final String parentId;
        /** Nom du fichier visé, dans `parentId`. */
        final String name;
        /** Nom du provisoire, noté en cours d'écriture (`MemoryTree.startWriting`) tant qu'il vit. */
        final String tempName;
        final Uri doc;
        final OutputStream out;
        /**
         * Vrai quand le provisoire, complet, ne doit plus être effacé : l'original est retiré par `commit`, ou la
         * recopie de repli a échoué en route.
         */
        boolean keep;

        Provisional(Uri tree, String parentId, String name, String tempName, Uri doc, OutputStream out) {
            this.tree = tree;
            this.parentId = parentId;
            this.name = name;
            this.tempName = tempName;
            this.doc = doc;
            this.out = out;
        }
    }

    /**
     * Ouvre le provisoire `tempName` dans `parentId`, à la place de celui qu'une coupure aurait laissé sous ce nom, et
     * le note en cours d'écriture avant de le créer : une lecture du dossier ne l'efface pas en route. Refusé si une
     * autre écriture tient déjà ce nom (la page qui écrit le même fichier) : rien n'est touché.
     */
    Provisional open(Uri tree, String parentId, String name, String tempName, String path) throws Exception {
        if (!MemoryTree.tryStartWriting(tempName)) throw new IOException(path + " est en cours d'écriture sur le téléphone.");
        try {
            String leftover = memory.findChild(tree, parentId, tempName);
            if (leftover != null) DocumentsContract.deleteDocument(resolver, DocumentsContract.buildDocumentUriUsingTree(tree, leftover));
            Uri doc = create(tree, parentId, tempName, path);
            OutputStream out;
            try {
                out = resolver.openOutputStream(doc, "wt");
                if (out == null) throw new Exception("écriture refusée pour " + path);
            } catch (Exception e) {
                deleteQuietly(doc);
                throw e;
            }
            return new Provisional(tree, parentId, name, tempName, doc, out);
        } catch (Exception e) {
            MemoryTree.stopWriting(tempName);
            throw e;
        }
    }

    /**
     * Met le provisoire à la place du fichier visé, dans l'ordre de `replace` : flux fermé, taille relue (elle doit
     * valoir `size` quand le fournisseur la donne), original retiré, provisoire renommé. Un fournisseur qui ne sait
     * pas renommer reçoit le contenu recopié sous le nom visé, comme `replace` l'écrit en place. Rend le fichier mis
     * en place. En cas d'échec, l'appelant passe par `abandon`, qui garde le provisoire si l'original est déjà retiré :
     * la lecture suivante du dossier le remettra sous son nom.
     */
    MemoryTree.Child commit(Provisional p, long size, String path) throws Exception {
        p.out.close();
        long written = memory.fileSize(p.tree, DocumentsContract.getDocumentId(p.doc));
        if (written >= 0 && written != size) throw new IOException("Écriture incomplète de " + path + " : " + written + " octets sur " + size + ".");
        String targetId = memory.findChild(p.tree, p.parentId, p.name);
        if (targetId != null) {
            MemoryTree.Child target = memory.describe(p.tree, targetId);
            if (target != null && target.isDir) throw new IOException(path + " est un dossier sur le téléphone.");
        }
        Uri result;
        if (!supportsRename(p.doc)) {
            Uri target = targetId != null ? DocumentsContract.buildDocumentUriUsingTree(p.tree, targetId) : create(p.tree, p.parentId, p.name, path);
            copyOrUndo(p, target, path);
            DocumentsContract.deleteDocument(resolver, p.doc);
            result = target;
        } else {
            if (targetId != null) {
                DocumentsContract.deleteDocument(resolver, DocumentsContract.buildDocumentUriUsingTree(p.tree, targetId));
                p.keep = true;
            }
            Uri renamed;
            try {
                renamed = DocumentsContract.renameDocument(resolver, p.doc, p.name);
            } catch (Exception e) {
                renamed = null;
            }
            if (renamed == null) {
                // Renommage refusé malgré l'annonce du fournisseur : le contenu est recopié sous son nom.
                Uri target = create(p.tree, p.parentId, p.name, path);
                copyOrUndo(p, target, path);
                DocumentsContract.deleteDocument(resolver, p.doc);
                result = target;
            } else {
                result = renamed;
            }
        }
        MemoryTree.stopWriting(p.tempName);
        MemoryTree.Child done = memory.describe(p.tree, DocumentsContract.getDocumentId(result));
        if (done == null) throw new IOException(path + " introuvable après son écriture.");
        return done;
    }

    /**
     * Recopie de repli du provisoire sous le nom visé (fournisseur sans renommage). Si elle échoue en route, la cible,
     * partielle, est retirée, pour ne jamais laisser un fichier tronqué à date récente, et le provisoire complet est
     * gardé (`keep`) ; si même ce retrait échoue, l'erreur part quand même, provisoire gardé.
     */
    private void copyOrUndo(Provisional p, Uri target, String path) throws Exception {
        try {
            copy(p.doc, target, path);
        } catch (Exception e) {
            p.keep = true;
            try {
                DocumentsContract.deleteDocument(resolver, target);
            } catch (Exception partialLeft) {
                e.addSuppressed(partialLeft);
            }
            throw e;
        }
    }

    /**
     * Abandonne une écriture bloc par bloc : flux fermé, provisoire effacé (sauf `keep` : le provisoire, complet, est
     * laissé à la lecture suivante du dossier), nom libéré. Ne lève jamais.
     */
    void abandon(Provisional p) {
        try {
            p.out.close();
        } catch (IOException | RuntimeException e) {
            // Déjà fermé, ou fournisseur parti : rien de plus à fermer.
        }
        if (!p.keep) deleteQuietly(p.doc);
        MemoryTree.stopWriting(p.tempName);
    }

    /**
     * Efface le fichier `name` de `parentId` et le provisoire d'un remplacement interrompu laissé à côté, le
     * provisoire d'abord (sinon la lecture suivante du dossier lui rendrait le nom de l'original). Sans effet sur ce
     * qui n'existe pas ; un dossier n'est jamais effacé. Lève si l'original est encore là après son effacement.
     */
    void erase(Uri tree, String parentId, String name, String path) throws Exception {
        for (String n : new String[] { name + MemoryTree.TEMP_SUFFIX, name }) {
            String id = memory.findChild(tree, parentId, n);
            if (id == null) continue;
            MemoryTree.Child child = memory.describe(tree, id);
            if (child == null) continue;
            if (child.isDir) throw new IOException(path + " est un dossier sur le téléphone.");
            DocumentsContract.deleteDocument(resolver, DocumentsContract.buildDocumentUriUsingTree(tree, id));
        }
        if (memory.findChild(tree, parentId, name) != null) throw new IOException(path + " est encore sur le téléphone après son effacement.");
    }

    // ---------- lecture d'un dossier ----------

    /** Un enfant tel que la lecture du dossier le montre : sous son nom, ou sous celui de l'original d'un provisoire. */
    static final class Shown {
        final String name;
        final MemoryTree.Child child;

        Shown(String name, MemoryTree.Child child) {
            this.name = name;
            this.child = child;
        }
    }

    /**
     * Enfants d'un dossier tels qu'ils doivent être montrés, échanges interrompus terminés (`MemoryTree.fate`) : une
     * création interrompue est effacée, un remplacement interrompu repris, et un provisoire tenu ouvert par une
     * écriture en cours épargné (caché, ou montré sous le nom de l'original quand celui-ci vient d'être retiré).
     */
    List<Shown> settle(Uri tree, List<MemoryTree.Child> children) {
        Set<String> names = new HashSet<>();
        for (MemoryTree.Child child : children) names.add(child.name);
        List<Shown> shown = new ArrayList<>();
        for (MemoryTree.Child child : children) {
            switch (MemoryTree.fate(child.name, child.isDir, names, MemoryTree.writing(child.name))) {
                case SHOW:
                    shown.add(new Shown(child.name, child));
                    break;
                case DELETE_NEW:
                    // Création interrompue avant son renommage : perdue, puis refaite (fiche depuis le GPX).
                    deleteQuietly(DocumentsContract.buildDocumentUriUsingTree(tree, child.id));
                    break;
                case DELETE_TEMP:
                case RESTORE_TEMP: {
                    String original = finishInterruptedReplace(tree, child, names);
                    if (original != null) shown.add(new Shown(original, child));
                    break;
                }
                case SHOW_AS_ORIGINAL: {
                    String original = MemoryTree.originalOf(child.name);
                    names.add(original);
                    shown.add(new Shown(original, child));
                    break;
                }
                default:
                    break;
            }
        }
        return shown;
    }

    /**
     * Fichier temporaire trouvé dans un dossier : un échange interrompu. À côté
     * de l'original, l'ancien contenu est intact et le temporaire, peut-être
     * incomplet, est retiré ; seul, l'original avait déjà été retiré et le
     * temporaire, complet, reprend son nom. Rend le nom sous lequel le montrer,
     * `null` s'il ne doit pas l'être.
     */
    private String finishInterruptedReplace(Uri tree, MemoryTree.Child temp, Set<String> names) {
        String original = MemoryTree.originalOf(temp.name);
        Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, temp.id);
        try {
            if (names.contains(original)) {
                DocumentsContract.deleteDocument(resolver, doc);
                return null;
            }
            if (DocumentsContract.renameDocument(resolver, doc, original) == null) return null;
            names.add(original);
            return original;
        } catch (Exception e) {
            // Laissé tel quel : rien n'est perdu, l'échange sera repris à la prochaine lecture.
            return null;
        }
    }

    // ---------- outils ----------

    /** Efface un document sans lever : un échec le laisse pour la prochaine lecture du dossier. */
    void deleteQuietly(Uri doc) {
        try {
            DocumentsContract.deleteDocument(resolver, doc);
        } catch (Exception e) {
            // Laissé tel quel : il sera effacé à la prochaine lecture.
        }
    }

    private Uri create(Uri tree, String parentId, String name, String path) throws Exception {
        Uri created = DocumentsContract.createDocument(
            resolver,
            DocumentsContract.buildDocumentUriUsingTree(tree, parentId),
            FILE_MIME,
            name
        );
        if (created == null) throw new Exception("création refusée pour " + path);
        return created;
    }

    private void writeTo(Uri doc, byte[] data, String path) throws Exception {
        // « wt » : le fichier est tronqué avant l'écriture, sans quoi un contenu plus
        // court que le précédent en garderait la fin.
        try (OutputStream out = resolver.openOutputStream(doc, "wt")) {
            if (out == null) throw new Exception("écriture refusée pour " + path);
            out.write(data);
        }
    }

    /** Recopie un document dans un autre, tronqué d'abord comme `writeTo`. */
    private void copy(Uri from, Uri to, String path) throws Exception {
        try (InputStream in = resolver.openInputStream(from); OutputStream out = resolver.openOutputStream(to, "wt")) {
            if (in == null) throw new Exception("lecture refusée pour " + path);
            if (out == null) throw new Exception("écriture refusée pour " + path);
            byte[] buffer = new byte[COPY_BUFFER];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
        }
    }

    private boolean supportsRename(Uri doc) {
        try (Cursor c = resolver.query(doc, new String[] { Document.COLUMN_FLAGS }, null, null, null)) {
            return c != null && c.moveToFirst() && (c.getInt(0) & Document.FLAG_SUPPORTS_RENAME) != 0;
        } catch (Exception e) {
            return false;
        }
    }
}
