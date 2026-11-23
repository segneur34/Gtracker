# 496 · Ne rien perdre à la fermeture, dire les coupures : plan retenu

Plan de l'agent Plan du 23/11, confronté par l'orchestrateur. Brief : section 496 de `493-relecture-avant-vente.md`. Trois parties codées en parallèle, dans trois copies de travail, sans fichier commun. Noms fixés d'avance entre A et B : le pont expose `surFermeture(rappel)` ; canaux `coquille:fermeture` (coquille → page) et `coquille:fermeturePrete` (page → coquille).

## Partie A : la page (`src/`), constats A-03 et A-05

A-03, `src/hooks/recorder/recovery.ts:recoverOnce` : récupérer `catchUp` de `catchUpJournal` (vers l. 443) ; si `pending` existe et `!canContinue`, poser `error` (au lieu de `null`) par un petit assistant local :
- `guardStop.reason === 'still'` : « Enregistrement arrêté seul à {heure} : application fermée, le téléphone n'avait pas bougé depuis une heure. »
- `'timeout'` : « Enregistrement arrêté seul à {heure}, 12 h après la fermeture de l'application. »
- sinon : « Enregistrement interrompu à {heure} : le téléphone ou l'application s'est arrêté, la trace s'arrête là. »
L'heure vient de `core/units.ts` (`formatTimeOfDay`, signature à vérifier), sur `guardStop.atMs`, sinon sur la dernière position. Textes par `t`, clés dans `en.json` et `es.json`. `finishPendingSession` transmet déjà le message (`startRanging(false, state.error)`) et `AnalysisShell:RecorderNotice` l'affiche.

A-05, écritures différées. Chemin d'une saisie : `scheduleRecordWrite` attend 800 ms, puis `writeRecordNow` (`writeQueue`) ; réglages par `settingsTimer` (2 s), cache par `flushCacheUpdate`, brouillons et clés de l'appareil par `jsonStore` (`settleStoredWrites`).
- `src/hooks/sessionLibrary/recordWrites.ts` : exporter `settleRecordWrites()`, qui attend toutes les écritures de `writeQueue` (aujourd'hui `flushWrites` n'attend pas une écriture déjà en vol).
- `src/hooks/sessionLibrary/lifecycle.ts` : exporter `flushBeforeExit()` : `flushWrites()`, `settleRecordWrites()`, vidage du magasin de brouillons (`sessionDraftStore`, accès au singleton à vérifier), `settleStoredWrites()` ; sortie par le point d'entrée `useSessionLibrary`.
- `src/platform/backButton.ts:installBackButton(keepAlive, canLeave, beforeExit?)` : si la réponse est `'none'` et que rien ne garde l'application en vie, attendre `beforeExit()` sous un plafond nommé `EXIT_FLUSH_MAX_MS = 3000`, puis `App.exitApp()` ; un drapeau empêche deux sorties. La mise en arrière-plan reste couverte par `visibilitychange` (`lifecycle.ts:259`).
- `src/platform/desktopBridge.ts` : `onDesktopClose(task)`, branché sur `bridge.surFermeture` s'il existe (sans effet sur une coquille plus ancienne) ; `src/boot.tsx` branche `flushBeforeExit` sur les deux.

Fichiers de A : src/hooks/recorder/recovery.ts, src/hooks/useRecorder.resume.test.ts (chemin à vérifier), src/locales/en.json, es.json, src/hooks/sessionLibrary/recordWrites.ts, lifecycle.ts, src/hooks/useSessionLibrary.ts, src/hooks/sessionDraftStore.ts, src/platform/backButton.ts, backButton.test.ts, src/platform/desktopBridge.ts, src/boot.tsx, et le test du vidage (dans le test existant de recordWrites ou de lifecycle).

