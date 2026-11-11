# 318 · Atelier remis à jour : Fable 5.2, /chaine, CLAUDE.md, renvois périmés

Analyse du 10/11/2026 (session Fable 5.2, trois agents de recherche), demandée par l'utilisateur avant toute reprise des lots. Ce fichier est le brief : il tient seul, sans la conversation.

| Modèle | Réflexion | Qui exécute |
|---|---|---|
| Sonnet | medium | conversation Sonnet ou agent général Sonnet (l'agent `lot` ne touche pas à `docs/` ni à `.claude/`) ; `outils/backlog.mjs` (partie E) : Sonnet medium aussi |

Rien dans `src/` ni `android/` : pas de version, pas d'APK, pas d'essai au téléphone. Lot « à valider sur lecture ».

## Verdict

`/chaine` tient debout : sa boucle concorde avec `docs/MODELES.md` et `CLAUDE.md` sur l'essentiel (paquets de 2 ou 3, limite de 3 lots avec essais, `Plan` pour les lots Opus high et Fable, relecture pour Opus et Fable, commit par l'orchestrateur). Fable 5.2 ne demande que trois retouches (partie A). Le vrai défaut est ailleurs : les documents que tous les agents chargent décrivent encore l'ancienne application à une vingtaine d'endroits (parties B et C).

## Trois décisions de l'utilisateur (Q102, Q103, Q104 de BACKLOG)

- **Q102, périmètre.** Par défaut : tout ce fichier sauf `docs/DECISIONS.md`, qui attend la validation des lots 302 et 303 (règle « doc après validation »). Autres choix : le faux seulement (parties A à C, sans D ni E) ; ou tout, DECISIONS compris, dès maintenant.
- **Q103, envoi sur GitHub par `/clore`.** Aujourd'hui `/clore` sans argument envoie (`clore/SKILL.md:13` et `:67`), alors que `CLAUDE.md:50`, `MODELES.md:61` et la mémoire `point-de-reprise-gtracker` disent « seulement sur accord, redemandé à chaque fois ». Par défaut : `/clore` n'envoie plus rien ; `/clore avec envoi` pour envoyer. Autre choix : garder l'envoi par défaut et reformuler la règle (« taper /clore vaut accord »).
- **Q104, effort de l'orchestrateur.** Par défaut : Fable 5.2 à `medium` pour tenir `/chaine`, `high` seulement si le paquet a un lot du noyau ou une question de produit ouverte ; à mesurer par `/usage` sur le premier paquet. Autres choix : rester à `high` ; ou Opus medium partout et Fable sur demande seulement.

**Réponses de l'utilisateur (11/11/2026) : les trois défauts**, avec le défaut de Q102 tel que la revue du 11/11 l'a changé. Q102 : tout, `docs/DECISIONS.md` compris, mais `CLAUDE.md` (partie C) et `DECISIONS.md` sont traités par le lot 331, pas ici. Q103 : `/clore` n'envoie plus rien, `/clore avec envoi` pour envoyer. Q104 : Fable 5.2 à `medium`, `high` si le paquet a un lot du noyau ou une question de produit ouverte. **Les compléments de la revue du 11/11 priment sur ce fichier là où ils le contredisent** : `docs/backlog/319-revue-apres-fork.md`, section « Lot 318 (compléments) ».

À noter aussi, sans question : `MODELES.md:67` dit « `model` : `opus` par défaut », les réglages globaux (`~/.claude/settings.json`) ont `"model": "fable"` et forcent `high` sur fable-5-2 et opus-5-5. MODELES doit décrire ce qui est ; ces réglages sont communs à Tracker complet : on ne les change que sur demande.

## A. Ce que Fable 5.2 change (vérifié le 10/11 sur code.claude.com/docs et anthropic.com/claude/fable)

