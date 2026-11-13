import { useEffect, useRef, useState } from 'react';
import { isRecordingActive, useRecorderSelector } from '../hooks/useRecorder';
import { countErasable, eraseEverything, factoryReset, useLibraryFields, type ResetProgress } from '../hooks/useSessionLibrary';
import { resetConfirmText, resetRefusal, type EraseCounts, type ResetKind } from '../library/resetPlan';
import { isFolderDesignated } from '../platform/memoryFolder';
import { HelpText } from './Help';
import { IconTrash, IconUndo } from './icons';
import PanelTitle from './PanelTitle';
import Dialog from './ui/Dialog';
import HoldButton from './ui/HoldButton';

/**
 * Zone « Remise à zéro », au bas de la carte Mémoire de Réglages, repliée au départ : « Réglages d'usine » et
 * « Tout supprimer », chacun tenu une seconde puis confirmé (comme « Jeter » une session), refusés avec une phrase
 * pendant un enregistrement (`resetRefusal`). Pendant l'effacement, une fenêtre qu'on ne ferme pas en dit
 * l'avancée ; l'application se recharge ensuite d'elle-même. Une remise à zéro interrompue est dite dans la carte
 * de la mémoire.
 */

/** Durée de l'appui : une seconde, puis la confirmation. */
const RESET_HOLD_MS = 1000;
const resetHoldMs = (): number => RESET_HOLD_MS;

const NO_COUNTS: EraseCounts = { sessions: 0, pending: 0, routes: 0 };

/** Ce que dit la fenêtre pendant l'effacement. */
const runningText = (kind: ResetKind, progress: ResetProgress | null): string => {
  if (kind === 'usine') return "Retour aux réglages d'usine…";
  if (progress === null || progress.total === 0) return 'Suppression en cours…';
  return `Suppression en cours : ${progress.done.toLocaleString('fr-FR')} fichiers sur ${progress.total.toLocaleString('fr-FR')}…`;
};

function ResetZone() {
  const [open, setOpen] = useState(false);
  const recording = useRecorderSelector((s) => s.status !== 'idle');
  const pendingSession = useRecorderSelector((s) => s.pending !== null || s.analyzing);
  const { status, memoryReadOnly, importing } = useLibraryFields('status', 'memoryReadOnly', 'importing');
  const [running, setRunning] = useState<{ kind: ResetKind; progress: ResetProgress | null } | null>(null);
  /**
   * Geste en cours, du début du compte à la fin : les deux boutons sont grisés aussitôt, pour qu'un second appui
   * pendant le listage du dossier n'ouvre pas une seconde question. Le verrou suit aussi un rendu en retard (`ref`).
   */
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  /** Un dossier est désigné, ouvert ou non : relu à chaque changement d'état de la mémoire. */
  const [designated, setDesignated] = useState(true);
  useEffect(() => {
    let alive = true;
    void isFolderDesignated().then((yes) => { if (alive) setDesignated(yes); }).catch(() => undefined);
    return () => { alive = false; };
  }, [status]);

  const context = { recording, pendingSession, memoryStatus: status, readOnly: memoryReadOnly, importing, designated };
  const refusals: Record<ResetKind, string | null> = { usine: resetRefusal('usine', context), tout: resetRefusal('tout', context) };
  const phrases = [...new Set([refusals.usine, refusals.tout].filter((p): p is string => p !== null))];

  const release = () => {
    busyRef.current = false;
    setBusy(false);
  };

  /** Après l'appui tenu : comptes, confirmation, puis l'effacement ; l'application se recharge d'elle-même. */
  const run = async (kind: ResetKind) => {
    if (refusals[kind] !== null || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const counts = kind === 'tout' ? await countErasable() : NO_COUNTS;
    // Refusé pendant la question, ou un enregistrement lancé entre-temps : rien ne se fait, les boutons reviennent.
    if (!window.confirm(resetConfirmText(kind, counts)) || isRecordingActive()) {
      release();
      return;
    }
    setRunning({ kind, progress: null });
    const refused = kind === 'usine'
      ? await factoryReset()
      : await eraseEverything((progress) => setRunning({ kind, progress }));
    // Sans refus ni interruption, la page se recharge : rien à relâcher.
    if (refused !== null) {
      setRunning(null);
      release();
    }
  };

  return (
    <div className="ui-stack-3">
      <PanelTitle label="Remise à zéro" open={open} onToggle={() => setOpen((o) => !o)} helpKey="memoire:remise" />
      {open && (
        <>
          <HelpText helpKey="memoire:remise">
            « Réglages d'usine » remet tous les réglages de cet appareil à leur valeur de départ : activités de départ
            et leurs pré-réglages, unités, onglets, tailles des panneaux, couleurs de trace, thème, tutoriels lus… Il
            retire aussi du dossier mémoire le fichier de réglages de cet appareil ; ceux des autres appareils restent.
            Les activités que vous avez créées et vos listes de matériel sont effacées ; leurs sessions restent, avec
            leur matériel, sous le nom de leur calcul. Il ne touche ni aux sessions, ni aux itinéraires, ni au profil
            (pseudo, photo, mesures, tests de FC repos), ni aux lieux corrigés.
            <br />
            « Tout supprimer » est définitif : il efface toutes les sessions du dossier, y compris un GPX que vous y
            auriez déposé vous-même, leurs fiches, les itinéraires, les fichiers de réglages de tous les appareils, le
            profil, les tests de FC repos, les lieux corrigés, les réglages et les cartes gardées. Les autres fichiers
            posés à la main dans le dossier restent, et le dossier reste choisi. L'application repart comme à sa
            première ouverture.
            <br />
            Chaque bouton se tient une seconde, puis demande confirmation.
          </HelpText>
          <div className="ui-row-s2 ui-wrap">
            <HoldButton onHold={() => void run('usine')} getHoldMs={resetHoldMs} label="Réglages d'usine"
              lead={<IconUndo size={18} />} dialTitle="Réglages d'usine" icon={<IconUndo size={48} />}
              action="revenir aux réglages d'usine" disabled={refusals.usine !== null || busy}
              ariaLabel="Réglages d'usine : maintenir une seconde" />
            <HoldButton onHold={() => void run('tout')} getHoldMs={resetHoldMs} label="Tout supprimer"
              lead={<IconTrash size={18} />} dialTitle="Tout supprimer" icon={<IconTrash size={48} />}
              action="tout supprimer" disabled={refusals.tout !== null || busy}
              ariaLabel="Tout supprimer : maintenir une seconde" />
          </div>
          {phrases.map((phrase) => <p key={phrase} className="ui-muted ui-text-s ui-m-0">{phrase}</p>)}
        </>
      )}
      {running && (
        <Dialog title="Remise à zéro" onClose={() => undefined}>
          <p className="ui-m-0" aria-live="polite">{runningText(running.kind, running.progress)}</p>
        </Dialog>
      )}
    </div>
  );
}

export default ResetZone;
