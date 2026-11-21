import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TILE_TABS, PANEL_HEAD_VISIBLE_PX, SAILING_TABS, SURF_TABS, TILE_TABS, activityTabs, panelNeedsScroll, tabAnchorId, tileTab, analysisTabs, closeAllTabs, generalOpenAfterAdvanced, initialTabsState, isTabOpenOnScreen, isTabShown, keepOpenTabEntries, maskAdvancedTabs, openAllTabs, tabsBulkAction, maskHiddenTabs, revealTab, sanitizeTabChoices, shownTabs, tabDefaults, tabsStateFor, toggleTabChoice, toggleTabFromTile,
  type TabChoices,
} from './analysisTabs';
import { SPORT_PROFILES } from './sportProfiles';

const keys = (tabs: readonly { key: string }[]) => tabs.map((t) => t.key);
const tab = (tabs: readonly { key: string; label: string; generic?: true }[], key: string) => tabs.find((t) => t.key === key)!;

describe('analysisTabs : onglets proposés par calcul', () => {
  it('voile : la barre de la voile, « sauts » et « pumping » compris, sauf en bateau', () => {
    expect(keys(analysisTabs(SPORT_PROFILES.wingfoil))).toEqual(keys(SAILING_TABS));
    expect(keys(analysisTabs(SPORT_PROFILES.bateau))).not.toContain('sauts');
    expect(keys(analysisTabs(SPORT_PROFILES.bateau))).not.toContain('pumping');
  });

  it('voile : « vols » puis « pumping » juste après « sauts »', () => {
    const order = keys(SAILING_TABS);
    expect(order.indexOf('vols')).toBe(order.indexOf('sauts') + 1);
    expect(order.indexOf('pumping')).toBe(order.indexOf('vols') + 1);
    expect(keys(analysisTabs(SPORT_PROFILES.kite))).toContain('pumping');
  });

  it('ni « fractionné », ni « test », ni « cadence » : partis avec la terre', () => {
    for (const profile of Object.values(SPORT_PROFILES)) {
      for (const key of ['fractionne', 'test', 'cadence', 'zones', 'surface', 'energie']) expect(keys(analysisTabs(profile)), profile.id).not.toContain(key);
    }
  });

  it('surf : « pumping » juste après « vols », puis « tops » avant « graphiques »', () => {
    const surf = keys(analysisTabs(SPORT_PROFILES.surf));
    expect(surf).toEqual(keys(SURF_TABS));
    expect(surf.indexOf('pumping')).toBe(surf.indexOf('vols') + 1);
    expect(surf.indexOf('tops')).toBe(surf.indexOf('pumping') + 1);
    expect(surf.indexOf('graphiques')).toBe(surf.indexOf('tops') + 1);
  });

  it('chaque calcul qui propose « tops » a des cibles', () => {
    for (const profile of Object.values(SPORT_PROFILES)) {
      if (keys(analysisTabs(profile)).includes('tops')) expect(profile.topTargets.length, profile.id).toBeGreaterThan(0);
    }
  });
});

describe("activityTabs : onglets de Réglages selon les options de l'activité", () => {
  it("« sauts » seulement si l'activité mesure les sauts", () => {
    const wing = SPORT_PROFILES.wingfoil;
    expect(keys(activityTabs(wing, { foil: true, jumps: true }))).toContain('sauts');
    expect(keys(activityTabs(wing, { foil: true, jumps: false }))).not.toContain('sauts');
    expect(keys(activityTabs(SPORT_PROFILES.kite, { foil: false, jumps: true }))).toContain('sauts');
    expect(keys(activityTabs(SPORT_PROFILES.windsurf, { foil: false, jumps: false }))).not.toContain('sauts');
  });

  it('un calcul sans sauts ne les propose pas, même coché ; « vols » et « pumping » suivent le foil', () => {
    expect(keys(activityTabs(SPORT_PROFILES.bateau, { foil: false, jumps: true }))).not.toContain('sauts');
    const wing = SPORT_PROFILES.wingfoil;
    expect(keys(activityTabs(wing, { foil: false, jumps: true }))).not.toContain('vols');
    expect(keys(activityTabs(wing, { foil: true, jumps: true }))).toEqual(keys(analysisTabs(wing)));
  });
});

