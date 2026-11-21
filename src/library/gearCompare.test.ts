import { describe, expect, it } from 'vitest';
import {
  activityGearLists, compareGear, gearLooksAlike, isAdoptableGear, phoneGearChanges, withGearCopied, withGearMerged, withGearRemoved,
  type GearActivityList,
} from './gearCompare';
import { matchGearChoice } from './gearMatch';
import type { GearGroup } from './notes';

const list = (id: string, name: string, groups: GearGroup[] | null): GearActivityList => ({ activity: { id, name }, groups });

// Liste de l'ordinateur et celle du téléphone pour le wingfoil, comme sur la maquette de la fenêtre.
const pcWing: GearGroup[] = [
  {
    id: 'pc-ailes', name: 'Ailes',
    items: [{ id: 'pc-u55', name: 'Unit 5,5' }, { id: 'pc-s4', name: 'Duotone Slick 4' }, { id: 'pc-e6', name: 'Echo 6' }],
  },
  { id: 'pc-foils', name: 'Foils', items: [{ id: 'pc-g1085', name: 'Glide 1085' }] },
];
const phoneWing: GearGroup[] = [
  { id: 'tel-ailes', name: 'ailes', items: [{ id: 'tel-u55', name: 'unit 5.5' }, { id: 'tel-s4', name: 'Slick 4' }, { id: 'tel-u4', name: 'Unit 4' }] },
];

describe('gearLooksAlike', () => {
  it('rapproche les noms égaux sans accents ni ponctuation', () => {
    expect(gearLooksAlike('Mât carbone 85', 'mat-carbone 85')).toBe(true);
    expect(gearLooksAlike('Unit 5,5', 'unit 5.5')).toBe(true);
  });

  it("rapproche un nom contenu dans l'autre, à partir de 3 caractères", () => {
    expect(gearLooksAlike('Duotone Slick 4', 'Slick 4')).toBe(true);
    expect(gearLooksAlike('Duotone Echo', 'Ec')).toBe(false);
  });

  it("rapproche une seule lettre d'écart, à partir de 5 caractères", () => {
    expect(gearLooksAlike('Gong plus 6.5', 'Gong puls 6.5')).toBe(true);
    expect(gearLooksAlike('Reedin 4.5', 'Redin 4.5')).toBe(true);
    expect(gearLooksAlike('Duotone 7', 'Dootane 7')).toBe(false);
    expect(gearLooksAlike('Mat 7', 'Max 7')).toBe(false);
  });

  it("ne prend pas pour une faute de frappe la lettre d'écart d'une taille ou d'un repère", () => {
    expect(gearLooksAlike('Voile S', 'Voile M')).toBe(false);
    expect(gearLooksAlike('Kite A', 'Kite B')).toBe(false);
    expect(gearLooksAlike('Aile L', 'Aile R')).toBe(false);
    expect(gearLooksAlike('Planche A', 'Planche B')).toBe(false);
    expect(gearLooksAlike('Voile XL', 'Voile XS')).toBe(false);
    expect(gearLooksAlike('Duotone Slick', 'Duotne Slick')).toBe(true);
  });

  it('ne rapproche jamais deux noms aux nombres différents', () => {
    expect(gearLooksAlike('Unit 5 6', 'Unit 6 5')).toBe(false);
    expect(gearLooksAlike('Unit 5', 'Unit 6')).toBe(false);
    expect(gearLooksAlike('Unit 5.5', 'Unit 55')).toBe(false);
    expect(gearLooksAlike('Slick', 'Slick 4')).toBe(false);
  });
});

