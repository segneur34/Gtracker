// @vitest-environment node
// xmldom ne sert plus qu'au test de la lecture en un seul parcours, qui relit les points par le DOM pour comparer : le lecteur s'en passe.
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { parseGpx, parseGpxPath } from './gpxParser';

const MALFORMED = 'Fichier GPX illisible : le XML est mal formé.';

const NS = 'xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"';
const gpx = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="test" ${NS}>${body}</gpx>`;
const pt = (lat: number, lon: number, time: string | null, inner = '') =>
  `<trkpt lat="${lat}" lon="${lon}">${time ? `<time>${time}</time>` : ''}${inner}</trkpt>`;

describe('parseGpx', () => {
  it('lit position, altitude, heure et FC des extensions Garmin préfixées', () => {
    const xml = gpx(
      `<trk><name>Sortie</name><type>sailing</type><trkseg>${pt(
        45, 5, '2026-10-01T10:00:00Z', '<ele>120.5</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>152</gpxtpx:hr><gpxtpx:cad>84</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>'
      )}</trkseg></trk>`
    );
    const r = parseGpx(xml);
    expect(r.rawPoints).toHaveLength(1);
    expect(r.rawPoints[0]).toMatchObject({ lat: 45, lon: 5, time: '2026-10-01T10:00:00Z', ele: 120.5, hr: 152 });
    expect(r.trackName).toBe('Sortie');
    expect(r.trackType).toBe('sailing');
    expect(r.hasDeviceSpeed).toBe(false);
  });

  it('lit la vitesse directe de l\'extension (m/s) et le cap, et écarte les valeurs absurdes', () => {
    const xml = gpx(
      `<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z', '<extensions><speed>6.5</speed><course>270</course></extensions>')}${pt(
        45, 5.001, '2026-10-01T10:00:01Z', '<extensions><speed>-2</speed><course>400</course></extensions>'
      )}${pt(45, 5.002, '2026-10-01T10:00:02Z', '<extensions><speed>250</speed></extensions>')}</trkseg></trk>`
    );
    const r = parseGpx(xml);
    expect(r.hasDeviceSpeed).toBe(true);
    expect(r.rawPoints.map((p) => p.speedMs)).toEqual([6.5, undefined, undefined]);
    expect(r.rawPoints.map((p) => p.courseDeg)).toEqual([270, undefined, undefined]);
  });

  it('marque le premier point de chaque <trkseg> après le premier, sur un ou plusieurs <trk>', () => {
    const xml = gpx(
      `<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z')}${pt(45, 5.001, '2026-10-01T10:00:01Z')}</trkseg>` +
        `<trkseg>${pt(45, 5.002, '2026-10-01T10:05:00Z')}${pt(45, 5.003, '2026-10-01T10:05:01Z')}</trkseg></trk>` +
        `<trk><trkseg>${pt(45, 5.004, '2026-10-01T10:10:00Z')}</trkseg></trk>`
    );
    const r = parseGpx(xml);
    expect(r.rawPoints.map((p) => p.segmentStart === true)).toEqual([false, false, true, false, true]);
  });

  it('écarte un point sans heure ou sans position, sans casser la suite', () => {
    const xml = gpx(
      `<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z')}${pt(45, 5.001, null)}<trkpt lat="x" lon="5"><time>2026-10-01T10:00:02Z</time></trkpt>${pt(
        45, 5.003, '2026-10-01T10:00:03Z'
      )}</trkseg></trk>`
    );
    expect(parseGpx(xml).rawPoints.map((p) => p.lon)).toEqual([5, 5.003]);
  });

  it('un point écarté en tête d\'un segment ne fait pas perdre la reprise', () => {
    const xml = gpx(`<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z')}</trkseg><trkseg>${pt(45, 5.001, null)}${pt(45, 5.002, '2026-10-01T10:05:00Z')}</trkseg></trk>`);
    expect(parseGpx(xml).rawPoints.map((p) => p.segmentStart === true)).toEqual([false, true]);
  });

  it('garde un nom de trace et un type absents indéfinis', () => {
    const r = parseGpx(gpx(`<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z')}</trkseg></trk>`));
    expect(r.trackName).toBeUndefined();
    expect(r.trackType).toBeUndefined();
  });

  it('A-B7 : le nom d\'un point ne devient pas le nom de la trace', () => {
    const r = parseGpx(gpx(`<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z', '<name>Départ</name>')}</trkseg></trk>`));
    expect(r.trackName).toBeUndefined();
  });

  it('le nom de la trace est celui de son enfant direct, même avec un point nommé', () => {
    const r = parseGpx(gpx(`<trk><name>Sortie</name><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z', '<name>Départ</name>')}</trkseg></trk>`));
    expect(r.trackName).toBe('Sortie');
  });

  it('refuse un XML mal formé', () => {
    expect(() => parseGpx('<gpx><trk><trkseg></gpx>')).toThrow(MALFORMED);
  });

  it('un fichier vide de points rend une liste vide', () => {
    expect(parseGpx(gpx('')).rawPoints).toEqual([]);
  });
});

