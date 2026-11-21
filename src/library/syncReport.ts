import { t, tn } from '../core/i18n';
import { formatSessionDate } from '../core/units';
import type { SyncOutcome } from './syncOutcome';
import type { SyncItem, SyncLeftReason, SyncOp } from './syncPlan';
import type { SyncSideName } from './syncBase';
import type { RouteSyncItem, RouteSyncOp } from './syncRoutes';

/**
 * Ce que la fenêtre « Synchroniser » du programme Windows dit d'une synchronisation avec le téléphone : l'état d'un
 * téléphone qui n'est pas prêt, le compte rendu ligne par ligne, et les questions à poser avant d'aller plus loin
 * (garde-fou des suppressions, sessions de la corbeille encore sur le téléphone). Pur : tout se lit dans l'issue.
 */

/** Par où le téléphone est lu : le Wi-Fi (`sansFil`) ou le câble. */
export type PhoneLinkChannel = 'sansFil' | 'cable';

/**
 * Téléphone qui n'est pas prêt : rien de branché ni de relié, autorisation à donner, sans réponse, liaison tenue par un
 * autre programme. `wireless` : le sans-fil du PC attend un téléphone (`listening`) ou est éteint (`off`) ; absent
 * d'un programme qui ne le propose pas. Ou l'outil de Google qui lit le téléphone manque ; `folder` : où le poser.
 */
export type PhoneNotReady =
  | { kind: 'phone'; state: 'absent' | 'autorisation' | 'horsLigne' | 'occupe'; wireless?: 'listening' | 'off' }
  | { kind: 'tool-missing'; folder: string };

/** Issue du bouton « Synchroniser », de l'état du téléphone au compte rendu. */
export type PhoneSyncResult =
  | PhoneNotReady
  /** Pas de dossier `Documents/Gtracker` sur le téléphone `phone`. */
  | { kind: 'no-phone-folder'; phone: string }
  /** Panne imprévue avant la synchronisation (état, ouverture du dossier) ; `detail` : sa phrase. */
  | { kind: 'error'; detail: string; channel?: PhoneLinkChannel }
  /** La synchronisation a été tentée : son issue, même refusée ou coupée. */
  | { kind: 'synced'; phone: string; channel: PhoneLinkChannel; outcome: SyncOutcome };

/** Ce que la fenêtre montre : ses phrases, un dossier à recopier, et s'il faut proposer « Réessayer ». */
export interface PhoneLinkText {
  paragraphs: string[];
  /** Chemin à montrer à part, sous les phrases, pour qu'on puisse le recopier. */
  folder: string | null;
  retry: boolean;
}

const say = (paragraphs: string[], retry = true, folder: string | null = null): PhoneLinkText => ({ paragraphs, folder, retry });

/** Phrases d'un téléphone qui n'est pas prêt, dans la langue de l'interface. */
export const describePhoneState = (outcome: PhoneNotReady): PhoneLinkText => {
  if (outcome.kind === 'tool-missing') {
    return say([
      t("Pour lire le téléphone, Gtracker a besoin d'un outil gratuit de Google, « SDK Platform-Tools », absent de cet ordinateur."),
      t("Téléchargez-le pour Windows sur developer.android.com/tools/releases/platform-tools, ouvrez le fichier .zip, copiez le dossier « platform-tools » qu'il contient dans le dossier ci-dessous, puis cliquez sur « Réessayer »."),
    ], true, outcome.folder);
  }
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
};

/** Phrase d'un téléphone qui n'a pas pu être lu ; `detail` : la raison donnée par la liaison. */
export const describePhoneReadError = (detail: string, channel?: PhoneLinkChannel): string => {
  const clean = detail.replace(/\.\s*$/, '');
  return channel === 'sansFil'
    ? t("Le téléphone n'a pas pu être lu ({detail}). Vérifiez que Gtracker est ouvert sur le téléphone, puis cliquez sur « Réessayer ».", { detail: clean })
    : t("Le téléphone n'a pas pu être lu ({detail}). Vérifiez le câble, puis cliquez sur « Réessayer ».", { detail: clean });
};

