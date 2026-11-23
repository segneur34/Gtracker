// Garde des rechargements de la page après une chute de son processus (mémoire épuisée, pilote graphique, plantage de
// Chromium) : la coquille recharge la page d'elle-même, mais pas sans fin. Comme l'application du téléphone
// (`MainActivity.reloadAfterRendererGone`) : au plus 3 rechargements sur 10 minutes glissantes ; au-delà, la chute
// revient trop vite pour qu'un rechargement de plus y change quelque chose, et l'utilisateur est consulté.
// Sans Electron, pour être testé.

/** Rechargements d'elle-même permis dans la fenêtre glissante. */
export const RECHARGES_MAX = 3

/** Fenêtre glissante des rechargements, en millisecondes : 10 minutes. */
export const FENETRE_RECHARGES_MS = 10 * 60 * 1000

export type GardeRechargements = {
  /** Vrai, et le rechargement est compté, s'il en reste un de permis à cet instant ; faux sinon, sans rien compter. */
  autoriser(maintenantMs: number): boolean
}

export function gardeRechargements(max = RECHARGES_MAX, fenetreMs = FENETRE_RECHARGES_MS): GardeRechargements {
  const instants: number[] = []
  return {
    autoriser(maintenantMs) {
      while (instants.length > 0 && maintenantMs - instants[0] >= fenetreMs) instants.shift()
      if (instants.length >= max) return false
      instants.push(maintenantMs)
      return true
    },
  }
}
