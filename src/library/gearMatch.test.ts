import { describe, expect, it } from 'vitest';
import { effectiveGear, matchGearChoice, sameGearName, withLineChoice } from './gearMatch';
import type { GearChoice, GearGroup } from './notes';

const choice = (groupId: string, groupName: string, itemId: string, itemName: string): GearChoice => ({ groupId, groupName, itemId, itemName });

// Catalogue d'aujourd'hui d'une activité de wing.
const wing: GearGroup[] = [
  { id: 'g-voile', name: 'Voile', items: [{ id: 'v-65', name: 'Gong puls 6.5' }, { id: 'v-45', name: 'Reedin 4.5' }] },
  { id: 'g-foil', name: 'Foil', items: [{ id: 'f-1085', name: 'Duotone glide 1085' }, { id: 'f-725', name: 'Duotone glide 725' }] },
];

describe('sameGearName', () => {
  it('compare aux espaces et à la casse près', () => {
    expect(sameGearName(' Foil ', 'foil')).toBe(true);
    expect(sameGearName('Foil', 'Voile')).toBe(false);
  });

  it('ne sépare pas deux saisies du même matériel', () => {
    expect(sameGearName('Unit 5,5', 'unit  5.5')).toBe(true);
    expect(sameGearName('Duotone\tGlide 1085', 'duotone glide 1085')).toBe(true);
    expect(sameGearName('Unit 5.5', 'Unit 55')).toBe(false);
    expect(sameGearName('Gong plus 6.5', 'Gong puls 6.5')).toBe(false);
  });
});

describe('matchGearChoice', () => {
  it('range un choix du catalogue par ses identifiants', () => {
    expect(matchGearChoice(choice('g-foil', 'Foil', 'f-725', 'Duotone glide 725'), wing)).toEqual({ group: wing[1], item: wing[1].items[1] });
  });

  it("rattache une ligne inconnue à la ligne du catalogue de même nom, et l'article de même nom", () => {
    // Ancien catalogue : autres identifiants, mêmes noms.
    const match = matchGearChoice(choice('old-voile', ' voile ', 'old-45', 'REEDIN 4.5'), wing);
    expect(match.group).toBe(wing[0]);
    expect(match.item).toBe(wing[0].items[1]);
  });

  it('laisse hors liste un article renommé, sur la ligne retrouvée', () => {
    const match = matchGearChoice(choice('old-voile', 'Voile', 'old-65', 'Gong plus 6.5'), wing);
    expect(match.group).toBe(wing[0]);
    expect(match.item).toBeNull();
  });

  it('retrouve par son identifiant un article renommé dans Réglages', () => {
    const match = matchGearChoice(choice('g-foil', 'Foil', 'f-1085', 'Glide v1 1085'), wing);
    expect(match.item).toBe(wing[1].items[0]);
    // Identifiant d'article connu : il donne sa ligne, même sous un autre groupe recopié.
    expect(matchGearChoice(choice('old-foil', 'Ailes', 'f-1085', 'Glide v1 1085'), wing).group).toBe(wing[1]);
  });

  it("rapproche par nom le choix d'une autre activité aux mêmes noms de lignes", () => {
    const kite: GearGroup[] = [{ id: 'k-voile', name: 'Voile', items: [{ id: 'k-9', name: 'Reedin 4.5' }] }];
    const match = matchGearChoice(choice('g-voile', 'Voile', 'v-45', 'Reedin 4.5'), kite);
    expect(match).toEqual({ group: kite[0], item: kite[0].items[0] });
  });

  it('ne trouve rien pour une ligne inconnue sans homonyme', () => {
    expect(matchGearChoice(choice('old-p', 'Planche', 'old-95', 'Fanatic 95'), wing)).toEqual({ group: null, item: null });
  });

  describe('pièces et lignes réunies', () => {
    // « Slick 4 » du téléphone réuni à « Duotone Slick 4 », la ligne « Ailes » du téléphone à « Voile ».
    const merged: GearGroup[] = [
      {
        id: 'g-voile', name: 'Voile', merged: [{ id: 'tel-ailes', name: 'Ailes' }],
        items: [{ id: 'v-4', name: 'Duotone Slick 4', merged: [{ id: 'tel-4', name: 'Slick 4' }] }, { id: 'v-45', name: 'Reedin 4.5' }],
      },
      { id: 'g-foil', name: 'Foil', items: [{ id: 'f-725', name: 'Duotone glide 725' }] },
    ];

    it("retrouve un article réuni par son ancien identifiant, sous n'importe quelle ligne recopiée", () => {
      expect(matchGearChoice(choice('tel-ailes', 'Ailes', 'tel-4', 'Slick 4'), merged)).toEqual({ group: merged[0], item: merged[0].items[0] });
      expect(matchGearChoice(choice('autre', 'Planche', 'tel-4', 'Autre nom'), merged).item).toBe(merged[0].items[0]);
    });

    it('retrouve un article réuni par son ancien nom, dans sa ligne', () => {
      expect(matchGearChoice(choice('g-voile', 'Voile', 'inconnu', ' slick 4 '), merged).item).toBe(merged[0].items[0]);
      // Ancien nom réuni dans une autre ligne : pas retenu.
      expect(matchGearChoice(choice('g-foil', 'Foil', 'inconnu', 'Slick 4'), merged)).toEqual({ group: merged[1], item: null });
    });

    it('retrouve une ligne réunie par son ancien identifiant, puis par son ancien nom', () => {
      expect(matchGearChoice(choice('tel-ailes', 'Autre', 'inconnu', 'Reedin 4.5'), merged)).toEqual({ group: merged[0], item: merged[0].items[1] });
      expect(matchGearChoice(choice('inconnu', 'ailes', 'inconnu', 'Reedin 4,5'), merged)).toEqual({ group: merged[0], item: merged[0].items[1] });
    });

    it("un identifiant de la liste prime sur un identifiant réuni, un nom de la liste sur un nom réuni", () => {
      const both: GearGroup[] = [
        { id: 'g', name: 'Voile', items: [{ id: 'a', name: 'Slick 4', merged: [{ id: 'b', name: 'Unit 5' }] }, { id: 'b', name: 'Unit 5' }] },
      ];
      expect(matchGearChoice(choice('g', 'Voile', 'b', 'Unit 5'), both).item).toBe(both[0].items[1]);
      expect(matchGearChoice(choice('g', 'Voile', 'inconnu', 'Unit 5'), both).item).toBe(both[0].items[1]);
    });
  });
});

