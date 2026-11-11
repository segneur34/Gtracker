import type { PlannedRoute } from './route';

/**
 * État de la planification et son réducteur, purs : l'itinéraire et
 * son annulation. Le hook `usePlannedRoute` y branche les éditions de la page.
 */

/** Profondeur de l'annulation. */
const HISTORY_LIMIT = 50;

export interface PlannedRouteState {
  route: PlannedRoute;
  /** Itinéraires d'avant chaque modification de l'utilisateur, le plus récent à la fin. */
  history: PlannedRoute[];
}

/** Modification de l'utilisateur. */
export type Edit = (r: PlannedRoute) => PlannedRoute;

export type PlannedRouteAction =
  /** Modification de l'utilisateur : l'itinéraire d'avant entre dans l'annulation. */
  | { type: 'edit'; change: Edit }
  | { type: 'undo' }
  /** Nouvel itinéraire (ouvert depuis la mémoire, chargé d'un GPX) : l'annulation repart de zéro, l'itinéraire est pris tel quel. */
  | { type: 'replace'; route: PlannedRoute };

/** Réducteur de l'état de la planification. */
export const plannedRouteReducer = (state: PlannedRouteState, action: PlannedRouteAction): PlannedRouteState => {
  switch (action.type) {
    case 'edit': {
      const route = action.change(state.route);
      return route === state.route ? state : { route, history: [...state.history.slice(-(HISTORY_LIMIT - 1)), state.route] };
    }
    case 'undo':
      return state.history.length === 0 ? state : { route: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
    case 'replace':
      return { route: action.route, history: [] };
  }
};
