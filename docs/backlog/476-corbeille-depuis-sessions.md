# 476 · Une entrée « Corbeille » dans le menu « … » de la page Sessions

Modèle | Réflexion : Sonnet | medium.

Demande : `node outils/backlog.mjs --ligne 476`. Suite du lot 448 (corbeille de 30 jours du programme Windows, DECISIONS §8). À l'essai, l'utilisateur n'a pas su où était la corbeille (« comment on y accede ? »), puis a choisi le 21/11 : « dans les trois petits points de session où il y a importer des GPX ou fixe, ajouter des sessions d'un dossier, mettre à jour, etc. Là, il faut un bouton corbeille qui renvoie directement à l'onglet corbeille dans les paramètres. Je pense que c'est une option simple. »

## Décidé

- Une ligne « Corbeille » dans le menu « … » du titre de la page Sessions, avec les autres (import, « Ajouter les sessions d'un dossier », « Mettre à jour »), à l'icône de corbeille déjà employée. Elle n'est pas un geste de suppression : à l'encre, pas en rouge.
- Elle n'existe que là où une corbeille existe : aujourd'hui le programme Windows avec son dossier mémoire (la même condition que celle qui montre la zone de corbeille dans Réglages › Mémoire et qui fait dire « corbeille » à la confirmation de suppression). Sur téléphone et dans le navigateur, le menu ne change pas.
- Elle ouvre Réglages avec la carte Mémoire dépliée et la page défilée jusqu'à la zone de la corbeille. Mécanisme à réutiliser : le lien « Réglages » de la ceinture qui arrive sur le bloc « Capteurs » (chercher l'ancre ou le paramètre d'adresse qu'il emploie dans `pages/SettingsPage` et `core/navigation.ts`), sans en inventer un second.
- Corbeille vide : la ligne du menu reste (on sait où elle est). Si la zone de Réglages ne montre rien quand la corbeille est vide, elle dit alors « Corbeille vide. » sur une ligne, pour que l'arrivée ne tombe pas sur rien ; sinon rien à ajouter.
- Rien d'autre ne change : « Restaurer », « Supprimer définitivement », « Vider la corbeille », la durée de 30 jours.

## Pièces en place

- Zone de la corbeille : `src/components/TrashZone.tsx`, `src/hooks/sessionLibrary/trash.ts`, `src/library/trash.ts` (ce qui dit si la corbeille existe).
- Menu « … » du titre de Sessions : `src/pages/SessionsPage.tsx` (lire DECISIONS §8 et §11 pour l'ordre des lignes : « Corbeille » va en dernier).
- Textes par `t`, clés ajoutées à `src/locales/en.json` et `es.json` par des Edit ciblés (« Trash » / « Papelera », selon ce que les dictionnaires emploient déjà pour la corbeille).

## Tests et banc

- Test du calcul pur s'il y en a un (condition d'affichage, adresse d'arrivée).
- `outils/banc/memoire-disque.mjs` joue le vrai programme Windows : y ajouter un contrôle (le menu « … » de Sessions porte « Corbeille », son appui arrive sur Réglages, carte Mémoire dépliée, zone de corbeille à l'écran) ; ne pas le lancer, l'orchestrateur le jouera sur le programme refait. Sous Chrome (banc ordinaire), le menu ne doit pas porter la ligne : texte relevé inchangé.

## Passe de doc (après validation)

DECISIONS §8 : l'accès à la corbeille depuis Sessions.
