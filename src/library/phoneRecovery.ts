import { t, tn } from '../core/i18n';
import { describeImport, type ImportReport } from './importReport';

/**
 * Récupération des sessions d'un téléphone branché : quels fichiers de son dossier lire, quelles sessions le PC a
 * déjà, sans les lire, et ce que la fenêtre en dit. Pur.
 */

/** Fichier d'un côté ou de l'autre : chemin (téléphone, relatif à son dossier) ou nom (PC, dans `sessions/`), taille en octets. */
export interface SizedFile {
  path: string;
  size: number;
}

export interface PhoneRecoveryChoice {
  /** Fichiers du téléphone à passer à l'import, dans l'ordre reçu. */
  toImport: string[];
  /** GPX du téléphone dont la session est déjà sur le PC, laissés sans être lus. */
  alreadyHere: string[];
  /** Fichiers de `toImport` que l'import lira : GPX et FIT, et la fiche et les capteurs d'un GPX retenu. */
  toRead: number;
}

const extensionOf = (path: string): string => /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? '';

/** Chemin sans extension, en minuscules : ce qui rapproche un GPX de sa fiche et de ses capteurs. */
const keyOf = (path: string): string => path.replace(/\.[a-z0-9]+$/i, '').toLowerCase();

/** Dernier nom d'un chemin, en minuscules (le disque de Windows ignore la casse). */
const nameOf = (path: string): string => (path.split('/').pop() ?? path).toLowerCase();

/**
 * Choix des fichiers à lire sur le téléphone. `phone` : ses fichiers à importer (GPX, FIT, fiches, capteurs) ;
 * `pcSessions` : les fichiers du dossier `sessions/` du PC.
 *
 * Une session est déjà là, et ni son GPX ni sa fiche ni ses capteurs ne sont lus, quand le PC a un GPX du même nom et
 * de la même taille, et que ses capteurs sont absents du téléphone ou de la même taille sur le PC. Tout le reste passe
 * à l'import, qui reconnaît encore une session déjà rangée sous un autre nom (heure de départ) : rien n'est doublé.
 */
export const choosePhoneFiles = (phone: readonly SizedFile[], pcSessions: readonly SizedFile[]): PhoneRecoveryChoice => {
  const pc = new Map(pcSessions.map((f) => [nameOf(f.path), f.size]));
  const byKey = new Map<string, Map<string, SizedFile>>();
  for (const f of phone) {
    const key = keyOf(f.path);
    const group = byKey.get(key) ?? new Map<string, SizedFile>();
    group.set(extensionOf(f.path), f);
    byKey.set(key, group);
  }
  const skipped = new Set<string>();
  const alreadyHere: string[] = [];
  for (const [key, group] of byKey) {
    const gpx = group.get('gpx');
    if (!gpx || pc.get(nameOf(gpx.path)) !== gpx.size) continue;
    const imu = group.get('imu');
    if (imu && pc.get(nameOf(imu.path)) !== imu.size) continue;
    skipped.add(key);
    alreadyHere.push(gpx.path);
  }
  const toImport = phone.filter((f) => !skipped.has(keyOf(f.path))).map((f) => f.path);
  const toRead = toImport.filter((path) => {
    const ext = extensionOf(path);
    if (ext === 'gpx' || ext === 'fit') return true;
    return byKey.get(keyOf(path))?.has('gpx') === true;
  }).length;
  return { toImport, alreadyHere, toRead };
};

/** Issue d'une récupération, ou pourquoi elle n'a pas pu se faire. */
export type PhoneRecoveryOutcome =
  /**
   * Le téléphone n'est pas prêt : rien de branché ni de relié, autorisation à donner, sans réponse, liaison tenue par
   * un autre programme. `wireless` : le sans-fil du PC attend un téléphone (`listening`) ou est éteint (`off`) ; absent
   * d'un programme qui ne le propose pas.
   */
  | { kind: 'phone'; state: 'absent' | 'autorisation' | 'horsLigne' | 'occupe'; wireless?: 'listening' | 'off' }
  /** L'outil de Google qui lit le téléphone manque ; `folder` : où le poser. */
  | { kind: 'tool-missing'; folder: string }
  /** Pas de dossier `Documents/Gtracker` sur le téléphone `phone`. */
  | { kind: 'no-phone-folder'; phone: string }
  /** La mémoire du PC n'accepte pas d'import ; `text` dit pourquoi. */
  | { kind: 'memory'; text: string }
  /** Un autre import tourne. */
  | { kind: 'busy' }
  /** Panne imprévue ; `detail` : sa phrase. */
  | { kind: 'error'; detail: string; channel?: PhoneRecoveryChannel }
  /**
   * Import fait, en entier ou jusqu'au débranchement ou à la coupure de la liaison (`unplugged`). `report` compte aussi,
   * parmi les déjà présentes, les sessions laissées sans être lues ; `sessionsOnPhone` : GPX et FIT trouvés sur le
   * téléphone ; `channel` : par où il a été lu.
   */
  | { kind: 'done'; phone: string; report: ImportReport; sessionsOnPhone: number; unplugged: boolean; channel?: PhoneRecoveryChannel };

