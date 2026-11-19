import { t } from '../core/i18n';
import { routeShareFile, type SavedRoute } from '../hooks/routeFiles';
import { plainError } from '../platform/errorText';
import { shareFile } from '../platform/share';

/** Phrase à montrer après un partage : son succès silencieux n'en a pas. */
export interface RouteShareNote {
  text: string;
  error: boolean;
}

/**
 * « Partager le GPX » d'un itinéraire rangé, depuis la liste des itinéraires
 * comme depuis l'itinéraire ouvert dans Planifier : le GPX tel que rangé, sa
 * fiche en extension, confié au partage du système. Rend la phrase à montrer :
 * un navigateur qui ne partage pas de fichier le télécharge, et le dit ; un
 * échec est dit en clair ; un partage abouti ne dit rien.
 */
export const shareRouteGpx = async (saved: SavedRoute): Promise<RouteShareNote | null> => {
  try {
    const { fileName, text } = await routeShareFile(saved);
    const outcome = await shareFile(new Blob([text], { type: 'application/gpx+xml' }), fileName, t("Partager l'itinéraire"));
    return outcome === 'downloaded' ? { text: t('Ce navigateur ne partage pas de fichier : le GPX est téléchargé.'), error: false } : null;
  } catch (err) {
    return { text: t('Partage impossible : {reason}', { reason: plainError(err, t('erreur inconnue')) }), error: true };
  }
};
