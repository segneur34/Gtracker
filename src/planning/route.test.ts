import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOOP_CLOSE_M, EMPTY_ROUTE, addWaypoint, closeLoop, courseLegs, insertWaypoint, isLooped, moveWaypoint, newLeg, readRouteMode,
  removeWaypoint, reorderWaypoint, reverseRoute, routeFromTrack, routePoints, routeTotals, setLegMode, waypointDistances,
  type PlannedRoute, type RoutePoint, type Waypoint,
} from './route';

const A: Waypoint = { lat: 43.6, lon: 3.8 };
const B: Waypoint = { lat: 43.61, lon: 3.8 };
const C: Waypoint = { lat: 43.62, lon: 3.8 };
const D: Waypoint = { lat: 43.63, lon: 3.8 };

/** Un degré de latitude fait un peu plus de 111 km : 0,01° ≈ 1 112 m. */
const STEP_M = 1112;

const build = (points: Waypoint[]): PlannedRoute => points.reduce((route, p) => addWaypoint(route, p), EMPTY_ROUTE);

describe('édition d\'un parcours de balises', () => {
  it('ajoute des balises reliées en ligne droite, prêtes tout de suite', () => {
    const route = build([A, B, C]);
    expect(route.waypoints).toEqual([A, B, C]);
    expect(route.legs).toEqual([newLeg(A, B), newLeg(B, C)]);
    expect(route.legs[0]).toEqual({ mode: 'straight', status: 'ready', points: [A, B] });
  });

  it('insère une balise : le bord coupé devient deux bords, les autres restent', () => {
    const route = build([A, C, D]);
    const inserted = insertWaypoint(route, 0, B);
    expect(inserted.waypoints).toEqual([A, B, C, D]);
    expect(inserted.legs.map((l) => l.points)).toEqual([[A, B], [B, C], [C, D]]);
    expect(inserted.legs[2]).toBe(route.legs[1]);
  });

  it('déplace une balise : seuls ses deux bords sont refaits', () => {
    const route = build([A, B, C, D]);
    const target = { lat: 43.612, lon: 3.81 };
    const moved = moveWaypoint(route, 1, target);
    expect(moved.legs[0].points).toEqual([A, target]);
    expect(moved.legs[1].points).toEqual([target, C]);
    expect(moved.legs[2]).toBe(route.legs[2]);
  });

  it('retire une balise au bout ou au milieu', () => {
    const route = build([A, B, C, D]);
    expect(removeWaypoint(route, 0).legs).toEqual(route.legs.slice(1));
    expect(removeWaypoint(route, 3).legs).toEqual(route.legs.slice(0, 2));
    const middle = removeWaypoint(route, 1);
    expect(middle.waypoints).toEqual([A, C, D]);
    expect(middle.legs[0].points).toEqual([A, C]);
    expect(middle.legs[1]).toBe(route.legs[2]);
    expect(removeWaypoint(build([A]), 0)).toEqual(EMPTY_ROUTE);
  });

  it('inverse le sens', () => {
    const reversed = reverseRoute(build([A, B, C]));
    expect(reversed.waypoints).toEqual([C, B, A]);
    expect(reversed.legs.map((l) => l.points)).toEqual([[C, B], [B, A]]);
  });

  it('boucle : un dernier bord ramène au départ, une seule fois', () => {
    const loop = closeLoop(build([A, B]));
    expect(loop.waypoints).toEqual([A, B, A]);
    expect(loop.legs[1]).toEqual({ mode: 'straight', status: 'ready', points: [B, A] });
    expect(isLooped(loop)).toBe(true);
    expect(closeLoop(loop)).toBe(loop);
    expect(isLooped(build([A, B]))).toBe(false);
    expect(closeLoop(build([A])).waypoints).toEqual([A]);
  });

  it('sur une boucle, déplacer le départ déplace l\'arrivée : la boucle reste fermée', () => {
    const loop = closeLoop(build([A, B, C]));
    const moved = moveWaypoint(loop, 0, D);
    expect(moved.waypoints).toEqual([D, B, C, D]);
    expect(moved.legs[1]).toBe(loop.legs[1]);
    expect(isLooped(moved)).toBe(true);
  });

  it('réordonne : bords inchangés gardés, les autres refaits', () => {
    const route = build([A, B, C, D]);
    const moved = reorderWaypoint(route, 3, 1); // D passe en deuxième : A, D, B, C
    expect(moved.waypoints).toEqual([A, D, B, C]);
    expect(moved.legs.map((l) => l.points)).toEqual([[A, D], [D, B], [B, C]]);
    expect(moved.legs[2]).toBe(route.legs[1]);
    expect(reorderWaypoint(route, 1, 1)).toBe(route);
    expect(reorderWaypoint(route, 0, 9)).toBe(route);
  });
});

