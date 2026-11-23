import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { base64ToBytes } from '../core/base64';
import { isNativeApp } from './runtime';

/**
 * « Ouvrir avec Gtracker » et « Partager vers Gtracker » : seul passage vers
 * `android/…/IncomingFilePlugin.java`, qui copie aussitôt le fichier reçu dans une file privée. Dans le navigateur,
 * sans effet : la file reste vide. La file côté page est dans `hooks/sessionLibrary/incoming.ts`.
 */

/** Refus du greffon, à la réception : ni GPX ni FIT, plus de 30 Mo, ou fichier qu'il n'a pas pu copier. */
export type IncomingRefusal = 'format' | 'trop-gros' | 'illisible';

export interface IncomingFile {
  id: string;
  /** Nom d'origine, dont l'extension vient de la signature du fichier (`.gpx`, `.fit`) s'il n'est pas refusé. */
  name: string;
  size: number;
  /** Refusé à la réception : aucune copie, juste de quoi le dire. */
  refusal: IncomingRefusal | null;
  /**
   * La page avait commencé à le lire (`mark`) et n'a rendu aucun verdict : Gtracker s'est arrêté pendant sa lecture,
   * peut-être à cause de lui. Il n'est pas relu.
   */
  trying: boolean;
}

/** Ce que la file attend de la plateforme ; une autre réalisation sert aux tests et au banc. */
export interface IncomingFilesPort {
  /** Les fichiers reçus, du plus ancien au plus récent, copies en cours terminées. */
  list(): Promise<IncomingFile[]>;
  /** Contenu d'un fichier reçu ; `null` s'il n'existe plus. Lève si la lecture échoue : il existe peut-être encore. */
  read(id: string): Promise<Uint8Array | null>;
  /** Retire le fichier, et son témoin de lecture. */
  remove(id: string): Promise<void>;
  /**
   * Pose (`trying`) ou retire le témoin de lecture d'un fichier, gardé par le téléphone même si Gtracker est arrêté
   * net : posé avant de le lire, retiré quand le fichier est gardé pour un autre essai.
   */
  mark(id: string, trying: boolean): Promise<void>;
  /** Appelé à chaque fichier reçu pendant que la page vit ; ceux d'avant se lisent par `list`. */
  subscribe(listener: () => void): void;
}

interface IncomingFilePlugin {
  list(): Promise<{ files: { id: string; name: string; size: number; refusal: string | null; trying?: boolean }[] }>;
  read(options: { id: string }): Promise<{ data: string | null }>;
  remove(options: { id: string }): Promise<void>;
  mark(options: { id: string; trying: boolean }): Promise<void>;
  addListener(event: 'received', listener: () => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<IncomingFilePlugin>('IncomingFile');

/** Motif venu du greffon : un motif inconnu reste un refus. */
const refusalOf = (code: string | null): IncomingRefusal | null => {
  if (code === null) return null;
  return code === 'format' || code === 'trop-gros' ? code : 'illisible';
};

export const incomingFiles: IncomingFilesPort = {
  list: async () => {
    if (!isNativeApp()) return [];
    const { files } = await plugin.list();
    return files.map((file) => ({ ...file, refusal: refusalOf(file.refusal), trying: file.trying === true }));
  },
  read: async (id) => {
    if (!isNativeApp()) return null;
    const { data } = await plugin.read({ id });
    return data === null ? null : base64ToBytes(data);
  },
  remove: async (id) => {
    if (isNativeApp()) await plugin.remove({ id });
  },
  mark: async (id, trying) => {
    if (isNativeApp()) await plugin.mark({ id, trying });
  },
  subscribe: (listener) => {
    if (!isNativeApp()) return;
    plugin.addListener('received', listener).catch((err: unknown) => console.warn('Fichiers reçus : écoute impossible', err));
  },
};
