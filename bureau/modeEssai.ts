// Mode d'essai de la coquille, et avec lui toutes les variables `GTRACKER_*` (mode d'essai, profil, dossier servi,
// faux téléphone…) : permis hors emballage (Electron lancé sur `bureau/dist`) et dans le programme d'essai du banc,
// dont le package.json porte le marqueur `gtrackerEssai` (posé par `node outils/bureau.mjs --exe`, jamais par
// l'installeur). Ce package.json est dans l'archive de la coquille, la seule que le programme accepte de charger
// (fusible `OnlyLoadAppFromAsar`) : le marqueur ne s'ajoute pas au programme installé sans le reconstruire.

/** Ce que la coquille lit de son package.json, écrit par l'emballage. */
export type PaquetDeLaCoquille = { gtrackerVersion?: string; gtrackerEssai?: unknown }

/** Variables propres à la coquille, quelle que soit la casse de leur nom (Windows l'ignore). */
const VARIABLE_DE_LA_COQUILLE = /^GTRACKER_/i

/** Vrai si le mode d'essai est permis : hors emballage, ou programme emballé qui porte le marqueur d'essai. */
export function essaiPermis({ emballe, paquet }: { emballe: boolean; paquet: PaquetDeLaCoquille | null }): boolean {
  return !emballe || paquet?.gtrackerEssai === true
}

/**
 * Variables d'environnement que la coquille lit : `env` tel quel si le mode d'essai est permis, sinon une copie sans
 * aucune variable `GTRACKER_*`.
 */
export function environnementDeLaCoquille(env: NodeJS.ProcessEnv, permis: boolean): NodeJS.ProcessEnv {
  if (permis) return env
  return Object.fromEntries(Object.entries(env).filter(([nom]) => !VARIABLE_DE_LA_COQUILLE.test(nom)))
}
