/**
 * Types nés dans un domaine (autorisations, capteurs de saut) que le noyau ou la plateforme doivent connaître : ils
 * sont posés ici pour que `core/` et `platform/` n'importent aucun domaine
 * (test `src/architecture.test.ts`). Chaque domaine les réexporte sous le
 * même nom.
 */

// --- Autorisations du téléphone (`recording/permissionsPrompt.ts`) ---

/** Autorisations suivies, dans l'ordre de la carte. */
export type PermissionKey = 'location' | 'notifications' | 'battery' | 'bluetooth';

/**
 * `granted` : accordée ; `prompt` : jamais demandée, la demande système
 * s'affichera ; `denied` : refusée, il faut passer par les réglages de
 * l'application ; `unavailable` : sans objet ici (navigateur).
 */
export type PermissionState = 'granted' | 'prompt' | 'denied' | 'unavailable';

export type PermissionsStatus = Record<PermissionKey, PermissionState>;

// --- Capteurs de saut (`recording/jumpSettings.ts`) ---

/** Où le téléphone est fixé : règle les seuils de détection et dit la précision à attendre. */
export type JumpPlacement = 'poitrine' | 'taille' | 'bras' | 'dos';