describe('compareGear', () => {
  const [wing] = compareGear([list('wingfoil', 'Wingfoil', pcWing)], [list('wingfoil', 'Wingfoil', phoneWing)]);

  it('rapproche lignes et pièces par nom, puis par ressemblance', () => {
    expect(wing.lines.map((l) => [l.kind, l.pc?.name ?? null, l.phone?.name ?? null])).toEqual([
      ['same', 'Ailes', 'ailes'],
      ['pcOnly', 'Foils', null],
    ]);
    expect(wing.lines[0].rows.map((r) => [r.kind, r.pc?.name ?? null, r.phone?.name ?? null])).toEqual([
      ['same', 'Unit 5,5', 'unit 5.5'],
      ['alike', 'Duotone Slick 4', 'Slick 4'],
      ['pcOnly', 'Echo 6', null],
      ['phoneOnly', null, 'Unit 4'],
    ]);
    // Ligne absente du téléphone : toutes ses pièces de l'ordinateur seul.
    expect(wing.lines[1].rows.map((r) => r.kind)).toEqual(['pcOnly']);
    expect(wing.equal).toBe(false);
  });

  it("rapproche les activités par identifiant puis par nom, et montre celles d'un seul côté", () => {
    const moth = list('moth', 'Moth', [{ id: 'm', name: 'Coque', items: [] }]);
    const result = compareGear(
      [list('a-kite', 'Kite', pcWing), moth, list('surf', 'Surf', null)],
      [list('k-tel', ' kite ', pcWing), list('surf', 'Surf', [])],
    );
    expect(result.map((c) => [c.pc?.activity.id ?? null, c.phone?.activity.id ?? null, c.equal])).toEqual([
      ['a-kite', 'k-tel', true],
      ['moth', null, false],
    ]);
    expect(isAdoptableGear(result[0])).toBe(true);
    expect(isAdoptableGear(result[1])).toBe(false);
  });

  it('reconnaît une pièce réunie, puis tout en « = » une fois la liste reprise', () => {
    const merged = withGearMerged(pcWing, 'pc-s4', phoneWing[0].items[1], 'Duotone Slick 4');
    const [after] = compareGear([list('w', 'W', merged)], [list('w', 'W', phoneWing)]);
    expect(after.lines[0].rows[1]).toMatchObject({ kind: 'merged', pc: { name: 'Duotone Slick 4' }, phone: { name: 'Slick 4' } });
    const [adopted] = compareGear([list('w', 'W', merged)], [list('w', 'W', merged)]);
    expect(adopted.equal).toBe(true);
  });

  it("donne une rangée à chaque pièce du téléphone qu'une même pièce de l'ordinateur a reçue", () => {
    const pc: GearGroup[] = [{ id: 'g', name: 'Ailes', items: [{ id: 'a', name: 'Slick 4', merged: [{ id: 'x', name: 'Slick quatre' }] }] }];
    const phone: GearGroup[] = [{ id: 'g', name: 'Ailes', items: [{ id: 'a', name: 'Slick 4' }, { id: 'x', name: 'Slick quatre' }] }];
    const [c] = compareGear([list('w', 'W', pc)], [list('w', 'W', phone)]);
    expect(c.lines[0].rows.map((r) => [r.kind, r.pc?.id, r.phone?.id])).toEqual([['same', 'a', 'a'], ['merged', 'a', 'x']]);
  });

  it('range sous « se ressemblent » un même identifiant renommé', () => {
    const [c] = compareGear(
      [list('w', 'W', [{ id: 'g', name: 'Ailes', items: [{ id: 'a', name: 'Unit 5' }] }])],
      [list('w', 'W', [{ id: 'g', name: 'Ailes', items: [{ id: 'a', name: 'Echo 7' }] }])],
    );
    expect(c.lines[0].rows).toMatchObject([{ kind: 'alike', pc: { name: 'Unit 5' }, phone: { name: 'Echo 7' } }]);
  });

  it("n'écrit rien pour une activité sans liste des deux côtés", () => {
    expect(compareGear([list('w', 'W', null)], [list('w', 'W', [])])).toEqual([]);
  });
});

