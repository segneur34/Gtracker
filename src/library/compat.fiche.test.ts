import { describe, expect, it } from 'vitest';
import {
  RECORD_FORMAT, applyRecordPatch, isWritableRecord, lightRecord, mergeLightRecord, parseRecord, parseRecordWithRaw, serializeRecord,
  type SessionRecord,
} from './record';
import { sessionRecord } from '../test/record.fixture';

/** Réécrit une fiche comme le ferait l'application après un renommage (lecture, patch, écriture avec les illisibles). */
const rewriteAfterRename = (text: string): Record<string, unknown> => {
  const parsed = parseRecordWithRaw(text)!;
  const rec = { ...parsed.parts, summary: parsed.parts.summary! } as SessionRecord;
  const { record } = applyRecordPatch(rec, { name: 'Renommée' });
  return JSON.parse(serializeRecord(record, parsed.unreadable)) as Record<string, unknown>;
};

describe('fiche, compatibilité (a) version future', () => {
  it('fiche version 2 : lue, non réécrivable', () => {
    const text = JSON.stringify({ ...sessionRecord(), version: 2, nouveau: { a: 1 } });
    const parsed = parseRecordWithRaw(text);
    expect(parsed).not.toBeNull();
    expect(isWritableRecord(parsed!.parts)).toBe(false);
  });
});

describe('fiche, compatibilité (b) champs mal typés', () => {
  it('résumé à distance en texte : résumé illisible (refait), reste gardé', () => {
    const text = JSON.stringify({ ...sessionRecord({ name: 'X' }), summary: { ...sessionRecord().summary, distanceM: '12' } });
    const p = parseRecordWithRaw(text)!;
    expect(p.parts.summary).toBeNull();
    expect(p.parts.name).toBe('X');
  });
  it('vent en texte, appréciation en texte : lus null, gardés bruts à la réécriture', () => {
    const base = sessionRecord({
      analysis: { windDeg: '90', savedAt: 1 } as never,
      notes: { comment: 'ok', rating: '5', savedAt: 1 } as never,
    });
    const out = rewriteAfterRename(JSON.stringify(base));
    expect((out.analysis as Record<string, unknown>).windDeg).toBe('90');
    expect((out.notes as Record<string, unknown>).rating).toBe('5');
  });
  it('champs de premier niveau gardés bruts (lot 148, C5-3) : source, activityId, addedAt, title, nom', () => {
    const base = {
      ...sessionRecord(), source: 'montre', activityId: 7, addedAt: 1730000000000, title: { fr: 'Titre' },
    };
    const out = rewriteAfterRename(JSON.stringify(base));
    expect({ source: out.source, activityId: out.activityId, addedAt: out.addedAt, title: out.title }).toEqual({
      source: 'montre', activityId: 7, addedAt: 1730000000000, title: { fr: 'Titre' },
    });
    // Le nom, renommé ici, prend la valeur neuve ; un nom d'une autre forme, sans renommage, reste brut.
    expect(out.name).toBe('Renommée');
    const parsed = parseRecordWithRaw(JSON.stringify({ ...sessionRecord(), name: { fr: 'Sortie' } }))!;
    const rec = { ...parsed.parts, summary: parsed.parts.summary! } as SessionRecord;
    expect(rec.name).toBeNull();
    expect((JSON.parse(serializeRecord(rec, parsed.unreadable)) as Record<string, unknown>).name).toEqual({ fr: 'Sortie' });
  });
  it('une valeur neuve l\'emporte sur le brut gardé (lot 148, C5-3)', () => {
    const parsed = parseRecordWithRaw(JSON.stringify({ ...sessionRecord(), activityId: 7, source: 'montre' }))!;
    const rec = { ...parsed.parts, summary: parsed.parts.summary! } as SessionRecord;
    const { record } = applyRecordPatch(rec, { activityId: 'a-wing' });
    const out = JSON.parse(serializeRecord(record, parsed.unreadable)) as Record<string, unknown>;
    expect(out.activityId).toBe('a-wing');
    expect(out.source).toBe('montre');
  });
  it('NaN : jamais écrit, sérialisé en null', () => {
    const r = sessionRecord({}, { maxSpeedMs: Number.NaN });
    const text = serializeRecord(r);
    expect(text).toContain('"maxSpeedMs": null');
    expect(parseRecord(text)).toBeNull();
  });
});

