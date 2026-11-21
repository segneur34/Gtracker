# 478 · Fenêtre « Matériel » : téléphone et ordinateur côte à côte

Maquette et plan de l'agent Plan du 21/11, relus par l'orchestrateur. L'utilisateur, absent, a répondu « Maquette puis code » : la maquette est suivie sans attendre, il juge sur le résultat.

## Maquette

```
Réglages › Mémoire › bloc « Réglages » (programme Windows seulement, s'il y a dans
le dossier un fichier de réglages d'un autre appareil) : [COMPARER LE MATÉRIEL]
┌ Matériel des deux appareils ────────────────────────────────────── × ┐
│ Liste de « Téléphone » reçue le 21/11 à 18 h 04 (dernière synchro)   │
│ (Plusieurs autres appareils : leurs noms en ovales, ChoiceButtons)   │
│ (Wingfoil) (Kite) (Surf foil)  ← activités qui ont une liste d'un côté│
│ AILES                  ORDINATEUR        TÉLÉPHONE                   │
│  =                     Unit 5,5          unit 5.5        [Supprimer] │
│  ≈ se ressemblent      Duotone Slick 4   Slick 4         [Réunir]    │
│  ← manque ici          —                 Unit 4  [Copier vers l'ordinateur]│
│                                          (quittera le téléphone s'il  │
│                                           reprend la liste sans copie)│
│  → manque au téléphone Echo 6            — (lui sera proposé)[Supprimer]│
│ FOILS (ligne absente du téléphone : toutes ses lignes en →)          │
│ Activité « Moth » absente du téléphone : reprenez tous les réglages. │
├──────────────────────────────────────────────────────────────────────┤
│ Pour le téléphone : 2 ajouts, 1 retrait, 1 réunion. Après            │
│ « Synchroniser », sur le téléphone : Réglages › Mémoire › « PC » ›   │
│ « Reprendre le matériel ».                               [FERMER]    │
└──────────────────────────────────────────────────────────────────────┘
```

- Réunir (fenêtre) : « Réunir « Duotone Slick 4 » et « Slick 4 » ? Nom gardé : (•) Duotone Slick 4 ( ) Slick 4. Les sessions ne sont pas réécrites : celles qui portent l'autre nom comptent pour celui-ci. » [RÉUNIR] [Annuler]. Vaut aussi pour deux articles du même appareil qui se ressemblent.
- Supprimer (confirmation, comme « Reprendre ») : « Supprimer « Echo 6 » de la liste de l'ordinateur ? Ses sessions le gardent, « (hors liste) » dans les Statistiques. »
- Copier : tout de suite, sans question (on revient en arrière par Supprimer).
- Pas de liste d'un autre appareil : « Aucune liste du téléphone dans ce dossier. Branchez-le et touchez « Synchroniser » : sa liste arrive avec ses réglages. » La fenêtre lit la copie du dossier, sans téléphone branché.
- Activité dont les deux listes sont égales : « Les deux listes sont les mêmes. »
- Téléphone (APK) : sur la ligne « PC » de Réglages › Mémoire, le bouton [Reprendre le matériel] à côté de « Reprendre », seulement si les deux listes diffèrent ; il demande d'abord : « Le matériel de « PC » remplace celui de ce téléphone pour Wingfoil, Kite : + Echo 6 ; − Unit 4 ; Slick 4 réuni à Duotone Slick 4. Les sessions gardent leur matériel. »

## Principe

Un appareil n'écrit que son propre fichier de réglages. Chaque geste de la fenêtre modifie la liste de l'ordinateur, écrite dans son fichier par le chemin habituel ; la synchronisation recopie ce fichier sur le téléphone, qui le prend par un geste de l'utilisateur. « Rien n'est adopté d'office » tient, sans exception. Aucune fiche de session n'est réécrite, d'aucun côté.
- Réunir : l'article gardé reçoit `merged: {id, name}[]` (identifiant et nom de l'article réuni) ; le rapprochement les reconnaît, à l'analyse comme aux Statistiques.
- Supprimer : les fiches gardent le nom, montré « (hors liste) ».
- Téléphone : même vue après « Reprendre le matériel ». Avant l'APK, un « Reprendre » complet marche mais l'ancien code ignore `merged` : les sessions de l'article réuni y sont « (hors liste) » jusqu'à la mise à jour.

