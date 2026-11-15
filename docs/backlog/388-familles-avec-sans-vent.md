# 388 · Les deux familles s'appellent « Avec vent » et « Sans vent »

Modèle | Réflexion : Sonnet | high

## Demande (15/11)

« actuellement il y a deux familles d'activités, voile et surf. Je pense que ça n'a pas vraiment de sens, il faudrait plutôt faire avec vent, sans vent. Ce qui serait plus cohérent je pense sur l'ensemble. Et plus compréhensible. »

## Lecture de l'orchestrateur (dite à l'utilisateur)

- C'est le nom montré des deux familles qui change : « Voile » devient « Avec vent », « Surf » devient « Sans vent ». Le rangement des activités ne bouge pas : Wingfoil, Parawing, Windsurf, Windfoil, Kite, Kitefoil et Bateau avec vent ; Surf, Paddle, Surf foil et Pumping sans vent.
- Rien ne change dans le code ni dans les données : identifiants `voile` et `surf`, adresses `/voile/analyse` et `/surf/analyse`, fiches, fichiers, réglages, noms des calculs (« Surf » reste le nom de l'activité et du calcul).
- Anglais « Wind » et « No wind », espagnol « Con viento » et « Sin viento » (libellés courts : ils tiennent dans le bouton glissant « Famille » d'Enregistrer et dans la fenêtre de sélection des Statistiques).

## L'existant

- Le nom des familles vient d'un seul endroit : `FAMILY_LABEL` (`src/core/activities.ts`, `{ voile: t('Voile'), surf: t('Surf') }`). Attention : la clé `Surf` est aussi le nom de l'activité et du calcul Surf, qui ne change pas : il faut des clés neuves pour les familles.
- Usages : groupes de la liste d'activités (`components/ActivitySelect.tsx`), bouton glissant « Famille » d'Enregistrer, Réglages › Activités (nom de famille, œil, liste du calcul d'une activité créée), Statistiques (titre, résumé du choix, ligne des familles, fenêtre de sélection), et le libellé de repli du partage (`SavedSessionShare.tsx`, `SessionNameEditor.tsx`, `library/shareStats.ts` : titre et nom de fichier d'une session sans nom).
- Phrases qui citent la voile ou le surf comme famille (clés de `src/locales/`), à réécrire en français puis à retraduire : « Aucune activité de voile / de surf : ajoutez-en une dans Réglages », « …les ranger en voile ou en surf », « Gtracker ne range que la voile et le surf », « chaque famille (voile, surf) range ses activités », « (« matos et conditions » en voile) », « en voile, sans valeur, elles suivent l'allure de la session », « Analyse voile », « Analyse Surf », le tutoriel « La voile » et « Une session de voile s'analyse sans rien saisir… ». Faire le relevé complet par Grep (français dans le code, clés des dictionnaires) : cette liste n'est qu'un départ.

## Attendu

1. Partout où l'application nomme une famille, elle dit « Avec vent » ou « Sans vent » ; dans une phrase, « avec vent » / « sans vent » accordés au texte (« Aucune activité avec vent », « les ranger avec ou sans vent », « chaque famille (avec vent, sans vent) »).
2. Les titres des deux analyses : « Analyse avec vent » et « Analyse sans vent ».
3. Ce qui ne change pas : le nom des activités et des calculs (Surf, Surf foil, Planche à voile…), le mot « voile » quand il désigne la pièce de matériel (« Aile / voile », « Nom du matériel (voile, mât…) »), les noms d'onglets, et tout ce qui est écrit dans les fichiers, le journal et le GPX.
4. Libellé de repli du partage (titre et nom de fichier d'une session sans nom) : regarder ce que donne « Avec vent » ; s'il sert de nom de fichier, garder un nom de fichier sans surprise et le dire dans le rapport.
5. Dictionnaires anglais et espagnol à jour pour chaque clé neuve ou réécrite (une clé sans traduction fait échouer la vérification ; glossaire `docs/backlog/382-glossaire.md`, à compléter d'une ligne pour les deux familles) ; les clés qui ne servent plus sont retirées.
6. Tests et gardes : `src/architecture.test.ts`, `src/landWords.test.ts`, `src/heritage.test.ts` et les tests qui lisent ces libellés passent ; les identifiants ne changent pas. Tutoriels : le texte des leçons suit.
7. Banc : les scripts qui cliquent ou attendent « Voile » ou « Surf » comme nom de famille sont accordés (les relever par Grep dans `outils/banc/`) ; le texte des pages ne change que par ces deux noms.
8. La largeur : le bouton glissant « Famille » d'Enregistrer, les titres de Réglages › Activités et la ligne des familles des Statistiques tiennent à 320 px dans les trois langues.

Hors lot : `CLAUDE.md`, `docs/DECISIONS.md` et les autres documents (passe de doc après la validation de l'utilisateur).
