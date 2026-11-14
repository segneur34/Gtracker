import { describe, expect, it } from 'vitest'
import { juger } from './garde-lot.mjs'

const RACINE = 'D:\\gong tracker\\Gtracker'
const CTX = { racine: RACINE, liste: null, temp: ['C:\\Users\\x\\AppData\\Local\\Temp', '/tmp'], brouillons: ['D:\\gong tracker\\atelier'] }

const bash = (command, ctx = CTX) => juger({ tool_name: 'Bash', tool_input: { command } }, ctx)
const ecrire = (file_path, ctx = CTX, tool_name = 'Write') => juger({ tool_name, tool_input: { file_path } }, ctx)
const avecListe = (...autorises) => ({ ...CTX, liste: autorises })

describe('git : commandes qui défont un travail', () => {
  it.each([
    'git stash',
    'git stash pop',
    'git checkout src/a.ts',
    'git restore src/a.ts',
    'git clean -fd',
    'git reset --hard',
    'git switch main',
    'git rebase main',
    'git merge autre',
    'git worktree add ../w',
    'git branch -D vieux',
    'git tag v1',
    'git commit -m "x"',
    'git push origin main',
    'git -C "D:/gong tracker/Gtracker" stash',
    'git -c core.pager=cat checkout .',
    'git --no-pager reset',
    'GIT_TRACE=1 git checkout .',
    'cd src && git reset --hard',
    'git status; git clean -n',
    'git diff | git stash',
    'bash -c "git stash"',
    '(git checkout .)',
  ])('refuse %s', (commande) => {
    expect(bash(commande)).toEqual(expect.any(String))
  })

  it.each([
    'git status',
    'git diff -- src/checkout.ts',
    'git diff --stat | head',
    'git log --grep reset',
    'git log --oneline -5',
    'git show HEAD',
    'git blame src/a.ts',
    'git ls-files',
    'git grep stash',
    'git branch',
    'git branch -a',
    'git -C d:/gong\\ tracker/Gtracker log -3',
    'echo "git stash"',
    "echo 'git commit -m x' > /dev/null",
    'grep -rn "git reset" docs',
  ])('laisse passer %s', (commande) => {
    expect(bash(commande)).toBeNull()
  })

  it("dit quoi faire à la place, en une ligne", () => {
    const m = bash('git stash')
    expect(m).toContain('dis-le dans ton rapport')
    expect(m).not.toContain('\n')
  })
})

describe('Bash : édition d\'un fichier par un script', () => {
  it.each([
    "sed -i 's/a/b/' src/a.ts",
    "sed -i.bak 's/a/b/' src/a.ts",
    "sed -Ei 's/a/b/' src/a.ts",
    "sed -ni '1p' src/a.ts",
    "sed --in-place 's/a/b/' src/a.ts",
    "perl -pi -e 's/a/b/' src/a.ts",
    'perl -i.bak -ne print src/a.ts',
    'echo x > src/a.ts',
    'echo x >> src/a.ts',
    'echo x>src/a.ts',
    'cat f > "D:/gong tracker/Gtracker/x.txt"',
    'ls &> src/log.txt',
    'ls 2> erreurs.txt',
    'echo x | tee src/a.ts',
    'echo x | tee -a src/a.ts',
    "node -e \"require('fs').writeFileSync('a.txt','b')\"",
    "node --eval \"require('node:fs').appendFileSync('a.txt','b')\"",
    "python -c \"open('a.txt','w').write('x')\"",
    "python3 -c \"from pathlib import Path; Path('a').write_text('x')\"",
    "cat > src/a.ts <<'EOF'\nx\nEOF",
    "python3 - <<'EOF'\nopen('a.txt','w').write('x')\nEOF",
    'rm .claude/lot-fichiers.json',
    'echo "{}" > .claude/lot-fichiers.json',
    'echo x > "$HOME/a.txt"',
    'bash -c "echo x > src/a.ts"',
  ])('refuse %s', (commande) => {
    expect(bash(commande)).toEqual(expect.any(String))
  })

  it.each([
    "sed -n '1,5p' src/a.ts",
    "sed -e 's/a/b/' src/a.ts",
    "sed -En 's/a/b/p' src/a.ts",
    'echo x > /dev/null',
    'npm run lint 2>&1',
    'node outils/verif.mjs --rapide 2>&1',
    'ls nope 2>/dev/null',
    'echo x > /tmp/a.txt',
    'echo x > C:/Users/x/AppData/Local/Temp/a.txt',
    'echo x > "D:\\gong tracker\\atelier\\a.txt"',
    'echo x | tee /tmp/a.txt',
    'echo "a > b" | cat',
    "grep -n '=>' src/a.ts",
    'cat src/a.ts | head -5',
    "node -e \"console.log(1+1)\"",
    "node -e \"console.log(require('fs').readFileSync('a.txt','utf8'))\"",
    'python -c "print(1)"',
    'cat <<EOF\nsrc > x\ngit stash\nEOF',
    'rm /tmp/brouillon.txt',
  ])('laisse passer %s', (commande) => {
    expect(bash(commande)).toBeNull()
  })
})