/** Phrase montrée avant la première synchronisation d'un téléphone, dès que le plan est fait. */
export const firstSyncText = (): string =>
  t('Première synchronisation avec ce téléphone : rien ne sera supprimé, chaque appareil reçoit ce qui lui manque.');

/** Ligne dite quand un téléphone relié par le sans-fil se présente : plus rien ne se copie seul. */
export const phoneArrivalText = (): string =>
  t('Téléphone relié : touchez « Synchroniser » pour mettre les deux appareils à jour.');

/** Phrase d'une étape d'avant la copie. */
export const syncStepText = (step: 'searching' | 'comparing' | 'safetyCopy'): string => {
  switch (step) {
    case 'searching':
      return t('Recherche du téléphone…');
    case 'comparing':
      return t('Comparaison des deux appareils…');
    default:
      return t('Copie de sécurité des deux appareils…');
  }
};

/** Avancement de la copie : « 12 fichiers sur 50 ». */
export const syncProgressText = (done: number, total: number): string =>
  tn(total, '{done} fichier sur {n}', '{done} fichiers sur {n}', { done });

const hasOp = (item: SyncItem, test: (op: SyncOp) => boolean): boolean => item.ops.some(test);

const writesPhone = (op: SyncOp): boolean =>
  op.kind === 'removeFromPhone' || ('to' in op && op.to === 'phone') || ('on' in op && op.on === 'phone');

const hasRouteOp = (item: RouteSyncItem, test: (op: RouteSyncOp) => boolean): boolean => item.ops.some(test);

const routeWritesPhone = (op: RouteSyncOp): boolean => op.kind === 'removeFromPhone' || (op.kind === 'copy' && op.to === 'phone');

