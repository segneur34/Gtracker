# 510 · Retirer l'ancienne façon de chercher l'ordinateur sur le réseau

Plan du 23/11, relu par l'orchestrateur. À lancer après le commit du lot 505 (fichiers Java communs).

## Constat

L'ordinateur répond aux questions de découverte dans deux versions : l'ancienne (identifiant de l'ordinateur en clair) et la neuve (trace calculée de l'identifiant et du nombre tiré par le téléphone, `identifiantDeSonde`). Le téléphone 0.02.15 envoie les deux questions et accepte les deux réponses, la neuve d'abord (`Candidates`). L'ancienne avait été gardée pour les applications d'avant le 23/11 déjà reliées. Les deux côtés sont à jour chez l'utilisateur et rien n'est diffusé : l'ancienne se retire des deux côtés dans le même lot.

## Côté ordinateur

- `bureau/sonde.ts` : retirer `VERSION_SONDE` (l'ancienne) ; `VERSIONS_SONDE = [VERSION_SONDE_V2]`. **L'octet de version reste 2**, ne jamais revenir à 1 : une ancienne application prendrait la trace pour un identifiant en clair. Une question ou une réponse de l'ancienne version devient un paquet étranger. `encoderQuestion` prend la version neuve par défaut. L'octet de longueur du nom reste dans le format, toujours 0. L'en-tête du fichier ne parle plus que d'une version. Garder `nomPcPourSonde` et `NOM_PC_MAX_OCTETS` (ils servent au nom envoyé par la liaison chiffrée, `sansFil.ts`).
- `bureau/sansFil.ts` : `repondreSonde` répond toujours avec `identifiantDeSonde` ; l'ancienne question est écartée par `decoderQuestion`, avant le décompte par adresse.
- `bureau/fauxTelephone.ts` : `sonder` en version neuve seule ; le paramètre `version` et la branche « identifiant en clair » disparaissent.

## Côté téléphone

- `android/app/src/main/java/…/gtracker/ComputerLinkProtocol.java` : retirer `PROBE_VERSION`, `encodeQuestion(nonce)` à un argument, `decodeQuestion` (que seuls les essais utilisent), le constructeur ancien de `ProbeAnswer`, la lecture du nom dans `decodeAnswer` (exiger une longueur 0) et la branche ancienne de `answerFrom`. `Candidates` perd son tri par version et garde « une place par adresse, 4 au plus ». `PC_NAME_MAX_BYTES` et `nameAllowed` ne partent que si plus rien ne s'en sert.
- `ComputerLinkPlugin.java` : `discover()` n'envoie plus qu'une question ; commentaire d'en-tête à jour.
- Replis gardés : la dernière adresse connue (1 s) et le champ « Adresse », montré quand l'ordinateur est introuvable (`addressFieldShown`).

## Ce que voit chaque appareil

- Téléphone d'avant le 23/11 déjà relié, face à l'ordinateur à jour : rien ne change si l'ordinateur a gardé son adresse ; sinon la phrase actuelle « … est introuvable. Vérifiez qu'il est allumé… », puis le champ « Adresse », qui le relie encore.
- Téléphone à jour face à un programme Windows d'avant le 23/11 : même phrase, même repli. Aucun ancien programme n'est diffusé.
- Aucun texte visible ne change : ni dictionnaires, ni `INVENTAIRE.md`.

## Essais automatiques

- `bureau/sansFil.vecteurs.json` (jeux communs aux deux côtés) : les anciennes `questions` et `reponses` passent dans `etrangers` ; `questionsV2` et `reponsesV2` deviennent `questions` et `reponses`. Trois lecteurs à reprendre : `bureau/sonde.test.ts`, `ComputerLinkProtocolTest.java` (vecteurs, `answerFrom`, `Candidates`) et `src/platform/nativeConstants.test.ts`.
- `bureau/sansFil.test.ts` : `questionner` en version neuve ; essai neuf : une ancienne question n'obtient aucune réponse et ne consomme pas le quota de l'adresse ; une réponse ne contient jamais l'identifiant en clair.
- Essais Java par `gradlew testDebugUnitTest` (hors `npm run verif`).
- Banc : `exe-sansfil` et `exe-synchroniser` se connectent par adresse et port, sans découverte ; à rejouer tels quels sur le programme reconstruit.

## Tranché par l'orchestrateur (23/11)

- À la réception d'une ancienne question, l'ordinateur écrit une ligne de journal, une fois par adresse, et n'affiche rien (le téléphone 0.02.15 en envoie à chaque recherche : un message à l'écran serait une fausse alerte).
- L'ancienne version se retire aussi côté téléphone.

## Essai au téléphone (un seul, nouvelle application et nouveau programme)

Changer l'adresse de l'ordinateur (passer du câble au partage de connexion, par exemple), puis « Synchroniser » sur le téléphone → l'ordinateur est trouvé seul, sans taper d'adresse.

## À la passe de documentation

ETAT (phrase sur l'ancienne découverte, qui cite cet élément) et un point d'HISTORIQUE. Commentaires du code sans numéro de lot.