describe('isTabShown : défauts et choix', () => {
  it('sans choix, les onglets du module sont montrés, « tops » caché en surf', () => {
    expect(keys(shownTabs(SAILING_TABS, null))).toEqual(keys(SAILING_TABS));
    expect(keys(shownTabs(SAILING_TABS, null))).toContain('tops');
    expect(keys(shownTabs(SURF_TABS, null))).not.toContain('tops');
  });

  it('un choix l\'emporte sur le défaut, dans les deux sens', () => {
    const choices = { tops: true, vagues: false };
    expect(isTabShown(tab(SURF_TABS, 'tops'), choices)).toBe(true);
    expect(isTabShown(tab(SURF_TABS, 'vagues'), choices)).toBe(false);
    expect(isTabShown(tab(SURF_TABS, 'rame'), choices)).toBe(true);
  });

  it('une clé du prototype n\'est pas prise pour un choix', () => {
    expect(isTabShown({ key: 'toString', label: 'x' }, {})).toBe(true);
    expect(isTabShown({ key: 'constructor', label: 'x', generic: true }, {})).toBe(false);
  });
});

describe('sanitizeTabChoices', () => {
  it('garde les booléens, ignore le reste', () => {
    expect(sanitizeTabChoices({ tops: true, vmg: false, vent: 'non', [''.padEnd(41, 'x')]: true })).toEqual({ tops: true, vmg: false });
  });

  it('une clé inconnue est gardée, sans effet sur les onglets', () => {
    const choices = sanitizeTabChoices({ onglet_retire: false });
    expect(choices).toEqual({ onglet_retire: false });
    expect(keys(shownTabs(SURF_TABS, choices))).toEqual(keys(shownTabs(SURF_TABS, null)));
  });

  it('`null` pour une valeur mal formée ou vide', () => {
    expect(sanitizeTabChoices(null)).toBeNull();
    expect(sanitizeTabChoices(['tops'])).toBeNull();
    expect(sanitizeTabChoices('tops')).toBeNull();
    expect(sanitizeTabChoices({})).toBeNull();
    expect(sanitizeTabChoices({ tops: 1 })).toBeNull();
  });
});

describe('toggleTabChoice', () => {
  it('coche un onglet générique, puis revient au défaut', () => {
    const tops = tab(SURF_TABS, 'tops');
    const once = toggleTabChoice(null, tops, null);
    expect(once).toEqual({ tops: true });
    expect(toggleTabChoice(once, tops, null)).toBeNull();
  });

  it('cache un onglet du module, les autres choix gardés', () => {
    const next = toggleTabChoice({ tops: true }, tab(SURF_TABS, 'vagues'), null);
    expect(next).toEqual({ tops: true, vagues: false });
    expect(toggleTabChoice(next, tab(SURF_TABS, 'vagues'), null)).toEqual({ tops: true });
  });

  it('tout se cache, « général » et « réglages » compris', () => {
    let choices = null as ReturnType<typeof toggleTabChoice>;
    for (const t of SAILING_TABS) choices = toggleTabChoice(choices, t, null);
    expect(shownTabs(SAILING_TABS, choices)).toEqual([]);
  });
});