/** Lignes du compte rendu sur les itinéraires ; `retry` : vrai si l'une dit quelque chose qui reste à finir. */
const routeLines = (outcome: SyncOutcome): { lines: string[]; retry: boolean } => {
  const { routes } = outcome;
  const lines: string[] = [];
  if (routes.waiting) lines.push(t('Les itinéraires attendent le câble ou la mise à jour du téléphone.'));
  const done = routes.done;
  const copiedTo = (side: SyncSideName): number =>
    done.filter((i) => (i.case === 'newOnComputer' || i.case === 'newOnPhone' || i.revived) && hasRouteOp(i, (op) => op.kind === 'copy' && op.to === side)).length;
  const toPhone = copiedTo('phone');
  const toComputer = copiedTo('computer');
  if (toPhone > 0 && toComputer > 0) {
    lines.push(`${tn(toPhone, '{n} itinéraire copié vers le téléphone', '{n} itinéraires copiés vers le téléphone')}, ${tn(toComputer, "{n} vers l'ordinateur", "{n} vers l'ordinateur")}.`);
  } else if (toPhone > 0) {
    lines.push(tn(toPhone, '{n} itinéraire copié vers le téléphone.', '{n} itinéraires copiés vers le téléphone.'));
  } else if (toComputer > 0) {
    lines.push(tn(toComputer, "{n} itinéraire copié vers l'ordinateur.", "{n} itinéraires copiés vers l'ordinateur."));
  }
  const modified = done.filter((i) => (i.case === 'followed' || i.case === 'firstMeeting') && !i.conflict && hasRouteOp(i, (op) => op.kind === 'copy')).length;
  if (modified > 0) lines.push(tn(modified, '{n} itinéraire modifié recopié.', '{n} itinéraires modifiés recopiés.'));
  const trashed = done.filter((i) => i.case === 'deletedOnPhone' && hasRouteOp(i, (op) => op.kind === 'trash')).length;
  if (trashed > 0) {
    lines.push(tn(trashed, "{n} itinéraire supprimé sur le téléphone : mis dans la corbeille de l'ordinateur (30 jours).", "{n} itinéraires supprimés sur le téléphone : mis dans la corbeille de l'ordinateur (30 jours)."));
  }
  const removed = done.filter((i) => i.case === 'deletedOnComputer' && hasRouteOp(i, (op) => op.kind === 'removeFromPhone')).length;
  if (removed > 0) lines.push(tn(removed, "{n} itinéraire supprimé sur l'ordinateur : retiré du téléphone.", "{n} itinéraires supprimés sur l'ordinateur : retirés du téléphone."));
  const conflicts = done.filter((i) => i.conflict && hasRouteOp(i, (op) => op.kind === 'copy')).length;
  if (conflicts > 0) {
    lines.push(tn(conflicts, "{n} itinéraire modifié sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours).", "{n} itinéraires modifiés sur les deux appareils : la version la plus récente est gardée, l'autre est dans la corbeille de l'ordinateur (30 jours)."));
  }
  const items = routes.plan?.items ?? [];
  const untouched = items.filter((i) => i.left === 'unreadable' || i.left === 'newer').length
    + (routes.plan?.aside.filter((a) => a.reason === 'unreadable').length ?? 0);
  if (untouched > 0) {
    lines.push(tn(untouched, "{n} itinéraire laissé tel quel : illisible, ou d'une version plus récente de Gtracker.", "{n} itinéraires laissés tels quels : illisibles, ou d'une version plus récente de Gtracker."));
  }
  const inTrash = items.filter((i) => i.left === 'inTrash').length;
  if (inTrash > 0) {
    lines.push(tn(inTrash, "{n} itinéraire de la corbeille de l'ordinateur est encore sur le téléphone : laissé sur le téléphone.", "{n} itinéraires de la corbeille de l'ordinateur sont encore sur le téléphone : laissés sur le téléphone."));
  }
  if (routes.skipped.length > 0) {
    lines.push(tn(routes.skipped.length, '{n} itinéraire laissé pour la prochaine fois : il a changé pendant la synchronisation.', '{n} itinéraires laissés pour la prochaine fois : ils ont changé pendant la synchronisation.'));
  }
  if (routes.failed.length > 0) {
    const list = [...new Set(routes.failed.map((f) => f.detail.replace(/\.\s*$/, '')))].join(' ; ');
    lines.push(tn(routes.failed.length, "{n} itinéraire n'a pas pu être écrit sur l'ordinateur ({list}).", "{n} itinéraires n'ont pas pu être écrits sur l'ordinateur ({list}).", { list }));
  }
  return { lines, retry: routes.skipped.length > 0 || routes.failed.length > 0 };
};

/** Raisons d'une session qui n'est pas finie de ranger sur son appareil. */
const UNFINISHED: readonly SyncLeftReason[] = ['noRecord', 'unreadableRecord', 'emptyGpx', 'unfinishedGpx'];

/** Phrases d'une synchronisation refusée. */
const refusalText = (outcome: SyncOutcome): PhoneLinkText => {
  const detail = (outcome.error ?? '').replace(/\.\s*$/, '');
  switch (outcome.refusal) {
    case 'computerNoMarker':
      return say([t("Le dossier mémoire de cet ordinateur n'a pas de marqueur Gtracker : la synchronisation ne peut pas se faire.")], false);
    case 'phoneNoMarker':
      return say([t("Le dossier « Documents/Gtracker » du téléphone n'a pas de marqueur Gtracker. Ouvrez Gtracker une fois sur le téléphone, puis cliquez sur « Réessayer ».")]);
    case 'computerNewer':
      return say([t("La mémoire de cet ordinateur vient d'une version plus récente de Gtracker : mettez ce programme à jour avant de synchroniser.")], false);
    case 'phoneNewer':
      return say([t("La mémoire du téléphone vient d'une version plus récente de Gtracker : mettez ce programme à jour avant de synchroniser.")], false);
    case 'newerBase':
      return say([t('La dernière synchronisation a été faite par une version plus récente de Gtracker : mettez ce programme à jour avant de synchroniser.')], false);
    case 'noTrash':
    case 'memory':
      return say([t("La mémoire de cet ordinateur n'est pas ouverte en écriture : la synchronisation ne peut pas se faire.")], false);
    case 'trashLocked':
      return say([t("La corbeille de cet ordinateur ne se lit pas : rien n'a été synchronisé.")], false);
    case 'busy':
      return say([t("Un import, une synchronisation ou un enregistrement est en cours. Attendez qu'il finisse, puis cliquez sur « Réessayer ».")]);
    default:
      return say([t("La copie de sécurité des deux appareils n'a pas pu être faite ({detail}) : rien n'a été synchronisé.", { detail })]);
  }
};

