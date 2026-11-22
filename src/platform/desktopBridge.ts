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
 * Deux gestes de la coquille, sans réponse attendue, s'appellent d'ici : les textes de la question de fermeture
 * (`sendCloseQuestionTexts`) et une ligne du journal daté (`noteJournal`).
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
   * câble) ; `ecriture` : vrai si ce canal sait aussi écrire et effacer, absent d'une coquille qui ne le sait pas ;
   * `itineraires` : vrai si ce canal liste aussi `itineraires/`, absent d'une coquille qui ne le liste pas ;
   * `enregistrement` : vrai si le téléphone enregistre une session (il refuse alors d'être écrit : `ecriture` est faux),
   * absent d'une coquille ou d'un téléphone qui ne le disent pas.
   */
  | { etat: 'pret'; nom: string; canal?: DesktopPhoneChannel; ecriture?: boolean; itineraires?: boolean; enregistrement?: boolean }
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
  /**
   * Copie de sécurité d'avant une première synchronisation : le dossier mémoire retenu et ce que liste le téléphone,
   * copiés sous `<dossier des copies>\<date et heure>\`. Rend le chemin absolu de la copie, à montrer. Absent
   * d'une coquille plus ancienne.
   */
  copieSecurite?(): Promise<BridgeAnswer<string>>;
  /**
   * Le dossier des copies de sécurité : celui choisi par l'utilisateur, sinon `<Documents>\Gtracker-copies`. Absent
   * d'une coquille plus ancienne (le dossier est alors celui-là, sans choix).
   */
  dossierCopies?(): Promise<BridgeAnswer<string>>;
  /**
   * Fenêtre de choix d'un dossier de Windows (titre facultatif), partie du dossier actuel ; le dossier choisi est
   * retenu par le programme, sauf s'il est dans la mémoire ou la contient. Absent d'une coquille plus ancienne.
   */
  choisirDossierCopies?(argument?: { titre?: string }): Promise<BridgeAnswer<DesktopCopiesChoice>>;
  /**
   * Ouvre dans l'explorateur de Windows le dossier des copies ou une copie (chemin rendu par `copieSecurite`) ; tout
   * autre chemin reçoit `PERMISSION`. Absent d'une coquille plus ancienne.
   */
  ouvrirCopie?(argument: { chemin: string }): Promise<BridgeAnswer<null>>;
  /**
   * Le rappel reçoit l'avancement de chaque copie de sécurité (`{ fait, total }`, en fichiers) ; rend la fonction qui
   * se désabonne. Absent d'une coquille plus ancienne.
   */
  surAvancementCopie?(rappel: (avis: unknown) => void): () => void;
}

/**
 * Issue du choix du dossier des copies : retenu, fenêtre fermée sans choix, ou refusé parce qu'il est dans la mémoire
 * ou la contient ; `dossier` est le dossier des copies après le choix.
 */
export interface DesktopCopiesChoice {
  issue: 'choisi' | 'annule' | 'memoire';
  dossier: string;
}

/**
 * Ce que la coquille a lu du pare-feu de Windows : seul `bloque` s'affirme ; `inconnu` quand rien n'a pu être lu (une
 * coquille plus ancienne ne disait jamais `ouvert` avec certitude).
 */
export type DesktopFirewall = 'ouvert' | 'bloque' | 'inconnu';

/** Issue de la demande d'autorisation au pare-feu de Windows. */
export type DesktopAuthorizationOutcome = 'accordee' | 'refusee' | 'echec';

/** Réponse de la demande d'autorisation : son issue, pourquoi elle a échoué (en français), et l'état relu après. */
export interface DesktopWirelessAuthorization {
  issue: DesktopAuthorizationOutcome;
  detail?: string;
  etat: DesktopWirelessState;
}

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
  /** Le pare-feu bloque et l'autorisation de Gtracker suffirait ; absent d'une coquille plus ancienne. */
  pareFeuReparable?: boolean;
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
  /**
   * Heure du dernier départ pendant ce lancement du programme, en millisecondes depuis 1970 ; `null` s'il est relié ou
   * n'est pas parti depuis le lancement ; absent d'une coquille plus ancienne.
   */
  partiLe?: number | null;
  /** Raison de ce départ, `null` avec `partiLe` ; absent d'une coquille plus ancienne. */
  raisonDepart?: DesktopDepartureReason | null;
}

/** Avis d'un téléphone qui se présente ; `nouveau` s'il vient d'être relié par le code. */
export interface DesktopWirelessArrival {
  id: string;
  nom: string;
  nouveau: boolean;
}

/**
 * Pourquoi un téléphone relié est parti : il a fermé la liaison (`ferme`, Gtracker a quitté son écran), il ne répondait
 * plus (`silence`), il a été retiré (`retire`), le sans-fil a été éteint (`eteint`), ou la liaison a cassé (`coupure`).
 */
export type DesktopDepartureReason = 'ferme' | 'silence' | 'retire' | 'eteint' | 'coupure';