- Alias `fable` → Fable 5.2 (Claude Code 2.1.321 ou plus) ; Opus 5.5, Sonnet 5.5, Haiku 5.5 inchangés. Aucun forfait n'a Fable par défaut.
- Effort par défaut de Fable 5.2 : `medium` (5.1 était à `high`). → `MODELES.md:3`, `:25`, `:69`, `chaine/SKILL.md:20` (selon Q104).
- Contexte d'un million de jetons, natif. → la règle d'arrêt « `/context` dépasse environ 60 % » (`chaine/SKILL.md:68`) voudrait dire 600 000 jetons : la remplacer par un seuil absolu (environ 200 000 jetons) ou « après une compaction ».
- Prix 5.2 : 8 $ / 40 $ par million (5.1 : 10 $ / 50 $). Le poids dans le quota de l'abonnement n'est pas documenté, et Fable peut partir en crédits selon le forfait. → retirer « Fable pèse environ 2,5 × Opus, 5 × Sonnet, 100 × Haiku » de `MODELES.md:3` (et de la mémoire `feedback-agents-economes`), le remplacer par « à mesurer par `/usage` après un paquet ».
- Qui code : rien ne change. La page de Fable conseille Opus 5.5 pour le code courant (FrontierSWE v2 : Fable 5.2 69,9 %, Opus 5.5 62,3 %, Fable 5.1 56,3 %). `lot` reste sur Opus, Fable garde noyau, audit, orchestration.
- Cache : une heure pour la conversation principale, cinq minutes pour les sous-agents. Un `SendMessage` à l'agent `lot` après verif et relecture lui fait relire tout son contexte : à dire dans MODELES (reste préférable à un agent neuf). Le conseil « point d'étape vers 45 minutes » (`chaine/SKILL.md:47`) reste juste.
- Nouveautés non retenues (partie F) : sous-agents qui en lancent d'autres (trois niveaux), `fork`, `model:` dans une commande (perd le cache), `CLAUDE_CODE_SUBAGENT_EFFORT`, `experimental.cacheTtl`.
- Ligne « Vérifié le 27/10/2026 … Claude Code 2.1.310 » (`MODELES.md:5`) à redater.

## B. Faux aujourd'hui dans `.claude/`

- « Tracker » pour ce dépôt, 16 fois : `chaine:3,10`, `clore:3,10`, `reprise:3,10`, `todo:3,10`, `lot.md:3,20`, `relecture.md:3,11`, `banc.md:11`, `Plan.md:11`, `Explore.md:12`, `doc.md:10` → « Gtracker ».
- Mémoire au mauvais nom : `reprise/SKILL.md:16` et `clore/SKILL.md:56` citent `point-de-reprise-cible-mobile.md` → `point-de-reprise-gtracker.md`.
- `banc.md:15` : ports 4191, 4190 et 9400 → 4195 (après), 4196 (avant), Chrome 9480 (`outils/banc/passe.mjs:29-39`, `outils/banc/LISEZMOI.md:12`).
- « règles d'architecture 1 à 12 » (`lot.md:24`, `relecture.md:16`) → 1 à 13.
- Tailles annoncées dépassées : ETAT « 88 Ko » → 125 Ko (`doc.md:14`, `Plan.md:13`) ; HISTORIQUE « 185 Ko » → 345 Ko (`doc.md:14`) ; INVENTAIRE « 70 Ko » → 105 Ko (`lot.md:31`, `Explore.md:14`, `doc.md:14`) ; SCRIPTS « 80 Ko, 82 scripts » → 74 Ko, 79 (`banc.md:11`). Mieux : ne plus donner de chiffre (« gros fichier, jamais lu en entier »).
- `lot.md:20,26` parle encore des briefs de la revue du 27/10 (§9 de `RAPPORT.md`, `lotN-brief.md`) : les briefs sont dans `docs/backlog/` ; garder une phrase au plus.
- `/chaine` :
  - `:35` renvoie à « §1 « Coût du vent » », introuvable dans le dépôt : retirer le renvoi ou citer la vraie règle (un lot dont la fiche dit « seul dans sa session ») ;
  - `:32` « pas de lien `node_modules` à poser » contre `:37` « si `<worktree>/node_modules` est un lien, le retirer » : garder la consigne de prudence de `:37` en la disant « s'il en reste un d'une ancienne session » ;
  - `:45` demande à `Plan` 60 lignes au plus, `Plan.md` ne le dit pas : l'écrire dans `Plan.md`.
