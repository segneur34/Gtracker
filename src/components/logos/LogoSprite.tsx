import { LOGO_IDS } from '../../core/activityLogos';
import { FRAME_PATH, LOGO_PATHS } from './logoPaths';
import { LOGO_FRAME_SYMBOL, LOGO_VIEWBOX, logoSymbolId } from './logoSymbols';
import './ActivityLogo.css';

/**
 * Feuille de symboles des logos d'activité : un `<symbol>` par dessin (remplissage pair-impair) et un pour le cadre au
 * pinceau, que chaque logo reprend par `<use>`. Seule pièce à importer les tracés (environ 110 Ko) : elle se charge à
 * part, par `lazy()`, et se monte une seule fois dans la page (un identifiant en double casserait les `<use>`). Tant
 * qu'elle n'est pas chargée, les logos restent vides, sans erreur.
 */
function LogoSprite() {
  return (
    <svg className="logo-sprite" aria-hidden="true" focusable="false" width="0" height="0">
      <symbol id={LOGO_FRAME_SYMBOL} viewBox={LOGO_VIEWBOX}>
        <path d={FRAME_PATH} fill="currentColor" />
      </symbol>
      {LOGO_IDS.map((logo) => (
        <symbol key={logo} id={logoSymbolId(logo)} viewBox={LOGO_VIEWBOX}>
          <path d={LOGO_PATHS[logo]} fill="currentColor" fillRule="evenodd" />
        </symbol>
      ))}
    </svg>
  );
}

export default LogoSprite;
