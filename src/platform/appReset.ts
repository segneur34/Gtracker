import { clearRecordingJournals, filesystem } from './files';
import { incomingFiles } from './incomingFile';
import { PENDING_DIR } from './memoryFolder';
import { MOTION_DIR } from './motion';
import { clearPreviewImages } from './previewImages';
import { clearPreviewDocument } from './previewStore';
import { isNativeApp } from './runtime';
import { tileStore } from './tileCache';

/**
 * Fichiers de l'application hors du dossier mémoire, effacés par « Tout supprimer » (Réglages › Mémoire) : une
 * liste nommée, jamais tout le dossier privé de l'application.
 *
 * - Sur le téléphone, dans le dossier privé : les sessions en attente d'un dossier (`en-attente/`), les captures
 *   des capteurs (`capteurs/`), le journal de l'enregistrement et ceux mis de côté, les tuiles gardées
 *   (`tuiles/`), les vignettes (`vignettes.json`, `vignettes-images/`), la file des fichiers reçus d'une autre
 *   application (sinon l'un d'eux se rangerait au lancement suivant) ; dans le cache, l'image partagée (`partage/`).
 * - Dans le navigateur, les caches des tuiles et des vignettes.
 *
 * Chaque effacement est tenté, même si un autre échoue : il n'y a plus rien à garder.
 */

/** Dossiers du dossier privé entièrement à l'application : effacés avec leur contenu. */
export const PRIVATE_APP_DIRS = [PENDING_DIR, MOTION_DIR] as const;

/** Dossier du cache où `ShareFilePlugin.java` pose l'image partagée. */
export const SHARE_CACHE_DIR = 'partage';

const quietly = async (run: () => Promise<unknown>): Promise<void> => {
  try {
    await run();
  } catch {
    // Déjà absent, ou refusé : rien de plus à faire.
  }
};

/** Efface les fichiers de l'application hors du dossier mémoire. Ne lève jamais. */
export const clearDeviceFiles = async (): Promise<void> => {
  await quietly(() => tileStore.clear());
  await quietly(clearPreviewDocument);
  await quietly(clearPreviewImages);
  await quietly(clearRecordingJournals);
  if (!isNativeApp()) return;
  const { Filesystem, Directory } = await filesystem();
  for (const dir of PRIVATE_APP_DIRS) {
    await quietly(() => Filesystem.rmdir({ path: dir, directory: Directory.Data, recursive: true }));
  }
  await quietly(() => Filesystem.rmdir({ path: SHARE_CACHE_DIR, directory: Directory.Cache, recursive: true }));
  await quietly(async () => {
    for (const file of await incomingFiles.list()) await quietly(() => incomingFiles.remove(file.id));
  });
};