describe('distances et bords', () => {
  it('compte la distance le long du tracé, jonctions une seule fois', () => {
    const route = build([A, B, C]);
    expect(routePoints(route)).toHaveLength(3);
    const { distanceM } = routeTotals(route);
    expect(distanceM).toBeGreaterThan(2 * STEP_M * 0.99);
    expect(distanceM).toBeLessThan(2 * STEP_M * 1.01);
    expect(routeTotals(EMPTY_ROUTE).distanceM).toBe(0);
  });

  it('donne la distance depuis le départ et la longueur du bord d\'arrivée de chaque balise', () => {
    const d = waypointDistances(build([A, B, C]));
    expect(d[0]).toEqual({ cumulativeM: 0, legM: 0 });
    expect(d[1].legM).toBeCloseTo(STEP_M, -1);
    expect(d[2].cumulativeM).toBeCloseTo(2 * STEP_M, -1);
  });

  it('donne distance et cap de chaque bord, de balise en balise', () => {
    const east: Waypoint = { lat: 43.61, lon: 3.81 };
    const legs = courseLegs(build([A, B, east]));
    expect(legs).toHaveLength(2);
    expect(legs[0].distanceM).toBeCloseTo(STEP_M, -1);
    expect(legs[0].bearingDeg).toBeCloseTo(0, 3);
    expect(legs[1].bearingDeg).toBeCloseTo(90, 0);
    expect(courseLegs(EMPTY_ROUTE)).toEqual([]);
  });
});

describe('retrait d\'une balise entre deux balises confondues', () => {
  it('A → B → A privé de B est le seul A', () => {
    expect(removeWaypoint(closeLoop(build([A, B])), 1)).toEqual({ waypoints: [A], legs: [] });
  });

  it('au milieu d\'un parcours, les deux voisines fusionnent et les bords d\'après restent', () => {
    const route = build([A, B, A, C]);
    const removed = removeWaypoint(route, 1);
    expect(removed.waypoints).toEqual([A, C]);
    expect(removed.legs).toEqual([route.legs[2]]);
  });
});

