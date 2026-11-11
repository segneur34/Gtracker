import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVITIES, FAMILY_SHADES, SURF_ACTIVITY, SURF_FOIL_ACTIVITY, activitiesOfFamily,
  activityCounts, activityFamily, activityTreatment, baseActivity, findActivity, insertActivity, isActivityShown, isFamilyHidden,
  newActivityId, nextActivityColor, readActivities, sessionActivity,
  visibleActivities, visibleFamilies, withHidden, type Activity,
} from './activities';
import { SPORT_FAMILIES, usesMarkCourse } from './sportProfiles';

const moth: Activity = { id: 'a-moth', name: 'Moth à foil', base: 'wingfoil', color: '#2e7d32' };
const paddle: Activity = { id: 'a-paddle', name: 'Paddle', base: 'surf', color: '#847c6e' };
const voile = DEFAULT_ACTIVITIES[0];
const surfs = [SURF_ACTIVITY.name, SURF_FOIL_ACTIVITY.name];

describe('readActivities', () => {
  it('rend celles du premier lancement quand la liste est absente', () => {
    expect(readActivities(undefined)).toEqual(DEFAULT_ACTIVITIES);
    // Une copie : la modifier ne touche pas la constante.
    const copy = readActivities(undefined);
    expect(copy).not.toBe(DEFAULT_ACTIVITIES);
    copy[0].name = 'Autre';
    copy.pop();
    expect(DEFAULT_ACTIVITIES[0].name).toBe('Voile');
    expect(DEFAULT_ACTIVITIES.map((a) => [a.name, a.base])).toEqual([['Voile', 'wingfoil'], ['Surf', 'surf'], ['Surf foil', 'surf']]);
  });

  it('garde une liste vide, écarte les entrées abîmées et les doublons', () => {
    expect(readActivities([])).toEqual([]);
    const list = readActivities([
      moth,
      { ...moth, name: 'Doublon' },
      { id: 'x', name: '  ', base: 'kite' },
      { id: 'y', name: 'Inconnu', base: 'parapente' },
      { id: 'z', name: ' Kite ', base: 'kite', color: 'rouge' },
    ]);
    expect(list).toEqual([moth, { id: 'z', name: 'Kite', base: 'kite', color: baseActivity('kite').color }]);
  });

  it("écarte les activités posées sur un calcul inconnu", () => {
    const list = readActivities([
      voile,
      { id: 'a-parapente', name: 'Parapente', base: 'parapente', color: '#d11a1a' },
      { id: 'a-planeur', name: 'Planeur', base: 'planeur', color: '#0a9469' },
      { id: 'a-ski', name: 'Ski', base: 'ski', color: '#123456' },
      SURF_ACTIVITY,
    ]);
    expect(list.map((a) => a.id)).toEqual(['wingfoil', 'surf']);
  });

  it('ignore une icône inconnue : elle redevient devinée', () => {
    const [kite] = readActivities([{ id: 'a-kite', name: 'Kite', base: 'kite', color: '#4458c2', icon: 'course' }]);
    expect(kite).toEqual({ id: 'a-kite', name: 'Kite', base: 'kite', color: '#4458c2' });
  });
});

describe('famille et traitement', () => {
  it('range le surf dans sa famille, traité à part', () => {
    expect(activityFamily(SURF_FOIL_ACTIVITY)).toBe('surf');
    expect(activityTreatment(SURF_FOIL_ACTIVITY)).toBe('surf');
  });

  it('confond famille et traitement pour la voile', () => {
    expect(activityFamily(moth)).toBe('voile');
    expect(activityTreatment(moth)).toBe('voile');
    expect(activityFamily(baseActivity('bateau'))).toBe('voile');
  });
});

