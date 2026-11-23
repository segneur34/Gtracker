import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVITY_PALETTE, DEFAULT_ACTIVITIES, SURF_ACTIVITY, SURF_FOIL_ACTIVITY, activitiesOfFamily,
  activityCounts, activityDisplayName, activityFamily, baseActivity, findActivity, insertActivity, isActivityShown, isFamilyHidden,
  keepUnknownActivities, logoColor, newActivityId, nextActivityColor, paletteColorText, readActivities, sessionActivity,
  sportDisplayName, storedActivityIds, visibleActivities, visibleFamilies, withHidden, withPaletteColors, type Activity,
} from './activities';
import { CONTEXT_MARK, setLanguage, type Dictionary } from './i18n';
import { SPORT_PROFILES } from './sportProfiles';
import type { SportType } from './types';

const moth: Activity = { id: 'a-moth', name: 'Moth à foil', base: 'wingfoil', color: '#2e7d32' };
const paddle: Activity = { id: 'a-paddle', name: 'Paddle', base: 'surf', color: '#e6c229' };
const voile = DEFAULT_ACTIVITIES[0];
const voiles = DEFAULT_ACTIVITIES.filter((a) => activityFamily(a) === 'voile').map((a) => a.name);
const surfs = DEFAULT_ACTIVITIES.filter((a) => activityFamily(a) === 'surf').map((a) => a.name);

describe('readActivities', () => {
  it('rend celles du premier lancement quand la liste est absente', () => {
    expect(readActivities(undefined)).toEqual(DEFAULT_ACTIVITIES);
    // Une copie : la modifier ne touche pas la constante.
    const copy = readActivities(undefined);
    expect(copy).not.toBe(DEFAULT_ACTIVITIES);
    copy[0].name = 'Autre';
    copy.pop();
    expect(DEFAULT_ACTIVITIES[0].name).toBe('Wingfoil');
  });

  it('la liste de départ : onze activités, leur calcul, quatre visibles', () => {
    expect(DEFAULT_ACTIVITIES.map((a) => [a.id, a.name, a.base, a.hidden === true])).toEqual([
      ['wingfoil', 'Wingfoil', 'wingfoil', false],
      ['a-parawing', 'Parawing', 'wingfoil', true],
      ['windsurf', 'Windsurf', 'windsurf', true],
      ['a-windfoil', 'Windfoil', 'windsurf', true],
      ['kite', 'Kite', 'kite', false],
      ['a-kitefoil', 'Kitefoil', 'kite', true],
      ['bateau', 'Bateau', 'bateau', true],
      ['surf', 'Surf', 'surf', false],
      ['a-paddle', 'Paddle', 'surf', true],
      ['a-surf-foil', 'Surf foil', 'surf', true],
      ['a-pumping', 'Pumping', 'surf', false],
    ]);
    expect(visibleActivities(DEFAULT_ACTIVITIES, []).map((a) => a.name)).toEqual(['Wingfoil', 'Kite', 'Surf', 'Pumping']);
    expect(DEFAULT_ACTIVITIES.map((a) => [a.name, a.color])).toEqual([
      ['Wingfoil', '#003e52'], ['Parawing', '#72b0bd'], ['Windsurf', '#1e88e5'], ['Windfoil', '#6236c9'],
      ['Kite', '#ff7a1a'], ['Kitefoil', '#e0218a'], ['Bateau', '#8e1b2e'], ['Surf', '#000000'],
      ['Paddle', '#e6c229'], ['Surf foil', '#646464'], ['Pumping', '#0e8f4f'],
    ]);
    for (const a of DEFAULT_ACTIVITIES) expect(ACTIVITY_PALETTE.map((c) => c.light)).toContain(a.color);
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
    const [kite] = readActivities([{ id: 'a-kite', name: 'Kite', base: 'kite', color: '#ff7a1a', icon: 'course' }]);
    expect(kite).toEqual({ id: 'a-kite', name: 'Kite', base: 'kite', color: '#ff7a1a' });
  });

  it('relit une ancienne icône en son logo, sans remise à zéro', () => {
    const list = readActivities([
      { id: 'a-planche', name: 'Planche', base: 'windsurf', color: '#ff7a1a', icon: 'planche' },
      { id: 'a-pirogue', name: 'Pirogue', base: 'surf', color: '#ff7a1a', icon: 'kayak' },
      { id: 'a-sup-foil', name: 'Sup foil', base: 'surf', color: '#ff7a1a', icon: 'paddle-foil' },
      { id: 'a-wing', name: 'Wing', base: 'wingfoil', color: '#ff7a1a', icon: 'kite' },
    ]);
    expect(list.map((a) => a.icon)).toEqual(['windsurf', 'paddle', 'surf-foil', 'kite']);
  });

  it('colore un logo choisi hors d’une activité de celle qui le porte, sinon de l’activité de départ', () => {
    const red = { ...moth, color: '#d11a1a', icon: 'kite' as const };
    expect(logoColor('kite', [red, ...DEFAULT_ACTIVITIES])).toBe('#d11a1a');
    expect(logoColor('kite', [])).toBe(DEFAULT_ACTIVITIES.find((a) => a.id === 'kite')!.color);
    expect(logoColor('pumping', [moth])).toBe(DEFAULT_ACTIVITIES.find((a) => a.id === 'a-pumping')!.color);
  });
});

