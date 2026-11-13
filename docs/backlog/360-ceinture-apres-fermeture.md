# 360 · La ceinture cardio ne revient pas après une fermeture de force

Bogue vu deux fois par l'utilisateur le 13/11 sur la 0.00.40 (Xiaomi, Android 16) : « la ceinture cardiaque ne s'est jamais reconnectée après avoir coupé l'application alors que j'arrivais à la trouver dans les paramètres de l'application », puis « j'ai refait des tests et même problème ». Cause pas encore établie : la trouver d'abord, corriger ensuite.

## Les faits relevés

Pièces hors dépôt, à lire : `D:\memoire Tracker\essais\360-ceinture-apres-fermeture\` (`journal-essai-1652.txt`, le journal du téléphone filtré sur la ceinture et le moteur de la page ; `capture-1652.jpg`, l'écran de l'utilisateur ; la mini-session de 16 h 37 et son journal d'après coup).

1. Session de 16 h 37 : fréquence cardiaque sur les 31 premiers points, jusqu'à la coupure, puis plus aucune sur les 91 suivants ; l'enregistrement reprend neuf secondes après la coupure.
2. Second essai, journal de 16 h 51 à 16 h 54 :
   - 16 h 51 min 32 s : départ d'un enregistrement, la ceinture est trouvée par la recherche et jointe ;
   - 16 h 52 min 17 s : « Renderer process crash detected » : la fermeture de force ne tue pas le processus de l'application (même numéro de processus avant et après, les lignes de la ceinture en viennent toujours), seulement le moteur de la page ;
   - 16 h 52 min 34 s, capture d'écran : enregistrement en cours (« Pause », « Arrêter »), message « Capteurs : la mesure ne reprend pas ; ce qu'ils ont mesuré avant la coupure est gardé. », pas de tuile BPM. Ce message est `CAPTURE_NOT_RESUMED`, posé par « Continuer l'enregistrement » (`continuePendingSession`, `src/hooks/useRecorder.ts`) : l'utilisateur dit bien avoir vu l'écran des trois boutons et touché « Continuer » ;
   - entre 16 h 52 min 17 s et 16 h 52 min 55 s : **aucune ligne de la ceinture**, donc aucune demande de connexion côté Android, ni recherche, ni refus, ni message « Ceinture cardio injoignable » à l'écran ;
   - 16 h 52 min 55 s : second départ normal, la ceinture est de nouveau trouvée et jointe ;
   - 16 h 53 min 12 s et 16 h 53 min 31 s : deux autres fermetures ; plus aucune ligne de la ceinture ensuite.
3. Dans le code, « Continuer » demande pourtant la ceinture : `effectiveHeartRate(activity) ? savedBelt() : null`, puis `takeBelt`. Le journal dit que cette demande n'arrive pas jusqu'au greffon.

## Pistes, aucune vérifiée

- La ceinture d'un départ normal vient de la page (`options.heartRate`, case de la page Enregistrer), celle de « Continuer » du seul réglage rangé : si la case de la séance n'est pas un réglage rangé, ou si l'activité relue du journal ne retrouve pas le sien, `belt` vaut `null` sans rien dire.
- `holdBelt` (`src/platform/heartRate.ts`) ne demande la connexion que pour le premier preneur ou un état éteint ; l'ordre entre `stopOrphans` (qui coupe la ceinture restée sans preneur), le préchauffage de la page (`useBeltWarmup`) et « Continuer » peut laisser la ceinture coupée alors que l'enregistreur la croit tenue.
- La reprise seule (`resumeSilently`, `src/hooks/recorder/recovery.ts`) ne fait que reprendre une liaison que le greffon tient encore (`adoptBelt`) ; s'il n'en tient plus, elle continue sans ceinture, sans la redemander et sans message. Défaut réel, lu dans le code, même s'il n'est peut-être pas celui de ces essais.

## Ce qui est demandé

1. Établir la cause de la panne vue (les faits ci-dessus doivent tous s'expliquer), par lecture du code et par un test qui la reproduit.
2. Corriger : après une coupure, que la session reprenne seule ou par « Continuer », la ceinture qui mesurait avant la coupure est redemandée ; si elle ne peut pas l'être, un message le dit (« Ceinture cardio injoignable… »), jamais le silence ; sa veille (« ceinture perdue ») est armée comme à un départ. Un échec de la ceinture ne fait jamais renoncer à la reprise ni perdre la trace.
3. Corriger aussi la reprise seule (troisième piste), même si elle n'est pas la cause.
4. Les capteurs (« la mesure ne reprend pas ») : dire en trois lignes pourquoi la capture ne peut pas reprendre après « Continuer » et ce qu'il faudrait pour qu'elle reprenne ; ne rien coder là-dessus, ce sera un autre élément.
5. Ajouter au journal du greffon une ligne à chaque demande de connexion et de coupure reçue de la page (`connect`, `disconnect`), pour que le prochain relevé se lise sans deviner.

## Règles

- `docs/DECISIONS.md` §6 (Enregistrement) avant de toucher ; règle 12 de `CLAUDE.md` (la ceinture ne passe que par `src/platform/`).
- Tests sur fonctions pures et faux greffon, comme les tests voisins de la reprise.
- Pas de commit, pas de version, pas de décision de l'utilisateur.

## Essais au téléphone (posés par l'orchestrateur)

Ceinture mise, enregistrement, fermeture de force, « Continuer » → la fréquence cardiaque revient en quelques secondes.