describe('Edit et Write : où l\'on peut écrire', () => {
  it.each([
    'D:\\gong tracker\\Gtracker\\package.json',
    'src/package.json',
    'C:\\Windows\\System32\\x.txt',
    'D:\\gong tracker\\autre\\x.txt',
    'D:\\gong tracker\\Gtracker\\docs\\ETAT_DU_PROJET.md',
    'D:\\gong tracker\\Gtracker\\docs\\INVENTAIRE.md',
    'src/../docs/GLOSSAIRE.md',
    'D:\\gong tracker\\Gtracker\\.claude\\agents\\lot.md',
    '.claude/lot-fichiers.json',
    '.claude/hooks/garde-lot.mjs',
    '~/x.txt',
  ])('refuse %s', (chemin) => {
    expect(ecrire(chemin)).toEqual(expect.any(String))
  })

  it.each([
    'D:\\gong tracker\\Gtracker\\src\\a.ts',
    'd:/gong tracker/Gtracker/src/a.ts',
    '/d/gong tracker/Gtracker/src/a.ts',
    'D:/GONG TRACKER/GTRACKER/src/a.ts',
    'src/a.ts',
    'D:\\gong tracker\\Gtracker\\docs\\backlog\\354-gardes-par-crochet.md',
    'docs/backlog/353-x.md',
    'C:\\Users\\x\\AppData\\Local\\Temp\\claude\\scratchpad\\a.txt',
    '/tmp/a.txt',
    'D:\\gong tracker\\atelier\\notes.md',
    '.claude/worktrees/lot-2/src/a.ts',
  ])('laisse passer %s', (chemin) => {
    expect(ecrire(chemin)).toBeNull()
  })

  it('traite Edit, MultiEdit et NotebookEdit comme Write, et ignore les autres outils', () => {
    expect(ecrire('docs/ETAT_DU_PROJET.md', CTX, 'Edit')).toEqual(expect.any(String))
    expect(juger({ tool_name: 'NotebookEdit', tool_input: { notebook_path: 'docs/x.ipynb' } }, CTX)).toEqual(expect.any(String))
    expect(juger({ tool_name: 'Read', tool_input: { file_path: 'docs/ETAT_DU_PROJET.md' } }, CTX)).toBeNull()
    expect(juger({}, CTX)).toBeNull()
    expect(juger(undefined, CTX)).toBeNull()
  })
})

describe('liste du lot (.claude/lot-fichiers.json)', () => {
  const liste = avecListe('src/pages/StatisticsPage.tsx', 'src/components/**', 'src/**/*.test.ts', 'docs/INVENTAIRE.md')

  it('laisse passer ce qu\'elle cite, par chemin, `*` et `**`', () => {
    expect(ecrire('src/pages/StatisticsPage.tsx', liste)).toBeNull()
    expect(ecrire('src/components/ui/Bouton.tsx', liste)).toBeNull()
    expect(ecrire('src/core/a.test.ts', liste)).toBeNull()
    expect(ecrire('src/a.test.ts', liste)).toBeNull()
    expect(ecrire('d:/gong tracker/gtracker/src/components/A.tsx', liste)).toBeNull()
  })

  it('refuse le reste du dépôt', () => {
    expect(ecrire('src/pages/SettingsPage.tsx', liste)).toContain('liste du lot')
    expect(ecrire('src/core/a.ts', liste)).toContain('liste du lot')
    expect(ecrire('docs/backlog/354-x.md', liste)).toContain('liste du lot')
  })

  it('lève le refus de docs/ pour un fichier cité, pas pour un autre', () => {
    expect(ecrire('docs/INVENTAIRE.md', liste)).toBeNull()
    expect(ecrire('docs/ETAT_DU_PROJET.md', liste)).toEqual(expect.any(String))
  })

  it('ne lève ni package.json ni .claude/', () => {
    const large = avecListe('package.json', '.claude/**', '**')
    expect(ecrire('package.json', large)).toContain('package.json')
    expect(ecrire('.claude/lot-fichiers.json', large)).toContain('.claude')
    expect(ecrire('.claude/agents/lot.md', large)).toContain('.claude')
  })

  it('ne lève pas les refus de Bash', () => {
    const large = avecListe('**')
    expect(bash('git stash', large)).toEqual(expect.any(String))
    expect(bash('echo x > src/a.ts', large)).toEqual(expect.any(String))
  })

  it('laisse le dossier temporaire et le brouillon, même avec une liste', () => {
    expect(ecrire('/tmp/a.txt', liste)).toBeNull()
    expect(ecrire('D:\\gong tracker\\atelier\\notes.md', liste)).toBeNull()
  })

  it('une liste vide ou sans fichier lisible ne laisse rien passer dans le dépôt', () => {
    expect(ecrire('src/a.ts', avecListe())).toContain('liste du lot')
  })
})
