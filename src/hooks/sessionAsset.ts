import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { plainError } from '../platform/errorText';
import type { RecordPatch } from '../library/record';
import { librarySession, updateSessionRecord, useLibrarySession } from './useSessionLibrary';

/**
 * « Recherche par trace, rangée dans la fiche » : revêtement (OpenStreetMap),
 * altitude du terrain (IGN), sauts (capteurs). Le résultat est cherché la
 * première fois qu'on en a besoin, une seule fois par clé (la trace), gardé
 * le temps du lancement, et rangé dans la fiche (hors brouillon : ce n'est pas
 * une saisie) une seule fois par recherche, même si la trace est recalculée
 * pendant la demande ou si l'on quitte la page.
 */

/** Résultats d'une sorte de recherche pendant ce lancement, par clé, et recherches en cours. */
export interface SessionAssetCache<V> {
  /** Résultat trouvé pendant ce lancement pour cette clé. */
  get: (key: string) => V | undefined;
  /**
   * Lance la recherche de cette clé, sauf si elle est déjà en cours : la promesse
   * en cours est rendue, et `onFound` n'est appelé qu'une fois, par la première demande.
   */
  run: (key: string, compute: () => Promise<V>, onFound?: (value: V) => void) => Promise<V>;
  /** Abonnement aux résultats trouvés (`useSyncExternalStore`). */
  subscribe: (listener: () => void) => () => void;
  /** Nombre de résultats trouvés : change à chaque nouveau résultat. */
  version: () => number;
}

export const createSessionAssetCache = <V>(): SessionAssetCache<V> => {
  const found = new Map<string, V>();
  const searching = new Map<string, Promise<V>>();
  const listeners = new Set<() => void>();
  let count = 0;
  return {
    get: (key) => found.get(key),
    run: (key, compute, onFound) => {
      let pending = searching.get(key);
      if (!pending) {
        pending = compute()
          .then((value) => {
            found.set(key, value);
            onFound?.(value);
            count++;
            for (const listener of listeners) listener();
            return value;
          })
          .finally(() => searching.delete(key));
        searching.set(key, pending);
      }
      return pending;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    version: () => count,
  };
};

/** Champ de la fiche où une recherche range son résultat. */
export type SessionAssetField = 'surfaces' | 'terrainElevation' | 'jumps';

/** Range le résultat dans la fiche, si la session est dans la mémoire et que sa fiche peut être réécrite. */
const store = (file: string | null, field: SessionAssetField, value: unknown): void => {
  const session = file !== null ? librarySession(file) : undefined;
  if (session && !session.readOnly) updateSessionRecord(session.file, { [field]: value } as RecordPatch);
};

/**
 * Résultat d'une recherche par trace : celui de la fiche s'il est à jour
 * (`isCurrent`), sinon celui trouvé pendant ce lancement, sinon cherché
 * (`compute`) quand `active` et la fiche relue en entier. Le champ de la fiche
 * est lu par `read` (le revêtement et l'altitude y sont bruts depuis le lot 301 :
 * leur domaine les lit ; une valeur mal formée vaut absente). Un résultat trouvé
 * avant que la bibliothèque connaisse la session y est rangé dès qu'elle la
 * connaît. `error` : message de la dernière recherche échouée pour cette clé,
 * `retry` l'efface et relance.
 */
export const useSessionAsset = <V>({
  cache, file, key, isCurrent, active, compute, field, read, errorText,
}: {
  cache: SessionAssetCache<V>;
  file: string | null;
  /** Clé de la trace ; `null` : rien à chercher. */
  key: string | null;
  isCurrent: (value: V | undefined) => boolean;
  active: boolean;
  compute: () => Promise<V>;
  field: SessionAssetField;
  /** Lecture du champ de la fiche, `null` s'il est mal formé ; une fonction stable (relue quand le champ change). */
  read: (raw: unknown) => V | null;
  /** Message d'une erreur sans texte. */
  errorText: string;
}) => {
  const session = useLibrarySession(file);
  // Fiche allégée, pas encore relue en entier : son résultat rangé n'est pas encore connu.
  const partial = session?.partial === true;
  const raw: unknown = session?.record[field];
  const stored = useMemo(() => (raw === undefined ? undefined : read(raw) ?? undefined), [raw, read]);
  useSyncExternalStore(cache.subscribe, cache.version);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const local: V | undefined = key !== null ? cache.get(key) : undefined;
  const value: V | undefined = isCurrent(stored) ? stored : local;
  const failed = error !== null && error.key === key ? error.message : null;
  const storedCurrent = isCurrent(stored);

  // Trouvé avant que la bibliothèque connaisse la session : rangé dès qu'elle la connaît.
  useEffect(() => {
    if (local !== undefined && !storedCurrent && session && !session.readOnly && !partial) store(session.file, field, local);
  }, [local, storedCurrent, session, partial, field]);

  useEffect(() => {
    if (!active || value !== undefined || failed !== null || key === null || partial) return;
    cache.run(key, compute, (result) => store(file, field, result)).catch(
      (err: unknown) => setError({ key, message: plainError(err, errorText) })
    );
    // `compute` est neuf à chaque rendu : la clé dit seule quelle recherche lancer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, value, failed, key, file, partial, cache, field, errorText]);

  const retry = () => setError(null);
  return { value, error: failed, retry, session };
};
