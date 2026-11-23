import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../core/i18n';
import { usePermissions } from '../hooks/usePermissions';
import { savedBelt } from '../platform/heartRate';
import {
  autostartOpenedBefore, markAutostartOpened, markPermissionsSeen, openAppSettings, openAutostart, permissionsSeenVersion,
  readPermissions, requestPermission, waitForAppResume,
} from '../platform/permissions';
import { isNativeApp } from '../platform/runtime';
import {
  PERMISSION_LABEL, missingPermissions, requiredPermissions, shouldPromptPermissions,
  type PermissionKey, type PermissionState, type PermissionsStatus as Status,
} from '../recording/permissionsPrompt';
import { HelpToggle } from './Help';
import { useHelp } from './helpContext';
import Button from './ui/Button';
import Card from './ui/Card';
import './PermissionsStatus.css';
import './StatusLine.css';

/**
 * Autorisations du téléphone dont l'enregistrement a besoin : une ligne par
 * autorisation (pourquoi, état, bouton), plus le démarrage automatique sur un
 * Xiaomi seulement, sans état (le téléphone ne le dit pas de façon fiable). En tête du Profil, où s'ouvre l'application (`PermissionsPrompt`), au
 * premier lancement et après une mise à jour s'il en manque une ; dans
 * Réglages, bloc « Autorisations » (`PermissionsSettings`). Rien dans le
 * navigateur. Les états sont relus au retour d'un écran système.
 */

const WHY: Record<PermissionKey, string> = {
  location: t("Pour enregistrer la trace. « Pendant l'utilisation de l'application » suffit, écran éteint compris."),
  notifications: t("Pour la notification de l'enregistrement, lisible écran verrouillé."),
  battery: t("Sans « Aucune restriction », Android peut couper l'enregistrement écran éteint : « Autoriser », puis « Aucune restriction »."),
  bluetooth: t('Pour la ceinture cardio seulement.'),
};

const STATE_TEXT: Record<PermissionState, string> = {
  granted: t('accordée'),
  prompt: t('à accorder'),
  denied: t('refusée'),
  unavailable: t('sans objet'),
};

const STATE_COLOR: Record<PermissionState, string> = {
  granted: 'var(--success)',
  prompt: 'var(--warning-line)',
  denied: 'var(--danger)',
  unavailable: 'var(--muted)',
};

/** Demande `key`, ou, refusée pour de bon, ouvre les réglages de l'application ; puis relit les états. */
const ask = async (key: PermissionKey, state: PermissionState, refresh: () => Promise<Status>): Promise<void> => {
  try {
    if (state === 'denied' && key !== 'battery') await openAppSettings();
    else await requestPermission(key);
  } catch {
    // Un écran système absent ou un refus : l'état relu le dira.
  }
  await refresh();
};

/**
 * Une ligne : le nom, le pourquoi, l'état et le bouton. Dans Réglages, le pourquoi
 * passe sous un « ? » ; sur la carte du Profil, il reste à découvert.
 */
function PermissionRow({ helpKey, label, why, children }: { helpKey: string; label: string; why: string; children: ReactNode }) {
  const help = useHelp(helpKey);
  return (
    <div className="permissions__row">
      <div className="permissions__text">
        <span className="permissions__label">{label}<HelpToggle helpKey={helpKey} label={label} /></span>
        {(help === null || help.open) && <span className="permissions__why">{why}</span>}
      </div>
      <div className="permissions__action">{children}</div>
    </div>
  );
}

/** Pastille et mot de l'état d'une ligne. */
function StateLine({ color, text }: { color: string | undefined; text: string }) {
  return (
    <span className="status-line">
      <span className="status-line__dot" style={{ backgroundColor: color }} />
      <span>{text}</span>
    </span>
  );
}

/**
 * Attente du retour de l'écran de la batterie avant d'ouvrir celui du démarrage automatique : passé ce délai, on
 * n'ouvre pas un second écran par-dessus un utilisateur parti ailleurs.
 */
const BATTERY_RETURN_TIMEOUT_MS = 60_000;

function PermissionRows({ keys, status, autostart, refresh }: {
  keys: PermissionKey[];
  status: Status;
  autostart: boolean;
  refresh: () => Promise<Status>;
}) {
  return (
    <div className="permissions">
      {keys.map((key) => {
        const state = status[key];
        return (
          <PermissionRow key={key} helpKey={`autorisations:${key}`} label={PERMISSION_LABEL[key]} why={WHY[key]}>
            <StateLine color={STATE_COLOR[state]} text={key === 'battery' && state === 'denied' ? t('restreinte') : STATE_TEXT[state]} />
            {state !== 'granted' && state !== 'unavailable' && (
              <Button size="s" onClick={() => void ask(key, state, refresh)}>
                {state === 'denied' && key !== 'battery' ? t('Ouvrir les réglages') : t('Autoriser')}
              </Button>
            )}
          </PermissionRow>
        );
      })}
      {autostart && (
        <PermissionRow helpKey="autorisations:demarrage" label={t('Démarrage automatique')}
          why={t("Pour que l'enregistrement continue, application fermée.")}>
          <Button size="s" onClick={() => void openAutostart().catch(() => undefined)}>{t('Ouvrir')}</Button>
        </PermissionRow>
      )}
    </div>
  );
}

