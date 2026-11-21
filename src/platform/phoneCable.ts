import { t } from '../core/i18n';
import { desktopBridge, type DesktopPhoneBridge, type DesktopPhoneChannel, type DesktopPhoneFile, type DesktopPhoneState } from './desktopBridge';
import { bridgeValue } from './diskMemory';
import type { FolderEntry, ImportEntry, MemoryFolder } from './memoryFolder';
import { isDesktopApp } from './runtime';

/**
 * Le téléphone lu par le programme Windows, par le Wi-Fi s'il y est relié (`wirelessPhone.ts`), sinon par le câble :
 * son état (qui dit son canal, s'il sait écrire et s'il liste les itinéraires), le contenu de son dossier
 * `Documents/Gtracker` (racine, `sessions/`, et `itineraires/` et `reglages/` par le câble), ses fichiers à importer, lus un par un au moment de les ranger, et ce
 * dossier sous la forme de tout dossier mémoire (`phoneMemoryFolder`), qui écrit et efface par le câble seulement.
 * Ailleurs (navigateur, téléphone, coquille plus ancienne), rien de cela n'existe.
 */

export type PhoneState = DesktopPhoneState;

/** Par où le téléphone est lu : le Wi-Fi (`sansFil`) ou le câble. */
export type PhoneChannel = DesktopPhoneChannel;

/** Canal d'un téléphone prêt ; une coquille qui ne le dit pas lit par le câble. */
export const phoneChannel = (state: Extract<PhoneState, { etat: 'pret' }>): PhoneChannel => state.canal ?? 'cable';

/** Fichier du téléphone : chemin relatif à `Documents/Gtracker`, séparé par `/` ; taille en octets. */
export interface PhoneFile {
  path: string;
  size: number;
}

/** Le pont du téléphone, `null` hors du programme Windows ou dans une coquille qui ne le lit pas. */
const phoneBridge = (): DesktopPhoneBridge | null => {
  if (!isDesktopApp()) return null;
  const phone = desktopBridge()?.telephone;
  return phone && typeof phone.etat === 'function' && typeof phone.lister === 'function' && typeof phone.lireOctets === 'function'
    ? phone
    : null;
};

/** Vrai dans le programme Windows dont la coquille lit le téléphone branché. */
export const phoneCableAvailable = (): boolean => phoneBridge() !== null;

const requirePhone = (): DesktopPhoneBridge => {
  const phone = phoneBridge();
  if (!phone) throw Object.assign(new Error(t("Ce programme ne sait pas lire un téléphone branché.")), { code: 'UNKNOWN' });
  return phone;
};

/** État du téléphone ; lève sur une panne imprévue, avec la phrase à montrer. */
export const phoneState = (): Promise<PhoneState> => bridgeValue(requirePhone().etat());

/**
 * Fichiers de la racine et des sous-dossiers que le canal liste du dossier `Documents/Gtracker` du téléphone ; `null`
 * si ce dossier n'y est pas. Lève si le téléphone n'est pas prêt ou s'est perdu en route.
 */
export const listPhoneFiles = async (): Promise<PhoneFile[] | null> => {
  const answer = await requirePhone().lister();
  if (!answer.ok && answer.code === 'NOT_FOUND') return null;
  return (await bridgeValue(Promise.resolve(answer))).map((f) => ({ path: f.chemin, size: f.taille }));
};

/**
 * Vrai si le téléphone prêt est lu par un canal qui sait écrire et effacer (le câble), et que la coquille en a les
 * canaux ; faux ailleurs, et pour une coquille plus ancienne.
 */
export const phoneCanWrite = (state: PhoneState): boolean => {
  const phone = phoneBridge();
  return state.etat === 'pret' && state.ecriture === true && typeof phone?.ecrireOctets === 'function' && typeof phone.effacer === 'function';
};

/**
 * Vrai si le téléphone prêt est lu par un canal qui liste aussi `itineraires/` (le câble d'une coquille qui le dit) ;
 * faux par le sans-fil et pour une coquille plus ancienne, dont le listage muet ferait croire les itinéraires
 * supprimés du téléphone : la synchronisation n'y touche alors pas.
 */
export const phoneListsRoutes = (state: PhoneState): boolean => state.etat === 'pret' && state.itineraires === true;

