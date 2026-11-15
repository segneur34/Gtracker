import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Les images du champ sont posées sur le fond de la page (`rendre.mjs`) : elles ne se fondent dans la page que tant que
// `--bg`, et `--surface` sous la fenêtre « Sélection » des Statistiques, valent le fond recopié dans le script.
const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..', '..')
const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8')

/** Variable `nom` du bloc de `tokens.css` qui commence par `selecteur {`. */
const variable = (css, selecteur, nom) => {
  const debut = css.indexOf(`\n${selecteur} {`)
  expect(debut, `bloc ${selecteur} de tokens.css`).toBeGreaterThanOrEqual(0)
  const bloc = css.slice(debut, css.indexOf('\n}', debut))
  return new RegExp(`\\s${nom}:\\s*(#[0-9a-f]+);`, 'i').exec(bloc)?.[1]?.toLowerCase()
}

describe('images du champ de traînées', () => {
  const tokens = lire('src/theme/tokens.css')
  const script = lire('outils/champ/rendre.mjs')
  const fondDuScript = (theme) => new RegExp(`${theme}: \\{ fond: '(#[0-9a-f]+)'`, 'i').exec(script)?.[1]?.toLowerCase()

  it.each([
    ['clair', 'html:root'],
    ['sombre', ":root[data-theme='dark']"],
  ])('thème %s : le fond des images est celui de la page et de la fenêtre « Sélection »', (theme, selecteur) => {
    const fond = fondDuScript(theme)
    expect(fond).toBeDefined()
    expect(variable(tokens, selecteur, '--bg')).toBe(fond)
    expect(variable(tokens, selecteur, '--surface')).toBe(fond)
  })

  it('les quatre images existent et les feuilles de style ne posent plus de SVG du champ', () => {
    for (const theme of ['clair', 'sombre']) {
      for (const suffixe of ['', '-portrait']) expect(existsSync(join(RACINE, `src/assets/champ/champ-${theme}${suffixe}.webp`))).toBe(true)
    }
    for (const feuille of ['src/components/AppShell.css', 'src/pages/StatisticsPage.css']) expect(lire(feuille)).not.toMatch(/champ-(clair|sombre)\.svg/)
  })
})