describe('toggleTabChoice : activité à pré-réglage', () => {
  /** Ce que lit l'application (`resolveTabChoices`) : le choix rangé, sinon le pré-réglage tout entier. */
  const resolved = (choices: TabChoices | null, preset: TabChoices | null) => sanitizeTabChoices(choices) ?? preset;
  // Pré-réglages d'essai : un onglet natif caché, un générique montré.
  const sauts = tab(SAILING_TABS, 'sauts');
  const cardio = tab(SAILING_TABS, 'cardio');
  const topsVoile = tab(SAILING_TABS, 'tops');
  const topsSurf = tab(SURF_TABS, 'tops');
  const HIDDEN = { sauts: false };
  const SHOWN = { tops: true };

  it('un onglet caché par le pré-réglage : un toucher le montre, un second revient au pré-réglage', () => {
    const once = toggleTabChoice(HIDDEN, sauts, HIDDEN);
    expect(isTabShown(sauts, resolved(once, HIDDEN))).toBe(true);
    expect(once).toEqual({ sauts: true });
    expect(toggleTabChoice(once, sauts, HIDDEN)).toBeNull();
  });

  it('un onglet générique montré par le pré-réglage : un toucher le cache, un second revient au pré-réglage', () => {
    const once = toggleTabChoice(SHOWN, topsSurf, SHOWN);
    expect(isTabShown(topsSurf, resolved(once, SHOWN))).toBe(false);
    expect(once).toEqual({ tops: false });
    expect(toggleTabChoice(once, topsSurf, SHOWN)).toBeNull();
  });

  it('chaque toucher change le bouton, dix fois de suite', () => {
    let stored: TabChoices | null = null;
    let shown = false;
    for (let i = 0; i < 10; i++) {
      stored = toggleTabChoice(resolved(stored, HIDDEN), sauts, HIDDEN);
      shown = !shown;
      expect(isTabShown(sauts, resolved(stored, HIDDEN)), `toucher ${i + 1}`).toBe(shown);
    }
  });

  it("un autre onglet changé puis remis ne change pas « sauts » et rend la marque « défaut »", () => {
    const changed = toggleTabChoice(HIDDEN, cardio, HIDDEN);
    expect(changed).toEqual({ sauts: false, cardio: false });
    expect(toggleTabChoice(changed, cardio, HIDDEN)).toBeNull();
  });

  it("« sauts » montré reste montré quand un autre onglet revient à son défaut", () => {
    const withTops = toggleTabChoice(toggleTabChoice(HIDDEN, topsVoile, HIDDEN), sauts, HIDDEN);
    expect(withTops).toEqual({ sauts: true, tops: false });
    const back = toggleTabChoice(withTops, topsVoile, HIDDEN);
    expect(back).toEqual({ sauts: true });
    expect(isTabShown(sauts, resolved(back, HIDDEN))).toBe(true);
  });

  it("un choix ancien, sans la clé du pré-réglage, ne retombe pas sur lui en se vidant", () => {
    // Rangé avant la clé du pré-réglage : « sauts » y est montré parce qu'absent.
    const old = { cardio: false };
    expect(isTabShown(sauts, old)).toBe(true);
    const back = toggleTabChoice(old, cardio, HIDDEN);
    expect(back).toEqual({ sauts: true });
    expect(isTabShown(sauts, resolved(back, HIDDEN))).toBe(true);
    expect(isTabShown(cardio, resolved(back, HIDDEN))).toBe(true);
  });

  it("un choix égal au pré-réglage s'efface, quel que soit l'ordre de ses clés", () => {
    const preset = { sauts: false, cardio: false };
    expect(toggleTabChoice({ cardio: false, sauts: true }, sauts, preset)).toBeNull();
  });

  it('sans pré-réglage, un choix revenu au défaut du module s\'efface', () => {
    expect(toggleTabChoice({ sauts: false }, sauts, null)).toBeNull();
    expect(toggleTabChoice(null, topsSurf, null)).toEqual({ tops: true });
  });
});

