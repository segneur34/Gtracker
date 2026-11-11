# Outils

- `lancer-gtracker.bat` : ouvre Gtracker dans le navigateur. Il démarre d'abord le serveur de développement (`npm run dev`, port 5174) dans une fenêtre réduite « Gtracker - serveur » si celui-ci ne tourne pas déjà. Fermer cette fenêtre arrête le serveur. Le raccourci « Gtracker » du bureau pointe vers ce fichier, avec l'icône `icone-gtracker.ico`, tirée du symbole GONG comme l'icône Android.
- `logo/icones-android.mjs` : refait depuis `src/assets/logo/gong-symbol.svg` l'icône Android, la favicon et `icone-gtracker.ico` ; mode d'emploi en tête du fichier.
- `banc/` : banc de test dans un Chrome sans fenêtre (son `LISEZMOI.md`).
- `imu-reference.mjs` : refait `src/core/imuFile.reference.imu`, la référence du format des capteurs, par l'écrivain du téléphone (`node outils/imu-reference.mjs`, JDK seulement). Pour un changement de format voulu, jamais d'elle-même : `ImuFormatTest.java` (Gradle, `:app:testDebugUnitTest`) y compare ce qu'écrit `ImuWriter`, `imuFile.reference.test.ts` (vitest) la relit.
- `backlog.mjs` : tableau de bord du reste à faire, `node outils/backlog.mjs` depuis la racine ; vérifie la forme de `docs/BACKLOG.md` (code 1 sur une erreur de forme). Testé par `backlog.test.mjs`.
