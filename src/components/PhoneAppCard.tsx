import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../core/basics';
import { t } from '../core/i18n';
import {
  describePhoneAppInstall, installPhoneApp, markPhoneAppProposed, phoneAppAvailable, phoneAppInfo, savePhoneApp, type PhoneAppInfo,
} from '../platform/phoneApp';
import { HelpText, HelpToggle } from './Help';
import { useInSettings } from './helpContext';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import './PhoneAppCard.css';

/**
 * L'application du téléphone que le programme Windows emporte (`platform/phoneApp.ts`), programme Windows seulement :
 * - `PhoneAppCard`, dans Réglages › Connexion : sa version, « Enregistrer l'APK… » (fenêtre « Enregistrer sous » de
 *   Windows) et « Installer par le câble », avec ce que chaque geste a donné ; sans APK, la phrase qui le dit ;
 * - `PhoneAppOffer`, la fenêtre de première ouverture du Profil, une fois la mémoire choisie, tant que la version n'a
 *   pas été proposée : les deux mêmes boutons et « Plus tard » ; chacun des trois, comme la croix, retient que cette
 *   version a été proposée, et la fenêtre revient à la version suivante.
 */

/** Ce qu'un geste a donné, à montrer sous les boutons. */
interface Outcome {
  ok: boolean;
  text: string;
}

/** État de l'application et ses deux gestes, partagés par la carte et la fenêtre. */
function usePhoneApp() {
  const [available] = useState(phoneAppAvailable);
  const [info, setInfo] = useState<PhoneAppInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    phoneAppInfo().then(
      (read) => { if (alive) setInfo(read); },
      (err: unknown) => { if (alive) setOutcome({ ok: false, text: errorMessage(err) }); },
    );
    return () => { alive = false; };
  }, [available]);

  const run = async (action: () => Promise<Outcome | null>) => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome(await action());
    } catch (err) {
      setOutcome({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    const path = await savePhoneApp(t("Enregistrer l'application du téléphone"));
    return path === null ? null : { ok: true, text: t('APK enregistrée : {chemin}', { chemin: path }) };
  });
  const install = () => run(async () => describePhoneAppInstall(await installPhoneApp()));

  return { available, info, busy, outcome, save, install };
}

/** Ce qu'un geste a donné, annoncé aux lecteurs d'écran. */
function OutcomeLine({ outcome }: { outcome: Outcome | null }) {
  if (outcome === null) return null;
  return (
    <p className={`ui-text-s ui-m-0 phone-app__outcome${outcome.ok ? '' : ' ui-danger-text'}`} role="status">{outcome.text}</p>
  );
}

const HELP_TEXT = () =>
  t("Copiez le fichier sur le téléphone et ouvrez-le ; Android demandera d'autoriser cette source. Par le câble, le débogage USB doit être activé.");

function PhoneAppCard() {
  const app = usePhoneApp();
  const inSettings = useInSettings();
  if (!app.available) return null;
  const { info, busy } = app;

  return (
    <div className="ui-stack-3 phone-app">
      <span className="ui-row-s2 ui-center">
        <strong className="phone-app__title">{t('Application du téléphone')}</strong>
        {inSettings && info?.available && <HelpToggle helpKey="memoire:application" label={t('Application du téléphone')} />}
      </span>
      {info !== null && (
        <p className="ui-muted ui-text-s ui-m-0">
          {info.available
            ? t('Gtracker {version} pour Android, la même version que ce programme.', { version: info.version })
            : t("Ce programme n'a pas l'application du téléphone.")}
        </p>
      )}
      {info?.available && (inSettings
        ? <HelpText helpKey="memoire:application">{HELP_TEXT()}</HelpText>
        : <p className="ui-muted ui-text-s ui-m-0">{HELP_TEXT()}</p>)}
      {info?.available && (
        <div className="ui-row-s2 ui-wrap">
          <Button size="s" onClick={() => void app.save()} disabled={busy}>{t("Enregistrer l'APK…")}</Button>
          <Button size="s" onClick={() => void app.install()} disabled={busy}>{t('Installer par le câble')}</Button>
        </div>
      )}
      <OutcomeLine outcome={app.outcome} />
    </div>
  );
}

/** Proposée une fois par lancement au plus, même si la coquille n'a pas pu retenir la proposition. */
let offeredThisLaunch = false;

export function PhoneAppOffer() {
  const app = usePhoneApp();
  const [open, setOpen] = useState(() => !offeredThisLaunch);
  const marked = useRef(false);
  /** Un geste a réussi : « Plus tard » devient « Fermer ». */
  const done = app.outcome?.ok === true;

  // L'état lu à l'ouverture fait foi jusqu'à la fermeture : retenir la proposition ne la fait pas disparaître.
  if (!app.available || !open || app.info === null || !app.info.available || app.info.proposed) return null;
  const { busy } = app;

  const mark = () => {
    if (marked.current) return;
    marked.current = true;
    offeredThisLaunch = true;
    void markPhoneAppProposed().catch(() => undefined);
  };
  const close = () => {
    mark();
    setOpen(false);
  };

  return (
    <Dialog title={t('Application du téléphone')} onClose={close} className="phone-app-offer">
      <p className="ui-m-0">{t("Ce programme contient l'application Android de la même version.")}</p>
      <OutcomeLine outcome={app.outcome} />
      <div className="phone-app-offer__actions">
        <Button variant="ghost" onClick={close}>{done ? t('Fermer') : t('Plus tard')}</Button>
        <Button onClick={() => { mark(); void app.install(); }} disabled={busy}>{t('Installer par le câble')}</Button>
        <Button variant="primary" onClick={() => { mark(); void app.save(); }} disabled={busy}>{t("Enregistrer l'APK…")}</Button>
      </div>
    </Dialog>
  );
}

export default PhoneAppCard;
