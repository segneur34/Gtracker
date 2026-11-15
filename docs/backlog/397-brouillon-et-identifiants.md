# 397 · Brouillon gardé sur l'appareil, identifiants de format figés, erreurs de lecture traduites

Modèle | Réflexion : Opus | high

## Origine

Revue globale du 15/11 (constats relus dans le code par l'orchestrateur). L'utilisateur : « toutes les petites corrections, on peut les faire ». Aucun essai au téléphone.

## 1. Le brouillon d'une session survit à la fermeture de l'application par Android

`src/hooks/useSessionDraft.ts:36` : `const drafts = new Map<string, Draft>()`, en mémoire du module seulement. Si Android tue l'application pendant que l'utilisateur est passé à une autre (appareil photo, messagerie), un long commentaire saisi dans « matos et conditions » disparaît sans un mot.

Décision (orchestrateur, d'après « toutes les petites corrections » ; elle ne change pas la règle « brouillon jusqu'à Enregistrer la session ») : le brouillon d'une session de la mémoire est aussi gardé sur l'appareil, par `src/platform/storage.ts` (jamais `localStorage` en direct, règle 12), une entrée par fichier de session ; il est effacé à « Enregistrer » et à « Annuler » ; à la réouverture de l'analyse il revient, avec le même état « non enregistré » qu'avant (bouton, avertissement en quittant). Un brouillon dont la session n'existe plus est jeté. L'écriture est différée (pas une écriture par frappe). Le brouillon d'un GPX ouvert hors de la mémoire reste en mémoire seule, comme aujourd'hui. Lire `library/sessionEdits.ts` et `rebaseDraft` : le brouillon relu suit la fiche comme le fait déjà celui de la mémoire.

Tests : brouillon écrit, module rechargé, brouillon rendu ; effacé à l'enregistrement et à l'annulation ; session disparue.

## 2. Les identifiants de format ne dépendent plus du nom de l'application

`src/core/appIdentity.ts:14-81` : `APP_SLUG = 'gtracker'` entre dans le format des fiches, des capteurs, du journal, des itinéraires, du marqueur du dossier mémoire et des clés de l'appareil. Un repreneur qui renomme l'application en changeant cette valeur rend illisibles toutes les données existantes ; seul un commentaire l'en protège.

Attendu : une constante de format à part (par exemple `FORMAT_ID`), figée, distincte du nom affiché ; un test qui fige les valeurs écrites (identifiants de format, espace de noms, nom du marqueur, clés) et échoue si elles changent, avec la phrase qui dit pourquoi. Aucune valeur écrite ne change dans ce lot : `library/summaryFrozen.test.ts` et les tests de fiches restent tels quels.

## 3. Les erreurs de lecture d'un fichier se lisent dans la langue choisie

Le calcul en arrière-plan (`src/library/trackWorker.ts`, `trackWorkerProtocol.ts`) ne reçoit jamais de dictionnaire : les textes qu'il produit restent en français pour un utilisateur anglais ou espagnol (« Fichier GPX illisible : le XML est mal formé. »). Vérifier d'abord le constat. Attendu : soit le message traverse sous forme de clé et se traduit côté page, soit le dictionnaire est donné au calcul ; choisir le plus simple qui garde `trackWorker.architecture.test.ts` et la garde `outils/i18n.mjs` au vert.

## Plan du 15/11 (agent Plan) et questions tranchées par l'orchestrateur

- Partie 2, constat à moitié démenti : `src/core/appIdentity.test.ts` fige déjà en toutes lettres `APP_SLUG`, `FILE_FORMATS`, `XML`, `MARKER_FILE`, `STORAGE_KEYS` et `CACHE_NAMES` ; il reste à renommer `APP_SLUG` en `FORMAT_ID` (emplois : `core/appIdentity.ts` et son test, `library/resetPlan.ts`, `platform/nativeConstants.test.ts`), à dire dans le commentaire du module que le nom affiché se renomme librement et l'identifiant de format jamais, et à écrire la raison dans le titre du test.
- Partie 3, constat tenu pour une seule phrase (`core/gpxParser.ts:43`, le XML mal formé) : traduite côté page, dans `library/trackWorkerClient.ts`, par une table texte français → `t('…')` sur le modèle de `platform/nativeMessages.ts`, appliquée au rejet du calcul en arrière-plan comme du repli en ligne. Le texte sans `t()` de `library/summarizeGpx.ts:52` (erreur interne) reste tel quel. Aucune clé ajoutée ni retirée dans `src/locales/`.
- Partie 1 : une seule clé neuve `STORAGE_KEYS.brouillons` (objet fichier → brouillon) plutôt qu'une clé par fichier, parce que `jsonStore.remove` n'efface rien des préférences du téléphone ; classée « donnée » dans `library/resetPlan.ts` ; écriture différée d'environ une seconde, vidée tout de suite quand la page passe en arrière-plan (`onPageHidden`) ; aucun plafond du nombre de brouillons (un plafond jetterait une saisie), la purge des sessions disparues suffit, faite une fois la lecture du dossier finie, jamais pendant ; le brouillon n'est ni relu ni rebasé tant que la session n'est pas chargée ; pas de bandeau « brouillon repris », la barre « non enregistré » suffit.
- Ordre : partie 2, partie 3, partie 1.

## Fichiers à ne pas toucher

`src/hooks/recorder/**`, `src/platform/files.ts`, `src/recording/**`, `android/**` (lot 396 dans le même paquet).

## Vérification

`node outils/verif.mjs --rapide` puis `npm run verif`. Banc : `notes` et `brouillon-voile` contre HEAD ; ajouter au script `brouillon-voile` le cas « page rechargée, le brouillon est encore là ».
