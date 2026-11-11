import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTIVITIES, type Activity } from '../core/activities';
import { analysisTabs, isTabShown, toggleTabChoice } from '../core/analysisTabs';
import { getSportProfile, hasActiveThreshold } from '../core/sportProfiles';
import { isValidGradeRange } from '../planning/grade';
import { knotsToMs } from '../core/units';
import {
  PER_ACTIVITY_KEYS, TREATMENT_UNITS, defaultAutoPauseOf, defaultHeartRateOf,
  defaultHrOffsetOf, defaultLiveFieldsFor, defaultMarkGuideOf, defaultNotificationFieldsFor, defaultSpeedRangeOf, defaultSpeedUnitOf,
  defaultThresholdOf, hiddenFamiliesOf, isActivityOverridden, isValidAutoPause, nextBoundPair, nextSpeedRange, rangeFollowsPace, resetOverrides,
  resolveJumps, resolveRecordingProfile, resolveThresholdOverride, resolveTurns, defaultTurnsOf, withVisibility,
  SETTING_FIELDS, defaultTabsOf, effectiveHrZoneLines, settingsView, tabsAfterJumpsChange, thresholdFollowsPace, withSetting, type StoredSettings,
} from './activitySettings';

const byId = (id: string) => DEFAULT_ACTIVITIES.find((a) => a.id === id)!;
const kiteCree: Activity = { id: 'a-kite', name: 'Kite', base: 'kite', color: '#5b87f2' };

describe('pré-réglages du bateau (21/10)', () => {
  const boat = { id: 'a-voilier', name: 'Voilier', base: 'bateau' as const, color: '#014e86' };

  it('colore de 1 à 15 nœuds, sans seuil, pause sous 0,2 km/h pendant 60 s', () => {
    const range = defaultSpeedRangeOf(boat);
    expect(range.minMs).toBeCloseTo(knotsToMs(1), 6);
    expect(range.maxMs).toBeCloseTo(knotsToMs(15), 6);
    const profile = getSportProfile('bateau');
    expect(hasActiveThreshold(profile)).toBe(false);
    expect(profile.withoutActiveThreshold?.maneuverSuccess).toBe(1);
    expect(profile.recording.autoPauseSpeedMs * 3.6).toBeCloseTo(0.2, 6);
    expect(profile.recording.autoPauseDelayS).toBe(60);
    expect(hasActiveThreshold(getSportProfile('wingfoil'))).toBe(true);
  });
});

describe('pré-réglages des activités (21/10)', () => {
  const voile = byId('wingfoil');
  const surf = byId('surf');
  const pav = { id: 'a-pav', name: 'Pav', base: 'windsurf' as const, color: '#5b87f2' };
  const kn = (ms: number) => Math.round((ms / knotsToMs(1)) * 10) / 10;
  const kmh = (ms: number) => Math.round(ms * 3.6 * 10) / 10;

  it('wing et planche : 8 nœuds partout, seuil et couleurs fixes', () => {
    for (const activity of [voile, pav]) {
      expect(defaultThresholdOf(activity, false)).toBe(8);
      expect(thresholdFollowsPace(activity)).toBe(false);
      expect(rangeFollowsPace(activity)).toBe(false);
      const range = defaultSpeedRangeOf(activity);
      expect([kn(range.minMs), kn(range.maxMs)]).toEqual([8, 24]);
      expect(kmh(defaultAutoPauseOf(activity).speedMs)).toBe(1.5);
      expect(defaultLiveFieldsFor(activity)).toEqual(['speed', 'average', 'recentTopShort', 'distance']);
      expect(defaultMarkGuideOf(activity).curve.map((p) => p.distanceM)).toEqual([5, 25, 34]);
    }
    // Le kite suit toujours l'allure.
    expect(thresholdFollowsPace(kiteCree)).toBe(true);
    expect(rangeFollowsPace(kiteCree)).toBe(true);
  });

  it('le surf garde les défauts de son calcul', () => {
    expect(defaultThresholdOf(surf, false)).toBe(getSportProfile('surf').defaultActiveThreshold);
    expect(defaultHeartRateOf(surf)).toBe(false);
  });
});