describe('gestes sur la liste de l’ordinateur', () => {
  it('copie une pièce du téléphone en gardant son identifiant s’il est libre', () => {
    const next = withGearCopied(pcWing, 'pc-ailes', phoneWing[0], phoneWing[0].items[2], () => 'neuf');
    expect(next[0].items.at(-1)).toEqual({ id: 'tel-u4', name: 'Unit 4' });
    expect(next[1]).toBe(pcWing[1]);
    // Identifiant déjà pris : un neuf.
    const taken = withGearCopied(pcWing, 'pc-ailes', phoneWing[0], { id: 'pc-e6', name: 'Unit 4' }, () => 'neuf');
    expect(taken[0].items.at(-1)).toEqual({ id: 'neuf', name: 'Unit 4' });
    // Même nom déjà là : rien de doublé.
    expect(withGearCopied(pcWing, 'pc-ailes', phoneWing[0], phoneWing[0].items[0])[0].items).toHaveLength(3);
  });

  it('crée la ligne du téléphone absente de l’ordinateur, avec toutes ses pièces', () => {
    const next = withGearCopied(pcWing, null, phoneWing[0], null, () => 'neuf');
    expect(next[2]).toEqual({ id: 'tel-ailes', name: 'ailes', items: phoneWing[0].items });
  });

  it('réunit une pièce du téléphone sous le nom choisi, sans réécrire les fiches', () => {
    const next = withGearMerged(pcWing, 'pc-s4', phoneWing[0].items[1], 'Slick 4');
    expect(next[0].items[1]).toEqual({ id: 'pc-s4', name: 'Slick 4', merged: [{ id: 'tel-s4', name: 'Slick 4' }] });
    expect(next[0].items).toHaveLength(3);
    // Les fiches du téléphone comme celles de l'ordinateur se rangent sous la pièce gardée.
    expect(matchGearChoice({ groupId: 'tel-ailes', groupName: 'ailes', itemId: 'tel-s4', itemName: 'Slick 4' }, next).item?.id).toBe('pc-s4');
    expect(matchGearChoice({ groupId: 'pc-ailes', groupName: 'Ailes', itemId: 'pc-s4', itemName: 'Duotone Slick 4' }, next).item?.id).toBe('pc-s4');
  });

  it('réunit deux pièces de l’ordinateur : celle reçue quitte la liste, ses réunies suivent', () => {
    const pc: GearGroup[] = [{ id: 'g', name: 'Ailes', items: [{ id: 'a', name: 'Slick 4' }, { id: 'b', name: 'Slik 4', merged: [{ id: 'z', name: 'S4' }] }] }];
    expect(withGearMerged(pc, 'a', pc[0].items[1], '')).toEqual([
      { id: 'g', name: 'Ailes', items: [{ id: 'a', name: 'Slick 4', merged: [{ id: 'b', name: 'Slik 4' }, { id: 'z', name: 'S4' }] }] },
    ]);
  });

  it('réunit deux lignes de l’ordinateur : les pièces suivent, un homonyme est réuni', () => {
    const pc: GearGroup[] = [
      { id: 'g1', name: 'Ailes', items: [{ id: 'a', name: 'Slick 4' }] },
      { id: 'g2', name: 'Aile', items: [{ id: 'b', name: 'slick 4' }, { id: 'c', name: 'Echo 6' }] },
    ];
    expect(withGearMerged(pc, 'g1', pc[1], 'Ailes')).toEqual([{
      id: 'g1', name: 'Ailes', merged: [{ id: 'g2', name: 'Aile' }],
      items: [{ id: 'a', name: 'Slick 4', merged: [{ id: 'b', name: 'slick 4' }] }, { id: 'c', name: 'Echo 6' }],
    }]);
  });

  it('réunit une ligne du téléphone sans prendre ses pièces', () => {
    const next = withGearMerged(pcWing, 'pc-foils', { id: 'tel-f', name: 'Foil', items: [{ id: 'x', name: 'Y' }] }, 'Foils');
    expect(next[1]).toEqual({ ...pcWing[1], merged: [{ id: 'tel-f', name: 'Foil' }] });
  });

  it('même identifiant des deux côtés : le nom seul change', () => {
    const pc: GearGroup[] = [{ id: 'g', name: 'Ailes', items: [{ id: 'a', name: 'Unit 5' }] }];
    expect(withGearMerged(pc, 'a', { id: 'a', name: 'Unit 5 m' }, 'Unit 5 m')[0].items).toEqual([{ id: 'a', name: 'Unit 5 m' }]);
  });

  it('supprime une pièce ou une ligne ; un identifiant inconnu ne change rien', () => {
    expect(withGearRemoved(pcWing, 'pc-e6')[0].items.map((it) => it.id)).toEqual(['pc-u55', 'pc-s4']);
    expect(withGearRemoved(pcWing, 'pc-foils')).toEqual([pcWing[0]]);
    expect(withGearRemoved(pcWing, 'inconnu')).toEqual(pcWing);
    expect(withGearMerged(pcWing, 'inconnu', phoneWing[0].items[0], 'x')).toEqual(pcWing);
  });
});