describe('insertActivity', () => {
  const names = (list: Activity[]) => list.map((a) => a.name);

  it('range une activité après la dernière de sa famille', () => {
    expect(names(insertActivity(DEFAULT_ACTIVITIES, moth))).toEqual(['Voile', 'Moth à foil', ...surfs]);
    expect(names(insertActivity(DEFAULT_ACTIVITIES, paddle))).toEqual(['Voile', ...surfs, 'Paddle']);
  });

  it('sans activité de sa famille, la place avant les familles qui la suivent', () => {
    expect(names(insertActivity([SURF_ACTIVITY], moth))).toEqual(['Moth à foil', 'Surf']);
    expect(names(insertActivity([voile], paddle))).toEqual(['Voile', 'Paddle']);
    expect(names(insertActivity([], moth))).toEqual(['Moth à foil']);
  });
});

describe('sessionActivity', () => {
  const activities = [voile, moth, paddle];

  it("prend l'activité désignée par la fiche", () => {
    expect(sessionActivity(activities, 'a-moth', 'wingfoil')).toBe(moth);
  });

  it("une activité supprimée laisse la session sous le nom de son calcul", () => {
    expect(sessionActivity(activities, 'a-supprimee', 'wingfoil')).toEqual(baseActivity('wingfoil'));
  });

  it("une fiche sans activité va à l'activité de même identifiant que son calcul, sinon à la première de ce calcul", () => {
    expect(sessionActivity(activities, null, 'wingfoil')).toBe(voile);
    expect(sessionActivity([moth, paddle], undefined, 'surf')).toBe(paddle);
    expect(sessionActivity(activities, null, 'kite')).toEqual(baseActivity('kite'));
  });

  it('rend null pour une session à classer', () => {
    expect(sessionActivity(activities, 'a-moth', null)).toBeNull();
  });

  it("n'accepte pas une activité d'un autre calcul", () => {
    expect(sessionActivity(activities, 'a-paddle', 'wingfoil')).toEqual(baseActivity('wingfoil'));
  });
});

describe('findActivity et activitiesOfFamily', () => {
  it("retrouve une activité, ou l'activité de base d'un calcul", () => {
    expect(findActivity([moth], 'a-moth')).toBe(moth);
    expect(findActivity([moth], 'bateau')).toEqual(baseActivity('bateau'));
    expect(findActivity([moth], 'a-inconnue')).toBeNull();
    expect(findActivity([moth], null)).toBeNull();
    // L'identifiant d'un calcul inconnu n'en est pas un.
    expect(findActivity([moth], 'parapente')).toBeNull();
  });

  it('range par famille', () => {
    expect(activitiesOfFamily([voile, moth, paddle], 'voile')).toEqual([voile, moth]);
    expect(activitiesOfFamily([voile, moth, paddle], 'surf')).toEqual([paddle]);
  });
});

describe('newActivityId et nextActivityColor', () => {
  it('tire un identifiant unique du nom, jamais celui d\'un calcul', () => {
    expect(newActivityId('Moth à foil', [])).toBe('a-moth-a-foil');
    expect(newActivityId('Moth à foil', [{ ...moth, id: 'a-moth-a-foil' }])).toBe('a-moth-a-foil-2');
    expect(newActivityId('Kite', [])).toBe('a-kite');
    expect(newActivityId('10 000 m', [])).toBe('a-10-000-m');
    expect(newActivityId('!!!', [])).toBe('a-activite');
  });

  it('propose la première nuance libre de la famille, puis les reprend dans l\'ordre', () => {
    expect(nextActivityColor([voile], 'voile')).toBe(FAMILY_SHADES.voile[1]);
    expect(nextActivityColor([voile], 'surf')).toBe(FAMILY_SHADES.surf[0]);
    const six = FAMILY_SHADES.surf.map((color, i): Activity => ({ id: `s${i}`, name: `S${i}`, base: 'surf', color }));
    expect(nextActivityColor(six, 'surf')).toBe(FAMILY_SHADES.surf[0]);
    expect(nextActivityColor([...six, { ...six[0], id: 's6' }], 'surf')).toBe(FAMILY_SHADES.surf[1]);
  });
});

