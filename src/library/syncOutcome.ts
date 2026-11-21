import type { SyncRefusal, SyncSideName } from './syncBase';
import type { SyncExtraLeft, SyncExtraOp } from './syncExtras';
import type { SyncFirstReason, SyncItem, SyncPlan } from './syncPlan';

/**
 * Ce qu'a fait une synchronisation des sessions entre l'ordinateur et le téléphone, tel que l'exécutant le rend
 * (`hooks/sessionLibrary/sync.ts`) et que le compte rendu le lit (`syncReport.ts`). Types seulement, et le résultat
 * vide d'une synchronisation qui n'a rien fait.
 */

/**
 * Pourquoi rien n'a été fait : refus des marqueurs, base d'une version plus récente, mémoire de l'ordinateur sans
 * corbeille (`noTrash`) ou dont la corbeille ne se lit pas (`trashLocked`), mémoire non prête (`memory`), import ou
 * synchronisation déjà en cours (`busy`), copie de sécurité impossible avant la première synchronisation d'un
 * téléphone (`safetyCopy`, sa raison dans `SyncOutcome.error`).
 */
export type SyncStop = SyncRefusal | 'newerBase' | 'noTrash' | 'trashLocked' | 'memory' | 'busy' | 'safetyCopy';

export interface SyncFailure {
  item: SyncItem;
  detail: string;
}

/** Ce qu'est devenu chaque fichier de réglages, de FC repos et de lieux. */
export interface SyncExtrasOutcome {
  /** Écritures faites : fichier de réglages recopié, ou fonte écrite d'un côté. */
  done: SyncExtraOp[];
  /** Fichiers laissés, et pourquoi (règles du plan, changé depuis sa lecture, erreur sur l'ordinateur). */
  left: SyncExtraLeft[];
  /** Écritures vers un téléphone qu'on ne peut pas écrire : elles restent à faire. */
  withheld: SyncExtraOp[];
}

export interface SyncUnknownActivity {
  /** L'appareil qui a reçu la fiche, et qui ne connaît pas son activité. */
  side: SyncSideName;
  startMs: number;
  activityId: string;
}

/** Ce qu'a fait une synchronisation, pour son compte rendu. */
export interface SyncOutcome {
  /** Rien n'a été fait, et pourquoi ; `null` : la synchronisation a eu lieu (même coupée). */
  refusal: SyncStop | null;
  /** Vrai si la précédente avait été coupée (témoin trouvé au départ). */
  interrupted: boolean;
  /** Première rencontre des deux dossiers, et pourquoi : rien n'a été supprimé. */
  first: SyncFirstReason | null;
  /** Où la copie de sécurité faite avant la première synchronisation a été rangée ; `null` : pas de copie cette fois. */
  safetyCopy: string | null;
  /** Le plan exécuté, restrictions comprises ; `null` si rien n'a été fait. */
  plan: SyncPlan | null;
  /**
   * Sort des suppressions du plan : `made`, permises (faites, sauf session laissée) ; `excluded`, écartées à la demande
   * (« sans rien supprimer ») ; `awaitingConfirmation`, retenues par le garde-fou, à confirmer (`confirmDeletions`).
   */
  deletions: 'made' | 'excluded' | 'awaitingConfirmation';
  /**
   * Sessions dont une suppression n'a pas été faite parce qu'elle n'était pas permise : écartée, en attente de
   * confirmation, ou retrait d'un téléphone qu'on ne peut pas écrire (`phoneWritable`). Elles restent à faire.
   */
  withheldDeletions: SyncItem[];
  /**
   * Sessions dont une écriture ou un retrait sur le téléphone n'a pas été fait parce que le téléphone ne s'écrivait
   * pas (par le sans-fil) : elles attendent le câble. Prises dans le plan entier, avant restriction.
   */
  withheldForPhone: SyncItem[];
  /** Vrai si le téléphone a pu être écrit ; faux : seule la moitié de l'ordinateur a été faite. */
  phoneWritable: boolean;
  /** Sessions dont toutes les opérations ont été faites. */
  done: SyncItem[];
  /** Sessions laissées pour la fois suivante : un fichier n'était plus celui du plan. */
  skipped: SyncItem[];
  /** Sessions arrêtées par une erreur sur l'ordinateur, avec son texte. */
  failed: SyncFailure[];
  /** Identités dont une copie du téléphone a été rangée à la corbeille avant d'en être retirée. */
  keptFromPhone: number[];
  /** Texte de l'erreur du dossier distant qui a tout arrêté (liaison perdue) ; `null` sinon. */
  linkLost: string | null;
  /** Texte d'une autre erreur qui a tout arrêté avant ou après les sessions, ou raison du refus `safetyCopy` ; `null` sinon. */
  error: string | null;
  /** Fichiers de réglages, tests de FC repos et lieux appris. */
  extras: SyncExtrasOutcome;
  /**
   * Sessions reçues par un appareil qui ne connaît pas leur activité (`SyncOptions.knownActivities`) : de quoi lui
   * conseiller de reprendre les réglages de l'autre.
   */
  unknownActivities: SyncUnknownActivity[];
  /**
   * Vrai si tout le plan a été fait, sans restriction ni session laissée, et sans fichier de réglages, de FC repos ou
   * de lieux arrêté par une erreur ou changé pendant la synchronisation : la base porte la date de cette fin.
   */
  complete: boolean;
}

/** Résultat d'une synchronisation qui n'a rien fait, pour la raison `refusal` (`null` : point de départ de l'exécutant). */
export const emptySyncOutcome = (refusal: SyncStop | null): SyncOutcome => ({
  refusal, interrupted: false, first: null, safetyCopy: null, plan: null, deletions: 'made', withheldDeletions: [], withheldForPhone: [],
  phoneWritable: false, done: [], skipped: [], failed: [], keptFromPhone: [],
  extras: { done: [], left: [], withheld: [] }, unknownActivities: [],
  linkLost: null, error: null, complete: false,
});
