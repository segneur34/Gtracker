# 376 · Profil : cacher le banc de poissons, et les réglages de l'écran Profil aux deux endroits

Modèle | Réflexion : Opus | medium. Lot petit, un agent, un commit. Suit le lot 374 (dépend de lui). Avant d'y toucher : `docs/DECISIONS.md` §9 (Profil) et §11 (Réglages), à accorder dans le même travail.

## Demande de l'utilisateur (14/11, pendant le lot 374)

« Il faudrait pouvoir désactiver les poissons si on aime vraiment pas […] on peut le mettre à deux endroits : en cliquant sur la photo de profil, avec les choix à cet endroit-là, et en cliquant également sur un bouton dans le profil utilisateur dans les paramètres ; d'ailleurs tous les paramètres qui vont avec l'écran doivent être aux deux endroits. »

## Compris ainsi (confirmé par l'utilisateur le 14/11 : « bonne compréhension de écran »)

« L'écran » est l'écran Profil. Ses réglages sont : la photo ronde (aucune, un logo d'activité, une image du téléphone), le nom ou pseudo, le poisson du banc (les sept styles, ou aucun poisson), et le nombre de sessions du banc (essai, provisoire). Ils se règlent tous aux deux endroits : dans la fenêtre qui s'ouvre en touchant la photo ronde du Profil, et dans Réglages › Pratiquant.

## À faire

1. Cacher le banc : un huitième choix « Aucun » dans le choix du poisson (`components/fishSchool/FishStylePicker`), qui cache le banc et l'eau ; le Profil est alors exactement celui d'avant le banc (la couche n'est pas montée, les cadres gardent leur fond). Choisir un poisson le remontre. Gardé dans le profil du pratiquant, qui voyage avec le dossier mémoire ; un ancien profil se relit avec le banc montré. Forme du champ au choix de l'agent (un booléen à part ou une valeur de plus), testée.
2. La fenêtre de la photo ronde (aujourd'hui `AvatarPicker`, dans `components/ProfileAvatar`) devient la fenêtre des réglages de l'écran Profil : la photo comme aujourd'hui, puis le nom ou pseudo, le poisson du banc (avec « Aucun »), le nombre de sessions du banc (essai, provisoire). Tout s'applique tout de suite ; fermeture comme aujourd'hui (bouton, Échap, retour d'Android). Le bouton de la photo garde un nom qui dit ce qu'il ouvre.
3. Réglages › Pratiquant gagne le choix de la photo (il n'y est pas aujourd'hui) ; nom, poisson et nombre de sessions y sont déjà.
4. Une seule pièce partagée porte ces réglages et sert aux deux endroits (pas de copie) ; chargée à la demande là où le choix du poisson l'est déjà ; gardes d'`architecture.test.ts` accordées.
5. Clair, sombre, 320 px sans débordement, téléphone tourné, ordinateur ; zones de toucher d'au moins 44 points ; variables de `theme/tokens.css` ; aucune requête d'écran neuve ; listes dessinées par l'application.
6. DECISIONS §9 et §11, INVENTAIRE. Le script du banc `outils/banc/profil.mjs` : accorder les contrôles de la fenêtre de la photo s'ils cassent, et ajouter « Aucun cache le banc, un poisson le remontre », depuis la fenêtre du Profil et depuis Réglages.

## Ce qui ne change pas

Le calcul du banc, ses places, l'eau, les sept styles ; les autres réglages de Pratiquant (poids, taille, FC, seuils) restent dans Réglages seulement : ils ne vont pas avec l'écran Profil.

## Vérification

`node outils/verif.mjs --rapide` par l'agent, captures de la fenêtre du Profil et de Réglages › Pratiquant à 390 et 320 px, clair et sombre. Par l'orchestrateur : `npm run verif`, relecture, banc sur `profil`, `reglages`, `tailles`.

## Essai au téléphone

Toucher la photo ronde du Profil : choisir « Aucun », le banc et l'eau disparaissent ; choisir un poisson, ils reviennent ; changer le nom et la photo depuis cette fenêtre, puis retrouver les mêmes réglages dans Réglages › Pratiquant.