describe('activityCounts', () => {
  it('compte dans l’ordre donné, puis dans l’ordre d’apparition, sans les activités absentes', () => {
    const kite = baseActivity('kite');
    const counts = activityCounts([moth, null, kite, moth, voile], [voile, paddle, moth]);
    expect(counts.map((c) => [c.activity.id, c.count])).toEqual([[voile.id, 1], [moth.id, 2], ['kite', 1]]);
  });
});

describe('familles et activités cachées (point 100)', () => {
  const hiddenFoil = withHidden(SURF_FOIL_ACTIVITY, true);
  const withFoilHidden = DEFAULT_ACTIVITIES.map((a) => (a.id === SURF_FOIL_ACTIVITY.id ? hiddenFoil : a));

  it('readActivities garde « hidden: true » et ignore toute autre valeur', () => {
    const [kept, ignored] = readActivities([{ ...moth, hidden: true }, { ...paddle, hidden: 'oui' }]);
    expect(kept).toEqual({ ...moth, hidden: true });
    expect(ignored).toEqual(paddle);
    expect('hidden' in ignored).toBe(false);
  });

  it('withHidden pose ou retire le champ, sans le laisser à faux', () => {
    expect(withHidden(moth, true)).toEqual({ ...moth, hidden: true });
    expect(withHidden(withHidden(moth, true), false)).toEqual(moth);
    expect('hidden' in withHidden(withHidden(moth, true), false)).toBe(false);
  });

  it('une famille est cachée par Réglages, ou quand toutes ses activités le sont', () => {
    expect(isFamilyHidden(DEFAULT_ACTIVITIES, ['surf'], 'surf')).toBe(true);
    expect(isFamilyHidden(withFoilHidden, [], 'surf')).toBe(false);
    const allSurfs = DEFAULT_ACTIVITIES.map((a) => (activityFamily(a) === 'surf' ? withHidden(a, true) : a));
    expect(isFamilyHidden(allSurfs, [], 'surf')).toBe(true);
    // Sans activité, une famille est cachée aussi.
    expect(isFamilyHidden([voile], [], 'surf')).toBe(true);
    expect(isFamilyHidden([voile], [], 'voile')).toBe(false);
  });

  it("les familles inconnues cachées dans un réglage repris ne cachent rien d'ici", () => {
    const hidden = ['ski', 'parapente'];
    expect(visibleFamilies(DEFAULT_ACTIVITIES, hidden)).toEqual(['voile', 'surf']);
    expect(isActivityShown(voile, DEFAULT_ACTIVITIES, hidden)).toBe(true);
  });

  it('visibleFamilies et visibleActivities', () => {
    expect(visibleFamilies(withFoilHidden, ['surf'])).toEqual(['voile']);
    expect(visibleFamilies(withFoilHidden, [])).toEqual(['voile', 'surf']);
    expect(visibleActivities(withFoilHidden, [], 'surf').map((a) => a.name)).toEqual(['Surf']);
    expect(visibleActivities(withFoilHidden, []).map((a) => a.name)).not.toContain('Surf foil');
  });

  it("l'activité de base d'un calcul suit sa famille", () => {
    expect(isActivityShown(baseActivity('kite'), DEFAULT_ACTIVITIES, [])).toBe(true);
    expect(isActivityShown(baseActivity('kite'), DEFAULT_ACTIVITIES, ['voile'])).toBe(false);
    expect(isActivityShown(hiddenFoil, withFoilHidden, [])).toBe(false);
  });
});

describe('usesMarkCourse', () => {
  it('voile et surf naviguent sur un parcours de balises', () => {
    expect(SPORT_FAMILIES).toEqual(['voile', 'surf']);
    expect(SPORT_FAMILIES.filter(usesMarkCourse)).toEqual(['voile', 'surf']);
    expect(usesMarkCourse(activityFamily(SURF_FOIL_ACTIVITY))).toBe(true);
  });
});
