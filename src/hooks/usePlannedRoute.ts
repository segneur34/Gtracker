import { useCallback, useReducer } from 'react';
import { plannedRouteReducer, type Edit, type PlannedRouteState } from '../planning/plannedRouteReducer';
import {
  EMPTY_ROUTE, addWaypoint, closeLoop, insertWaypoint, moveWaypoint, removeWaypoint, reorderWaypoint, reverseRoute,
  type PlannedRoute, type Waypoint,
} from '../planning/route';

/**
 * Itinéraire en cours de planification : les modifications de l'utilisateur
 * et leur annulation (« Précédent »). Rien ne se calcule : les balises sont
 * reliées en ligne droite, une trace chargée est gardée telle quelle.
 */
export const usePlannedRoute = () => {
  const [{ route, history }, dispatch] = useReducer(
    plannedRouteReducer,
    null,
    (): PlannedRouteState => ({ route: EMPTY_ROUTE, history: [] })
  );

  const edit = useCallback((change: Edit) => dispatch({ type: 'edit', change }), []);

  return {
    route,
    canUndo: history.length > 0,
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    /**
     * Nouvel itinéraire (ouvert, chargé d'un GPX, effacé pour repartir) :
     * l'annulation repart de zéro, l'itinéraire est pris tel quel.
     */
    replace: useCallback((next: PlannedRoute) => dispatch({ type: 'replace', route: next }), []),
    add: useCallback((w: Waypoint) => edit((r) => addWaypoint(r, w)), [edit]),
    insert: useCallback((legIndex: number, w: Waypoint) => edit((r) => insertWaypoint(r, legIndex, w)), [edit]),
    move: useCallback((index: number, w: Waypoint) => edit((r) => moveWaypoint(r, index, w)), [edit]),
    remove: useCallback((index: number) => edit((r) => removeWaypoint(r, index)), [edit]),
    reorder: useCallback((from: number, to: number) => edit((r) => reorderWaypoint(r, from, to)), [edit]),
    reverse: useCallback(() => edit(reverseRoute), [edit]),
    /** « Boucler » : un dernier tronçon, en ligne droite, ramène au départ. */
    closeLoop: useCallback(() => edit(closeLoop), [edit]),
    clear: useCallback(() => edit(() => EMPTY_ROUTE), [edit]),
  };
};
