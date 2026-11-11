import { describe, expect, it } from 'vitest';
import { EMPTY_ROUTE, addWaypoint, closeLoop, isLooped, removeWaypoint, type Waypoint } from './route';
import { plannedRouteReducer, type PlannedRouteAction, type PlannedRouteState } from './plannedRouteReducer';

const A: Waypoint = { lat: 43.6, lon: 3.8 };
const B: Waypoint = { lat: 43.61, lon: 3.8 };
const C: Waypoint = { lat: 43.62, lon: 3.8 };

const start: PlannedRouteState = { route: EMPTY_ROUTE, history: [] };

const run = (state: PlannedRouteState, actions: PlannedRouteAction[]): PlannedRouteState => actions.reduce(plannedRouteReducer, state);

const add = (w: Waypoint): PlannedRouteAction => ({ type: 'edit', change: (r) => addWaypoint(r, w) });

describe('état de la planification', () => {
  it('chaque modification entre dans l\'annulation, « Précédent » rend l\'itinéraire d\'avant', () => {
    const placed = run(start, [add(A), add(B), add(C)]);
    expect(placed.route.waypoints).toEqual([A, B, C]);
    expect(placed.history).toHaveLength(3);
    const undone = plannedRouteReducer(placed, { type: 'undo' });
    expect(undone.route.waypoints).toEqual([A, B]);
    expect(undone.history).toHaveLength(2);
  });

  it('une modification sans effet ne fait pas d\'étape', () => {
    const placed = run(start, [add(A)]);
    expect(plannedRouteReducer(placed, { type: 'edit', change: (r) => closeLoop(r) })).toBe(placed);
    expect(plannedRouteReducer(start, { type: 'undo' })).toBe(start);
  });

  it('boucler puis retirer le seul point de l\'aller laisse le départ seul ; « Précédent » rend la boucle', () => {
    const looped = run(start, [add(A), add(B), { type: 'edit', change: (r) => closeLoop(r) }]);
    expect(isLooped(looped.route)).toBe(true);
    const removed = plannedRouteReducer(looped, { type: 'edit', change: (r) => removeWaypoint(r, 1) });
    expect(removed.route).toEqual({ waypoints: [A], legs: [] });
    expect(plannedRouteReducer(removed, { type: 'undo' }).route).toBe(looped.route);
  });

  it('un nouvel itinéraire repart sans annulation', () => {
    const placed = run(start, [add(A), add(B)]);
    const next = addWaypoint(addWaypoint(EMPTY_ROUTE, C), A);
    const replaced = plannedRouteReducer(placed, { type: 'replace', route: next });
    expect(replaced.route).toBe(next);
    expect(replaced.history).toHaveLength(0);
  });
});