- `/clore` : `:31` augmente la version « si `src/` a changé », `/chaine:52` et `lot.md:61` disent « `src/` ou `android/` » → aligner sur ces derniers. Envoi : selon Q103.
- `MODELES.md:34` « `/clear` entre deux lots » et `:31` « relancer dans une conversation neuve » valent hors chaîne ; `/chaine` enchaîne plusieurs lots et relance par le paramètre `model` : préciser « hors mode chaîne ».
- `MODELES.md:16` range « APK » parmi les lots Sonnet en conversation, `/chaine:66` la fait construire par l'orchestrateur à l'arrêt, `/clore` ne la construit jamais : dire une seule chose (l'orchestrateur à l'arrêt du paquet).
- `MODELES.md:73` (« Autres leviers, à décider ») mêle du fait et de l'ancien : le réduire à ce qui reste à décider, ou le supprimer.
- Hors `.claude/`, vus au passage : `outils/LISEZMOI.md:3` dit « port 5173 » (c'est 5174), `outils/banc/lib/cdp.mjs:10` a 5173 par défaut.

## C. Faux aujourd'hui dans `CLAUDE.md` (terre retirée aux lots 301 à 305, nom de l'application)

Tous les fichiers et identifiants cités existent encore ; ce sont les phrases qui sont fausses.

- `:5` titre « # Tracker » → Gtracker ; `:50` dépôt `segneur34/Tracker` → `segneur34/Gtracker`.
- `:7` « bibliothèque `/fractionne` gardée en lecture » : `src/App.tsx:114-119` redirige `/fractionne*` vers `/`.
- `:11`, `:96`, `:99` : sections « course et vélo » et « fractionné » de DECISIONS (titres à revoir avec la partie DECISIONS, selon Q102).
- `:78` famille et traitement : « énergie, vélo, altitude, revêtement », « le fractionné les distingue » : `Treatment` et `SportFamily` valent tous deux `'voile' | 'surf'` (`core/sportProfiles.ts:683-714`).
- `:83` surbrillances « zone de pente, répétition » : `components/highlightColors.ts` n'a plus que podium, bâbord/tribord, balise.
- `:85` et `:111` : poids du vélo et charge portée comme données de session et réglages : reliques sans lecteur (`settings/activitySettings.ts:165-169`), lecture de compatibilité seule dans `library/record.ts:323-329, 597-598`.
- `:110` « lissée sur 15 s à pied et à vélo » : `core/trackColor.ts:19` donne `{ voile: 0, surf: 0 }` ; renvois « §1, §2, §4 » → §1 et §4 (aussi `:112`, `:113`, `:114`, `:117`).
- `:112` « (et « fractionné » en famille Fractionné) » : `SPORT_FAMILIES = ['voile','surf']`.
- `:115` activités de départ « Course », « Marche », « Route », « Gravel », « VTT », « Fractionné… », « Tests » : `DEFAULT_ACTIVITIES` n'a que Voile, Surf, Surf foil (`core/activities.ts:92-96`).
- `:120` « logo en Shrikhand », couleurs « rouge à pied, vert vélo, orange fractionné », ordre « Voile, À pied, Vélo, Surf, Fractionné » : logo GONG depuis le lot 310, `FAMILY_SHADES` et `tokens.css` n'ont que voile et surf.
- `:121` « l'accueil par le logo « Tracker » » : `components/AppShell.tsx:186-188` affiche `GongLogo` + « Gtracker ».

`docs/DECISIONS.md` (selon Q102 ; le lot 308 prévoit déjà de retirer §2 et §5) : `:34` (§2, terre), `:55` (§3, sauts « en course et à vélo »), `:73` (§5, page Entraînement), `:86` (§6, « Arrêter » du compteur d'intervalles), `:126` (§8, dossier portable `Tracker/` : c'est `Gtracker`, `platform/memoryFolder.ts:182`).

Écart à vérifier à la relecture du lot 301 : `BACKLOG.md` (ligne du 301) dit les lecteurs `bikeWeightKg` et `loadKg` « retirés de `record.ts` » ; une lecture de compatibilité y reste (`library/record.ts:323-329, 597-598`). Voulu (bruts gardés) ou oubli ?

## D. Une seule place par règle (doublons)

- Boucle du mode chaîne : `/chaine` fait foi. Réduire la section « Mode chaîne » de `MODELES.md:59-63` à trois lignes de renvoi (démarrage, clôture, « la boucle est dans `/chaine` »), et garder le paragraphe sur le choix de Fable comme chef d'orchestre. `CLAUDE.md:50` et `clore/SKILL.md:10` renvoient alors à `/chaine`, pas à MODELES.
- Règles du BACKLOG : `CLAUDE.md:122-125` répète l'en-tête de `BACKLOG.md:3-9` → une ligne dans CLAUDE.md (« règles dans son en-tête ; ce que l'utilisateur lit ne porte aucun jargon »).
- Essais au téléphone : `CLAUDE.md:53` et `:124` disent la même chose dans le même fichier → garder `:53`.
- « Mauvais modèle, à dire » : `CLAUDE.md:57`, `MODELES.md:35`, `reprise:26`, `chaine:20` → la règle dans MODELES, une phrase de renvoi ailleurs.
- Commandes de vérification : `CLAUDE.md:20-31,40` et `MODELES.md:11,14,48` → CLAUDE.md fait foi, MODELES ne garde que la ligne du tableau.
- Description des agents : `MODELES.md:41-46` recopie leurs en-têtes → une ligne par agent (rôle seulement), modèle et effort se lisent dans l'en-tête.
- Bloc « Lots en parallèle » de `/chaine` (`:30-38`, un tiers de la commande, chargé à chaque `/chaine`) → fichier voisin `.claude/skills/chaine/parallele.md`, lu seulement quand Ensuite a 2 ou 3 lots prêts ; dans `SKILL.md`, deux lignes (quand, et « lire parallele.md avant »).

