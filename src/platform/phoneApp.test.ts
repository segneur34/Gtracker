import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BridgeAnswer, DesktopAppBridge, DesktopAppInstall } from './desktopBridge';
import {
  describePhoneAppInstall, installPhoneApp, markPhoneAppProposed, phoneAppAvailable, phoneAppInfo, savePhoneApp,
} from './phoneApp';

/** L'application du téléphone vue de la page, sur un faux pont qui répond comme la coquille. */

const ok = <T,>(valeur: T): Promise<BridgeAnswer<T>> => Promise.resolve({ ok: true, valeur });
const ko = (code: 'NOT_FOUND' | 'UNKNOWN', message: string): Promise<BridgeAnswer<never>> =>
  Promise.resolve({ ok: false, code, message });

/** Le programme Windows ; `application` absent : une coquille plus ancienne. */
const shell = (application?: Partial<DesktopAppBridge>): void => {
  vi.stubGlobal('window', {
    gtrackerBureau: {
      version: '0.01.40',
      memoire: { ouvrir: () => ok({ etat: 'aucun' }) },
      textes: () => ok(null),
      ...(application ? { application } : {}),
    },
  });
};

/** Un canal complet : état donné, enregistrement et installation imposés, propositions comptées. */
const fullApp = (o: {
  disponible?: boolean;
  proposee?: boolean;
  enregistrer?: DesktopAppBridge['enregistrer'];
  installer?: DesktopAppBridge['installer'];
} = {}) => {
  const marks: number[] = [];
  const app: DesktopAppBridge = {
    etat: () => ok({ version: '0.01.40', disponible: o.disponible ?? true, proposee: o.proposee ?? false }),
    enregistrer: o.enregistrer ?? (() => ok('C:\\Users\\moi\\Downloads\\Gtracker-0.01.40.apk')),
    installer: o.installer ?? (() => ok<DesktopAppInstall>({ etat: 'installee', nom: 'Pixel 8' })),
    marquerProposee: () => {
      marks.push(1);
      return ok(null);
    },
  };
  return { app, marks };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('phoneAppAvailable', () => {
  it('est faux hors du programme Windows et dans une coquille sans le canal', () => {
    expect(phoneAppAvailable()).toBe(false);
    shell();
    expect(phoneAppAvailable()).toBe(false);
    shell({ etat: fullApp().app.etat });
    expect(phoneAppAvailable()).toBe(false);
  });

  it('est vrai quand la coquille offre les quatre fonctions', () => {
    shell(fullApp().app);
    expect(phoneAppAvailable()).toBe(true);
  });
});

describe('phoneAppInfo', () => {
  it('rend la version, la présence de l’APK et la proposition déjà faite', async () => {
    shell(fullApp({ disponible: false, proposee: true }).app);
    expect(await phoneAppInfo()).toEqual({ version: '0.01.40', available: false, proposed: true });
  });

  it('lève hors du programme Windows', async () => {
    await expect(phoneAppInfo()).rejects.toThrow("Ce programme n'a pas l'application du téléphone.");
  });
});

describe('savePhoneApp', () => {
  it('passe le titre et rend le chemin écrit, ou null si l’utilisateur renonce', async () => {
    const titles: unknown[] = [];
    let answer: string | null = 'D:\\Gtracker-0.01.40.apk';
    shell(fullApp({ enregistrer: (argument) => { titles.push(argument); return ok(answer); } }).app);
    expect(await savePhoneApp('Enregistrer')).toBe('D:\\Gtracker-0.01.40.apk');
    expect(titles).toEqual([{ titre: 'Enregistrer' }]);
    answer = null;
    expect(await savePhoneApp('Enregistrer')).toBeNull();
  });

  it('dit que le programme n’a pas l’application quand l’APK manque', async () => {
    shell(fullApp({ enregistrer: () => ko('NOT_FOUND', 'absente') }).app);
    await expect(savePhoneApp('x')).rejects.toMatchObject({ message: "Ce programme n'a pas l'application du téléphone.", code: 'NOT_FOUND' });
  });
});

describe('installPhoneApp', () => {
  it('rend l’issue de la coquille telle quelle', async () => {
    shell(fullApp({ installer: () => ok<DesktopAppInstall>({ etat: 'refusee', raison: 'signature', detail: 'INSTALL_FAILED_UPDATE_INCOMPATIBLE' }) }).app);
    expect(await installPhoneApp()).toEqual({ etat: 'refusee', raison: 'signature', detail: 'INSTALL_FAILED_UPDATE_INCOMPATIBLE' });
  });

  it('lève sans APK, et sur un délai dépassé', async () => {
    shell(fullApp({ installer: () => ko('NOT_FOUND', 'absente') }).app);
    await expect(installPhoneApp()).rejects.toThrow("Ce programme n'a pas l'application du téléphone.");
    shell(fullApp({ installer: () => ko('UNKNOWN', 'Délai dépassé.') }).app);
    await expect(installPhoneApp()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('markPhoneAppProposed', () => {
  it('demande à la coquille de retenir la proposition', async () => {
    const { app, marks } = fullApp();
    shell(app);
    await markPhoneAppProposed();
    expect(marks).toHaveLength(1);
  });
});

describe('describePhoneAppInstall', () => {
  it('dit chaque issue en une phrase', () => {
    expect(describePhoneAppInstall({ etat: 'installee', nom: 'Pixel 8' })).toEqual({ ok: true, text: 'Application installée sur Pixel 8.' });
    expect(describePhoneAppInstall({ etat: 'absent' })).toEqual({ ok: false, text: 'Aucun téléphone branché.' });
    expect(describePhoneAppInstall({ etat: 'autorisation' }).text).toBe("Acceptez cet ordinateur sur l'écran du téléphone, puis réessayez.");
    expect(describePhoneAppInstall({ etat: 'horsLigne' }).text).toBe('Le téléphone ne répond pas : débranchez-le et rebranchez-le.');
    expect(describePhoneAppInstall({ etat: 'adbIntrouvable', dossier: 'C:\\outils' }).text)
      .toBe("L'outil du débogage USB n'est pas sur ce PC : enregistrez l'APK et copiez-la sur le téléphone.");
    expect(describePhoneAppInstall({ etat: 'occupe' }).text).toBe('Un autre programme tient la liaison avec le téléphone : fermez-le et réessayez.');
  });

  it('nomme la raison d’un refus, et montre le message d’Android pour une autre raison', () => {
    const refus = (raison: 'versionPlusRecente' | 'signature' | 'usbCoupee' | 'memoirePleine' | 'autre', detail = '') =>
      describePhoneAppInstall({ etat: 'refusee', raison, detail });
    expect(refus('versionPlusRecente').text).toBe("Le téléphone a refusé l'installation : une version plus récente y est déjà.");
    expect(refus('signature').text).toBe("Le téléphone a refusé l'installation : l'application installée n'a pas la même signature.");
    expect(refus('usbCoupee').text).toBe("Le téléphone a refusé l'installation : l'installation par USB est coupée dans les options pour les développeurs.");
    expect(refus('memoirePleine').text).toBe("Le téléphone a refusé l'installation : mémoire pleine.");
    expect(refus('autre', 'Failure [INSTALL_FAILED_ABORTED: User rejected permissions].')).toEqual({
      ok: false, text: "Le téléphone a refusé l'installation : Failure [INSTALL_FAILED_ABORTED: User rejected permissions].",
    });
    expect(refus('autre', '  ').text).toBe("Le téléphone a refusé l'installation : raison inconnue.");
  });
});