describe('maskHiddenTabs', () => {
  const open = { general: true, vagues: true, rame: false, vols: false, pumping: false, tops: true, graphiques: false, cardio: false, notes: false, reglages: false };

  it('ferme les onglets cachés laissés ouverts', () => {
    const masked = maskHiddenTabs(open, SURF_TABS, { vagues: false });
    expect(masked.vagues).toBe(false);
    // « tops » est générique : ouvert dans la mémoire, mais pas coché.
    expect(masked.tops).toBe(false);
    expect(masked.general).toBe(true);
    expect(open.vagues).toBe(true);
  });

  it('rend le même objet quand rien n\'est caché', () => {
    const allShown = { ...open, tops: false };
    expect(maskHiddenTabs(allShown, SURF_TABS, null)).toBe(allShown);
    expect(maskHiddenTabs(open, SURF_TABS, { tops: true })).toBe(open);
  });
});

describe('maskAdvancedTabs', () => {
  const open = { general: true, vagues: true, rame: false, vols: false, pumping: false, tops: true, graphiques: false, cardio: false, notes: false, reglages: false };

  it('« avancé » fermé : ses onglets se replient, « général » reste', () => {
    const masked = maskAdvancedTabs(open, SURF_TABS, false);
    expect(masked.general).toBe(true);
    expect(masked.vagues).toBe(false);
    expect(masked.tops).toBe(false);
    // La mémoire n'est pas touchée : les panneaux reviennent à la réouverture.
    expect(open.vagues).toBe(true);
  });

  it('« général » est de la première rangée, « avancé » fermé masque les autres', () => {
    const sail = { ...tabDefaults(SAILING_TABS), graphiques: true };
    const masked = maskAdvancedTabs(sail, SAILING_TABS, false);
    expect(masked.general).toBe(true);
    expect(masked.graphiques).toBe(false);
  });

  it('rend le même objet quand rien ne change', () => {
    expect(maskAdvancedTabs(open, SURF_TABS, true)).toBe(open);
    const onlyGeneral = { ...open, vagues: false, tops: false };
    expect(maskAdvancedTabs(onlyGeneral, SURF_TABS, false)).toBe(onlyGeneral);
  });
});

describe('keepOpenTabEntries : la carte ne garde que ce que demandent les onglets ouverts', () => {
  const open = { ...tabDefaults(SAILING_TABS), manoeuvres: true, tops: true };
  const entries = [
    { panel: 'manoeuvres' as const, key: 'tack' },
    { panel: 'tops' as const, key: 'top10s' },
    { panel: 'manoeuvres' as const, key: 'jibe' },
  ];

  it('rien de fermé : la même liste, sans copie', () => {
    expect(keepOpenTabEntries(entries, open)).toBe(entries);
  });

  it('un onglet fermé : ses entrées partent, les autres restent dans leur ordre', () => {
    expect(keepOpenTabEntries(entries, { ...open, manoeuvres: false })).toEqual([{ panel: 'tops', key: 'top10s' }]);
    expect(keepOpenTabEntries(entries, closeAllTabs(open))).toEqual([]);
  });

  it('liste vide : rendue telle quelle', () => {
    const empty: { panel: 'tops'; key: string }[] = [];
    expect(keepOpenTabEntries(empty, closeAllTabs(open))).toBe(empty);
  });
});

