import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_SLUG, CACHE_NAMES, FILE_FORMATS, MARKER_FILE, STORAGE_KEYS, XML } from './appIdentity';

/**
 * Noms techniques figés : la première installation les range dans les fichiers de l'utilisateur et dans la mémoire de
 * l'appareil, les changer ensuite ferait perdre ses données. Ce test les écrit en toutes lettres pour qu'un
 * changement se voie.
 */
describe('noms techniques de l\'application', () => {
  it('sont ceux de Gtracker, figés', () => {
    expect(APP_NAME).toBe('Gtracker');
    expect(APP_SLUG).toBe('gtracker');
    expect(FILE_FORMATS).toEqual({
      session: 'gtracker-session',
      capteurs: 'gtracker-capteurs',
      memoire: 'gtracker-memoire',
      reglages: 'gtracker-reglages',
      fcRepos: 'gtracker-fc-repos',
      journal: 'gtracker-journal',
      itineraire: 'gtracker-itineraire',
    });
    expect(XML).toEqual({
      session: { prefix: 'gtracker', ns: 'urn:gtracker:session' },
      itineraire: { prefix: 'gtracker', ns: 'urn:gtracker:itineraire' },
    });
    expect(MARKER_FILE).toBe('gtracker.json');
  });

  it('clés de l\'appareil figées', () => {
    expect(STORAGE_KEYS).toEqual({
      sportSettings: 'gtracker.sportSettings',
      athleteProfile: 'gtracker.athleteProfile',
      theme: 'gtracker.theme',
      sections: 'gtracker.sections',
      profil: 'gtracker.profil',
      tutoriels: 'gtracker.tutoriels',
      statistiques: 'gtracker.statistiques',
      panelSizes: 'gtracker.panelSizes',
      partage: 'gtracker.partage',
      libraryCache: 'gtracker.libraryCache',
      settingsSavedAt: 'gtracker.settingsSavedAt',
      deviceId: 'gtracker.deviceId',
      deviceName: 'gtracker.deviceName',
      seenSettingsFiles: 'gtracker.seenSettingsFiles',
      summaryGestures: 'gtracker.summaryGestures',
      followedTrace: 'gtracker.followedTrace',
      fondCarte: 'gtracker.fondCarte',
      brouterProfile: 'gtracker.brouterProfile',
      zoneAlertTarget: 'gtracker.zoneAlertTarget',
      restingHr: 'gtracker.restingHr',
      planning: 'gtracker.planning',
      routeList: 'gtracker.routeList',
      triBibliotheque: 'gtracker.triBibliotheque',
      heartRateBelts: 'gtracker.heartRateBelts',
      memoryFolder: 'gtracker.memoryFolder',
      permissionsSeenVersion: 'gtracker.permissionsSeenVersion',
      tileCache: 'gtracker.tileCache',
      tileUrls: 'gtracker.tileUrls',
    });
  });

  it('caches figés', () => {
    expect(CACHE_NAMES).toEqual({
      tuiles: 'gtracker-tuiles',
      vignettes: 'gtracker-vignettes',
      vignettesImages: 'gtracker-vignettes-images',
      memoire: 'gtracker-memoire',
      savedAtHeader: 'x-gtracker-saved-at',
    });
  });

  it('commencent tous par le nom technique', () => {
    const values = [
      ...Object.values(FILE_FORMATS),
      ...Object.values(STORAGE_KEYS),
      ...Object.values(CACHE_NAMES).filter((value) => !value.startsWith('x-')),
      XML.session.prefix,
      XML.itineraire.prefix,
      MARKER_FILE,
    ];
    for (const value of values) expect(value.startsWith(APP_SLUG), value).toBe(true);
    for (const xml of Object.values(XML)) expect(xml.ns.startsWith(`urn:${APP_SLUG}:`)).toBe(true);
    expect(CACHE_NAMES.savedAtHeader.startsWith(`x-${APP_SLUG}-`)).toBe(true);
  });

  it('chaque clé de l\'appareil est unique', () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});
