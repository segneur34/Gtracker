import { describe, expect, it } from 'vitest';
import { EMPTY_ATHLETE_PROFILE } from './athleteProfile';
import {
  PROFILE_PROMPT_FIELDS, SAFETY_NOTICE_UNSEEN, missingProfileFields, phoneAppOfferGate, profilePromptGate, readSafetyNotice,
  shouldPromptProfile,
} from './profilePrompt';

describe('readSafetyNotice : la mise en garde de la première ouverture, relue de l\'appareil', () => {
  it('lue seulement quand « vue » vaut vrai', () => {
    expect(readSafetyNotice({ vue: true })).toEqual({ vue: true });
    expect(readSafetyNotice({ vue: false })).toEqual(SAFETY_NOTICE_UNSEEN);
  });

  it("revient pour toute autre forme gardée (valeur abîmée, d'un autre type)", () => {
    for (const raw of [null, undefined, true, 'vue', 1, [], {}, { vue: 'true' }, { vue: 1 }]) {
      expect(readSafetyNotice(raw)).toEqual(SAFETY_NOTICE_UNSEEN);
    }
  });
});

describe("phoneAppOfferGate : l'application du téléphone après toutes les cartes d'ouverture", () => {
  const free = { memoryNeedsAction: false, memoryReady: true, permissionsShown: false, profileShown: false, safetyShown: false };

  it('attend le lancement suivant quand la mise en garde de la première ouverture a paru à celui-ci', () => {
    expect(phoneAppOfferGate({ ...free, safetyShown: true })).toBe(false);
  });

  it('est posée quand la mémoire est prête et que rien ne paraît', () => {
    expect(phoneAppOfferGate(free)).toBe(true);
  });

  it('attend la mémoire, la lecture des autorisations et la décision du pop-up du profil', () => {
    expect(phoneAppOfferGate({ ...free, memoryReady: false })).toBe(false);
    expect(phoneAppOfferGate({ ...free, memoryNeedsAction: true })).toBe(false);
    expect(phoneAppOfferGate({ ...free, permissionsShown: null })).toBe(false);
    expect(phoneAppOfferGate({ ...free, profileShown: null })).toBe(false);
  });

  it("ne s'ouvre jamais par-dessus la carte des autorisations ni le pop-up du profil", () => {
    expect(phoneAppOfferGate({ ...free, permissionsShown: true })).toBe(false);
    expect(phoneAppOfferGate({ ...free, profileShown: true })).toBe(false);
  });
});

describe('missingProfileFields', () => {
  const full = { ...EMPTY_ATHLETE_PROFILE, name: 'Tom', birthYear: 1985, sex: 'm' as const, weightKg: 72, heightCm: 178 };

  it('rend les deux champs pour un profil vide, dans leur ordre : pseudo et année de naissance', () => {
    expect(missingProfileFields(EMPTY_ATHLETE_PROFILE)).toEqual([...PROFILE_PROMPT_FIELDS]);
    expect(PROFILE_PROMPT_FIELDS).toEqual(['name', 'birthYear']);
  });

  it('ne demande plus ni le sexe, ni le poids, ni la taille', () => {
    expect(missingProfileFields({ ...EMPTY_ATHLETE_PROFILE, name: 'Tom', birthYear: 1985 })).toEqual([]);
  });

  it('ne rend rien pour un profil rempli, FC comprises ou non', () => {
    expect(missingProfileFields(full)).toEqual([]);
    expect(missingProfileFields({ ...full, hrMax: null, hrRest: null })).toEqual([]);
  });

  it("compte un nom fait d'espaces comme manquant", () => {
    expect(missingProfileFields({ ...full, name: '   ' })).toEqual(['name']);
  });

  it("compte une valeur importée hors plage ou d'un autre type comme manquante", () => {
    expect(missingProfileFields({ ...full, birthYear: 1800 })).toEqual(['birthYear']);
    expect(missingProfileFields({ ...full, birthYear: '1985' as unknown as number })).toEqual(['birthYear']);
  });
});

describe('shouldPromptProfile', () => {
  const base = { native: true, missing: ['name'] as const, askedThisLaunch: false, otherCardShown: false };

  it("s'ouvre dans l'application, un champ manquant, pas encore ouvert à ce lancement", () => {
    expect(shouldPromptProfile(base)).toBe(true);
  });

  it("ne s'ouvre ni dans le navigateur, ni profil rempli, ni deux fois par lancement", () => {
    expect(shouldPromptProfile({ ...base, native: false })).toBe(false);
    expect(shouldPromptProfile({ ...base, missing: [] })).toBe(false);
    expect(shouldPromptProfile({ ...base, askedThisLaunch: true })).toBe(false);
  });

  it("ne s'ouvre pas par-dessus la carte de la mémoire ou des autorisations", () => {
    expect(shouldPromptProfile({ ...base, otherCardShown: true })).toBe(false);
  });
});

describe('profilePromptGate : mémoire, autorisations, puis profil', () => {
  const ready = { memoryNeedsAction: false, memoryReady: true, safetyShown: false };

  it('attend la lecture des autorisations', () => {
    expect(profilePromptGate({ ...ready, permissionsShown: null }).mount).toBe(false);
  });

  it("n'est pas posé tant que la mémoire n'est pas prête", () => {
    expect(profilePromptGate({ ...ready, memoryReady: false, permissionsShown: false }).mount).toBe(false);
  });

  it('se tait derrière la carte de la mémoire', () => {
    expect(profilePromptGate({ ...ready, memoryNeedsAction: true, memoryReady: false, permissionsShown: null })).toEqual({ mount: true, otherCardShown: true });
  });

  it('attend le lancement suivant quand la mise en garde de la première ouverture a paru à celui-ci', () => {
    expect(profilePromptGate({ ...ready, permissionsShown: false, safetyShown: true })).toEqual({ mount: true, otherCardShown: true });
  });

  it('se tait derrière la carte des autorisations', () => {
    expect(profilePromptGate({ ...ready, permissionsShown: true })).toEqual({ mount: true, otherCardShown: true });
  });

  it('passe en dernier quand les deux sont réglées', () => {
    expect(profilePromptGate({ ...ready, permissionsShown: false })).toEqual({ mount: true, otherCardShown: false });
  });
});
