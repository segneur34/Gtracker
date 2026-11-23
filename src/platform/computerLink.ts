import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativeApp } from './runtime';

/**
 * La liaison sans fil du téléphone avec le programme Windows : seul passage vers le greffon
 * `ComputerLinkPlugin.java`, qui cherche l'ordinateur sur le réseau local, transporte les étapes de l'appairage par
 * le code que l'ordinateur affiche (l'échange lui-même est calculé par la page : `library/computerPairing.ts`), puis
 * répond à ses demandes de lecture du dossier mémoire (sans jamais y écrire). Le jeton reste dans le greffon : la
 * page ne voit que l'état, et des étapes de l'appairage les parts, confirmations et empreinte qu'elle vérifie. Hors
 * du téléphone, `computerLink()` rend `null` et rien ne s'exécute.
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

/**
 * Échec d'une étape de l'appairage pour un ordinateur candidat : les raisons du greffon, plus `unreachable` (liaison
 * impossible avec ce candidat), que la page ne montre jamais telle quelle.
 */
export type PairStepFailure = 'code' | 'window' | 'nonce' | 'version' | 'proof' | 'network' | 'protocol' | 'unreachable';

/** Recherche : la génération ouverte, et les adresses des ordinateurs trouvés, dans l'ordre où les essayer. */
export interface PairSearchResult {
  status: ComputerLinkStatus;
  generation: number;
  /** Vide : l'appairage est déjà fermé, `status` dit pourquoi. */
  candidates: string[];
}

/** `appairer` puis `defi` : l'empreinte du certificat vu et la part de l'ordinateur (`null` : ordinateur resté à l'ancien échange). */
export type PairOfferResult =
  | { status: ComputerLinkStatus; failure: PairStepFailure }
  | { status: ComputerLinkStatus; failure: null; fingerprint: string; partB: string | null };

/**
 * `preuve` puis `appaire` : la confirmation de l'ordinateur, à vérifier avant de rien garder. Son nom n'est montré
 * qu'une fois gardé, par l'état.
 */
export type PairConfirmResult =
  | { status: ComputerLinkStatus; failure: PairStepFailure }
  | { status: ComputerLinkStatus; failure: null; cB: string };

/** Fin de l'appairage : garder l'ordinateur confirmé (avec le dossier mémoire lu), ou fermer sur une raison. */
export type PairFinishOptions =
  | ({ generation: number; keep: true } & LinkFolderOptions)
  | { generation: number; keep: false; error: ComputerLinkError; notFound: boolean };

export interface ComputerLinkPort {
  status(): Promise<ComputerLinkStatus>;
  /** Appairage, étape 1 : ouvre une génération et cherche l'ordinateur ; sans `address`, sur le réseau. */
  pairSearch(options: { address?: string }): Promise<PairSearchResult>;
  /** Étape 2, pour un candidat : sa part (`partA`, 65 octets en hexadécimal) contre celle de l'ordinateur. */
  pairOffer(options: { generation: number; endpoint: string; partA: string }): Promise<PairOfferResult>;
  /** Étape 3 : la confirmation du téléphone (`cA`, 32 octets en hexadécimal) contre celle de l'ordinateur. */
  pairConfirm(options: { generation: number; cA: string }): Promise<PairConfirmResult>;
  /** Étape 4 : garder (la confirmation de l'ordinateur vérifiée) ou fermer sans rien écrire. */
  pairFinish(options: PairFinishOptions): Promise<ComputerLinkStatus>;
  /** Relie à l'ordinateur appairé ; sans effet si c'est déjà fait, sinon que le dossier mémoire lu change. */
  connect(options: { address?: string } & LinkFolderOptions): Promise<ComputerLinkStatus>;
  /** Ferme la liaison et oublie l'ordinateur. */
  forget(): Promise<ComputerLinkStatus>;
  /** Appelé à chaque changement d'état ; rend le désabonnement. */
  onStatus(listener: (status: ComputerLinkStatus) => void): () => void;
}