describe('« avancé » et « général »', () => {
  it('ouvrir « avancé » ferme « général », le refermer le rouvre', () => {
    expect(generalOpenAfterAdvanced(true)).toBe(false);
    expect(generalOpenAfterAdvanced(false)).toBe(true);
  });

  const openKeys = (open: Record<string, boolean>) => Object.entries(open).filter(([, v]) => v).map(([k]) => k);

  it('ouvrir un onglet depuis ailleurs déplie « avancé », ferme « général » et ouvre l\'onglet (voile et surf)', () => {
    const sailing = revealTab(initialTabsState(tabDefaults(SAILING_TABS), 'a|1'), SAILING_TABS, 'matos');
    expect(sailing.advanced).toBe(true);
    expect(openKeys(sailing.open)).toEqual(['matos']);
    const surf = revealTab(initialTabsState(tabDefaults(SURF_TABS), 'a|1'), SURF_TABS, 'notes');
    expect(surf.advanced).toBe(true);
    expect(openKeys(surf.open)).toEqual(['notes']);
  });

  it('« avancé » déjà ouvert : les autres onglets ouverts restent, « général » n\'est pas touché', () => {
    const state = { key: 'a|1', open: { ...tabDefaults(SAILING_TABS), general: false, tops: true }, advanced: true };
    const next = revealTab(state, SAILING_TABS, 'matos');
    expect(openKeys(next.open)).toEqual(['tops', 'matos']);
    expect(next.advanced).toBe(true);
  });

  it('l\'onglet déjà ouvert : l\'état est rendu tel quel', () => {
    const state = { key: 'a|1', open: { ...tabDefaults(SAILING_TABS), general: false, matos: true }, advanced: true };
    expect(revealTab(state, SAILING_TABS, 'matos')).toBe(state);
  });

  it('un onglet de la première rangée s\'ouvre sans déplier « avancé »', () => {
    const state = { key: 'a|1', open: { ...tabDefaults(SAILING_TABS), general: false }, advanced: false };
    const next = revealTab(state, SAILING_TABS, 'general');
    expect(next.advanced).toBe(false);
    expect(next.open.general).toBe(true);
  });

  it('depuis une tuile (`keepPrimary`) : « avancé » se déplie, « général » reste ouvert, l\'onglet s\'ouvre en plus', () => {
    const next = revealTab(initialTabsState(tabDefaults(SAILING_TABS), 'a|1'), SAILING_TABS, 'manoeuvres', { keepPrimary: true });
    expect(next.advanced).toBe(true);
    expect(openKeys(next.open)).toEqual(['general', 'manoeuvres']);
    const surf = revealTab(initialTabsState(tabDefaults(SURF_TABS), 'a|1'), SURF_TABS, 'vagues', { keepPrimary: true });
    expect(openKeys(surf.open)).toEqual(['general', 'vagues']);
  });

  it('depuis une tuile, « avancé » déjà ouvert : les onglets ouverts restent, l\'onglet s\'ajoute', () => {
    const state = { key: 'a|1', open: { ...tabDefaults(SAILING_TABS), tops: true }, advanced: true };
    const next = revealTab(state, SAILING_TABS, 'sauts', { keepPrimary: true });
    expect(openKeys(next.open)).toEqual(['general', 'tops', 'sauts']);
    expect(next.advanced).toBe(true);
  });

  it('depuis une tuile, l\'onglet déjà ouvert : l\'état est rendu tel quel', () => {
    const state = { key: 'a|1', open: { ...tabDefaults(SAILING_TABS), cardio: true }, advanced: true };
    expect(revealTab(state, SAILING_TABS, 'cardio', { keepPrimary: true })).toBe(state);
  });
});