describe('reprise des couleurs de l’ancienne palette', () => {
  const colorOf = (list: Activity[], id: string) => list.find((a) => a.id === id)?.color;

  it('une activité de départ à une ancienne nuance, claire ou sombre, prend sa couleur de départ', () => {
    const list = readActivities([
      { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#004aad' },
      { id: 'kite', name: 'Kite', base: 'kite', color: '#7c98ff' },
      { id: 'a-pumping', name: 'Pumping', base: 'surf', color: '#223246' },
    ]);
    expect(list.map((a) => a.color)).toEqual(['#003e52', '#ff7a1a', '#0e8f4f']);
  });

  it('une activité créée prend la première couleur libre ; deux, dans l’ordre de la liste', () => {
    const list = readActivities([
      ...DEFAULT_ACTIVITIES,
      { id: 'a-moth', name: 'Moth', base: 'wingfoil', color: '#192f94' },
      { id: 'a-sup', name: 'SUP', base: 'surf', color: '#0a1a2e' },
    ]);
    // Le blanc, seul libre, va à la première ; les douze prises, la seconde reprend la palette dans l'ordre.
    expect(colorOf(list, 'a-moth')).toBe('#ffffff');
    expect(colorOf(list, 'a-sup')).toBe(ACTIVITY_PALETTE[list.length % ACTIVITY_PALETTE.length].light);
    const few = readActivities([
      { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#004aad' },
      { id: 'a-moth', name: 'Moth', base: 'wingfoil', color: '#192f94' },
      { id: 'a-sup', name: 'SUP', base: 'surf', color: '#0A1A2E' },
    ]);
    expect(few.map((a) => a.color)).toEqual(['#003e52', '#ffffff', '#72b0bd']);
  });

  it('les majuscules ne gênent pas la reprise', () => {
    expect(readActivities([{ id: 'surf', name: 'Surf', base: 'surf', color: '#5B6670' }])[0].color).toBe('#000000');
  });

  it('une couleur déjà neuve ou inconnue ne bouge pas', () => {
    const kept = [
      { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil' as const, color: '#e0218a' },
      { id: 'a-moth', name: 'Moth', base: 'wingfoil' as const, color: '#2e7d32' },
      { id: 'kite', name: 'Kite', base: 'kite' as const, color: '#123456' },
    ];
    expect(readActivities(kept)).toEqual(kept);
    // Rien d'ancien : la liste lue est rendue telle quelle, sans copie de plus.
    expect(withPaletteColors(kept)).toBe(kept);
  });

  it('une activité créée ne prend pas la couleur qu’une activité de départ vient de reprendre', () => {
    const list = readActivities([
      { id: 'a-moth', name: 'Moth', base: 'wingfoil', color: '#014e86' },
      { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#004aad' },
      { id: 'surf', name: 'Surf', base: 'surf', color: '#ffffff' },
    ]);
    // Le blanc est déjà porté par Surf, l'océan par Wingfoil : la suivante est le lagon.
    expect(list.map((a) => a.color)).toEqual(['#72b0bd', '#003e52', '#ffffff']);
  });
});

describe('famille d\'une activité', () => {
  it('range le surf dans sa famille', () => {
    expect(activityFamily(SURF_FOIL_ACTIVITY)).toBe('surf');
  });

  it('range dans la voile une activité créée sur un calcul de voile, et le bateau', () => {
    expect(activityFamily(moth)).toBe('voile');
    expect(activityFamily(baseActivity('bateau'))).toBe('voile');
  });
});

describe('insertActivity', () => {
  const names = (list: Activity[]) => list.map((a) => a.name);

  it('range une activité après la dernière de sa famille', () => {
    expect(names(insertActivity(DEFAULT_ACTIVITIES, moth))).toEqual([...voiles, 'Moth à foil', ...surfs]);
    expect(names(insertActivity(DEFAULT_ACTIVITIES, paddle))).toEqual([...voiles, ...surfs, 'Paddle']);
  });

  it('sans activité de sa famille, la place avant les familles qui la suivent', () => {
    expect(names(insertActivity([SURF_ACTIVITY], moth))).toEqual(['Moth à foil', 'Surf']);
    expect(names(insertActivity([voile], paddle))).toEqual(['Wingfoil', 'Paddle']);
    expect(names(insertActivity([], moth))).toEqual(['Moth à foil']);
  });
});

describe('sessionActivity', () => {
  const activities = [voile, moth, paddle];

  it("prend l'activité désignée par la fiche", () => {
    expect(sessionActivity(activities, 'a-moth', 'wingfoil')).toBe(moth);
  });

  it("une activité supprimée rattache la session à l'activité de départ de son calcul, si elle existe", () => {
    expect(sessionActivity(activities, 'a-supprimee', 'wingfoil')).toBe(voile);
  });

  it("une activité supprimée sans activité de départ laisse la session sous le nom de son calcul", () => {
    expect(sessionActivity([moth, paddle], 'a-supprimee', 'wingfoil')).toEqual(baseActivity('wingfoil'));
    expect(sessionActivity(activities, 'a-supprimee', 'kite')).toEqual(baseActivity('kite'));
  });

  it("une activité de départ recolorée donne sa couleur aux sessions d'une activité disparue", () => {
    const violette = { ...voile, color: '#6236c9' };
    expect(sessionActivity([violette, moth], 'a-wingfoil', 'wingfoil')?.color).toBe('#6236c9');
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
    expect(sessionActivity(activities, 'a-paddle', 'wingfoil')).toBe(voile);
    expect(sessionActivity([moth, paddle], 'a-paddle', 'wingfoil')).toEqual(baseActivity('wingfoil'));
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

describe('entrées d\'un calcul inconnu dans la liste rangée', () => {
  const futur = { id: 'a-ski', name: 'Ski', base: 'ski', color: '#123456', reglage: 1 };
  const autre = { id: 'a-luge', name: 'Luge', base: 'luge', color: '#654321' };
  const wing = { id: 'wingfoil', name: 'Wingfoil', base: 'wingfoil', color: '#ffffff' };
  const kite = { id: 'kite', name: 'Kite', base: 'kite', color: '#ff7a1a' };

  it('storedActivityIds : tous les identifiants, entrées écartées comprises', () => {
    expect(storedActivityIds([wing, futur, { id: '', base: 'kite' }, 'abîmé', { name: 'sans id' }, kite])).toEqual(['wingfoil', 'a-ski', 'kite']);
    expect(storedActivityIds(undefined)).toEqual([]);
    expect(storedActivityIds({ id: 'a' })).toEqual([]);
  });

  it('keepUnknownActivities : l\'entrée revient après sa voisine d\'avant, ou en tête', () => {
    expect(keepUnknownActivities([wing, kite], [wing, futur, kite])).toEqual([wing, futur, kite]);
    expect(keepUnknownActivities([kite], [futur, autre, kite])).toEqual([futur, autre, kite]);
    expect(keepUnknownActivities([wing, kite], [wing, kite, futur])).toEqual([wing, kite, futur]);
  });

  it('keepUnknownActivities : une entrée d\'un calcul connu, absente, ne revient pas ; rien à remettre : la même liste', () => {
    expect(keepUnknownActivities([wing], [wing, kite])).toEqual([wing]);
    const same = [wing, futur];
    expect(keepUnknownActivities(same, [futur, wing])).toBe(same);
  });

  it('readActivities les écarte, la liste lue ne les montre pas', () => {
    expect(readActivities([wing, futur]).map((a) => a.id)).toEqual(['wingfoil']);
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

  it('ne reprend pas un identifiant réservé, même absent de la liste', () => {
    expect(newActivityId('Ski', [], ['a-ski'])).toBe('a-ski-2');
    expect(newActivityId('Ski', [{ ...moth, id: 'a-ski-2' }], ['a-ski'])).toBe('a-ski-3');
    expect(newActivityId('Ski', [], ['a-autre'])).toBe('a-ski');
    // Sans réservés, le résultat est celui d'avant.
    expect(newActivityId('Ski', [], [])).toBe(newActivityId('Ski', []));
  });

  it('propose la première couleur libre de la palette, le blanc d\'abord, puis les reprend dans l\'ordre', () => {
    expect(nextActivityColor([])).toBe('#ffffff');
    expect(nextActivityColor(DEFAULT_ACTIVITIES)).toBe('#ffffff');
    expect(nextActivityColor([{ ...voile, color: '#FFFFFF' }])).toBe(ACTIVITY_PALETTE[1].light);
    // Toute activité, de voile ou de surf, puise dans la même palette.
    expect(nextActivityColor([{ ...paddle, color: '#ffffff' }, voile])).toBe(ACTIVITY_PALETTE[2].light);
    const twelve = ACTIVITY_PALETTE.map((c, i): Activity => ({ id: `s${i}`, name: `S${i}`, base: 'surf', color: c.light }));
    expect(nextActivityColor(twelve)).toBe(ACTIVITY_PALETTE[0].light);
    expect(nextActivityColor([...twelve, { ...twelve[0], id: 's12' }])).toBe(ACTIVITY_PALETTE[1].light);
  });
});

describe('activityCounts', () => {
  it('compte dans l’ordre donné, puis dans l’ordre d’apparition, sans les activités absentes', () => {
    const kite = baseActivity('kite');
    const counts = activityCounts([moth, null, kite, moth, voile], [voile, paddle, moth]);
    expect(counts.map((c) => [c.activity.id, c.count])).toEqual([[voile.id, 1], [moth.id, 2], ['kite', 1]]);
  });
});

describe('familles et activités cachées', () => {
  // Surf foil est déjà cachée au départ : `hiddenFoil` en garde la forme, `withFoilHidden` est la liste de départ.
  const hiddenFoil = withHidden(SURF_FOIL_ACTIVITY, true);
  const withFoilHidden = DEFAULT_ACTIVITIES;

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
    expect(visibleActivities(withFoilHidden, [], 'surf').map((a) => a.name)).toEqual(['Surf', 'Pumping']);
    expect(visibleActivities(withFoilHidden, []).map((a) => a.name)).not.toContain('Surf foil');
  });

  it("l'activité de base d'un calcul suit sa famille", () => {
    expect(isActivityShown(baseActivity('kite'), DEFAULT_ACTIVITIES, [])).toBe(true);
    expect(isActivityShown(baseActivity('kite'), DEFAULT_ACTIVITIES, ['voile'])).toBe(false);
    expect(isActivityShown(hiddenFoil, withFoilHidden, [])).toBe(false);
  });
});

describe("noms d'origine traduits à l'affichage seulement", () => {
  const sports = Object.keys(SPORT_PROFILES) as SportType[];
  const originalNames = [...DEFAULT_ACTIVITIES.map((a) => a.name), ...sports.map((s) => SPORT_PROFILES[s].label)];
  const colorNames = ACTIVITY_PALETTE.flatMap((c) => (c.darkName ? [c.name, c.darkName] : [c.name]));
  const english: Dictionary = {
    ...Object.fromEntries(originalNames.map((name) => [name, `EN ${name}`])),
    ...Object.fromEntries(colorNames.map((name) => [`${name}${CONTEXT_MARK}couleur`, `EN couleur ${name}`])),
  };

  afterEach(() => setLanguage('fr', {}));

  it('en français, chaque nom ressort tel quel', () => {
    for (const a of DEFAULT_ACTIVITIES) expect(activityDisplayName(a)).toBe(a.name);
    for (const s of sports) {
      expect(activityDisplayName(baseActivity(s))).toBe(SPORT_PROFILES[s].label);
      expect(sportDisplayName(s)).toBe(SPORT_PROFILES[s].label);
    }
    for (const name of colorNames) expect(paletteColorText(name)).toBe(name);
  });

  it("dans une autre langue, toutes les activités de départ et tous les libellés de calcul se traduisent", () => {
    setLanguage('en', english);
    for (const a of DEFAULT_ACTIVITIES) expect(activityDisplayName(a)).toBe(`EN ${a.name}`);
    for (const s of sports) {
      expect(activityDisplayName(baseActivity(s))).toBe(`EN ${SPORT_PROFILES[s].label}`);
      expect(sportDisplayName(s)).toBe(`EN ${SPORT_PROFILES[s].label}`);
    }
  });

  it('une activité renommée ou créée garde son nom, même pareil à un nom d’origine', () => {
    setLanguage('en', english);
    expect(activityDisplayName({ id: 'bateau', name: 'Mon bateau' })).toBe('Mon bateau');
    expect(activityDisplayName({ id: 'a-bateau', name: 'Bateau' })).toBe('Bateau');
    expect(activityDisplayName({ id: 'wingfoil', name: 'Bateau' })).toBe('Bateau');
  });

  it('les douze couleurs et leurs noms de nuit se traduisent sous leur contexte ; un nom inconnu reste tel quel', () => {
    setLanguage('en', english);
    expect(new Set(ACTIVITY_PALETTE.map((c) => c.name)).size).toBe(12);
    for (const name of colorNames) expect(paletteColorText(name)).toBe(`EN couleur ${name}`);
    expect(paletteColorText('Turquoise')).toBe('Turquoise');
  });
});
