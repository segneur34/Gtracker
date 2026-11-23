import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '../core/i18n';
import { settingsBlockFromSearch } from '../core/parentPage';
import { useWirelessPhones } from '../hooks/useWirelessPhones';
import { authorizationNoticeText, countdownText, describePhoneSeen, describeWireless, firewallNotice, pairingAddress, remainingMs, wrongCodesText } from '../library/wirelessPhone';
import { phoneCableAvailable, phoneState } from '../platform/phoneCable';
import SettingsSection from './SettingsSection';
import Button from './ui/Button';
import './WirelessPhoneCard.css';

/**
 * Le mode d'emploi du câble, replié : il ne sert qu'à qui a activé le débogage USB, et ne doit jamais passer pour une
 * chose à faire. `toolFolder` : où poser l'outil de Google quand il manque, `null` s'il est là ou inconnu.
 */
function CableHelp({ toolFolder }: { toolFolder: string | null }) {
  return (
    <details className="wireless-card__cable">
      <summary className="ui-text-s">{t('Par câble (avancé)')}</summary>
      <div className="ui-stack-2">
        <p className="ui-muted ui-text-s ui-m-0">
          {t("Le câble USB reste possible si le « Débogage USB » du téléphone est activé : ouvrez Paramètres, puis À propos du téléphone, et touchez sept fois « Version » pour afficher les options pour développeurs. Ouvrez-les et activez « Débogage USB ».")}
        </p>
        {toolFolder !== null && (
          <>
            <p className="ui-muted ui-text-s ui-m-0">
              {t("Il faut aussi un outil gratuit de Google, « SDK Platform-Tools », absent de cet ordinateur : téléchargez-le pour Windows sur developer.android.com/tools/releases/platform-tools, ouvrez le fichier .zip et copiez le dossier « platform-tools » qu'il contient dans ce dossier :")}
            </p>
            <code className="wireless-card__folder">{toolFolder}</code>
          </>
        )}
        <p className="ui-muted ui-text-s ui-m-0">
          {t("Si le téléphone redemande l'autorisation au bout d'une semaine : dans les options pour développeurs, cochez « Désactiver le délai d'expiration des autorisations adb ».")}
        </p>
      </div>
    </details>
  );
}

/**
 * Le téléphone, relié sans câble, dans Réglages › Connexion, programme Windows seulement (rien dans le navigateur ni sur le
 * téléphone) : la case qui allume le sans-fil (éteint par défaut, avec la phrase qui prévient que Windows va demander
 * l'autorisation), son état, le pare-feu de Windows quand il bloque (avec « Autoriser Gtracker » si l'autorisation
 * suffit), « Relier un téléphone » (adresse, code et temps restant en grand, jusqu'à la liaison ou
 * l'échéance de 2 minutes), la liste des téléphones reliés avec « Retirer », et le mode d'emploi du câble, replié.
 * Les sessions, elles, ne passent que par « Synchroniser » (`PhoneSyncButton`), au clic. Arrivée par
 * `?bloc=relier` (fenêtre « Synchroniser » sans téléphone connu) : la fenêtre du code s'ouvre d'elle-même, une fois.
 */
