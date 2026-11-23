# Installer Gtracker sur un téléphone Android et sur un PC

Gtracker enregistre vos sessions de voile et de surf avec le GPS du téléphone, puis les analyse. L'application n'est pas sur le Play Store : elle s'installe à partir d'un fichier (un « APK ») que vous recevez par un lien. Comptez cinq minutes.

Il faut un téléphone Android 7 ou plus récent. Il n'y a pas de version iPhone.

Le programme Windows, facultatif, montre les mêmes sessions sur l'ordinateur et se synchronise avec le téléphone : voir le chapitre 5.

## 1. Télécharger et installer

1. Ouvrez sur le téléphone le lien que vous avez reçu, puis téléchargez le fichier qui se termine par `.apk`.
2. Touchez le fichier téléchargé (dans la notification de téléchargement, ou dans l'application Fichiers, dossier « Téléchargements »).
3. Android vous demande d'autoriser cette source d'installation, en général le navigateur ou l'application Fichiers. Touchez **Paramètres**, activez **Autoriser depuis cette source**, puis revenez en arrière.
4. Touchez **Installer**.
5. Play Protect peut afficher un avertissement du type « Application non vérifiée » ou « Application bloquée ». Il le fait pour toute application installée en dehors du Play Store. Touchez **Plus de détails**, puis **Installer quand même**.

L'icône Gtracker apparaît avec les autres applications.

## 2. Choisir le dossier de vos sessions

Gtracker range vos sessions dans un dossier ordinaire du téléphone. Chaque session y est un fichier GPX accompagné d'une petite fiche. Vous pouvez copier ce dossier sur un ordinateur pour le sauvegarder, ou pour retrouver vos sessions sur un autre appareil.

1. Au premier lancement, la page d'ouverture, le Profil, propose **Choisir le dossier**.
2. Dans la fenêtre d'Android qui s'ouvre, allez dans **Documents**. Créez-y un dossier **Gtracker** s'il n'existe pas, puis entrez dedans.
3. Touchez **Utiliser ce dossier**, puis **Autoriser**.

Gtracker ne demande jamais l'accès à tous vos fichiers : il ne voit que ce dossier.

## 3. Régler le téléphone avant la première sortie

Ces réglages évitent que le téléphone coupe le GPS quand l'écran s'éteint. **Sans eux, la trace s'interrompt au bout de quelques minutes.**

**Au premier lancement**, une carte **Autorisations** apparaît en tête du Profil (elle est aussi dans Réglages). Elle liste ce qu'il faut accorder :

- **Position** : choisissez **Lorsque vous utilisez l'appli**, et laissez **Position exacte** activée. Avec la position approximative, la trace est inutilisable.
- **Notifications** : choisissez **Autoriser**. Pendant l'enregistrement, une notification reste affichée. C'est elle qui permet à Gtracker de continuer à enregistrer écran éteint.
- **Batterie non optimisée** : voir plus bas.
- **Bluetooth** : seulement si vous utilisez une ceinture cardio (voir plus bas).

Si vous touchez **Plus tard**, la carte revient à la version suivante tant qu'il manque une autorisation.

**Batterie**. Touchez **Autoriser** dans la carte : Android ouvre la page de Gtracker. Choisissez Batterie (ou « Économiseur de batterie »), puis **Aucune restriction** (ou « Non restreinte »), et revenez dans Gtracker : la ligne passe à « accordée ». Sans ce réglage, Android peut couper l'enregistrement écran éteint.

**Sur les téléphones Xiaomi, Redmi et POCO**, la carte propose aussi un lien vers le réglage **Démarrage automatique** : activez-le (Paramètres, puis Applications, puis Gtracker).

**Ceinture cardio Bluetooth** (facultative) : dans Enregistrer, cochez la ceinture ; Gtracker se connecte seul et accepte l'autorisation Bluetooth au passage. La fréquence cardiaque est alors gardée dans la session.

**Sur les téléphones Samsung** : ouvrez Paramètres, puis Batterie, puis « Limites d'utilisation en arrière-plan ». Vérifiez que Gtracker n'est pas dans les applications « en veille » ou « en veille prolongée ».

Les libellés changent un peu d'une marque à l'autre. En cas de doute, cherchez « batterie » dans les paramètres de l'application Gtracker.

## 4. Premier essai

Avant une vraie sortie, faites un essai de dix minutes en marchant, écran éteint, téléphone en poche :

1. Touchez le bouton rond, choisissez l'activité (Wingfoil ou Surf conviennent pour l'essai), puis **Démarrer**.
2. Éteignez l'écran et marchez dix minutes.
3. Rallumez l'écran, tenez le bouton **Arrêter** appuyé 2 secondes (un simple appui ne l'arrête pas). La session est rangée et son analyse s'ouvre seule.

Si la trace présente de longues lignes droites qui coupent les virages, le téléphone a coupé le GPS. Reprenez l'étape 3.

## 5. Installer sur le PC et relier le téléphone

Le programme Windows (Windows 10 ou 11, 64 bits) est facultatif. Il garde vos sessions dans un dossier du PC et les met à jour avec celles du téléphone, dans les deux sens : sessions, itinéraires, réglages, tests de FC repos et lieux.

**Installer**

1. Ouvrez le fichier reçu, `Gtracker-Setup-<version>.exe`.
2. Le programme n'est pas signé : Windows peut afficher « Windows a protégé votre ordinateur ». Cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**.
3. L'installation se fait seule, sans droits d'administrateur. Un raccourci Gtracker apparaît sur le Bureau et dans le menu Démarrer.

