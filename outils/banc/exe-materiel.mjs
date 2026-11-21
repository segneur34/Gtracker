// Banc de test : la fenêtre « Matériel des deux appareils » du programme Windows (Réglages › Mémoire, bloc « Réglages »)
// et « Reprendre le matériel » sur la ligne du fichier d'un autre appareil.
// Usage : node exe-materiel.mjs <Gtracker.exe> [<port de débogage>]
// Hors registre (`scripts.mjs`) : le script lance lui-même le programme, en mode d'essai de la coquille
// (`GTRACKER_BANC=1`), sur des dossiers temporaires du dossier temporaire du système : jamais le vrai Documents, jamais le
// profil du vrai programme. Le dossier mémoire porte le fichier de réglages de l'ordinateur (`reglages/pc.json`, écrit par le
// programme lui-même à partir d'une liste de matériel posée dans le stockage de sa page, puis rangé tel quel : profil et
// mémoire de cette préparation sont recopiés pour chaque cas, c'est ce qui garde l'identité de l'appareil) et un faux fichier
// d'un autre appareil (`reglages/telephone.json`, écrit par Node), deux sessions écrites par le programme dans `sessions/`.
// Le disque se lit par Node : c'est lui qui prouve.
// `BANC_CAPTURES=<dossier>` (facultatif) y dépose des captures JPEG de la fenêtre.
// Cas (un programme par cas) :
//  a. dossier sans fichier d'un autre appareil : pas de bouton « Comparer le matériel » ;
//  b. fichier d'un autre appareil sans liste de matériel : le bouton est là, la fenêtre dit « Aucune liste du téléphone dans
//     ce dossier. … », sans tableau ;
//  c. principal : chaque genre de rangée (=, = réuni ici, ≈ se ressemblent, ← manque ici, → manque au téléphone), les phrases
//     « (lui sera proposé) » et la phrase de bas de fenêtre « Pour le téléphone : … » ; « Tailles » : « Voile S » et « Voile M »,
//     « Unit 5 » et « Unit 6 » ne se ressemblent pas ; une activité aux listes égales (« Les deux listes sont les mêmes. ») ;
//     copier (tout de suite, sans question), réunir (annulé puis fait, deux noms au choix), supprimer (refusé puis accepté, texte
//     de la confirmation) : chacun réécrit le fichier de réglages de l'ordinateur environ 2 s après le geste, jamais celui de
//     l'autre appareil, jamais une fiche de session (octet pour octet, dates comprises) ;
//  d. « Reprendre le matériel » sur la ligne du fichier de l'autre appareil : refusé (rien ne change), puis accepté : le matériel
//     des activités communes devient celui du fichier, « Matériel repris de « Téléphone ». », fiches intactes, le bouton
//     disparaît et la fenêtre est toute en « = » ;
//  e. dans tous les cas, la console de la page sans erreur.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLES, connect, FORMATS } from './lib/cdp.mjs';
import { traceDroite } from './lib/traces.mjs';

const [exe, portArg] = process.argv.slice(2);
if (!exe) {
  console.error('Usage : node exe-materiel.mjs <Gtracker.exe> [<port>]');
  process.exit(1);
}
const PORT = Number(portArg ?? 9499);
const ORIGINE = 'https://gtracker.localhost';
const CAPTURES = process.env.BANC_CAPTURES || null;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const vivant = (pid) => spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true }).stdout.includes(` ${pid} `);
const disparu = async (pid, ms) => { for (let t = 0; t < ms; t += 200) { if (!vivant(pid)) return true; await pause(200); } return !vivant(pid); };

