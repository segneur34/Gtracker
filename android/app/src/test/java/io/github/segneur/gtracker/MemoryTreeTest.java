package io.github.segneur.gtracker;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import io.github.segneur.gtracker.MemoryTree.Fate;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.junit.Test;

/**
 * L'arbre du dossier mémoire, sans fournisseur : un `base` qui sortirait de l'arbre est refusé par
 * `MemoryTree.baseDir` avant toute requête (ni arbre ni fournisseur ne sont touchés : les deux sont `null` ici), et
 * ce que la lecture d'un dossier fait de chaque enfant (`fate`), provisoires en cours d'écriture épargnés.
 */
public class MemoryTreeTest {

    @Test
    public void sousDossierHorsDeLArbreRefuseSansRienLire() {
        MemoryTree memory = new MemoryTree(null);
        for (String no : new String[] { "..", "../Documents", "Gtracker/..", "/Gtracker", "Gtracker/", "a//b", "C:\\Gtracker", "content://autre/arbre" }) {
            assertNull(no, memory.baseDir(null, no));
        }
    }

    private static Set<String> names(String... names) {
        return new HashSet<>(Arrays.asList(names));
    }

    @Test
    public void echangesInterrompusTerminesALaLecture() {
        Set<String> withOriginal = names("a.gpx", "a.gpx.gtracker-tmp", "b.gpx.gtracker-tmp", "c.gpx.gtracker-new");
        assertEquals(Fate.SHOW, MemoryTree.fate("a.gpx", false, withOriginal, false));
        assertEquals("original intact à côté", Fate.DELETE_TEMP, MemoryTree.fate("a.gpx.gtracker-tmp", false, withOriginal, false));
        assertEquals("original déjà retiré", Fate.RESTORE_TEMP, MemoryTree.fate("b.gpx.gtracker-tmp", false, withOriginal, false));
        assertEquals(Fate.DELETE_NEW, MemoryTree.fate("c.gpx.gtracker-new", false, withOriginal, false));
        // Un dossier, le suffixe seul, ou une autre casse, sont montrés tels quels.
        assertEquals(Fate.SHOW, MemoryTree.fate("x.gtracker-tmp", true, withOriginal, false));
        assertEquals(Fate.SHOW, MemoryTree.fate(".gtracker-new", false, withOriginal, false));
        assertEquals(Fate.SHOW, MemoryTree.fate("a.gpx.GTRACKER-TMP", false, withOriginal, false));
        assertEquals("b.gpx", MemoryTree.originalOf("b.gpx.gtracker-tmp"));
    }

    @Test
    public void provisoireEnCoursDEcritureEpargne() {
        Set<String> withOriginal = names("a.gpx", "a.gpx.gtracker-tmp", "b.gpx.gtracker-tmp", "c.gpx.gtracker-new");
        assertEquals("création en cours : cachée, pas effacée", Fate.HIDE, MemoryTree.fate("c.gpx.gtracker-new", false, withOriginal, true));
        assertEquals("remplacement en cours : caché, pas effacé", Fate.HIDE, MemoryTree.fate("a.gpx.gtracker-tmp", false, withOriginal, true));
        assertEquals("original retiré à l'instant : montré sous son nom, pas renommé", Fate.SHOW_AS_ORIGINAL, MemoryTree.fate("b.gpx.gtracker-tmp", false, withOriginal, true));
    }

    @Test
    public void nomsEnCoursDEcriture() {
        String name = "écrit-en-cours.gpx.gtracker-new";
        assertFalse(MemoryTree.writing(name));
        MemoryTree.startWriting(name);
        assertTrue(MemoryTree.writing(name));
        assertFalse(MemoryTree.writing("autre.gpx.gtracker-new"));
        MemoryTree.stopWriting(name);
        assertFalse(MemoryTree.writing(name));
        // Une fin de trop ne compte pas en négatif.
        MemoryTree.stopWriting(name);
        assertFalse(MemoryTree.writing(name));
    }

    @Test
    public void deuxEcrituresDuMemeNomNeSeLiberentPasLUneLAutre() {
        String name = "même-nom.json.gtracker-tmp";
        // La page écrit : la liaison est refusée sous ce nom, sans rien noter.
        MemoryTree.startWriting(name);
        assertFalse(MemoryTree.tryStartWriting(name));
        MemoryTree.startWriting(name);
        MemoryTree.stopWriting(name);
        assertTrue("une écriture reste en cours", MemoryTree.writing(name));
        MemoryTree.stopWriting(name);
        assertFalse(MemoryTree.writing(name));
        // La liaison tient le nom : une page qui écrit le même s'ajoute au compte.
        assertTrue(MemoryTree.tryStartWriting(name));
        MemoryTree.startWriting(name);
        MemoryTree.stopWriting(name);
        assertTrue(MemoryTree.writing(name));
        MemoryTree.stopWriting(name);
        assertFalse(MemoryTree.writing(name));
    }

    @Test
    public void suffixesCommeCeuxDuProtocole() {
        assertEquals(ComputerLinkProtocol.TEMP_SUFFIX, MemoryTree.TEMP_SUFFIX);
        assertEquals(ComputerLinkProtocol.NEW_SUFFIX, MemoryTree.NEW_SUFFIX);
    }
}
