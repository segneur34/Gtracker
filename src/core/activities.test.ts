import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES_VERSION, DEFAULT_ACTIVITIES, FAMILY_SHADES, SURF_ACTIVITY, SURF_FOIL_ACTIVITY, activitiesOfFamily,
  activityCounts, activityFamily, activityTreatment, baseActivity, findActivity, insertActivity, isActivityShown, isFamilyHidden,
  newActivityId, nextActivityColor, readActivities, recolorActivities, sessionActivity, upgradeActivities,
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

  it("ignore une icône de l'application complète : elle redevient devinée", () => {
    const [kite] = readActivities([{ id: 'a-kite', name: 'Kite', base: 'kite', color: '#4458c2', icon: 'course' }]);
    expect(kite).toEqual({ id: 'a-kite', name: 'Kite', base: 'kite', color: '#4458c2' });
  });
});

describe('upgradeActivities', () => {
  it('la version reste à 9 : les graines à terre des versions 2, 3, 6, 8 et 9 ne reviennent jamais', () => {
    expect(ACTIVITIES_VERSION).toBe(9);
    // Une liste de la version 1 ne reçoit que le surf, et ses couleurs.
    expect(upgradeActivities([voile], 1).map((a) => a.name)).toEqual(['Voile', ...surfs]);
    for (const version of [5, 6, 7, 8]) expect(upgradeActivities([voile], version)).toEqual([voile]);
    // Une activité à terre déjà là (relue plus tôt, puis écartée par `readActivities`) n'est jamais renommée.
    const vieux: Activity = { id: 'a-velo', name: 'Vélo', base: 'wingfoil', color: '#014e86' };
    expect(upgradeActivities([voile, vieux], 1).find((a) => a.id === 'a-velo')?.name).toBe('Vélo');
  });

  it('une liste de la version 4 reçoit le surf, dans ses nuances', () => {
    const upgraded = upgradeActivities([voile], 4);
    expect(upgraded.map((a) => a.name)).toEqual(['Voile', ...surfs]);
    expect(upgraded.slice(1).map((a) => a.color)).toEqual([FAMILY_SHADES.surf[0], FAMILY_SHADES.surf[1]]);
    // Un « Surf » déjà créé par l'utilisateur, sur ce calcul, n'est pas doublé.
    const mine: Activity = { id: 'a-surf', name: 'surf', base: 'surf', color: FAMILY_SHADES.surf[2] };
    expect(upgradeActivities([voile, mine], 4).map((a) => a.id)).toEqual(['wingfoil', 'a-surf', SURF_FOIL_ACTIVITY.id]);
    // Supprimés ensuite, ils ne reviennent pas.
    expect(upgradeActivities([voile], 5)).toEqual([voile]);
  });

  it('prend une couleur libre si la sienne est déjà portée', () => {
    const grey: Activity = { ...paddle, color: SURF_ACTIVITY.color };
    const surf = upgradeActivities([voile, grey], 4).find((a) => a.id === SURF_ACTIVITY.id)!;
    expect(surf.color).not.toBe(SURF_ACTIVITY.color);
  });

  it('ne change plus rien une fois faite', () => {
    const once = upgradeActivities([voile, moth], 1);
    expect(upgradeActivities(once, 9)).toEqual(once);
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

describe('recolorActivities (version 4)', () => {
  const old = (a: Activity, color: string): Activity => ({ ...a, color });

  it('donne à une liste d\'avant les nuances de chaque famille, dans l\'ordre de la liste', () => {
    const before = [old(voile, '#1565c0'), old(moth, '#2e7d32'), old(SURF_ACTIVITY, '#bf360c'), old(paddle, '#00695c')];
    expect(recolorActivities(before).map((a) => a.color)).toEqual([
      FAMILY_SHADES.voile[0], FAMILY_SHADES.voile[1], FAMILY_SHADES.surf[0], FAMILY_SHADES.surf[1],
    ]);
  });

  it('garde une nuance déjà juste, et recolore un doublon ou la nuance d\'une autre famille', () => {
    const kept = old(moth, FAMILY_SHADES.voile[0]);
    const twin = old(voile, FAMILY_SHADES.voile[0]);
    const foreign = old(paddle, FAMILY_SHADES.voile[2]);
    expect(recolorActivities([twin, kept, foreign]).map((a) => a.color)).toEqual([
      FAMILY_SHADES.voile[0], FAMILY_SHADES.voile[1], FAMILY_SHADES.surf[0],
    ]);
    // Une nuance juste plus bas dans la liste reste à son activité.
    const later = old(moth, FAMILY_SHADES.voile[0]);
    expect(recolorActivities([old(voile, '#123456'), later]).map((a) => a.color)).toEqual([FAMILY_SHADES.voile[1], FAMILY_SHADES.voile[0]]);
  });

  it('ne change rien à une liste déjà juste', () => {
    expect(recolorActivities(DEFAULT_ACTIVITIES)).toEqual(DEFAULT_ACTIVITIES);
  });

  it('passe par upgradeActivities pour une liste de la version 3', () => {
    expect(upgradeActivities([old(voile, '#1565c0'), old(paddle, '#bf360c')], 3).map((a) => a.color)).toEqual([
      FAMILY_SHADES.voile[0], FAMILY_SHADES.surf[2], FAMILY_SHADES.surf[0], FAMILY_SHADES.surf[1],
    ]);
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

  it("une liste mise à jour garde l'activité cachée", () => {
    const old = [voile, withHidden(paddle, true)];
    expect(upgradeActivities(old, 4).find((a) => a.id === paddle.id)?.hidden).toBe(true);
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