let echecs = 0;
let controles = 0;
const check = (quoi, ok, detail) => { controles++; console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${quoi}${!ok && detail !== undefined ? ` (${detail})` : ''}`); if (!ok) echecs++; };

const RACINE = mkdtempSync(join(tmpdir(), 'gtk-mat-'));
const dossier = (nom) => { const d = join(RACINE, nom); mkdirSync(d, { recursive: true }); return d; };
const lireJson = (chemin) => { try { return JSON.parse(readFileSync(chemin, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
/** Fichiers d'un dossier, avec contenu et date : la même chaîne avant et après si rien n'a été écrit. */
const empreinteFichiers = (d) => (existsSync(d) ? readdirSync(d).sort().map((n) => `${n}:${statSync(join(d, n)).mtimeMs}:${readFileSync(join(d, n)).toString('base64')}`).join('|') : '');

const lances = new Set();
/** Une instance du programme ; `env` s'ajoute à l'environnement d'essai. */
async function lancer(profil, memoire, env = {}) {
  const complet = { ...process.env, GTRACKER_BANC: '1', GTRACKER_PROFIL: profil, GTRACKER_MEMOIRE: memoire, GTRACKER_DOCUMENTS: join(profil, 'Documents-essai'), GTRACKER_BANC_MONTRER: 'transparente', ...env };
  for (const cle of Object.keys(complet)) if (cle.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete complet[cle];
  for (const cle of Object.keys(complet)) if (/^GTRACKER_BANC_(SANSFIL|TELEPHONE|APK|APPLICATION)/.test(cle) && !(cle in env)) delete complet[cle];
  const child = spawn(exe, [`--remote-debugging-port=${PORT}`, '--lang=fr-FR', '--force-device-scale-factor=1', '--hide-scrollbars'], { env: complet, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  lances.add(child.pid);
  let ws = null;
  for (let k = 0; k < 100 && !ws; k++) {
    await pause(300);
    try { ws = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((p) => p.type === 'page')?.webSocketDebuggerUrl ?? null; } catch { /* pas prêt */ }
  }
  if (!ws) { spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore', windowsHide: true }); throw new Error('le programme ne répond pas'); }
  process.env.BANC_WS = ws;
  const b = await connect({ port: PORT, base: ORIGINE, width: 1400, height: 1000 });
  await b.blockNetwork();
  return { child, b };
}
/** Ferme le programme comme la croix (sans brouillon), sinon de force ; attend sa disparition. */
async function fermer(p) {
  try { await p.b.close(); } catch { /* page déjà fermée */ }
  spawnSync('taskkill', ['/PID', String(p.child.pid)], { stdio: 'ignore', windowsHide: true });
  if (!(await disparu(p.child.pid, 6000))) {
    console.log('(fermeture demandée sans effet : processus tué)');
    spawnSync('taskkill', ['/T', '/F', '/PID', String(p.child.pid)], { stdio: 'ignore', windowsHide: true });
    await disparu(p.child.pid, 5000);
  }
  await pause(500);
}
/** Lance, joue `essai`, ferme toujours (même sur erreur). Vérifie la console de la page à la fin. */
async function avecProgramme(profil, memoire, quoi, essai) {
  let p = null;
  try {
    p = await lancer(profil, memoire);
    const r = await essai(p.b);
    check(`${quoi} : console de la page sans erreur`, p.b.logs.length === 0, p.b.logs.join(' | '));
    return r;
  } catch (e) {
    check(`${quoi} : essai interrompu : ${e.stack ?? e.message}`, false);
    return null;
  } finally {
    if (p) await fermer(p);
  }
}

// ---------- les données ----------
const item = (id, name, merged) => (merged ? { id, name, merged } : { id, name });
/** Matériel de l'ordinateur : une activité (Wingfoil) avec de quoi montrer chaque genre de rangée, et Pumping, égal au téléphone. */
const GEAR_PC = {
  wingfoil: [
    { id: 'g-ailes', name: 'Ailes', items: [item('p1', 'Unit 5,5'), item('p2', 'Duotone Slick 4'), item('p3', 'Echo 6'), item('p4', 'Armstrong 4', [{ id: 't4', name: 'Armstrong 5' }])] },
    { id: 'g-tailles', name: 'Tailles', items: [item('p5', 'Voile S'), item('p6', 'Unit 5')] },
  ],
  'a-pumping': [{ id: 'g-pump', name: 'Planches', items: [item('z1', 'Foil Z')] }],
};
/** Matériel de l'autre appareil. */
const GEAR_TEL = {
  wingfoil: [
    { id: 'g-ailes', name: 'Ailes', items: [item('t1', 'unit 5.5'), item('t2', 'Slick 4'), item('t4', 'Armstrong 5'), item('t3', 'Unit 4')] },
    { id: 'g-tailles', name: 'Tailles', items: [item('t5', 'Voile M'), item('t6', 'Unit 6')] },
  ],
  kite: [{ id: 'g-kite', name: 'Ailes de kite', items: [item('k1', 'Rebel 9')] }],
  'a-pumping': [{ id: 'g-pump', name: 'Planches', items: [item('z1', 'Foil Z')] }],
};
const SAVED_AT_TEL = Date.UTC(2026, 10, 20, 17, 4, 0);
const fichierTelephone = (gear) => `${JSON.stringify({
  format: FORMATS.reglages,
  version: 2,
  savedAt: SAVED_AT_TEL,
  device: { id: 'telephone-du-banc', name: 'Téléphone' },
  values: { [CLES.sportSettings]: gear === null ? {} : { gearGroups: gear } },
}, null, 2)}\n`;
const MARQUEUR = `${JSON.stringify({ format: FORMATS.memoire, version: 1 })}\n`;

/** Matériel d'une activité dans un fichier de réglages, nom des lignes et des pièces (« Ailes: Unit 5,5, … »). */
const materielDe = (fichier, activite) => {
  const groupes = lireJson(fichier)?.values?.[CLES.sportSettings]?.gearGroups?.[activite];
  return Array.isArray(groupes) ? groupes.map((g) => `${g.name}: ${g.items.map((i) => i.name).join(', ')}`).join(' | ') : null;
};
const piecesDe = (fichier, activite) => (lireJson(fichier)?.values?.[CLES.sportSettings]?.gearGroups?.[activite] ?? []).flatMap((g) => g.items);

// ---------- préparation : l'ordinateur, par le programme ----------
const PREP_PROFIL = dossier('prep-profil');
const PREP_MEMOIRE = dossier('prep-memoire');
const sessionsDe = (m) => join(m, 'sessions');
/** Le programme écrit son fichier de réglages et deux sessions ; la liste de matériel lui est donnée par le stockage de sa page. */
async function preparer() {
  writeFileSync(join(PREP_MEMOIRE, 'gtracker.json'), MARQUEUR);
  await avecProgramme(PREP_PROFIL, PREP_MEMOIRE, 'préparation', async (b) => {
    await b.go('/sessions', 5000);
    for (let k = 0; k < 2; k++) {
      const gpx = traceDroite({ debutMs: Date.UTC(2026, 9, 1 + k, 7 + k, 0, 0), secondes: 300, vitesse: 4, type: 'wingfoil', nom: 'wingfoil' });
      check(`préparation : import de la session ${k + 1}`, (await b.importGpx(gpx, `modele-${k + 1}.gpx`)) === 'ok');
      await b.waitFor(() => (existsSync(sessionsDe(PREP_MEMOIRE)) ? readdirSync(sessionsDe(PREP_MEMOIRE)).filter((n) => n.endsWith('.json')).length : 0) >= k + 1, { timeout: 15000, label: `fiche ${k + 1}` });
      await b.settle({ max: 1500 });
    }
    await b.waitFor(() => existsSync(join(PREP_MEMOIRE, 'reglages', 'pc.json')), { timeout: 15000, label: 'fichier de réglages de l\'ordinateur' });
    await b.evaluate(`(() => {
      const cle = ${JSON.stringify(CLES.sportSettings)};
      const lu = JSON.parse(localStorage.getItem(cle) ?? '{}');
      localStorage.setItem(cle, JSON.stringify({ ...lu, gearGroups: ${JSON.stringify(GEAR_PC)} }));
    })()`);
    await b.go('/parametres', 5000);
    await b.waitFor(() => materielDe(join(PREP_MEMOIRE, 'reglages', 'pc.json'), 'wingfoil') !== null, { timeout: 15000, label: 'matériel dans le fichier de l\'ordinateur' });
    await b.wait(1000);
  });
  const pc = join(PREP_MEMOIRE, 'reglages', 'pc.json');
  check('préparation : le fichier de réglages de l\'ordinateur est reglages/pc.json et porte son matériel', materielDe(pc, 'wingfoil') === 'Ailes: Unit 5,5, Duotone Slick 4, Echo 6, Armstrong 4 | Tailles: Voile S, Unit 5', String(materielDe(pc, 'wingfoil')));
  const fiches = existsSync(sessionsDe(PREP_MEMOIRE)) ? readdirSync(sessionsDe(PREP_MEMOIRE)).filter((n) => n.endsWith('.json')) : [];
  check('préparation : deux sessions entières sortent du programme (GPX et fiche)', fiches.length === 2 && readdirSync(sessionsDe(PREP_MEMOIRE)).length === 4, readdirSync(sessionsDe(PREP_MEMOIRE)).join(','));
  check('préparation : le profil et la mémoire sont retenus (identité de l\'ordinateur) : un seul fichier dans reglages/', readdirSync(join(PREP_MEMOIRE, 'reglages')).join(',') === 'pc.json', readdirSync(join(PREP_MEMOIRE, 'reglages')).join(','));
}
/** Un cas : copie du profil et de la mémoire préparés, plus le fichier de l'autre appareil (`gear` : son matériel, `undefined` : aucun fichier). */
function cas(nom, gear) {
  const profil = join(RACINE, `${nom}-profil`);
  const memoire = join(RACINE, `${nom}-memoire`);
  cpSync(PREP_PROFIL, profil, { recursive: true });
  cpSync(PREP_MEMOIRE, memoire, { recursive: true });
  if (gear !== undefined) writeFileSync(join(memoire, 'reglages', 'telephone.json'), fichierTelephone(gear));
  return { profil, memoire, pc: join(memoire, 'reglages', 'pc.json'), tel: join(memoire, 'reglages', 'telephone.json') };
}

// ---------- la page ----------
/** Réglages › Mémoire ouverte, bloc « Réglages » présent (sa liste de fichiers lue). */
async function ouvrirMemoire(b) {
  await b.go('/parametres', 5000);
  await b.waitFor(`[...document.querySelectorAll('[role=button]')].some((x) => x.textContent.trim() === 'Mémoire')`, { timeout: 8000, label: 'carte Mémoire' });
  if (!(await b.evaluate(`Boolean(document.querySelector('.set-files-list'))`))) {
    await b.click(`[...document.querySelectorAll('[role=button]')].find((x) => x.textContent.trim() === 'Mémoire')`);
  }
  await b.waitFor(`Boolean(document.querySelector('.set-files-list li'))`, { timeout: 10000, label: 'liste des fichiers de réglages' });
  await b.settle({ max: 1500 });
}
/** Le bloc « Réglages » : lignes de fichiers (nom, boutons), boutons du bloc. */
const bloc = (b) => b.evaluate(`(() => {
  const liste = document.querySelector('.set-files-list');
  if (!liste) return null;
  const racine = liste.parentElement;
  return {
    lignes: [...liste.querySelectorAll('li')].map((li) => ({ nom: li.querySelector('strong')?.textContent.trim() ?? '', boutons: [...li.querySelectorAll('button')].map((x) => x.textContent.trim()), texte: li.innerText.replace(/\\n+/g, ' / ') })),
    boutons: [...racine.querySelectorAll(':scope > div button, :scope > div label')].map((x) => x.textContent.trim().toLowerCase()),
    texte: racine.innerText.replace(/\\n+/g, ' / '),
  };
})()`);
const FENETRE = '[role=dialog].gear-compare';
/** Ce que la fenêtre dit : phrases, activités, lignes et rangées du tableau, résumé, boutons. */
const fenetre = (b) => b.evaluate(`(() => {
  const d = document.querySelector(${JSON.stringify(FENETRE)});
  if (!d) return null;
  const nom = (td) => { const n = td.childNodes[0]; return (n ? n.textContent : '').trim(); };
  const note = (td) => [...td.querySelectorAll('.gear-compare__note')].map((x) => x.textContent.trim());
  return {
    titre: d.getAttribute('aria-label'),
    phrases: [...d.querySelectorAll('.gear-compare__text')].map((x) => x.textContent.trim()),
    resume: d.querySelector('.gear-compare__summary')?.textContent.trim() ?? null,
    activites: [...d.querySelectorAll('[role=radiogroup] [role=radio]')].map((x) => ({ texte: x.textContent.trim(), coche: x.getAttribute('aria-checked') === 'true' })),
    lignes: [...d.querySelectorAll('.gear-compare__table tbody')].map((tb) => {
      const tete = tb.querySelector('tr.gear-compare__line');
      return {
        nom: tete?.querySelector('.gear-compare__line-name')?.textContent.trim() ?? '',
        note: tete?.querySelector('th .gear-compare__note')?.textContent.trim() ?? null,
        entetes: [...(tete?.querySelectorAll('th[scope=col]') ?? [])].map((x) => x.textContent.trim()),
        boutonsLigne: [...(tete?.querySelectorAll('.gear-compare__act button') ?? [])].map((x) => x.textContent.trim()),
        rangees: [...tb.querySelectorAll('tr:not(.gear-compare__line)')].map((tr) => {
          const t = tr.querySelectorAll('td');
          return { genre: t[0].textContent.trim(), pc: nom(t[1]), phone: nom(t[2]), notes: [...note(t[1]), ...note(t[2]), ...note(t[3])], boutons: [...t[3].querySelectorAll('button')].map((x) => x.textContent.trim()) };
        }),
      };
    }),
    boutons: [...d.querySelectorAll('button')].filter((x) => !x.closest('.gear-compare__act') && !x.closest('[role=radiogroup]')).map((x) => x.textContent.trim()),
  };
})()`);
/** Toutes les rangées d'une ligne, en « genre | ordinateur | téléphone ». */
const rangeesTexte = (f, ligne) => (f?.lignes.find((l) => l.nom === ligne)?.rangees ?? []).map((r) => `${r.genre} | ${r.pc} | ${r.phone}`);
const ouvrirFenetre = async (b) => {
  const clic = await b.evaluate(`(() => { const x = [...document.querySelectorAll('button')].find((y) => y.textContent.trim().toLowerCase() === 'comparer le matériel'); if (!x) return 'absent'; x.click(); return 'ok'; })()`);
  if (clic === 'ok') await b.waitFor(`Boolean(document.querySelector(${JSON.stringify(FENETRE)}))`, { timeout: 8000, label: 'fenêtre du matériel' });
  await b.wait(600);
  return clic;
};
/** Clique, dans la fenêtre, un bouton d'une rangée (repérée par le nom de l'ordinateur ou celui de l'autre appareil) ou de la ligne. */
const cliquerRangee = (b, nomPiece, bouton) => b.evaluate(`(() => {
  const d = document.querySelector(${JSON.stringify(FENETRE)});
  const rangee = [...d.querySelectorAll('.gear-compare__table tr')].find((tr) => {
    const t = tr.querySelectorAll('td');
    return t.length >= 3 && (t[1].childNodes[0]?.textContent.trim() === ${JSON.stringify(nomPiece)} || t[2].childNodes[0]?.textContent.trim() === ${JSON.stringify(nomPiece)});
  });
  const x = [...(rangee ?? d).querySelectorAll('.gear-compare__act button')].find((y) => y.textContent.trim() === ${JSON.stringify(bouton)});
  if (!x) return 'absent';
  x.click();
  return 'ok';
})()`);
const cliquerFenetre = (b, texte) => b.clickText(texte, `${FENETRE} button`);
const choisirActivite = async (b, nom) => {
  const r = await b.evaluate(`(() => { const x = [...document.querySelectorAll(${JSON.stringify(`${FENETRE} [role=radio]`)})].find((y) => y.textContent.trim() === ${JSON.stringify(nom)}); if (!x) return 'absent'; x.click(); return 'ok'; })()`);
  await b.wait(400);
  return r;
};
/** `window.confirm` de la page : réponse imposée, questions gardées dans `window.__questions`. */
const preparerConfirm = (b) => b.evaluate(`(() => { window.__questions = []; window.__reponse = false; window.confirm = (m) => { window.__questions.push(m); return window.__reponse; }; })()`);
const reponseConfirm = (b, oui) => b.evaluate(`(() => { window.__reponse = ${oui ? 'true' : 'false'}; })()`);
const questions = (b) => b.evaluate('window.__questions ?? []');
/** Capture JPEG de la page. */
async function capturer(b, nom) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1400, height: 1000, scale: 0.64 } });
  writeFileSync(join(CAPTURES, `${nom}.jpg`), Buffer.from(r.result.data, 'base64'));
}
/** Nombres du résumé « Pour le téléphone : 2 ajouts, 1 retrait, 1 réunion. » : { ajouts, retraits, reunions }. */
const nombres = (resume) => ({
  ajouts: Number(/(\d+) ajouts?/.exec(resume ?? '')?.[1] ?? 0),
  retraits: Number(/(\d+) retraits?/.exec(resume ?? '')?.[1] ?? 0),
  reunions: Number(/(\d+) réunions?/.exec(resume ?? '')?.[1] ?? 0),
});

try {
  console.log('\n== Préparation : le fichier de réglages de l\'ordinateur et deux sessions, écrits par le programme');
  await preparer();
  const FICHES_AVANT = empreinteFichiers(sessionsDe(PREP_MEMOIRE));

  // ---------- a. pas d'autre appareil ----------
  console.log('\n== a. Aucun fichier d\'un autre appareil dans le dossier : pas de bouton');
  {
    const c = cas('a');
    await avecProgramme(c.profil, c.memoire, 'a', async (b) => {
      await ouvrirMemoire(b);
      const m = await bloc(b);
      console.log(`  bloc : ${JSON.stringify(m?.texte)}`);
      check('a. la liste ne porte que le fichier de cet appareil (« PC », « cet appareil »)', m?.lignes.length === 1 && m.lignes[0].nom === 'PC' && /cet appareil/.test(m.lignes[0].texte), JSON.stringify(m?.lignes));
      check('a. pas de bouton « Comparer le matériel »', !m?.boutons.includes('comparer le matériel'), JSON.stringify(m?.boutons));
      check('a. pas de « Reprendre le matériel »', !m?.lignes.some((l) => l.boutons.includes('Reprendre le matériel')));
    });
  }

  // ---------- b. fichier sans liste ----------
  console.log('\n== b. Fichier d\'un autre appareil sans liste de matériel');
  {
    const c = cas('b', null);
    await avecProgramme(c.profil, c.memoire, 'b', async (b) => {
      await ouvrirMemoire(b);
      const m = await bloc(b);
      console.log(`  bloc : ${JSON.stringify(m?.texte)}`);
      check('b. la liste porte « PC » et « Téléphone »', m?.lignes.map((l) => l.nom).sort().join(',') === 'PC,Téléphone', JSON.stringify(m?.lignes.map((l) => l.nom)));
      check('b. le bouton « Comparer le matériel » est là (la casse d\'écran vient du CSS)', m?.boutons.includes('comparer le matériel'), JSON.stringify(m?.boutons));
      check('b. « Comparer le matériel » est avant « Importer un fichier de réglages » ou après, dans le même bloc', m?.boutons.includes('importer un fichier de réglages'), JSON.stringify(m?.boutons));
      check('b. clic « Comparer le matériel »', (await ouvrirFenetre(b)) === 'ok');
      const f = await fenetre(b);
      console.log(`  fenêtre : ${JSON.stringify(f)}`);
      check('b. la fenêtre s\'appelle « Matériel des deux appareils »', f?.titre === 'Matériel des deux appareils', f?.titre);
      check('b. « Aucune liste du téléphone dans ce dossier. Branchez-le et touchez « Synchroniser » : sa liste arrive avec ses réglages. »', JSON.stringify(f?.phrases) === JSON.stringify(["Aucune liste du téléphone dans ce dossier. Branchez-le et touchez « Synchroniser » : sa liste arrive avec ses réglages."]), JSON.stringify(f?.phrases));
      check('b. ni tableau, ni activités, ni phrase de bas de fenêtre ; seul « Fermer » est offert', f?.lignes.length === 0 && f.activites.length === 0 && f.resume === null && JSON.stringify(f.boutons.filter((x) => x !== '×')) === JSON.stringify(['Fermer']), JSON.stringify([f?.lignes.length, f?.activites.length, f?.resume, f?.boutons]));
      await capturer(b, 'materiel-sans-liste');
      check('b. « Fermer » ferme la fenêtre', (await cliquerFenetre(b, 'Fermer')) === 'ok' && (await b.wait(400), (await fenetre(b)) === null));
    });
    check('b. le fichier de l\'autre appareil n\'a pas changé', readFileSync(c.tel, 'utf8') === fichierTelephone(null));
    check('b. les fiches de sessions n\'ont pas changé (octets et dates)', empreinteFichiers(sessionsDe(c.memoire)) === FICHES_AVANT);
  }

  // ---------- c. principal : rangées, copier, réunir, supprimer ----------
  console.log('\n== c. Principal : chaque genre de rangée ; copier, réunir, supprimer');
  const c = cas('c', GEAR_TEL);
  const telAvant = readFileSync(c.tel, 'utf8');
  /** Attend que le fichier de l'ordinateur porte `piece` (ou ne la porte plus) dans Wingfoil ; rend vrai si c'est arrivé. */
  const fichierPorte = (nom, present) => ({ timeout: 9000, label: `fichier de l'ordinateur : « ${nom} » ${present ? 'présente' : 'retirée'}` });
  await avecProgramme(c.profil, c.memoire, 'c', async (b) => {
    await ouvrirMemoire(b);
    let m = await bloc(b);
    const ligneTel = m.lignes.find((l) => l.nom === 'Téléphone');
    console.log(`  ligne du téléphone : ${JSON.stringify(ligneTel)}`);
    check('c. la ligne « Téléphone » offre « Reprendre le matériel » et « Reprendre » (les listes diffèrent)', JSON.stringify(ligneTel?.boutons) === JSON.stringify(['Reprendre le matériel', 'Reprendre']), JSON.stringify(ligneTel?.boutons));
    check('c. la ligne « PC » n\'offre rien (cet appareil)', JSON.stringify(m.lignes.find((l) => l.nom === 'PC')?.boutons) === '[]');
    check('c. clic « Comparer le matériel »', (await ouvrirFenetre(b)) === 'ok');
    await preparerConfirm(b);
    let f = await fenetre(b);
    console.log(`  fenêtre : ${JSON.stringify(f)}`);
    await capturer(b, 'materiel-comparaison');
    check('c. la fenêtre s\'appelle « Matériel des deux appareils »', f?.titre === 'Matériel des deux appareils', f?.titre);
    check('c. les activités : « Wingfoil », « Kite », « Pumping » (celles qui ont une liste d\'un côté), Wingfoil d\'abord', JSON.stringify(f?.activites.map((x) => x.texte)) === JSON.stringify(['Wingfoil', 'Kite', 'Pumping']) && f.activites[0].coche, JSON.stringify(f?.activites));
    check('c. deux lignes de matériel : « Ailes » et « Tailles », colonnes « Ordinateur » et « Téléphone »', JSON.stringify(f?.lignes.map((l) => l.nom)) === JSON.stringify(['Ailes', 'Tailles']) && f.lignes.every((l) => JSON.stringify(l.entetes) === JSON.stringify(['Ordinateur', 'Téléphone'])), JSON.stringify(f?.lignes.map((l) => [l.nom, l.entetes])));
    const ailes = rangeesTexte(f, 'Ailes');
    console.log(`  Ailes : ${JSON.stringify(ailes)}`);
    check('c. « = » : « Unit 5,5 » et « unit 5.5 » sont la même pièce (casse et virgule)', ailes.includes('= | Unit 5,5 | unit 5.5'), JSON.stringify(ailes));
    check('c. « ≈ se ressemblent » : « Duotone Slick 4 » et « Slick 4 »', ailes.includes('≈ se ressemblent | Duotone Slick 4 | Slick 4'), JSON.stringify(ailes));
    check('c. « → manque au téléphone » : « Echo 6 »', ailes.includes('→ manque au téléphone | Echo 6 | —'), JSON.stringify(ailes));
    check('c. « = réuni ici » : « Armstrong 4 » a reçu « Armstrong 5 »', ailes.includes('= réuni ici | Armstrong 4 | Armstrong 5'), JSON.stringify(ailes));
    check('c. « ← manque ici » : « Unit 4 » (« Unit 4 » et « Unit 5,5 » ne se ressemblent pas : leurs nombres diffèrent)', ailes.includes('← manque ici | — | Unit 4'), JSON.stringify(ailes));
    const echo = f?.lignes[0].rangees.find((r) => r.pc === 'Echo 6');
    check('c. « → manque au téléphone » dit « (lui sera proposé) » et offre « Supprimer »', echo?.notes.includes('(lui sera proposé)') && echo.boutons.join('/') === 'Supprimer', JSON.stringify(echo));
    const unit4 = f?.lignes[0].rangees.find((r) => r.phone === 'Unit 4');
    check('c. « ← manque ici » offre « Copier vers l\'ordinateur » et dit « (quittera le téléphone s\'il reprend la liste sans copie) »', unit4?.boutons.join('/') === "Copier vers l'ordinateur" && unit4.notes.includes("(quittera le téléphone s'il reprend la liste sans copie)"), JSON.stringify(unit4));
    check('c. « ≈ se ressemblent » offre « Réunir »', f?.lignes[0].rangees.find((r) => r.pc === 'Duotone Slick 4')?.boutons.join('/') === 'Réunir');
    check('c. « = » n\'offre qu\'un geste « Supprimer », et seul son côté de l\'ordinateur', f?.lignes[0].rangees.find((r) => r.pc === 'Unit 5,5')?.boutons.join('/') === 'Supprimer');
    const tailles = rangeesTexte(f, 'Tailles');
    console.log(`  Tailles : ${JSON.stringify(tailles)}`);
    check('c. « Tailles » : « Voile S » et « Voile M » ne se ressemblent pas (deux rangées, aucun « ≈ »)', tailles.includes('→ manque au téléphone | Voile S | —') && tailles.includes('← manque ici | — | Voile M') && !tailles.some((r) => /^≈/.test(r)), JSON.stringify(tailles));
    check('c. « Tailles » : « Unit 5 » et « Unit 6 » ne se ressemblent pas (deux rangées, aucun « ≈ »)', tailles.includes('→ manque au téléphone | Unit 5 | —') && tailles.includes('← manque ici | — | Unit 6'), JSON.stringify(tailles));
    check('c. aucune phrase « Les deux listes sont les mêmes. » sur Wingfoil', !f?.phrases.includes('Les deux listes sont les mêmes.'), JSON.stringify(f?.phrases));
    const n0 = nombres(f?.resume);
    console.log(`  résumé : ${f?.resume}`);
    check('c. le bas de la fenêtre dit « Pour le téléphone : … » avec « Après « Synchroniser », sur le téléphone : Réglages › Mémoire › « PC » › « Reprendre le matériel ». »', /^Pour le téléphone : .+\. Après « Synchroniser », sur le téléphone : Réglages › Mémoire › « PC » › « Reprendre le matériel »\.$/.test(f?.resume ?? ''), f?.resume);
    check('c. le résumé compte des ajouts, des retraits et des réunions', n0.ajouts > 0 && n0.retraits > 0 && n0.reunions > 0, JSON.stringify(n0));
    check('c. la fenêtre n\'offre que « Fermer » en bas', JSON.stringify(f?.boutons.filter((x) => x !== '×')) === JSON.stringify(['Fermer']), JSON.stringify(f?.boutons));

    // -- les autres activités
    check('c. clic sur l\'activité « Pumping »', (await choisirActivite(b, 'Pumping')) === 'ok');
    f = await fenetre(b);
    check('c. Pumping : « Les deux listes sont les mêmes. »', f?.phrases.includes('Les deux listes sont les mêmes.'), JSON.stringify(f?.phrases));
    check('c. Pumping : toutes les rangées sont « = »', f?.lignes.flatMap((l) => l.rangees).every((r) => r.genre === '='), JSON.stringify(f?.lignes));
    check('c. clic sur l\'activité « Kite »', (await choisirActivite(b, 'Kite')) === 'ok');
    f = await fenetre(b);
    console.log(`  Kite : ${JSON.stringify(f?.lignes)}`);
    check('c. Kite (liste du seul téléphone) : la ligne « Ailes de kite » est « ligne absente de l\'ordinateur », « ← manque ici » sur « Rebel 9 »', f?.lignes[0]?.nom === 'Ailes de kite' && f.lignes[0].note === "ligne absente de l'ordinateur" && rangeesTexte(f, 'Ailes de kite').includes('← manque ici | — | Rebel 9'), JSON.stringify(f?.lignes[0]));
    check('c. Kite : un geste « Copier vers l\'ordinateur » sur la ligne', f?.lignes[0]?.boutonsLigne.join('/') === "Copier vers l'ordinateur", JSON.stringify(f?.lignes[0]?.boutonsLigne));
    check('c. retour sur « Wingfoil »', (await choisirActivite(b, 'Wingfoil')) === 'ok');

    // -- copier : tout de suite, sans question
    const fichesAvantGestes = empreinteFichiers(sessionsDe(c.memoire));
    const piecesAvant = JSON.stringify(piecesDe(c.pc, 'wingfoil').map((p) => p.name));
    check('c. clic « Copier vers l\'ordinateur » sur « Unit 4 »', (await cliquerRangee(b, 'Unit 4', "Copier vers l'ordinateur")) === 'ok');
    await b.wait(300);
    check('c. copier ne pose aucune question', (await questions(b)).length === 0, JSON.stringify(await questions(b)));
    f = await fenetre(b);
    check('c. copier : la rangée devient « = » aussitôt (« Unit 4 » des deux côtés)', rangeesTexte(f, 'Ailes').includes('= | Unit 4 | Unit 4'), JSON.stringify(rangeesTexte(f, 'Ailes')));
    check('c. copier : le résumé n\'a plus ce retrait', nombres(f?.resume).retraits === n0.retraits - 1, `${f?.resume}`);
    await b.waitFor(() => piecesDe(c.pc, 'wingfoil').some((p) => p.name === 'Unit 4'), fichierPorte('Unit 4', true));
    const apresCopie = piecesDe(c.pc, 'wingfoil');
    console.log(`  fichier de l'ordinateur après « Copier » : ${materielDe(c.pc, 'wingfoil')}`);
    check('c. copier réécrit le fichier de réglages de l\'ordinateur (« Unit 4 » dans « Ailes », la liste d\'avant gardée)', apresCopie.some((p) => p.name === 'Unit 4') && JSON.parse(piecesAvant).every((n) => apresCopie.some((p) => p.name === n)), `${piecesAvant} -> ${materielDe(c.pc, 'wingfoil')}`);
    check('c. copier garde l\'identifiant de la pièce du téléphone (« t3 »)', apresCopie.find((p) => p.name === 'Unit 4')?.id === 't3', JSON.stringify(apresCopie.find((p) => p.name === 'Unit 4')));

    // -- réunir : annulé, puis fait
    const fichierAvantReunir = readFileSync(c.pc, 'utf8');
    check('c. clic « Réunir » sur « Duotone Slick 4 » / « Slick 4 »', (await cliquerRangee(b, 'Duotone Slick 4', 'Réunir')) === 'ok');
    await b.wait(500);
    f = await fenetre(b);
    console.log(`  réunir : ${JSON.stringify(f?.phrases)} ; boutons ${JSON.stringify(f?.boutons)}`);
    check('c. réunir : « Réunir « Duotone Slick 4 » et « Slick 4 » ? »', f?.phrases.includes('Réunir « Duotone Slick 4 » et « Slick 4 » ?'), JSON.stringify(f?.phrases));
    check('c. réunir : « Nom gardé : » avec les deux noms au choix, le premier coché', await b.evaluate(`(() => { const d = document.querySelector(${JSON.stringify(FENETRE)}); const radios = [...d.querySelectorAll('[role=radio]')]; return /Nom gardé :/.test(d.innerText) && radios.map((x) => x.textContent.trim()).join('/') === 'Duotone Slick 4/Slick 4' && radios[0].getAttribute('aria-checked') === 'true'; })()`));
    check('c. réunir : « Les sessions ne sont pas réécrites : celles qui portent l\'autre nom comptent pour celui-ci. »', f?.phrases.includes("Les sessions ne sont pas réécrites : celles qui portent l'autre nom comptent pour celui-ci."), JSON.stringify(f?.phrases));
    check('c. réunir : « Annuler » et « Réunir »', JSON.stringify(f?.boutons.filter((x) => x !== '×')) === JSON.stringify(['Annuler', 'Réunir']), JSON.stringify(f?.boutons));
    await capturer(b, 'materiel-reunir');
    check('c. clic « Annuler »', (await cliquerFenetre(b, 'Annuler')) === 'ok');
    await b.wait(2800);
    f = await fenetre(b);
    check('c. « Annuler » : retour au tableau, « Duotone Slick 4 » et « Slick 4 » toujours « ≈ », fichier de l\'ordinateur inchangé', rangeesTexte(f, 'Ailes').includes('≈ se ressemblent | Duotone Slick 4 | Slick 4') && readFileSync(c.pc, 'utf8') === fichierAvantReunir);
    check('c. clic « Réunir » de nouveau', (await cliquerRangee(b, 'Duotone Slick 4', 'Réunir')) === 'ok');
    await b.wait(500);
    check('c. clic « Réunir » (le nom gardé reste « Duotone Slick 4 »)', (await cliquerFenetre(b, 'Réunir')) === 'ok');
    await b.wait(500);
    f = await fenetre(b);
    check('c. réunir : la rangée devient « = réuni ici »', rangeesTexte(f, 'Ailes').includes('= réuni ici | Duotone Slick 4 | Slick 4'), JSON.stringify(rangeesTexte(f, 'Ailes')));
    check('c. réunir : le résumé compte une réunion de plus', nombres(f?.resume).reunions === n0.reunions + 1, `${f?.resume}`);
    await b.waitFor(() => piecesDe(c.pc, 'wingfoil').some((p) => p.name === 'Duotone Slick 4' && JSON.stringify(p.merged) === JSON.stringify([{ id: 't2', name: 'Slick 4' }])), { timeout: 9000, label: 'pièce réunie dans le fichier de l\'ordinateur' });
    const slick = piecesDe(c.pc, 'wingfoil').find((p) => p.name === 'Duotone Slick 4');
    console.log(`  « Duotone Slick 4 » dans le fichier : ${JSON.stringify(slick)}`);
    check('c. réunir réécrit le fichier de l\'ordinateur : « Duotone Slick 4 » garde son identifiant et porte « Slick 4 » (identifiant et nom) en « merged »', slick?.id === 'p2' && JSON.stringify(slick.merged) === JSON.stringify([{ id: 't2', name: 'Slick 4' }]), JSON.stringify(slick));

    // -- supprimer : refusé, puis accepté
    const avantSuppression = readFileSync(c.pc, 'utf8');
    await reponseConfirm(b, false);
    check('c. clic « Supprimer » sur « Echo 6 » (confirmation refusée)', (await cliquerRangee(b, 'Echo 6', 'Supprimer')) === 'ok');
    await b.wait(2800);
    const q = await questions(b);
    console.log(`  confirmation : ${JSON.stringify(q)}`);
    check('c. supprimer : « Supprimer « Echo 6 » de la liste de l\'ordinateur ? Ses sessions le gardent, « (hors liste) » dans les Statistiques. »', q.length === 1 && q[0] === "Supprimer « Echo 6 » de la liste de l'ordinateur ? Ses sessions le gardent, « (hors liste) » dans les Statistiques.", JSON.stringify(q));
    f = await fenetre(b);
    check('c. confirmation refusée : « Echo 6 » est toujours là et le fichier de l\'ordinateur n\'a pas changé', rangeesTexte(f, 'Ailes').includes('→ manque au téléphone | Echo 6 | —') && readFileSync(c.pc, 'utf8') === avantSuppression);
    await reponseConfirm(b, true);
    check('c. clic « Supprimer » sur « Echo 6 » (confirmation acceptée)', (await cliquerRangee(b, 'Echo 6', 'Supprimer')) === 'ok');
    await b.wait(400);
    f = await fenetre(b);
    check('c. supprimer : « Echo 6 » a quitté le tableau', !rangeesTexte(f, 'Ailes').some((r) => /Echo 6/.test(r)), JSON.stringify(rangeesTexte(f, 'Ailes')));
    await b.waitFor(() => !piecesDe(c.pc, 'wingfoil').some((p) => p.name === 'Echo 6'), fichierPorte('Echo 6', false));
    console.log(`  fichier de l'ordinateur après « Supprimer » : ${materielDe(c.pc, 'wingfoil')}`);
    check('c. supprimer réécrit le fichier de l\'ordinateur sans « Echo 6 », le reste gardé', !piecesDe(c.pc, 'wingfoil').some((p) => p.name === 'Echo 6') && ['Unit 5,5', 'Duotone Slick 4', 'Armstrong 4', 'Unit 4'].every((n) => piecesDe(c.pc, 'wingfoil').some((p) => p.name === n)), String(materielDe(c.pc, 'wingfoil')));
    f = await fenetre(b);
    console.log(`  résumé après les trois gestes : ${f?.resume}`);
    await capturer(b, 'materiel-apres-gestes');

    // -- ce que les gestes n'ont pas touché
    check('c. le fichier de l\'autre appareil n\'a pas bougé (octet pour octet)', readFileSync(c.tel, 'utf8') === telAvant);
    check('c. reglages/ ne porte toujours que les deux fichiers (aucun temporaire)', readdirSync(join(c.memoire, 'reglages')).sort().join(',') === 'pc.json,telephone.json', readdirSync(join(c.memoire, 'reglages')).join(','));
    check('c. les fiches et les GPX de sessions/ sont identiques à l\'octet (dates comprises) avant et après les gestes', empreinteFichiers(sessionsDe(c.memoire)) === fichesAvantGestes);
    check('c. les fiches sont celles d\'avant le lancement du programme', empreinteFichiers(sessionsDe(c.memoire)) === FICHES_AVANT);
    check('c. « Fermer » ferme la fenêtre', (await cliquerFenetre(b, 'Fermer')) === 'ok' && (await b.wait(400), (await fenetre(b)) === null));

    // ---------- d. Reprendre le matériel ----------
    console.log('\n== d. « Reprendre le matériel » sur la ligne de l\'autre appareil');
    m = await bloc(b);
    check('d. la ligne « Téléphone » offre toujours « Reprendre le matériel » (les listes diffèrent encore)', m.lignes.find((l) => l.nom === 'Téléphone')?.boutons.includes('Reprendre le matériel'), JSON.stringify(m.lignes));
    await b.evaluate(`window.__questions = []`);
    await reponseConfirm(b, false);
    const avantReprise = readFileSync(c.pc, 'utf8');
    check('d. clic « Reprendre le matériel » (refusé)', (await b.clickText('Reprendre le matériel', '.set-files-list button')) === 'ok');
    await b.wait(2800);
    const qr = await questions(b);
    console.log(`  confirmation : ${JSON.stringify(qr)}`);
    check('d. la question dit « Le matériel de « Téléphone » remplace celui de cet ordinateur pour … » et « Les sessions gardent leur matériel. »', qr.length === 1 && /^Le matériel de « Téléphone » remplace celui de cet ordinateur pour .+ : .+\. Les sessions gardent leur matériel\.$/.test(qr[0]), JSON.stringify(qr));
    check('d. la question nomme les activités touchées (Wingfoil, Kite)', /pour Wingfoil, Kite : /.test(qr[0] ?? '') || /pour Wingfoil/.test(qr[0] ?? ''), qr[0]);
    check('d. la question liste ce qui part et ce qui vient (+ « Voile M », − « Voile S »…)', /\+ [^;]+/.test(qr[0] ?? '') && /− [^;]+/.test(qr[0] ?? ''), qr[0]);
    check('d. refusée : le fichier de l\'ordinateur n\'a pas changé', readFileSync(c.pc, 'utf8') === avantReprise);
    await reponseConfirm(b, true);
    check('d. clic « Reprendre le matériel » (accepté)', (await b.clickText('Reprendre le matériel', '.set-files-list button')) === 'ok');
    await b.waitFor(`/Matériel repris de « Téléphone »\\./.test(document.body.innerText)`, { timeout: 10000, label: 'message « Matériel repris »' });
    check('d. « Matériel repris de « Téléphone ». » est dit', true);
    await b.waitFor(() => materielDe(c.pc, 'wingfoil') === materielDe(c.tel, 'wingfoil'), { timeout: 9000, label: 'matériel de l\'ordinateur = celui du téléphone' });
    console.log(`  fichier de l'ordinateur après la reprise : Wingfoil ${materielDe(c.pc, 'wingfoil')} ; Kite ${materielDe(c.pc, 'kite')} ; Pumping ${materielDe(c.pc, 'a-pumping')}`);
    check('d. le matériel de Wingfoil, de Kite et de Pumping est celui du fichier de l\'autre appareil (noms)', ['wingfoil', 'kite', 'a-pumping'].every((a) => materielDe(c.pc, a) === materielDe(c.tel, a)), JSON.stringify(['wingfoil', 'kite', 'a-pumping'].map((a) => [materielDe(c.pc, a), materielDe(c.tel, a)])));
    check('d. le fichier de l\'autre appareil n\'a pas bougé', readFileSync(c.tel, 'utf8') === telAvant);
    check('d. les fiches de sessions sont identiques à l\'octet', empreinteFichiers(sessionsDe(c.memoire)) === FICHES_AVANT);
    await b.wait(600);
    m = await bloc(b);
    check('d. « Reprendre le matériel » a disparu de la ligne « Téléphone » (les listes sont les mêmes), « Reprendre » reste', JSON.stringify(m.lignes.find((l) => l.nom === 'Téléphone')?.boutons) === JSON.stringify(['Reprendre']), JSON.stringify(m.lignes.find((l) => l.nom === 'Téléphone')?.boutons));
    check('d. clic « Comparer le matériel » après la reprise', (await ouvrirFenetre(b)) === 'ok');
    f = await fenetre(b);
    check('d. Wingfoil : « Les deux listes sont les mêmes. », toutes les rangées « = », « rien à changer. » en bas', f?.phrases.includes('Les deux listes sont les mêmes.') && f.lignes.flatMap((l) => l.rangees).every((r) => r.genre === '=') && f.resume === 'Pour le téléphone : rien à changer.', JSON.stringify([f?.phrases, f?.resume]));
    check('d. Kite : lui aussi tout en « = »', (await choisirActivite(b, 'Kite')) === 'ok' && (await fenetre(b))?.lignes.flatMap((l) => l.rangees).every((r) => r.genre === '='));
    await capturer(b, 'materiel-apres-reprise');
  });
  check('c, d. l\'ordinateur n\'a écrit que son propre fichier : reglages/ = pc.json et telephone.json', readdirSync(join(c.memoire, 'reglages')).sort().join(',') === 'pc.json,telephone.json');
} catch (e) {
  check(`script interrompu : ${e.stack ?? e.message}`, false);
} finally {
  // Un programme resté ouvert par une erreur : seuls ceux que ce script a lancés sont tués.
  for (const pid of lances) if (vivant(pid)) spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
  await pause(800);
  rmSync(RACINE, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 });
}

console.log(echecs === 0 ? `\nTout passe (${controles} contrôles).` : `\n${echecs} échec(s) sur ${controles} contrôles.`);
process.exit(echecs === 0 ? 0 : 1);