describe('toggleTabFromTile : la tuile ouvre puis referme son onglet', () => {
  const openKeys = (open: Record<string, boolean>) => Object.entries(open).filter(([, v]) => v).map(([k]) => k);

  it('fermé : il s\'ouvre en plus de « général », « avancé » se déplie (comme `keepPrimary`)', () => {
    const start = initialTabsState(tabDefaults(SAILING_TABS), 'a|1');
    const next = toggleTabFromTile(start, SAILING_TABS, 'manoeuvres');
    expect(next).toEqual(revealTab(start, SAILING_TABS, 'manoeuvres', { keepPrimary: true }));
    expect(next.advanced).toBe(true);
    expect(openKeys(next.open)).toEqual(['general', 'manoeuvres']);
  });

  it('ouvert : il se referme seul, « général », les autres onglets et « avancé » restent', () => {
    const state = { key: 'a|1', open: { ...tabDefaults(SAILING_TABS), tops: true, manoeuvres: true }, advanced: true };
    const next = toggleTabFromTile(state, SAILING_TABS, 'manoeuvres');
    expect(openKeys(next.open)).toEqual(['general', 'tops']);
    expect(next.advanced).toBe(true);
    const surf = toggleTabFromTile({ key: 'a|1', open: { ...tabDefaults(SURF_TABS), vagues: true }, advanced: true }, SURF_TABS, 'vagues');
    expect(openKeys(surf.open)).toEqual(['general']);
    expect(surf.advanced).toBe(true);
  });

  it('deux touchers rendent l\'état de départ, « avancé » mis à part', () => {
    const start = { key: 'a|1', open: tabDefaults(SAILING_TABS), advanced: true };
    expect(toggleTabFromTile(toggleTabFromTile(start, SAILING_TABS, 'sauts'), SAILING_TABS, 'sauts')).toEqual(start);
  });

  it('ouvert dans l\'état mais replié par « avancé » fermé : la tuile le montre, elle ne le ferme pas', () => {
    const state = { key: 'a|1', open: { ...tabDefaults(SAILING_TABS), cardio: true }, advanced: false };
    expect(isTabOpenOnScreen(state, SAILING_TABS, 'cardio')).toBe(false);
    const next = toggleTabFromTile(state, SAILING_TABS, 'cardio');
    expect(next.advanced).toBe(true);
    expect(openKeys(next.open)).toEqual(['general', 'cardio']);
  });
});

describe('tileTab : la tuile de « général » et son onglet', () => {
  const MODULES = { voile: SAILING_TABS, surf: SURF_TABS } as const;

  it('table entière, voile et surf', () => {
    expect(TILE_TABS.voile).toEqual({
      top2s: 'tops', tacks: 'manoeuvres', jibes: 'manoeuvres', jumps: 'sauts', highestJump: 'sauts',
      pumpCadence: 'pumping', pumpShare: 'pumping', heartRate: 'cardio',
    });
    expect(TILE_TABS.surf).toEqual({
      waves: 'vagues', waveTime: 'vagues', longestWave: 'vagues', maxSpeed: 'vagues', flightTime: 'vols', longestFlight: 'vols',
      pumpCadence: 'pumping', pumpShare: 'pumping', heartRate: 'cardio',
    });
    expect(FLIGHT_TILE_TABS).toEqual({
      voile: { activeDistance: 'vols', totalTime: 'vols', activeTime: 'vols', activeRatio: 'vols', activeAverage: 'vols' },
    });
  });

  it('chaque cible est un onglet de son module, jamais « général »', () => {
    for (const family of ['voile', 'surf'] as const) {
      const targets = [...Object.values(TILE_TABS[family]), ...Object.values(FLIGHT_TILE_TABS[family] ?? {})];
      for (const target of targets) {
        expect(keys(MODULES[family]), `${family} › ${target}`).toContain(target);
        expect(target).not.toBe('general');
      }
    }
  });

  it('onglet montré : la tuile le trouve, avec son libellé', () => {
    expect(tileTab('voile', 'tacks', SAILING_TABS)?.key).toBe('manoeuvres');
    expect(tileTab('voile', 'jumps', SAILING_TABS)?.label).toBe('sauts');
    expect(tileTab('surf', 'waves', SURF_TABS)?.key).toBe('vagues');
    expect(tileTab('surf', 'longestFlight', SURF_TABS)?.key).toBe('vols');
  });

  it('null : tuile sans onglet, clé inconnue, onglet caché ou absent de la liste montrée', () => {
    expect(tileTab('voile', 'totalTime', SAILING_TABS)).toBeNull();
    expect(tileTab('surf', 'totalTime', SURF_TABS)).toBeNull();
    expect(tileTab('voile', 'inconnue', SAILING_TABS)).toBeNull();
    expect(tileTab('voile', 'toString', SAILING_TABS)).toBeNull();
    expect(tileTab('voile', 'jumps', SAILING_TABS.filter((t) => t.key !== 'sauts'))).toBeNull();
    expect(tileTab('surf', 'heartRate', SURF_TABS.filter((t) => t.key !== 'cardio'))).toBeNull();
    // Une clé d'une famille ne vaut rien dans l'autre.
    expect(tileTab('surf', 'tacks', SURF_TABS)).toBeNull();
  });

  it('sur foil : les cinq tuiles du bloc du vol ouvrent « vols » s\'il est montré ; sans foil, rien', () => {
    for (const key of ['activeDistance', 'totalTime', 'activeTime', 'activeRatio', 'activeAverage']) {
      expect(tileTab('voile', key, SAILING_TABS, { inFlight: true })?.key, key).toBe('vols');
      expect(tileTab('voile', key, SAILING_TABS), key).toBeNull();
    }
    expect(tileTab('voile', 'activeTime', SAILING_TABS.filter((t) => t.key !== 'vols'), { inFlight: true })).toBeNull();
    expect(tileTab('surf', 'activeTime', SURF_TABS, { inFlight: true })).toBeNull();
  });

  it('ancre du panneau : une par onglet', () => {
    expect(tabAnchorId('manoeuvres')).toBe('an-onglet-manoeuvres');
    expect(tabAnchorId('vagues')).not.toBe(tabAnchorId('vols'));
  });
});