/**
 * Demande toutes celles qui manquent, dans l'ordre : les demandes système
 * d'abord, puis l'écran de la batterie, qui quitte l'application ; sur un
 * Xiaomi, son écran du démarrage automatique en dernier, une fois revenu de
 * celui de la batterie, la première fois seulement sur cet appareil.
 */
const askAll = async (keys: PermissionKey[], autostart: boolean, refresh: () => Promise<Status>): Promise<void> => {
  // Un second appui pendant que la suite se déroule ne la relance pas : un seul écran de chaque à refermer.
  if (askingAll) return;
  askingAll = true;
  try {
    await askEach(keys, autostart, refresh);
  } finally {
    askingAll = false;
  }
};

let askingAll = false;

const askEach = async (keys: PermissionKey[], autostart: boolean, refresh: () => Promise<Status>): Promise<void> => {
  let status = await refresh();
  for (const key of keys) {
    if (key === 'battery' || status[key] !== 'prompt') continue;
    try {
      await requestPermission(key);
    } catch {
      // Refus ou échec : on passe à la suivante.
    }
    status = await refresh();
  }
  let back: Promise<boolean> = Promise.resolve(true);
  if (keys.includes('battery') && status.battery !== 'granted') {
    try {
      await requestPermission('battery');
      // Écouté dès l'écran ouvert, pour ne pas manquer un retour rapide.
      back = waitForAppResume(BATTERY_RETURN_TIMEOUT_MS);
    } catch {
      // Écran absent : l'état relu le dira, et rien n'attend son retour.
    }
    await refresh();
  }
  // Son état ne se lit pas : une seule ouverture par appareil, le bouton de la ligne permet d'y revenir.
  if (!autostart || autostartOpenedBefore()) return;
  // Écran de la batterie laissé ouvert trop longtemps : on s'arrête là plutôt que d'en ouvrir un autre.
  if (!(await back)) return;
  markAutostartOpened();
  await openAutostart().catch(() => undefined);
};

/**
 * Carte du Profil : seulement s'il faut (`shouldPromptPermissions`) ; « Plus tard » la renvoie à la version suivante.
 * `onDecided` apprend une fois, après la lecture des autorisations, si la carte paraît (le pop-up du profil attend alors).
 */
export function PermissionsPrompt({ onDecided }: { onDecided?: (shown: boolean) => void }) {
  const { status, autostart, refresh } = usePermissions();
  const [dismissed, setDismissed] = useState(false);
  const beltSaved = savedBelt() !== null;
  const [shown, setShown] = useState<boolean | null>(null);
  const onDecidedRef = useRef(onDecided);
  useEffect(() => {
    onDecidedRef.current = onDecided;
  });

  // Décidé une fois, sur l'état lu à l'ouverture : la carte reste ensuite tant qu'on ne la ferme pas.
  useEffect(() => {
    let alive = true;
    void readPermissions().then((first) => {
      if (!alive) return;
      const decided = shouldPromptPermissions({ seenVersion: permissionsSeenVersion(), appVersion: __APP_VERSION__, status: first, beltSaved: savedBelt() !== null });
      setShown(decided);
      onDecidedRef.current?.(isNativeApp() && decided);
    });
    return () => {
      alive = false;
    };
  }, []);

  const missing = status ? missingPermissions(status, beltSaved) : [];
  // Tout accordé : la version est retenue, la carte ne reviendra qu'avec une autorisation manquante après une mise à jour.
  useEffect(() => {
    if (shown && status && missing.length === 0) markPermissionsSeen(__APP_VERSION__);
  }, [shown, status, missing.length]);

  if (!isNativeApp() || !shown || dismissed || status === null) return null;
  const close = () => {
    markPermissionsSeen(__APP_VERSION__);
    setDismissed(true);
  };
  const keys = requiredPermissions(beltSaved);

  return (
    <Card heading={t('Autorisations')}>
      <div className="ui-stack-3">
        <p className="permissions__intro">
          {missing.length === 0
            ? t('Tout est accordé : Gtracker peut enregistrer écran éteint.')
            : t('Pour enregistrer écran éteint, sans coupure, Gtracker a besoin de ce qui suit. Chacune se règle aussi plus tard, dans Réglages › Autorisations.')}
        </p>
        <PermissionRows keys={keys} status={status} autostart={autostart} refresh={refresh} />
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {missing.length > 0 && <Button variant="primary" onClick={() => void askAll(keys, autostart, refresh)}>{t('Tout autoriser')}</Button>}
          <Button variant="ghost" onClick={close}>{missing.length === 0 ? t('Fermer') : t('Plus tard')}</Button>
        </div>
      </div>
    </Card>
  );
}

/** Bloc « Autorisations » de Réglages : toutes les lignes, Bluetooth compris. */
export function PermissionsSettings() {
  const { status, autostart, refresh } = usePermissions();
  if (!isNativeApp()) {
    return <p className="permissions__intro">{t("Sur l'application Android seulement.")}</p>;
  }
  if (status === null) return <p className="permissions__intro">{t('Lecture des autorisations…')}</p>;
  const keys = requiredPermissions(true);
  const missing = missingPermissions(status, true);
  return (
    <div className="ui-stack-3">
      <PermissionRows keys={keys} status={status} autostart={autostart} refresh={refresh} />
      {missing.length > 0 && (
        <div>
          <Button variant="primary" onClick={() => void askAll(keys, autostart, refresh)}>{t('Tout autoriser')}</Button>
        </div>
      )}
    </div>
  );
}