describe('fiche, compatibilité (c) __proto__', () => {
  it('pas de pollution, clé gardée telle quelle à la réécriture', () => {
    const text = '{"format":"tracker-session","version":1,"gpx":"a.gpx","sport":"wingfoil","source":"import","addedAt":"2026-09-24T10:00:00.000Z","title":null,'
      + `"summary":${JSON.stringify(sessionRecord().summary)},"notes":{"comment":"c","savedAt":1,"__proto__":{"pollue":true}},"analysis":null,"__proto__":{"pollue":true}}`;
    const out = rewriteAfterRename(text);
    expect(({} as Record<string, unknown>).pollue).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(out.notes, '__proto__')).toBe(true);
  });
});

describe('fiche, compatibilité (d) fiche de septembre (58aa8bb)', () => {
  /** Forme de la fiche au 24/09 : pas d'activité, de nom, de gear1/2, conditions, gear ; analysis à trois champs ; un ancien `terrain`. */
  const september = {
    format: RECORD_FORMAT, version: 1, gpx: '2026-09-23_14-00-00_wingfoil.gpx', sport: 'wingfoil', source: 'enregistrement',
    addedAt: '2026-09-24T10:00:00.000Z', title: 'Wingfoil',
    summary: { calcVersion: 2, startMs: 1790000000000, endMs: 1790003600000, distanceM: 20000, movingTimeS: 2500, elevationGainM: null, maxSpeedMs: 11, pointCount: 3601, samplingS: 1, maneuverCount: 12 },
    notes: { foil: 'Axis 900', mast: '75', wing: '5 m', windLevel: 'moyen', waterState: 'clapot', rating: 4, comment: 'Bien', savedAt: 1790004000000 },
    analysis: { windDeg: 270, activeThreshold: 9, referenceSpeedMs: null, terrain: 'route', savedAt: 1790004000000 },
  };
  it('lue sans perte, réécrite sans perte', () => {
    const parsed = parseRecordWithRaw(JSON.stringify(september))!;
    expect(parsed.unreadable).toEqual({});
    expect(parsed.parts.summary?.calcVersion).toBe(2);
    const out = rewriteAfterRename(JSON.stringify(september));
    expect(out.notes).toMatchObject(september.notes);
    expect(out.analysis).toMatchObject(september.analysis);
    expect((out.summary as Record<string, unknown>).maneuverCount).toBe(12);
  });
});

describe('fiche, compatibilité (e) aller-retour sur une fiche complète', () => {
  const full = sessionRecord({
    activityId: 'wingfoil', name: 'Sortie', notes: {
      foil: 'a', mast: 'b', wing: 'c', gear1: '', gear2: '', conditions: '', gear: null, windLevel: 'fort', waterState: 'plat', rating: 5, comment: 'x', savedAt: 3,
    },
    analysis: { windDeg: 10, activeThreshold: 8, referenceSpeedMs: 5, speedRange: { minMs: 2, maxMs: 12 }, effortThresholdMs: null, foil: true, pumping: false, waveThreshold: null, bikeWeightKg: null, loadKg: null, savedAt: 4 },
    marks: [{ timeMs: 1790000100000, lat: 43.5, lon: 3.9, label: 'Bouée' }],
    jumps: { version: 2, computedAt: '2026-10-08T14:00:00.000Z', jumps: [] },
  }, { maneuverCount: 3, maneuverResults: { tackSuccess: 1, tackFail: 0, jibeSuccess: 2, jibeFail: 0 }, optionsKey: '[8,5,null,null]', inMotionS: 2900 });
  it('serialize puis parse = identité, texte stable', () => {
    const text = serializeRecord(full);
    const back = parseRecord(text)!;
    expect(back).toEqual(full);
    // Constat : l'ordre des champs bouge à la première relecture (jumps passe avant marks), puis se stabilise.
    expect(serializeRecord(back)).not.toBe(text);
    const again = serializeRecord(back);
    expect(serializeRecord(parseRecord(again)!)).toBe(again);
  });
  it('cache allégé puis fusion avec le disque : identique', () => {
    expect(mergeLightRecord(full, lightRecord(full))).toEqual(full);
  });
});

