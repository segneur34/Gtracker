// Garde des verrous de paquets : chaque paquet figé dans `package-lock.json` (racine) et `bureau/package-lock.json`
// porte son empreinte de contrôle (`integrity`). Sans elle, `npm ci` installerait sans alerte un paquet modifié en
// route ; et celui d'Electron porte lui-même les sommes de contrôle du binaire téléchargé. Une entrée sans empreinte se
// corrige en régénérant le verrou en ligne (supprimer `node_modules` et le verrou, puis `npm install`).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VERROUS = ['package-lock.json', join('bureau', 'package-lock.json')]

/** Entrées d'un verrou sans empreinte : hors la racine (`""`) et hors les liens vers un dossier local (`link`). */
function entreesSansEmpreinte(verrou) {
  return Object.entries(verrou.packages ?? {})
    .filter(([nom, entree]) => nom !== '' && entree.link !== true && !entree.integrity)
    .map(([nom]) => nom)
}

describe('verrous de paquets', () => {
  it.each(VERROUS)('chaque paquet de %s porte son empreinte de contrôle', (fichier) => {
    const verrou = JSON.parse(readFileSync(join(RACINE, fichier), 'utf8'))
    expect(Object.keys(verrou.packages ?? {}).length).toBeGreaterThan(1)
    expect(entreesSansEmpreinte(verrou)).toEqual([])
  })

  it('cite l’entrée sans empreinte d’un faux verrou, sans compter la racine ni un lien', () => {
    const faux = {
      lockfileVersion: 3,
      packages: {
        '': { name: 'essai' },
        'node_modules/electron': { version: '45.4.1', dev: true },
        'node_modules/sain': { version: '1.0.0', integrity: 'sha512-abc' },
        'node_modules/local': { resolved: '../local', link: true },
      },
    }
    expect(entreesSansEmpreinte(faux)).toEqual(['node_modules/electron'])
  })
})