describe('trace importée', () => {
  /** Trace de A vers le nord, puis vers l'est : cinq points. */
  const track: RoutePoint[] = [
    A,
    { lat: 43.605, lon: 3.8 },
    B,
    { lat: 43.61, lon: 3.805 },
    { lat: 43.61, lon: 3.81 },
  ];
  const END: Waypoint = { lat: 43.61, lon: 3.81 };

  it('garde la trace entière entre le départ et l\'arrivée, points répétés retirés', () => {
    const route = routeFromTrack([track[0], track[1], track[1], track[2], track[3], track[4]])!;
    expect(route.waypoints).toEqual([A, END]);
    expect(route.legs).toEqual([{ mode: 'imported', status: 'ready', points: track }]);
    expect(isLooped(route)).toBe(false);
  });

  it('rend des points sans altitude, même lue dans le GPX', () => {
    const withEle = track.map((p, i) => ({ ...p, eleM: 10 * i }));
    const route = routeFromTrack(withEle)!;
    expect(route.legs[0].points).toEqual(track);
    expect(routePoints(route).every((p) => !('eleM' in p))).toBe(true);
  });

  it('écarte les positions illisibles, et rend null sous deux points distincts', () => {
    expect(routeFromTrack([A, { lat: NaN, lon: 3.8 }, B])!.legs[0].points).toEqual([A, B]);
    expect(routeFromTrack([A, A])).toBeNull();
    expect(routeFromTrack([])).toBeNull();
  });

  it('une trace qui revient près de son départ est une boucle, fermée exactement au départ', () => {
    // Retour à une vingtaine de mètres du départ.
    const back = { lat: 43.6002, lon: 3.8 };
    const route = routeFromTrack([...track, { lat: 43.605, lon: 3.81 }, back])!;
    expect(isLooped(route)).toBe(true);
    expect(route.waypoints).toHaveLength(3);
    expect(route.waypoints[0]).toEqual(A);
    expect(route.legs.every((l) => l.mode === 'imported' && l.status === 'ready')).toBe(true);
    const all = routePoints(route);
    expect(all[all.length - 1]).toEqual(A);
    // Rien de perdu : tous les points de la trace sont dans l'itinéraire, dans l'ordre.
    expect(all.slice(0, -1)).toEqual([...track, { lat: 43.605, lon: 3.81 }, back]);
    // Au-delà du seuil, pas de boucle.
    expect(isLooped(routeFromTrack([...track, { lat: 43.605, lon: 3.81 }, back], { loopCloseM: 10 })!)).toBe(false);
    expect(DEFAULT_LOOP_CLOSE_M).toBeGreaterThan(20);
  });

  it('insérer une balise la pose sur la trace et la coupe sans rien perdre', () => {
    const route = routeFromTrack(track)!;
    // Touché à une vingtaine de mètres à l'ouest du milieu du premier segment.
    const cut = insertWaypoint(route, 0, { lat: 43.6025, lon: 3.7998 });
    expect(cut.waypoints).toHaveLength(3);
    expect(cut.waypoints[1].lon).toBeCloseTo(3.8, 9);
    expect(cut.waypoints[1].lat).toBeCloseTo(43.6025, 6);
    expect(cut.legs.map((l) => l.mode)).toEqual(['imported', 'imported']);
    expect(routeTotals(cut).distanceM).toBeCloseTo(routeTotals(route).distanceM, 3);
    // Au bout de la trace, rien à couper.
    expect(insertWaypoint(route, 0, { lat: 43.59, lon: 3.8 })).toBe(route);
  });

  it('retirer la balise entre deux parts importées les recolle, tracé intact', () => {
    const route = routeFromTrack(track)!;
    const cut = insertWaypoint(route, 0, B);
    expect(cut.waypoints).toEqual([A, B, END]);
    expect(removeWaypoint(cut, 1).legs).toEqual(route.legs);
  });

  it('déplacer une balise refait ses parts importées en ligne droite, les autres restent', () => {
    const cut = insertWaypoint(routeFromTrack(track)!, 0, B);
    const target = { lat: 43.62, lon: 3.81 };
    const moved = moveWaypoint(cut, 2, target);
    expect(moved.legs[0]).toBe(cut.legs[0]);
    expect(moved.legs[1]).toEqual({ mode: 'straight', status: 'ready', points: [B, target] });
    // Retirer une balise entre une part importée et une ligne droite : ligne droite.
    const mixed = addWaypoint(routeFromTrack(track)!, C);
    expect(removeWaypoint(mixed, 1).legs[0]).toEqual({ mode: 'straight', status: 'ready', points: [A, C] });
  });

  it('inverser retourne la trace telle quelle', () => {
    const reversed = reverseRoute(routeFromTrack(track)!);
    expect(reversed.legs[0]).toEqual({ mode: 'imported', status: 'ready', points: [...track].reverse() });
  });

  it('réordonner garde une part importée dont les extrémités n\'ont pas changé', () => {
    const route = addWaypoint(routeFromTrack(track)!, C);
    const moved = reorderWaypoint(route, 2, 0);
    expect(moved.waypoints).toEqual([C, A, END]);
    expect(moved.legs[1]).toBe(route.legs[0]);
    expect(moved.legs[0]).toEqual({ mode: 'straight', status: 'ready', points: [C, A] });
  });

  it('passer une part importée en ligne droite la refait entre ses deux balises', () => {
    const route = routeFromTrack(track)!;
    expect(setLegMode(route, 0, 'straight').legs[0]).toEqual({ mode: 'straight', status: 'ready', points: [A, END] });
    expect(setLegMode(route, 0, 'imported')).toBe(route);
  });
});

describe('mode relu d\'une fiche', () => {
  it('ligne droite et trace importée seulement ; un mode d\'avant le lot 304 est inconnu', () => {
    expect(readRouteMode('straight')).toBe('straight');
    expect(readRouteMode('imported')).toBe('imported');
    for (const old of ['sentier', 'route+grandeRoute', 'foot', 'chemin', 'toString', '', undefined]) expect(readRouteMode(old)).toBeNull();
  });
});