describe("fiche, compatibilité (f) fiche de l'application complète, champs de la terre gardés bruts (lot 301)", () => {
  // Fiche telle que l'écrit l'application complète : poids et charge, voies, altitude du terrain, séances (l'une
  // mal formée), test guidé, cadence et test du résumé. La version voile et surf ne lit plus ces champs-là.
  const START = 1790000000000;
  const complete = {
    ...sessionRecord({ gpx: '2026-09-23_14-00-00_course.gpx', sport: 'running', activityId: 'course', name: 'Footing' },
      { cadence: { avgSpm: 172.5, steps: 9800 } }),
    analysis: {
      windDeg: null, activeThreshold: 1.2, referenceSpeedMs: null, speedRange: null, effortThresholdMs: 4.35, foil: null, pumping: null,
      waveThreshold: null, bikeWeightKg: 9.8, loadKg: 4.5, savedAt: 4,
    },
    surfaces: { source: 'overpass', fetchedAt: '2026-10-04T15:00:00.000Z', matchVersion: 3, startMs: START, tags: ['highway=track'], runs: [[0, 0]] },
    terrainElevation: { source: 'ign', resource: 'ign_rge_alti_wld', version: 1, stepM: 10, fetchedAt: '2026-10-07T09:00:00.000Z', startMs: START, t: [0, 1800], z: [120.5, null] },
    elevationSource: 'gps',
    intervals: [{ workout: { reps: 1, workS: 60, restS: 30 }, laps: [{ kind: 'sprint', rep: 1, startMs: START, endMs: START + 60_000 }] }],
    test: { protocol: 'fc-max', version: 1, settings: { warmupS: 480 }, startMs: START, steps: [], signals: [] },
  };
  const text = serializeRecord(complete as unknown as SessionRecord);

  it('relue, renommée, réécrite : chaque champ revient identique, nom excepté', () => {
    const rewritten = rewriteAfterRename(text);
    expect(rewritten.name).toBe('Renommée');
    expect({ ...rewritten, name: 'Footing' }).toEqual(JSON.parse(text));
  });

  it('les champs bruts suivent la fiche dans le cache allégé et la fusion avec le disque', () => {
    const read = parseRecord(text)!;
    for (const key of ['surfaces', 'terrainElevation', 'intervals', 'test'] as const) expect(read[key]).toEqual(complete[key]);
    expect((read.summary as unknown as Record<string, unknown>).cadence).toEqual({ avgSpm: 172.5, steps: 9800 });
    expect(mergeLightRecord(read, lightRecord(read))).toEqual(read);
  });
});

describe('fiche, compatibilité : BOM, CRLF, tronqué, vide', () => {
  const text = serializeRecord(sessionRecord({ name: 'Sortie' }));
  it('BOM en tête : retiré, fiche lue', () => {
    expect(parseRecordWithRaw('﻿' + text)?.parts.name).toBe('Sortie');
  });
  it('CRLF : lue', () => {
    expect(parseRecord(text.replace(/\n/g, '\r\n'))?.name).toBe('Sortie');
  });
  it('tronquée : illisible', () => {
    expect(parseRecordWithRaw(text.slice(0, text.length / 2))).toBeNull();
  });
  it('vide : illisible', () => {
    expect(parseRecordWithRaw('')).toBeNull();
  });
});
