# 398 · La plante du Profil retirée du code

Modèle | Réflexion : Sonnet | high

## Origine

Revue globale du 15/11 : environ 1 720 lignes de code et 420 de tests (racine, fleur, papillon, bulle) livrées éteintes derrière `PROFILE_PLANT_VISIBLE = false` (`src/core/profilePlant.ts:6`), et dont le calcul tourne quand même à chaque visite du Profil (`src/pages/ProfilePage.tsx`, vers 170). L'utilisateur, le 15/11 : « la racine, effectivement, on peut l'enlever totalement ». Lire `docs/DECISIONS.md` §9 avant de commencer.

## Attendu

1. Supprimés avec leurs tests : `src/core/rootPath.ts`, `src/components/drawRoot.ts`, `src/components/ProfileRoot.tsx` et son CSS, `src/library/rootGrowth.ts`, `src/hooks/useProfileRoot.ts`, `src/core/profilePlant.ts`, et tout ce qui n'était lu que par eux (variables de `theme/tokens.css`, leçon des tutoriels, réglage de l'objectif dans Réglages, phrase d'ouverture du Profil si elle ne parle que de la plante, clés de traduction devenues orphelines : `outils/i18n.mjs` les signale).
2. **Ce qui est partagé reste.** Le banc de poissons (`src/core/fishSchool.ts`, `schoolWater.ts`, `gridDistance.ts`, `components/fishSchool/`) cite aussi ces fichiers : relever par Grep ce qu'il leur emprunte (une fonction de `rootPath` ou de `gridDistance` peut servir aux deux) et déplacer ce qui sert encore dans le module du banc, sans changer son rendu.
3. **Données déjà écrites.** Les champs de la plante dans le fichier du pratiquant et les réglages (`library/athleteProfile.ts`, `library/settingsFile.ts`, `hooks/useAthleteProfile.ts`) : la lecture reste tolérante (un fichier qui les porte s'ouvre sans erreur), l'application ne les écrit plus. Si un champ sert aussi au banc de poissons (objectif de pratique), il reste : le dire dans le rapport.
4. Les gardes suivent : `outils/heritage.json` et `outils/styles-en-ligne.json` ne peuvent que baisser ; `src/architecture.test.ts` (chargement à la demande de `ProfileRoot`) ; `outils/banc/scripts.mjs` si un script la cite.
5. Documents, dans ce lot parce qu'ils citent des fichiers supprimés (`npm run verif` les contrôle) : `docs/INVENTAIRE.md`, `docs/ETAT_DU_PROJET.md` §1, `docs/DECISIONS.md` §9 (« La plante reste cachée » devient « La plante est retirée du code, décision du 15/11 »). `CLAUDE.md` est accordé par le lot 395 : ne pas y toucher ici, sauf si la vérification des fichiers cités échoue (alors retirer les deux noms de la table, rien d'autre).

## Hors du lot

`docs/BACKLOG.md`, élément 356 (remplir le Profil) : l'orchestrateur y accorde la phrase sur la racine.

## Vérification

`npm run verif`. Banc : `profil`, `tutoriels` et `barre` contre HEAD : texte des pages identique (la plante était cachée), aucun échec, aucune erreur de console. Rapport : nombre de lignes retirées, ce qui a été déplacé vers le banc de poissons, champs de fichier gardés en lecture.
