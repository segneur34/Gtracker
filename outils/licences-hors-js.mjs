// Complément de la liste des licences (`public/licences-hors-js.json`) : ce que Vite ne voit pas, faute de JS.
//
//   gradlew :app:dependencies --configuration releaseRuntimeClasspath --console=plain > natif.txt
//   node outils/licences-hors-js.mjs natif.txt
//
// À relancer quand une dépendance native ou un greffon change : `src/core/licenses.test.ts` compare ce fichier au
// `package-lock.json` et à `android/variables.gradle`. Polices et `@capacitor/android` : texte lu dans `node_modules`,
// Electron dans `bureau/node_modules`. Chaque ligne dit sur quel appareil elle vaut (`shells`) : l'écran des licences
// filtre selon l'appareil, une ligne sans `shells` vaut partout.
// Natif : une ligne par famille, licence prise dans la table ci-dessous, car le cache de Gradle n'a presque pas de POM ;
// un groupe que la table ne connaît pas arrête le script. Sans dépendance.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SDK_ANDROID = 'https://developer.android.com/studio/terms'

// `io.ionic.libs:ionfilesystem-android` : son AAR n'a pas de fichier de licence et son POM ne donne qu'un lien, lu le
// 05/11 : https://github.com/ionic-team/ion-android-filesystem/blob/1.1.1/LICENSE
const MIT_IONIC = `MIT License

Copyright (c) 2025 Ionic

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/**
 * Logo GONG (src/assets/logo/) : une marque, pas une licence libre. Aucun accord n'est affirmé et aucune société
 * n'est nommée : le titulaire exact de la marque n'est pas établi.
 */
const LOGO_GONG = {
  name: 'Logo GONG',
  version: '',
  identifier: 'Marque de son titulaire',
  text: "Le logo GONG (symbole et mot) est une marque de son titulaire, montrée dans Gtracker pour une présentation à GONG. Ce n'est pas une licence libre : il ne se réutilise pas ailleurs sans l'accord du titulaire de la marque.",
}

/** Les trois appareils où tourne l'application (`AppShell`, src/platform/runtime.ts) : une ligne sans `shells` vaut pour tous. */
const TELEPHONE = ['telephone']
const ORDINATEUR = ['ordinateur']

// Jeu d'icônes Feather : cinq tracés de `src/components/icons.tsx` (actualiser, crayon, note, fichier, œil) en sont
// repris presque à l'identique. Son fichier de licence n'est pas sur le poste : aucun texte n'est recopié de mémoire,
// la ligne ne porte que le nom de la licence, l'auteur et l'adresse du fichier officiel.
const FEATHER = {
  name: 'Feather (icônes)',
  version: '',
  identifier: 'MIT',
  text: "Licence MIT, droits d'auteur de Cole Bemis. Texte officiel : https://github.com/feathericons/feather/blob/main/LICENSE",
  notice: "Cinq icônes de l'interface (actualiser, crayon, note, fichier, œil) reprennent des tracés de ce jeu d'icônes.",
  url: 'https://github.com/feathericons/feather',
}

// Notice d'Apache Cordova : l'archive Maven reçue ne la contient pas et elle n'est pas sur le poste ; la ligne renvoie
// à l'adresse officielle plutôt qu'à un texte écrit de mémoire.
const URL_NOTICE_CORDOVA = 'https://raw.githubusercontent.com/apache/cordova-android/master/NOTICE'

/**
 * Ligne de NSIS, texte du fichier COPYING livré avec l'outil et version lue dans le nom de son dossier, dans le cache
 * d'electron-builder (`%LOCALAPPDATA%\electron-builder\Cache\nsis-<version>`, rempli par la première construction de
 * l'installeur) ; une erreur s'il est absent, jamais de texte de remplacement.
 */
const ligneNsis = () => {
  const cache = join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache')
  const dossiers = existsSync(cache) ? readdirSync(cache).filter((nom) => /^nsis-\d/.test(nom)).sort() : []
  for (const nom of dossiers.reverse()) {
    const copying = readdirSync(join(cache, nom), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(cache, nom, d.name, 'COPYING'))
      .find((chemin) => existsSync(chemin))
    if (copying) {
      return {
        name: 'NSIS',
        version: nom.slice('nsis-'.length),
        identifier: 'zlib/libpng, bzip2 et CPL 1.0 (module LZMA)',
        text: readFileSync(copying, 'utf8').trim(),
        notice: "Système d'installation du programme Windows, fabriqué par electron-builder.",
        url: 'https://nsis.sourceforge.io/License',
        shells: ORDINATEUR,
      }
    }
  }
  throw new Error(`COPYING de NSIS introuvable dans ${cache} : construire l'installeur une fois (npm run installeur)`)
}

