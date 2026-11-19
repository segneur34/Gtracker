# 447 · Programme Windows : le téléphone branché par câble et le bouton « Récupérer »

Modèle | Réflexion : Opus | high

## Tel que dit par l'utilisateur

- 18/11 : « pour une version numéro 1, on va valider la version facile. Avec un message clair qui explique ce qui doit être fait sur le téléphone. »
- 19/11, après les essais sur le PC : « il faudrait un moyen simple de synchroniser avec le téléphone, genre un bouton synchronisé à côté du bouton enregistrer. »
- 19/11, sur le débogage USB (question Q134) : « oui mais sur les autres tel ce sera pas le cas » : la première version passe par le débogage USB de son téléphone, en sachant que les téléphones des acheteurs ne l'auront pas (le « Transfert de fichiers » est l'élément 452).
- 19/11 au soir : « ça fait un moment que le lot 447 traîne […] au moins le commencer pour avoir une base de travail pour demain. »

## Étude

`docs/backlog/445-exe-etude-cable.md` : le canal du débogage USB (§2), le conflit avec un adb déjà lancé (§2.3), l'interface commune « dossier du téléphone » (§7), les messages à montrer (§8). Sa dernière section donne le résultat du premier geste, fait le 19/11 sur le Xiaomi : le canal marche en « charge seule », `adb pull -a` garde les dates à la seconde, la date se lit par `stat -c %Y`.

## Voulu

1. Dans le processus principal du programme Windows (`bureau/`), un « dossier distant » : une interface (états, lister avec taille et date, lire vers un fichier local en gardant la date), que les autres canaux reprendront (Transfert de fichiers, Wi-Fi), et sa première mise en œuvre par le débogage USB. Cette version ne fait que lire : rien n'est écrit, renommé ni retiré sur le téléphone.
2. `adb.exe` n'est pas embarqué (licence : §6 de l'étude, point 4) : le programme le cherche sur le poste (PATH, variables `ANDROID_HOME` et `ANDROID_SDK_ROOT`, `%LOCALAPPDATA%\Android\Sdk\platform-tools`, un dossier à côté de la mémoire du programme) et dit clairement quoi faire s'il ne le trouve pas. Jamais de `kill-server` ; les noms passent par un tableau d'arguments, jamais par une chaîne de commande.
3. Dans le programme Windows seulement, un bouton « Récupérer » en haut, à côté de « Enregistrer ». Il lit le dossier `Documents/Gtracker` du téléphone et range sur le PC, par l'import qui existe déjà (celui de « Ajouter les sessions d'un dossier »), les sessions que le PC n'a pas encore ; il dit combien ont été ajoutées et combien y étaient déjà.
4. Un message clair pour chaque état où le téléphone n'est pas prêt : rien de branché, débogage USB à activer, autorisation à accepter sur le téléphone, adb introuvable, autre programme qui tient la liaison (textes de départ au §8 de l'étude, par `t`, trois langues).
5. Débranchement en cours de route : ce qui est déjà rangé reste, rien n'est à moitié écrit, le message le dit.

## Hors du lot

Itinéraires, réglages, FC repos et lieux ; toute écriture ou suppression sur le téléphone ; la corbeille (448) ; la synchronisation dans les deux sens (449), où le bouton deviendra « Synchroniser » ; le sans-fil (450) ; le Transfert de fichiers (452).

## Contraintes

- Règle 12 de `CLAUDE.md` : hors de `src/platform/`, ni pont de la coquille (`gtrackerBureau`) ni API de fichiers ; le bouton ne se montre que dans le programme Windows.
- `docs/DECISIONS.md` §8 (mémoire et fichiers) et §11 (barres, navigation) ; charte §12.
- Pas de maquette : la place du bouton est donnée par l'utilisateur, les messages sont du texte ; l'essai sur le PC dira si la forme convient.
- Tests sans téléphone : l'interface a une mise en œuvre de test (dossier local ou faux adb), l'analyse des sorties d'adb est du calcul pur avec ses tests.

## Plan (agent Plan, 19/11, relu par l'orchestrateur)

Trois parties, trois agents, trois commits : A, la coquille (`bureau/` seul, rien dans `src/`) ; B, la page ; C, le banc sur le vrai programme.

