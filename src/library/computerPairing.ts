import { randomBytes } from '@noble/hashes/utils.js';
import {
  ErreurSpake2, TAILLE_CONFIRMATION, TAILLE_EMPREINTE_SPAKE2, TAILLE_PART, commencerAppairage, conclure, confirmationValide,
  identitesAppairage, octetsDepuisHex, octetsEnHex, type AleaSpake2, type EtatSpake2,
} from '../../bureau/spake2';
import {
  ComputerLinkRefused, type ComputerLinkError, type ComputerLinkPort, type ComputerLinkStatus, type PairStepFailure,
} from '../platform/computerLink';
import { CODE_LENGTH } from './computerLink';

/**
 * L'appairage du téléphone au programme Windows par le code affiché sur l'ordinateur, conduit par la page : échange
 * SPAKE2 (`bureau/spake2.ts`, le même calcul que l'ordinateur), le greffon ne faisant que transporter les messages
 * (`platform/computerLink.ts`). Le code ne quitte jamais la page.
 *
 * Déroulé : la recherche rend jusqu'à 4 ordinateurs candidats ; chacun est essayé à son tour, avec un scalaire secret
 * neuf : la part du téléphone part dans `appairer`, celle de l'ordinateur revient dans `defi` avec l'empreinte du
 * certificat vu, qui est l'identité de l'ordinateur dans l'échange ; la confirmation du téléphone part, celle de
 * l'ordinateur revient et est vérifiée. Juste, l'ordinateur est gardé ; jamais sinon : un appareil qui ne connaît pas
 * le code ne peut pas la produire, et ce qu'il a vu ne lui permet d'essayer aucun autre code. Un ordinateur resté à
 * l'ancien échange (`defi` sans part) arrête ce candidat sur « version », sans que rien de l'ancien échange ne parte.
 */

/**
 * Ordinateurs candidats essayés au plus à chaque appui sur « Relier » : chacun qui reçoit la part du téléphone et
 * rend la sienne obtient un essai de code, si bien qu'un intrus essaie au plus 4 codes à chaque appui. La boucle
 * continue après un échec (un appareil qui répond le premier n'empêche pas l'appairage), et aucune recherche n'est
 * relancée sans un geste de l'utilisateur.
 */
export const PAIR_CANDIDATES_MAX = 4;

/**
 * Les chiffres du code tels qu'ils entrent dans le calcul : ceux tapés, espaces retirés, à la longueur
 * `CODE_LENGTH` exactement ; `null` pour toute autre saisie.
 */
export const pairingCode = (typed: string): string | null => {
  const code = typed.replace(/\s/g, '');
  return new RegExp(`^[0-9]{${CODE_LENGTH}}$`).test(code) ? code : null;
};

/** Ce que l'appairage demande au greffon : ses quatre étapes. */
export type PairingSteps = Pick<ComputerLinkPort, 'pairSearch' | 'pairOffer' | 'pairConfirm' | 'pairFinish'>;

export interface PairingRequest {
  code: string;
  /** Adresse tapée, « a.b.c.d:port » ; absente, l'ordinateur est cherché sur le réseau. */
  address?: string;
  /** Le dossier mémoire que l'ordinateur lira, une fois relié. */
  folder: string | null;
  base?: string;
}

/**
 * Raisons d'échec d'un candidat, de la plus parlante à la moins parlante : celle qui reste quand aucun candidat n'a
 * abouti. Un code refusé par l'ordinateur dit à l'utilisateur quoi corriger ; une confirmation fausse dit qu'un autre
 * appareil a répondu ; puis la fenêtre fermée, la version, les refus et messages incompris, la coupure ; un
 * ordinateur injoignable en dernier.
 */
export const PAIR_FAILURE_ORDER: readonly PairStepFailure[] = [
  'code', 'proof', 'window', 'version', 'nonce', 'protocol', 'network', 'unreachable',
];

/** La plus parlante de deux raisons (`PAIR_FAILURE_ORDER`). */
export const worseFailure = (a: PairStepFailure | null, b: PairStepFailure): PairStepFailure =>
  (a === null || PAIR_FAILURE_ORDER.indexOf(b) < PAIR_FAILURE_ORDER.indexOf(a) ? b : a);

/**
 * Identité provisoire de l'ordinateur, le temps que sa part parte : la part du téléphone (pA = x·G + w·M) ne dépend
 * pas des identités, qui n'entrent que dans la transcription, posée avec l'empreinte vue avant de conclure.
 */
const EMPREINTE_EN_ATTENTE = new Uint8Array(TAILLE_EMPREINTE_SPAKE2);

/** Issue d'un candidat : gardé (l'état rendu), écarté sur une raison, ou passé (ordinateur déjà essayé). */
type CandidateOutcome = { kept: ComputerLinkStatus } | { failure: PairStepFailure } | { skipped: true };