const versionElectronDemandee = () => JSON.parse(readFileSync(join(RACINE, 'bureau', 'package.json'), 'utf8')).devDependencies.electron

/**
 * Ce que le programme Windows livre en propre (coquille Electron et installeur) : l'Android n'en porte rien. Le
 * dossier du programme contient `LICENSES.chromium.html` (licences de Chromium et de ses composants, FFmpeg compris)
 * et, dans `resources\`, `MENTIONS-FFMPEG.txt` (outils/MENTIONS-FFMPEG.txt). Electron : texte lu dans `bureau/node_modules`.
 */
const lignesOrdinateur = () => [
  // Version : celle que `bureau/package.json` demande, qui fait foi pour l'emballage.
  lignePaquet('electron', { name: 'Electron', version: versionElectronDemandee(), shells: ORDINATEUR, url: 'https://www.electronjs.org/' }, 'bureau'),
  {
    name: 'Chromium',
    version: '',
    identifier: 'BSD-3-Clause et licences de ses composants',
    text: "Le programme Windows embarque Chromium, par Electron. Les licences de Chromium et de chacun de ses composants sont livrées en entier dans le fichier LICENSES.chromium.html, dans le dossier du programme, à côté de Gtracker.exe.",
    url: 'https://www.chromium.org/',
    shells: ORDINATEUR,
  },
  {
    name: 'FFmpeg',
    version: '',
    identifier: 'LGPL-2.1',
    text: "Ce programme utilise des bibliothèques du projet FFmpeg sous LGPL 2.1. La bibliothèque est celle de Chromium, embarquée par Electron (fichier ffmpeg.dll). Son code source se trouve dans le dépôt de FFmpeg de Chromium (https://chromium.googlesource.com/chromium/third_party/ffmpeg), à la révision que le fichier DEPS de la version de Chromium embarquée indique, et sur le site du projet (https://ffmpeg.org/download.html). Le texte de la licence est dans le fichier LICENSES.chromium.html du dossier du programme, et sur https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html.",
    url: 'https://ffmpeg.org/download.html',
    shells: ORDINATEUR,
  },
  ligneNsis(),
]

/** Table groupe → famille. Sans `texte` : la licence Apache 2.0 (voir `principal`). `notice` : mention jointe à la ligne. */
const FAMILLES = [
  { nom: 'AndroidX', groupe: (g) => g.startsWith('androidx.'), identifiant: 'Apache-2.0' },
  { nom: 'Kotlin et JetBrains', groupe: (g) => g === 'org.jetbrains' || g.startsWith('org.jetbrains.'), identifiant: 'Apache-2.0' },
  { nom: 'JSpecify', groupe: (g) => g === 'org.jspecify', identifiant: 'Apache-2.0' },
  { nom: 'Apache Cordova', groupe: (g) => g === 'org.apache.cordova', identifiant: 'Apache-2.0', notice: 'Notice du projet : voir l\'adresse ci-dessous, elle n\'est pas livrée avec l\'archive reçue.', url: URL_NOTICE_CORDOVA },
  { nom: 'ListenableFuture (Guava)', groupe: (g) => g === 'com.google.guava', identifiant: 'Apache-2.0' },
  {
    nom: 'Services Google Play',
    groupe: (g) => g === 'com.google.android.gms',
    identifiant: 'Licence du SDK Android',
    texte: 'Distribués par Google selon les conditions du SDK Android.',
    url: SDK_ANDROID,
  },
  { nom: 'Ionic Filesystem', groupe: (g) => g === 'io.ionic.libs', identifiant: 'MIT', texte: MIT_IONIC },
]

/** Famille d'un groupe Maven ; lève une erreur s'il n'est pas dans la table : sa licence reste à vérifier. */
export const familleDuGroupe = (groupe) => {
  const famille = FAMILLES.find((f) => f.groupe(groupe))
  if (!famille) throw new Error(`Groupe natif inconnu, licence à vérifier puis à ajouter à la table : ${groupe}`)
  return famille
}