**Choisir le dossier des sessions**

Au premier lancement, Gtracker propose un dossier, en principe Documents\Gtracker (hors de OneDrive si vos Documents y sont). Cliquez sur **Utiliser ce dossier**, ou sur **Choisir un autre dossier**. Rien n'y est écrit avant ce choix.

**Relier le téléphone, une fois**

Le téléphone et le PC doivent être sur le même réseau : la même box Wi-Fi, ou le partage de connexion du téléphone, auquel le PC est connecté.

1. Sur le PC, ouvrez Réglages, bloc **Connexion**, carte **Téléphone**, et cochez **Relier le téléphone sans câble**. Si un message parle du pare-feu, cliquez sur **Autoriser Gtracker** et confirmez la demande de Windows. L'autorisation vaut aussi sur les réseaux publics : le partage de connexion du téléphone en est un.
2. Cliquez sur **Relier un téléphone** : le PC affiche une adresse, un code de 6 chiffres et le temps restant.
3. Sur le téléphone, ouvrez Gtracker, puis Réglages, bloc **Connexion**, carte **Ordinateur**. Tapez le code, puis touchez **Relier**. Si Gtracker ne trouve pas l'ordinateur tout seul, il demande aussi l'adresse affichée par le PC.
4. Le PC affiche « Téléphone … relié. ».

**Synchroniser**

1. Ouvrez Gtracker sur le téléphone et laissez-le affiché.
2. Sur le PC, cliquez sur **Synchroniser**, en haut de la fenêtre.
3. La première fois, Gtracker dit ce qui va se passer et où il range une copie de sécurité des deux dossiers (par défaut Documents\Gtracker-copies) ; cliquez sur **Commencer**. Cette première fois, rien n'est supprimé.

Ensuite, chaque synchronisation reporte dans les deux sens les ajouts, les modifications et les suppressions. Une session supprimée sur le téléphone passe dans la corbeille du PC (Réglages, bloc Mémoire), où elle reste 30 jours. Si beaucoup de sessions devaient disparaître, Gtracker demande d'abord. Pendant un enregistrement, le téléphone n'est pas modifié.

**Installer l'application du téléphone depuis le PC**

Le programme contient l'APK de la même version. Dans Réglages, bloc **Connexion**, carte **Application du téléphone** : **Enregistrer l'APK…** l'enregistre sur le PC, à copier sur le téléphone puis à installer comme à l'étape 1 ; **Installer par le câble** l'installe directement, si le débogage USB du téléphone est activé. Après chaque mise à jour du programme, il propose de le faire.

**Sans Wi-Fi** : la synchronisation peut aussi passer par le câble USB. Il faut activer le « Débogage USB » du téléphone et copier sur le PC un outil gratuit de Google ; la carte **Téléphone**, partie **Par câble (avancé)**, explique comment.

**Mettre à jour ou désinstaller le programme** : installez la nouvelle version par-dessus l'ancienne ; si Gtracker est ouvert, l'installation le ferme. La désinstallation, par les Paramètres de Windows, ne touche ni au dossier des sessions ni aux réglages du programme.

## Mettre à jour

Quand vous recevez une nouvelle version, installez-la **par-dessus** l'ancienne, de la même façon qu'à l'étape 1. Ne désinstallez pas l'ancienne version : vos réglages et vos autorisations sont conservés.

## Si vous devez désinstaller

La désinstallation efface les autorisations, les réglages de batterie et le choix du dossier. **Vos sessions, elles, restent** dans le dossier Documents/Gtracker.

Après une réinstallation, refaites les étapes 2 et 3 : désignez le même dossier Documents/Gtracker, et Gtracker retrouve vos sessions.

## Retrouver ou sauvegarder vos sessions

- **Sur le téléphone** : dans l'application Fichiers, passez par **Stockage interne**, puis **Documents**, puis **Gtracker**. La catégorie « Documents » de certains gestionnaires de fichiers ne montre pas ce dossier.
- **Sur un ordinateur** : branchez le téléphone par câble USB, choisissez « Transfert de fichiers » sur le téléphone, puis copiez le dossier Documents/Gtracker. Cette copie est votre sauvegarde.
- **Avec le programme Windows** : après une synchronisation, le dossier des sessions du PC tient aussi les sessions du téléphone ; le copier est une sauvegarde.

## En cas de problème

| Symptôme | Que faire |
| --- | --- |
| « Application non installée » | Une version signée autrement est déjà installée. Désinstallez-la, puis installez la nouvelle (voir « Si vous devez désinstaller »). |
| La trace s'arrête ou saute quand l'écran est éteint | Refaites l'étape 3 : batterie sans restriction, démarrage automatique sur Xiaomi. |
| Aucune position ne s'affiche | Vérifiez que la localisation du téléphone est activée et que Gtracker a la position exacte. Mettez-vous à ciel ouvert : le premier point peut prendre une minute. |
| Gtracker demande de choisir à nouveau le dossier | Désignez le même dossier, Documents/Gtracker. Rien n'est perdu. |
| « Windows a protégé votre ordinateur » à l'installation sur le PC | Cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même** (chapitre 5). |
| Le téléphone ne trouve pas le PC | Vérifiez que les deux sont sur le même réseau, que **Relier le téléphone sans câble** est coché sur le PC et que Gtracker est ouvert sur le téléphone. Si un message parle du pare-feu, cliquez sur **Autoriser Gtracker**. Sinon, tapez sur le téléphone l'adresse affichée par le PC. |

Pour tout autre souci, envoyez une capture d'écran et décrivez ce que vous faisiez.
