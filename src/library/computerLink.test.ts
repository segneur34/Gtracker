import { describe, expect, it } from 'vitest';
import type { ComputerLinkError, ComputerLinkStatus } from '../platform/computerLink';
import {
  EXCHANGE_SCREEN_ON_MS, addressFieldShown, addressWellFormed, cleanCode, codeComplete, describeLink, elapsedText, exchangeScreenOnUntil,
  linkErrorText, linkSettled, refusalText, shouldAutoConnect, shownLinkStatus,
} from './computerLink';

const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);
const MIN = 60_000;

const status = (patch: Partial<ComputerLinkStatus> = {}): ComputerLinkStatus => ({
  state: 'idle', error: null, paired: true, computerName: 'PC-SALON', address: '192.168.1.20:48217',
  lastSentMs: null, sentFiles: 0, onLocalNetwork: true, lastExchangeMs: null, ...patch,
});

describe('saisie du code et de l\'adresse', () => {
  it('le code ne garde que ses six premiers chiffres', () => {
    expect(cleanCode('12 34-56')).toBe('123456');
    expect(cleanCode('1234567890')).toBe('123456');
    expect(cleanCode('abc')).toBe('');
    expect(codeComplete('12345')).toBe(false);
    expect(codeComplete('123456')).toBe(true);
  });

  it('l\'adresse : quatre nombres de 0 à 255, la porte facultative de 1 à 65535', () => {
    for (const ok of ['192.168.1.20:48217', '192.168.1.20', '10.0.0.1:1', ' 172.16.0.5:65535 ']) expect(addressWellFormed(ok), ok).toBe(true);
    for (const bad of ['', '192.168.1', '192.168.1.256', '192.168.1.20:0', '192.168.1.20:65536', '192.168.1.20:', 'pc-salon:48217', '192.168.1.20:48217:1']) {
      expect(addressWellFormed(bad), bad).toBe(false);
    }
  });
});

describe('temps écoulé depuis le dernier envoi', () => {
  it('à l\'instant, en minutes, en heures, puis la date', () => {
    expect(elapsedText(NOW - 20_000, NOW)).toBe('à l\'instant');
    expect(elapsedText(NOW + 5_000, NOW)).toBe('à l\'instant');
    expect(elapsedText(NOW - 2 * MIN, NOW)).toBe('il y a 2 min');
    expect(elapsedText(NOW - 59 * MIN, NOW)).toBe('il y a 59 min');
    expect(elapsedText(NOW - 60 * MIN, NOW)).toBe('il y a 1 h');
    expect(elapsedText(NOW - 23 * 60 * MIN, NOW)).toBe('il y a 23 h');
    expect(elapsedText(NOW - 24 * 60 * MIN, NOW)).toMatch(/^le .*2026/);
  });
});

describe('phrases d\'erreur : en clair, sans le vocabulaire du protocole', () => {
  const ALL: ComputerLinkError[] = ['noLocalNetwork', 'localNetwork', 'code', 'window', 'nonce', 'token', 'version', 'certificate', 'proof', 'network', 'protocol'];

  it('chaque raison a sa phrase, toutes différentes, sans jargon', () => {
    const texts = ALL.map(linkErrorText);
    expect(new Set(texts).size).toBe(ALL.length);
    for (const text of [...texts, refusalText('code'), refusalText('address')]) expect(text).not.toMatch(/TLS|jeton|certificat|token|HMAC|nonce/i);
  });

  it('dit quoi faire', () => {
    expect(linkErrorText('code')).toContain('faux');
    expect(linkErrorText('window')).toContain('expiré');
    expect(linkErrorText('window')).toContain('Relier un téléphone');
    expect(linkErrorText('noLocalNetwork')).toContain('partage de connexion');
    expect(linkErrorText('token')).toContain('ne reconnaît plus');
    expect(linkErrorText('version')).toContain('version');
    expect(linkErrorText('network')).toBe('La liaison avec l\'ordinateur s\'est coupée. Gtracker la reprend tout seul tant qu\'il est affiché.');
  });

  it('plus aucun conseil de câble ni de débogage', () => {
    for (const text of ALL.map(linkErrorText)) expect(text).not.toMatch(/USB|débogage|câble/i);
  });
});

