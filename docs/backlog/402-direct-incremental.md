# 402 · Chiffres du direct : un calcul qui ne reparcourt plus toute la trace

Modèle | Réflexion : Opus | high

## Origine

Revue globale du 15/11 (auditeur « calculs », sonde hors dépôt ; non relu par l'orchestrateur : vérifier le constat par une mesure avant de coder). Lire `docs/DECISIONS.md` §6.

## Constat

`src/recording/liveStats.ts:239-255` : chaque calcul du direct refait `buildCumulativeTrack`, la distance, le masque actif, la fréquence cardiaque (`heartPart`), la vitesse max (`bestWindowSpeedMs`) et le découpage des bords (`splitLiveLegs`) sur tout le segment en cours. `resumeKinematics` (`src/core/kinematics.ts`, vers 321 à 477) recopie huit tableaux entiers et refait trois passes complètes. Le calcul tourne toutes les 2 s page ouverte, 5 s sinon.

Mesure de l'auditeur, sur PC : 2,5 ms par calcul à 1 h, 8,9 ms à 2 h, 11 ms à 3 h ; 29 s de calcul cumulé sur 3 h. Extrapolé à 6 h au téléphone : environ 100 ms par calcul à la fin, 8 à 11 minutes de calcul écran allumé. C'est de la batterie, et un coût qui croît avec le carré de la durée. Répartition : bords 25 %, distance et cumuls 19 %, tops 10 %.

L'audit du 01/11 disait le direct « incrémental » : vrai pour la médiane et les distances entre points seulement.

## Attendu

Les cumuls (distance, temps actif, fréquence cardiaque, vitesse max) et les bords déjà fermés sont gardés jusqu'à un indice figé ; un calcul ne reparcourt que les points arrivés depuis, plus la fenêtre que les filtres peuvent encore modifier. Les chiffres du direct sont identiques à ceux du calcul complet : le filet existe (`src/recording/liveStats.test.ts:205-218` compare le calcul avec mémoire au calcul complet) et doit être étendu (pause et reprise, GPS perdu puis revenu, cadence variable, 1 Hz et 5 Hz : règles 2 et 10). Le résumé d'une session rangée ne change pas : `SUMMARY_CALC_VERSION` ne bouge pas, `library/summaryFrozen.test.ts` reste tel quel.

Un plan (agent `Plan`) avant de coder.

## Vérification

`npm run verif`. Mesure avant et après dans le rapport (sonde hors dépôt sur une trace de 3 h et de 6 h : temps par calcul et cumul). Banc : `carte-direct`, `gps-perdu`, `notification` contre HEAD. Un essai de terrain suffira à la prochaine sortie (les chiffres du direct se lisent comme avant) : pas d'essai dédié.