describe('effectiveGear', () => {
  it('garde un choix par ligne, celui du catalogue, dans l’ordre des lignes', () => {
    const gear = [
      choice('old-foil', 'Foil', 'old-1085', 'Glide v1 1085'),
      choice('g-voile', 'Voile', 'v-65', 'Gong puls 6.5'),
      choice('g-foil', 'Foil', 'f-725', 'Duotone glide 725'),
    ];
    const effective = effectiveGear(gear, wing);
    expect(effective.map((e) => [e.group?.id, e.item?.id])).toEqual([['g-voile', 'v-65'], ['g-foil', 'f-725']]);
    expect(effective[1].choice).toBe(gear[2]);
  });

  it('regroupe par nom les choix sans ligne, le dernier gagne, après les lignes du catalogue', () => {
    const gear = [
      choice('old-p1', 'Planche', 'old-95', 'Fanatic 95'),
      choice('g-voile', 'Voile', 'v-45', 'Reedin 4.5'),
      choice('old-p2', ' planche', 'old-110', 'JP 110'),
    ];
    const effective = effectiveGear(gear, wing);
    expect(effective.map((e) => [e.group?.id ?? null, e.choice.itemName])).toEqual([['g-voile', 'Reedin 4.5'], [null, 'JP 110']]);
  });

  describe('fiche à quatre choix : ceux du catalogue puis ceux du catalogue refait, mêmes noms de lignes', () => {
    // Catalogue d'aujourd'hui, et choix d'un catalogue d'avant : autres identifiants, articles écrits autrement.
    const today: GearGroup[] = [
      { id: 'cat-voile', name: 'Voile', items: [{ id: 'v-60', name: 'Strato 6.0' }, { id: 'v-50', name: 'Nimbus 5.0' }] },
      { id: 'cat-foil', name: 'Foil', items: [{ id: 'f-1100', name: 'Glisse 1100' }, { id: 'f-800', name: 'Glisse 800' }] },
    ];
    const newVoile = choice('cat-voile', 'Voile', 'v-60', 'Strato 6.0');
    const newFoil = choice('cat-foil', 'Foil', 'f-1100', 'Glisse 1100');
    const oldVoile = choice('avant-voile', 'Voile', 'avant-60', 'Strato six');
    const oldFoil = choice('avant-foil', 'Foil', 'avant-1100', 'Glisse v1 1100');

    it('retient le choix du catalogue de chaque ligne, quel que soit l’ordre de la fiche', () => {
      for (const gear of [[newVoile, newFoil, oldVoile, oldFoil], [oldVoile, oldFoil, newVoile, newFoil], [oldFoil, newVoile, newFoil, oldVoile]]) {
        const effective = effectiveGear(gear, today);
        expect(effective.map((e) => [e.group?.id, e.item?.id ?? null])).toEqual([['cat-voile', 'v-60'], ['cat-foil', 'f-1100']]);
        expect(effective.map((e) => e.choice)).toEqual([newVoile, newFoil]);
      }
    });

    it('à égalité, le dernier : deux articles du catalogue, ou deux hors liste', () => {
      const otherFoil = choice('cat-foil', 'Foil', 'f-800', 'Glisse 800');
      expect(effectiveGear([newFoil, otherFoil], today)[0].choice).toBe(otherFoil);
      expect(effectiveGear([otherFoil, oldFoil, newFoil], today)[0].choice).toBe(newFoil);
      const olderFoil = choice('avant-foil', 'Foil', 'avant-900', 'Glisse v1 900');
      const effective = effectiveGear([oldFoil, olderFoil], today);
      expect(effective.map((e) => [e.group?.id, e.item, e.choice])).toEqual([['cat-foil', null, olderFoil]]);
    });

    it('un choix hors liste seul sur sa ligne reste retenu', () => {
      const effective = effectiveGear([newVoile, oldFoil], today);
      expect(effective.map((e) => [e.group?.id, e.item?.id ?? null, e.choice])).toEqual([['cat-voile', 'v-60', newVoile], ['cat-foil', null, oldFoil]]);
    });

    it('rechoisir un article sur une ligne ne laisse qu’un choix pour elle, et garde l’autre ligne', () => {
      const gear = [newVoile, newFoil, oldVoile, oldFoil];
      const nimbus = choice('cat-voile', 'Voile', 'v-50', 'Nimbus 5.0');
      expect(withLineChoice(gear, today, 'cat-voile', nimbus)).toEqual([nimbus, newFoil, oldFoil]);
      const fixed = withLineChoice(withLineChoice(gear, today, 'cat-voile', newVoile), today, 'cat-foil', newFoil);
      expect(fixed).toEqual([newVoile, newFoil]);
      expect(withLineChoice(gear, today, 'cat-foil', null)).toEqual([newVoile, oldVoile]);
    });
  });

  it('ne rend rien sans matériel', () => {
    expect(effectiveGear(null, wing)).toEqual([]);
    expect(effectiveGear([], wing)).toEqual([]);
  });
});