/** Compte rendu d'une synchronisation, une ligne par cas non nul ; `channel` : par où le téléphone a été lu. */
export const describeSync = (outcome: SyncOutcome, channel: PhoneLinkChannel = 'cable'): PhoneLinkText => {
  if (outcome.refusal !== null) return refusalText(outcome);
  const items = outcome.plan?.items ?? [];
  const done = outcome.done;
  const lines: string[] = [];
  /** Vrai dès qu'une ligne dit quelque chose qui reste à faire ou qui a mal tourné. */
  let retry = false;

  if (outcome.interrupted) lines.push(t("La synchronisation précédente avait été coupée : elle a repris là où elle s'était arrêtée."));
  // Un téléphone qu'on ne peut pas écrire ne reçoit pas d'identifiant : chaque passe serait « la première ». Une
  // phrase stable dit à la place ce que fait le sans-fil d'un ancien téléphone ; le nombre de ce qui attend vient
  // plus bas. Un téléphone qui enregistre a sa propre phrase, plus bas aussi.
  const header = outcome.phoneWritable
    ? outcome.first !== null ? t("Première synchronisation avec ce téléphone : rien n'a été supprimé.") : null
    : outcome.phoneRecording ? null
    : t("Sans câble, le téléphone n'est pas modifié : seules ses sessions sont copiées vers l'ordinateur.");
  if (header !== null) lines.push(header);

  const toPhone = done.filter((i) => hasOp(i, (op) => op.kind === 'copy' && op.to === 'phone')).length;
  const toComputer = done.filter((i) => hasOp(i, (op) => op.kind === 'copy' && op.to === 'computer')).length;
  if (toPhone > 0 && toComputer > 0) {
    lines.push(`${tn(toPhone, '{n} session copiée vers le téléphone', '{n} sessions copiées vers le téléphone')}, ${tn(toComputer, "{n} vers l'ordinateur", "{n} vers l'ordinateur")}.`);
  } else if (toPhone > 0) {
    lines.push(tn(toPhone, '{n} session copiée vers le téléphone.', '{n} sessions copiées vers le téléphone.'));
  } else if (toComputer > 0) {
    lines.push(tn(toComputer, "{n} session copiée vers l'ordinateur.", "{n} sessions copiées vers l'ordinateur."));
  }
  const modified = done.filter((i) => !hasOp(i, (op) => op.kind === 'copy') && hasOp(i, (op) => op.kind === 'writeRecord' || op.kind === 'copyRecord' || op.kind === 'copyImu')).length;
  if (modified > 0) lines.push(tn(modified, '{n} session modifiée recopiée.', '{n} sessions modifiées recopiées.'));
  const trashed = done.filter((i) => i.case === 'deletedOnPhone' && hasOp(i, (op) => op.kind === 'trash')).length;
  if (trashed > 0) {
    lines.push(tn(trashed, "{n} session supprimée sur le téléphone : mise dans la corbeille de l'ordinateur (30 jours).", "{n} sessions supprimées sur le téléphone : mises dans la corbeille de l'ordinateur (30 jours)."));
  }
  const removed = done.filter((i) => i.case === 'deletedOnComputer' && hasOp(i, (op) => op.kind === 'removeFromPhone')).length;
  if (removed > 0) lines.push(tn(removed, "{n} session supprimée sur l'ordinateur : retirée du téléphone.", "{n} sessions supprimées sur l'ordinateur : retirées du téléphone."));
  const conflicts = done.filter((i) => i.conflicts.length > 0).length;
  if (conflicts > 0) {
    lines.push(tn(conflicts, "{n} session modifiée sur les deux appareils : les changements de l'ordinateur l'ont emporté.", "{n} sessions modifiées sur les deux appareils : les changements de l'ordinateur l'ont emporté."));
  }

  const unfinishedOn = (side: SyncSideName): number =>
    items.filter((i) => i.left !== null && UNFINISHED.includes(i.left) && i.files[side] !== null && i.files[side === 'phone' ? 'computer' : 'phone'] === null).length
    + (outcome.plan?.unknown.filter((u) => u.side === side && UNFINISHED.includes(u.reason)).length ?? 0);
  const unfinishedPhone = unfinishedOn('phone');
  if (unfinishedPhone > 0) {
    lines.push(tn(unfinishedPhone, "{n} session laissée pour la prochaine fois : elle n'est pas finie sur le téléphone.", "{n} sessions laissées pour la prochaine fois : elles ne sont pas finies sur le téléphone."));
  }
  const unfinishedComputer = unfinishedOn('computer');
  if (unfinishedComputer > 0) {
    lines.push(tn(unfinishedComputer, "{n} session laissée pour la prochaine fois : elle n'est pas finie sur l'ordinateur.", "{n} sessions laissées pour la prochaine fois : elles ne sont pas finies sur l'ordinateur."));
  }
  const leftFor = (reason: SyncLeftReason): number => items.filter((i) => i.left === reason).length;
  const changedGpx = leftFor('changedGpx');
  if (changedGpx > 0) {
    lines.push(tn(changedGpx, '{n} session laissée telle quelle : sa trace a changé sur un des deux appareils depuis la dernière synchronisation.', '{n} sessions laissées telles quelles : leur trace a changé sur un des deux appareils depuis la dernière synchronisation.'));
  }
  const future = leftFor('futureRecord');
  if (future > 0) {
    lines.push(tn(future, "{n} session laissée telle quelle : sa fiche vient d'une version plus récente de Gtracker.", "{n} sessions laissées telles quelles : leur fiche vient d'une version plus récente de Gtracker."));
  }
  const inTrash = leftFor('inTrash');
  if (inTrash > 0) {
    lines.push(tn(inTrash, "{n} session de la corbeille de l'ordinateur est encore sur le téléphone : laissée sur le téléphone.", "{n} sessions de la corbeille de l'ordinateur sont encore sur le téléphone : laissées sur le téléphone."));
  }
  if (outcome.skipped.length > 0) {
    retry = true;
    lines.push(tn(outcome.skipped.length, '{n} session laissée pour la prochaine fois : elle a changé pendant la synchronisation.', '{n} sessions laissées pour la prochaine fois : elles ont changé pendant la synchronisation.'));
  }
  const unknown = outcome.unknownActivities.filter((u) => u.side === 'computer').length;
  if (unknown > 0) {
    lines.push(tn(unknown, "{n} session d'une activité que l'ordinateur ne connaît pas : reprenez les réglages du téléphone (Réglages, Mémoire).", "{n} sessions d'une activité que l'ordinateur ne connaît pas : reprenez les réglages du téléphone (Réglages, Mémoire)."));
  }

  const forRoutes = routeLines(outcome);
  lines.push(...forRoutes.lines);
  if (forRoutes.retry) retry = true;

  const settingsCopied = outcome.extras.done.filter((op) => op.kind === 'settings').length;
  if (settingsCopied > 0) lines.push(tn(settingsCopied, '{n} fichier de réglages recopié.', '{n} fichiers de réglages recopiés.'));
  const otherDevice = outcome.extras.left.filter((l) => l.reason === 'otherDevice');
  if (otherDevice.length > 0) {
    const list = otherDevice.map((l) => l.path.split('/').pop() ?? l.path).join(', ');
    lines.push(tn(otherDevice.length, '{n} fichier de réglages laissé : un autre appareil porte le même nom ({list}).', '{n} fichiers de réglages laissés : un autre appareil porte le même nom ({list}).', { list }));
  }
  const untouched = outcome.extras.left.filter((l) => l.reason === 'unreadable' || l.reason === 'newer');
  if (untouched.length > 0) {
    const list = [...new Set(untouched.map((l) => l.path.split('/').pop() ?? l.path))].join(', ');
    lines.push(tn(untouched.length, "{n} fichier laissé tel quel : illisible, ou d'une version plus récente de Gtracker ({list}).", "{n} fichiers laissés tels quels : illisibles, ou d'une version plus récente de Gtracker ({list}).", { list }));
  }
  const extrasStopped = outcome.extras.left.filter((l) => l.reason === 'changed' || l.reason === 'failed').length;
  if (extrasStopped > 0) {
    retry = true;
    lines.push(tn(extrasStopped, "{n} fichier de réglages, de FC repos ou de lieux n'a pas pu être recopié : il le sera à la prochaine synchronisation.", "{n} fichiers de réglages, de FC repos ou de lieux n'ont pas pu être recopiés : ils le seront à la prochaine synchronisation."));
  }

  const withheld = outcome.withheldDeletions.length + outcome.routes.withheldDeletions.length;
  if (outcome.deletions !== 'made' && withheld > 0) {
    lines.push(tn(withheld, '{n} suppression laissée pour une prochaine synchronisation.', '{n} suppressions laissées pour une prochaine synchronisation.'));
  }
  const waiting = outcome.phoneWritable || outcome.phoneRecording ? 0 : outcome.withheldForPhone.length + outcome.routes.withheldForPhone.length + outcome.extras.withheld.length;
  if (outcome.phoneRecording) lines.push(t("Le téléphone enregistre une session : il n'a pas été modifié cette fois."));
  if (waiting > 0) lines.push(tn(waiting, '{n} changement attend le câble ou la mise à jour du téléphone.', '{n} changements attendent le câble ou la mise à jour du téléphone.'));

  if (outcome.failed.length > 0) {
    retry = true;
    const list = [...new Set(outcome.failed.map((f) => f.detail.replace(/\.\s*$/, '')))].join(' ; ');
    lines.push(tn(outcome.failed.length, "{n} session n'a pas pu être écrite sur l'ordinateur ({list}).", "{n} sessions n'ont pas pu être écrites sur l'ordinateur ({list}).", { list }));
  }
  if (outcome.linkLost !== null) {
    retry = true;
    lines.push(channel === 'sansFil'
      ? t('La liaison avec le téléphone a été coupée pendant la synchronisation. Ce qui est fait est gardé : rouvrez Gtracker sur le téléphone, puis cliquez sur « Réessayer » pour finir.')
      : t('Le téléphone a été débranché pendant la synchronisation. Ce qui est fait est gardé : rebranchez-le, puis cliquez sur « Réessayer » pour finir.'));
  } else if (outcome.error !== null) {
    retry = true;
    lines.push(t("La synchronisation s'est arrêtée ({detail}). Ce qui est fait est gardé : cliquez sur « Réessayer » pour finir.", { detail: outcome.error.replace(/\.\s*$/, '') }));
  }

  const phoneWritten = done.some((i) => hasOp(i, writesPhone)) || outcome.routes.done.some((i) => hasRouteOp(i, routeWritesPhone))
    || outcome.extras.done.some((op) => op.to === 'phone');
  if (phoneWritten) lines.push(t('Sur le téléphone, touchez « Mettre à jour » pour voir les changements.'));
  const said = lines.length > (header !== null ? 1 : 0) + (outcome.interrupted ? 1 : 0);
  if (!said && !retry) lines.push(t('Les deux appareils sont à jour.'));
  if (outcome.safetyCopy !== null) lines.push(t('Copie de sécurité des deux appareils, faite avant la première synchronisation :'));
  return say(lines, retry, outcome.safetyCopy);
};