/**
 * Copie de sécurité des deux dossiers (la mémoire du PC et celle du téléphone), faite par la coquille avant la première
 * synchronisation d'un téléphone ; rend le chemin de la copie. Lève, avec la phrase à montrer, si elle n'a pas pu se
 * faire ou si la coquille ne la sait pas (plus ancienne) : la synchronisation est alors refusée.
 */
export const phoneSafetyCopy = async (): Promise<string> => {
  const phone = requirePhone();
  if (typeof phone.copieSecurite !== 'function') {
    throw Object.assign(new Error(t('ce programme est trop ancien pour faire la copie de sécurité ; installez sa dernière version')), { code: 'UNKNOWN' });
  }
  return bridgeValue(phone.copieSecurite());
};

/** Chemin relatif sans barre en trop (`/sessions/` comme `sessions`). */
const cleanPath = (path: string): string => path.split('/').filter((part) => part !== '').join('/');

/** Octets à envoyer : la vue seule, jamais le reste du tampon qui la porte. */
const exactBytes = (bytes: Uint8Array): Uint8Array =>
  bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();

/**
 * Le dossier `Documents/Gtracker` du téléphone branché, sous la forme de tout dossier mémoire (sorte `phone`), pour le
 * comparer au dossier du PC et y recopier des fichiers. Il tient le dernier listage du téléphone :
 * - `list` relit le téléphone à chaque appel (les dossiers se déduisent des fichiers : un dossier vide n'apparaît pas) ;
 * - `readBytes`, `readText` et `stat` répondent d'après ce listage, fait au premier besoin : `null` pour un fichier
 *   qu'il ne porte pas ;
 * - `writeBytes` et `writeText` écrivent par la coquille (nom provisoire, taille relue, renommage) et tiennent le
 *   listage à jour, date du téléphone comprise ; `remove` efface un seul fichier, sans effet s'il n'est pas au listage.
 * La coquille n'admet l'écriture et l'effacement que dans sa liste blanche (`sessions/`, `itineraires/`, `reglages/`,
 * `gtracker.json`, `fc-repos.json`, `lieux.json`) et par le câble : ailleurs, ces appels lèvent.
 */
export const phoneMemoryFolder = (label: string): MemoryFolder => {
  const phone = requirePhone();
  let listed: Map<string, DesktopPhoneFile> | null = null;

  const refresh = async (): Promise<Map<string, DesktopPhoneFile>> => {
    listed = null;
    const answer = await phone.lister();
    const files = !answer.ok && answer.code === 'NOT_FOUND' ? [] : await bridgeValue(Promise.resolve(answer));
    const fresh = new Map(files.map((f) => [f.chemin, f]));
    listed = fresh;
    return fresh;
  };
  const current = (): Promise<Map<string, DesktopPhoneFile>> => (listed ? Promise.resolve(listed) : refresh());

  const writer = () => {
    const { ecrireOctets, effacer } = phone;
    if (typeof ecrireOctets !== 'function' || typeof effacer !== 'function') {
      throw Object.assign(new Error('Coquille sans écriture sur le téléphone.'), { code: 'UNKNOWN' });
    }
    return { ecrireOctets: ecrireOctets.bind(phone), effacer: effacer.bind(phone) };
  };

  const readBytes = async (path: string): Promise<Uint8Array | null> => {
    const chemin = cleanPath(path);
    if (!(await current()).has(chemin)) return null;
    return bridgeValue(phone.lireOctets({ chemin }));
  };

  const writeBytes = async (path: string, bytes: Uint8Array): Promise<void> => {
    const chemin = cleanPath(path);
    const { ecrireOctets } = writer();
    const files = await current();
    const written = await bridgeValue(ecrireOctets({ chemin, octets: exactBytes(bytes) }));
    files.set(chemin, written);
  };

  return {
    kind: 'phone',
    label,
    list: async (dir) => {
      const prefix = cleanPath(dir) === '' ? '' : `${cleanPath(dir)}/`;
      const entries: FolderEntry[] = [];
      const dirs = new Set<string>();
      for (const f of (await refresh()).values()) {
        if (!f.chemin.startsWith(prefix)) continue;
        const rest = f.chemin.slice(prefix.length);
        const cut = rest.indexOf('/');
        if (cut < 0) entries.push({ name: rest, kind: 'file', size: f.taille, mtimeMs: f.dateMs });
        else dirs.add(rest.slice(0, cut));
      }
      for (const name of dirs) entries.push({ name, kind: 'directory', size: 0, mtimeMs: 0 });
      return entries;
    },
    readBytes,
    readText: async (path) => {
      const bytes = await readBytes(path);
      return bytes === null ? null : new TextDecoder().decode(bytes);
    },
    stat: async (path) => {
      const f = (await current()).get(cleanPath(path));
      return f ? { size: f.taille, mtimeMs: f.dateMs } : null;
    },
    writeBytes,
    writeText: (path, text) => writeBytes(path, new TextEncoder().encode(text)),
    remove: async (path) => {
      const chemin = cleanPath(path);
      const { effacer } = writer();
      const files = await current();
      if (!files.has(chemin)) return;
      await bridgeValue(effacer({ chemin }));
      files.delete(chemin);
    },
  };
};