describe('familles cachées', () => {
  it('ne garde que la voile et le surf, écarte toute autre valeur', () => {
    const raw = { hiddenFamilies: ['fractionne', 'ski', 'surf', 'course', 3] } as unknown as StoredSettings;
    expect(hiddenFamiliesOf(raw)).toEqual(['surf']);
    expect(hiddenFamiliesOf({})).toEqual([]);
    expect(hiddenFamiliesOf({ hiddenFamilies: 'surf' } as unknown as StoredSettings)).toEqual([]);
  });

  it('cache une famille, et refuse de cacher la dernière visible', () => {
    const stored: StoredSettings = { activities: [...DEFAULT_ACTIVITIES] };
    const next = withVisibility(stored, [...DEFAULT_ACTIVITIES], [...hiddenFamiliesOf(stored), 'surf']);
    expect(next).toEqual({ activities: DEFAULT_ACTIVITIES, hiddenFamilies: ['surf'] });
    // Cacher aussi la voile ne laisserait rien : refusé.
    expect(withVisibility(stored, [...DEFAULT_ACTIVITIES], ['voile', 'surf'])).toBeNull();
  });
});

describe('sauts mesurés par défaut (05/11)', () => {
  it('cochés en voile ; ni bateau ni surf', () => {
    expect(resolveJumps({}, byId('wingfoil'))?.enabled).toBe(true);
    expect(resolveJumps({}, kiteCree)).toEqual({ enabled: true, placement: 'poitrine', minHeightM: 1 });
    expect(resolveJumps({}, { id: 'a-voilier', name: 'Voilier', base: 'bateau', color: '#014e86' })).toBeNull();
    expect(resolveJumps({}, byId('surf'))).toBeNull();
    // Le réglage enregistré prime.
    expect(resolveJumps({ jumps: { wingfoil: { enabled: false, placement: 'taille', minHeightM: 0.5 } } }, byId('wingfoil'))?.enabled).toBe(false);
  });
});

describe('virages mesurés par le gyroscope (lot 40)', () => {
  const paddle = { id: 'a-paddle', name: 'Paddle', base: 'surf' as const, color: '#8292a6' };

  it('cochés pour Surf et Surf foil, décochés pour une activité créée en surf, absents hors surf', () => {
    expect(resolveTurns({}, byId('surf'))).toBe(true);
    expect(resolveTurns({}, byId('a-surf-foil'))).toBe(true);
    expect(resolveTurns({}, paddle)).toBe(false);
    expect(resolveTurns({}, byId('wingfoil'))).toBeNull();
    expect(resolveTurns({}, kiteCree)).toBeNull();
    expect(settingsView({}, byId('wingfoil')).turns).toBeNull();
  });

  it("le réglage rangé prime, et seul l'écart au défaut est rangé", () => {
    const surf = byId('surf');
    expect(defaultTurnsOf(surf)).toBe(true);
    const off = withSetting({}, surf.id, 'turns', false)!;
    expect(off.turns).toEqual({ surf: false });
    expect(resolveTurns(off, surf)).toBe(false);
    expect(settingsView(off, surf).isTurnsOverridden).toBe(true);
    expect(withSetting(off, surf.id, 'turns', true)!.turns).toEqual({});
    expect(withSetting({}, paddle.id, 'turns', true)).toBeNull(); // activité inconnue des réglages : refusée
    expect(withSetting({ activities: [paddle] } as StoredSettings, paddle.id, 'turns', true)!.turns).toEqual({ 'a-paddle': true });
    expect(withSetting({}, 'wingfoil', 'turns', true)).toBeNull();
    expect(settingsView({}, surf).isTurnsOverridden).toBe(false);
  });
});