## E. Deux garde-fous

- **Relecture jamais sautée en silence.** Le 08/11, le lot 305 a été commité « à valider » sans relecture (quota), et le tableau de bord ne le montre pas. Dans `/chaine` et `/clore` : un lot Opus ou Fable commité sans relecture porte l'état « à valider, relecture due » ; `outils/backlog.mjs` l'affiche dans Alertes et dans le bloc Claude (« relecture due : lot N »). La limite de 3 lots avec essais ne se lève plus en cours de paquet sans l'écrire dans Maintenant (le 08/11 : 5 lots, 12 essais d'un coup).
- **Fichier de plan.** Le mode plan écrit dans `~/.claude/plans`, que `.claude/settings.json` refuse (dossier de Tracker complet) : chercher le réglage du projet qui range les plans dans le dépôt (nom supposé `plansDirectory`, à vérifier dans la doc des réglages avant de l'écrire), par exemple vers `.claude/plans/` ignoré par git.

## F. Ce qu'on ne fait pas, et pourquoi

- Pas de découpage de `CLAUDE.md` en `.claude/rules/` avec `paths:` ni en imports `@fichier` (les imports n'allègent pas le contexte ; CLAUDE.md fait 125 lignes, sous les 200 conseillées, et les parties C et D le raccourcissent).
- Pas d'agent « chef de lot » qui lancerait `lot`, `relecture` et `banc` à la place de l'orchestrateur : une couche à froid de plus, avec un cache de cinq minutes, pour des étapes que la conversation fait en quelques lignes.
- Pas de `model:` dans les commandes (change de modèle en cours de tour, perd le cache).
- Raison commune : tout l'atelier (`.claude/`, BACKLOG, MODELES, CLAUDE.md) est retiré ou réécrit à la livraison (lot 308) ; l'effort ne serait pas amorti.

## Ordre d'exécution

1. Lire les réponses à Q102, Q103, Q104 (ou prendre les valeurs par défaut).
2. Parties B et C : corrections de texte, fichier par fichier, en vérifiant chaque `fichier:ligne` (les numéros datent du 10/11).
3. Partie A : `MODELES.md` et `chaine/SKILL.md`.
4. Partie D, puis E (`outils/backlog.mjs` : garder la sortie actuelle, ajouter l'alerte ; `node outils/backlog.mjs` sans erreur de forme).
5. Mémoires de Gtracker (`~/.claude/projects/D--gong-tracker-Gtracker/memory/`) : `feedback-agents-economes` (rapport de poids), `fable-orchestre-opus-sonnet-ecrivent` si l'effort change (Q104).

## Vérification

- `npm run verif` (les renvois des documents y sont contrôlés : fichiers cités, carte d'INVENTAIRE) ; `node outils/backlog.mjs`.
- Grep : plus de « Fable 5.1 », de `cible-mobile`, de `4191`, de `segneur34/Tracker`, ni de « dépôt Tracker » dans `.claude/`, `CLAUDE.md`, `docs/MODELES.md`.
- Une session neuve ouverte dans `D:\gong tracker\Gtracker` : `/reprise` trouve sa mémoire et rend son compte rendu sans écart signalé sur l'atelier.
- Commit de doc unique ; rien à essayer au téléphone.