describe('parseGpxPath', () => {
  it('n\'exige pas l\'heure, lit l\'altitude et le nom de la trace', () => {
    const r = parseGpxPath(gpx(`<trk><name>Rando</name><trkseg>${pt(45, 5, null, '<ele>10</ele>')}${pt(45, 5.001, null)}</trkseg></trk>`));
    expect(r.points).toEqual([{ lat: 45, lon: 5, eleM: 10 }, { lat: 45, lon: 5.001 }]);
    expect(r.name).toBe('Rando');
  });

  it('se rabat sur les points de route quand la trace en a moins de deux', () => {
    const r = parseGpxPath(gpx('<rte><name>Route</name><rtept lat="45" lon="5"/><rtept lat="45" lon="5.01"/></rte>'));
    expect(r.points).toHaveLength(2);
    expect(r.name).toBe('Route');
  });

  it('refuse un XML mal formé', () => {
    expect(() => parseGpxPath('<gpx>')).toThrow(MALFORMED);
  });
});

describe('parseGpx : points sans position', () => {
  const hrPt = (time: string, bpm: number) =>
    `<trkpt><time>${time}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${bpm}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`;

  it('écarte les points à l’heure sans position, FC comprise', () => {
    const r = parseGpx(gpx(`<trk><trkseg>${hrPt('2026-10-01T10:00:00Z', 90)}${hrPt('2026-10-01T10:00:01Z', 91)}</trkseg></trk>`));
    expect(r.rawPoints).toEqual([]);
  });

  it('un GPX à positions garde ses rawPoints, reprise après pause comprise', () => {
    // `rawTimeMs` : la date lue une fois.
    const xml = gpx(`<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00Z', '<ele>3</ele>')}${pt(45, 5.001, '2026-10-01T10:00:01Z')}</trkseg>`
      + `<trkseg>${pt(45, 5.002, '2026-10-01T10:05:00Z')}</trkseg></trk>`);
    const r = parseGpx(xml);
    expect(r.rawPoints).toEqual([
      { lat: 45, lon: 5, time: '2026-10-01T10:00:00Z', rawTimeMs: Date.parse('2026-10-01T10:00:00Z'), ele: 3, speedMs: undefined, courseDeg: undefined, hr: undefined },
      { lat: 45, lon: 5.001, time: '2026-10-01T10:00:01Z', rawTimeMs: Date.parse('2026-10-01T10:00:01Z'), ele: undefined, speedMs: undefined, courseDeg: undefined, hr: undefined },
      { lat: 45, lon: 5.002, time: '2026-10-01T10:05:00Z', rawTimeMs: Date.parse('2026-10-01T10:05:00Z'), ele: undefined, speedMs: undefined, courseDeg: undefined, hr: undefined, segmentStart: true },
    ]);
  });

  it('date lue une fois : rawTimeMs vaut la date relue ; un point à la date illisible est écarté (C2-2)', () => {
    const r = parseGpx(gpx(`<trk><trkseg>${pt(45, 5, '2026-10-01T10:00:00.123+02:00')}${pt(45, 5.001, 'pas une date')}${pt(45, 5.002, '20261001T100002Z')}${pt(45, 5.003, '2026-10-01T10:00:03Z')}</trkseg></trk>`));
    expect(r.rawPoints.map((p) => p.lon)).toEqual([5, 5.003]);
    expect(r.rawPoints.map((p) => p.rawTimeMs)).toEqual(r.rawPoints.map((p) => new Date(p.time).getTime()));
    expect(r.rawPoints.every((p) => isFinite(p.rawTimeMs!))).toBe(true);
  });
});

