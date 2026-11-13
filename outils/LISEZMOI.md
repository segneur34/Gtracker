# Outils

- `lancer-gtracker.bat` : ouvre Gtracker dans le navigateur. Il démarre d'abord le serveur de développement (`npm run dev`, port 5174) dans une fenêtre réduite « Gtracker - serveur » si celui-ci ne tourne pas déjà. Fermer cette fenêtre arrête le serveur. Le raccourci « Gtracker » du bureau pointe vers ce fichier, avec l'icône `icone-gtracker.ico`, tirée du symbole GONG comme l'icône Android.
- `icone-gtracker.ico` : l'icône du raccourci, refaite par `logo/icones-android.mjs`.
- `logo/icones-android.mjs` : refait depuis `src/assets/logo/gong-symbol.svg` l'icône Android, la favicon et `icone-gtracker.ico` ; mode d'emploi en tête du fichier.
- `banc/` : banc de test dans un Chrome sans fenêtre (son `LISEZMOI.md` pour le lanceur et les pièges, son `SCRIPTS.md` pour chaque script).
- `verif.mjs` : vérification en une commande (`npm run verif`), complète ou `--rapide` (typecheck, lint, tests touchés) ; lance aussi les deux contrôles de documents ci-dessous.
- `docs-cites.mjs` : contrôle que chaque fichier ou nom de code cité entre accents graves dans les documents vivants existe (`node outils/docs-cites.mjs [document.md …]`, sans argument la liste `DOCUMENTS` du fichier).
- `docs-inventaire.mjs` : contrôle que la carte `docs/INVENTAIRE.md` colle au disque (fichier non cité, cité mais absent, rangé sous le mauvais dossier).
- `heritage.mjs` et `heritage.json` : relevé figé du vocabulaire hérité d'une ancienne application dans `src/` (`--figer` le réécrit) ; `src/landWords.test.ts` refuse qu'il remonte.
- `styles-en-ligne.mjs` et `styles-en-ligne.json` : relevé figé des styles en ligne par fichier `.tsx` (`--figer` le réécrit) ; `src/theme/inlineStyles.test.ts` refuse qu'il remonte.
- `licences-hors-js.mjs` : refait `public/licences-hors-js.json`, la liste des licences que Vite ne voit pas (dépendances natives, polices) ; à relancer quand une dépendance native change.
- `imu-reference.mjs` : refait `src/core/imuFile.reference.imu`, la référence du format des capteurs, par l'écrivain du téléphone (`node outils/imu-reference.mjs`, JDK seulement). Pour un changement de format voulu, jamais d'elle-même : `ImuFormatTest.java` (Gradle, `:app:testDebugUnitTest`) y compare ce qu'écrit `ImuWriter`, `imuFile.reference.test.ts` (vitest) la relit.
- `backlog.mjs` : tableau de bord du reste à faire, `node outils/backlog.mjs` depuis la racine ; vérifie la forme de `docs/BACKLOG.md` (code 1 sur une erreur de forme). Testé par `backlog.test.mjs`.
