import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { base64ToBytes } from '../core/base64';
import { isNativeApp } from './runtime';

/**
 * « Ouvrir avec Gtracker » et « Partager vers Gtracker » : seul passage vers
 * `android/…/IncomingFilePlugin.java`, qui copie aussitôt le fichier reçu dans une file privée. Dans le navigateur et
 * le programme Windows, sans effet : la file reste vide, donc rien n'y est relu et aucun témoin de lecture n'y est
 * tenu. La file côté page est dans `hooks/sessionLibrary/incoming.ts`.
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
   * Lectures commencées par la page (`mark`) sans verdict rendu : autant de fois où Gtracker s'est arrêté pendant sa
   * lecture, peut-être à cause de lui. 0 pour un fichier jamais lu.
   */
  tries: number;
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
   * Compte une lecture de plus (`trying`) ou retire le témoin de lecture d'un fichier, gardé par le téléphone même si
   * Gtracker est arrêté net : augmenté avant chaque lecture, retiré quand le fichier est gardé pour un autre essai.
   */
  mark(id: string, trying: boolean): Promise<void>;
  /** Appelé à chaque fichier reçu pendant que la page vit ; ceux d'avant se lisent par `list`. */
  subscribe(listener: () => void): void;
}

interface IncomingFilePlugin {
  list(): Promise<{ files: { id: string; name: string; size: number; refusal: string | null; tries?: number; trying?: boolean }[] }>;
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

/**
 * Lectures commencées d'après le greffon. Un greffon qui ne rend que `trying` (témoin posé, sans compte) ne compte pas
 * non plus ses lectures : relu, le fichier serait relu à chaque lancement s'il arrête Gtracker. Son témoin vaut donc le
 * plafond, `Infinity`, et le fichier est refusé comme ce greffon le prévoyait.
 */
export const triesOf = (tries: number | undefined, trying: boolean | undefined): number => {
  if (typeof tries === 'number' && Number.isFinite(tries)) return Math.max(0, Math.floor(tries));
  return trying === true ? Infinity : 0;
};

export const incomingFiles: IncomingFilesPort = {
  list: async () => {
    if (!isNativeApp()) return [];
    const { files } = await plugin.list();
    return files.map(({ id, name, size, refusal, tries, trying }) => ({ id, name, size, refusal: refusalOf(refusal), tries: triesOf(tries, trying) }));
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
