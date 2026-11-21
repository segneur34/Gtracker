/**
 * Pont vers le programme Windows (la coquille du dossier `bureau/`), seul fichier qui lit `window.gtrackerBureau`.
 * Dans un navigateur et sur le téléphone, ce pont n'existe pas : `desktopBridge()` rend `null` et rien de ce qui en
 * dépend ne s'exécute.
 *
 * La coquille lit et écrit le dossier mémoire pour la page. Chaque fonction rend une promesse de
 * `{ ok: true, valeur }` ou `{ ok: false, code, message }` et ne rejette pas pour une erreur du disque. Les chemins
 * de fichier sont relatifs à une racine : `memoire` (le dossier retenu) ou `candidat` (le dossier proposé ou choisi,
 * en lecture seule jusqu'à son adoption) ; la page ne donne jamais de chemin absolu.
 *
 * Les types sont décrits ici, à la main : ceux de la coquille emploient les types de Node, que l'application n'a pas.
 */

/** Code d'une erreur du pont, lisible par `fileErrorCode`. */
export type BridgeErrorCode = 'NOT_FOUND' | 'PERMISSION' | 'NO_SPACE' | 'UNKNOWN';

export type BridgeAnswer<T> = { ok: true; valeur: T } | { ok: false; code: BridgeErrorCode; message: string };

/** Racine d'un chemin de fichier : le dossier retenu, ou le dossier proposé ou choisi (lecture seule). */
export type DesktopRoot = 'memoire' | 'candidat';

/** Le dossier retenu, au lancement. */
export type DesktopOpening =
  /** Aucun dossier retenu : premier lancement, ou dossier oublié. */
  | { etat: 'aucun' }
  /** Le dossier retenu s'ouvre, ou n'existe plus (il n'est jamais recréé). */
  | { etat: 'pret' | 'introuvable'; chemin: string; oneDrive: boolean }
  /** Le dossier retenu ne se lit pas ; `chemin` vaut `null` quand c'est le réglage du programme qui ne se lit pas. */
  | { etat: 'illisible'; chemin: string | null; oneDrive: boolean; code: BridgeErrorCode; detail: string };

/** Dossier proposé au premier lancement (il peut ne pas exister encore). */
export interface DesktopProposal {
  chemin: string;
  /** Vrai si le dossier proposé est lui-même dans OneDrive. */
  oneDrive: boolean;
  /** Vrai si Documents est dans OneDrive, d'où un dossier proposé hors de Documents. */
  documentsOneDrive: boolean;
}

/** Dossier désigné dans la fenêtre de Windows. */
export interface DesktopChoice {
  chemin: string;
  /** Son nom (le chemin entier pour la racine d'un disque). */
  nom: string;
  /** Noms de ce qu'il contient. */
  noms: string[];
  oneDrive: boolean;
}

export interface DesktopAdoption {
  chemin: string;
  oneDrive: boolean;
}

export interface DesktopEntry {
  name: string;
  kind: 'file' | 'directory';
  size: number;
  mtimeMs: number;
}

export interface DesktopFileTarget {
  racine: DesktopRoot;
  chemin: string;
}

export interface DesktopMemoryBridge {
  ouvrir(): Promise<BridgeAnswer<DesktopOpening>>;
  /** Pose le dossier proposé comme candidat. */
  proposer(): Promise<BridgeAnswer<DesktopProposal>>;
  /** Fenêtre de Windows ; `null` si l'utilisateur renonce. Pose le dossier choisi comme candidat. */
  choisir(argument?: { titre?: string; documents?: boolean }): Promise<BridgeAnswer<DesktopChoice | null>>;
  /** Retient le candidat (ou son sous-dossier `Gtracker`), en le créant s'il manque. */
  adopter(argument?: { descendre?: boolean }): Promise<BridgeAnswer<DesktopAdoption>>;
  oublier(): Promise<BridgeAnswer<null>>;
  lister(argument: DesktopFileTarget): Promise<BridgeAnswer<DesktopEntry[]>>;
  lireTexte(argument: DesktopFileTarget): Promise<BridgeAnswer<string | null>>;
  lireOctets(argument: DesktopFileTarget): Promise<BridgeAnswer<Uint8Array | null>>;
  stat(argument: DesktopFileTarget): Promise<BridgeAnswer<{ size: number; mtimeMs: number } | null>>;
  ecrireTexte(argument: DesktopFileTarget & { texte: string }): Promise<BridgeAnswer<null>>;
  ecrireOctets(argument: DesktopFileTarget & { octets: Uint8Array }): Promise<BridgeAnswer<null>>;
  effacer(argument: DesktopFileTarget): Promise<BridgeAnswer<null>>;
  /** Efface un sous-dossier vide ; refusé s'il contient encore quelque chose. Absent d'une coquille plus ancienne. */
  effacerDossier?(argument: DesktopFileTarget): Promise<BridgeAnswer<null>>;
}