describe('panelNeedsScroll : défiler seulement si le haut du panneau est caché', () => {
  const inset = 64;
  const height = 800;

  it('haut à l\'écran, sous ce qui colle : pas de défilement', () => {
    expect(panelNeedsScroll(inset, inset, height)).toBe(false);
    expect(panelNeedsScroll(300, inset, height)).toBe(false);
    expect(panelNeedsScroll(height - PANEL_HEAD_VISIBLE_PX, inset, height)).toBe(false);
  });

  it('haut sous la barre collée, passé au-dessus, ou trop bas pour paraître : défilement', () => {
    expect(panelNeedsScroll(inset - 1, inset, height)).toBe(true);
    expect(panelNeedsScroll(-500, inset, height)).toBe(true);
    expect(panelNeedsScroll(height - PANEL_HEAD_VISIBLE_PX + 1, inset, height)).toBe(true);
    expect(panelNeedsScroll(2000, inset, height)).toBe(true);
  });

  it('barre d\'onglets du téléphone en bas : le haut du panneau doit paraître au-dessus d\'elle', () => {
    const phone = 844;
    const tabBar = 64;
    // Haut à 770 px, la barre couvre 780 à 844 : titre caché, défilement.
    expect(panelNeedsScroll(770, inset, phone, tabBar)).toBe(true);
    expect(panelNeedsScroll(770, inset, phone, tabBar + 24)).toBe(true);
    // Bornes : 80 px au-dessus de la barre suffisent.
    expect(panelNeedsScroll(phone - tabBar - PANEL_HEAD_VISIBLE_PX, inset, phone, tabBar)).toBe(false);
    expect(panelNeedsScroll(phone - tabBar - PANEL_HEAD_VISIBLE_PX + 1, inset, phone, tabBar)).toBe(true);
    // Sans barre (ordinateur), le même écran laisse paraître un haut à 760 px.
    expect(panelNeedsScroll(760, inset, phone)).toBe(false);
    expect(panelNeedsScroll(760, inset, phone, 0)).toBe(false);
  });
});