function WirelessPhoneCard() {
  const view = useWirelessPhones();
  const { search } = useLocation();
  const wantsPairing = settingsBlockFromSearch(search) === 'relier';
  const cardRef = useRef<HTMLDivElement>(null);
  const pairingAsked = useRef(false);
  const [toolFolder, setToolFolder] = useState<string | null>(null);
  const listeningNow = view.state?.actif === true && view.state.ecoute;
  const { startPairing } = view;

  useEffect(() => {
    if (!phoneCableAvailable()) return;
    let alive = true;
    phoneState().then((state) => {
      if (alive && state.etat === 'adbIntrouvable') setToolFolder(state.dossier);
    }, () => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!wantsPairing || pairingAsked.current || !listeningNow) return;
    pairingAsked.current = true;
    cardRef.current?.scrollIntoView({ block: 'center' });
    void startPairing();
  }, [wantsPairing, listeningNow, startPairing]);

  if (!view.available) return null;
  const { state, phones, pairing, pairingStatus, busy } = view;
  const status = state ? describeWireless(state) : null;
  const firewall = state ? firewallNotice(state) : null;
  const active = state?.actif === true;
  const listening = status?.kind === 'listening';
  const waiting = pairing !== null && pairingStatus?.kind === 'waiting';
  const wrongCodes = state !== null && pairing !== null ? wrongCodesText(state) : null;

  return (
    <SettingsSection title={t('Téléphone')} className="wireless-card" ref={cardRef}>
      <p className="ui-muted ui-text-s ui-m-0">
        {t("Reliez votre téléphone une fois, par un code. Ensuite, ouvrez Gtracker sur le téléphone, sur le même réseau que cet ordinateur (la même box Wi-Fi, ou un partage de connexion), puis cliquez sur « Synchroniser », en haut.")}
      </p>
      <label className="ui-row-s2 ui-center">
        <input type="checkbox" className="wireless-card__toggle" checked={active} disabled={busy || state === null}
          onChange={(e) => void view.setActive(e.target.checked)} />
        <span>{t('Relier le téléphone sans câble')}</span>
      </label>
      {state !== null && !active && (
        <p className="ui-muted ui-text-s ui-m-0">
          {authorizationNoticeText()}
        </p>
      )}
      {status !== null && <p className="wireless-card__status ui-text-s ui-m-0">{status.text}</p>}
      {firewall !== null && (
        <div className="wireless-card__firewall" role="status">
          <p className="ui-danger-text ui-text-s ui-m-0">{firewall.text}</p>
          {firewall.canAuthorize && view.authorizable && (
            <div className="ui-row-s2 ui-wrap ui-center">
              <Button size="s" className="wireless-card__authorize" onClick={() => void view.authorize()} disabled={busy}>
                {t('Autoriser Gtracker')}
              </Button>
              <span className="ui-muted ui-text-s">{authorizationNoticeText()}</span>
            </div>
          )}
          {view.authorizationMessage !== null && <p className="ui-danger-text ui-text-s ui-m-0">{view.authorizationMessage}</p>}
        </div>
      )}
      {view.error !== null && <p className="ui-danger-text ui-text-s ui-m-0 wireless-card__error">{view.error}</p>}

      {listening && !waiting && (
        <div className="ui-row-s2 ui-wrap">
          <Button size="s" onClick={() => void view.startPairing()} disabled={busy}>{t('Relier un téléphone')}</Button>
        </div>
      )}

      {pairing !== null && waiting && (
        <div className="wireless-card__pairing" role="group" aria-label={t('Relier un téléphone')}>
          <p className="ui-m-0">
            {t("Sur le téléphone, ouvrez Gtracker, puis Réglages, Connexion, et reliez-le à cet ordinateur. S'il ne le trouve pas seul, tapez l'adresse et le code :")}
          </p>
          <div className="wireless-card__fields">
            <span className="wireless-card__label">{t('Adresse')}</span>
            <span className="wireless-card__address num">{pairingAddress(pairing)}</span>
            <span className="wireless-card__label">{t('Code')}</span>
            <span className="wireless-card__code num">{pairing.code}</span>
            <span className="wireless-card__label">{t('Temps restant')}</span>
            <span className="wireless-card__countdown num" aria-live="off">{countdownText(remainingMs(pairing.deadlineMs, view.nowMs))}</span>
          </div>
        </div>
      )}
      {pairing !== null && pairingStatus?.kind === 'linked' && (
        <p className="ui-text-s ui-m-0 wireless-card__result" role="status">{t('Téléphone {name} relié.', { name: pairingStatus.name })}</p>
      )}
      {pairing !== null && pairingStatus?.kind === 'closed' && (
        <p className="ui-muted ui-text-s ui-m-0 wireless-card__result" role="status">
          {t("La fenêtre s'est fermée sans téléphone relié. Cliquez de nouveau sur « Relier un téléphone » et vérifiez le code tapé.")}
        </p>
      )}
      {wrongCodes !== null && <p className="ui-text-s ui-m-0 wireless-card__wrong-codes" role="status">{wrongCodes}</p>}

      {(active || phones.length > 0) && (
        <div className="ui-stack-3 wireless-card__phones">
          <strong className="ui-text-s">{t('Téléphones reliés')}</strong>
          {phones.length === 0 ? (
            <p className="ui-muted ui-text-s ui-m-0">{t("Aucun téléphone relié pour l'instant.")}</p>
          ) : (
            <ul className="set-files-list">
              {phones.map((phone) => (
                <li key={phone.id} className="set-files-row">
                  <span className="ui-stack ui-min-w-0">
                    <strong className="ui-text-s">{phone.nom}</strong>
                    <span className="ui-muted ui-text-s">{describePhoneSeen(phone)}</span>
                  </span>
                  <Button size="s" onClick={() => void view.removePhone(phone.id)} disabled={busy}
                    aria-label={t('Retirer le téléphone {name}', { name: phone.nom })}>
                    {t('Retirer')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {phoneCableAvailable() && <CableHelp toolFolder={toolFolder} />}
    </SettingsSection>
  );
}

export default WirelessPhoneCard;