describe('withLineChoice', () => {
  const twoFoils = [
    choice('old-foil', 'Foil', 'old-1085', 'Glide v1 1085'),
    choice('old-voile', 'Voile', 'old-65', 'Gong plus 6.5'),
    choice('g-foil', 'Foil', 'f-725', 'Duotone glide 725'),
  ];

  it('remplace tous les choix de la ligne, par identifiant ou par nom, par un seul', () => {
    const next = withLineChoice(twoFoils, wing, 'g-foil', choice('g-foil', 'Foil', 'f-1085', 'Duotone glide 1085'));
    expect(next).toEqual([choice('old-voile', 'Voile', 'old-65', 'Gong plus 6.5'), choice('g-foil', 'Foil', 'f-1085', 'Duotone glide 1085')]);
  });

  it('« Aucun » retire tous les choix de la ligne', () => {
    expect(withLineChoice(twoFoils, wing, 'g-foil', null)).toEqual([choice('old-voile', 'Voile', 'old-65', 'Gong plus 6.5')]);
    expect(withLineChoice([twoFoils[0], twoFoils[2]], wing, 'g-foil', null)).toBeNull();
  });

  it("trie dans l'ordre des lignes, celles hors catalogue à la fin", () => {
    const planche = choice('old-p', 'Planche', 'old-95', 'Fanatic 95');
    const next = withLineChoice([planche, choice('g-foil', 'Foil', 'f-725', 'Duotone glide 725')], wing, 'g-voile', choice('g-voile', 'Voile', 'v-45', 'Reedin 4.5'));
    expect(next?.map((c) => c.groupName)).toEqual(['Voile', 'Foil', 'Planche']);
  });

  it('remplace ou retire le choix d’une ligne hors catalogue, et ses homonymes', () => {
    const gear = [choice('old-p1', 'Planche', 'old-95', 'Fanatic 95'), choice('old-p2', 'planche', 'old-110', 'JP 110')];
    expect(withLineChoice(gear, wing, 'old-p2', null)).toBeNull();
    expect(withLineChoice(gear, wing, 'old-p2', choice('old-p2', 'planche', 'neuf', 'Axis 120'))).toEqual([choice('old-p2', 'planche', 'neuf', 'Axis 120')]);
  });

  it('pose un premier choix sur une fiche vide', () => {
    expect(withLineChoice(null, wing, 'g-voile', choice('g-voile', 'Voile', 'v-65', 'Gong puls 6.5'))).toEqual([choice('g-voile', 'Voile', 'v-65', 'Gong puls 6.5')]);
    expect(withLineChoice(null, wing, 'g-voile', null)).toBeNull();
  });
});
