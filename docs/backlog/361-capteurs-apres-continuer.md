# 361 · Enregistrer : après une coupure et « Continuer », la mesure des sauts reprend, et la ceinture injoignable se dit

Modèle | Réflexion : Opus | high. Suite du lot 360 (fiche `docs/backlog/360-ceinture-apres-fermeture.md`, à lire : même chemin de reprise, même journal). Décisions du domaine : `docs/DECISIONS.md` §3 (Sauts) et §6 (Enregistrement).

## Ce que l'utilisateur a vu

1. Le 13/11 sur la 0.00.40, puis sur la 0.00.43, capture d'écran à l'appui : après une fermeture de force de l'application en plein enregistrement puis « Continuer », la page Enregistrer affiche « Capteurs : la mesure ne reprend pas ; ce qu'ils ont mesuré avant la coupure est gardé. » Les sauts du reste de la session ne sont donc pas mesurés.
2. Essai 240 du lot 360, le 13/11 sur la 0.00.43, ceinture cardio éteinte au moment de « Continuer » : « j'ai toujours le même message d'erreur, capteur, la mesure ne reprend pas ». Le message attendu, « Ceinture cardio injoignable », n'est pas celui qu'il a vu. Avec la ceinture allumée, le même essai réussit (la fréquence cardiaque revient).

## Résultat attendu

- Après une coupure puis « Continuer » (et après une reprise seule), la mesure des capteurs reprend pour la suite de la session, ce qui a été mesuré avant la coupure est gardé, et les sauts d'après la coupure sont comptés. Plus de message « la mesure ne reprend pas » quand elle peut reprendre.
- Ceinture éteinte au moment de « Continuer » : le message « Ceinture cardio injoignable » se voit, et l'enregistrement continue.

## À établir avant de coder