describe('parseGpx : la trace ne remonte jamais le temps', () => {
  const T = (s: number) => `2026-10-01T10:00:${String(s).padStart(2, '0')}Z`;

  it('écarte un point daté avant le dernier gardé, et garde une date égale (répartie ensuite par spreadEqualTimes)', () => {
    // Dates 0, 1, 2, 1 (recule), 3, 3 (égale), 4.
    const xml = gpx(`<trk><trkseg>${pt(45, 5.000, T(0))}${pt(45, 5.001, T(1))}${pt(45, 5.002, T(2))}${pt(45, 5.003, T(1))}${pt(45, 5.004, T(3))}${pt(45, 5.005, T(3))}${pt(45, 5.006, T(4))}</trkseg></trk>`);
    const r = parseGpx(xml);
    expect(r.rawPoints.map((p) => p.lon)).toEqual([5, 5.001, 5.002, 5.004, 5.005, 5.006]);
    expect(r.rawPoints.map((p) => p.rawTimeMs)).toEqual([0, 1, 2, 3, 3, 4].map((s) => Date.parse(T(s))));
  });

  it('deux points permutés : le second, daté avant, est écarté ; la suite reprend', () => {
    const xml = gpx(`<trk><trkseg>${pt(45, 5.000, T(0))}${pt(45, 5.002, T(2))}${pt(45, 5.001, T(1))}${pt(45, 5.003, T(3))}</trkseg></trk>`);
    expect(parseGpx(xml).rawPoints.map((p) => p.lon)).toEqual([5, 5.002, 5.003]);
  });

  it('un point écarté pour sa date en tête d’un segment ne fait pas perdre la reprise', () => {
    const xml = gpx(`<trk><trkseg>${pt(45, 5, T(5))}</trkseg><trkseg>${pt(45, 5.001, T(4))}${pt(45, 5.002, T(9))}</trkseg></trk>`);
    const r = parseGpx(xml);
    expect(r.rawPoints.map((p) => p.lon)).toEqual([5, 5.002]);
    expect(r.rawPoints.map((p) => p.segmentStart === true)).toEqual([false, true]);
  });
});