interface ComputerLinkPlugin {
  status(): Promise<unknown>;
  pairSearch(options: { address?: string }): Promise<unknown>;
  pairOffer(options: { generation: number; endpoint: string; partA: string }): Promise<unknown>;
  pairConfirm(options: { generation: number; cA: string }): Promise<unknown>;
  pairFinish(options: { generation: number; keep: boolean; folder?: string; base?: string; error?: string; notFound?: boolean }): Promise<unknown>;
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

/**
 * Refus d'un appel mal formé, lu sur le code de l'erreur du greffon ; `null` pour toute autre erreur. Le code tapé
 * ne va jamais au greffon : son refus vient de la page (`library/computerPairing.ts`).
 */
export const refusalOf = (err: unknown): ComputerLinkRefusal | null => {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (code === 'BAD_ADDRESS') return 'address';
  return null;
};

/** Un appel du greffon dont la réponse est remise dans sa forme par `read`, et dont un refus devient `ComputerLinkRefused`. */
const callWith = async <T,>(request: Promise<unknown>, read: (raw: unknown) => T): Promise<T> => {
  let raw: unknown;
  try {
    raw = await request;
  } catch (err) {
    const refusal = refusalOf(err);
    if (refusal !== null) throw new ComputerLinkRefused(refusal);
    throw err;
  }
  return read(raw);
};

const call = (request: Promise<unknown>): Promise<ComputerLinkStatus> => callWith(request, readComputerLinkStatus);

const PAIR_STEP_FAILURES: readonly PairStepFailure[] = ['code', 'window', 'nonce', 'version', 'proof', 'network', 'protocol', 'unreachable'];

const fieldsOf = (raw: unknown): Record<string, unknown> => (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

/** Échec d'une étape tel que le greffon le rend : `null` si elle a abouti ; une raison inconnue se lit comme une coupure. */
const readFailure = (value: unknown): PairStepFailure | null =>
  (value === null || value === undefined ? null : (PAIR_STEP_FAILURES.find((f) => f === value) ?? 'network'));

/** La recherche telle que le greffon la rend ; sans génération lisible, aucun candidat. */
export const readPairSearch = (raw: unknown): PairSearchResult => {
  const o = fieldsOf(raw);
  const generation = typeof o.generation === 'number' && Number.isInteger(o.generation) ? o.generation : -1;
  const candidates = generation >= 0 && Array.isArray(o.candidates)
    ? o.candidates.filter((c): c is string => typeof c === 'string' && c !== '')
    : [];
  return { status: readComputerLinkStatus(raw), generation, candidates };
};

/** `appairer` puis `defi` tels que le greffon les rend ; une étape aboutie sans empreinte se lit comme une coupure. */
export const readPairOffer = (raw: unknown): PairOfferResult => {
  const o = fieldsOf(raw);
  const status = readComputerLinkStatus(raw);
  const failure = readFailure(o.failure);
  if (failure !== null) return { status, failure };
  const fingerprint = text(o.fingerprint);
  if (fingerprint === null) return { status, failure: 'network' };
  return { status, failure: null, fingerprint, partB: text(o.partB) };
};

/** `preuve` puis `appaire` tels que le greffon les rend ; sans confirmation, l'étape se lit comme une coupure. */
export const readPairConfirm = (raw: unknown): PairConfirmResult => {
  const o = fieldsOf(raw);
  const status = readComputerLinkStatus(raw);
  const failure = readFailure(o.failure);
  if (failure !== null) return { status, failure };
  const cB = text(o.cB);
  if (cB === null) return { status, failure: 'network' };
  return { status, failure: null, cB };
};

/** Le dossier tel que le greffon le reçoit : rien sans dossier, et pas de sous-dossier vide (comportement d'avant le sous-dossier). */
const folderFields = ({ folder, base }: LinkFolderOptions): { folder?: string; base?: string } =>
  (folder ? { folder, ...(base ? { base } : {}) } : {});

const port: ComputerLinkPort = {
  status: () => call(plugin.status()),
  pairSearch: ({ address }) => callWith(plugin.pairSearch(address ? { address } : {}), readPairSearch),
  pairOffer: (options) => callWith(plugin.pairOffer(options), readPairOffer),
  pairConfirm: (options) => callWith(plugin.pairConfirm(options), readPairConfirm),
  pairFinish: (options) => call(plugin.pairFinish(options.keep
    ? { generation: options.generation, keep: true, ...folderFields(options) }
    : { generation: options.generation, keep: false, error: options.error, notFound: options.notFound })),
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
