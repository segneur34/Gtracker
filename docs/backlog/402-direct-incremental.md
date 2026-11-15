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

## Plan (agent `Plan`, 15/11, lu par l'orchestrateur : aucune question pour l'utilisateur, les chiffres restent identiques)

**Constat revérifié.** Un seul appelant, `src/hooks/useLiveRecording.ts` (vers 147) ; rien dans `src/hooks/recorder/`, aucune ligne du lot 403 à toucher. Déjà gardé d'un calcul à l'autre : le résultat d'un segment fermé ou inchangé, la conversion des points bruts, la cinématique reprise, les « derniers mètres ». Refait en entier sur le segment en cours dès qu'il s'allonge (`recording/liveStats.ts`, vers 239 à 256) : `buildCumulativeTrack` et la distance, `thresholdActivityMask` et les `computeActive*`, `heartPart`, `bestWindowSpeedMs`, `splitLiveLegs` (`liveLegs.ts`), le `filter` des tops récents. `resumeKinematics` (`core/kinematics.ts`) recopie des tableaux entiers et refait des passes complètes (`some`, `samePrefix`, `withSorted`, préfixe recopié dans `core/speedFilter.ts`). La clé d'options contient `activeThreshold` : un changement de seuil jette aussi la cinématique. Les positions rattrapées du journal du service remplacent `session.fixes` par des objets neufs : les contrôles d'identité font tout repartir de zéro, ce qui est correct et doit le rester.

**Principe.** Chaque calcul complet devient une machine à états qu'on reprend : on part d'un état, on traite un point, on photographie l'état ; la fonction complète est cette même machine lancée depuis zéro. L'égalité stricte vient de la construction (mêmes additions, même ordre), jamais d'une formule recalculée autrement : les sommes glissantes (`meanFilterByTime`, `heartRateStats`, `cumDist`, `stepSums`) sont sensibles à l'ordre.

**État gardé par segment, à un indice figé C** : `cumDist` et `cumTime` tronqués puis prolongés ; l'automate du masque et les sommes actives ; le balayage des fenêtres de vitesse max (meilleure fenêtre résolue, premier début non résolu) ; l'automate des bords, les bords fermés, `stepSums`, les cumuls et le balayage du bord ouvert ; la FC avec son propre indice (filtre, suite en cours, sommes), photographiée seulement à un point dont la fenêtre de lissage est fermée par le temps. C n'est pas une marge inventée : `runKinematics` expose `frozenUpTo`, l'indice de la prochaine reprise ; l'état vaut si `run.track[C-1]` est le même objet qu'à la photographie. Les bornes sont en temps ou viennent de la cinématique (règles 2 et 10) ; `gapDistanceM` ne dépend que de deux points voisins (règle 6).

**L'état est jeté** quand le préfixe d'objets diffère (rattrapage du journal, enregistrement plus court), au segment neuf, au profil ou à l'activité changés, quand `track[C-1]` a changé (unité Doppler qui bascule). Options seules changées (seuil, unité) : les statistiques sont refaites, la cinématique gardée (clé séparée).

**Partie A, côté direct** : `core/sessionStats.ts` (automate du masque reprenable, signatures gardées), `core/topSegments.ts` (balayage reprenable), `core/speedFilter.ts` et `core/heartRate.ts` (filtre moyen et sommes reprenables), `core/kinematics.ts` (le champ `frozenUpTo` seulement), `recording/liveLegs.ts` (machine à états, max du bord ouvert incrémental), `recording/liveStats.ts` (état figé par segment, tops récents par dichotomie, clé séparée ; au-delà de 400 lignes, la partie segment dans `recording/liveSegment.ts`). Tests : « repris à un indice tiré au hasard = calcul entier » en `toEqual` dans les tests de chaque module ; le filet de `liveStats.test.ts` étendu, à 1 Hz et 5 Hz : avec `activeThreshold`, GPS perdu 40 s puis revenu, cadence de 1 à 15 s avec un virage en un seul pas, sans Doppler, dates égales, Doppler en km/h dont l'unité se tranche au dixième point, bord ouvert de 20 min, pause puis reprise dans le même appel.

**Partie B, `resumeKinematics` sans copie** (`core/kinematics.ts`, `core/speedFilter.ts`) : tableaux tronqués puis prolongés sur place, vitesses dérivées et caps gardés, reprise refaite depuis la fin seulement, médiane des rapports lue sans fusionner les tableaux triés ; le `previous` passé est consommé (à écrire dans la documentation de la fonction, et à vérifier dans `kinematics.test.ts`, qui réutilise un même `run`). Test à ajouter : départ immobile à positions identiques, Doppler non nul ; `firstBearing` peut y changer après coup alors que le début de la trace est réutilisé : si le test le confirme, le direct est corrigé pour rejoindre le calcul complet (le résumé ne change pas).

**Mesure** (dix minutes au plus, sonde dans le dossier temporaire) : copie de l'avant par `git archive HEAD src`, deux sondes empaquetées par `rolldown` depuis le dépôt, trace synthétique de wingfoil de 6 h à 1 Hz (Doppler, FC, virement toutes les 90 s, pause à 2 h 30, trou de 40 s à 4 h, seuil passé), un calcul toutes les 2 positions ; relever le temps médian par calcul avant 1 h, 3 h et 6 h, le cumul à 3 h et 6 h, et l'égalité stricte avec le calcul sans mémoire ; avant A, après A, après B.

**Partie B, faite (15/11).** Tableaux de la reprise tronqués puis prolongés sur place (dates, pas, vitesses et caps ajustés et finals, sauts, vitesse brute, écrêtage, médiane, trace) ; médiane des rapports d'unité lue sans fusion ; vitesse appareil cherchée dans les points neufs ; même tableau de points allongé : préfixe non relu. Écart d'avant corrigé dans la reprise : départ immobile (premier cap connu tard) et longue suite de trous (le cap d'un point de trou suit le pas suivant, de proche en proche) ; la reprise refait maintenant vitesses et caps depuis `adjustStart`/`finalStart`, et l'écrêtage, les rapports et `frozenUpTo` se figent avant. Mesure à 6 h : 0,13 ms par calcul à la fin, 1,0 s de cumul (0,83 ms et 3,7 s avant). Reste O(n) mais bon marché : insertion des rapports (Doppler), `samePrefix` des positions dans `liveStats.ts`.

Hors du lot : `liveReferenceSpeedMs`, refait en entier toutes les 60 s (à noter si la mesure le voit).

## Vérification

`npm run verif`. Mesure avant et après dans le rapport (sonde hors dépôt sur une trace de 3 h et de 6 h : temps par calcul et cumul). Banc : `carte-direct`, `gps-perdu`, `notification` contre HEAD. Un essai de terrain suffira à la prochaine sortie (les chiffres du direct se lisent comme avant) : pas d'essai dédié.
