import { useState, type FormEvent } from 'react';
import { t } from '../core/i18n';
import { useComputerLink, type ComputerLinkView } from '../hooks/useComputerLink';
import { addressFieldShown, addressWellFormed, cleanCode, codeComplete, describeLink, refusalText } from '../library/computerLink';
import type { ComputerLinkStatus } from '../platform/computerLink';
import Button from './ui/Button';
import './ComputerLinkCard.css';

/**
 * L'ordinateur relié sans câble, dans Réglages › Mémoire, application du téléphone seulement (rien dans le navigateur
 * ni dans le programme Windows, qui a son propre bloc : `WirelessPhoneCard`). C'est le seul endroit où le téléphone dit
 * l'état de la liaison, que `useComputerLinkLauncher` tente toute seule à l'ouverture. Jamais relié : la marche à
 * suivre et le champ du code, avec l'adresse en plus quand l'ordinateur ne s'est pas trouvé seul. Relié : son nom,
 * l'état, le dernier envoi, « Chercher l'ordinateur » et « Oublier cet ordinateur ».
 */
function ComputerLinkCard() {
  const view = useComputerLink();
  const { status } = view;
  if (!view.available || status === null) return null;

  const line = describeLink(status, view.nowMs);
  const folderOk = view.folder.state === 'ok';
  const attempting = view.busy || status.state === 'searching' || status.state === 'pairing';
  /** Rien ne se tente sans dossier mémoire à lire, ni pendant un enregistrement ni pendant une tentative. */
  const blocked = attempting || view.recording || !folderOk;
  const problem = view.problem ?? line.problem;

  return (
    <div className="ui-stack-3 computer-link">
      <strong className="computer-link__title">{t('Ordinateur')}</strong>
      {!folderOk && (
        <p className="ui-muted ui-text-s ui-m-0 computer-link__note">
          {t("Sans dossier mémoire accessible (plus haut), la liaison avec l'ordinateur ne se fait pas : il y lit vos sessions.")}
        </p>
      )}
      {view.recording && (
        <p className="ui-muted ui-text-s ui-m-0 computer-link__note">
          {t("Un enregistrement est en cours : la liaison avec l'ordinateur attend qu'il soit fini.")}
        </p>
      )}
      {status.paired
        ? <PairedPanel view={view} status={status} headline={line.headline} sent={line.sent} blocked={blocked} attempting={attempting} />
        : <PairForm view={view} status={status} headline={line.headline} blocked={blocked} attempting={attempting} />}
      {problem !== null && <p className="ui-danger-text ui-text-s ui-m-0 computer-link__problem" role="status">{problem}</p>}
    </div>
  );
}

interface PanelProps {
  view: ComputerLinkView;
  status: ComputerLinkStatus;
  headline: string | null;
  blocked: boolean;
  attempting: boolean;
}

/** Champ « Adresse », montré quand l'ordinateur ne s'est pas trouvé seul ; l'adresse mal formée est signalée avant tout envoi. */
function AddressField({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled: boolean }) {
  const wrong = value.trim() !== '' && !addressWellFormed(value);
  return (
    <div className="ui-stack-1">
      <label className="computer-link__label" htmlFor="computer-link-address">{t('Adresse')}</label>
      <input id="computer-link-address" className="ui-field num computer-link__address" inputMode="decimal" autoComplete="off"
        spellCheck={false} placeholder="192.168.1.20:48217" value={value} disabled={disabled} aria-invalid={wrong}
        onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))} />
      {wrong && <span className="ui-danger-text ui-text-s">{refusalText('address')}</span>}
    </div>
  );
}

/** Jamais relié : la marche à suivre, le code affiché sur l'ordinateur, et « Relier ». Démonté dès que l'ordinateur est connu : les champs repartent vides. */
function PairForm({ view, status, headline, blocked, attempting }: PanelProps) {
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const showAddress = addressFieldShown(status);
  const addressWrong = showAddress && address.trim() !== '' && !addressWellFormed(address);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (blocked || !codeComplete(code) || addressWrong) return;
    void view.pair(code, showAddress ? address : '');
  };

  return (
    <form className="ui-stack-3" onSubmit={submit}>
      <p className="ui-muted ui-text-s ui-m-0">
        {t("Pour envoyer vos sessions à l'ordinateur sans câble : sur l'ordinateur, ouvrez Gtracker, Réglages, Mémoire, touchez « Relier un téléphone », puis tapez ici le code affiché. Le téléphone et l'ordinateur doivent être sur le même réseau : la même box Wi-Fi, ou un partage de connexion entre les deux.")}
      </p>
      {headline !== null && <p className="ui-text-s ui-m-0 computer-link__status" role="status">{headline}</p>}
      <div className="ui-stack-1">
        <label className="computer-link__label" htmlFor="computer-link-code">{t('Code')}</label>
        <input id="computer-link-code" className="ui-field num computer-link__code" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} placeholder="000000" value={code} disabled={attempting}
          onChange={(e) => setCode(cleanCode(e.target.value))} />
      </div>
      {showAddress && (
        <>
          <p className="ui-muted ui-text-s ui-m-0">{t("Gtracker n'a pas trouvé l'ordinateur tout seul. Tapez l'adresse qu'il affiche :")}</p>
          <AddressField value={address} onChange={setAddress} disabled={attempting} />
        </>
      )}
      <div className="ui-row-s2 ui-wrap">
        <Button type="submit" variant="primary" size="s" disabled={blocked || !codeComplete(code) || addressWrong}>{t('Relier')}</Button>
      </div>
    </form>
  );
}

/** Ordinateur connu : son nom et l'état, le dernier envoi, « Chercher l'ordinateur » et « Oublier cet ordinateur ». */
function PairedPanel({ view, status, headline, sent, blocked, attempting }: PanelProps & { sent: string | null }) {
  const [address, setAddress] = useState('');
  const showAddress = addressFieldShown(status);
  const addressWrong = showAddress && address.trim() !== '' && !addressWellFormed(address);

  return (
    <div className="ui-stack-3">
      {headline !== null && <p className="ui-m-0 computer-link__status" role="status">{headline}</p>}
      {sent !== null && <p className="ui-muted ui-text-s ui-m-0">{sent}</p>}
      {showAddress && (
        <>
          <p className="ui-muted ui-text-s ui-m-0">{t("Gtracker n'a pas trouvé l'ordinateur tout seul. Tapez l'adresse qu'il affiche :")}</p>
          <AddressField value={address} onChange={setAddress} disabled={attempting} />
        </>
      )}
      <div className="ui-row-s2 ui-wrap">
        <Button size="s" disabled={blocked || addressWrong} onClick={() => void view.search(showAddress ? address : '')}>
          {t("Chercher l'ordinateur")}
        </Button>
        <Button size="s" disabled={view.busy} onClick={() => void view.forget()}>{t('Oublier cet ordinateur')}</Button>
      </div>
    </div>
  );
}

export default ComputerLinkCard;
