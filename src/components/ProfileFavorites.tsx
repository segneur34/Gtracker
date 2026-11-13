import type { LogoId } from '../core/activityLogos';
import { plural } from '../core/basics';
import type { BrushFrameProps } from './brushFrame';
import ActivityLogo from './logos/ActivityLogo';
import './ProfileFavorites.css';

/**
 * Les activités favorites du Profil : jusqu'à trois activités en ligne, de la première à la troisième place, chacune
 * par son logo dans son cadre au pinceau (de plus en plus petit), son nom, ses sessions et sa distance sur la période ;
 * à droite, une case « Total » sans logo. Sans activité, le cadre garde « Total » et le dit en une ligne.
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
}

function ProfileFavorites({ cells, total, frame }: {
  /** Du premier au troisième ; moins de trois, ou aucun. */
  cells: readonly FavoriteCell[];
  /** Distance totale de la période, déjà mise en forme. */
  total: string;
  /** Cadre peint du bloc (`brushFrame`). */
  frame: BrushFrameProps;
}) {
  return (
    <section className={`profile-favs ui-card-col ${frame.className}`} style={frame.style} aria-label="Activités favorites">
      <h2 className="profile-card__title">Activités favorites</h2>
      {cells.length === 0 && <p className="ui-hint profile-favs__empty">Aucune session rangée sur cette période.</p>}
      <ol className="profile-favs__row">
        {cells.map((c, i) => (
          <li key={c.key} className="profile-favs__cell">
            <span className="profile-favs__art">
              <ActivityLogo logo={c.logo} color={c.color} size={FAVORITE_LOGO_PX[i] ?? FAVORITE_LOGO_PX[FAVORITE_LOGO_PX.length - 1]}
                className={`profile-favs__logo profile-favs__logo--${Math.min(i, FAVORITE_LOGO_PX.length - 1) + 1}`} />
            </span>
            <span className="profile-favs__name">{c.name}</span>
            <span className="profile-favs__sessions num">{plural(c.sessions, 'session')}</span>
            <span className="profile-favs__distance num">{c.distance}</span>
          </li>
        ))}
        <li className="profile-favs__cell profile-favs__cell--total">
          <span className="profile-favs__art" />
          <span className="ui-eyebrow profile-favs__name">Total</span>
          <span className="profile-favs__sessions" aria-hidden="true">&nbsp;</span>
          <span className="profile-favs__distance num">{total}</span>
        </li>
      </ol>
    </section>
  );
}

export default ProfileFavorites;
