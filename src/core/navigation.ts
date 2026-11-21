import { t } from './i18n';
import { PLAN_PATH, PROFILE_PATH, ROUTES_LIST_PATH, SESSIONS_PATH } from './parentPage';

/**
 * Destinations des barres de navigation, dans leur ordre : la barre du bas du téléphone (le rail à gauche sur
 * téléphone tourné) et la barre du haut de l'ordinateur. Le cadre (`components/AppShell.tsx`) y ajoute les icônes et
 * le bouton rond ; l'ordre ne se décide qu'ici.
 */

/** Identifiant d'une destination, qui choisit son icône dans le cadre. */
export type NavId = 'profil' | 'sessions' | 'planifier' | 'statistiques' | 'reglages';

export interface NavDestination {
  id: NavId;
  to: string;
  label: string;
}

/** Page Enregistrer : le bouton rond du bas, le bouton vert « Enregistrer » du haut. */
export const RECORD_PATH = '/enregistrer';

const PROFIL: NavDestination = { id: 'profil', to: PROFILE_PATH, label: t('Profil') };
const SESSIONS: NavDestination = { id: 'sessions', to: SESSIONS_PATH, label: t('Sessions') };
/** Ouvre la liste des itinéraires planifiés, d'où partent un itinéraire rangé et « Planifier », pas un parcours neuf. */
const PLANIFIER: NavDestination = { id: 'planifier', to: ROUTES_LIST_PATH, label: t('Planification') };
const STATISTIQUES: NavDestination = { id: 'statistiques', to: '/statistiques', label: t('Statistiques') };
const REGLAGES: NavDestination = { id: 'reglages', to: '/parametres', label: t('Réglages') };

/** Barre du bas et rail : deux cases, le bouton rond, deux cases. Planifier s'ouvre depuis la liste des itinéraires, que Sessions ouvre par « Planification ». */
export const TAB_BAR: { before: readonly NavDestination[]; after: readonly NavDestination[] } = {
  before: [PROFIL, SESSIONS],
  after: [STATISTIQUES, REGLAGES],
};

/** Barre du haut : les liens, puis le bouton vert « Enregistrer » à droite. */
export const TOP_LINKS: readonly NavDestination[] = [PROFIL, SESSIONS, PLANIFIER, STATISTIQUES, REGLAGES];

/**
 * Case allumée hors de sa propre page (et de celles sous son adresse) : Sessions sur l'analyse d'une session, ouverte
 * depuis sa liste ; Planifier, qui mène à la liste des itinéraires, sur la page Planifier elle-même.
 */
export const alsoActiveOn = (id: NavId, pathname: string): boolean =>
  (id === 'sessions' && /^\/(?:voile|surf)\/analyse\/?$/.test(pathname))
  || (id === 'planifier' && pathname.replace(/\/+$/, '') === PLAN_PATH);