/** Textes de la question posée à la fermeture du programme quand un brouillon attend. */
export interface CloseQuestionTexts {
  question: string;
  detail: string;
  quitter: string;
  rester: string;
}

/** Par où le téléphone est lu : le Wi-Fi (`sansFil`) ou le câble. */
export type DesktopPhoneChannel = 'sansFil' | 'cable';

/** État du téléphone, par le Wi-Fi ou par le câble, lu par la coquille. */
export type DesktopPhoneState =
  /**
   * Un téléphone prêt à être lu ; `nom` est son modèle ; `canal` : par où, absent d'une coquille plus ancienne (le
   * câble) ; `ecriture` : vrai si ce canal sait aussi écrire et effacer, absent d'une coquille qui ne le sait pas.
   */
  | { etat: 'pret'; nom: string; canal?: DesktopPhoneChannel; ecriture?: boolean }
  /** Rien de branché, ou rien de vu. */
  | { etat: 'absent' }
  /** Le téléphone attend que l'utilisateur accepte cet ordinateur. */
  | { etat: 'autorisation' }
  /** Le téléphone est vu mais ne répond pas. */
  | { etat: 'horsLigne' }
  /** L'outil du débogage USB n'est pas sur le poste ; `dossier` est l'endroit où le poser. */
  | { etat: 'adbIntrouvable'; dossier: string }
  /** Un autre programme tient la liaison avec le téléphone. */
  | { etat: 'occupe' };

/**
 * Fichier du téléphone : chemin relatif à `Documents/Gtracker` (racine, `sessions/`, et `reglages/` pour le câble),
 * taille en octets, date à la seconde.
 */
export interface DesktopPhoneFile {
  chemin: string;
  taille: number;
  dateMs: number;
}

/** Le dossier `Documents/Gtracker` du téléphone branché. */
export interface DesktopPhoneBridge {
  etat(): Promise<BridgeAnswer<DesktopPhoneState>>;
  /** `NOT_FOUND` si le dossier est absent du téléphone ; `UNKNOWN` si le téléphone n'est pas prêt ou s'est perdu. */
  lister(): Promise<BridgeAnswer<DesktopPhoneFile[]>>;
  /** Octets d'un fichier rendu par le dernier `lister` seulement ; `UNKNOWN` pour tout échec. */
  lireOctets(argument: { chemin: string }): Promise<BridgeAnswer<Uint8Array>>;
  /**
   * Écrit un fichier après un `lister` réussi, sous son nom provisoire puis renommé, et rend le fichier tel qu'il est
   * sur le téléphone. La coquille n'admet qu'un fichier posé dans `sessions/`, `itineraires/` ou `reglages/`, ou
   * `gtracker.json`, `fc-repos.json` et `lieux.json` à la racine : tout autre chemin reçoit `PERMISSION`. Absent
   * d'une coquille plus ancienne.
   */
  ecrireOctets?(argument: { chemin: string; octets: Uint8Array }): Promise<BridgeAnswer<DesktopPhoneFile>>;
  /**
   * Efface un seul fichier, de la même liste blanche, rendu par le dernier `lister` ou écrit depuis. Absent d'une
   * coquille plus ancienne.
   */
  effacer?(argument: { chemin: string }): Promise<BridgeAnswer<null>>;
}

/**
 * Ce que l'essai du pare-feu de Windows a trouvé. `ouvert` n'est pas une certitude (Windows ne filtre pas le trafic
 * du PC vers lui-même) : seul `bloque` s'affirme.
 */