Tranché par l'orchestrateur, l'utilisateur absent (à lui redire, il peut en changer à l'essai) :
- le résultat et les messages se disent dans une fenêtre qui s'ouvre au clic, pas dans le bandeau de la page Sessions, qu'on ne voit pas depuis le Profil ;
- fenêtre étroite (barre du bas) : pas de bouton « Récupérer », puisqu'il est placé en haut ;
- le dossier du téléphone est `Documents/Gtracker` seulement, avec un message s'il n'y est pas, sans réglage du chemin.

### Contrat entre la coquille et la page (figé, pour que A et B ne dépendent pas l'une de l'autre)

Trois canaux, aux réponses `Reponse<T>` de `bureau/pont.ts` : `telephone:etat`, `telephone:lister`, `telephone:lireOctets({chemin})`.
- États : `pret{nom}`, `absent`, `autorisation`, `horsLigne`, `adbIntrouvable{dossier}`, `occupe`.
- `lister` rend `{chemin, taille, dateMs}`, chemins relatifs à `Documents/Gtracker`, pour les fichiers de la racine et de `sessions/` seulement ; dossier absent : code `NOT_FOUND`.
- `lireOctets` n'accepte qu'un chemin rendu par le dernier `lister` (la page ne peut pas désigner un fichier quelconque du téléphone) ; les octets reviennent par l'IPC, le fichier temporaire est effacé.

### Partie A : la coquille

À créer : `bureau/telephone.ts` (l'interface « dossier distant », sans Electron : `etat()`, `lister()`, `lire(chemin, fichierLocal)`, rien pour écrire ; une mise en œuvre « dossier local » pour les tests et le banc ; `gestionnairesTelephone(dossier, dossierTemp)` sur le modèle de `gestionnairesMemoire`), `bureau/adb.ts`, `bureau/telephone.test.ts`, `bureau/adb.test.ts`. À modifier : `bureau/main.ts` (branchement et variables d'essai), `bureau/preload.ts` (objet `telephone`), `bureau/pont.test.ts` (noms de canaux égaux).

`bureau/adb.ts` :
- recherche de `adb.exe`, dans l'ordre : PATH, `%ANDROID_HOME%` et `%ANDROID_SDK_ROOT%` (`\platform-tools`), `%LOCALAPPDATA%\Android\Sdk\platform-tools`, puis `platform-tools` dans le profil du programme et à côté de `Gtracker.exe` ; le message « adb introuvable » donne le dossier du profil comme endroit où le poser ;
- lancement par `execFile(adb, [tableau], {windowsHide, timeout, maxBuffer})`, sans shell ni chaîne de commande ; lanceur injectable pour les tests ;
- liaison tenue par un autre : avant toute commande qui parle au serveur, une sonde TCP sur 127.0.0.1:5037 (ou `ANDROID_ADB_SERVER_PORT`) envoie `host:version`, délai 1 s, et compare à la version de notre `adb version` (qui ne touche pas le serveur) ; pas de serveur : `adb start-server` ; même version : on s'y joint ; autre version ou réponse étrangère : état `occupe`, aucune commande lancée ; jamais de `kill-server` ;
- états lus dans `devices -l` par une fonction pure : `device` → `pret` (nom tiré de `model:`), `unauthorized` → `autorisation`, `offline` → `horsLigne`, rien → `absent` ; premier appareil prêt, `-s <série>` sur toutes les commandes ;
- listage en une commande : `shell find /sdcard/Documents/Gtracker -maxdepth 2 -type f -exec stat -c '%s %Y %n' {} +`, texte fixe où aucun nom venu de la page ne passe ; repli si `find … -exec … +` manque sur le téléphone : `stat` sur les deux motifs `*` ;
- lecture : `pull -a <distant> <dossierTemp>\<n>.gtracker-tmp` (protocole de synchronisation, sûr pour les accents), puis taille comparée à celle du listage ; si elle diffère, fichier effacé et lecture en échec ;
- délais : 5 s pour version et appareils, 15 s pour `start-server`, 20 s pour le listage, 20 s plus 1 s par Mo pour un fichier ; une commande à la fois, en file ;
- dossier temporaire `<profil>\telephone-lecture`, vidé à chaque `lister` et au démarrage, jamais dans la mémoire.

À réutiliser : `bureau/pont.ts` (`enReponse`, `uneALaFois`, `brancherCanaux`, `expediteurAdmis`), `bureau/disque.ts` (`segmentAdmis`, `ErreurDisque`, `estTemporaire`), le modèle de `optionsDepuisEnvironnement` (`bureau/memoire.ts`).

Variables lues en mode d'essai seulement : `GTRACKER_BANC_TELEPHONE` (dossier local qui joue le téléphone), `GTRACKER_BANC_TELEPHONE_ETAT` (état imposé), `GTRACKER_BANC_TELEPHONE_COUPURE` (débranché après n lectures).

Tests : lecture de `devices -l`, de `adb version`, de la réponse `host:version` (`OKAY0004001f`), du listage `stat` (noms à espaces et accents, préfixe retiré, `..` refusé) ; ordre de recherche d'adb sur un faux système de fichiers ; faux lanceur pour chaque état, le délai dépassé, la taille fausse, et `kill-server` jamais émis.

### Partie B : la page

À modifier : `src/platform/desktopBridge.ts` (types `DesktopPhoneBridge`, `telephone?` facultatif : une coquille ancienne n'a pas de bouton), `src/components/AppShell.tsx` (bouton dans `shell-topactions`, avant « Enregistrer »), `src/locales/en.json`, `src/locales/es.json`.
À créer : `src/platform/phoneCable.ts` (`phoneCableAvailable()`, `phoneState()`, `phoneImportEntries()` avec le drapeau de débranchement) et son test ; `src/library/phoneRecovery.ts` (choix pur des fichiers et compte « déjà là ») et son test ; `src/hooks/sessionLibrary/phoneRecovery.ts` (`recoverFromPhone()`) ; `src/components/PhoneRecoverButton.tsx` et son `.css`.

- `recoverFromPhone()` : vérifie `canImportSessions`, demande l'état, liste le téléphone et `lib.folder.list('sessions')`, fait le choix, lance `importEntries(entries, {fromFolder: true, quiet: true})` (`src/hooks/sessionLibrary/importer.ts`), ajoute les sautées à `report.duplicates`, puis `describeImport` (`src/library/importReport.ts`).
- Les `ImportEntry` lisent à la demande : `readBytes` appelle `telephone:lireOctets`, `readText` décode en UTF-8. L'écriture sur le PC reste celle de la mémoire (fichier temporaire puis renommage) : rien n'est écrit à moitié.
- Ce que le PC a déjà : une session dont le GPX a le même nom et la même taille dans `sessions/` du PC, et dont le `.imu` est absent ou identique lui aussi, est comptée « déjà là » sans être lue ; tout le reste passe par la mise à l'écart habituelle de `addGpx` (heure de départ).
- Débranchement : à la première lecture en échec, la page redemande l'état ; si le téléphone n'est plus prêt, les lectures suivantes échouent tout de suite ; message propre à ce cas (ce qui est rangé reste, rebrancher puis « Réessayer »).
- Interface : bouton secondaire, contour et texte à l'encre (pas le vert vif, §12) ; il ouvre `components/ui/Dialog.tsx` : « Recherche du téléphone… », puis le message d'état avec « Réessayer », la progression (« 12 fichiers sur 50 »), enfin le compte rendu.
- Textes : ceux du §8 de l'étude (absent, autorisation, liaison occupée, autorisation expirée), plus adb introuvable (télécharger « SDK Platform-Tools » chez Google et poser `platform-tools` dans le dossier donné), téléphone hors ligne, dossier `Documents/Gtracker` absent, débranché en cours de route.
- À réutiliser : `canImportSessions`, `folderImportPaths` (`src/platform/memoryFolder.ts`), `isDesktopApp` (`src/platform/runtime.ts`), `t` / `tn`, `Button` ; stub de `window.gtrackerBureau.telephone` dans les tests, sur le modèle de `src/platform/memoryFolder.disk.test.ts`.

### Partie C : le banc

`outils/banc/exe-recuperer.mjs`, hors registre comme `outils/banc/memoire-disque.mjs` (qui lance déjà le vrai programme en mode d'essai), et `outils/banc/SCRIPTS.md`. Programme refait par `npm run exe`. Cas : chaque état imposé et le texte de son message ; trois sessions synthétiques, « 3 ajoutées » ; second clic, « 3 déjà là » ; coupure après deux lectures : message de débranchement, sessions entières sur le disque, aucun temporaire dans la mémoire, téléphone factice intact (tailles et dates). Dans Chrome : bouton absent, barre du haut inchangée.

### Ce que seul le vrai téléphone confirmera

1. La commande `find … -exec stat {} +` sur le Xiaomi (le 19/11 au soir, le téléphone était débranché quand elle a été essayée).
2. L'adb du poste trouvé et partagé sans conflit avec celui qui installe les APK (version 37.0.1 sur ce poste).
3. L'état « autorisation à accepter » vu, et son message.
4. Le temps pour 50 sessions, au premier clic puis au second.
5. Le câble tiré pendant la récupération.

## Essai (sur le PC, téléphone branché)

Programme Windows refait, téléphone branché : « Récupérer » range les sessions du téléphone absentes du PC et dit combien ; téléphone débranché : le message dit quoi faire.
