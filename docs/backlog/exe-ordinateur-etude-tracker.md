# Un .exe pour l'ordinateur et la récupération des sessions du téléphone

Étude menée le 12/11/2026 dans le dépôt Tracker (l'autre application), où elle porte le n° 217 du reste à faire. Rien n'a été codé, ni dans Tracker ni ici. Cette fiche en garde la conclusion pour Gtracker.

Sources restées dans Tracker (`c:\Users\segne\tracker\docs\backlog\`) : `217-exe-ordinateur.md` (la fiche), `217-exe-recherche-coquilles-mtp.md` et `217-exe-recherche-diffusion.md` (les deux recherches documentaires). La conversation est dans `C:\Users\segne\.claude\projects\c--Users-segne-tracker\d6327618-456a-4fa4-8291-09795e94a259.jsonl`.

## Le besoin

Faire de l'application un .exe utilisable sur ordinateur, pour deux raisons : préparer le travail de l'autre application, et récupérer plus facilement les sessions du téléphone branché par un bouton, sans réseau, avec les autorisations demandées une première fois.

## Conclusion

Un .exe est faisable sans rien recoder. L'application compilée pèse 3 Mo et tourne déjà dans deux coquilles (navigateur, Android) ; le .exe serait une troisième coquille autour du même code.

### 1. La coquille : Electron

| | Electron | Tauri | Recoder dans un autre langage |
|---|---|---|---|
| Principe | embarque son propre Chrome | utilise le moteur web déjà dans Windows | tout réécrire |
| Poids de l'installeur | environ 100 Mo | environ 10 Mo | variable |
| Langage ajouté | aucun | Rust | un second code complet |
| À installer sur le poste | rien | Rust et les outils Microsoft, plusieurs Go | selon le langage |
| Rendu | le même partout, celui du banc | dépend de la version d'Edge | à refaire |

- Electron retenu pour commencer. Un .exe d'essai s'est fabriqué en 15 secondes, sans droits d'administrateur, et ouvre l'application telle quelle (pages, cartes), sans erreur.
- Sa mémoire est un vrai dossier du disque, garanti, là où Firefox refuse de garantir la sienne.
- Défaut : le poids. Programme de 360 Mo non compressé, installeur d'environ 100 Mo (lu, non mesuré), près de 400 Mo de mémoire vive.
- Le greffon tout fait Capacitor vers Electron est à l'abandon : la coquille s'écrit à la main, c'est peu de chose.
- Tauri reste possible plus tard : le cas « ordinateur » dans le code et la synchronisation resteraient valables, seule la coquille serait à refaire.
- Recoder est écarté : deux codes à tenir d'accord pour toujours.

### 2. Le canal vers le téléphone, sans réseau

- **Débogage USB (le canal des APK).** Autorisation donnée une fois (« Toujours autoriser cet ordinateur ») ; elle peut être redemandée après 7 jours sans branchement, sauf option à cocher sur le téléphone. Rapide et fiable : la mémoire entière (146 fichiers, 69 Mo) se copie en 11 secondes, et un listage de 126 fichiers prend un dixième de seconde. Exige les options pour développeurs, donc exclu pour un acheteur.
- **« Transfert de fichiers » (canal de l'Explorateur Windows).** Sans réglage spécial, sur tout téléphone, donc le seul présentable dans une application vendue. Android demande de le choisir à chaque branchement (non contournable) ; le Xiaomi de l'utilisateur revient en « charge seule » à chaque fois. Plus lent, parfois en retard sur les fichiers récents (point à vérifier sur le vrai téléphone), et demande un petit programme propre à Windows, quelle que soit la coquille.
- **Lien direct par le câble entre les deux applications.** Demande un pilote Windows : écarté.
- Recommandation : écrire la synchronisation sur un « dossier du téléphone » abstrait, pour changer de canal sans y toucher. Commencer par le débogage USB, ajouter « Transfert de fichiers » quand Gtracker en a besoin.

### 3. Ce que font les boutons

- **« Récupérer » (téléphone vers PC)** : « Ajouter les sessions d'un dossier » pointé sur le téléphone, le plus petit pas.
- **« Synchroniser » (dans les deux sens)** : sessions, fiches, itinéraires, fichiers de réglages et FC repos dans les deux sens. Fiche modifiée des deux côtés : fusion champ par champ. Chaque appareil garde ses réglages et se voit proposer ceux de l'autre. Rien à ajouter côté téléphone.
- Le dossier mémoire est déjà pensé pour plusieurs appareils (réglages par appareil, session reconnue à son heure de départ, fiches fusionnées, import d'un dossier entier) : la synchronisation réemploie surtout de l'existant.
- Un lien vivant entre les deux applications n'apporterait rien de plus que « Synchroniser ».

## Ordre conseillé : trois lots, chacun utile seul

1. Le .exe d'abord (Electron, vrai dossier sur le disque, sans synchronisation) ; vérifiable au banc, mêmes pages.
2. Puis « Récupérer », par le débogage USB.
3. Puis « Synchroniser ».

Écartés : un simple outil de copie sans .exe (ne sert pas à Gtracker), et tout en un seul gros lot (rien à voir avant longtemps).

## Pour une version vendue

- Un .exe non signé affiche « Windows a protégé votre PC » (éditeur inconnu, « Exécuter quand même ») ; Smart App Control peut le bloquer.
- Un certificat pour un particulier coûte environ 209 € par an (Certum, 12/11/2026) ; certificats de 460 jours au plus depuis le 01/03/2026, clés sur matériel ou nuage. Signé, l'avertissement reste au début : la réputation vient de plusieurs semaines et centaines d'installations propres. Le certificat EV ne contourne plus SmartScreen depuis 2024.
- Voie la plus propre : le Microsoft Store (compte gratuit, signature par Microsoft, pas d'avertissement). À essayer avant de s'y engager.
- Le canal « Transfert de fichiers », la signature et un éventuel passage à une coquille plus légère se décideront dans Gtracker, en repartant de ce socle.

## Non prouvé

- Le .exe d'essai n'a pas réussi à ranger, par l'import existant, les sessions copiées du téléphone (script sans effet, cause non cherchée). Cet import marche déjà sous Chrome : risque jugé faible.
- Fichiers récents parfois absents de la liste du canal « Transfert de fichiers » : à vérifier sur le vrai téléphone.
- Taille réelle de l'installeur, mémoire au repos : fourchettes de blogs, non mesurées.

## Question ouverte

Une session supprimée d'un côté doit-elle disparaître de l'autre ? Par défaut oui, ce qui demande de noter les suppressions dans le dossier ; sinon elle reviendrait à chaque synchronisation.

Réponses déjà données par l'utilisateur : rien n'est à déménager depuis Firefox ; le travail doit se reporter facilement vers Gtracker.
