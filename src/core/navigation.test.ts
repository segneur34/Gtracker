import { describe, expect, it } from 'vitest';
import { RECORD_PATH, TAB_BAR, TOP_LINKS, alsoActiveOn } from './navigation';
import { PROFILE_PATH, parentPage } from './parentPage';

describe('barres de navigation', () => {
  it('barre du bas et rail : Profil, Sessions, le bouton rond, Statistiques, Réglages', () => {
    expect(TAB_BAR.before.map((d) => d.label)).toEqual(['Profil', 'Sessions']);
    expect(TAB_BAR.after.map((d) => d.label)).toEqual(['Statistiques', 'Réglages']);
  });

  it('barre du haut : Profil, Sessions, Planifier, Statistiques, Réglages', () => {
    expect(TOP_LINKS.map((d) => d.label)).toEqual(['Profil', 'Sessions', 'Planifier', 'Statistiques', 'Réglages']);
    expect(TOP_LINKS.map((d) => d.to)).toEqual(['/profil', '/sessions', '/itineraires', '/statistiques', '/parametres']);
  });

  it('les cases du bas sont des liens du haut, aux mêmes adresses', () => {
    for (const d of [...TAB_BAR.before, ...TAB_BAR.after]) expect(TOP_LINKS).toContainEqual(d);
  });

  it("le Profil ouvre l'application : rien au-dessus, le retour quitte", () => {
    expect(TOP_LINKS[0].to).toBe(PROFILE_PATH);
    expect(parentPage(PROFILE_PATH, '')).toBeNull();
  });

  it('Sessions reste allumée sur une analyse, rien d\'autre ne l\'est hors de sa page', () => {
    expect(alsoActiveOn('sessions', '/voile/analyse')).toBe(true);
    expect(alsoActiveOn('sessions', '/surf/analyse/')).toBe(true);
    expect(alsoActiveOn('sessions', '/statistiques')).toBe(false);
    expect(alsoActiveOn('profil', '/voile/analyse')).toBe(false);
    expect(alsoActiveOn('planifier', RECORD_PATH)).toBe(false);
  });
});