/** Avis d'un téléphone relié qui s'en va ; `heure` en millisecondes depuis 1970 (horloge du PC). */
export interface DesktopWirelessDeparture {
  id: string;
  nom: string;
  raison: DesktopDepartureReason;
  heure: number;
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
  /** Demande à Windows d'autoriser Gtracker sur le réseau ; absent d'une coquille plus ancienne. */
  autoriser?(): Promise<BridgeAnswer<DesktopWirelessAuthorization>>;
  /** Le rappel reçoit l'avis de chaque arrivée ; rend la fonction qui se désabonne. */
  surArrivee(rappel: (avis: unknown) => void): () => void;
  /** Le rappel reçoit l'avis de chaque départ ; rend la fonction qui se désabonne. Absent d'une coquille plus ancienne. */
  surDepart?(rappel: (avis: unknown) => void): () => void;
}

/** L'application du téléphone embarquée : version du programme, présence de l'APK, déjà proposée pour cette version. */
export interface DesktopAppState {
  version: string;
  disponible: boolean;
  proposee: boolean;
}

/** Pourquoi le téléphone a refusé l'installation ; `autre` porte le message d'Android dans `detail`. */
export type DesktopAppRefusal = 'versionPlusRecente' | 'signature' | 'usbCoupee' | 'memoirePleine' | 'autre';

/**
 * Issue d'une installation par le câble : installée sur le téléphone `nom` (son modèle), refusée par le téléphone
 * (`detail` : le message d'Android), ou rien d'envoyé, le téléphone n'étant pas prêt (son état).
 */
export type DesktopAppInstall =
  | { etat: 'installee'; nom: string }
  | { etat: 'refusee'; raison: DesktopAppRefusal; detail: string }
  | Exclude<DesktopPhoneState, { etat: 'pret' }>;

/** L'APK de la même version que le programme, rangée dans ses ressources. */
export interface DesktopAppBridge {
  etat(): Promise<BridgeAnswer<DesktopAppState>>;
  /**
   * Fenêtre « Enregistrer sous » (titre facultatif), puis copie de l'APK ; rend le chemin absolu écrit, `null` si
   * l'utilisateur renonce ; `NOT_FOUND` si le programme n'a pas l'APK.
   */
  enregistrer(argument?: { titre?: string }): Promise<BridgeAnswer<string | null>>;
  /** Installation par le câble ; `NOT_FOUND` sans APK, `UNKNOWN` pour un délai dépassé ou une panne. */
  installer(): Promise<BridgeAnswer<DesktopAppInstall>>;
  /** Retient que l'application a été proposée pour cette version. */
  marquerProposee(): Promise<BridgeAnswer<null>>;
}

export interface DesktopBridge {
  version: string;
  memoire: DesktopMemoryBridge;
  /** Absent d'une coquille plus ancienne, qui ne lit pas le téléphone. */
  telephone?: DesktopPhoneBridge;
  /** Absent d'une coquille plus ancienne, qui ne lit le téléphone que par le câble. */
  sansFil?: DesktopWirelessBridge;
  /** Absent d'une coquille plus ancienne, ou qui n'emporte pas l'application du téléphone. */
  application?: DesktopAppBridge;
  textes(texts: CloseQuestionTexts): Promise<BridgeAnswer<null>>;
  /**
   * Écrit une étape de la page dans le journal daté du programme (`journal.txt` de son profil), bornée à 300
   * caractères ; absent d'une coquille plus ancienne.
   */
  noter?(argument: { texte: string }): Promise<BridgeAnswer<null>>;
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

/** Longueur d'une ligne du journal du programme Windows gardée par la coquille, en caractères. */
export const DESKTOP_JOURNAL_LINE_MAX = 300;

/** Vrai dans le programme Windows dont la coquille tient un journal daté (`noteJournal`). */
export const desktopJournalAvailable = (): boolean => typeof desktopBridge()?.noter === 'function';

/**
 * Note une étape de la page (attente du téléphone, départ d'une synchronisation, issue) dans le journal daté du
 * programme Windows (`journal.txt` de son profil), pour comprendre après coup ce que l'utilisateur a vu ; rien de
 * personnel n'y va (ni nom de session, ni contenu de fichier). Sans attendre ni jamais échouer : un refus ou un pont
 * refermé perdent la ligne, rien de plus. Sans effet ailleurs et dans une coquille plus ancienne. Une ligne vide n'est
 * pas envoyée ; une ligne trop longue est coupée avant l'envoi.
 */
export const noteJournal = (text: string): void => {
  const bridge = desktopBridge();
  if (typeof bridge?.noter !== 'function') return;
  const line = text.trim();
  if (line === '') return;
  const letters = [...line];
  const texte = letters.length > DESKTOP_JOURNAL_LINE_MAX ? letters.slice(0, DESKTOP_JOURNAL_LINE_MAX).join('') : line;
  try {
    void bridge.noter({ texte }).catch(() => undefined);
  } catch {
    // Pont refermé pendant l'appel : la ligne est perdue.
  }
};
