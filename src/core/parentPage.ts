import { SPORT_FAMILIES, sportFamily, type SportFamily } from './sportProfiles';
import type { SportType } from './types';

const isFamily = (s: string): s is SportFamily => (SPORT_FAMILIES as string[]).includes(s);

/** Profil : la page où s'ouvre l'application (`/` y mène), et où mènent le logo GONG et la case « Profil ». */
export const PROFILE_PATH = '/profil';

/** Réglages, où s'ouvre le test de FC repos et où il revient. */
export const SETTINGS_PATH = '/parametres';

/** Page Enregistrer (`RECORD_PATH` de `navigation.ts`, qui importe ce module). */
const RECORD_ROUTE = '/enregistrer';

/** Réglages ouverts sur le bloc « Capteurs » (`?bloc=capteurs`), où se trouve le bouton « Ajouter » d'une ceinture. */
export const SETTINGS_SENSORS_PATH = `${SETTINGS_PATH}?bloc=capteurs`;

/** Réglages ouverts sur la corbeille (`?bloc=corbeille`) : la carte Mémoire dépliée, la page défilée jusqu'à elle. */
export const SETTINGS_TRASH_PATH = `${SETTINGS_PATH}?bloc=corbeille`;

/** Bloc de Réglages désigné par l'adresse (`?bloc=`), `null` s'il n'y en a pas : les blocs gardent alors leur état. */
export const settingsBlockFromSearch = (search: string): string | null => new URLSearchParams(search).get('bloc');

/** Page du test de FC repos, ouverte depuis Réglages (Pratiquant, à gauche de la FC de repos). */
export const RESTING_HR_PATH = '/profil/fc-repos';

/** Page Sessions : la liste de toutes les sessions, filtrable par activité (`?activite=`). */
export const SESSIONS_PATH = '/sessions';

/** Planification d'un parcours (Planifier), ouverte depuis la liste des itinéraires, où elle revient. */
export const PLAN_PATH = '/itineraires';

/**
 * Liste des itinéraires planifiés, d'où partent un itinéraire rangé et « Planifier » ; son entrée est la pastille
 * « Planification » de Sessions et, sur ordinateur, « Planifier » de la barre du haut.
 */
export const ROUTES_LIST_PATH = `${PLAN_PATH}/liste`;

/**
 * Page au-dessus d'une adresse, où renvoie la touche retour d'Android (et le
 * geste du bord de l'écran) : l'analyse d'une session renvoie à la page
 * Sessions, filtre d'activité compris, comme le lien « ← » de son en-tête ; Planifier, itinéraire ouvert compris, à la
 * liste des itinéraires, d'où il part ; la liste à Sessions, où est son entrée sur téléphone ; Sessions au Profil ; le test de FC repos à Réglages, dont
 * l'entrée est dans Pratiquant ; une leçon des tutoriels à leur liste, et celle-ci à Réglages ; les
 * Statistiques remontent d'un cran (activité, famille, vue d'ensemble), la
 * période gardée, puis au Profil ; toute autre page renvoie au Profil. `null` sur le Profil, et à `/`, qui y mène :
 * rien au-dessus, le retour quitte l'application.
 */
export const parentPage = (pathname: string, search: string): string | null => {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === PROFILE_PATH) return null;
  // Réglages ouverts par le lien de la page Enregistrer (`?bloc=capteurs`) : retour à Enregistrer.
  if (path === SETTINGS_PATH && settingsBlockFromSearch(search) === 'capteurs') return RECORD_ROUTE;
  // Réglages ouverts par « Corbeille » du menu de Sessions : retour à Sessions.
  if (path === SETTINGS_PATH && settingsBlockFromSearch(search) === 'corbeille') return SESSIONS_PATH;
  if (path === SESSIONS_PATH) return PROFILE_PATH;
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && parts[1] === 'analyse' && isFamily(parts[0])) {
    return sessionsPath(new URLSearchParams(search).get('activite') ?? undefined);
  }
  // Le test de FC repos : Réglages, où est son entrée.
  if (path === RESTING_HR_PATH) return SETTINGS_PATH;
  // Planifier remonte à la liste des itinéraires, où l'on choisit un itinéraire rangé ou « Planifier » ; la liste à
  // Sessions, où « Planification » y mène.
  if (path === PLAN_PATH) return ROUTES_LIST_PATH;
  if (path.startsWith(`${PLAN_PATH}/`)) return SESSIONS_PATH;
  // Tutoriels : une leçon remonte à la liste, d'où qu'on l'ait ouverte, la liste à Réglages.
  if (parts[0] === 'tutoriels') return parts.length > 1 ? '/tutoriels' : SETTINGS_PATH;
  if (path === '/statistiques') {
    const params = new URLSearchParams(search);
    const next = new URLSearchParams();
    const famille = params.get('famille');
    const periode = params.get('periode');
    if (famille === null) return PROFILE_PATH;
    if (params.get('activite') !== null) next.set('famille', famille);
    if (periode !== null) next.set('periode', periode);
    const query = next.toString();
    return query === '' ? '/statistiques' : `/statistiques?${query}`;
  }
  return PROFILE_PATH;
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
