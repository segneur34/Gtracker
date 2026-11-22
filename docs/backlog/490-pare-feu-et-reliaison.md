# 490 et 491 · Essai 343 raté : pare-feu jamais signalé, téléphone qui ne se relie plus seul

Essai 343 du 22/11 au soir, programme Windows installé par `Gtracker-Setup-0.02.01.exe` et APK 0.02.01 (versionCode 2002) sur le téléphone, partage de connexion du PC. Paroles de l'utilisateur :

> « Non, il n'y a aucun message qui apparaît même quand je désactive le pare-feu. Donc ça, c'est un problème. Ensuite, il y a un deuxième problème qui arrive, c'est que l'ordinateur ne se connecte pas automatiquement au téléphone. Je dois retirer le téléphone et refaire la connexion. »

## 490 · Le pare-feu n'est jamais signalé

Attendu (lot 488, `docs/backlog/488-pare-feu.md`) : règles de Gtracker retirées à la main (ou « Public » décoché), la carte Téléphone de Réglages › Mémoire dit « Windows ne laisse pas passer votre téléphone sur ce réseau. » avec « Autoriser Gtracker ». Constaté : aucun message, dans aucun cas essayé.

À établir d'abord, sur le vrai poste, sans rien corriger :
- ce que l'utilisateur a fait exactement (règles retirées, case décochée, pare-feu désactivé : désactivé, l'absence de message est juste) ; à lui demander en clair si ce n'est pas sûr ;
- ce que lit le relevé : lancer le script de `scriptReleve()` (`bureau/pareFeu.ts`) à la main en lecture seule avec le chemin du programme installé (`%LOCALAPPDATA%\Programs\Gtracker\Gtracker.exe`), et passer sa sortie à `jugerPareFeu` ; règles qui visent l'exécutant sous d'autres formes (chemin en minuscules posé par la question de Windows, règles de blocage, règles de l'ancien `bureau\sortie`, règles sans programme écartées ou non), interface du partage de connexion (192.168.137.1) et son profil ;
- ce que dit `journal.txt` du profil du programme (relevé lu, issue, erreurs) ; ce que montre l'état `pareFeu` / `pareFeuReparable` dans la page ;
- si le relevé échoue (délai de 10 s dépassé, PowerShell absent ou bloqué) et retombe sur l'essai d'auto-connexion, dont l'« ouvert » devient « inconnu » : alors rien n'est montré, c'est peut-être la cause.

## 491 · Le PC ne se relie plus seul au téléphone

Attendu (lots 450 et 482, puis 489 partie 5 : le téléphone relance la liaison toutes les 20 s tant que Gtracker est affiché) : un téléphone déjà appairé se relie seul. Constaté : il faut retirer le téléphone sur le PC et refaire l'appairage par code.

Pistes à vérifier, sans rien supposer :
- le programme réinstallé (installeur 0.02.01 par-dessus 0.01.92) a-t-il gardé son certificat et son registre des téléphones (profil, `bureau/certificat.ts`, `bureau/appairage.ts`) ? Une nouvelle empreinte fait refuser le PC par le téléphone, qui l'a fixée à l'appairage ;
- le pare-feu (490) bloque-t-il la découverte UDP (48218) ou le port TCP pris, de sorte que le téléphone ne trouve plus le PC ;
- le téléphone : bloc « Ordinateur », état affiché, relance de 20 s (`keepLinking`, `src/hooks/useComputerLink.ts`), dernière adresse connue ; journal du téléphone par adb (étiquettes du greffon `ComputerLinkPlugin.java`) ;
- `journal.txt` du PC : arrivées refusées, jeton inconnu, départs.

Résultat attendu : sur le partage de connexion, après une réinstallation du programme ou un redémarrage des deux appareils, le téléphone appairé se relie seul (Gtracker affiché), et un pare-feu qui bloque est dit avec « Autoriser Gtracker ».