describe('parseGpx : un seul parcours des descendants par point', () => {
  /** Copie gelée de la recherche d'avant son remplacement : nom qualifié, sinon premier descendant de ce nom local, champ par champ. */
  const frozenFind = (element: Element, localName: string): Element | null => {
    const direct = element.getElementsByTagName(localName)[0];
    if (direct) return direct;
    const all = element.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) if (all[i].localName === localName) return all[i];
    return null;
  };
  const frozenNumber = (element: Element, name: string): number | undefined => {
    const node = frozenFind(element, name);
    if (!node || node.textContent === null) return undefined;
    const value = parseFloat(node.textContent.trim());
    return isFinite(value) ? value : undefined;
  };

  it('mêmes champs que la recherche champ par champ : préfixes, doublons, nom qualifié imbriqué, champ illisible', () => {
    const inners = [
      '<ele>3</ele><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr><gpxtpx:cad>80</gpxtpx:cad><gpxtpx:speed>4.5</gpxtpx:speed><gpxtpx:course>91</gpxtpx:course></gpxtpx:TrackPointExtension></extensions>',
      // Un champ préfixé avant le même sans préfixe, imbriqué : le nom qualifié l'emporte.
      '<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr><x><hr>141</hr></x></gpxtpx:TrackPointExtension></extensions><ele>7</ele>',
      // Deux champs préfixés : le premier ; un premier illisible ne cède pas au suivant.
      '<extensions><gpxdata:speed xmlns:gpxdata="urn:x">abc</gpxdata:speed><gpxtpx:speed>5</gpxtpx:speed><a:cad xmlns:a="urn:a">70</a:cad><b:cad xmlns:b="urn:b">71</b:cad></extensions>',
      '<speed>6.2</speed><course>400</course><ele> 12.5 </ele>',
      '<extensions><gpxtpx:TrackPointExtension><gpxtpx:speed>3</gpxtpx:speed></gpxtpx:TrackPointExtension><speed>2</speed></extensions>',
    ];
    const xml = gpx(`<trk><trkseg>${inners.map((inner, k) => pt(45, 5 + k * 0.001, `2026-10-01T10:00:0${k}Z`, inner)).join('')}</trkseg></trk>`);
    const r = parseGpx(xml);
    const trkpts = new XmlDomParser().parseFromString(xml, 'application/xml').getElementsByTagName('trkpt');
    expect(r.rawPoints).toHaveLength(inners.length);
    r.rawPoints.forEach((p, k) => {
      const trkpt = trkpts[k] as unknown as Element;
      const speed = frozenNumber(trkpt, 'speed');
      const course = frozenNumber(trkpt, 'course');
      expect(p).toEqual({
        lat: 45, lon: 5 + k * 0.001, time: `2026-10-01T10:00:0${k}Z`, rawTimeMs: Date.parse(`2026-10-01T10:00:0${k}Z`),
        ele: frozenNumber(trkpt, 'ele'),
        speedMs: speed === undefined || speed < 0 || speed > 100 ? undefined : speed,
        courseDeg: course !== undefined && course >= 0 && course <= 360 ? course : undefined,
        hr: frozenNumber(trkpt, 'hr'),
      });
    });
    // Les cas voulus sont bien là.
    expect(r.rawPoints.map((p) => p.hr)).toEqual([150, 141, undefined, undefined, undefined]);
    expect(r.rawPoints.map((p) => p.speedMs)).toEqual([4.5, undefined, undefined, 6.2, 2]);
  });
});

