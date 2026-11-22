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
  /**
   * Heure de la dernière demande de l'ordinateur (lecture, écriture, effacement ; jamais le simple signe de vie),
   * `null` si aucune depuis l'ouverture de Gtracker, ou greffon plus ancien qui ne la donne pas.
   */
  lastExchangeMs: number | null;
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

/**
 * Le dossier mémoire que l'ordinateur lira : `folder`, l'adresse du dossier désigné ; `base`, le sous-dossier où est la
 * mémoire (« Gtracker »), absent ou vide quand c'est le dossier désigné lui-même.
 */
interface LinkFolderOptions {
  folder: string | null;
  base?: string;
}

export interface ComputerLinkPort {
  status(): Promise<ComputerLinkStatus>;
  /** Appaire à l'ordinateur dont `code` est affiché (6 chiffres) ; sans `address`, il est cherché sur le réseau. */
  pair(options: { code: string; address?: string } & LinkFolderOptions): Promise<ComputerLinkStatus>;
  /** Relie à l'ordinateur appairé ; sans effet si c'est déjà fait, sinon que le dossier mémoire lu change. */
  connect(options: { address?: string } & LinkFolderOptions): Promise<ComputerLinkStatus>;
  /** Ferme la liaison et oublie l'ordinateur. */
  forget(): Promise<ComputerLinkStatus>;
  /** Appelé à chaque changement d'état ; rend le désabonnement. */
  onStatus(listener: (status: ComputerLinkStatus) => void): () => void;
}

interface ComputerLinkPlugin {
  status(): Promise<unknown>;
  pair(options: { code: string; address?: string; folder?: string; base?: string }): Promise<unknown>;
  connect(options: { address?: string; folder?: string; base?: string }): Promise<unknown>;
  forget(): Promise<unknown>;
  addListener(event: 'status', listener: (status: unknown) => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<ComputerLinkPlugin>('ComputerLink');

const STATES: readonly ComputerLinkState[] = ['unpaired', 'idle', 'searching', 'pairing', 'linked', 'notFound'];
const ERRORS: readonly ComputerLinkError[] = [
  'noLocalNetwork', 'localNetwork', 'code', 'window', 'nonce', 'token', 'version', 'certificate', 'proof', 'network', 'protocol',
];

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const instant = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

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
    lastSentMs: instant(o.lastSentMs),
    sentFiles: typeof o.sentFiles === 'number' && Number.isFinite(o.sentFiles) ? Math.max(0, Math.floor(o.sentFiles)) : 0,
    onLocalNetwork: o.onLocalNetwork === true,
    lastExchangeMs: instant(o.lastExchangeMs),
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

/** Le dossier tel que le greffon le reçoit : rien sans dossier, et pas de sous-dossier vide (comportement d'avant le sous-dossier). */
const folderFields = ({ folder, base }: LinkFolderOptions): { folder?: string; base?: string } =>
  (folder ? { folder, ...(base ? { base } : {}) } : {});

const port: ComputerLinkPort = {
  status: () => call(plugin.status()),
  pair: ({ code, address, ...where }) => call(plugin.pair({ code, ...(address ? { address } : {}), ...folderFields(where) })),
  connect: ({ address, ...where }) => call(plugin.connect({ ...(address ? { address } : {}), ...folderFields(where) })),
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
  /** `base` : le sous-dossier du dossier désigné où est la mémoire (« Gtracker »), vide si c'est lui-même. */
  | { state: 'ok'; uri: string; base: string }
  /** Aucun dossier désigné, ou dossier mémoire qui n'est pas celui d'un téléphone. */
  | { state: 'none' };

/** `location` : le dossier désigné (`uri`) et le sous-dossier où est la mémoire (`base`, vide si c'est lui-même). */
export const linkFolderOf = (location: { uri: string; base: string } | null): LinkFolder =>
  (location === null || location.uri === '' ? { state: 'none' } : { state: 'ok', uri: location.uri, base: location.base });