## Parties (un commit chacune)

**P1 · Le pur, testé (Opus high).**
- `src/library/notes.ts` : `GearItem.merged?`, `GearGroup.merged?`. `src/settings/gear.ts` : `sanitizeGearGroups` garde `merged` (nettoyé, sans doublon).
- `src/library/gearMatch.ts` : `matchGearChoice` cherche aussi dans les identifiants réunis, puis dans les noms réunis. Tests : un article réuni retrouve ses fiches, le filtre des Statistiques les compte.
- Neuf, `src/library/gearCompare.ts` et son test : `gearLooksAlike(a, b)` (noms égaux sans accents ni ponctuation, ou l'un contient l'autre à partir de 3 caractères, ou une seule lettre d'écart à partir de 5 ; jamais si les nombres diffèrent : « Unit 5 » et « Unit 6 » restent deux articles) ; `compareGear(pc, phone)` (activités rapprochées par identifiant puis par nom, lignes et articles par `gearNameKey` ; rangées `same | pcOnly | phoneOnly | alike`) ; `withGearCopied` (garde l'identifiant du téléphone s'il est libre), `withGearMerged`, `withGearRemoved`, `phoneGearChanges` (ajouts, retraits, réunions).
- `src/library/settingsFile.ts` : `adoptedGearValues(theirs, mine)` (remplace `gearGroups` pour les seules activités connues des deux côtés), `gearListsDiffer`.

**P2 · La fenêtre de l'ordinateur (Opus high).**
- Neufs : `src/components/GearCompareDialog.tsx` et `.css` (`ui/Dialog`, `ui/ChoiceButtons`, `ui/Button`, variables du thème, aucun `style={{`, textes par `t`/`tn`).
- `src/components/SettingsFiles.tsx` : le bouton, si `isDesktopApp()` et s'il y a un fichier d'un autre appareil.
- `src/hooks/sessionLibrary/deviceSettings.ts` : `settingsFileValues(fileName)`, exporté par `useSessionLibrary.ts` (listes de `couches.test.ts`).
- Écriture par le chemin de `GearGroupsEditor` (`setFor(id, 'gearGroups', …)`, `hooks/useSportSettings.ts`).
- Dictionnaires, INVENTAIRE.

**P3 · Le téléphone (Opus high, APK).**
- `deviceSettings.ts` : `adoptSettingsGear(fileName)`, sur le modèle d'`adoptSettingsFile` sans recharger la page, puis réécriture du fichier de l'appareil.
- `SettingsFiles.tsx` : « Reprendre le matériel » et sa confirmation, qui liste `phoneGearChanges` ; le même bouton sert sur l'ordinateur pour tout reprendre du téléphone.

**Banc (Sonnet), `outils/banc/exe-materiel.mjs`** : dossier mémoire avec `reglages/PC.json` et un faux `Téléphone.json` ; rangées =, ≈, ← et → ; copier, réunir, supprimer réécrivent `PC.json` ; fiches identiques à l'octet ; message sans autre fichier ; « Reprendre le matériel » en mode navigateur. `SCRIPTS.md`.

## Choix faits sans l'utilisateur (à lui dire)

- Le téléphone qui reprend le matériel remplace sa liste, pour les activités communes, après une confirmation qui dit ce qui part ; rien ne se perd, les fiches gardent leurs noms. Un article ajouté sur le téléphone depuis la dernière synchronisation apparaît dans cette confirmation.
- L'ordinateur est le seul endroit où l'on modifie ; le téléphone suit par un geste.
- La fenêtre s'ouvre dans Réglages › Mémoire seulement ; les lignes (groupes) se réunissent comme les articles ; une activité absente d'un côté est montrée sans geste ; à plusieurs autres appareils, le plus récent est choisi au départ.

Essai au téléphone, un seul : vraie liste, synchroniser, « Reprendre le matériel », synchroniser de nouveau : la fenêtre est toute en « = ».
