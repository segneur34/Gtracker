import { t } from '../core/i18n';
import { useWirelessPhones } from '../hooks/useWirelessPhones';
import { countdownText, describePhoneSeen, describeWireless, pairingAddress, remainingMs } from '../library/wirelessPhone';
import Button from './ui/Button';
import './WirelessPhoneCard.css';

/**
 * Le téléphone sans câble, dans Réglages › Mémoire, programme Windows seulement (rien dans le navigateur ni sur le
 * téléphone) : la case qui allume le sans-fil (éteint par défaut, avec la phrase qui prévient que Windows va demander
 * l'autorisation), son état, « Relier un téléphone » (adresse, code et temps restant en grand, jusqu'à la liaison ou
 * l'échéance de 2 minutes), et la liste des téléphones reliés avec « Retirer ». Les sessions, elles, sont rangées par
 * « Récupérer » (`PhoneRecoverButton`), à l'arrivée du téléphone ou au clic.
 */
function WirelessPhoneCard() {
  const view = useWirelessPhones();
  if (!view.available) return null;
  const { state, phones, pairing, pairingStatus, busy } = view;
  const status = state ? describeWireless(state) : null;
  const active = state?.actif === true;
  const listening = status?.kind === 'listening';
  const waiting = pairing !== null && pairingStatus?.kind === 'waiting';

  return (
    <div className="ui-stack-3 wireless-card">
      <strong className="wireless-card__title">{t('Téléphone sans câble')}</strong>
      <p className="ui-muted ui-text-s ui-m-0">
        {t("Gtracker range les sessions de votre téléphone sur cet ordinateur dès que vous l'ouvrez sur le téléphone, relié au même réseau que l'ordinateur : la même box Wi-Fi, ou un partage de connexion entre les deux. Le câble reste possible.")}
      </p>
      <label className="ui-row-s2 ui-center">
        <input type="checkbox" className="wireless-card__toggle" checked={active} disabled={busy || state === null}
          onChange={(e) => void view.setActive(e.target.checked)} />
        <span>{t('Recevoir les sessions du téléphone sans câble')}</span>
      </label>
      {state !== null && !active && (
        <p className="ui-muted ui-text-s ui-m-0">
          {t("En l'allumant, Windows va demander d'autoriser Gtracker sur le réseau : acceptez, sinon le téléphone ne pourra pas se présenter.")}
        </p>
      )}
      {status !== null && <p className="wireless-card__status ui-text-s ui-m-0">{status.text}</p>}
      {status?.warning && <p className="ui-danger-text ui-text-s ui-m-0 wireless-card__warning">{status.warning}</p>}
      {status?.hint && phones.every((p) => !p.relie) && !waiting && <p className="ui-muted ui-text-s ui-m-0 wireless-card__hint">{status.hint}</p>}
      {view.error !== null && <p className="ui-danger-text ui-text-s ui-m-0 wireless-card__error">{view.error}</p>}

      {listening && !waiting && (
        <div className="ui-row-s2 ui-wrap">
          <Button size="s" onClick={() => void view.startPairing()} disabled={busy}>{t('Relier un téléphone')}</Button>
        </div>
      )}

      {pairing !== null && waiting && (
        <div className="wireless-card__pairing" role="group" aria-label={t('Relier un téléphone')}>
          <p className="ui-m-0">
            {t("Sur le téléphone, ouvrez Gtracker, puis Réglages, Mémoire, et reliez-le à cet ordinateur. S'il ne le trouve pas seul, tapez l'adresse et le code :")}
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

      {(active || phones.length > 0) && (
        <div className="ui-stack-3 wireless-card__phones">
          <strong className="ui-text-m">{t('Téléphones reliés')}</strong>
          {phones.length === 0 ? (
            <p className="ui-muted ui-text-s ui-m-0">{t("Aucun téléphone relié pour l'instant.")}</p>
          ) : (
            <ul className="set-files-list">
              {phones.map((phone) => (
                <li key={phone.id} className="set-files-row">
                  <span className="ui-stack ui-min-w-0">
                    <strong className="ui-text-m">{phone.nom}</strong>
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
    </div>
  );
}

export default WirelessPhoneCard;
