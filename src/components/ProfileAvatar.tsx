import { useId, useRef, useState } from 'react';
import { LOGO_IDS, LOGO_LABEL, type LogoId } from '../core/activityLogos';
import { AVATAR_PHOTO_PX, type AthleteAvatar } from '../library/athleteProfile';
import { readPickedImage } from '../platform/files';
import { IconImage, IconUser } from './icons';
import ActivityLogo from './logos/ActivityLogo';
import Button from './ui/Button';
import './ProfileAvatar.css';

/**
 * Photo ronde du Profil : une image importée, ou un logo d'activité dans son cadre, sur un disque au fond de la page.
 * Sans choix, un disque vide à silhouette : il se remplit quand l'utilisateur choisit.
 */

/** Côté donné au logo, au-dessus du seuil du cadre : le disque le remet à sa taille, celle de son parent. */
const AVATAR_LOGO_PX = 88;

/** Disque d'un logo : le dessin à l'encre dans son cadre au pinceau, à la couleur reçue. */
const LogoDisc = ({ icon, color }: { icon: LogoId; color: string }) => (
  <span className="profile-avatar__disc profile-avatar__disc--logo">
    <ActivityLogo logo={icon} color={color} size={AVATAR_LOGO_PX} className="profile-avatar__logo" />
  </span>
);

export function ProfileAvatar({ avatar, logoColor }: {
  avatar: AthleteAvatar | null;
  /** Couleur du cadre d'un logo choisi, déjà celle du thème. */
  logoColor: (logo: LogoId) => string;
}) {
  if (avatar?.kind === 'photo') return <img className="profile-avatar__photo" src={avatar.dataUrl} alt="" />;
  if (avatar?.kind === 'dessin') return <LogoDisc icon={avatar.icon} color={logoColor(avatar.icon)} />;
  return (
    <span className="profile-avatar__disc profile-avatar__disc--empty">
      <IconUser size={100} className="profile-avatar__art" />
    </span>
  );
}

/**
 * Choix de la photo : au repos, la photo actuelle en petit rond et un bouton « Changer l'image » ; le bouton déplie
 * les onze logos dans leur cadre, une image importée (la galerie ou l'appareil photo sur le téléphone) et « Retirer ».
 * Le choix s'applique tout de suite et les propositions restent ouvertes ; c'est la fenêtre ou la page autour qui se ferme.
 */
export function AvatarPicker({ avatar, logoColor, onPick }: {
  avatar: AthleteAvatar | null;
  /** Couleur du cadre de chaque logo, déjà celle du thème. */
  logoColor: (logo: LogoId) => string;
  onPick: (avatar: AthleteAvatar | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const panelId = useId();
  /** Replié à chaque ouverture, et gardé ouvert après un choix pour en essayer plusieurs. */
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const importImage = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      onPick({ kind: 'photo', dataUrl: await readPickedImage(file, AVATAR_PHOTO_PX) });
    } catch {
      setError('Cette image ne se lit pas : essayez une photo en JPEG ou PNG.');
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="avatar-picker" role="group" aria-label="Photo de profil">
      <div className="avatar-picker__current">
        <span className="avatar-picker__preview"><ProfileAvatar avatar={avatar} logoColor={logoColor} /></span>
        <Button variant="secondary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          Changer l'image
        </Button>
      </div>
      {open && (
        <div id={panelId} className="avatar-picker__panel">
          <div className="avatar-picker__grid">
            {LOGO_IDS.map((icon) => (
              <button key={icon} type="button" className="avatar-picker__choice" title={LOGO_LABEL[icon]}
                aria-label={LOGO_LABEL[icon]} aria-pressed={avatar?.kind === 'dessin' && avatar.icon === icon}
                onClick={() => onPick({ kind: 'dessin', icon })}>
                <LogoDisc icon={icon} color={logoColor(icon)} />
              </button>
            ))}
          </div>
          <div className="avatar-picker__actions">
            <label className={`ui-btn ui-btn--secondary avatar-picker__import${reading ? ' is-busy' : ''}`}>
              <IconImage size={18} /> {reading ? 'Lecture…' : 'Importer une image'}
              <input ref={input} type="file" accept="image/*" hidden disabled={reading}
                onChange={(e) => void importImage(e.target.files?.[0])} />
            </label>
            {avatar && (
              <Button variant="ghost" onClick={() => onPick(null)}>Retirer</Button>
            )}
          </div>
          {error && <p className="avatar-picker__error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
