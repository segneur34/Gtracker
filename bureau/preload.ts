// Pont entre la page et la coquille. Il tourne dans le bac à sable (`sandbox: true`) : un seul fichier, sans
// `require` de fichiers voisins (les noms des canaux sont donc écrits ici, gardés égaux à ceux de `memoire.ts` par
// un test), et rien d'Electron n'est donné à la page tel quel : une fonction par canal, qui ne passe qu'un argument.
//
// Chaque fonction rend une promesse de `{ ok: true, valeur }` ou `{ ok: false, code, message }` ; elle ne rejette
// jamais pour une erreur du disque. Les chemins sont relatifs à une racine, `memoire` (le dossier retenu) ou
// `candidat` (le dossier proposé ou choisi, en lecture seule) : la page ne donne jamais de chemin absolu.

import { contextBridge, ipcRenderer } from 'electron'

/** Version de l'application, passée par la coquille en argument de la page (`--gtracker-version=…`). */
function versionPassee(): string {
  const prefixe = '--gtracker-version='
  const argument = process.argv.find((a) => a.startsWith(prefixe))
  return argument ? argument.slice(prefixe.length) : ''
}

/** Message sans argument. */
const sans = (canal: string) => () => ipcRenderer.invoke(canal)

/** Message à un seul argument, passé tel quel (les tableaux d'octets sont copiés par Electron, sans base64). */
const avec = (canal: string) => (argument: unknown) => ipcRenderer.invoke(canal, argument)

const memoire = Object.freeze({
  ouvrir: sans('memoire:ouvrir'),
  proposer: sans('memoire:proposer'),
  choisir: avec('memoire:choisir'),
  adopter: avec('memoire:adopter'),
  oublier: sans('memoire:oublier'),
  lister: avec('memoire:lister'),
  lireTexte: avec('memoire:lireTexte'),
  lireOctets: avec('memoire:lireOctets'),
  stat: avec('memoire:stat'),
  ecrireTexte: avec('memoire:ecrireTexte'),
  ecrireOctets: avec('memoire:ecrireOctets'),
  effacer: avec('memoire:effacer'),
  effacerDossier: avec('memoire:effacerDossier'),
})

/**
 * Le dossier `Documents/Gtracker` du téléphone branché, en lecture seule (noms gardés égaux à ceux de `telephone.ts`
 * par un test) : `etat()`, `lister()`, et `lireOctets({ chemin })` d'un fichier du dernier listage seulement.
 */
const telephone = Object.freeze({
  etat: sans('telephone:etat'),
  lister: sans('telephone:lister'),
  lireOctets: avec('telephone:lireOctets'),
})

/**
 * Le sans-fil du PC (noms gardés égaux à ceux de `sansFil.ts` par un test) : `etat()`, `activer({ actif })`,
 * `ouvrirAppairage()`, `telephones()`, `retirer({ id })`, et `surArrivee(rappel)`, appelé avec `{ id, nom, nouveau }`
 * quand un téléphone se présente, qui rend la fonction de désabonnement.
 */
const sansFil = Object.freeze({
  etat: sans('sansfil:etat'),
  activer: avec('sansfil:activer'),
  ouvrirAppairage: sans('sansfil:ouvrirAppairage'),
  telephones: sans('sansfil:telephones'),
  retirer: avec('sansfil:retirer'),
  surArrivee: (rappel: (avis: unknown) => void) => {
    // L'événement d'Electron ne passe pas à la page : seulement l'avis.
    const ecouteur = (_evenement: unknown, avis: unknown) => rappel(avis)
    ipcRenderer.on('sansfil:arrive', ecouteur)
    return () => {
      ipcRenderer.removeListener('sansfil:arrive', ecouteur)
    }
  },
})

contextBridge.exposeInMainWorld(
  'gtrackerBureau',
  Object.freeze({
    version: versionPassee(),
    memoire,
    telephone,
    sansFil,
    /** Textes traduits de la question de fermeture : `{ question, detail, quitter, rester }`. */
    textes: avec('coquille:textes'),
  }),
)