/** Issue entière du bouton « Synchroniser », dans la langue de l'interface. */
export const describePhoneSync = (result: PhoneSyncResult): PhoneLinkText => {
  switch (result.kind) {
    case 'phone':
    case 'tool-missing':
      return describePhoneState(result);
    case 'no-phone-folder':
      return say([t("Le téléphone {phone} n'a pas de dossier « Documents/Gtracker ». Gtracker ne synchronise que les sessions rangées dans ce dossier : sur le téléphone, ouvrez Gtracker, Réglages, Mémoire, pour voir où il les range.", { phone: result.phone })]);
    case 'error':
      return say([describePhoneReadError(result.detail, result.channel)]);
    case 'synced':
      return describeSync(result.outcome, result.channel);
  }
};

/** Une session nommée dans une question : où elle est, son GPX, et sa date de départ pour la liste. */
export interface SyncQuestionSession {
  startMs: number;
  /** L'appareil dont elle serait retirée (`computer` : mise à la corbeille). */
  side: SyncSideName;
  /** Nom de son GPX de ce côté, pour retrouver son nom montré. */
  file: string;
  /** Date et heure de départ. */
  label: string;
}

/**
 * Question à poser avant d'aller plus loin : `guard`, le garde-fou retient des suppressions à confirmer ; `inTrash`,
 * des sessions de la corbeille de l'ordinateur sont encore sur le téléphone, à retirer ou à laisser. `text` : la phrase
 * de la question.
 */