const tryCandidate = async (
  steps: PairingSteps, generation: number, endpoint: string, request: PairingRequest, alea: AleaSpake2, seen: Set<string>,
): Promise<CandidateOutcome> => {
  // Un scalaire secret neuf pour chaque candidat : un état ne sert qu'une fois.
  const debut = commencerAppairage('A', request.code, EMPREINTE_EN_ATTENTE, alea);
  const offer = await steps.pairOffer({ generation, endpoint, partA: octetsEnHex(debut.part) });
  if (offer.failure !== null) return { failure: offer.failure };
  const empreinte = octetsDepuisHex(offer.fingerprint, TAILLE_EMPREINTE_SPAKE2);
  if (empreinte === null) return { failure: 'protocol' };
  // Le même ordinateur trouvé deux fois (deux adresses) : une seule confirmation, pour ne pas compter deux codes faux.
  if (seen.has(offer.fingerprint)) return { skipped: true };
  seen.add(offer.fingerprint);
  if (offer.partB === null) return { failure: 'version' };
  const partB = octetsDepuisHex(offer.partB, TAILLE_PART);
  if (partB === null) return { failure: 'protocol' };
  const etat: EtatSpake2 = { ...debut, identites: identitesAppairage(empreinte) };
  let cles: ReturnType<typeof conclure>;
  try {
    // Un seul `conclure` par état ; l'état est jeté avec ce candidat, quelle que soit l'issue.
    cles = conclure(etat, partB);
  } catch (err) {
    if (!(err instanceof ErreurSpake2)) throw err;
    // K neutre : la part reçue vaut w·N, celle d'un appareil qui a deviné le code. Traité exactement comme une
    // confirmation fausse, sans le distinguer au-dehors ; rien ne part vers cet appareil.
    if (err.raison === 'cle') return { failure: 'proof' };
    // Part hors de la courbe, neutre ou mal formée.
    return { failure: 'protocol' };
  }
  const confirm = await steps.pairConfirm({ generation, cA: octetsEnHex(cles.confirmationEnvoyee) });
  if (confirm.failure !== null) return { failure: confirm.failure };
  const cB = octetsDepuisHex(confirm.cB, TAILLE_CONFIRMATION);
  // L'appareil ne connaît pas le code : ce n'est pas l'ordinateur de l'utilisateur. Rien n'est gardé.
  if (cB === null || !confirmationValide(cles, cB)) return { failure: 'proof' };
  return { kept: await steps.pairFinish({ generation, keep: true, folder: request.folder, base: request.base }) };
};

/** Raison montrée quand aucun candidat n'a abouti, et si l'état doit dire « introuvable ». */
const closingOf = (failure: PairStepFailure | null): { error: ComputerLinkError; notFound: boolean } =>
  (failure === null || failure === 'unreachable' ? { error: 'network', notFound: true } : { error: failure, notFound: false });

/**
 * Appaire le téléphone à l'ordinateur qui affiche `code` ; rend l'état du greffon une fois l'appairage fini (relié,
 * ou fermé sur sa raison). Lève `ComputerLinkRefused` (`code`) pour un code mal formé, avant toute tentative.
 * `alea` : source d'octets aléatoires sûre, hors des tests celle du système (`randomBytes` de `@noble/hashes`, sur
 * `crypto.getRandomValues`). Rien de l'échange (code, scalaires, K, transcription, clés, confirmation attendue) ne
 * part vers le greffon ni dans un journal : seuls la part et la confirmation du téléphone passent le pont.
 */
export const pairWithComputer = async (
  steps: PairingSteps, request: PairingRequest, alea: AleaSpake2 = randomBytes,
): Promise<ComputerLinkStatus> => {
  const code = pairingCode(request.code);
  if (code === null) throw new ComputerLinkRefused('code');
  const search = await steps.pairSearch(request.address ? { address: request.address } : {});
  if (search.candidates.length === 0) return search.status;
  const { generation } = search;
  const seen = new Set<string>();
  let worst: PairStepFailure | null = null;
  try {
    for (const endpoint of search.candidates.slice(0, PAIR_CANDIDATES_MAX)) {
      const outcome = await tryCandidate(steps, generation, endpoint, { ...request, code }, alea, seen);
      if ('kept' in outcome) return outcome.kept;
      if ('failure' in outcome) worst = worseFailure(worst, outcome.failure);
    }
  } catch (err) {
    // Panne imprévue (pont du greffon) : l'appairage est fermé sans rien garder, puis la panne remonte.
    await steps.pairFinish({ generation, keep: false, error: 'network', notFound: false }).catch(() => undefined);
    throw err;
  }
  return steps.pairFinish({ generation, keep: false, ...closingOf(worst) });
};