/** Par où le téléphone est lu : le Wi-Fi (`sansFil`) ou le câble. */
export type PhoneRecoveryChannel = 'sansFil' | 'cable';

/** Ce que la fenêtre montre d'une issue : ses phrases, un dossier à recopier, et s'il faut proposer « Réessayer ». */
export interface PhoneRecoveryText {
  paragraphs: string[];
  /** Chemin à montrer à part, sous les phrases, pour qu'on puisse le recopier. */
  folder: string | null;
  retry: boolean;
}

const say = (paragraphs: string[], retry = true, folder: string | null = null): PhoneRecoveryText => ({ paragraphs, folder, retry });

/** Phrases d'une issue, dans la langue de l'interface. */
export const describePhoneRecovery = (outcome: PhoneRecoveryOutcome): PhoneRecoveryText => {
  switch (outcome.kind) {
    case 'phone':
      switch (outcome.state) {
        case 'absent': {
          const usbHelp = t('La première fois, il faut aussi activer le « Débogage USB » du téléphone : ouvrez Paramètres, puis À propos du téléphone, et touchez sept fois « Version » pour afficher les options pour développeurs. Ouvrez-les, activez « Débogage USB », puis revenez ici.');
          // Sans câble d'abord quand le PC attend un téléphone ; le câble reste toujours proposé en second.
          if (outcome.wireless === 'listening') {
            return say([
              t("Aucun téléphone ne se présente. Ouvrez Gtracker sur votre téléphone, relié au même réseau que cet ordinateur (la même box Wi-Fi, ou un partage de connexion entre le téléphone et l'ordinateur ; pas un réseau « invité »), puis cliquez sur « Réessayer »."),
              t("À défaut, branchez votre téléphone à l'ordinateur par un câble USB, puis cliquez sur « Réessayer »."),
              usbHelp,
            ]);
          }
          return say([
            t("Aucun téléphone n'est vu. Branchez votre téléphone à l'ordinateur par un câble USB, puis cliquez sur « Réessayer »."),
            usbHelp,
            ...(outcome.wireless === 'off' ? [t('Sans câble : allumez le sans-fil dans Réglages, Mémoire, puis reliez votre téléphone.')] : []),
          ]);
        }
        case 'autorisation':
          return say([
            t("Regardez l'écran du téléphone : une fenêtre demande « Autoriser le débogage USB ? ». Cochez « Toujours autoriser cet ordinateur », touchez « Autoriser », puis cliquez ici sur « Réessayer »."),
            t("Si le téléphone le redemande au bout d'une semaine : dans les options pour développeurs, cochez « Désactiver le délai d'expiration des autorisations adb » pour ne plus le voir."),
          ]);
        case 'horsLigne':
          return say([t('Le téléphone est branché mais ne répond pas. Déverrouillez son écran, débranchez puis rebranchez le câble, et cliquez sur « Réessayer ».')]);
        default:
          return say([t('Un autre programme utilise la liaison avec le téléphone (Android Studio, scrcpy…). Fermez-le, puis cliquez sur « Réessayer ».')]);
      }
    case 'tool-missing':
      return say([
        t("Pour lire le téléphone, Gtracker a besoin d'un outil gratuit de Google, « SDK Platform-Tools », absent de cet ordinateur."),
        t("Téléchargez-le pour Windows sur developer.android.com/tools/releases/platform-tools, ouvrez le fichier .zip, copiez le dossier « platform-tools » qu'il contient dans le dossier ci-dessous, puis cliquez sur « Réessayer »."),
      ], true, outcome.folder);
    case 'no-phone-folder':
      return say([t("Le téléphone {phone} n'a pas de dossier « Documents/Gtracker ». Gtracker ne récupère que les sessions rangées dans ce dossier : sur le téléphone, ouvrez Gtracker, Réglages, Mémoire, pour voir où il les range.", { phone: outcome.phone })]);
    case 'memory':
      return say([outcome.text], false);
    case 'busy':
      return say([t("Un import de sessions est déjà en cours. Attendez qu'il finisse, puis cliquez sur « Réessayer ».")]);
    case 'error': {
      const detail = outcome.detail.replace(/\.\s*$/, '');
      if (outcome.channel === 'sansFil') {
        return say([t("Le téléphone n'a pas pu être lu ({detail}). Vérifiez que Gtracker est ouvert sur le téléphone, puis cliquez sur « Réessayer ».", { detail })]);
      }
      return say([t("Le téléphone n'a pas pu être lu ({detail}). Vérifiez le câble, puis cliquez sur « Réessayer ».", { detail })]);
    }
    case 'done': {
      const { report } = outcome;
      if (outcome.unplugged) {
        if (outcome.channel === 'sansFil') {
          return say([
            t("La liaison avec le téléphone a été coupée pendant la récupération. Les sessions déjà rangées restent sur le PC, entières : aucune n'est rangée à moitié."),
            describeImport(report),
            t('Rouvrez Gtracker sur le téléphone, puis cliquez sur « Réessayer » : seules les sessions qui manquent seront récupérées.'),
          ]);
        }
        return say([
          t("Le téléphone a été débranché pendant la récupération. Les sessions déjà rangées restent sur le PC, entières : aucune n'est rangée à moitié."),
          describeImport(report),
          t('Rebranchez-le, puis cliquez sur « Réessayer » : seules les sessions qui manquent seront récupérées.'),
        ]);
      }
      if (outcome.sessionsOnPhone === 0) {
        return say([t('Aucune session dans le dossier « Documents/Gtracker » du téléphone {phone}.', { phone: outcome.phone })], false);
      }
      const n = report.failed.length;
      if (n === 0) return say([describeImport(report)], false);
      return say([
        describeImport(report),
        `${tn(n, '{n} fichier non rangé ({list})', '{n} fichiers non rangés ({list})', { list: report.failed.join(' ; ') })}.`,
      ], report.retryable.length > 0);
    }
  }
};

