import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpText, HelpToggle } from './Help';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import { ATHLETE_NAME_MAX, type AthleteProfile } from '../library/athleteProfile';
import { missingProfileFields, shouldPromptProfile } from '../library/profilePrompt';
import { readAthleteProfile, useAthleteProfile } from '../hooks/useAthleteProfile';
import { isNativeApp } from '../platform/runtime';
import './ProfilePrompt.css';

/**
 * Déjà ouvert, ou écarté, depuis le lancement de l'application : le pop-up ne
 * revient qu'au lancement suivant (un état du module, rien sur l'appareil).
 */
let askedThisLaunch = false;

/** Champs du pop-up, tels que tapés : une année vide ou hors plage n'est pas écrite. */
interface Draft {
  name: string;
  birthYear: string;
}

const draftOf = (profile: AthleteProfile): Draft => ({
  name: profile.name ?? '',
  birthYear: profile.birthYear === null ? '' : String(profile.birthYear),
});

/**
 * Pop-up de l'accueil, dans l'application : tant que le profil n'est pas rempli
 * (pseudo et année de naissance depuis le lot 301 : `missingProfileFields`), il
 * s'ouvre une fois par lancement. Posé par l'accueil une fois la mémoire et la
 * carte des autorisations décidées, il tranche à son arrivée ; `otherCardShown` :
 * l'une d'elles est à l'écran, et il attend le lancement suivant. `onDecided`
 * apprend une fois s'il s'ouvre (la carte du jour des tutoriels attend alors).
 */
function ProfilePrompt({ otherCardShown, onDecided }: { otherCardShown: boolean; onDecided?: (shown: boolean) => void }) {
  const { setName, setNumber } = useAthleteProfile();
  // Le profil du hook est vide au premier rendu (il se relit dans un effet) : la décision lit le stockage.
  const [stored] = useState(readAthleteProfile);
  const [shown] = useState(() => {
    const open = shouldPromptProfile({
      native: isNativeApp(), missing: missingProfileFields(stored), askedThisLaunch, otherCardShown,
    });
    askedThisLaunch = true;
    return open;
  });
  const onDecidedRef = useRef(onDecided);
  useEffect(() => {
    onDecidedRef.current = onDecided;
  });
  useEffect(() => {
    onDecidedRef.current?.(shown);
  }, [shown]);
  const [closed, setClosed] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(stored));

  if (!shown || closed) return null;
  const close = () => setClosed(true);
  const save = () => {
    if (draft.name.trim() !== '') setName(draft.name.trim());
    const year = draft.birthYear.trim() === '' ? null : parseFloat(draft.birthYear.replace(',', '.'));
    if (year !== null && !isNaN(year)) setNumber('birthYear', Math.round(year));
    close();
  };
  const field = (key: 'birthYear', label: string, unit: string, placeholder: string, help: string) => (
    <>
      <label className="profile-prompt__row">
        <span className="profile-prompt__label">{label}<HelpToggle helpKey={`accueil-profil:${key}`} label={label} /></span>
        <input type="number" inputMode="decimal" className="ui-field ui-field--s num profile-prompt__number" value={draft[key]}
          placeholder={placeholder} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
        <span className="profile-prompt__unit">{unit}</span>
      </label>
      <HelpText helpKey={`accueil-profil:${key}`}>{help}</HelpText>
    </>
  );

  return (
    <Dialog title="Votre profil" onClose={close} className="profile-prompt">
      <p className="profile-prompt__intro">
        Pour la page Profil et la FC max estimée. Tout se change ensuite dans <Link to="/parametres" onClick={close}>Réglages</Link> › Pratiquant.
      </p>
      <label className="profile-prompt__row">
        <span className="profile-prompt__label">Nom ou pseudo<HelpToggle helpKey="accueil-profil:nom" label="Nom ou pseudo" /></span>
        <input type="text" className="ui-field ui-field--s profile-prompt__text" value={draft.name} maxLength={ATHLETE_NAME_MAX}
          placeholder="ex. Tom" autoComplete="nickname" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <HelpText helpKey="accueil-profil:nom">En titre de la page Profil et au pied des images partagées.</HelpText>
      {field('birthYear', 'Année de naissance', '', 'ex. 1985', 'Pour la dépense au repos, et la FC max estimée quand elle n\'est pas saisie.')}
      <div className="profile-prompt__actions">
        <Button variant="ghost" onClick={close}>Plus tard</Button>
        <Button variant="primary" onClick={save}>Enregistrer</Button>
      </div>
    </Dialog>
  );
}

export default ProfilePrompt;
