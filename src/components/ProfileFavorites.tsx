import { Link } from 'react-router-dom';
import type { LogoId } from '../core/activityLogos';
import { t, tn } from '../core/i18n';
import type { FavoriteSpot } from '../library/profile';
import type { BrushFrameProps } from './brushFrame';
import { IconPin } from './icons';
import ActivityLogo from './logos/ActivityLogo';
import './ProfileFavorites.css';

/**
 * Les activités favorites du Profil : jusqu'à trois activités en ligne, de la première à la troisième place, chacune
 * par son logo dans son cadre au pinceau (de plus en plus petit), son nom, ses sessions et sa distance sur la période ;
 * à droite, une case « Total » sans logo. Sans activité, le cadre garde « Total » et le dit en une ligne.
 * Le spot préféré de la période, s'il y en a un, est une languette au trait de pinceau posée à cheval sur le bord haut
 * du cadre, en haut à droite, sans le faire grandir : son lieu (deux lignes au plus) et son nombre de sessions.
 */

/** Côté du logo de la première, de la deuxième et de la troisième place, en pixels (tous au-dessus du seuil du cadre). */
const FAVORITE_LOGO_PX = [76, 58, 44] as const;

export interface FavoriteCell {
  key: string;
  name: string;
  logo: LogoId;
  /** Couleur du cadre, déjà celle du thème. */
  color: string;
  sessions: number;
  /** Distance de la période, déjà dans l'unité de l'activité et au format de l'application. */
  distance: string;
  /** Adresse de Sessions, filtrée sur l'activité (sans filtre si elle est cachée). */
  to: string;
}

function ProfileFavorites({ cells, total, frame, spot = null }: {
  /** Du premier au troisième ; moins de trois, ou aucun. */
  cells: readonly FavoriteCell[];
  /** Distance totale de la période, déjà mise en forme. */
  total: string;
  /** Cadre peint du bloc (`brushFrame`). */
  frame: BrushFrameProps;
  /** Spot préféré de la période (`favoriteSpot`) ; `null` : pas d'encart. */
  spot?: FavoriteSpot | null;
}) {
  return (
    <section className={`profile-favs ui-card-col ${frame.className}${spot ? ' profile-favs--spot' : ''}`} style={frame.style} aria-label={t('Activités favorites')}>
      <div className="profile-favs__head">
        <h2 className="profile-card__title">{t('Activités favorites')}</h2>
        {/* Languette du spot préféré, à cheval sur le bord haut du cadre, en haut à droite. */}
        {spot && (
          <p className="profile-spot">
            <span className="profile-spot__eyebrow"><IconPin size={13} />{t('Spot préféré')}</span>
            <span className="profile-spot__name">{spot.name}</span>
            <span className="profile-spot__sessions num">{tn(spot.sessions, '{n} session', '{n} sessions')}</span>
          </p>
        )}
      </div>
      {cells.length === 0 && <p className="ui-hint profile-favs__empty">{t('Aucune session rangée sur cette période.')}</p>}
      <ol className="profile-favs__row">
        {cells.map((c, i) => (
          <li key={c.key} className="profile-favs__cell">
            <Link to={c.to} className="profile-favs__art profile-favs__link" aria-label={t('Sessions de {nom}', { nom: c.name })}>
              <ActivityLogo logo={c.logo} color={c.color} size={FAVORITE_LOGO_PX[i] ?? FAVORITE_LOGO_PX[FAVORITE_LOGO_PX.length - 1]}
                className={`profile-favs__logo profile-favs__logo--${Math.min(i, FAVORITE_LOGO_PX.length - 1) + 1}`} />
            </Link>
            <span className="profile-favs__name">{c.name}</span>
            <span className="profile-favs__sessions num">{tn(c.sessions, '{n} session', '{n} sessions')}</span>
            <span className="profile-favs__distance num">{c.distance}</span>
          </li>
        ))}
        <li className="profile-favs__cell profile-favs__cell--total">
          <span className="profile-favs__art" />
          <span className="ui-eyebrow profile-favs__name">{t('Total')}</span>
          <span className="profile-favs__sessions" aria-hidden="true">&nbsp;</span>
          <span className="profile-favs__distance num">{total}</span>
        </li>
      </ol>
    </section>
  );
}

export default ProfileFavorites;