describe('parseGpx : lecture du XML sans DOMParser', () => {
  const T = (s: number) => `2026-10-01T10:00:${String(s).padStart(2, '0')}Z`;
  const trk = (points: string, head = '') => gpx(`<trk>${head}<trkseg>${points}</trkseg></trk>`);

  it('décode entités et CDATA dans le nom et dans l’heure', () => {
    const r = parseGpx(trk(`<trkpt lat="45" lon="5"><time>2026-10-01T10:00:0&#48;Z</time></trkpt><trkpt lat="45" lon="5.001"><time><![CDATA[${T(1)}]]></time></trkpt>`,
      '<name>A &amp; B &lt;&#233;&#x45;&gt; &quot;&apos; <![CDATA[<c> & d]]></name>'));
    expect(r.trackName).toBe(`A & B <éE> "' <c> & d`);
    expect(r.rawPoints.map((p) => p.time)).toEqual([T(0), T(1)]);
  });

  it('saute un commentaire dans l’heure, garde le texte d’un élément dans l’heure', () => {
    const r = parseGpx(trk(`<trkpt lat="45" lon="5"><time>2026-10-01T10:00<!-- :59 -->:02Z</time></trkpt><trkpt lat="45" lon="5.001"><time>2026-10-01<b>T10:00:03</b>Z</time></trkpt>`));
    expect(r.rawPoints.map((p) => p.time)).toEqual([T(2), T(3)]);
  });

  it('ramène CRLF et CR à une fin de ligne dans le nom', () => {
    expect(parseGpx(trk(`<trkpt lat="45" lon="5"><time>${T(0)}</time></trkpt>`, '<name> Ligne 1\r\nLigne 2\rLigne 3 </name>')).trackName).toBe('Ligne 1\nLigne 2\nLigne 3');
  });

  it('lit lat et lon entre apostrophes, dans l’autre ordre, avec des blancs autour de =', () => {
    const r = parseGpx(trk(`<trkpt lon='5' lat='45'><time>${T(0)}</time></trkpt><trkpt lon = "5.001"  lat= '45.5' ><time>${T(1)}</time></trkpt >`));
    expect(r.rawPoints.map((p) => [p.lat, p.lon])).toEqual([[45, 5], [45.5, 5.001]]);
  });

  it('un point fermé sur lui-même : sans heure pour la trace, gardé pour le tracé', () => {
    const xml = trk(`<trkpt lat="45" lon="5"/><trkpt lat="45" lon="5.001" /><trkpt lat="45" lon="5.002"><time>${T(2)}</time></trkpt>`);
    expect(parseGpx(xml).rawPoints.map((p) => p.lon)).toEqual([5.002]);
    expect(parseGpxPath(xml).points.map((p) => p.lon)).toEqual([5, 5.001, 5.002]);
  });

  it('un point préfixé (gpx:trkpt) n’est pas lu, comme par le DOM', () => {
    const xml = gpx(`<trk><trkseg><g:trkpt xmlns:g="urn:g" lat="1" lon="1"><time>${T(0)}</time></g:trkpt><trkpt lat="45" lon="5"><time>${T(1)}</time></trkpt></trkseg></trk>`);
    expect(parseGpx(xml).rawPoints.map((p) => p.lon)).toEqual([5]);
  });

  it('un <parsererror> dans un fichier bien formé le fait refuser, comme avant', () => {
    expect(() => parseGpx(gpx('<parsererror>x</parsererror>'))).toThrow(MALFORMED);
    expect(() => parseGpxPath(gpx('<parsererror>x</parsererror>'))).toThrow(MALFORMED);
  });

  it('ignore le BOM, avec ou sans déclaration XML', () => {
    const body = `<gpx ${NS}><trk><name>Bom</name><trkseg><trkpt lat="45" lon="5"><time>${T(0)}</time></trkpt></trkseg></trk></gpx>`;
    const bom = String.fromCharCode(0xfeff);
    for (const xml of [`${bom}<?xml version="1.0" encoding="UTF-8"?>${body}`, bom + body]) {
      const r = parseGpx(xml);
      expect(r.rawPoints).toHaveLength(1);
      expect(r.trackName).toBe('Bom');
    }
  });

  it.each([
    ['vide', ''],
    ['blancs seuls', ' \n\t '],
    ['texte seul', 'pas du XML'],
    ['texte avant la racine', `x<gpx ${NS}/>`],
    ['tronqué', gpx(`<trk><trkseg><trkpt lat="45" lon="5"><time>${T(0)}</time></trkpt>`).slice(0, -20)],
    ['balises croisées', gpx('<trk><name>a</trk></name>')],
    ['balise non fermée', '<gpx><trk></gpx>'],
    ['contenu après la racine', `${gpx('')}<gpx/>`],
    ['texte après la racine', `${gpx('')}x`],
    ['préfixe non déclaré', gpx('<trk><x:name>a</x:name></trk>')],
    ['préfixe d’attribut non déclaré', gpx('<trk x:a="1"/>')],
    ['attribut en double', gpx('<trk><trkseg><trkpt lat="45" lat="46" lon="5"/></trkseg></trk>')],
    ['attribut sans guillemets', gpx('<trk><trkseg><trkpt lat=45 lon="5"/></trkseg></trk>')],
    ['attributs sans blanc entre eux', gpx('<trk><trkseg><trkpt lat="45"lon="5"/></trkseg></trk>')],
    ['< dans une valeur', gpx('<trk a="<"/>')],
    ['< seul dans un texte', gpx('<trk><name>a < b</name></trk>')],
    ['déclaration pas en tête', ` ${gpx('')}`],
    ['déclaration dans la racine', `<gpx><?xml version="1.0"?></gpx>`],
    ['commentaire à double tiret', gpx('<!-- a -- b -->')],
    ['commentaire non fermé', gpx('<!-- a')],
    ['CDATA hors de la racine', `<![CDATA[x]]>${gpx('')}`],
    ['DOCTYPE après la racine', `${gpx('')}<!DOCTYPE gpx>`],
    ['caractère de contrôle', gpx('<trk><name>a\u0001</name></trk>')],
    ['UTF-16 lu en UTF-8 (octets nuls)', '<\u0000g\u0000p\u0000x\u0000/\u0000>\u0000'],
    // Lus par xmldom, refusés par Chrome : on suit Chrome.
    [']]> dans un texte', gpx('<trk><name>a ]]> b</name></trk>')],
    ['référence à un caractère interdit dans un texte', gpx('<trk><name>a&#0;</name></trk>')],
    ['référence à un caractère interdit dans un attribut', gpx('<trk><trkseg><trkpt lat="45&#x1;" lon="5"/></trkseg></trk>')],
  ])('refuse avec le message de l’application : %s', (_, xml) => {
    expect(() => parseGpx(xml)).toThrow(MALFORMED);
    expect(() => parseGpxPath(xml)).toThrow(MALFORMED);
  });

  it(']]> et une référence interdite sont permis là où le navigateur les permet : attribut, commentaire, CDATA', () => {
    const r = parseGpx(gpx(`<trk desc="a ]]> b"><!-- &#0; ]]> --><name><![CDATA[&#0;]]> &#233;</name><trkseg><trkpt lat="4&#53;" lon="5"><time>${T(0)}</time></trkpt></trkseg></trk>`));
    expect(r.trackName).toBe('&#0; é');
    expect(r.rawPoints.map((p) => p.lat)).toEqual([45]);
  });

  it('une entité inconnue ou un & seul restent tels quels', () => {
    expect(parseGpx(gpx('<trk><name>Pêche & voile &inconnue;</name></trk>')).trackName).toBe('Pêche & voile &inconnue;');
  });

  it.each([1, 5])('une trace de 10 min à %i Hz : chaque point lu, segments et extensions compris', (hz) => {
    const n = 600 * hz;
    const t0 = Date.parse(T(0));
    const points = Array.from({ length: n }, (_, i) =>
      `<trkpt lat="${45 + i * 1e-5}" lon="5"><ele>${i % 50}</ele><time>${new Date(t0 + (i * 1000) / hz).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${100 + (i % 60)}</gpxtpx:hr><gpxtpx:speed>${(i % 30) / 10}</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>`);
    const half = n / 2;
    const r = parseGpx(gpx(`<trk><trkseg>\n${points.slice(0, half).join('\n')}\n</trkseg><trkseg>\r\n${points.slice(half).join('\r\n')}</trkseg></trk>`));
    expect(r.rawPoints).toHaveLength(n);
    expect(r.rawPoints.flatMap((p, i) => (p.segmentStart ? [i] : []))).toEqual([half]);
    expect(r.rawPoints[n - 1]).toMatchObject({ ele: (n - 1) % 50, hr: 100 + ((n - 1) % 60), speedMs: ((n - 1) % 30) / 10 });
    expect(r.rawPoints[n - 1].rawTimeMs! - r.rawPoints[0].rawTimeMs!).toBe(((n - 1) * 1000) / hz);
  });
});

