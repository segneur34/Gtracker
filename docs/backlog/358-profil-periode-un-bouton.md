# 358 · Profil : un seul bouton de période

Demande de l'utilisateur du 13/11 : « enlever le choix de la durée d'analyse […] année en cours ou tout, un bouton, et le choix de base c'est année en cours, avec le numéro de l'année ». Réponse du 13/11 : deux états seulement au Profil, « Année 2026 » et « Tout » ; les Statistiques ne changent pas. Petit lot, Sonnet/medium.

## Ce qui est demandé

- Sur le Profil (`src/pages/ProfilePage.tsx`, aujourd'hui un `SegmentedControl` de cinq périodes, `PROFILE_PERIODS`, vers les lignes 67 et 247), les cinq pastilles disparaissent. À leur place, **un seul bouton en pilule** qui affiche la période en cours et bascule au toucher entre l'année civile en cours, titrée « Année 2026 » (le numéro vient de la date du jour), et « Tout » (depuis le début).
- Au départ : l'année en cours. Le choix reste mémorisé comme aujourd'hui (`rememberView`, clé `periode`).
- Une période mémorisée qui n'existe plus au Profil (semaine, 30 jours, 6 mois) retombe sur l'année en cours, sans erreur.
- Tout ce qui suit la période sur le Profil (chiffres, graphe d'activité, dernières sessions si elles en dépendent) continue de la suivre.
- **Statistiques inchangées** : la page garde ses cinq périodes ; ne rien retirer de `CHART_PERIODS` ni de `library/stats.ts` qui lui sert.
- Le bouton : une pièce de `components/ui` existante si elle convient, pilule dans sa casse, variables de `tokens.css`, lisible au lecteur d'écran (son libellé dit la période montrée et ce que fait le toucher). Téléphone, téléphone tourné et ordinateur.

## Documents

- `docs/DECISIONS.md` §9 : la phrase sur les cinq périodes du Profil est remplacée par la nouvelle décision, datée du 13/11 (les Statistiques gardent leurs cinq périodes). C'est la seule édition de documentation de ce lot.

## Règles

- Ne pas toucher aux fichiers du lot 359, qui tourne en même temps dans le même dossier : `src/components/CollapsibleSectionTabs.tsx`, `src/pages/analysisMobile.css`, `src/pages/RecordingPage.tsx` et leurs styles. Jamais de `git stash`, `checkout`, `restore`, `clean` ni `reset` ; un échec de test hors de ses fichiers se signale, il ne se corrige pas.
- Pas de commit, pas de version, pas de décision de l'utilisateur.

## Vérification

- Tests des fonctions pures touchées, s'il y en a (repli d'une période mémorisée inconnue).
- `node outils/verif.mjs --rapide` vert.
- Banc : dire dans le rapport quels scripts de `outils/banc/` voient le Profil et s'ils touchent aux pastilles de période ; adapter le script qui les touche, sans lancer le banc (l'orchestrateur le passe).

## Essai au téléphone (posé par l'orchestrateur)

Le Profil montre un bouton « Année 2026 » ; le toucher passe à « Tout » et les chiffres suivent.