Tests de A : `useRecorder.resume.test.ts` (« 20 min, coupure, réouverture 40 min après » : `state.error` contient l'heure ; cas `guardStop` still et timeout ; « Continuer » possible : aucun message) ; `backButton.test.ts` (`exitApp` après `beforeExit`, et après le plafond si la tâche pend) ; `settleRecordWrites` attend une écriture en vol.

À vérifier par l'agent de A : `stopOrphans` n'efface pas le journal du service avant le second `catchUpJournal` (sinon `guardStop` est perdu après l'échec de `resumeSilently`) ; `startRanging` garde le message transmis après un rangement réussi ; la carte d'Enregistrer montre `state.error` (session « à classer »).

## Partie B : la coquille (`bureau/`), constats A-05 et A-07

- `bureau/preload.ts` : `surFermeture(rappel)` : sur `coquille:fermeture`, attendre le rappel, puis `ipcRenderer.send('coquille:fermeturePrete')`, échec compris.
- `bureau/main.ts` : sur `close`, si `!vidageFait` et que la page vit : `preventDefault`, envoi de `coquille:fermeture`, attente de la réponse ou d'un plafond de 5 s, `vidageFait = true`, puis `fenetre.close()`. Le passage par `will-prevent-unload` (question du brouillon) reste le même ; une réponse « Rester » remet `vidageFait` à faux. Chaque étape va au `journal()`.
- A-07 : sur `render-process-gone`, raison autre que `clean-exit` et aucune fermeture en cours : recharger `ADRESSE_ACCUEIL`, au plus 3 fois en 10 min (comme `MainActivity.reloadAfterRendererGone`) ; au-delà, boîte « La page s'est arrêtée : relancer ? ». Le compte va dans un fichier neuf et pur, `bureau/rechargement.ts`. Dans `raccourcis()`, Ctrl+R et F5 font `webContents.reload()` (le `beforeunload` du brouillon joue).

Fichiers de B : bureau/main.ts, bureau/preload.ts, bureau/rechargement.ts et rechargement.test.ts (nouveaux), le test qui garde les noms des canaux égaux (sans doute bureau/pont.test.ts). `docs/INVENTAIRE.md` (ligne du fichier neuf) est écrit par l'orchestrateur. Le banc (`outils/banc/exe-fermeture.mjs` : renommer une session, demander la fermeture aussitôt, relancer, le nom est sur le disque, le journal dit « écritures vidées ») est adapté plus tard, par un autre agent.

À vérifier par l'agent de B : la configuration de compilation de `bureau/` pour un fichier neuf ; `contextBridge` rend bien la promesse du rappel.

## Partie C : le service Android et le profil, arrêt seul « sans bouger »

La règle est dans `android/.../ClosedGuard.java` (`onFix`, `check`). Rayon et délais viennent de `src/core/sportProfiles.ts:DEFAULT_RECORDING` (200 m, 3600 s, 12 h), passent par `src/hooks/recorder/live.ts:sourceOptions`, `src/platform/location.ts` (`service.guardStill*`), `RecordingPlugin.java:210` (`numberOr`), `RecordingService.Settings` (bundle), `new ClosedGuard(...)` (l. 511). Le service ne reçoit aujourd'hui aucune vitesse ; il a pourtant la vitesse Doppler de chaque position (`toFix`, l. 337, `FixLog.Fix`), que `guard.onFix` (l. 562) ne reçoit pas.
- `guardMovingSpeedMs`, calculé dans `sourceOptions` à partir du profil du calcul de l'activité : `fromDisplaySpeed(getActiveThresholds(profile, profile.stillThreshold).enter, profile.thresholdUnit)` : 1,5 nd (0,77 m/s) en voile, 3 km/h (0,83 m/s) en surf. C'est déjà le seuil de sortie d'un arrêt complet du noyau (`core/sessionStats.ts:thresholdMaskOptions`) : rien de neuf.
- `guardMovingHoldS: 5` dans `RecordingProfile` et `DEFAULT_RECORDING` : constante d'algorithme commune, envoyée comme les autres durées.
- `ClosedGuard.onFix(now, lat, lon, acc, speedMs)` : une position qui prouve (même test d'incertitude, au plus le rayon) avec `speedMs` ≥ seuil ouvre `movingSinceMs` ; une position en dessous, ou sans vitesse (NaN), le referme ; si `now - movingSinceMs >= hold`, `anchorSinceMs = now` et l'ancrage se remet sur la position. La durée se compte en temps, jamais en points (règles 2 et 10). `check` et la règle des 12 h ne changent pas.
- Le service passe la vitesse de la position (champ de `FixLog.Fix` à vérifier) ; Bundle, `RecordingPlugin.numberOr("guardMovingSpeedMs")`, durée par `secondsToMs`. Une valeur nulle éteint le critère (comportement d'avant).

Fichiers de C : android/app/src/main/java/io/github/segneur/gtracker/ClosedGuard.java, RecordingService.java, RecordingPlugin.java, ClosedGuardTest.java (sous android/app/src/test/, à vérifier), src/core/sportProfiles.ts (champ et commentaire « sans bouger »), sportProfiles.test.ts, src/hooks/recorder/live.ts, src/platform/location.ts, location.test.ts, src/platform/nativeConstants.test.ts (liste des noms, vers l. 123).

Tests de C : `ClosedGuardTest` (lancé par l'orchestrateur, `gradlew testDebugUnitTest`) : téléphone sur une table, bruit à 0,4 m/s : arrêt « still » à 1 h ; surfeur dans les 200 m, 3 m/s pendant 10 s toutes les 10 min : jamais « still », « timeout » à 12 h ; pointe d'une seule position : arrêt quand même ; vitesse NaN ou seuil à 0 : comme aujourd'hui ; incertitude au-delà du rayon : ignorée ; positions à 30 s d'écart au-dessus du seuil : comptent. `sportProfiles.test.ts` : la valeur dérivée. `location.test.ts`, `nativeConstants.test.ts` : le nouveau nom passe.

## Questions mineures, tranchées par l'orchestrateur le 23/11

- Seuil de « vraie vitesse » : la détente d'entrée du plancher d'arrêt du profil (1,5 nd en voile, 3 km/h en surf), non réglable dans Réglages. Écarté : le seuil d'activité (8 nd en wing), qui arrêterait une sortie lente et dépend de l'allure de la session.
- La vitesse doit tenir 5 s : une pointe isolée du GPS ne relance pas l'heure.
- Seule la vitesse Doppler compte : une position sans vitesse ne prouve aucun mouvement.
- La boîte « La page s'est arrêtée » s'écrit comme les messages voisins de la coquille (le lot 502 les traduit tous) ; Ctrl+R et F5 sont ajoutés tous les deux.

## Essais au téléphone

1. Enregistrer quelques minutes, forcer l'arrêt de Gtracker dans Paramètres › Applications, rouvrir 15 min plus tard → l'analyse s'ouvre avec « Enregistrement interrompu à … ».
2. Lancer un enregistrement, fermer l'application, poser le téléphone sur une table 1 h 10 → l'enregistrement s'arrête seul, et la réouverture dit « arrêté seul… n'avait pas bougé ».
