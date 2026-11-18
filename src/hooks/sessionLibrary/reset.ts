import { settingsPath } from '../../library/folderLayout';
import {
  FOLDER_CLOSED_REFUSAL, RESET_RUNNING_REFUSAL, eraseAppFiles, eraseKeyPlan, factoryKeyPlan, memoryResetTargets, readMemoryListings,
  resetInterruptedText, type EraseCounts,
} from '../../library/resetPlan';
import { clearDeviceFiles } from '../../platform/appReset';
import { t } from '../../core/i18n';
import { plainError } from '../../platform/errorText';
import { browserMemoryCopy, isFolderDesignated, type MemoryFolder } from '../../platform/memoryFolder';
import { isDesktopApp } from '../../platform/runtime';
import {
  jsonStore, removeStoredKeys, resumeWrites, settleStoredWrites, storedKeys, suspendWrites,
} from '../../platform/storage';
import { libraryState, setState } from './store';
import { lib, writableFolder } from './memory';
import { flushWrites, ownSettingsFileNames, resumeSettingsWrites, stopSettingsWrites } from './deviceSettings';
import { openLibrary, stopForReset } from './lifecycle';

/**
 * Remise à zéro (Réglages › Mémoire) : « Réglages d'usine » et « Tout supprimer ». Ce que chacun efface est décidé
 * par `library/resetPlan.ts` ; ici, l'ordre des gestes. Avant tout effacement, plus rien ne s'écrit
 * (`suspendWrites`) : ce qui tourne encore dans la page réécrirait derrière. Les deux finissent par recharger
 * l'application. Le dossier mémoire reste désigné.
 */

/** Progression de « Tout supprimer » : fichiers du dossier effacés sur leur nombre. */
export interface ResetProgress {
  done: number;
  total: number;
}

/** Vrai dès qu'une remise à zéro commence : une seconde, d'où qu'elle vienne, est refusée jusqu'au rechargement. */
let resetRunning = false;

/** Recharge l'application à l'adresse `path`, comme à son ouverture. */
const reloadAt = (path: string): void => window.location.replace(path);

/** Ce que « Tout supprimer » effacera, compté dans le dossier à l'instant (la liste publiée, s'il ne se lit pas). */
export const countErasable = async (): Promise<EraseCounts> => {
  await lib.opening;
  const state = libraryState();
  const counts: EraseCounts = { sessions: state.sessions.length, pending: state.pendingCount, routes: 0 };
  const f = lib.folder;
  if (!f) return counts;
  try {
    const targets = memoryResetTargets(await readMemoryListings(f));
    return { ...counts, sessions: targets.sessions, routes: targets.routes };
  } catch {
    return counts;
  }
};

/**
 * « Réglages d'usine » : les écritures en attente partent d'abord, puis l'instant des réglages est posé à maintenant
 * (jamais retiré : l'appareil se croirait neuf et reprendrait le fichier d'un autre), les réglages sont remis à leur
 * défaut, et le fichier de réglages de cet appareil quitte le dossier ; ceux des autres appareils restent. Un échec
 * sur ce fichier n'arrête rien : il est réécrit au lancement depuis les réglages d'usine. Puis l'application se
 * recharge sur le Profil.
 */
export const factoryReset = async (): Promise<string | null> => {
  if (resetRunning) return RESET_RUNNING_REFUSAL;
  resetRunning = true;
  await lib.opening;
  await flushWrites();
  stopSettingsWrites();
  const plan = factoryKeyPlan(Date.now());
  for (const [key, value] of Object.entries(plan.write)) jsonStore.write(key, value);
  suspendWrites();
  await settleStoredWrites();
  await removeStoredKeys(plan.remove);
  const f = writableFolder();
  if (f) {
    try {
      for (const name of await ownSettingsFileNames(f)) await f.remove(settingsPath(name));
    } catch {
      // Laissé : réécrit au lancement, sans les anciens réglages.
    }
  }
  reloadAt('/profil');
  return null;
};

/**
 * « Tout supprimer » : la mémoire s'arrête, puis le dossier perd les fichiers de l'application (la mémoire du
 * navigateur aussi quand un dossier du PC est désigné, ou dans le programme Windows : elle en garde une copie, ou les
 * essais d'avant le dossier du disque), puis les fichiers de l'appareil
 * hors du dossier, puis les clés de l'appareil ; l'application se recharge comme à sa première ouverture. Un échec
 * dans le dossier arrête tout, sans rien toucher d'autre : les écritures reprennent, la mémoire est relue, et le
 * compte rendu est rendu (et dit dans la carte de la mémoire). `onProgress` suit l'effacement du dossier, journaux
 * gardés de côté compris.
 */
export const eraseEverything = async (onProgress: (progress: ResetProgress) => void = () => undefined): Promise<string | null> => {
  if (resetRunning) return RESET_RUNNING_REFUSAL;
  resetRunning = true;
  await lib.opening;
  // Dossier désigné mais pas ouvert : ses sessions resteraient, et reviendraient au lancement suivant.
  if (lib.folder === null && await isFolderDesignated()) {
    resetRunning = false;
    return FOLDER_CLOSED_REFUSAL;
  }
  await flushWrites();
  stopSettingsWrites();
  suspendWrites();
  const folder = stopForReset();
  // Dossier du PC choisi, ou programme Windows (dossier retenu ou non) : la mémoire du navigateur, gardée à part, part aussi.
  const copy = folder?.kind === 'picked' || isDesktopApp() ? await browserMemoryCopy() : null;
  const folders = [folder, copy].filter((f): f is MemoryFolder => f !== null);
  for (const f of folders) {
    const result = await eraseAppFiles(f, (done, total) => onProgress({ done, total }));
    if (result.error === null) continue;
    resumeWrites();
    resumeSettingsWrites();
    resetRunning = false;
    await openLibrary();
    const message = resetInterruptedText(result, plainError(result.error, t('le dossier ne répond pas')));
    setState({ error: message });
    return message;
  }
  await clearDeviceFiles();
  // Une écriture partie avant la suspension ne doit pas reposer une clé derrière son retrait.
  await settleStoredWrites();
  await removeStoredKeys(eraseKeyPlan(await storedKeys()));
  reloadAt('/');
  return null;
};