describe('describeLink : ce que le bloc dit', () => {
  it('relié : le nom, la dernière synchronisation en temps écoulé', () => {
    const line = describeLink(status({ state: 'linked', lastSentMs: NOW - 2 * MIN }), NOW);
    expect(line).toEqual({ headline: 'Relié à PC-SALON en ce moment.', problem: null, sent: 'Dernière synchronisation : il y a 2 min.' });
  });

  it('connu mais jamais synchronisé', () => {
    expect(describeLink(status(), NOW)).toMatchObject({ headline: 'PC-SALON : pas relié pour l\'instant.', sent: 'Pas encore synchronisé.' });
  });

  it('ordinateur introuvable : dit quoi vérifier, et que l\'ordinateur dira si Windows le bloque', () => {
    expect(describeLink(status({ state: 'notFound' }), NOW)).toMatchObject({
      headline: '« PC-SALON » est introuvable. Vérifiez qu\'il est allumé, Gtracker ouvert, sur le même réseau ; cliquez-y sur « Synchroniser » : il dira si Windows bloque.',
      problem: null,
    });
    expect(describeLink(status({ state: 'notFound', computerName: null }), NOW).headline).toMatch(/^L'ordinateur est introuvable\. Vérifiez/);
  });

  it('une raison d\'échec devient le problème', () => {
    expect(describeLink(status({ error: 'token' }), NOW).problem).toBe(linkErrorText('token'));
  });

  it('sans réseau local, la phrase du réseau passe avant, sauf pendant une liaison', () => {
    expect(describeLink(status({ onLocalNetwork: false, error: 'network' }), NOW).problem).toBe(linkErrorText('noLocalNetwork'));
    expect(describeLink(status({ onLocalNetwork: false, state: 'linked' }), NOW).problem).toBeNull();
  });

  it('jamais relié : aucune phrase d\'état ni dernier envoi', () => {
    expect(describeLink(status({ paired: false, state: 'unpaired', computerName: null }), NOW)).toEqual({ headline: null, problem: null, sent: null });
  });

  it('recherche, liaison en cours, et ordinateur non trouvé avant d\'être connu', () => {
    expect(describeLink(status({ state: 'searching' }), NOW).headline).toBe('Recherche de PC-SALON sur le réseau…');
    expect(describeLink(status({ paired: false, state: 'searching', computerName: null }), NOW).headline).toBe('Recherche de l\'ordinateur sur le réseau…');
    expect(describeLink(status({ paired: false, state: 'pairing', computerName: null }), NOW).headline).toBe('Liaison à l\'ordinateur en cours…');
    expect(describeLink(status({ paired: false, state: 'notFound', computerName: null }), NOW).headline).toBe('Gtracker n\'a pas trouvé l\'ordinateur sur le réseau.');
  });
});

describe('addressFieldShown : l\'adresse se saisit quand l\'ordinateur ne s\'est pas trouvé seul', () => {
  it('seulement introuvable, avec un réseau local', () => {
    expect(addressFieldShown(status({ state: 'notFound' }))).toBe(true);
    expect(addressFieldShown(status({ state: 'notFound', error: 'network' }))).toBe(true);
    expect(addressFieldShown(status({ state: 'notFound', error: 'noLocalNetwork', onLocalNetwork: false }))).toBe(false);
    expect(addressFieldShown(status({ state: 'idle' }))).toBe(false);
    expect(addressFieldShown(status({ state: 'linked' }))).toBe(false);
  });
});

describe('shownLinkStatus : une tentative automatique ne se voit pas', () => {
  const lost = status({ state: 'notFound' });
  const searching = status({ state: 'searching' });

  it('relance automatique, ordinateur introuvable : le bloc reste sur « introuvable », champ « Adresse » et boutons compris', () => {
    const shown = shownLinkStatus(searching, lost, false);
    expect(shown).toBe(lost);
    expect(describeLink(shown, NOW).headline).toMatch(/introuvable/);
    expect(addressFieldShown(shown)).toBe(true);
  });

  it('une coupure gardée reste dite pendant la relance', () => {
    const cut = status({ state: 'idle', error: 'network' });
    expect(describeLink(shownLinkStatus(searching, cut, false), NOW).problem).toBe(linkErrorText('network'));
  });

  it('un geste du bloc montre la recherche', () => {
    expect(shownLinkStatus(searching, lost, true)).toBe(searching);
  });

  it('sans état posé (ouverture), ou ordinateur pas encore connu : la recherche se montre', () => {
    expect(shownLinkStatus(searching, null, false)).toBe(searching);
    const unpaired = status({ paired: false, state: 'searching', computerName: null });
    expect(shownLinkStatus(unpaired, status({ paired: false, state: 'unpaired' }), false)).toBe(unpaired);
  });

  it('hors recherche, l\'état du greffon passe tel quel', () => {
    const linked = status({ state: 'linked' });
    expect(shownLinkStatus(linked, lost, false)).toBe(linked);
  });

  it('seul un état hors tentative est gardé', () => {
    expect(linkSettled(lost)).toBe(true);
    expect(linkSettled(searching)).toBe(false);
    expect(linkSettled(status({ state: 'pairing' }))).toBe(false);
  });
});

describe('exchangeScreenOnUntil : l\'écran reste allumé pendant un échange', () => {
  it('liaison ouverte et demande reçue : jusqu\'à 30 s après la dernière', () => {
    expect(EXCHANGE_SCREEN_ON_MS).toBe(30_000);
    expect(exchangeScreenOnUntil(status({ state: 'linked', lastExchangeMs: NOW }))).toBe(NOW + 30_000);
  });

  it('sans liaison, ou sans demande connue (greffon plus ancien) : rien', () => {
    expect(exchangeScreenOnUntil(status({ state: 'idle', lastExchangeMs: NOW }))).toBeNull();
    expect(exchangeScreenOnUntil(status({ state: 'searching', lastExchangeMs: NOW }))).toBeNull();
    expect(exchangeScreenOnUntil(status({ state: 'linked', lastExchangeMs: null }))).toBeNull();
  });
});

describe('shouldAutoConnect : la liaison se tente seule', () => {
  const base = { hasFolder: true, recording: false };

  it('ordinateur connu, réseau local, dossier désigné, rien en cours : oui', () => {
    for (const state of ['idle', 'notFound', 'linked'] as const) expect(shouldAutoConnect({ ...base, status: status({ state }) }), state).toBe(true);
  });

  it('un partage de connexion compte : seul `onLocalNetwork` décide, jamais le Wi-Fi', () => {
    expect(shouldAutoConnect({ ...base, status: status({ onLocalNetwork: true }) })).toBe(true);
    expect(shouldAutoConnect({ ...base, status: status({ onLocalNetwork: false }) })).toBe(false);
  });

  it('jamais pendant un enregistrement', () => {
    expect(shouldAutoConnect({ ...base, recording: true, status: status() })).toBe(false);
  });

  it('jamais sans dossier mémoire, sans ordinateur connu, ni pendant une tentative', () => {
    expect(shouldAutoConnect({ ...base, hasFolder: false, status: status() })).toBe(false);
    expect(shouldAutoConnect({ ...base, status: status({ paired: false, state: 'unpaired' }) })).toBe(false);
    expect(shouldAutoConnect({ ...base, status: status({ state: 'searching' }) })).toBe(false);
    expect(shouldAutoConnect({ ...base, status: status({ state: 'pairing' }) })).toBe(false);
  });
});