/** Heure du point à la seconde `s` (moins d'une minute). */
const T = (s: number) => `2026-10-01T10:00:${String(s).padStart(2, '0')}Z`;

describe('points sans position de la trace', () => {
  it('écarte le (0, 0) exact et les positions hors de la Terre, garde un zéro seul', () => {
    const xml = gpx(`<trk><trkseg>${[
      pt(43.5, 3.9, T(0)), pt(0, 0, T(1)), pt(200, 3.9, T(2)), pt(43.5, 181, T(3)), pt(0, 3.9, T(4)), pt(43.5, 0, T(5)),
    ].join('')}</trkseg></trk>`);
    expect(parseGpx(xml).rawPoints.map((p) => [p.lat, p.lon])).toEqual([[43.5, 3.9], [0, 3.9], [43.5, 0]]);
    expect(parseGpxPath(xml).points.map((p) => [p.lat, p.lon])).toEqual([[43.5, 3.9], [0, 3.9], [43.5, 0]]);
  });
});

describe('plafonds du lecteur : un fichier fabriqué exprès est refusé vite', () => {
  /** Lecture chronométrée : refus « mal formé », en moins de 2 s. */
  const refusedQuickly = (xml: string) => {
    const t0 = performance.now();
    expect(() => parseGpx(xml)).toThrow(MALFORMED);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(2000);
    return ms;
  };
  const attributes = (n: number) => Array.from({ length: n }, (_, k) => `a${k}="${k}"`).join(' ');

  it('une balise à 65 attributs est refusée, à 64 elle passe', () => {
    const tag = (n: number) => gpx(`<trk><trkseg><trkpt lat="45" lon="5" ${attributes(n - 2)}><time>${T(0)}</time></trkpt></trkseg></trk>`);
    expect(parseGpx(tag(64)).rawPoints).toHaveLength(1);
    refusedQuickly(tag(65));
    // La forme de l'attaque : des dizaines de milliers d'attributs sur une seule balise.
    const ms = refusedQuickly(gpx(`<trk ${attributes(80_000)}/>`));
    console.log(`balise à 80 000 attributs : refusée en ${Math.round(ms)} ms`);
  });

  it('des points imbriqués sur cinq niveaux sont refusés, sur quatre ils passent', () => {
    const nested = (depth: number) =>
      gpx(`<trk><trkseg>${'<trkpt lat="45" lon="5">'.repeat(depth)}<time>${T(0)}</time>${'</trkpt>'.repeat(depth)}</trkseg></trk>`);
    expect(parseGpx(nested(4)).rawPoints).toHaveLength(4);
    refusedQuickly(nested(5));
    const ms = refusedQuickly(nested(32_000));
    console.log(`32 000 points imbriqués : refusés en ${Math.round(ms)} ms`);
  });

  it('65 déclarations d\'espace de noms en portée sont refusées, 64 passent', () => {
    // La racine en déclare une (`gpxtpx`) ; chaque élément imbriqué en ajoute une.
    const doc = (count: number) => {
      const extra = count - 1;
      const open = Array.from({ length: extra }, (_, k) => `<e${k} xmlns:n${k}="urn:${k}">`).join('');
      const close = Array.from({ length: extra }, (_, k) => `</e${extra - 1 - k}>`).join('');
      return gpx(`<extensions>${open}${close}</extensions><trk><trkseg>${pt(45, 5, T(0))}</trkseg></trk>`);
    };
    expect(parseGpx(doc(64)).rawPoints).toHaveLength(1);
    refusedQuickly(doc(65));
    const deep = 50_000;
    const ms = refusedQuickly(gpx(`${Array.from({ length: deep }, (_, k) => `<e xmlns:n${k}="u">`).join('')}${'</e>'.repeat(deep)}`));
    console.log(`${deep} déclarations imbriquées : refusées en ${Math.round(ms)} ms`);
  });

  it('un GPX honnête de 4 h à 5 points par seconde passe : Doppler, FC, cap, 12 espaces de noms, un par point', () => {
    const roots = Array.from({ length: 10 }, (_, k) => `xmlns:ns${k}="http://example.com/ns${k}"`).join(' ');
    const head = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="montre" ${NS} ${roots}><trk><name>4 h</name><trkseg>`;
    const n = 4 * 3600 * 5;
    const t0 = Date.parse(T(0));
    const parts: string[] = [head];
    for (let i = 0; i < n; i++) {
      parts.push(
        `<trkpt lat="${(43.5 + i * 1e-6).toFixed(7)}" lon="3.9"><ele>1.2</ele><time>${new Date(t0 + i * 200).toISOString()}</time>` +
          `<extensions><gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">` +
          `<gpxtpx:hr>${120 + (i % 40)}</gpxtpx:hr><gpxtpx:speed>${(5 + (i % 30) / 10).toFixed(1)}</gpxtpx:speed><gpxtpx:course>${i % 360}</gpxtpx:course>` +
          `</gpxtpx:TrackPointExtension></extensions></trkpt>\n`,
      );
    }
    parts.push('</trkseg></trk></gpx>');
    const xml = parts.join('');
    const t1 = performance.now();
    const r = parseGpx(xml);
    const ms = performance.now() - t1;
    expect(r.rawPoints).toHaveLength(n);
    expect(r.hasDeviceSpeed).toBe(true);
    expect(r.rawPoints[n - 1]).toMatchObject({ hr: 120 + ((n - 1) % 40), courseDeg: (n - 1) % 360 });
    console.log(`GPX honnête de 4 h à 5 Hz (${n} points, ${(xml.length / 1e6).toFixed(1)} Mo) : lu en ${Math.round(ms)} ms`);
  });
});
