import { afterAll, vi } from 'vitest';

/**
 * Mise en place des tests : le fuseau est fixé avant toute date, pour que les
 * tests construits à l'heure locale (`stats`, `activityChart`) prouvent quelque
 * chose sur une machine réglée en UTC comme ailleurs.
 */
// Les types de node ne sont pas chargés dans le projet de l'application : `process` s'atteint par globalThis.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'Europe/Paris';

// Aucun test ne touche au réseau : un appel non remplacé par le test (la file des lieux d'une bibliothèque d'essai,
// par exemple) échoue comme sans réseau. `vi.stubGlobal` le remplace le temps d'un test, puis le rend.
globalThis.fetch = (async (input: RequestInfo | URL) => {
  throw new TypeError(`réseau coupé dans les tests : ${input instanceof Request ? input.url : String(input)}`);
}) as typeof fetch;

// Les tests ne sont plus isolés par fichier : chacun rend au suivant des horloges, globales et espions propres.
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Registre de modules vidé avant chaque fichier : l'état des modules de l'application (stockage, service GPS) ne passe
// pas d'un fichier au suivant, mais les bibliothèques externes restent chargées.
vi.resetModules();
