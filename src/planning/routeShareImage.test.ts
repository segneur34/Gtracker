import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS_M } from '../core/geo';
import { EMPTY_ROUTE, addWaypoint, closeLoop, routeFromTrack, type PlannedRoute, type Waypoint } from './route';
import {
  placeLegPills, routeImageDescription, routeShareContent, routeShareStats, PILL_GAP_PX, type PlacedPill, type PillFrame,
} from './routeShareImage';

/** Point à `distanceM` de `from` au cap `bearingDeg`, sur une sphère (assez juste à quelques kilomètres). */
const toward = (from: Waypoint, distanceM: number, bearingDeg: number): Waypoint => {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = ((distanceM * Math.cos(rad)) / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLon = ((distanceM * Math.sin(rad)) / (EARTH_RADIUS_M * Math.cos((from.lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: from.lat + dLat, lon: from.lon + dLon };
};

const build = (points: Waypoint[]): PlannedRoute => points.reduce((route, p) => addWaypoint(route, p), EMPTY_ROUTE);

const A: Waypoint = { lat: 43.53, lon: 3.97 };
const B = toward(A, 1600, 65);
const C = toward(B, 1980, 133);
const triangle = build([A, B, C]);

describe("contenu de l'image d'un itinéraire", () => {
  it('numérote les balises, départ et arrivée compris, et annote chaque bord de sa distance et de son cap', () => {
    const content = routeShareContent(triangle, 'km');
    expect(content.marks.map((m) => [m.label, m.role])).toEqual([['1', 'start'], ['2', 'mark'], ['3', 'end']]);
    expect(content.pills.map((p) => [p.from, p.to, p.text])).toEqual([['1', '2', '1,60 km · 65°'], ['2', '3', '1,98 km · 133°']]);
    expect(content.paths).toHaveLength(2);
  });

  it('pose la pastille au milieu du bord', () => {
    const [pill] = routeShareContent(triangle, 'km').pills;
    expect(pill.anchor.lat).toBeCloseTo((A.lat + B.lat) / 2, 9);
    expect(pill.anchor.lon).toBeCloseTo((A.lon + B.lon) / 2, 9);
    expect([pill.before, pill.after]).toEqual([A, B]);
  });

  it('écrit un cap de 359,6° comme 0°', () => {
    const route = build([A, toward(A, 1000, 359.6)]);
    expect(routeShareContent(route, 'km').pills[0].text).toBe('1,00 km · 0°');
  });

  it("une boucle n'a qu'une balise au départ, qui est aussi l'arrivée, et son dernier bord y revient", () => {
    const content = routeShareContent(closeLoop(triangle), 'km');
    expect(content.marks.map((m) => [m.label, m.role])).toEqual([['1', 'loop'], ['2', 'mark'], ['3', 'mark']]);
    expect(content.pills.map((p) => `${p.from} → ${p.to}`)).toEqual(['1 → 2', '2 → 3', '3 → 1']);
    expect(routeShareStats(closeLoop(triangle), 'km')[1].value).toBe('3');
  });

  it("un tronçon tiré d'une trace porte sa distance le long de la trace, sans cap", () => {
    // Un arc : 1 km vers le nord, puis 1 km vers l'est.
    const north = toward(A, 1000, 0);
    const route = routeFromTrack([A, toward(A, 500, 0), north, toward(north, 500, 90), toward(north, 1000, 90)])!;
    const content = routeShareContent(route, 'km');
    expect(content.pills.map((p) => p.text)).toEqual(['2,00 km']);
    // Le milieu de la trace est le coin, pas le milieu de la corde.
    expect(content.pills[0].anchor.lat).toBeCloseTo(north.lat, 6);
    expect(content.pills[0].anchor.lon).toBeCloseTo(north.lon, 6);
  });

  it("n'annote pas un bord sans longueur", () => {
    expect(routeShareContent(build([A, A]), 'km').pills).toEqual([]);
  });

  it('écrit les distances dans l\'unité de l\'activité, milles nautiques compris', () => {
    const route = build([A, toward(A, 1852, 90)]);
    expect(routeShareContent(route, 'nm').pills[0].text).toBe('1,00 NM · 90°');
    expect(routeShareStats(route, 'nm').map((s) => s.value)).toEqual(['1,00 NM', '2', '1,00 NM']);
  });

  it('reprend les trois chiffres du bloc Parcours', () => {
    expect(routeShareStats(triangle, 'km')).toEqual([
      { key: 'distance', label: 'Distance', value: '3,58 km' },
      { key: 'balises', label: 'Balises', value: '3' },
      { key: 'plusLongBord', label: 'Plus long bord', value: '1,98 km' },
    ]);
    expect(routeShareStats(build([A]), 'km')[2].value).toBe('—');
  });

  it("décrit l'image en entier : titre, chiffres et chaque bord", () => {
    const content = routeShareContent(triangle, 'km');
    expect(routeImageDescription('Triangle', 'Wingfoil · itinéraire', content, routeShareStats(triangle, 'km'))).toBe(
      "Image de l'itinéraire « Triangle », Wingfoil · itinéraire : Distance 3,58 km, Balises 3, Plus long bord 1,98 km. "
        + 'Bords : 1 → 2 : 1,60 km · 65° ; 2 → 3 : 1,98 km · 133°.'
    );
    const single = build([A]);
    expect(routeImageDescription('Point', 'Itinéraire', routeShareContent(single, 'km'), routeShareStats(single, 'km'))).toBe(
      "Image de l'itinéraire « Point », Itinéraire : Distance 0,00 km, Balises 1, Plus long bord —."
    );
  });
});

describe('place des pastilles', () => {
  const frame: PillFrame = { left: 0, top: 180, right: 1080, bottom: 1500 };
  const pill = (x: number, y: number, dx = 1, dy = 0) => ({ x, y, dx, dy, width: 200, height: 50 });
  const overlap = (a: PlacedPill, b: PlacedPill) =>
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;

  it('laisse une pastille libre au milieu de son bord', () => {
    expect(placeLegPills([pill(500, 600)], [], frame)).toEqual([{ x: 500, y: 600, width: 200, height: 50 }]);
  });

  it('sépare les pastilles de deux bords serrés, le long de la normale du bord', () => {
    const [a, b] = placeLegPills([pill(500, 600), pill(520, 610)], [], frame);
    expect(overlap(a, b)).toBe(false);
    // Bord horizontal : la seconde ne bouge que verticalement.
    expect(b.x).toBe(520);
    expect(Math.abs(b.y - a.y)).toBeGreaterThanOrEqual(50 + PILL_GAP_PX);
  });

  it("écarte une pastille d'une balise qu'elle couvrirait", () => {
    const [placed] = placeLegPills([pill(500, 600, 0, 1)], [{ x: 520, y: 600, radius: 31 }], frame);
    // Bord vertical : écartée horizontalement, hors du carré de la balise.
    expect(placed.y).toBe(600);
    expect(Math.abs(placed.x - 520)).toBeGreaterThanOrEqual(100 + 31 + PILL_GAP_PX);
  });

  it('garde toutes les pastilles dans le cadre', () => {
    const placed = placeLegPills([pill(-40, 100), pill(1100, 1700), pill(1060, 300, 0, 1)], [], frame);
    for (const p of placed) {
      expect(p.x - p.width / 2).toBeGreaterThanOrEqual(frame.left);
      expect(p.x + p.width / 2).toBeLessThanOrEqual(frame.right);
      expect(p.y - p.height / 2).toBeGreaterThanOrEqual(frame.top);
      expect(p.y + p.height / 2).toBeLessThanOrEqual(frame.bottom);
    }
  });
});
