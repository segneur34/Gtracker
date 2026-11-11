import { describe, expect, it } from 'vitest';
import { FILE_FORMATS } from '../core/appIdentity';
import { addWaypoint, routeFromTrack, type PlannedRoute } from './route';
import { buildRouteGpx, waypointLabel } from './routeGpx';
import { MARK_GUIDE_DEFAULTS } from '../recording/markGuide';
import {
  ROUTE_VERSION, isWritableRouteRecord, parseRouteRecord, recordToRoute, routeFileBase, routeMarkGuide, routeToRecord, serializeRouteRecord,
  type RouteRecord,
} from './routeRecord';

const A = { lat: 43.6, lon: 3.8 };
const B = { lat: 43.61, lon: 3.8 };
const C = { lat: 43.62, lon: 3.81 };

/** A → B par une trace importée (trois points), B → C en ligne droite. */
const sample = (): PlannedRoute => {
  const imported = routeFromTrack([A, { lat: 43.605, lon: 3.8012345678 }, B])!;
  return addWaypoint(imported, C);
};

const META = { name: 'Tour du Pic', activityId: 'a-kite', createdAt: '2026-09-25T10:00:00.000Z', updatedAt: '2026-09-25T11:00:00.000Z' };

describe('fiche d\'itinéraire', () => {
  it('fait l\'aller-retour : trace importée et ligne droite gardées, points arrondis', () => {
    const route = sample();
    const record = parseRouteRecord(serializeRouteRecord(routeToRecord(route, META)))!;
    expect(record).toMatchObject({ name: 'Tour du Pic', activityId: 'a-kite', version: ROUTE_VERSION });
    expect(ROUTE_VERSION).toBe(4);
    const back = recordToRoute(record);
    expect(back.waypoints).toEqual([A, B, C]);
    expect(back.legs[0]).toMatchObject({ mode: 'imported', status: 'ready' });
    expect(back.legs[0].points[1]).toEqual({ lat: 43.605, lon: 3.8012346 });
    expect(back.legs[1]).toEqual({ mode: 'straight', status: 'ready', points: [B, C] });
    // Points rangés en [lat, lon], sans altitude.
    expect(record.legs.every((leg) => leg.points.every((p) => p.length === 2))).toBe(true);
  });

  it('garde les champs inconnus et ne réécrit pas une fiche d\'une version future', () => {
    const text = JSON.stringify({ ...routeToRecord(sample(), META), version: ROUTE_VERSION + 1, couleur: 'rouge' });
    const record = parseRouteRecord(text)!;
    expect(record.couleur).toBe('rouge');
    expect(isWritableRouteRecord(record)).toBe(false);
    expect(routeToRecord(sample(), META, record).couleur).toBe('rouge');
  });

  it('range les bips propres au parcours, les garde au renommage, les retire sur demande', () => {
    const guide = { curve: [{ distanceM: 30, intervalMs: 200 }, { distanceM: 120, intervalMs: 1500 }], vibrate: false };
    const record = parseRouteRecord(serializeRouteRecord(routeToRecord(sample(), { ...META, markGuide: guide })))!;
    expect(routeMarkGuide(record)).toEqual(guide);
    // Sans `markGuide` (renommage), ceux de la fiche relue restent.
    expect(routeMarkGuide(routeToRecord(sample(), META, record))).toEqual(guide);
    const cleared = routeToRecord(sample(), { ...META, markGuide: null }, record);
    expect(cleared).not.toHaveProperty('markGuide');
    expect(routeMarkGuide(cleared)).toBeNull();
    // Illisibles : ceux de l'activité.
    expect(routeMarkGuide({ ...record, markGuide: { curve: 'non' } })).toBeNull();
    expect(routeMarkGuide({ ...record, markGuide: MARK_GUIDE_DEFAULTS })).toEqual(MARK_GUIDE_DEFAULTS);
  });

  it('refuse ce qui n\'est pas une fiche d\'itinéraire', () => {
    expect(parseRouteRecord('pas du json')).toBeNull();
    expect(parseRouteRecord(JSON.stringify({ format: FILE_FORMATS.session, version: 1 }))).toBeNull();
    expect(parseRouteRecord(JSON.stringify({ format: FILE_FORMATS.itineraire, version: 1, waypoints: [{ lat: 'x' }] }))).toBeNull();
  });

  it('garde une trace importée telle quelle ; illisible, elle devient une ligne droite', () => {
    const route = routeFromTrack([A, { lat: 43.605, lon: 3.801 }, B])!;
    const record = parseRouteRecord(serializeRouteRecord(routeToRecord(route, META)))!;
    expect(recordToRoute(record)).toEqual(route);
    const broken = recordToRoute({ ...record, legs: [{ mode: 'imported', points: [] }] });
    expect(broken.legs[0]).toEqual({ mode: 'straight', status: 'ready', points: [A, B] });
  });

  it('un mode inconnu (type de voie d\'avant le lot 304) se relit en ligne droite neuve, tracé laissé', () => {
    const old = JSON.parse(serializeRouteRecord(routeToRecord(sample(), META))) as { legs: { mode: string; points: number[][] }[] };
    old.legs[0].mode = 'sentier';
    old.legs[1].mode = 'foot';
    old.legs[1].points = [[B.lat, B.lon], [43.615, 3.805], [C.lat, C.lon]];
    const parsed = parseRouteRecord(JSON.stringify(old))!;
    expect(parsed.legs.map((leg) => leg.mode)).toEqual(['straight', 'straight']);
    const back = recordToRoute(parsed);
    expect(back.legs).toEqual([
      { mode: 'straight', status: 'ready', points: [A, B] },
      { mode: 'straight', status: 'ready', points: [B, C] },
    ]);
    // Lue sans `parseRouteRecord`, même effet.
    const unread = { ...routeToRecord(sample(), META), legs: [{ mode: 'route', points: [[A.lat, A.lon], [43.605, 3.81], [B.lat, B.lon]] }] };
    expect(recordToRoute({ ...unread, waypoints: [A, B] } as unknown as RouteRecord).legs).toEqual([{ mode: 'straight', status: 'ready', points: [A, B] }]);
  });

  it('une fiche de version 3 avec un tronçon calculé et des points à altitude se relit modifiable, en lignes droites, et se réécrit en version 4', () => {
    const v3 = {
      format: FILE_FORMATS.itineraire, version: 3, name: 'Essai 0.00.13', activityId: 'wingfoil', loop: true,
      createdAt: META.createdAt, updatedAt: META.updatedAt,
      waypoints: [A, B, C],
      legs: [
        { mode: 'route+grandeRoute', points: [[A.lat, A.lon, 12.5], [43.605, 3.802, 14], [B.lat, B.lon, 15]], surfaces: { tags: ['x'], runs: [[0, 0]] } },
        { mode: 'straight', pending: true, points: [[B.lat, B.lon, 15], [C.lat, C.lon, 9]] },
      ],
    };
    const record = parseRouteRecord(JSON.stringify(v3))!;
    expect(record).not.toBeNull();
    expect(isWritableRouteRecord(record)).toBe(true);
    const route = recordToRoute(record);
    expect(route.legs).toEqual([
      { mode: 'straight', status: 'ready', points: [A, B] },
      { mode: 'straight', status: 'ready', points: [B, C] },
    ]);
    const rewritten = parseRouteRecord(serializeRouteRecord(routeToRecord(route, META, record)))!;
    expect(rewritten.version).toBe(4);
    expect(rewritten.legs.every((leg) => leg.mode === 'straight' && leg.points.every((p) => p.length === 2))).toBe(true);
  });

  it('refuse la fiche d\'itinéraire de l\'autre application', () => {
    const other = FILE_FORMATS.itineraire.slice(1);
    const text = serializeRouteRecord(routeToRecord(sample(), META)).replace(FILE_FORMATS.itineraire, other);
    expect(text).toContain(`"${other}"`);
    expect(parseRouteRecord(text)).toBeNull();
  });

  it('un point rangé avec son altitude se relit sans elle', () => {
    const record = routeToRecord(sample(), META);
    const withEle = { ...record, legs: [{ mode: 'imported' as const, points: [[A.lat, A.lon, 120.5], [43.605, 3.8, 130], [B.lat, B.lon, 110]] }, record.legs[1]] };
    const back = recordToRoute(parseRouteRecord(JSON.stringify(withEle))!);
    expect(back.legs[0].points).toEqual([A, { lat: 43.605, lon: 3.8 }, B]);
    expect(back.legs[0].points.every((p) => !('eleM' in p))).toBe(true);
  });

  it('refait en ligne droite des tronçons qui ne correspondent plus aux points', () => {
    const record = routeToRecord(sample(), META);
    const route = recordToRoute({ ...record, legs: record.legs.slice(1) });
    expect(route.legs.map((l) => l.mode)).toEqual(['straight', 'straight']);
    expect(route.legs[0].points).toEqual([A, B]);
  });

  it('nomme le fichier d\'après l\'itinéraire, sans caractère interdit ni doublon', () => {
    expect(routeFileBase('Tour du Pic', [])).toBe('Tour du Pic');
    expect(routeFileBase('A/B : aller?', [])).toBe('A B aller');
    expect(routeFileBase('Tour du Pic', ['tour du pic.json', 'Tour du Pic.gpx', 'Tour du Pic-2.json'])).toBe('Tour du Pic-3');
    expect(routeFileBase(' ... ', [])).toBe('itineraire');
  });
});