export interface SyncQuestion {
  kind: 'guard' | 'inTrash';
  /** Sessions et itinéraires nommés. */
  count: number;
  text: string;
  sessions: SyncQuestionSession[];
  routes: SyncQuestionRoute[];
}

/** Un itinéraire nommé dans une question : son identité, l'appareil dont il serait retiré, et le nom de ses fichiers. */
export interface SyncQuestionRoute {
  id: string;
  side: SyncSideName;
  label: string;
}

const questionSession = (item: SyncItem, side: SyncSideName): SyncQuestionSession => ({
  startMs: item.startMs, side, file: item.files[side] ?? item.files[side === 'phone' ? 'computer' : 'phone'] ?? '', label: formatSessionDate(item.startMs),
});

const questionRoute = (item: RouteSyncItem, side: SyncSideName): SyncQuestionRoute => ({
  id: item.id, side, label: item.files[side] ?? item.files[side === 'phone' ? 'computer' : 'phone'] ?? item.id,
});

/** « 3 sessions et 2 itinéraires », pour une phrase qui nomme les deux. */
const sessionsAndRoutes = (sessions: number, routes: number): { sessions: string; routes: string } => ({
  sessions: tn(sessions, '{n} session', '{n} sessions'), routes: tn(routes, '{n} itinéraire', '{n} itinéraires'),
});