describe('phoneGearChanges', () => {
  it('compte ajouts, retraits et réunions des activités qui se reprennent', () => {
    const merged = withGearMerged(pcWing, 'pc-s4', phoneWing[0].items[1], 'Duotone Slick 4');
    const changes = phoneGearChanges(compareGear(
      [list('wingfoil', 'Wingfoil', merged), list('moth', 'Moth', [{ id: 'm', name: 'Coque', items: [] }])],
      [list('wingfoil', 'Wingfoil', phoneWing)],
    ));
    const activity = { id: 'wingfoil', name: 'Wingfoil' };
    expect(changes).toEqual({
      activities: [activity],
      added: [{ activity, groupName: 'Ailes', itemName: 'Echo 6' }, { activity, groupName: 'Foils', itemName: 'Glide 1085' }],
      removed: [{ activity, groupName: 'ailes', itemName: 'Unit 4' }],
      merged: [{ activity, groupName: 'Ailes', from: 'Slick 4', to: 'Duotone Slick 4' }],
    });
  });

  it('compte une ressemblance non réunie pour un retrait et un ajout, et rien pour deux listes égales', () => {
    const [c] = compareGear([list('w', 'W', pcWing)], [list('w', 'W', phoneWing)]);
    const changes = phoneGearChanges([c]);
    expect(changes.added.map((x) => x.itemName)).toEqual(['Duotone Slick 4', 'Echo 6', 'Glide 1085']);
    expect(changes.removed.map((x) => x.itemName)).toEqual(['Slick 4', 'Unit 4']);
    expect(phoneGearChanges(compareGear([list('w', 'W', pcWing)], [list('w', 'W', pcWing)]))).toEqual({ activities: [], added: [], removed: [], merged: [] });
  });

  it("n'annonce pas en ajout une pièce que le téléphone a déjà, sous une ligne réunie de plus", () => {
    const pc: GearGroup[] = [{ id: 'A', name: 'Ailes', merged: [{ id: 'P2', name: 'Wings' }], items: [{ id: 'u5', name: 'Unit 5' }] }];
    const phone: GearGroup[] = [
      { id: 'P1', name: 'Ailes', items: [{ id: 't5', name: 'Unit 5' }] },
      { id: 'P2', name: 'Wings', items: [{ id: 't5p', name: 'Unit 5 pro' }] },
    ];
    const comparisons = compareGear([list('w', 'W', pc)], [list('w', 'W', phone)]);
    expect(comparisons[0].lines.map((l) => [l.kind, l.phone?.id])).toEqual([['same', 'P1'], ['merged', 'P2']]);
    const changes = phoneGearChanges(comparisons);
    expect(changes.added).toEqual([]);
    expect(changes.removed.map((x) => x.itemName)).toEqual(['Unit 5 pro']);
  });

  it('compte une ligne vide pour elle-même', () => {
    const changes = phoneGearChanges(compareGear([list('w', 'W', [{ id: 'g', name: 'Mât', items: [] }])], [list('w', 'W', [])]));
    expect(changes.added).toEqual([{ activity: { id: 'w', name: 'W' }, groupName: 'Mât', itemName: null }]);
  });
});

describe('activityGearLists', () => {
  it('relit activités et listes, nettoyées, celles du premier lancement sans liste rangée', () => {
    const lists = activityGearLists({
      activities: [{ id: 'a-wing', name: 'Wing', base: 'wingfoil', color: '#004aad' }],
      gearGroups: { 'a-wing': [{ id: 'g', name: ' Ailes ', items: [{ id: 'i', name: 'Unit', merged: [{ id: 'j', name: 'U' }] }] }] },
    });
    expect(lists).toEqual([list('a-wing', 'Wing', [{ id: 'g', name: 'Ailes', items: [{ id: 'i', name: 'Unit', merged: [{ id: 'j', name: 'U' }] }] }])]);
    expect(activityGearLists(undefined).length).toBeGreaterThan(0);
    expect(activityGearLists(undefined).every((l) => l.groups === null)).toBe(true);
  });
});
