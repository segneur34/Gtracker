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
 * Le dossier `Documents/Gtracker` du téléphone branché (noms gardés égaux à ceux de `telephone.ts` par un test) :
 * `etat()`, `lister()`, `lireOctets({ chemin })` d'un fichier du dernier listage seulement, et, après un listage,
 * `ecrireOctets({ chemin, octets })` et `effacer({ chemin })` dans la liste blanche que la coquille vérifie, et
 * `copieSecurite()`, qui copie les deux dossiers avant une première synchronisation et rend le chemin de la copie ;
 * le dossier des copies (noms gardés égaux à ceux de `copieSecurite.ts`) : `dossierCopies()`, `choisirDossierCopies({
 * titre })`, qui ouvre la fenêtre de choix de Windows et rend `{ issue, dossier }`, `ouvrirCopie({ chemin })`, borné aux
 * dossiers des copies, et `surAvancementCopie(rappel)`, appelé avec `{ fait, total }` pendant une copie de sécurité, qui
 * rend la fonction de désabonnement.
 */
const telephone = Object.freeze({
  etat: sans('telephone:etat'),
  lister: sans('telephone:lister'),
  lireOctets: avec('telephone:lireOctets'),
  ecrireOctets: avec('telephone:ecrireOctets'),
  effacer: avec('telephone:effacer'),
  copieSecurite: sans('telephone:copieSecurite'),
  dossierCopies: sans('telephone:dossierCopies'),
  choisirDossierCopies: avec('telephone:choisirDossierCopies'),
  ouvrirCopie: avec('telephone:ouvrirCopie'),
  surAvancementCopie: (rappel: (avis: unknown) => void) => {
    const ecouteur = (_evenement: unknown, avis: unknown) => rappel(avis)
    ipcRenderer.on('telephone:avancementCopie', ecouteur)
    return () => {
      ipcRenderer.removeListener('telephone:avancementCopie', ecouteur)
    }
  },
})

/**
 * Le sans-fil du PC (noms gardés égaux à ceux de `sansFil.ts` par un test) : `etat()`, `activer({ actif })`,
 * `ouvrirAppairage()`, `telephones()`, `retirer({ id })`, `autoriser()`, qui demande à Windows d'autoriser Gtracker
 * sur le réseau et rend `{ issue, detail?, etat }`, `surArrivee(rappel)`, appelé avec `{ id, nom, nouveau }` quand
 * un téléphone se présente, et `surDepart(rappel)`, appelé avec `{ id, nom, raison, heure }` quand un téléphone relié
 * s'en va ; chacun rend la fonction de désabonnement.
 */
const sansFil = Object.freeze({
  etat: sans('sansfil:etat'),
  activer: avec('sansfil:activer'),
  ouvrirAppairage: sans('sansfil:ouvrirAppairage'),
  telephones: sans('sansfil:telephones'),
  retirer: avec('sansfil:retirer'),
  autoriser: sans('sansfil:autoriser'),
  surArrivee: (rappel: (avis: unknown) => void) => {
    // L'événement d'Electron ne passe pas à la page : seulement l'avis.
    const ecouteur = (_evenement: unknown, avis: unknown) => rappel(avis)
    ipcRenderer.on('sansfil:arrive', ecouteur)
    return () => {
      ipcRenderer.removeListener('sansfil:arrive', ecouteur)
    }
  },
  surDepart: (rappel: (avis: unknown) => void) => {
    const ecouteur = (_evenement: unknown, avis: unknown) => rappel(avis)
    ipcRenderer.on('sansfil:parti', ecouteur)
    return () => {
      ipcRenderer.removeListener('sansfil:parti', ecouteur)
    }
  },
})

/**
 * L'application du téléphone embarquée (noms gardés égaux à ceux de `applicationTelephone.ts` par un test) : `etat()`
 * (`{ version, disponible, proposee }`), `enregistrer({ titre })`, qui ouvre la fenêtre « Enregistrer sous » et rend le
 * chemin écrit ou `null`, `installer()` par le câble, et `marquerProposee()` pour cette version.
 */
const application = Object.freeze({
  etat: sans('application:etat'),
  enregistrer: avec('application:enregistrer'),
  installer: sans('application:installer'),
  marquerProposee: sans('application:marquerProposee'),
})

/**
 * Avant de fermer la fenêtre ou de recharger la page, la coquille demande à la page de vider ses écritures en attente
 * (`coquille:fermeture`) : chaque rappel inscrit par `surFermeture` est attendu, la promesse qu'il rend comprise, puis
 * la réponse part (`coquille:fermeturePrete`), même si un rappel a échoué. Sans rappel inscrit (page d'une version
 * plus ancienne), elle part aussitôt. La coquille n'attend la réponse que quelques secondes.
 */
const rappelsFermeture = new Set<() => unknown>()
ipcRenderer.on('coquille:fermeture', () => {
  void Promise.allSettled([...rappelsFermeture].map(async (rappel) => rappel())).then(() => ipcRenderer.send('coquille:fermeturePrete'))
})

contextBridge.exposeInMainWorld(
  'gtrackerBureau',
  Object.freeze({
    version: versionPassee(),
    memoire,
    telephone,
    sansFil,
    application,
    /** Textes traduits de la question de fermeture : `{ question, detail, quitter, rester }`. */
    textes: avec('coquille:textes'),
    /** Écrit une étape de la page dans le journal daté du programme : `{ texte }`, borné à 300 caractères. */
    noter: avec('coquille:noter'),
    /** Inscrit un rappel attendu avant la fermeture ou le rechargement de la page ; rend la fonction de désabonnement. */
    surFermeture: (rappel: () => unknown) => {
      rappelsFermeture.add(rappel)
      return () => {
        rappelsFermeture.delete(rappel)
      }
    },
  }),
)