/** Texte du résumé qui déplie la liste du garde-fou. */
export const syncQuestionListLabel = (question: SyncQuestion): string => {
  const [s, r] = [question.sessions.length, question.routes.length];
  if (r === 0) return tn(s, 'Voir la session', 'Voir les {n} sessions');
  if (s === 0) return tn(r, "Voir l'itinéraire", 'Voir les {n} itinéraires');
  return t('Voir les {n} sessions et itinéraires', { n: s + r });
};

/** Texte du bouton qui confirme les suppressions du garde-fou. */
export const syncQuestionConfirmLabel = (question: SyncQuestion): string => {
  const [s, r] = [question.sessions.length, question.routes.length];
  if (r === 0) return tn(s, 'Supprimer cette session', 'Supprimer ces {n} sessions');
  if (s === 0) return tn(r, 'Supprimer cet itinéraire', 'Supprimer ces {n} itinéraires');
  return t('Supprimer ces {n} sessions et itinéraires', { n: s + r });
};

/** Texte du bouton qui laisse sur le téléphone ce que tient la corbeille de l'ordinateur. */
export const syncQuestionLeaveLabel = (question: SyncQuestion): string =>
  question.count === 1 && question.routes.length === 1 ? t('Le laisser') : tn(question.count, 'La laisser', 'Les laisser');

