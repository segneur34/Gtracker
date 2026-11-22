import { describe, expect, it } from 'vitest';
import type { WirelessPhone, WirelessState } from '../platform/wirelessPhone';
import {
  authorizationOutcomeText, countdownText, describePhoneSeen, describeWireless, firewallNotice, pairingAddress, pairingDeadline, pairingStatus, remainingMs,
} from './wirelessPhone';

const state = (patch: Partial<WirelessState> = {}): WirelessState => ({
  actif: true, ecoute: true, port: 48217, adresses: ['192.168.1.20'], pareFeu: 'inconnu', erreur: null, appairage: null, relies: [], ...patch,
});

const phone = (patch: Partial<WirelessPhone> = {}): WirelessPhone => ({ id: 'a1', nom: 'Pixel', ajouteLe: 1000, vuLe: null, relie: false, ...patch });

describe('état du sans-fil en phrases', () => {
  it('éteint : une phrase', () => {
    const status = describeWireless(state({ actif: false, ecoute: false }));
    expect(status.kind).toBe('off');
    expect(status.text).toContain('éteint');
  });

  it('à l\'écoute : « Prêt », sans l\'adresse (montrée par la fenêtre du code), sans conseil de câble ni de débogage USB', () => {
    const status = describeWireless(state());
    expect(status).toEqual({ kind: 'listening', text: 'Prêt : Gtracker attend votre téléphone.' });
    expect(status.text).not.toContain('192.168.1.20');
    expect(JSON.stringify(status)).not.toMatch(/câble|USB/);
  });

  it('activé sans écoute : l\'erreur en clair, ou l\'invitation à relier le réseau', () => {
    const error = describeWireless(state({ ecoute: false, adresses: [], erreur: 'Le port est pris.' }));
    expect(error).toMatchObject({ kind: 'error', text: 'Le sans-fil ne démarre pas : Le port est pris.' });
    const noNetwork = describeWireless(state({ ecoute: false, adresses: [] }));
    expect(noNetwork.kind).toBe('no-network');
    expect(noNetwork.text).toContain('partage-t-il sa connexion');
  });
});

describe('pare-feu de Windows en phrases', () => {
  it('bloqué et réparable : la phrase et le bouton', () => {
    expect(firewallNotice(state({ pareFeu: 'bloque', pareFeuReparable: true }))).toEqual({
      text: 'Windows ne laisse pas passer votre téléphone sur ce réseau.',
      canAuthorize: true,
    });
  });

  it('bloqué sans réparation possible (ou coquille ancienne) : la phrase et le réglage de l\'administrateur, sans bouton', () => {
    for (const notice of [firewallNotice(state({ pareFeu: 'bloque', pareFeuReparable: false })), firewallNotice(state({ pareFeu: 'bloque' }))]) {
      expect(notice?.canAuthorize).toBe(false);
      expect(notice?.text).toMatch(/^Windows ne laisse pas passer votre téléphone sur ce réseau\. Un réglage de l'administrateur/);
    }
  });

  it('ouvert, inconnu, éteint ou sans écoute : rien, et jamais de conseil de câble', () => {
    expect(firewallNotice(state({ pareFeu: 'ouvert' }))).toBeNull();
    expect(firewallNotice(state({ pareFeu: 'inconnu', pareFeuReparable: true }))).toBeNull();
    expect(firewallNotice(state({ actif: false, ecoute: false, pareFeu: 'bloque' }))).toBeNull();
    expect(firewallNotice(state({ ecoute: false, pareFeu: 'bloque' }))).toBeNull();
    expect(JSON.stringify(firewallNotice(state({ pareFeu: 'bloque' })))).not.toMatch(/câble|USB/);
  });

  it('issue de la demande : rien si accordée, le refus, l\'échec avec sa raison', () => {
    expect(authorizationOutcomeText('accordee')).toBeNull();
    expect(authorizationOutcomeText('refusee')).toBe("Windows n'a pas donné l'autorisation : le téléphone ne pourra pas se présenter sur ce réseau.");
    expect(authorizationOutcomeText('echec', "Windows n'a pas répondu à temps.")).toBe("L'autorisation n'a pas pu être ajoutée : Windows n'a pas répondu à temps.");
    expect(authorizationOutcomeText('echec')).toBe("L'autorisation n'a pas pu être ajoutée : erreur inconnue.");
  });
});

describe('fenêtre de liaison', () => {
  it('décompte : minutes et secondes, arrondi vers le haut, jamais négatif', () => {
    expect(countdownText(120_000)).toBe('2:00');
    expect(countdownText(104_200)).toBe('1:45');
    expect(countdownText(500)).toBe('0:01');
    expect(countdownText(0)).toBe('0:00');
    expect(countdownText(-5000)).toBe('0:00');
  });

  it('échéance sur l\'horloge de la page, temps restant borné', () => {
    const deadline = pairingDeadline({ restantMs: 120_000 }, 50_000);
    expect(deadline).toBe(170_000);
    expect(remainingMs(deadline, 110_000)).toBe(60_000);
    expect(remainingMs(deadline, 999_999)).toBe(0);
  });

  it('adresse à taper : celle du PC et son numéro de porte', () => {
    expect(pairingAddress({ adresse: '192.168.1.20', port: 48217 })).toBe('192.168.1.20:48217');
  });

  it('attend, puis conclut : téléphone relié depuis l\'ouverture, fenêtre fermée par le PC, ou échéance', () => {
    const base = { deadlineMs: 170_000, nowMs: 100_000, open: true, phones: [phone({ ajouteLe: 500 })], sinceMs: 50_000 };
    expect(pairingStatus(base)).toEqual({ kind: 'waiting' });
    expect(pairingStatus({ ...base, phones: [phone({ ajouteLe: 500 }), phone({ nom: 'Galaxy', ajouteLe: 60_000 })] })).toEqual({ kind: 'linked', name: 'Galaxy' });
    expect(pairingStatus({ ...base, open: false })).toEqual({ kind: 'closed' });
    expect(pairingStatus({ ...base, nowMs: 170_000 })).toEqual({ kind: 'closed' });
    // Un téléphone relié avant l'ouverture ne conclut rien ; relié à l'instant de l'ouverture, si.
    expect(pairingStatus({ ...base, phones: [phone({ ajouteLe: 49_999 })] })).toEqual({ kind: 'waiting' });
    expect(pairingStatus({ ...base, phones: [phone({ ajouteLe: 50_000 })] })).toMatchObject({ kind: 'linked' });
  });
});

describe('ligne d\'un téléphone relié', () => {
  it('relié en ce moment, ou vu pour la dernière fois', () => {
    expect(describePhoneSeen(phone({ relie: true }))).toBe('relié en ce moment');
    const seen = describePhoneSeen(phone({ vuLe: Date.UTC(2026, 10, 20, 9, 5) }));
    expect(seen).toMatch(/^vu pour la dernière fois le .*2026/);
    // Jamais revenu depuis la liaison : la date de la liaison.
    expect(describePhoneSeen(phone({ ajouteLe: Date.UTC(2026, 10, 18, 9, 5) }))).toMatch(/2026/);
  });
});
