package io.github.segneur.gtracker;

import static org.junit.Assert.assertNull;

import org.junit.Test;

/**
 * Le sous-dossier du dossier mémoire : un `base` qui sortirait de l'arbre est refusé par `MemoryTree.baseDir` avant
 * toute requête au fournisseur (ni arbre ni fournisseur ne sont touchés : les deux sont `null` ici).
 */
public class MemoryTreeTest {

    @Test
    public void sousDossierHorsDeLArbreRefuseSansRienLire() {
        MemoryTree memory = new MemoryTree(null);
        for (String no : new String[] { "..", "../Documents", "Gtracker/..", "/Gtracker", "Gtracker/", "a//b", "C:\\Gtracker", "content://autre/arbre" }) {
            assertNull(no, memory.baseDir(null, no));
        }
    }
}
