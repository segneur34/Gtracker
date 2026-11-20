import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativeApp } from './runtime';

/**
 * La liaison sans fil du téléphone avec le programme Windows : seul passage vers le greffon
 * `ComputerLinkPlugin.java`, qui cherche l'ordinateur sur le réseau local, s'appaire par le code que l'ordinateur
 * affiche, puis répond à ses demandes de lecture du dossier mémoire (sans jamais y écrire). Le jeton et l'empreinte
 * du certificat restent dans le greffon : la page ne voit que l'état. Hors du téléphone, `computerLink()` rend
 * `null` et rien ne s'exécute.
 */

/** Où en est la liaison. */
export type ComputerLinkState = 'unpaired' | 'idle' | 'searching' | 'pairing' | 'linked' | 'notFound';

/** Raison du dernier échec, que la page dit en clair (`library/computerLink.ts`). */
export type ComputerLinkError =
  | 'noLocalNetwork' | 'localNetwork' | 'code' | 'window' | 'nonce' | 'token' | 'version' | 'certificate' | 'proof' | 'network' | 'protocol';

/** L'état rendu par chaque appel du greffon et porté par chaque événement `status`. */
export interface ComputerLinkStatus {
  state: ComputerLinkState;
  error: ComputerLinkError | null;
  /** Un ordinateur est connu (appairage fait). */
  paired: boolean;
  computerName: string | null;
  /** Dernière adresse connue de l'ordinateur, « a.b.c.d:port ». */
  address: string | null;
  /** Heure du dernier fichier envoyé jusqu'au bout, `null` si aucun. */
  lastSentMs: number | null;
  /** Fichiers envoyés pendant la liaison en cours. */
  sentFiles: number;
  /** Un réseau local est là : Wi-Fi ou point d'accès du téléphone (partage de connexion compris). */
  onLocalNetwork: boolean;
}

/** Un appel refusé parce qu'il est mal formé, avant toute tentative. */
export type ComputerLinkRefusal = 'code' | 'address';

/** Erreur d'un appel que le greffon a refusé sans le tenter. */
export class ComputerLinkRefused extends Error {
  readonly refusal: ComputerLinkRefusal;

  constructor(refusal: ComputerLinkRefusal) {
    super(`liaison refusée : ${refusal}`);
    this.name = 'ComputerLinkRefused';
    this.refusal = refusal;
  }
}

export interface ComputerLinkPort {
  status(): Promise<ComputerLinkStatus>;
  /** Appaire à l'ordinateur dont `code` est affiché (6 chiffres) ; sans `address`, il est cherché sur le réseau. */
  pair(options: { code: string; address?: string; folder: string | null }): Promise<ComputerLinkStatus>;
  /** Relie à l'ordinateur appairé ; sans effet si c'est déjà fait. `folder` : le dossier mémoire qu'il lira. */
  connect(options: { address?: string; folder: string | null }): Promise<ComputerLinkStatus>;
  /** Ferme la liaison et oublie l'ordinateur. */
  forget(): Promise<ComputerLinkStatus>;
  /** Appelé à chaque changement d'état ; rend le désabonnement. */
  onStatus(listener: (status: ComputerLinkStatus) => void): () => void;
}

interface ComputerLinkPlugin {
  status(): Promise<unknown>;
  pair(options: { code: string; address?: string; folder?: string }): Promise<unknown>;
  connect(options: { address?: string; folder?: string }): Promise<unknown>;
  forget(): Promise<unknown>;
  addListener(event: 'status', listener: (status: unknown) => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<ComputerLinkPlugin>('ComputerLink');

const STATES: readonly ComputerLinkState[] = ['unpaired', 'idle', 'searching', 'pairing', 'linked', 'notFound'];
const ERRORS: readonly ComputerLinkError[] = [
  'noLocalNetwork', 'localNetwork', 'code', 'window', 'nonce', 'token', 'version', 'certificate', 'proof', 'network', 'protocol',
];

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * L'état tel que le greffon le rend, remis dans sa forme : une valeur inconnue (greffon plus récent que la page)
 * ne casse rien. Un état inconnu se lit « au repos » ; une raison inconnue, une coupure.
 */
export const readComputerLinkStatus = (raw: unknown): ComputerLinkStatus => {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const paired = o.paired === true;
  const state = STATES.find((s) => s === o.state) ?? (paired ? 'idle' : 'unpaired');
  const error = o.error === null || o.error === undefined ? null : (ERRORS.find((e) => e === o.error) ?? 'network');
  return {
    state,
    error,
    paired,
    computerName: text(o.computerName),
    address: text(o.address),
    lastSentMs: typeof o.lastSentMs === 'number' && Number.isFinite(o.lastSentMs) ? o.lastSentMs : null,
    sentFiles: typeof o.sentFiles === 'number' && Number.isFinite(o.sentFiles) ? Math.max(0, Math.floor(o.sentFiles)) : 0,
    onLocalNetwork: o.onLocalNetwork === true,
  };
};

/** Refus d'un appel mal formé, lu sur le code de l'erreur du greffon ; `null` pour toute autre erreur. */
export const refusalOf = (err: unknown): ComputerLinkRefusal | null => {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (code === 'BAD_CODE') return 'code';
  if (code === 'BAD_ADDRESS') return 'address';
  return null;
};

/** Un appel du greffon dont l'état rendu est remis dans sa forme, et dont un refus devient `ComputerLinkRefused`. */
const call = async (request: Promise<unknown>): Promise<ComputerLinkStatus> => {
  try {
    return readComputerLinkStatus(await request);
  } catch (err) {
    const refusal = refusalOf(err);
    if (refusal !== null) throw new ComputerLinkRefused(refusal);
    throw err;
  }
};

const port: ComputerLinkPort = {
  status: () => call(plugin.status()),
  pair: ({ code, address, folder }) => call(plugin.pair({ code, ...(address ? { address } : {}), ...(folder ? { folder } : {}) })),
  connect: ({ address, folder }) => call(plugin.connect({ ...(address ? { address } : {}), ...(folder ? { folder } : {}) })),
  forget: () => call(plugin.forget()),
  onStatus: (listener) => {
    let removed = false;
    let remove: (() => void) | null = null;
    plugin.addListener('status', (raw) => listener(readComputerLinkStatus(raw))).then((handle) => {
      if (removed) void handle.remove();
      else remove = () => void handle.remove();
    }).catch((err: unknown) => console.warn('Liaison avec l\'ordinateur : écoute impossible', err));
    return () => {
      removed = true;
      remove?.();
    };
  },
};

/** La liaison avec l'ordinateur ; `null` hors de l'application du téléphone. */
export const computerLink = (): ComputerLinkPort | null => (isNativeApp() ? port : null);

/** Le dossier mémoire désigné tel que la liaison le lit : `ok` avec son adresse, ou la raison de son absence. */
export type LinkFolder =
  | { state: 'ok'; uri: string }
  /** Aucun dossier désigné, ou dossier mémoire qui n'est pas celui d'un téléphone. */
  | { state: 'none' }
  /** Le dossier désigné contient le dossier Gtracker sans l'être : le greffon lit la racine du dossier désigné. */
  | { state: 'subfolder' };

/** `location` : le dossier désigné (`uri`) et le sous-dossier où est la mémoire (`base`, vide si c'est lui-même). */
export const linkFolderOf = (location: { uri: string; base: string } | null): LinkFolder => {
  if (location === null || location.uri === '') return { state: 'none' };
  return location.base === '' ? { state: 'ok', uri: location.uri } : { state: 'subfolder' };
};
