package io.github.segneur.gtracker;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Lecture de l'arbre du dossier mémoire désigné par le sélecteur d'Android (accès SAF), commune au dossier mémoire
 * (MemoryFolderPlugin, qui seul y écrit) et à la liaison avec l'ordinateur (ComputerLinkPlugin, qui ne fait que lire).
 * Rien ici n'écrit, ne renomme ni n'efface.
 *
 * Les chemins sont relatifs au dossier choisi (« sessions/x.json »), séparés par `/`.
 */
final class MemoryTree {

    /** Fournisseur du stockage du téléphone, dont l'identifiant d'un document est son chemin. */
    private static final String EXTERNAL_STORAGE_AUTHORITY = "com.android.externalstorage.documents";

    private static final String[] CHILD_COLUMNS = {
        Document.COLUMN_DOCUMENT_ID,
        Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE,
        Document.COLUMN_SIZE,
        Document.COLUMN_LAST_MODIFIED,
    };

    private final ContentResolver resolver;

    MemoryTree(ContentResolver resolver) {
        this.resolver = resolver;
    }

    /** Un enfant d'un dossier, tel que le fournisseur le décrit ; taille et date à 0 s'il ne les donne pas. */
    static final class Child {
        final String id;
        final String name;
        final boolean isDir;
        final long size;
        final long mtimeMs;
        /** Faux si le fournisseur ne donne pas la taille. */
        final boolean sizeKnown;

        Child(String id, String name, boolean isDir, long size, long mtimeMs, boolean sizeKnown) {
            this.id = id;
            this.name = name;
            this.isDir = isDir;
            this.size = size;
            this.mtimeMs = mtimeMs;
            this.sizeKnown = sizeKnown;
        }
    }

    /** Enfants d'un dossier, dans l'ordre du fournisseur. */
    List<Child> children(Uri tree, String dirId) {
        List<Child> children = new ArrayList<>();
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, dirId);
        try (Cursor c = resolver.query(childrenUri, CHILD_COLUMNS, null, null, null)) {
            while (c != null && c.moveToNext()) {
                children.add(new Child(
                    c.getString(0),
                    c.getString(1),
                    Document.MIME_TYPE_DIR.equals(c.getString(2)),
                    c.isNull(3) ? 0 : c.getLong(3),
                    c.isNull(4) ? 0 : c.getLong(4),
                    !c.isNull(3)
                ));
            }
        }
        return children;
    }

    /** Identifiant du document au chemin donné, `null` s'il n'existe pas. */
    String resolveExisting(Uri tree, String path) {
        String id = DocumentsContract.getTreeDocumentId(tree);
        for (String part : path.split("/")) {
            if (part.isEmpty()) continue;
            String child = findChild(tree, id, part);
            if (child == null) return null;
            id = child;
        }
        return id;
    }

    /** Taille du fichier d'identifiant donné, -1 si c'est un dossier, s'il n'existe plus ou si sa taille est inconnue. */
    long fileSize(Uri tree, String id) {
        String[] columns = { Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE };
        try (Cursor c = resolver.query(DocumentsContract.buildDocumentUriUsingTree(tree, id), columns, null, null, null)) {
            if (c == null || !c.moveToFirst() || Document.MIME_TYPE_DIR.equals(c.getString(0)) || c.isNull(1)) return -1;
            return c.getLong(1);
        }
    }

    /** Flux de lecture d'un document de l'arbre. */
    InputStream open(Uri tree, String id) throws FileNotFoundException {
        InputStream in = resolver.openInputStream(DocumentsContract.buildDocumentUriUsingTree(tree, id));
        if (in == null) throw new FileNotFoundException("Lecture refusée par le fournisseur");
        return in;
    }

    /**
     * Enfant d'un dossier, par son nom. Sur le stockage du téléphone,
     * l'identifiant d'un document est son chemin (« primary:Documents/Gtracker/sessions ») :
     * on le construit et on vérifie qu'il existe, une requête au lieu de lire
     * tout le dossier. Chez ce fournisseur, un document absent l'est vraiment :
     * pas de relecture du dossier (le temporaire d'une réécriture est presque
     * toujours absent, et `sessions/` compte des centaines de fichiers). Pour
     * un autre fournisseur, ou une autre erreur, repli sur la recherche par nom.
     */
    String findChild(Uri tree, String parentId, String name) {
        String guess = parentId.endsWith(":") ? parentId + name : parentId + "/" + name;
        boolean pathIds = EXTERNAL_STORAGE_AUTHORITY.equals(tree.getAuthority());
        try {
            String found = displayName(tree, guess);
            if (name.equals(found)) return guess;
            if (pathIds && found == null) return null;
        } catch (IllegalArgumentException e) {
            // Le fournisseur du stockage dit ainsi « aucun document à ce chemin ».
            if (pathIds) return null;
        } catch (Exception e) {
            // Fournisseur aux identifiants opaques, ou erreur passagère : recherche par nom.
        }
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        try (Cursor c = resolver.query(children, CHILD_COLUMNS, null, null, null)) {
            while (c != null && c.moveToNext()) {
                if (name.equals(c.getString(1))) return c.getString(0);
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    String displayName(Uri tree, String id) {
        Uri uri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
        try (Cursor c = resolver.query(uri, new String[] { Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            return c != null && c.moveToFirst() ? c.getString(0) : null;
        }
    }

    boolean exists(Uri tree, String id) {
        try {
            return displayName(tree, id) != null;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Ce qui s'est passé, d'après l'erreur et ses causes : `TOO_LARGE` (mémoire
     * manquante), `PERMISSION`, `NO_SPACE`, `NOT_FOUND`, sinon `UNKNOWN`. Un accès
     * refusé arrive souvent en `FileNotFoundException` (« EACCES ») : il passe donc
     * avant `NOT_FOUND`, retenu seulement si aucune cause n'en dit plus.
     */
    static String errorCode(Throwable e) {
        boolean notFound = false;
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof OutOfMemoryError) return "TOO_LARGE";
            if (t instanceof SecurityException) return "PERMISSION";
            String message = String.valueOf(t.getMessage());
            if (message.contains("EACCES") || message.contains("EPERM")) return "PERMISSION";
            if (message.contains("ENOSPC") || message.contains("No space left")) return "NO_SPACE";
            if (t instanceof FileNotFoundException || message.contains("Missing file") || message.contains("FileNotFoundException")) notFound = true;
        }
        return notFound ? "NOT_FOUND" : "UNKNOWN";
    }
}