/** Erreur d'une lecture après que le téléphone a été débranché. */
const unpluggedError = (): Error => Object.assign(new Error(t('téléphone débranché')), { code: 'UNKNOWN' });

/** Fichiers à importer depuis le téléphone, et ce qui s'est passé pendant leur lecture. */
export interface PhoneImport {
  entries: ImportEntry[];
  /** Vrai dès qu'une lecture a échoué et que le téléphone n'était plus prêt : les lectures suivantes échouent aussitôt. */
  unplugged(): boolean;
}

const extensionOf = (path: string): string => /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? '';

/** Clé qui rapproche un GPX de sa fiche et de ses capteurs : chemin sans extension, en minuscules. */
const keyOf = (path: string): string => path.replace(/\.(gpx|fit|json|imu)$/i, '').toLowerCase();

/**
 * Les fichiers `paths` du téléphone (rendus par le dernier `listPhoneFiles`), en `ImportEntry` lus à la demande.
 * `onRead` est appelé après chaque fichier lu, une fois par chemin.
 *
 * Une session entre entière ou pas du tout : lire un GPX lit aussi sa fiche (`.json`) et ses capteurs (`.imu`), gardés
 * jusqu'à ce que l'import les demande ; si l'un d'eux échoue, la lecture du GPX échoue et rien n'est rangé.
 *
 * Débranchement : à la première lecture en échec, l'état du téléphone est redemandé ; s'il n'est plus prêt, cette
 * lecture et toutes les suivantes échouent aussitôt (`unplugged`), sans plus rien demander au téléphone.
 */
export const phoneImportEntries = (paths: readonly string[], onRead: (path: string) => void = () => undefined): PhoneImport => {
  const phone = requirePhone();
  let unplugged = false;
  const seen = new Set<string>();
  /** Fiches et capteurs lus avec leur GPX, rendus une fois puis relâchés. */
  const held = new Map<string, Uint8Array>();
  const companions = new Map<string, string[]>();
  for (const path of paths) {
    const ext = extensionOf(path);
    if (ext !== 'json' && ext !== 'imu') continue;
    const key = keyOf(path);
    companions.set(key, [...(companions.get(key) ?? []), path]);
  }

  const fetchBytes = async (path: string): Promise<Uint8Array> => {
    if (unplugged) throw unpluggedError();
    let bytes: Uint8Array;
    try {
      bytes = await bridgeValue(phone.lireOctets({ chemin: path }));
    } catch (err) {
      const state = await bridgeValue(phone.etat()).catch(() => null);
      if (state?.etat !== 'pret') {
        unplugged = true;
        throw unpluggedError();
      }
      throw err;
    }
    if (!seen.has(path)) {
      seen.add(path);
      onRead(path);
    }
    return bytes;
  };

  const readBytes = async (path: string): Promise<Uint8Array> => {
    const kept = held.get(path);
    if (kept) {
      held.delete(path);
      return kept;
    }
    if (extensionOf(path) !== 'gpx') return fetchBytes(path);
    const bytes = await fetchBytes(path);
    const others = companions.get(keyOf(path)) ?? [];
    try {
      for (const other of others) held.set(other, await fetchBytes(other));
    } catch (err) {
      for (const other of others) held.delete(other);
      throw err;
    }
    return bytes;
  };

  const entries = paths.map((path): ImportEntry => ({
    name: path.split('/').pop() ?? path,
    key: keyOf(path),
    readBytes: () => readBytes(path),
    readText: async () => new TextDecoder().decode(await readBytes(path)),
  }));
  return { entries, unplugged: () => unplugged };
};