describe('état des onglets : « général » seul à chaque ouverture', () => {
  const defaults = tabDefaults(SURF_TABS);

  it('part des défauts, « avancé » fermé, sans partager l’objet des défauts', () => {
    const state = initialTabsState(defaults, 'a|1');
    expect(state).toEqual({ key: 'a|1', open: defaults, advanced: false });
    expect(state.open).not.toBe(defaults);
    expect(Object.entries(state.open).filter(([, v]) => v).map(([k]) => k)).toEqual(['general']);
  });

  it('une autre session repart des défauts', () => {
    const state = { key: 'a|1', open: { ...defaults, general: false, vagues: true }, advanced: true };
    expect(tabsStateFor(state, defaults, 'b|2')).toEqual(initialTabsState(defaults, 'b|2'));
  });

  it('la même session, ou une trace pas encore lue, garde l’état', () => {
    const state = { key: 'a|1', open: { ...defaults, vagues: true }, advanced: true };
    expect(tabsStateFor(state, defaults, 'a|1')).toBe(state);
    expect(tabsStateFor(state, defaults, null)).toBe(state);
  });

  it('une première trace lue repart des défauts', () => {
    const state = initialTabsState(defaults, null);
    expect(tabsStateFor(state, defaults, 'a|1')).toEqual(initialTabsState(defaults, 'a|1'));
  });
});

describe('closeAllTabs : « tout fermer »', () => {
  it('ferme chaque onglet, « général » compris', () => {
    const open = { ...tabDefaults(SAILING_TABS), tops: true, cardio: true };
    const closed = closeAllTabs(open);
    expect(Object.keys(closed)).toEqual(Object.keys(open));
    expect(Object.values(closed).every((v) => v === false)).toBe(true);
  });
});

describe('« tout ouvrir » et « tout fermer » : le bouton et l\'ouverture', () => {
  const keys = SAILING_TABS.map((tab) => tab.key);
  it('propose « tout ouvrir » sous deux onglets ouverts, « tout fermer » à partir de deux', () => {
    const closed = closeAllTabs(tabDefaults(SAILING_TABS));
    expect(tabsBulkAction(closed, keys)).toBe('openAll');
    expect(tabsBulkAction({ ...closed, general: true }, keys)).toBe('openAll');
    expect(tabsBulkAction({ ...closed, general: true, tops: true }, keys)).toBe('closeAll');
  });
  it('ne compte que les onglets montrés', () => {
    const open = { ...closeAllTabs(tabDefaults(SAILING_TABS)), general: true, tops: true };
    expect(tabsBulkAction(open, ['general', 'manoeuvres'])).toBe('openAll');
  });
  it('ouvre les onglets montrés, déplie « avancé », laisse fermés ceux qui ne sont pas montrés', () => {
    const state = initialTabsState(tabDefaults(SAILING_TABS), 'a|1');
    const shownKeys = keys.filter((key) => key !== 'cardio');
    const next = openAllTabs(state, SAILING_TABS, shownKeys);
    expect(next.advanced).toBe(true);
    expect(next.open.cardio).toBe(false);
    expect(shownKeys.every((key) => next.open[key])).toBe(true);
  });
  it('ne déplie pas « avancé » quand aucun onglet montré n\'en fait partie', () => {
    const state = initialTabsState(tabDefaults(SAILING_TABS), 'a|1');
    expect(openAllTabs(state, SAILING_TABS, ['general']).advanced).toBe(false);
  });
});

describe('tabDefaults : onglets ouverts à la première visite', () => {
  // Copies gelées des constantes écrites à la main avant leur déduction (SailingModule, SurfModule ; celles de LandModule et MuscuModule
  // sont parties avec la course, le vélo et l'Entraînement).
  const SAILING_PANEL_DEFAULTS = {
    general: true, tops: false, manoeuvres: false, graphiques: false, cardio: false, vmg: false, sauts: false, vols: false, pumping: false, vent: false, matos: false, reglages: false,
  };
  const SURF_SECTION_DEFAULTS = {
    general: true, vagues: false, rame: false, vols: false, pumping: false, tops: false, graphiques: false, cardio: false, notes: false, reglages: false,
  };

  it('rend les défauts de chaque module, tels qu\'ils étaient écrits', () => {
    expect(tabDefaults(SAILING_TABS)).toEqual(SAILING_PANEL_DEFAULTS);
    expect(tabDefaults(SURF_TABS)).toEqual(SURF_SECTION_DEFAULTS);
  });
});