/**
 * La ligne discrète que dit le PC quand un téléphone relié se présente et que ses sessions neuves sont rangées toutes
 * seules : une phrase, ou `null` quand il n'y a rien d'utile à dire (le téléphone est reparti, un autre import tourne,
 * l'outil du câble manque). `phone` : le nom que le téléphone a donné.
 */
export const describeArrivalRecovery = (outcome: PhoneRecoveryOutcome, phone: string): string | null => {
  switch (outcome.kind) {
    case 'phone':
    case 'tool-missing':
    case 'busy':
      return null;
    case 'no-phone-folder':
      return t("Téléphone {phone} relié, mais il n'a pas de dossier mémoire à lire.", { phone });
    case 'memory':
      return outcome.text;
    case 'error':
      return t("Téléphone {phone} relié, mais ses sessions n'ont pas pu être lues ({detail}).", { phone, detail: outcome.detail.replace(/\.\s*$/, '') });
    case 'done': {
      if (outcome.unplugged) {
        return t("La liaison avec le téléphone {phone} a été coupée en route : cliquez sur « Récupérer » pour finir.", { phone });
      }
      if (outcome.sessionsOnPhone === 0) return t('Téléphone {phone} relié : aucune session à récupérer.', { phone });
      const added = outcome.report.added.length;
      const first = added > 0
        ? tn(added, 'Téléphone {phone} relié : {n} session ajoutée.', 'Téléphone {phone} relié : {n} sessions ajoutées.', { phone })
        : t('Téléphone {phone} relié : toutes ses sessions sont déjà là.', { phone });
      const failed = outcome.report.failed.length;
      if (failed === 0) return first;
      return `${first} ${tn(failed, "{n} fichier n'a pas pu être rangé : cliquez sur « Récupérer » pour réessayer.", "{n} fichiers n'ont pas pu être rangés : cliquez sur « Récupérer » pour réessayer.")}`;
    }
  }
};
