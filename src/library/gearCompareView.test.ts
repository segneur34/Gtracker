import { describe, expect, it } from 'vitest';
import { compareGear, type GearActivityList } from './gearCompare';
import { alikeItemsWithin, gearGesturesAllowed, gearLineGesture, gearRowGesture } from './gearCompareView';
import type { GearGroup } from './notes';

const list = (id: string, name: string, groups: GearGroup[] | null): GearActivityList => ({ activity: { id, name }, groups });

// Liste de l'ordinateur et celle du téléphone pour le wingfoil, comme sur la maquette de la fenêtre.
const pcWing: GearGroup[] = [
  { id: 'pc-ailes', name: 'Ailes', items: [{ id: 'pc-u55', name: 'Unit 5,5' }, { id: 'pc-s4', name: 'Duotone Slick 4' }, { id: 'pc-e6', name: 'Echo 6' }] },
  { id: 'pc-foils', name: 'Foils', items: [{ id: 'pc-g1085', name: 'Glide 1085' }] },
];
const phoneWing: GearGroup[] = [
  { id: 'tel-ailes', name: 'ailes', items: [{ id: 'tel-u55', name: 'unit 5.5' }, { id: 'tel-s4', name: 'Slick 4' }, { id: 'tel-u4', name: 'Unit 4' }] },
  { id: 'tel-planches', name: 'Planches', items: [{ id: 'tel-p', name: 'Flow 95' }] },
];

describe('gestes de la fenêtre Matériel', () => {
  const [wing] = compareGear([list('w', 'Wingfoil', pcWing)], [list('w', 'Wingfoil', phoneWing)]);

  it('offre supprimer, réunir, copier ou supprimer selon la rangée, comme la maquette', () => {
    const ailes = wing.lines[0];
    expect(ailes.rows.map((r) => [r.kind, gearRowGesture(r)])).toEqual([
      ['same', 'remove'], ['alike', 'merge'], ['pcOnly', 'remove'], ['phoneOnly', 'copy'],
    ]);
    expect(gearLineGesture(ailes)).toBeNull();
  });

  it("supprime une ligne du seul ordinateur, copie celle du seul téléphone, avec leurs pièces", () => {
    const [, foils, planches] = wing.lines;
    expect([foils.kind, gearLineGesture(foils), foils.rows.map(gearRowGesture)]).toEqual(['pcOnly', 'remove', ['remove']]);
    expect([planches.kind, gearLineGesture(planches), planches.rows.map(gearRowGesture)]).toEqual(['phoneOnly', 'copy', ['copy']]);
  });

  it("réunit deux lignes qui se ressemblent ; une pièce déjà réunie se supprime", () => {
    const [c] = compareGear(
      [list('w', 'W', [{ id: 'a', name: 'Ailes de wing', merged: [], items: [{ id: 'x', name: 'Unit 5', merged: [{ id: 'y', name: 'U5' }] }] }])],
      [list('w', 'W', [{ id: 'b', name: 'Ailes', items: [{ id: 'y', name: 'U5' }] }])],
    );
    expect(gearLineGesture(c.lines[0])).toBe('merge');
    expect(c.lines[0].rows.map((r) => [r.kind, gearRowGesture(r)])).toEqual([['merged', 'remove']]);
  });

  it("ne permet aucun geste sur une activité d'un seul côté", () => {
    expect(gearGesturesAllowed(wing)).toBe(true);
    const [moth] = compareGear([list('m', 'Moth', pcWing)], []);
    expect(gearGesturesAllowed(moth)).toBe(false);
  });
});

describe('alikeItemsWithin', () => {
  it("trouve les pièces d'une même ligne qui se ressemblent, chaque paire une fois", () => {
    const group: GearGroup = {
      id: 'g', name: 'Ailes',
      items: [{ id: '1', name: 'Slick 4' }, { id: '2', name: 'Unit 5' }, { id: '3', name: 'Duotone Slick 4' }, { id: '4', name: 'Unit 6' }],
    };
    expect(alikeItemsWithin(group).map(([a, b]) => [a.id, b.id])).toEqual([['1', '3']]);
    expect(alikeItemsWithin(null)).toEqual([]);
  });
});