describe('onglets et case « Sauts » (n° 174)', () => {
  const wing = byId('wingfoil');
  const tabOf = (activity: Activity, key: string) => analysisTabs(getSportProfile(activity.base)).find((t) => t.key === key)!;
  /** Un toucher sur le bouton d'un onglet, tel que le fait Réglages : relit la vue, écrit le choix. */
  const touch = (stored: StoredSettings, activity: Activity, key: string): StoredSettings =>
    withSetting(stored, activity.id, 'tabs', toggleTabChoice(settingsView(stored, activity).tabs, tabOf(activity, key), defaultTabsOf(activity)))!;
  const shown = (stored: StoredSettings, activity: Activity, key: string) => isTabShown(tabOf(activity, key), settingsView(stored, activity).tabs);
  /** La case telle que la coche Réglages : réglages des sauts, puis onglets s'il y a lieu. */
  const setCase = (stored: StoredSettings, activity: Activity, enabled: boolean): StoredSettings => {
    const view = settingsView(stored, activity);
    const next = { ...view.jumps!, enabled };
    const tabs = tabsAfterJumpsChange(view, next);
    const written = withSetting(stored, activity.id, 'jumps', next)!;
    return tabs === undefined ? written : withSetting(written, activity.id, 'tabs', tabs)!;
  };

  it("un onglet caché d'un toucher revient au second, et la marque « défaut » suit", () => {
    expect(shown({}, wing, 'sauts')).toBe(true);
    const once = touch({}, wing, 'sauts');
    expect(shown(once, wing, 'sauts')).toBe(false);
    expect(settingsView(once, wing).isTabsOverridden).toBe(true);
    expect(isActivityOverridden(settingsView(once, wing))).toBe(true);
    const twice = touch(once, wing, 'sauts');
    expect(shown(twice, wing, 'sauts')).toBe(true);
    expect(settingsView(twice, wing).isTabsOverridden).toBe(false);
    expect(isActivityOverridden(settingsView(twice, wing))).toBe(false);
  });

  it("aucune activité de départ n'a de pré-réglage d'onglets", () => {
    for (const activity of DEFAULT_ACTIVITIES) expect(defaultTabsOf(activity), activity.id).toBeNull();
  });

  it("rien à écrire si l'onglet est déjà montré", () => {
    const view = settingsView({ jumps: { [wing.id]: { enabled: false, placement: 'poitrine', minHeightM: 0.5 } } }, wing);
    expect(tabsAfterJumpsChange(view, { ...view.jumps!, enabled: true })).toBeUndefined();
  });

  it("un calcul sans sauts n'écrit rien", () => {
    const view = settingsView({}, byId('surf'));
    expect(view.jumps).toBeNull();
    expect(tabsAfterJumpsChange(view, { enabled: true, placement: 'poitrine', minHeightM: 0.5 })).toBeUndefined();
  });

  it("un choix rangé qui cache l'onglet s'efface en cochant la case", () => {
    const stored: StoredSettings = { tabs: { [wing.id]: { sauts: false } }, jumps: { [wing.id]: { enabled: false, placement: 'poitrine', minHeightM: 0.5 } } };
    const next = setCase(stored, wing, true);
    expect(shown(next, wing, 'sauts')).toBe(true);
    expect(settingsView(next, wing).isTabsOverridden).toBe(false);
  });

  it("seul le passage de décochée à cochée compte : décocher et changer une sous-option n'écrivent rien", () => {
    const checked = settingsView({ tabs: { [wing.id]: { sauts: false } } }, wing);
    expect(tabsAfterJumpsChange(checked, { ...checked.jumps!, enabled: false })).toBeUndefined();
    expect(tabsAfterJumpsChange(checked, { ...checked.jumps!, placement: 'bras' })).toBeUndefined();
  });
});

describe('décalage des seuils cardio (25/10)', () => {
  const pav = { id: 'a-pav', name: 'Pav', base: 'windsurf' as const, color: '#5b87f2' };

  it('prend celui du calcul', () => {
    expect([byId('wingfoil'), kiteCree, pav, byId('surf')].map(defaultHrOffsetOf)).toEqual([-8, -8, -5, -10]);
  });
});

