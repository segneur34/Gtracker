# 446 · Plan : dans le .exe, la mémoire dans un vrai dossier du disque

Plan du 18/11/2026, fait par l'agent de plan, confronté aux décisions par l'orchestrateur. Référence de détail : `445-exe-etude-coquille.md` (§1, §2.3, §3.5, §4.2, « Lot B ») ; ce plan prime là où il la contredit.

La coquille du 445 sert `dist/` sous `https://gtracker.localhost` ; toutes les branches navigateur de `src/platform/` y marchent déjà. Le lot ajoute une quatrième sorte de mémoire, `disk` : le processus principal lit et écrit le dossier, la page y passe par un pont étroit. `isNativeApp()` garde son sens « téléphone ». Rien ne change pour le navigateur ni pour l'APK.

## 1. Le choix entre navigateur, téléphone et ordinateur

- `src/platform/runtime.ts` : `isDesktopApp()` (vrai si `window.gtrackerBureau?.memoire` existe) et `appShell()` (`'navigateur' | 'telephone' | 'ordinateur'`).
- Nouveau `src/platform/desktopBridge.ts` : le type du pont et `desktopBridge()` (`null` hors du .exe) ; seul fichier qui lit `window.gtrackerBureau`.
- Nouveau `src/platform/diskMemory.ts` : `createDiskFolder(racine: 'memoire' | 'candidat')`, erreurs refaites en `Error` avec un `code` lisible par `fileErrorCode` et `plainError`.
- `memoryFolder.ts` : `MemoryKind` gagne `'disk'` ; branche `isDesktopApp()` dans `openMemoryFolder`, `chooseMemoryFolder`, `reconnectMemoryFolder` (rouvre simplement), `isFolderDesignated`, `forgetChosenFolder`, `canChooseFolder` ; nouveau `desktopMemoryPlace()` (chemin et OneDrive, pour l'écran) ; `pendingFolder` reste `null`, `browserMemoryCopy` inchangé.
- Les autres modules de `platform/` restent sur leur version navigateur.
- Hors de `platform/` : `hooks/sessionLibrary/lifecycle.ts` (variante « Documents » de `chooseFolder` ; la recopie depuis l'OPFS reste réservée à `previous.kind === 'browser'`), `reset.ts` (`picked || disk` pour `browserMemoryCopy`), `components/MemoryStatus.tsx` (branches de la sorte `disk`).

## 2. Le pont

- Canaux par `ipcMain.handle`, préfixe `memoire:` ; servis seulement si `e.sender === fenetrePrincipale.webContents` et `estDeLApplication(e.senderFrame.url)` (`origine.ts`) ; types des arguments vérifiés.
- Pas d'exception à travers le pont : `{ok:true, valeur}` ou `{ok:false, code, message}` ; codes `NOT_FOUND`, `PERMISSION`, `NO_SPACE`, `UNKNOWN`.
- Gestion : `ouvrir()` → `{etat:'aucun'}` ou `{etat:'pret'|'introuvable'|'illisible', chemin, oneDrive}` ; `proposer()` → `{chemin, oneDrive}` ; `choisir({titre, documents})` → `null` ou `{nom, noms[], oneDrive}`, pose le dossier comme candidat ; `adopter({descendre})` crée si besoin, retient, rend `{chemin, oneDrive}` ; `oublier()`.
- Fichiers, sur `{racine, chemin}` : `lister`, `lireTexte`, `lireOctets`, `stat`, `ecrireTexte`, `ecrireOctets`, `effacer`. Le candidat est en lecture seule : les règles de la page (`isMemorySubfolder`, `shouldDescendIntoMemory`, refus du dossier de l'ancienne application) s'y appliquent avant `adopter`. `descendre` ne vaut que pour le nom fixe `Gtracker`.
- Chemins, nouveau `bureau/disque.ts` (Node pur, testable) : chemin relatif découpé sur `/` ; refusés : segment vide, `.`, `..`, `\`, `:`, `<>"|?*`, caractères de contrôle, point ou espace final, noms réservés de Windows, lettre de lecteur, chemin absolu, suffixes `.gtracker-tmp` et `.gtracker-new` ; le chemin résolu reste sous la racine. La page ne donne jamais de chemin absolu.
- Écriture atomique, même convention que le greffon Android (`MemoryFolderPlugin.java`) : fichier existant écrit sous `nom.gtracker-tmp`, neuf sous `nom.gtracker-new`, forcé sur le disque puis renommé ; 5 nouveaux essais courts sur `EPERM`, `EBUSY`, `EACCES` ; temporaire effacé en cas d'échec ; écritures en file par chemin.
- Temporaires orphelins, réparés par `lister` comme sur Android : `.gtracker-new` seul effacé ; `.gtracker-tmp` à côté de l'original effacé ; `.gtracker-tmp` seul reprend son nom. Jamais dans le listage.
- Octets en `Uint8Array`, texte en UTF-8, BOM de tête retiré par `lireTexte` ; pas de plafond de taille ; dates : `mtimeMs` arrondi.
- Nouveau `bureau/memoire.ts` : dossier retenu, canaux, variables d'essai. `preload.ts` expose une fonction par canal, jamais `ipcRenderer` tel quel.

## 3. Le premier lancement

- `ouvrir()` répond `aucun`, la page passe en `unavailable`, et la carte Mémoire existante du Profil montre « Dossier proposé : … », « Utiliser ce dossier » (bouton principal) et « Choisir un autre dossier » (fenêtre de Windows ouverte par le processus principal). Rien n'est écrit avant le clic.
- Choix retenu dans `%APPDATA%\Gtracker\coquille.json` (dossier de profil, hors du dossier mémoire), écrit de façon atomique.
- OneDrive : chemin sous `%OneDrive%`, `%OneDriveConsumer%` ou `%OneDriveCommercial%` (fonction pure, testée) ; avertissement sous la proposition et dans Réglages › Mémoire tant que le dossier y est.
- Dossier disparu ou illisible : jamais recréé ; état existant `needs-permission` ; texte « introuvable », « Réessayer » et « Choisir un autre dossier ».
- Dossier qui contient déjà une mémoire (copie du `Documents/Gtracker` du téléphone) : même format, il s'ouvre tel quel, avec descente dans `Gtracker` si le parent est désigné ; le .exe y écrit `reglages/PC.json` et propose les réglages du téléphone par le bandeau existant.

## 4. Mémoire du navigateur du .exe (essais du 445)

Ignorée : ni recopiée, ni effacée. « Tout supprimer » l'efface quand même. « Revenir à la mémoire du navigateur » est masqué à l'ordinateur.

## 5. Textes

Par `t`, avec `en.json` et `es.json` : la phrase d'explication de la carte, « Dossier proposé : {dossier} », « Utiliser ce dossier », « Choisir un autre dossier », le titre de la fenêtre de Windows, la phrase OneDrive, « Le dossier {dossier} est introuvable : déplacé, renommé ou sur un disque débranché. Rien n'est recréé à sa place. », « Réessayer », « Le dossier {dossier} ne se lit pas : {detail} », l'aide d'emplacement de la sorte `disk`. La question de fermeture de la coquille et ses deux boutons sont traduits dans ce lot : la page les passe par un canal `coquille:textes` au démarrage et au changement de langue. Pas d'écran neuf, pas de maquette : des branches de texte dans la carte Mémoire existante, aucun `style={{` ajouté.

## 6. Gardes et tests

- `src/architecture.test.ts` : `gtrackerBureau` entre dans `PLATFORM_ONLY`. `src/heritage.test.ts` : `FOLDERS` s'étend à `bureau/` (sans `node_modules`, `dist`, `sortie`).
- `bureau/disque.test.ts` sur un vrai dossier temporaire : chemins refusés, remplacement atomique, orphelins réparés, `stat` et effacement d'un absent, octets relus à l'identique, BOM, OneDrive. `bureau/memoire.test.ts` : `coquille.json` abîmé, expéditeur refusé, candidat en lecture seule.
- `src/platform/memoryFolder.disk.test.ts` : faux pont branché sur `bureau/disque.ts` ; ouvrir aucun, introuvable, prêt ; choix avec descente ; refus d'un sous-dossier ; refus du dossier de l'ancienne application, qui laisse retenu le dossier d'avant ; suite de contrat commune à `disk` et à `createFakeFolder`.

## 7. Preuve au banc

- En mode d'essai seulement, le .exe lit `GTRACKER_MEMOIRE` (dossier retenu d'avance), `GTRACKER_DOCUMENTS` (remplace Documents) et `GTRACKER_BANC_DOSSIER` (réponse de la fenêtre de choix). `records()` de `lib/cdp.mjs` lit le disque par Node si `GTRACKER_MEMOIRE` est posée.
- Script neuf `memoire-disque.mjs` : (a) profil vide, la carte, « Utiliser ce dossier », import d'un GPX synthétique ; sur le disque `gtracker.json`, `LISEZMOI.txt`, `reglages/PC.json`, `sessions/*.gpx` et `.json`, aucun `.gtracker-*`, `coquille.json` porte le chemin ; second lancement : même liste, même texte ; (b) dossier renommé : carte « introuvable », rien recréé ; nom remis, « Réessayer » ; (c) mémoire synthétique façon téléphone (GPX sans fiche) : fiches créées ; (d) un `.gtracker-tmp` et un `.gtracker-new` déposés, « Mettre à jour » : réparés.
- Neutralité : `PASSAGE_COURANT` sous Chrome avant et après, identique ; le même passage sur le .exe comparé au relevé de la partie B du 445, libellé de la mémoire masqué.

## 8. Parties

- **A (Opus/high)** : `bureau/disque.ts`, `memoire.ts`, `preload.ts`, `main.ts` et leurs tests. Vérification : Vitest sur `bureau/`, `tsc -p bureau`, `verif --rapide`, relecture sur la sécurité du pont.
- **B (Opus/high)** : `platform/` (`runtime`, `desktopBridge`, `diskMemory`, `memoryFolder`), `lifecycle`, `reset`, `MemoryStatus`, dictionnaires, gardes. Vérification : `npm run verif`, neutralité sous Chrome.
- **C (Sonnet/high)** : le banc sur le .exe (point 7).

## Tranché par l'orchestrateur (18/11), à redire à l'utilisateur

- Dossier proposé : `Documents\Gtracker` ; si Documents est dans OneDrive, `C:\Users\<nom>\Gtracker`, hors OneDrive, avec la phrase qui dit pourquoi (OneDrive et les renommages atomiques se gênent). L'utilisateur garde « Choisir un autre dossier ».
- Dossier introuvable au lancement : jamais recréé (un disque débranché ne doit pas donner une mémoire vide à part).
- La mémoire du navigateur du .exe d'essai du 445 est ignorée : aucune vraie session n'y a été rangée.
- Variables d'essai réservées à `GTRACKER_BANC` ; nom `coquille.json` ; forcer sur le disque avant le renommage ; pas de plafond de taille ; « Ouvrir dans l'Explorateur » renvoyé au 451 ; « Revenir à la mémoire du navigateur » masqué à l'ordinateur ; un rejeu de GPX avant le choix du dossier est refusé avec la phrase existante.

## Contrat du pont (partie A)

`window.gtrackerBureau` (gelé) : `version` (texte), `memoire` (ci-dessous), `textes({question, detail, quitter, rester})` (quatre textes non vides, 500 caractères au plus ; sinon refusé et la coquille garde les siens). Chaque fonction rend une promesse de `{ok:true, valeur}` ou `{ok:false, code, message}` et ne rejette jamais pour une erreur du disque. Codes : `NOT_FOUND`, `PERMISSION`, `NO_SPACE`, `UNKNOWN` (chemin refusé et message mal formé compris) ; `message` est une phrase française technique, à passer par `plainError` d'après le code.

Gestion (`memoire.`) :
- `ouvrir()` → `{etat:'aucun'}` | `{etat:'pret'|'introuvable', chemin, oneDrive}` | `{etat:'illisible', chemin, oneDrive, code, detail}`. Relit `coquille.json` : absent, ou JSON abîmé, donne `aucun` (la copie abîmée est mise de côté sous `coquille-abimee-<date>.json` au prochain `adopter`, jamais écrasée) ; BOM toléré ; fichier tenu par un autre programme relu après quelques essais, puis `illisible` avec **`chemin: null`** (dossier retenu inconnu) : la page ne doit alors rien proposer à neuf (pas de « Dossier proposé ») mais dire que le réglage ne se lit pas et offrir « Réessayer » ; `adopter` et `oublier` y sont refusés tant qu'il ne se lit pas. Ne crée rien.
- `proposer()` → `{chemin, oneDrive, documentsOneDrive}` ; pose ce dossier comme candidat (il peut ne pas exister : le candidat absent se lit vide).
- `choisir({titre?, documents?})` → `null` (renoncement, candidat d'avant gardé) | `{chemin, nom, noms[], oneDrive}` ; pose le candidat. Une seule fenêtre à la fois : un appel pendant qu'elle est ouverte reçoit la même réponse. La fenêtre part du dossier retenu, ou de Documents si `documents: true` ou rien de retenu. `noms` sans les temporaires.
- `adopter({descendre?})` → `{chemin, oneDrive}` : retient le candidat (ou `candidat\Gtracker` si `descendre`), crée ce seul dossier s'il manque (parent absent : `NOT_FOUND`), écrit `coquille.json`, vide le candidat. Sans candidat : `NOT_FOUND`.
- `oublier()` → `null` : plus rien de retenu, le dossier n'est pas touché.

Fichiers, `{racine:'memoire'|'candidat', chemin}`, chemin relatif en `/` (les règles du §2 ; `''` seulement pour `lister`) :
- `lister` → `[{name, kind:'file'|'directory', size, mtimeMs}]` (forme `FolderEntry`) ; sous-dossier absent : `[]` ; racine retenue absente : `NOT_FOUND`. Répare les temporaires (pas dans le candidat, où ils sont seulement tus).
- `lireTexte` → texte (UTF-8, BOM retiré) | `null` ; `lireOctets` → `Uint8Array` | `null` ; `stat` → `{size, mtimeMs}` | `null` (dossier : `null`).
- `ecrireTexte({…, texte})`, `ecrireOctets({…, octets: Uint8Array})`, `effacer` → `null`. Sous-dossiers créés, jamais la racine (absente : `NOT_FOUND`). Effacer retire aussi les temporaires du fichier ; un absent : rien ; un dossier : refusé. Sur `candidat` : `PERMISSION`.
- Aucun dossier retenu (racine `memoire`) ou aucun candidat : `NOT_FOUND`.

Faux pont de test : `creerMemoire(options)` de `bureau/memoire.ts` a exactement les méthodes et réponses de `gtrackerBureau.memoire` (même logique que le .exe, sur de vrais dossiers temporaires) :

```ts
const tmp = await mkdtemp(path.join(tmpdir(), 'gtk-'))   // profil, documents, maison dedans
let choix: string | null = null                          // réponse de la « fenêtre de Windows »
const memoire = creerMemoire({ profil, documents, maison, env: {}, choisirDossier: async () => choix })
vi.stubGlobal('window', { gtrackerBureau: { version: '0.0.0', memoire, textes: async () => ({ ok: true, valeur: null }) } })
```

`env` porte les variables OneDrive pour essayer l'avertissement (`{ OneDrive: documents }`).

## Partie B : ce qui est fait

- `platform/runtime.ts` (`isDesktopApp`, `appShell`), `platform/desktopBridge.ts` (type du pont, `desktopBridge()`, `sendCloseQuestionTexts`), `platform/diskMemory.ts` (`createDiskFolder`, `bridgeValue`, `callDiskMemory`), `memoryFolder.ts` (sorte `disk`, `desktopMemoryPlace()`, `DesktopChoiceStart` : `window`, `documents`, `proposed`).
- États : `aucun` → `unavailable` et place `none` (dossier proposé lu par `proposer`) ; `pret` → `ready`, libellé = chemin complet ; `introuvable` → `needs-permission`, place `missing` ; `illisible` (ou `ouvrir` en échec) → `needs-permission`, place `unreadable` (chemin `null` : seul « Réessayer »).
- `lifecycle.chooseFolder(desktop)` ; « Réessayer » = `reconnectFolder`, qui relit l'état (`openLibrary`) s'il échoue ; `reset.ts` efface aussi la mémoire du navigateur du programme ; `boot.tsx` passe les textes de fermeture au démarrage (la langue ne change qu'au rechargement).
- Carte Mémoire : branches `unavailable`, `needs-permission` et `ready` (détaillée) de la sorte `disk` ; « Revenir à la mémoire du navigateur » jamais montré au programme.
- Textes neufs (15) : « Dossier mémoire de Gtracker » ; « Le dossier {dossier} est introuvable : déplacé, renommé ou sur un disque débranché. Rien n'est recréé à sa place. » ; « Le réglage du programme qui retient le dossier mémoire ne se lit pas : {detail} » ; « Le dossier {dossier} ne se lit pas : {detail} » ; « Ce dossier est dans OneDrive, qui peut gêner l'enregistrement des fichiers : un dossier hors de OneDrive est plus sûr. » ; « Gtracker garde vos sessions dans un dossier de ce PC, que vous pouvez copier pour les sauvegarder ou les passer au téléphone. Rien n'y est écrit avant « Utiliser ce dossier ». » ; « Dossier proposé : {dossier} » ; « Vos Documents sont dans OneDrive, qui peut gêner l'enregistrement des fichiers : le dossier proposé est hors de OneDrive. » ; « Utiliser ce dossier » ; « Choisir un autre dossier » ; « Pour sauvegarder vos sessions ou les passer au téléphone, copiez ce dossier entier. Changer de dossier ne déplace rien : la mémoire devient celle du dossier choisi. » ; « Quitter sans enregistrer ? » ; « Les modifications de la session ouverte ne sont pas enregistrées. » ; « Quitter » ; « Rester ». Repris : « Réessayer », « Aucun dossier mémoire choisi. », « Emplacement : {dossier}, sur ce PC. », « Changer de dossier ».
- Gardes : `gtrackerBureau` dans `PLATFORM_ONLY` ; `heritage.test.ts` lit `bureau/` ; `mainImports.test.ts` admet `platform/desktopBridge.ts` (importé par `runtime.ts`, sans texte). Tests : `memoryFolder.disk.test.ts` (15, sur le vrai `bureau/memoire.ts`). Reste : la carte d'INVENTAIRE (deux fichiers neufs), la partie C. Typage : `bureau/*.ts` emploie les types de Node, absents du projet de `src/` ; un test de `src/` ne peut pas l'importer par un `import` littéral (même `import type`) sans casser le typecheck : déclarer le type du pont dans `desktopBridge.ts` et charger `bureau/memoire.ts` par un `import()` dont le chemin est une variable, typé par ce type.
