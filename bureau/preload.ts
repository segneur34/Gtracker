// Pont entre la page et la coquille. Il tourne dans le bac à sable (`sandbox: true`) : un seul fichier, sans
// `require` de fichiers voisins, et rien d'Electron n'est donné à la page tel quel. La page ne reçoit que des
// valeurs et, plus tard, une fonction par message.

import { contextBridge } from 'electron'

/** Version de l'application, passée par la coquille en argument de la page (`--gtracker-version=…`). */
function versionPassee(): string {
  const prefixe = '--gtracker-version='
  const argument = process.argv.find((a) => a.startsWith(prefixe))
  return argument ? argument.slice(prefixe.length) : ''
}

contextBridge.exposeInMainWorld('gtrackerBureau', Object.freeze({ version: versionPassee() }))
