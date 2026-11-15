# 308 · E8, identité et livrable : ce qui reste à la livraison

Modèle | Réflexion : Opus | high

Extrait le 15/11 de la fiche 319 (revue d'après fork du 11/11/2026, partie « Lot 308 (recentré) »), sortie du dépôt ce jour-là : copie dans `D:\gong tracker\atelier\backlog-clos\`. Les numéros de ligne et les lots cités sont ceux du 11/11 : les revérifier avant d'éditer (le greffon de position tiers, par exemple, est désinstallé depuis le lot 403, et la table des services du README est refaite depuis le lot 401). Crédits des images et identité : `docs/backlog/153-vente-identite-images.md` ; mentions légales : fiche 151 ; fonds de carte : fiche 152.

Sources : `D4-atelier-coupure.md` (§3.2 et §4, listes d'atelier) et `O2-coupure-donnees.md` §5 (recouvrement du BACKLOG). La ligne actuelle (`BACKLOG.md:55`) liste : identifiant d'application et espace de noms des GPX, crédits des images, politique de confidentialité, écran « À propos », brouillons des formulaires Play, manifeste, fonds de carte sous contrat, **docs réécrites**, **atelier retiré**, **banc rebranché**, puis dépôt réécrit en un seul commit. Une fois les lots 321 à 324 et 331 faits, **les noms techniques, les documents et le banc ne sont plus à lui**.

**But** : l'identité du vendeur et les pièces de la vente (légal, Play, fonds de carte, crédits) sont prêtes, les documents de pilotage sont retirés ou livrés selon la réponse, et le dépôt est réécrit en un seul commit sans trace de l'ancien projet. On le verra à ceci : les trois recherches de contrôle du lot 324 rendent zéro sur le dépôt livré et `git log --format='%an %ae' | sort -u` ne contient ni « tracker » ni l'adresse de l'utilisateur.
**Taille** gros · **Modèle** Opus / high (inchangé) · **Risque** moyen (la réécriture de l'historique est irréversible ; contrôles avant)
**Avant** : 321, 322, 323, 324, 331, 307, 306, 304 · **Après** : rien · **Avant la première APK** : non (les parties techniques, elles, le sont : lots 321 à 323).

### À faire (dix lignes)
1. **Identité du vendeur dans l'application** · « ex. Tom » dans `components/ProfilePrompt.tsx:91` et `pages/SettingsPage.tsx:938` ; nom de l'application et contact du vendeur dans les textes de vente ; adresse de contact de l'agent HTTP des tuiles (`capacitor.config.ts:22`, le nom `Gtracker/<version>` est posé au lot 323)
2. **Crédits des images** (relevé par l'utilisateur, fiche 153) : un fichier `CREDITS` ou `ASSETS.md` (source, compte, licence, date, droit de céder de chaque image : `src/assets/accueil/*.webp` (6), `src/assets/bandeaux/*.webp` (5), `assets/logo.png`, `assets/splash.png`, `res/drawable*/splash.png`, `components/activityArt.tsx`) ; remplacer ce qui n'est pas cessible ; ne pas déposer le logo comme marque sans en avoir établi l'origine
3. **Politique de confidentialité et écran « À propos »** (fiche 151) : texte juste après le lot 304 (restent OpenStreetMap, Esri et, selon la réponse, Photon ; BRouter, IGN et Overpass n'existent plus)
4. **Brouillons des trois formulaires Play** (« Sécurité des données », « Applications de santé », « Services au premier plan ») ; manifeste Android : retirer `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (ou le justifier par écrit ou le remplacer par l'ouverture de la liste système), `GeofenceBootReceiver` et `RECEIVE_BOOT_COMPLETED` du greffon GPS (`tools:node="remove"`), vérifier `allowBackup` (fiches 151 et 171 ; les deux services au premier plan sont déjà partis au 302)
5. **Fonds de carte sous contrat** ou tuiles de l'acheteur (Q5, fiche 152) : conditions d'usage d'OpenStreetMap et d'Esri World Imagery pour une application vendue, cache disque jusqu'à 20 Go
6. **Identifiant d'application final** : le nom technique `io.github.segneur.gtracker` (ou celui de l'acheteur au contrat) est posé au lot 323 ; reste à le remplacer par celui de l'acheteur **avant toute diffusion** (`${applicationId}` pour l'action d'intent, `capacitor.config.ts`, `build.gradle`, `strings.xml`) ; clé de signature cédée ou neuve : la clé neuve est faite au lot 323, la cession au contrat
7. **Documents** : décider ce qui est livré (réponse aux questions du lot 331 : `MISE_EN_PAGE.md` livré, `DECISIONS.md` non, `HISTORIQUE.md` à numéros conservés ou en archive) ; réécrire `CLAUDE.md` en `ARCHITECTURE.md` et `CONTRIBUER.md` ; faire lisible `ETAT_DU_PROJET.md` (§11 en entier, §12) ; ligne d'installation de l'APK et crédit GONG dans `README.md` ; licence de l'ensemble (`package.json` sans `license` ni `author`)
8. **Atelier retiré de la livraison** : `.claude/`, `docs/BACKLOG.md`, `docs/backlog/`, `docs/MODELES.md`, `DOCUMENTS` de `outils/docs-cites.mjs` réduit ; les archives `D:\gong tracker\atelier\` sont sorties du dossier de vente par le lot 324
9. **Dépôt réécrit en un seul commit** (`git checkout --orphan`) : **vérifier l'auteur du commit avant** (`.git/config` porte `user.name = Tracker`, `email = tracker@users.noreply.github.com`, les 14 commits existants aussi ; `git config user.name "Gtracker"` et un e-mail `noreply` neutre) ; l'historique et l'adresse e-mail de l'utilisateur ne sont pas cédés (réponse du 07/11, Q4 de la fiche 153)
10. **Contrôle final** : les trois recherches de la section 5 de `D4-atelier-coupure.md` (contenu du dépôt, noms de fichiers, identité de l'APK) à zéro sur le dépôt livré ; APK de livraison construite et installée une fois sur un téléphone propre : lancer, enregistrer, importer, « Ouvrir avec »

### Pièges
- Le lot 308 n'a plus à renommer des clés, des formats ni des chemins Java : s'il le fait, c'est que les lots 321 à 323 n'ont pas été faits.
- Après la réécriture en un commit, plus rien ne passe d'une version à l'autre par git : toute correction oubliée se refait à la main.
- Le dossier parent `D:\gong tracker` garde son nom (c'est le dossier de travail, pas l'ancien projet) ; le renommer ferait ouvrir à Claude un autre dossier de mémoire.

### Vérification
- Les recherches de la section 5 de `D4-atelier-coupure.md` ; `npm run verif` ; `./gradlew clean testDebugUnitTest assembleRelease` ; `adb shell dumpsys package <identifiant final>` à la première installation.

### Questions liées
- **Quel identifiant définitif pour l'application ?** · Par défaut : `io.github.segneur.gtracker`, à remplacer par celui de l'acheteur au contrat · Change : tout ce que le lot 323 a posé, et la perte des données si c'est fait après une installation.
- **Les documents de pilotage sont-ils livrés ?** voir lot 331.
- **Les archives `atelier\` (1,9 Mo, tout sur l'ancien projet) : sortir, supprimer ?** · Par défaut : sortir du dossier de vente vers un dossier personnel, ne rien supprimer (lot 324).