export type DesktopFirewall = 'ouvert' | 'bloque' | 'inconnu';

/** Fenêtre de liaison d'un téléphone, ouverte pour 2 minutes ou jusqu'à la liaison. */
export interface DesktopWirelessPairing {
  /** Adresse du PC sur le réseau, à taper sur le téléphone si celui-ci ne le trouve pas seul. */
  adresse: string;
  port: number;
  /** Code de 6 chiffres. */
  code: string;
  /** Heure de fermeture (horloge du PC), en millisecondes depuis 1970. */
  expireA: number;
  /** Millisecondes avant la fermeture, au moment de la réponse. */
  restantMs: number;
}

/** État du sans-fil du PC. */
export interface DesktopWirelessState {
  /** Choisi par l'utilisateur, retenu d'un lancement à l'autre. */
  actif: boolean;
  /** Vrai si le PC attend un téléphone sur au moins une adresse. */
  ecoute: boolean;
  port: number | null;
  adresses: string[];
  pareFeu: DesktopFirewall;
  /** Pourquoi le PC n'écoute pas alors que le sans-fil est activé ; phrase de la coquille, en français. */
  erreur: string | null;
  appairage: DesktopWirelessPairing | null;
  /** Téléphones reliés en ce moment. */
  relies: { id: string; nom: string }[];
}

/** Un téléphone relié au PC (par le code), et s'il l'est en ce moment. */
export interface DesktopWirelessPhone {
  id: string;
  nom: string;
  /** Heure de la première liaison, en millisecondes depuis 1970. */
  ajouteLe: number;
  /** Dernière fois vu après la première liaison ; `null` s'il n'est pas revenu. */
  vuLe: number | null;
  relie: boolean;
}

/** Avis d'un téléphone qui se présente ; `nouveau` s'il vient d'être relié par le code. */
export interface DesktopWirelessArrival {
  id: string;
  nom: string;
  nouveau: boolean;
}

/** Le sans-fil du PC : écoute, fenêtre de liaison, téléphones reliés. */
export interface DesktopWirelessBridge {
  etat(): Promise<BridgeAnswer<DesktopWirelessState>>;
  /** Allume ou éteint ; rend l'état qui suit. */
  activer(argument: { actif: boolean }): Promise<BridgeAnswer<DesktopWirelessState>>;
  /** Refusée si le sans-fil est éteint ou sans réseau. */
  ouvrirAppairage(): Promise<BridgeAnswer<DesktopWirelessPairing>>;
  telephones(): Promise<BridgeAnswer<DesktopWirelessPhone[]>>;
  /** Vrai si le téléphone était relié. */
  retirer(argument: { id: string }): Promise<BridgeAnswer<boolean>>;
  /** Le rappel reçoit l'avis de chaque arrivée ; rend la fonction qui se désabonne. */
  surArrivee(rappel: (avis: unknown) => void): () => void;
}

export interface DesktopBridge {
  version: string;
  memoire: DesktopMemoryBridge;
  /** Absent d'une coquille plus ancienne, qui ne lit pas le téléphone. */
  telephone?: DesktopPhoneBridge;
  /** Absent d'une coquille plus ancienne, qui ne lit le téléphone que par le câble. */
  sansFil?: DesktopWirelessBridge;
  textes(texts: CloseQuestionTexts): Promise<BridgeAnswer<null>>;
}

/** Le pont du programme Windows, `null` ailleurs (navigateur, téléphone). */
export const desktopBridge = (): DesktopBridge | null => {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { gtrackerBureau?: Partial<DesktopBridge> }).gtrackerBureau;
  return typeof bridge === 'object' && bridge !== null && typeof bridge.memoire?.ouvrir === 'function' && typeof bridge.textes === 'function'
    ? (bridge as DesktopBridge)
    : null;
};

/**
 * Passe au programme Windows les textes traduits de sa question de fermeture ; sans effet ailleurs. La langue ne
 * change qu'au rechargement de la page : un appel au démarrage suffit. Un refus laisse au programme ses textes.
 */
export const sendCloseQuestionTexts = (texts: CloseQuestionTexts): void => {
  const bridge = desktopBridge();
  if (!bridge) return;
  void bridge.textes(texts).catch(() => undefined);
};