/**
 * La question qu'appelle une synchronisation, ou `null`. Le garde-fou d'abord ; les sessions de la corbeille encore sur
 * le téléphone ensuite, seulement si le téléphone s'écrit, que les suppressions étaient permises et que rien ne s'est
 * arrêté en route : « Retirer du téléphone » relance avec `heldOnPhone: 'remove'`, « Les laisser » ne fait rien, et la
 * question revient à la synchronisation suivante.
 */
export const describeSyncQuestion = (outcome: SyncOutcome): SyncQuestion | null => {
  if (outcome.refusal !== null) return null;
  const withheldRoutes = outcome.routes.withheldDeletions;
  if (outcome.deletions === 'awaitingConfirmation' && outcome.withheldDeletions.length + withheldRoutes.length > 0) {
    const [s, r] = [outcome.withheldDeletions.length, withheldRoutes.length];
    const text = r === 0
      ? tn(s, "Cette synchronisation retirerait {n} session. Rien n'est encore supprimé.", "Cette synchronisation retirerait {n} sessions. Rien n'est encore supprimé.")
      : s === 0
        ? tn(r, "Cette synchronisation retirerait {n} itinéraire. Rien n'est encore supprimé.", "Cette synchronisation retirerait {n} itinéraires. Rien n'est encore supprimé.")
        : t("Cette synchronisation retirerait {sessions} et {routes}. Rien n'est encore supprimé.", sessionsAndRoutes(s, r));
    return {
      kind: 'guard', count: s + r, text,
      sessions: outcome.withheldDeletions.map((item) => questionSession(item, item.case === 'deletedOnPhone' ? 'computer' : 'phone')),
      routes: withheldRoutes.map((item) => questionRoute(item, item.case === 'deletedOnPhone' ? 'computer' : 'phone')),
    };
  }
  if (!outcome.phoneWritable || outcome.deletions !== 'made' || outcome.linkLost !== null || outcome.error !== null) return null;
  const held = (outcome.plan?.items ?? []).filter((i) => i.left === 'inTrash');
  const heldRoutes = (outcome.routes.plan?.items ?? []).filter((i) => i.left === 'inTrash');
  if (held.length + heldRoutes.length === 0) return null;
  const [s, r] = [held.length, heldRoutes.length];
  const text = r === 0
    ? tn(s, "{n} session supprimée sur l'ordinateur est encore sur le téléphone. La retirer du téléphone ? Elle reste 30 jours dans la corbeille de l'ordinateur.", "{n} sessions supprimées sur l'ordinateur sont encore sur le téléphone. Les retirer du téléphone ? Elles restent 30 jours dans la corbeille de l'ordinateur.")
    : s === 0
      ? tn(r, "{n} itinéraire supprimé sur l'ordinateur est encore sur le téléphone. Le retirer du téléphone ? Il reste 30 jours dans la corbeille de l'ordinateur.", "{n} itinéraires supprimés sur l'ordinateur sont encore sur le téléphone. Les retirer du téléphone ? Ils restent 30 jours dans la corbeille de l'ordinateur.")
      : t("{sessions} et {routes} supprimés sur l'ordinateur sont encore sur le téléphone. Les retirer du téléphone ? Ils restent 30 jours dans la corbeille de l'ordinateur.", sessionsAndRoutes(s, r));
  return {
    kind: 'inTrash', count: s + r, text,
    sessions: held.map((item) => questionSession(item, 'phone')),
    routes: heldRoutes.map((item) => questionRoute(item, 'phone')),
  };
};