- Pourquoi la capture des capteurs ne reprend pas. Piste de l'agent Plan du lot 360, pas vérifiée : Android ferme la capture avec la page de l'application, et « Continuer » ne fait que retrouver son fichier ; garder le réglage des capteurs dans l'en-tête du journal de l'enregistrement, comme la ceinture depuis le lot 360, relancer la capture en ajoutant au même fichier, et faire accepter un trou aux lecteurs du fichier (calcul des sauts compris).
- Pourquoi « Ceinture cardio injoignable » ne s'est pas vu à l'essai 240 : message masqué ou remplacé par celui des capteurs (un seul emplacement d'avertissement ?), message émis seulement après un délai de connexion que l'utilisateur n'a pas attendu, ou jamais émis sur ce chemin. Le dire avec le fichier et la ligne.

## Contraintes

- Règle 12 de `CLAUDE.md` : capteurs et ceinture uniquement par `src/platform/`.
- Règle 2 et règle 10 : le calcul des sauts tient sur un fichier de capteurs troué, sans supposer une cadence.
- Un ancien journal d'enregistrement, sans le réglage des capteurs dans son en-tête, garde le comportement d'aujourd'hui.
- Rien ne fait jamais renoncer à la reprise de l'enregistrement.

## Plan (agent Plan, 13/11, lu et retenu par l'orchestrateur)

Contexte : après une fermeture de force, Android détruit l'activité mais pas le processus. Les greffons des capteurs et de la ceinture sont recréés à la réouverture. La ceinture est redemandée depuis le lot 360 ; la capture des capteurs ne l'est jamais, son fichier `.imu` d'avant la coupure est seulement retrouvé à l'arrêt.

Cause 1, la capture ne reprend pas (lue dans le code) :
- `MotionPlugin.java:254-263` (`handleOnDestroy`) ferme la capture avec l'activité ; `recovery.ts:232` ferme aussi toute capture orpheline avant de remettre la session en attente.
- `useRecorder.ts:339-342` : « Continuer » se contente de `findMotionCapture` ; si le fichier existe il ajoute `CAPTURE_NOT_RESUMED` (ligne 97), ne relance rien, `measuringMotion` reste à faux.
- Rappeler `start` ne suffit pas : `ImuWriter.java:74` (`new FileOutputStream(file)`) écraserait le fichier, et la base de temps (`startNs`, `MotionPlugin.java:150`) repartirait de zéro.
- Reprise seule : `recovery.ts:149-157`, une capture qui ne tourne plus (`runningMotionCapture` rend `null`) n'est pas relancée non plus.
- Le journal ne garde pas les réglages de la capture ; le `.imu` les porte dans son en-tête (`setup`), avec les deux horloges (`clock`).

Cause 2, « Ceinture cardio injoignable » ne s'affiche pas : le message n'est jamais émis sur ce chemin, ni masqué ni retardé.
- `HeartRatePlugin.java:405-418` : `connect` répond « réussi » tout de suite puis cherche la ceinture ; il ne refuse que trois cas (`:384-400`) : permission refusée, adresse invalide, Bluetooth éteint. Une ceinture éteinte donne « connexion… » puis « recherche » sans fin (`dropped`, `:712-716`).
- Le message ne vient que de ce refus (`takeBeltOrWarn`, `watches.ts:149-155`). Celui des capteurs ne l'a pas remplacé : il s'ajoute à `state.error` (`useRecorder.ts:338-342`, `joinMessages`).
- La veille « FC perdue » ne s'arme qu'à la première mesure (`gpsWatch.ts:18-24`), décision du §6 : une ceinture jamais jointe n'est pas perdue.

### Partie A1 : la capture reprend (natif, plateforme, journal, reprise)

1. `ImuWriter.java` : un second constructeur qui ouvre le fichier en ajout, sans réécrire l'en-tête ; une fonction statique lit l'en-tête (marque, longueur, JSON) et repère la fin du dernier paquet complet en parcourant les longueurs ; le fichier est coupé à cette fin (`RandomAccessFile.setLength`) avant d'ajouter, sans quoi un paquet tronqué par la coupure décalerait la lecture de toute la suite.
2. `MotionPlugin.start` reçoit une option `append`. Fichier présent et en-tête lisible : on reprend ses flux et sa base de temps (téléphone non redémarré : `startNs = clock.elapsedUs × 1000`, ce qui se voit si l'écart des temps écoulés et l'écart des heures concordent à quelques secondes près, constante du greffon ; après un redémarrage la base se déduit de l'heure). Fichier absent : départ normal. En-tête illisible : refus, sans toucher au fichier. Une ligne au journal d'Android (`GtrackerMotion`) dit « reprise en ajout » ou « nouveau fichier ». `handleOnDestroy` garde son comportement.
3. Test JUnit dans `android/app/src/test/.../ImuFormatTest.java` : ajout après un paquet tronqué, puis relecture (passe par Gradle seulement, lancé par l'orchestrateur). Le format ne change pas : `outils/imu-reference.mjs` n'est pas à relancer.
4. `src/platform/motion.ts` (règle 12) : `continueMotionCapture(startedAtMs, setup)`, qui passe `append: true` ; il lève en navigateur, comme `startMotionCapture`. Commentaires de `runningMotionCapture` et d'`imuFile.ts` mis à jour : la capture reprise s'ajoute au même fichier, le trou entre les deux est voulu.
5. `src/recording/journal.ts` : `motion?: MotionSetup | null` dans l'en-tête, sur le modèle de `belt` (`journalHeaderLine`, relecture, `copyBelt`), écrit par `startRecording` (`useRecorder.ts:274`) à partir de `options.motion`.
6. « Continuer » (`useRecorder.ts:339`) : si `parsed.header.motion` existe, appel de `continueMotionCapture` ; réussite : `measuringMotion` et `motionSetup` ; échec : `CAPTURE_NOT_RESUMED`, et la reprise continue. Un ancien journal, sans `motion`, garde le comportement actuel. L'arrêt (`:510-518`) ne change pas.
7. Reprise seule (`recovery.ts:149`) : si aucune capture ne tourne et que l'en-tête porte `motion`, même appel ; session en pause manuelle : `pauseMotionCapture` juste après ; un échec affiche le message sans jamais faire renoncer à la reprise.

Tests A1 : `journal.test.ts` (en-tête avec `motion` relu à l'identique ; sans le champ, `undefined`) ; `useRecorder.resume.test.ts` (le faux greffon note `append` ; le test de la ligne 802 réécrit : nouveau journal, « Continuer », capture relancée en ajout, `measuringMotion` à vrai, même chemin à l'arrêt ; ancien journal : message actuel gardé ; échec de l'ajout : message, l'enregistrement continue ; reprise seule sans capture qui tourne : relancée, puis mise en pause si la session l'est ; capture qui tourne encore : suivie, jamais relancée).

### Partie A2 : lire un fichier de capteurs troué (noyau)

8. `imuVertical.ts` interpole sur une grille à travers les trous : un trou de plusieurs minutes fausserait l'attitude du téléphone et la moyenne de référence. Ajouter `measuredPieces(rec, breakS)`, à côté de `captureBounds` : la capture est coupée aux trous plus longs que `breakS`. `pruneWindows` (`jumps.ts:334`) et `capturedWindows` (`pumping.ts:431`, qui sert aussi aux vols et aux virages du surf) le prennent quand l'en-tête n'a pas de `windows`. Paramètre `captureBreakS` ajouté aux paramètres d'attitude (`sportProfiles.ts:248`), 5 s (règle 3). Sur un fichier sans trou, un seul morceau, rien ne change.
9. `SUMMARY_CALC_VERSION` ne change pas : les sauts sont rangés dans la fiche, pas recalculés, et le résultat est neutre sans trou.

Tests A2 : `imuFile.test.ts` (deux morceaux encodés séparés par un trou de 10 min, relus en ordre ; `measuredPieces` rend deux morceaux, un seul sans trou) ; `jumps.test.ts` (sauts avant et après un trou de 10 min, orientation du téléphone différente de part et d'autre ; même résultat à 100 et 200 Hz de capture, 1 et 5 Hz de GPS ; aucun saut dans le trou ; les tests existants, inchangés, prouvent la neutralité) ; pumping : vols de part et d'autre du trou. `synthImu` (`imuSynthetic.fixture.ts`) sait déjà faire des trous.

### Partie B : la ceinture qui ne revient pas (TypeScript seul, après la réponse de l'utilisateur)

À la reprise (« Continuer », `useRecorder.ts:338` ; reprise seule, `recovery.ts:163`), si le journal contient des mesures de fréquence cardiaque d'avant la coupure, la ceinture est traitée comme déjà jointe : `applyBeltWatch(gpsWatchOnFix(START_GPS_WATCH, now, beltWatchSettings(profile)))` juste après `takeBeltOrWarn`, ou `gpsWatchOnPause` si la session est en pause. Au bout de `beltLostDelayS` (1 min) sans mesure, l'alerte retenue par l'utilisateur se déclenche. Une ceinture jamais jointe garde la règle du §6. Tests : ceinture qui ne répond pas avec de la FC dans le journal (l'alerte vient après le délai), et sans FC dans le journal (aucune alerte).

À réutiliser : `takeBeltOrWarn`, `wireBelt`, `applyBeltWatch`, `beltWatchSettings`, `gpsWatchOnFix`, `gpsWatchOnPause`, `joinMessages`, `findMotionCapture`, `motionCapturePath`, `captureBounds`, `mergeWindows`, `encodeImu`, `synthImu`.

Banc : `node outils/banc/passe.mjs` (passage courant) pour prouver la neutralité des analyses ; aucun script à compléter, la capture n'existe que sur le téléphone.

### Tranché

- Par l'agent Plan : les réglages de la capture vont dans l'en-tête du journal, comme la ceinture ; la reprise s'ajoute au même fichier, même base de temps, le trou laissé tel quel aux lecteurs ; un fichier absent au moment de « Continuer » donne un départ neuf.
- Par l'orchestrateur : `captureBreakS` à 5 s est un paramètre technique du profil, pas un seuil que l'utilisateur règle ; le lot part en trois agents successifs (A1, A2, B), un seul sujet.
- Par l'utilisateur, le 13/11 (partie B) : quand une ceinture qui mesurait avant la coupure ne revient pas, la même alerte de fréquence cardiaque perdue qu'en pleine sortie, avec son signal sonore, au bout d'une minute sans mesure ; l'enregistrement continue.

## Essais au téléphone (à la fin)

Fermeture de force en plein enregistrement, « Continuer », puis un saut : il est compté. Le même essai ceinture éteinte : « Ceinture cardio injoignable » s'affiche et l'enregistrement continue.
