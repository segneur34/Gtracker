import { SPORT_FAMILIES, sportFamily, type SportFamily } from './sportProfiles';
import type { SportType } from './types';

const isFamily = (s: string): s is SportFamily => (SPORT_FAMILIES as string[]).includes(s);

/** Page du test de FC repos, ouverte depuis le Profil. */
export const RESTING_HR_PATH = '/profil/fc-repos';

/** Page Sessions : la liste de toutes les sessions, filtrable par activité (`?activite=`). */
export const SESSIONS_PATH = '/sessions';

/**
 * Page au-dessus d'une adresse, où renvoie la touche retour d'Android (et le
 * geste du bord de l'écran) : l'analyse d'une session renvoie à la page
 * Sessions, filtre d'activité compris, comme le lien « ← » de son en-tête, et le test
 * de FC repos au Profil, où est son entrée ; une leçon des tutoriels à leur liste, et celle-ci à Réglages ; les
 * Statistiques remontent d'un cran (activité, famille, vue d'ensemble), la
 * période gardée ; toute autre page renvoie à l'accueil. `null` à l'accueil et
 * sur Sessions, où l'accueil mène : rien au-dessus, le retour quitte l'application.
 */
export const parentPage = (pathname: string, search: string): string | null => {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === SESSIONS_PATH) return null;
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && parts[1] === 'analyse' && isFamily(parts[0])) {
    return sessionsPath(new URLSearchParams(search).get('activite') ?? undefined);
  }
  // Le test de FC repos : le Profil, où est son entrée.
  if (path === RESTING_HR_PATH) return '/profil';
  // Tutoriels : une leçon remonte à la liste, d'où qu'on l'ait ouverte (carte de l'accueil comprise), la liste à Réglages.
  if (parts[0] === 'tutoriels') return parts.length > 1 ? '/tutoriels' : '/parametres';
  if (path === '/statistiques') {
    const params = new URLSearchParams(search);
    const next = new URLSearchParams();
    const famille = params.get('famille');
    const periode = params.get('periode');
    if (famille === null) return '/';
    if (params.get('activite') !== null) next.set('famille', famille);
    if (periode !== null) next.set('periode', periode);
    const query = next.toString();
    return query === '' ? '/statistiques' : `/statistiques?${query}`;
  }
  return '/';
};

/** Page Sessions, filtrée sur une activité si `activityId` est donné. */
export const sessionsPath = (activityId?: string | null): string =>
  `${SESSIONS_PATH}${activityId ? `?activite=${encodeURIComponent(activityId)}` : ''}`;

/**
 * Module d'analyse d'une famille, ouvert sur une session de la mémoire si `file`
 * est donné. `fromActivityId` : le filtre d'activité de la page Sessions d'où l'on
 * vient (`?activite=`), que le retour rend.
 */
export const analysisPath = (family: SportFamily, file?: string | null, fromActivityId?: string | null): string => {
  if (!file) return `/${family}/analyse`;
  const from = fromActivityId ? `&activite=${encodeURIComponent(fromActivityId)}` : '';
  return `/${family}/analyse?session=${encodeURIComponent(file)}${from}`;
};

/** Famille d'une session : celle de son support, sinon `fallback` pour une session à classer. */
export const sessionFamily = (session: { record: { sport: SportType | null } } | undefined, fallback: SportFamily): SportFamily =>
  session?.record.sport ? sportFamily(session.record.sport) : fallback;
