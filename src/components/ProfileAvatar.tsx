import { useEffect, useRef, useState } from 'react';
import { LOGO_IDS, LOGO_LABEL, type LogoId } from '../core/activityLogos';
import { AVATAR_PHOTO_PX, type AthleteAvatar } from '../library/athleteProfile';
import { pushBackLayer } from '../platform/backButton';
import { readPickedImage } from '../platform/files';
import { IconClose, IconImage, IconUser } from './icons';
import ActivityLogo from './logos/ActivityLogo';
import Button from './ui/Button';
import './ProfileAvatar.css';

/**
 * Photo ronde du Profil : une image importée, ou un logo d'activité dans son cadre, sur un disque au fond de la page.
 * Sans choix, le logo du sport préféré à la couleur de son activité (`fallback`), sinon une silhouette.
 */

interface AvatarFallback {
  icon: LogoId;
  /** Couleur du cadre, déjà celle du thème. */
  color: string;
}

/** Côté donné au logo, au-dessus du seuil du cadre : le disque le remet à sa taille, celle de son parent. */
const AVATAR_LOGO_PX = 88;

/** Disque d'un logo : le dessin à l'encre dans son cadre au pinceau, à la couleur reçue. */
const LogoDisc = ({ icon, color }: AvatarFallback) => (
  <span className="profile-avatar__disc profile-avatar__disc--logo">
    <ActivityLogo logo={icon} color={color} size={AVATAR_LOGO_PX} className="profile-avatar__logo" />
  </span>
);

export function ProfileAvatar({ avatar, fallback, logoColor }: {
  avatar: AthleteAvatar | null;
  fallback: AvatarFallback | null;
  /** Couleur du cadre d'un logo choisi, déjà celle du thème. */
  logoColor: (logo: LogoId) => string;
}) {
  if (avatar?.kind === 'photo') return <img className="profile-avatar__photo" src={avatar.dataUrl} alt="" />;
  if (avatar?.kind === 'dessin') return <LogoDisc icon={avatar.icon} color={logoColor(avatar.icon)} />;
  if (fallback) return <LogoDisc {...fallback} />;
  return (
    <span className="profile-avatar__disc profile-avatar__disc--empty">
      <IconUser size={100} className="profile-avatar__art" />
    </span>
  );
}

/**
 * Choix de la photo : les onze logos dans leur cadre, une image importée
 * (la galerie ou l'appareil photo sur le téléphone), ou aucun choix. Se ferme
 * une fois le choix fait.
 */
export function AvatarPicker({ avatar, logoColor, onPick, onClose }: {
  avatar: AthleteAvatar | null;
  /** Couleur du cadre de chaque logo, déjà celle du thème. */
  logoColor: (logo: LogoId) => string;
  onPick: (avatar: AthleteAvatar | null) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  // Le retour d'Android ferme le choix, sans quitter le Profil ; le dernier `onClose` est lu au moment du retour.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => pushBackLayer(() => closeRef.current()), []);

  const importImage = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      onPick({ kind: 'photo', dataUrl: await readPickedImage(file, AVATAR_PHOTO_PX) });
      onClose();
    } catch {
      setError('Cette image ne se lit pas : essayez une photo en JPEG ou PNG.');
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <section className="avatar-picker" aria-label="Choix de la photo">
      <div className="avatar-picker__head">
        <span className="avatar-picker__title">Photo de profil</span>
        <button type="button" className="avatar-picker__close" aria-label="Fermer" onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <div className="avatar-picker__grid">
        {LOGO_IDS.map((icon) => (
          <button key={icon} type="button" className="avatar-picker__choice" title={LOGO_LABEL[icon]}
            aria-label={LOGO_LABEL[icon]} aria-pressed={avatar?.kind === 'dessin' && avatar.icon === icon}
            onClick={() => { onPick({ kind: 'dessin', icon }); onClose(); }}>
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
          <Button variant="ghost" onClick={() => { onPick(null); onClose(); }}>Retirer</Button>
        )}
      </div>
      {error && <p className="avatar-picker__error" role="alert">{error}</p>}
    </section>
  );
}