describe('GPX d\'itinéraire', () => {
  const gpx = buildRouteGpx(sample(), 'Tour & retour');

  it('porte les points de passage et la trace d\'un seul segment, sans heure ni altitude', () => {
    expect(gpx).toContain('<wpt lat="43.6" lon="3.8"><name>A</name></wpt>');
    expect(gpx.match(/<wpt /g)).toHaveLength(3);
    expect(gpx.match(/<trkseg>/g)).toHaveLength(1);
    // A, point intermédiaire, B (jonction une seule fois), C.
    expect(gpx.match(/<trkpt /g)).toHaveLength(4);
    expect(gpx).toContain('<trkpt lat="43.605" lon="3.8012346"></trkpt>');
    expect(gpx).not.toContain('<time>');
    expect(gpx).not.toContain('<ele>');
    expect(gpx).toContain('<name>Tour &amp; retour</name>');
  });

  it('une trace chargée avec son altitude ressort sans <ele>', () => {
    const track: { lat: number; lon: number; eleM: number }[] = [{ ...A, eleM: 10 }, { lat: 43.605, lon: 3.801, eleM: 15 }, { ...B, eleM: 20 }];
    const route = routeFromTrack(track)!;
    expect(buildRouteGpx(route, 'Trace')).not.toContain('<ele>');
  });

  it('nomme les points A, B… puis A2 après Z', () => {
    expect(waypointLabel(0)).toBe('A');
    expect(waypointLabel(25)).toBe('Z');
    expect(waypointLabel(26)).toBe('A2');
  });
});
