import { GONG_LOGO_HEIGHT, GONG_LOGO_PATH, GONG_LOGO_WIDTH } from './gongLogoPath';

/**
 * Logo GONG complet (symbole et mot « GONG »), de la couleur du texte (`currentColor`). Décoratif : le nom lisible
 * (« GONG Gtracker ») est porté par le titre ou le lien qui l'entoure. La hauteur se règle en CSS, la largeur suit.
 */
function GongLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${GONG_LOGO_WIDTH} ${GONG_LOGO_HEIGHT}`} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={GONG_LOGO_PATH} />
    </svg>
  );
}

export default GongLogo;