/**
 * Composants résolus d'une sortie de `gradlew :app:dependencies`, `groupe:nom:version`, triés et sans double : la version
 * retenue est celle après la flèche (`1.8.0 -> 1.11.0`, `{strictly 1.0} -> 1.0`, ou `groupe:nom -> 1.0`), les modules du
 * projet (`project :capacitor-android`) n'y sont pas.
 */
export const composantsNatifs = (sortie) => {
  const trouves = new Set()
  for (const ligne of sortie.split(/\r?\n/)) {
    const arbre = ligne.match(/^[|\s]*[+\\]--- (.+)$/)
    if (!arbre || arbre[1].startsWith('project ')) continue
    const texte = arbre[1].replace(/ \([*cn]\)$/, '')
    const [declare, retenu] = texte.split(' -> ')
    const [groupe, nom, version] = declare.split(':')
    if (!nom) continue
    if (retenu?.includes(':')) trouves.add(retenu)
    else trouves.add(`${groupe}:${nom}:${retenu ?? version}`)
  }
  return [...trouves].sort()
}

/** Une ligne par famille native. `apache` : texte de la licence Apache 2.0. */
export const lignesNatives = (composants, apache) => {
  const parFamille = new Map()
  for (const composant of composants) {
    const famille = familleDuGroupe(composant.split(':')[0])
    parFamille.set(famille, [...(parFamille.get(famille) ?? []), composant])
  }
  return [...parFamille].map(([famille, liste]) => ({
    name: famille.nom,
    version: liste.length === 1 ? liste[0].split(':')[2] : `${liste.length} composants`,
    identifier: famille.identifiant,
    text: famille.texte ?? apache,
    ...(famille.notice ? { notice: famille.notice } : {}),
    ...(famille.url ? { url: famille.url } : {}),
    components: liste,
    shells: TELEPHONE,
  }))
}

/**
 * Premier `node_modules` qui porte le paquet, en remontant : une copie de travail d'un lot prend celui du dépôt.
 * `sous` : dossier du dépôt qui a son propre `node_modules` (`bureau`).
 */
const dossierPaquet = (nom, sous = '') => {
  for (let dossier = RACINE; ; dossier = dirname(dossier)) {
    const paquet = join(dossier, sous, 'node_modules', nom)
    if (existsSync(join(paquet, 'package.json'))) return paquet
    if (dirname(dossier) === dossier) throw new Error(`Paquet introuvable : ${nom}`)
  }
}

/** Ligne d'un paquet npm, version, licence et texte lus dans `node_modules`. */
const lignePaquet = (nom, extra = {}, sous = '') => {
  const dossier = dossierPaquet(nom, sous)
  const { version, license } = JSON.parse(readFileSync(join(dossier, 'package.json'), 'utf8'))
  return { name: nom, version, identifier: license, text: readFileSync(join(dossier, 'LICENSE'), 'utf8').trim(), ...extra }
}

const principal = () => {
  const [fichier] = process.argv.slice(2)
  if (!fichier) {
    console.error('Usage : node outils/licences-hors-js.mjs <sortie de gradlew :app:dependencies>')
    process.exit(1)
  }
  // Le texte Apache 2.0 n'est livré par aucun composant natif : celui de TypeScript, identique, sert de référence.
  const apache = readFileSync(join(dossierPaquet('typescript'), 'LICENSE'), 'utf8').trim()
  const composants = composantsNatifs(readFileSync(fichier, 'utf8'))
  if (composants.length === 0) throw new Error(`Aucun composant dans ${fichier} : est-ce bien la sortie de gradlew ?`)
  const lignes = [
    lignePaquet('@fontsource/inter'),
    lignePaquet('@capacitor/android', { shells: TELEPHONE }),
    LOGO_GONG,
    FEATHER,
    ...lignesNatives(composants, apache),
    ...lignesOrdinateur(),
  ]
  writeFileSync(join(RACINE, 'public', 'licences-hors-js.json'), `${JSON.stringify(lignes, null, 2)}\n`)
  console.log(`${lignes.length} lignes, ${composants.length} composants natifs : public/licences-hors-js.json`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) principal()