describe('unités proposées par traitement', () => {
  it('le surf propose les nœuds, le km/h restant en tête et par défaut', () => {
    expect(TREATMENT_UNITS.surf).toContain('kn');
    expect(TREATMENT_UNITS.surf[0]).toBe('kmh');
    expect(getSportProfile('surf').speedUnit).toBe('kmh');
  });
});

describe('isActivityOverridden', () => {
  const wing = byId('wingfoil');
  const surf = byId('surf');

  /** Une valeur réglée, autre que le défaut, pour chaque table rangée par activité. */
  const SAMPLES: Record<string, { activity: Activity; value: unknown }> = {
    thresholds: { activity: wing, value: 12 },
    speedUnits: { activity: wing, value: TREATMENT_UNITS.voile.find((u) => u !== defaultSpeedUnitOf(wing)) },
    distanceUnits: { activity: wing, value: 'nm' },
    speedRanges: { activity: surf, value: { minMs: 1, maxMs: 5 } },
    autoPause: { activity: surf, value: { speedMs: 0.5, delayS: 10 } },
    hrOffsets: { activity: surf, value: 5 },
    gearLabels: { activity: surf, value: ['Planche', 'Combinaison'] },
    tabs: { activity: surf, value: { general: false } },
    liveFields: { activity: surf, value: defaultLiveFieldsFor(surf) },
    notificationFields: { activity: surf, value: defaultNotificationFieldsFor(surf) },
    markGuide: { activity: wing, value: defaultMarkGuideOf(wing) },
    foils: { activity: wing, value: true },
    pumping: { activity: wing, value: true },
    turns: { activity: surf, value: false },
    jumps: { activity: wing, value: getSportProfile('wingfoil').jumps },
    heartRate: { activity: surf, value: !defaultHeartRateOf(surf) },
    hrZoneLines: { activity: surf, value: true },
  };

  it('couvre chaque table rangée par activité, le matériel enregistré excepté', () => {
    expect([...PER_ACTIVITY_KEYS].filter((k) => k !== 'gearGroups').sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it('est faux sans aucun réglage', () => {
    for (const activity of [wing, kiteCree, surf]) expect(isActivityOverridden(settingsView({}, activity))).toBe(false);
  });

  for (const [key, { activity, value }] of Object.entries(SAMPLES)) {
    it(`voit « ${key} » réglé, et plus rien après « Par défaut »`, () => {
      const stored = { [key]: { [activity.id]: value } } as StoredSettings;
      expect(isActivityOverridden(settingsView(stored, activity))).toBe(true);
      expect(isActivityOverridden(settingsView(resetOverrides(stored, activity.id), activity))).toBe(false);
    });
  }

  it('ignore une table inconnue rangée par activité, que « Par défaut » laisse', () => {
    const stored = { tableInconnue: { [wing.id]: 'x' } } as unknown as StoredSettings;
    expect(isActivityOverridden(settingsView(stored, wing))).toBe(false);
    expect(resetOverrides(stored, wing.id)).toEqual(stored);
  });

  it('ne compte pas le matériel enregistré, que « Par défaut » garde', () => {
    const groups = [{ id: 'g-mat', name: 'Aile', items: [{ id: 'i1', name: '5 m' }] }];
    const stored = { gearGroups: { [wing.id]: groups } } as StoredSettings;
    expect(resetOverrides(stored, wing.id).gearGroups?.[wing.id]).toEqual(groups);
    expect(isActivityOverridden(settingsView(stored, wing))).toBe(false);
  });
});

describe('bornes de couleur par défaut, tenues par le profil du calcul (lot 72)', () => {
  const kmh = (v: number) => v / 3.6;
  const custom = (base: keyof typeof expected) => ({ id: `a-${base}`, name: base, base, color: '#000000' });
  /** Valeurs d'avant le lot 72, gelées : les constantes de sport et la table du traitement qu'elles remplacent. */
  const expected = {
    wingfoil: [knotsToMs(8), knotsToMs(28)], windsurf: [knotsToMs(8), knotsToMs(28)], kite: [knotsToMs(8), knotsToMs(28)],
    bateau: [knotsToMs(1), knotsToMs(15)], surf: [kmh(5), kmh(30)],
  } as const;

  it('chaque calcul a les siennes, celles du traitement de jadis', () => {
    for (const [base, [minMs, maxMs]] of Object.entries(expected)) {
      const range = getSportProfile(base as keyof typeof expected).speedRange;
      expect(range.minMs, base).toBeCloseTo(minMs, 9);
      expect(range.maxMs, base).toBeCloseTo(maxMs, 9);
    }
  });

  it("une activité sans pré-réglage prend celles de son calcul, une pré-réglée les siennes", () => {
    expect(defaultSpeedRangeOf(custom('kite'))).toEqual(getSportProfile('kite').speedRange);
    expect(defaultSpeedRangeOf(custom('surf'))).toEqual(getSportProfile('surf').speedRange);
    const wing = DEFAULT_ACTIVITIES.find((a) => a.id === 'wingfoil')!;
    expect(defaultSpeedRangeOf(wing).maxMs).toBeCloseTo(knotsToMs(24), 9);
  });

  it("les couleurs suivent l'allure en voile seulement, sans pré-réglage, bateau excepté", () => {
    expect(rangeFollowsPace(custom('kite'))).toBe(true);
    expect(rangeFollowsPace(custom('windsurf'))).toBe(false);
    expect(rangeFollowsPace(custom('bateau'))).toBe(false);
    expect(rangeFollowsPace(custom('surf'))).toBe(false);
  });
});

describe("écriture d'un réglage par la table des champs (lot 72)", () => {
  const run = byId('surf');
  const wing = byId('wingfoil');
  const base: StoredSettings = { thresholds: { kite: 9 } };

  it('chaque champ se range dans une table par activité, et chaque table a son champ', () => {
    const keys = Object.values(SETTING_FIELDS).map((rule) => rule.key);
    expect([...keys].sort()).toEqual([...PER_ACTIVITY_KEYS].sort());
  });

  it("range la valeur sous l'activité seule, sans toucher aux autres", () => {
    const next = withSetting(base, run.id, 'activeThreshold', 4);
    expect(next?.thresholds).toEqual({ kite: 9, [run.id]: 4 });
    expect(base.thresholds).toEqual({ kite: 9 });
  });

  it('efface la surcharge pour null, refuse une valeur hors règle', () => {
    expect(withSetting({ thresholds: { [run.id]: 4 } }, run.id, 'activeThreshold', null)?.thresholds).toEqual({});
    expect(withSetting(base, run.id, 'activeThreshold', -1)).toBeNull();
    expect(withSetting(base, run.id, 'speedRange', { minMs: 5, maxMs: 2 })).toBeNull();
    expect(withSetting(base, run.id, 'hrOffset', 2.5)).toBeNull();
  });

  it("ne range que l'écart au défaut : ceinture par défaut", () => {
    expect(withSetting(base, run.id, 'heartRate', defaultHeartRateOf(run))?.heartRate).toEqual({});
    expect(withSetting(base, run.id, 'heartRate', !defaultHeartRateOf(run))?.heartRate).toEqual({ [run.id]: !defaultHeartRateOf(run) });
  });

  it("refuse un réglage que le calcul n'a pas, ou une activité inconnue", () => {
    const boat = { id: 'a-voilier', name: 'Voilier', base: 'bateau' as const, color: '#014e86' };
    const withBoat: StoredSettings = { ...base, activities: [...DEFAULT_ACTIVITIES, boat] };
    expect(withSetting(withBoat, boat.id, 'pumping', true)).toBeNull();
    expect(withSetting(base, wing.id, 'pumping', true)?.pumping).toEqual({ [wing.id]: true });
    expect(withSetting(base, 'a-inconnue', 'liveFields', null)).toBeNull();
    expect(withSetting(base, 'a-inconnue', 'jumps', null)).toBeNull();
  });
});

describe('réglages abîmés relus avec contrôle (lot 117)', () => {
  const run = byId('surf');
  const wrong = (v: unknown) => v as never;

  it("un seuil abîmé retombe sur le pré-réglage, un seuil sain est gardé", () => {
    const preset = resolveThresholdOverride({}, run);
    for (const bad of [Number.NaN, Infinity, -2, '5', null, {}]) {
      expect(resolveThresholdOverride({ thresholds: { [run.id]: wrong(bad) } }, run)).toBe(preset);
    }
    expect(resolveThresholdOverride({ thresholds: { [run.id]: 4.5 } }, run)).toBe(4.5);
  });

  it("une pause automatique incomplète ou abîmée retombe sur le pré-réglage au lieu de couper la pause", () => {
    const fallback = resolveRecordingProfile({}, run);
    const def = defaultAutoPauseOf(run);
    expect(fallback.autoPauseSpeedMs).toBe(def.speedMs);
    for (const bad of [{}, { speedMs: 0.5 }, { delayS: 10 }, { speedMs: Number.NaN, delayS: 10 }, { speedMs: 0.5, delayS: -1 }, { speedMs: '1', delayS: 3 }, 'x', null, 7]) {
      const got = resolveRecordingProfile({ autoPause: { [run.id]: wrong(bad) } }, run);
      expect(got.autoPauseSpeedMs).toBe(def.speedMs);
      expect(got.autoPauseDelayS).toBe(def.delayS);
    }
    const ok = resolveRecordingProfile({ autoPause: { [run.id]: { speedMs: 0.7, delayS: 12 } } }, run);
    expect(ok.autoPauseSpeedMs).toBe(0.7);
    expect(ok.autoPauseDelayS).toBe(12);
  });

  it("la vue des réglages ne montre pas une surcharge abîmée comme réglée", () => {
    const view = settingsView({ thresholds: { [run.id]: wrong(Number.NaN) }, autoPause: { [run.id]: wrong({}) } }, run);
    expect(view.isThresholdOverridden).toBe(false);
    expect(view.isAutoPauseOverridden).toBe(false);
  });
});

describe("paire de bornes de Réglages : un champ vidé n'efface que sa borne", () => {
  const fallback = { minMs: 5, maxMs: 30 };

  it('12-30, on efface 30, on retape 35 : 12-35 ; le 12 survit à chaque frappe', () => {
    let range: typeof fallback | null = { minMs: 12, maxMs: 30 };
    range = nextSpeedRange(range, 'maxMs', null, fallback);
    expect(range).toEqual({ minMs: 12, maxMs: 30 });
    // « 3 », première frappe de « 35 », passe sous 12 : refusé, rien n'est perdu.
    range = nextSpeedRange(range, 'maxMs', 3, fallback);
    expect(range).toEqual({ minMs: 12, maxMs: 30 });
    range = nextSpeedRange(range, 'maxMs', 35, fallback);
    expect(range).toEqual({ minMs: 12, maxMs: 35 });
  });

  it("la borne vidée reprend son défaut, l'autre reste", () => {
    expect(nextSpeedRange({ minMs: 12, maxMs: 40 }, 'maxMs', null, fallback)).toEqual({ minMs: 12, maxMs: 30 });
    expect(nextSpeedRange({ minMs: 12, maxMs: 40 }, 'minMs', null, fallback)).toEqual({ minMs: 5, maxMs: 40 });
  });

  it('les deux bornes vidées : plus de réglage', () => {
    const once = nextSpeedRange({ minMs: 12, maxMs: 40 }, 'maxMs', null, fallback);
    expect(nextSpeedRange(once, 'minMs', null, fallback)).toBeNull();
  });

  it('rendre la paire au défaut en la vidant efface le réglage ; le taper le garde', () => {
    expect(nextSpeedRange({ minMs: 12, maxMs: 30 }, 'minMs', null, fallback)).toBeNull();
    expect(nextSpeedRange({ minMs: 12, maxMs: 30 }, 'minMs', 5, fallback)).toEqual(fallback);
  });

  it('sans réglage, vider ne fige rien et une saisie part du défaut', () => {
    expect(nextSpeedRange(null, 'maxMs', null, fallback)).toBeNull();
    expect(nextSpeedRange(null, 'minMs', 12, fallback)).toEqual({ minMs: 12, maxMs: 30 });
  });

  it('une paire invalide laisse la valeur rangée telle quelle, le même objet', () => {
    const current = { minMs: 35, maxMs: 50 };
    // Le défaut 30 passerait sous le min de 35.
    expect(nextSpeedRange(current, 'maxMs', null, fallback)).toBe(current);
    expect(nextSpeedRange(current, 'maxMs', 20, fallback)).toBe(current);
    expect(nextSpeedRange(current, 'minMs', -1, fallback)).toBe(current);
    expect(nextSpeedRange(null, 'minMs', 40, fallback)).toBeNull();
  });

  it('pente : mêmes règles, avec ses bornes', () => {
    const grades = { min: 0.02, max: 0.2 };
    expect(nextBoundPair({ min: 0.05, max: 0.3 }, 'max', null, grades, isValidGradeRange)).toEqual({ min: 0.05, max: 0.2 });
    expect(nextBoundPair({ min: 0.05, max: 0.2 }, 'min', null, grades, isValidGradeRange)).toBeNull();
    expect(nextBoundPair(null, 'max', 0.1, grades, isValidGradeRange)).toEqual({ min: 0.02, max: 0.1 });
    expect(nextBoundPair({ min: 0.05, max: 0.3 }, 'max', 0.01, grades, isValidGradeRange)).toEqual({ min: 0.05, max: 0.3 });
  });

  it('pause automatique : vider le délai garde la vitesse ; 0 km/h reste permis', () => {
    const pause = { speedMs: 1, delayS: 10 };
    expect(nextBoundPair({ speedMs: 2, delayS: 60 }, 'delayS', null, pause, isValidAutoPause)).toEqual({ speedMs: 2, delayS: 10 });
    expect(nextBoundPair({ speedMs: 2, delayS: 10 }, 'speedMs', null, pause, isValidAutoPause)).toBeNull();
    expect(nextBoundPair(null, 'speedMs', 0, pause, isValidAutoPause)).toEqual({ speedMs: 0, delayS: 10 });
    expect(nextBoundPair({ speedMs: 2, delayS: 60 }, 'delayS', -5, pause, isValidAutoPause)).toEqual({ speedMs: 2, delayS: 60 });
  });

  it("une paire rendue est toujours acceptée par le rangement et par la lecture, jamais à une seule borne", () => {
    const run = byId('surf');
    const stored = withSetting({}, run.id, 'speedRange', nextSpeedRange(null, 'minMs', 1, defaultSpeedRangeOf(run)));
    expect(settingsView(stored!, run).speedRange).toEqual({ minMs: 1, maxMs: defaultSpeedRangeOf(run).maxMs });
  });
});

describe('limites des zones sur la courbe de FC (case « Zones », 05/11)', () => {
  const run = byId('surf');
  const bike = byId('wingfoil');

  it('décochées par défaut', () => {
    expect(effectiveHrZoneLines({}, run)).toBe(false);
    expect(settingsView({}, run).hrZoneLines).toBe(false);
  });

  it('cochées pour une activité seulement, « non » effacé', () => {
    const on = withSetting({}, run.id, 'hrZoneLines', true)!;
    expect(on.hrZoneLines).toEqual({ [run.id]: true });
    expect(effectiveHrZoneLines(on, run)).toBe(true);
    expect(effectiveHrZoneLines(on, bike)).toBe(false);
    expect(withSetting(on, run.id, 'hrZoneLines', false)!.hrZoneLines).toEqual({});
  });

  it('une valeur relue d’un fichier qui n’est pas « oui » vaut non ; une valeur absurde n’est pas écrite', () => {
    expect(effectiveHrZoneLines({ hrZoneLines: { [run.id]: 'oui' as unknown as boolean } }, run)).toBe(false);
    expect(withSetting({}, run.id, 'hrZoneLines', 1 as unknown as boolean)).toBeNull();
  });
});
