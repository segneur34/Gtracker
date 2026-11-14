# 378 · Réglages : deux retouches du 14/11 au soir

Modèle | Réflexion : Sonnet | medium. Lot petit, un seul agent.

## Demandes

Retours de l'utilisateur du 14/11 au soir sur l'APK 0.00.65 :

1. « 377 : ok mais il faudrait que dans changer image il y ait la flèche vers le bas et vers le haut pour préciser le déploiement et fermeture. »
2. « Dans paramètres mémoire il faut pouvoir plus réduire cet onglet. »

## Résultat attendu

1. Le bouton « Changer l'image » (`AvatarPicker`, `src/components/ProfileAvatar.tsx`) porte une petite flèche : vers le bas quand les propositions sont repliées, vers le haut quand elles sont dépliées. Aux deux endroits, puisque la pièce est partagée (panneau de la photo ronde du Profil et Réglages › Pratiquant).
2. Dans Réglages, le cadre « Mémoire » replié se réduit à son titre, comme les autres cadres de la page. Aujourd'hui, replié, il garde sa ligne d'état (`MemoryStatus` avec `collapse`, `src/components/MemoryStatus.tsx`), ce qui le laisse plus haut que ses voisins.

## Compris ainsi, et tranché par l'orchestrateur

1. La flèche est le chevron déjà employé par les titres repliables de l'application (`components/icons.tsx`, `PanelTitle`), pas un dessin neuf ni un caractère ; elle se place après le mot, dans le bouton, et ne change ni son libellé ni sa hauteur de toucher. Elle est décorative (`aria-hidden`) : `aria-expanded` dit déjà l'état.
2. Cadre Mémoire replié : le titre seul quand tout va bien. Ce qui demande une action reste montré même replié, parce que le cacher ferait manquer un problème : mémoire fermée ou dossier à rouvrir, sessions en attente d'écriture, GPX illisibles, doublons, proposition d'un fichier de réglages. La ligne d'état ordinaire (dossier ouvert, nombre de sessions) disparaît du cadre replié. Si le code ne permet pas de séparer simplement « état ordinaire » et « alerte », le dire dans le rapport au lieu de deviner.
3. Les autres emplois de `MemoryStatus` (sans `collapse`, sur les autres pages) ne changent pas.

## À faire

- Les deux retouches, par classes et variables de `src/theme/tokens.css`, sans style en ligne.
- Scripts du banc : accorder ceux qui relèvent le texte du cadre Mémoire replié de Réglages (Grep dans `outils/banc/`), et ajouter un contrôle à `outils/banc/profil.mjs` sur la flèche (présente, et qui change de sens avec `aria-expanded`). Un contrôle neuf : cadre Mémoire replié sans ligne d'état quand tout va bien.
- Ne touche à aucun fichier de `docs/` : des passes de documentation y écrivent en même temps. Si une phrase de `docs/DECISIONS.md` ou de `docs/INVENTAIRE.md` devient fausse, cite-la dans ton rapport avec le texte proposé.

## À ne pas faire

Pas de commit, pas de version. Commentaires de `src/` sans numéro de lot ni date (règle 14 de `CLAUDE.md`).

## Vérification

`node outils/verif.mjs --rapide` vert. Les scripts du banc touchés joués seuls du côté modifié ; le passage avant/après est fait par l'orchestrateur.
