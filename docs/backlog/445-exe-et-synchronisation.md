# 445 à 452 · Gtracker en programme Windows (.exe) et liaison avec le téléphone

Fiche de tête du chantier, écrite le 18/11/2026. Rien n'est codé. Elle dit ce que l'utilisateur a décidé, ce que les quatre études du jour concluent, l'ordre des lots et ce que l'orchestrateur a tranché par défaut. Le détail est dans les études :

- `docs/backlog/445-exe-etude-coquille.md` : la coquille Electron et la mémoire sur le disque (lots A à D).
- `docs/backlog/445-exe-etude-cable.md` : le téléphone branché par câble (débogage USB, « Transfert de fichiers »).
- `docs/backlog/445-exe-etude-sans-fil.md` : le même réseau Wi-Fi, sans câble.
- `docs/backlog/445-exe-etude-synchronisation.md` : « Récupérer », « Synchroniser », suppressions et corbeille (lots S1 à S6).

Avant elles : l'étude du 12/11 faite dans l'autre application, résumée hors dépôt dans `D:\gong tracker\atelier\backlog-clos\exe-ordinateur-etude-tracker.md`.

## Décidé par l'utilisateur le 18/11

- Le .exe remplace Firefox sur son PC : « Si on peut prendre le .exe, c'est bien mieux. » Rien n'est à déménager depuis Firefox. La phrase de DECISIONS §8 (« Sur le PC, l'utilisateur reste sur Firefox ») et la règle 12 de `CLAUDE.md` se récrivent à la passe de documentation du lot qui livre le .exe, pas avant.
- Canal : « je préfère l'option [sans fil] parce qu'effectivement, ça évite de devoir valider le transfert sur le téléphone. Mais pour une version numéro 1, on va valider la version facile. Avec un message clair qui explique ce qui doit être fait sur le téléphone. […] Si les deux peuvent être faits en parallèle, allons-y pour les deux. »
- Suppression : « Une session supprimée d'un côté oui, elle disparaît, mais ce serait bien que dans la version PC, il y ait une mémoire au moins 30 jours des sessions supprimées. »

## Ce que les études concluent

- **Coquille** : Electron embarque Chrome, donc la version navigateur de `src/platform/` marche déjà dans le .exe. Le cas « ordinateur » est la version navigateur plus deux ajouts : une mémoire sur un vrai dossier du disque et la réception des fichiers .gpx et .fit. `isNativeApp()` garde son sens (« téléphone »). La coquille vit dans un dossier `bureau/` à part, avec son propre `package.json`. Piège : la version `0.01.40` n'est pas acceptée par l'outil d'emballage, la coquille déclare `0.1.40`. L'import raté du .exe d'essai du 12/11 venait du script d'essai, pas de la coquille (à confirmer au banc).
- **Câble** : le débogage USB est le plus simple et ne demande aucun geste à chaque branchement, mais exige les options pour développeurs : bon pour l'utilisateur, exclu pour un acheteur. « Transfert de fichiers » est le seul canal présentable à un acheteur ; il demande un petit programme auxiliaire et le choix du mode sur le téléphone à chaque branchement. Les deux se rangent derrière une même interface « dossier distant ».
- **Sans fil** : le PC écoute, le téléphone se présente à lui après un appairage fait une fois ; il faut un greffon Java côté téléphone, donc une APK ; la synchronisation ne se fait qu'application du téléphone ouverte ; pare-feu Windows et Wi-Fi qui isole ses appareils sont les deux écueils.
- **Synchronisation** : l'ordinateur garde l'état des deux dossiers à la fin de la dernière synchronisation réussie et en déduit ajouts, modifications et suppressions ; rien à changer sur le téléphone pour le câble. La corbeille est un dossier de l'ordinateur où passe au moins 30 jours tout ce qui disparaît, d'un côté comme de l'autre.

## Ordre des lots

| Élément | Contenu | Étude | Modèle |
|---|---|---|---|
| 445 | La coquille nue : l'application dans une fenêtre Windows, aucune ligne de `src/` | coquille, lot A | Opus / high |
| 446 | La mémoire sur un vrai dossier du disque | coquille, lot B | Opus / high |
| 447 | Le téléphone par câble (débogage USB) et « Récupérer » | synchronisation, S1 et S2 ; câble | Opus / high, puis Sonnet / high |
| 448 | La corbeille de l'ordinateur, 30 jours | synchronisation, S3 | Opus / high |
| 449 | « Synchroniser » : les sessions, puis itinéraires, réglages, FC repos et lieux | synchronisation, S4 et S5 | Fable / high, puis Opus / high |
| 450 | Le sans-fil sur le même Wi-Fi (serveur du PC, greffon du téléphone, appairage) | sans fil | Opus / high |
| 451 | Fichiers reçus, retouches d'ordinateur, installeur | coquille, lots C et D | Sonnet / high |
| 452 | Version vendue : « Transfert de fichiers », signature ou Microsoft Store, mise à jour | câble ; étude du 12/11 | à dire au plan |

Le 450 peut commencer dès que l'interface « dossier distant » du 447 existe, à côté du 449 ; il ne se valide qu'une fois le 449 fait.

## Tranché par l'orchestrateur, par défaut (à redire à l'utilisateur, sans bloquer)

- Mémoire du PC : `Documents\Gtracker` proposé au premier lancement, autre dossier au choix, avertissement s'il est dans OneDrive.
- Pas d'installeur avant le 451 : un simple dossier à lancer pour les premiers lots ; mise à jour à la main jusqu'à la vente.
- Le .exe de l'utilisateur emploie le programme de débogage déjà installé sur son poste ; rien n'est embarqué (la redistribution est une zone grise, à faire lire par un juriste avant toute vente).
- « Synchroniser » part d'un bouton ; le départ automatique au branchement s'ajoute une fois le bouton validé sur la vraie mémoire.
- Session supprimée d'un côté et modifiée de l'autre : elle disparaît, la version modifiée reste 30 jours dans la corbeille.
- Appareil vidé par « Tout supprimer » puis synchronisé : on demande à ce moment-là, « Le remplir depuis l'autre » en premier choix ; l'autre n'est jamais vidé sans confirmation.
- Garde-fou : la synchronisation s'arrête et montre la liste avant de retirer plus de 10 sessions ou plus du quart ; la première synchronisation d'une paire ne supprime rien.
- Pas de corbeille sur le téléphone.
- Sans fil : appairage par code tapé, écoute sur les seuls réseaux privés de Windows, désactivé tant qu'on n'a pas appairé, pas de synchronisation application fermée.
- Avant le premier essai sur la vraie mémoire : copie à part des deux dossiers, celui du PC et celui du téléphone.

## Non prouvé, à lever au premier geste du lot concerné

- 445 : le banc branché sur le .exe ; la fermeture de la fenêtre avec un brouillon en attente ; le cache des tuiles sous l'adresse propre de la coquille ; le poids réel.
- 447 : le débogage USB marche-t-il quand le Xiaomi est en « charge seule » ; les dates des fichiers sont-elles gardées.
- 452 : une session tout juste enregistrée apparaît-elle dans l'Explorateur Windows par « Transfert de fichiers » (essai d'une heure, avant tout code de ce canal).
