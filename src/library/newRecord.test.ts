import { describe, expect, it } from 'vitest';
import { IMU_FORMAT, IMU_VERSION, PHONE_STREAMS, encodeImu } from '../core/imuFile';
import { JUMPS_CALC_VERSION } from '../core/jumps';
import { sessionRecord } from '../test/record.fixture';
import { newRecord, recordFor, type NewRecordContext } from './newRecord';
import { RECORD_FORMAT, RECORD_VERSION } from './record';
import type { AnalyzedGpx } from './summaryOptions';

const NOW = Date.UTC(2026, 10, 4, 9, 30, 0);
const base = sessionRecord();
const analyzed: AnalyzedGpx = { summary: base.summary, sport: 'wingfoil', title: 'Wing du matin' };

/** Horloge fixe. */
const context = (): NewRecordContext => ({ now: () => NOW });

const motionWithJumps = (jumps: boolean) => encodeImu({
  format: IMU_FORMAT, version: IMU_VERSION, startedAtMs: NOW, clock: { elapsedUs: 0, wallMs: NOW },
  setup: { placement: 'poitrine', foil: false, jumps }, streams: [...PHONE_STREAMS],
}, []);

describe('fiche neuve d’une session (lot 113)', () => {
  it('prend le calcul, le titre et le résumé du GPX, l’heure de l’horloge donnée, sans nom ni réglages', () => {
    expect(newRecord('a.gpx', analyzed, 'import', null, context())).toEqual({
      format: RECORD_FORMAT, version: RECORD_VERSION, gpx: 'a.gpx', sport: 'wingfoil', activityId: null, source: 'import',
      addedAt: new Date(NOW).toISOString(), title: 'Wing du matin', name: null, summary: base.summary, notes: null, analysis: null,
    });
  });

  it('range l’activité choisie, sans notes', () => {
    const record = newRecord('a.gpx', analyzed, 'enregistrement', 'wing', context());
    expect(record.activityId).toBe('wing');
    expect(record.notes).toBeNull();
  });
});

describe('fiche d’une session qui entre dans la mémoire (lot 113)', () => {
  it('garde la fiche apportée, résumé refait et calcul du GPX', () => {
    const apportee = { ...base, name: 'Sortie', sport: 'kite' as const };
    const record = recordFor('b.gpx', analyzed, 'import', { record: apportee }, context());
    expect(record).toMatchObject({ gpx: 'b.gpx', name: 'Sortie', sport: 'wingfoil', summary: base.summary });
  });

  it('range dans une fiche neuve le foil et les repères de l’enregistrement ; ni séances ni test (lot 302)', () => {
    const record = recordFor('c.gpx', analyzed, 'enregistrement', {
      activityId: 'wing', foil: true, marks: [{ timeMs: NOW, lat: null, lon: null, label: 'bouée' }],
    }, context());
    expect(record.activityId).toBe('wing');
    expect(record.analysis?.foil).toBe(true);
    expect(record.analysis?.savedAt).toBe(NOW);
    expect(record.marks).toHaveLength(1);
    for (const field of ['intervals', 'test']) expect(record).not.toHaveProperty(field);
  });

  it('dit tout de suite « pas de sauts à chercher » pour une capture de la seule cadence', async () => {
    const cadence = recordFor('d.gpx', analyzed, 'enregistrement', { motion: await motionWithJumps(false) }, context());
    expect(cadence.jumps).toEqual({ version: JUMPS_CALC_VERSION, computedAt: new Date(NOW).toISOString(), jumps: [], measured: false });
    const sauts = recordFor('d.gpx', analyzed, 'enregistrement', { motion: await motionWithJumps(true) }, context());
    expect(sauts.jumps).toBeUndefined();
  });
});
