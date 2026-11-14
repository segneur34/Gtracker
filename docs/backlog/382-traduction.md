# 382 · Traduction : français, anglais, espagnol

Lancé par l'utilisateur le 14/11 : « on va attaquer le gros chantier de la traduction. En anglais et en espagnol. […] L'idée, c'est que le code ne change pas. Enfin, en tout cas, pas les fonctionnalités. »

Résultat attendu : l'application se lit en français comme aujourd'hui, en anglais et en espagnol. **En français, rien ne bouge** : mêmes textes, mêmes chiffres, aucun test réécrit, texte du banc identique avant et après (hors la ligne « Langue » de Réglages).

Ampleur mesurée le 14/11 : 443 fichiers de `src/` hors tests, environ 4 000 lignes de texte (2 700 en JSX, 1 250 chaînes, 300 attributs).

## Direction (tranchée par l'orchestrateur, plan de l'agent `Plan` du 14/11)

1. Aucune dépendance nouvelle. Le texte français reste à sa place dans le code et sert de clé : `t('Enregistrer la session')`. Les dictionnaires anglais et espagnol sont des données pures (français → traduction), en JSON et non en `.ts` : les gardes qui lisent les sources (`outils/heritage.mjs`, `WORKSHOP_REFS` et `SPORT_NAME` de `src/architecture.test.ts`) ne lisent pas le JSON. Un texte sans traduction retombe sur le français.
2. `t()` vit dans `src/core/i18n.ts`, pur, sans import (`src/architecture.test.ts` : le noyau n'importe rien). La langue est un état du module, lu partout, fonctions pures comprises. Hors amorçage (tests, banc) : français, `t()` rend sa clé.
3. La langue est connue avant que l'application ne soit importée : `main.tsx` ne garde que l'amorçage (stockage, langue, dictionnaire), puis `await import('./boot')` qui reprend tout l'ancien `main.tsx`. Une constante de module (`label: t('général')`) est donc juste. Changer de langue dans Réglages recharge la page ; le réglage est grisé pendant un enregistrement.
4. Deux temps : (A) pose de `t()`, neutre en français ; (B) dictionnaires, d'après un glossaire validé par l'utilisateur.
5. Choix de la langue : réglage par appareil (clé de `STORAGE_KEYS` hors de `TRAVELLING_KEYS`), sinon langue de l'appareil (français, anglais, espagnol), sinon anglais. Lecture et écriture par `src/platform/`.
6. Formats : point décimal en anglais, virgule en français et en espagnol ; dates par `dateLocale()` (`fr-FR`, `en-GB`, `es-ES`). Unités inchangées.

## Questions posées à l'utilisateur le 14/11 (réponses par défaut appliquées en attendant)

- Choix de la langue : appareil puis Réglages, anglais pour une autre langue (point 5).
- Anglais britannique (« gybe », dates jour/mois), espagnol d'Espagne.
- Glossaire des termes de glisse à valider avant les dictionnaires ; relecteur espagnol à trouver.
- Activités de départ : seul « Bateau » se traduit (« Boat », « Barco »), tant que son nom n'a pas été changé.
- Étendue : tout ce qui se lit dans l'application (aides, tutoriels, erreurs, notification, image de partage) ; pas le nom « Gtracker », ni les GPX exportés, ni ce que l'utilisateur a saisi.

Tranché par l'orchestrateur (mineur) : les noms de couleur de la palette se traduisent à l'affichage ; les noms de lieux sont demandés dans la langue choisie (nouvelles sessions seulement) ; le nom par défaut d'un itinéraire reste dans la langue du jour de sa création ; le nom du canal de notification suit la langue du téléphone (`values-en`, `values-es`) ; les journaux techniques et rejets des fichiers Java ne se traduisent pas.

## Étapes

| Étape | Contenu | Modèle, effort | Dépend de |
|---|---|---|---|
| S0-A | `core/i18n.ts` et son test, formats (`core/units.ts`, `core/calendar.ts`, emplois de `toLocale*`), `tRich`, outil de garde et son test | Opus, high | – |
| S0-B | amorçage (`main.tsx`, `boot.tsx`), `platform/language.ts`, réglage « Langue », `lang` du document, option `--langue` du banc | Opus, high | S0-A |
| P1 | pose dans `core/` | Sonnet, medium | S0 |
| P2 | pose dans `sailing/`, `surfing/`, `planning/`, `settings/`, `tutorials/` | Sonnet, medium | S0 |
| P3 | pose dans `library/`, `platform/`, `recording/` | Sonnet, medium | S0 |
| P4 | pose dans `hooks/` | Sonnet, medium | S0 |
| P5 | pose dans `components/`, première moitié (fichiers A à H et sous-dossiers) | Sonnet, medium | S0 |
| P6 | pose dans `components/`, seconde moitié (fichiers I à Z) | Sonnet, medium | S0 |
| P7 | pose dans `SettingsPage`, `RecordingPage`, `StatisticsPage`, `StatisticsSelection` | Sonnet, medium | S0 |
| P8 | pose dans les autres pages et les fichiers de `src/` à la racine | Sonnet, medium | S0 |
| G | glossaire anglais et espagnol des termes de glisse et d'interface, mots interdits | Opus, high, validé par l'utilisateur | réponses |
| D | dictionnaires `en.json` et `es.json`, en deux moitiés chacun | Sonnet, high | P1 à P8, G |
| A | Android : `values-en`, `values-es`, notification vérifiée | Sonnet, medium | S0 |
| L | banc en anglais et en espagnol (`tailles.mjs`, script `langues.mjs`), corrections de largeur | Opus, medium | D, A |

Un lot P trop gros pour un agent (budget de 90 appels) se coupe en parties sur des listes de fichiers ; la partie suivante part d'un agent neuf.

## S0 : le socle

### S0-A

`src/core/i18n.ts`, sans import :
- `Lang = 'fr' | 'en' | 'es'`, la liste des langues et leur nom dans leur propre langue (Français, English, Español), jamais traduit.
- `setLanguage(lang, dictionnaire)` et `currentLang()` ; défaut `fr` et dictionnaire vide.
- `t(clé, vars?)` : cherche la clé dans le dictionnaire, retombe sur la clé, puis remplace `{nom}` par `vars.nom`. En français, sans variable, rend exactement la clé. Contexte facultatif (`vars.ctx`, jamais remplacé dans le texte) quand un même texte français a deux traductions : l'entrée du dictionnaire porte alors la clé et le contexte, séparés par une marque que l'outil de garde connaît.
- `tn(n, singulier, pluriel, vars?, plurielFrançais?)` : deux phrases entières, chacune une clé. En français le pluriel suit `plurielFrançais` (par défaut `n > 1`, la règle de `plural()` de `core/basics.ts`), que le site d'appel donne quand sa règle diffère (`importReport.ts` met 0 au pluriel) ; en anglais et en espagnol, pluriel si `n !== 1`. `{n}` est remplacé comme toute variable.
- `decimalSeparator()` et `dateLocale()` d'après la langue.
- Tests : français neutre (clé rendue telle quelle, variables, pluriels aux deux règles), une langue avec dictionnaire, repli, contexte.

Formats : `formatDecimal` (`core/units.ts`) prend son séparateur dans `decimalSeparator()` ; `core/calendar.ts` et les emplois d'affichage de `toLocale*`, `Intl` et `'fr-FR'` prennent `dateLocale()`. Ne pas toucher aux comparaisons d'identité (`localeCompare(…, 'fr')`, `toLocaleLowerCase('fr')` de `sessionName.ts`, `gear.ts`, `stats.ts`, `licenses.ts`, `routeList.ts`). Les formateurs construits une fois au chargement du module restent justes grâce à l'amorçage.

`tRich` (dans `components/`) : `tRich('Texte avec <b>{x}</b> dedans', vars, { b: … })` rend le même DOM que le JSX qu'il remplace, d'après une seule phrase entière. Test sur le rendu en chaîne si l'environnement node le permet, sinon sur le découpage, fonction pure.

Outil de garde `outils/i18n.mjs` et son test dans `src/` :
- extrait les clés de `t(`, `tn(` et `tRich(` dans `src/` hors tests ; refuse un premier argument non littéral ;
- sans dépendance nouvelle (TypeScript 7 : vérifier si son API d'analyse existe avant de s'en servir, sinon un lecteur de jetons qui connaît les trois formes de chaînes et les commentaires) ;
- contrôle `en.json` et `es.json` : traduction orpheline, variable `{nom}` absente ou en trop dans une traduction, mot interdit par `src/heritage.test.ts` ;
- les clés sans traduction : listées et comptées par l'outil (`node outils/i18n.mjs`), refusées par le test seulement quand un drapeau de l'outil dit le chantier clos (posé à la fin de l'étape D) ;
- crée `en.json` et `es.json` vides, à l'endroit que les gardes d'`architecture.test.ts` acceptent (un dossier de `src/` sans `.ts` peut demander une règle : le vérifier).

### S0-B

- `src/platform/language.ts` : langue de l'appareil, lecture et écriture du choix (clé neuve dans `STORAGE_KEYS`, `core/appIdentity.ts`, hors de `TRAVELLING_KEYS`, `library/settingsFile.ts`).
- `main.tsx` n'importe que `core/i18n`, `platform/storage`, `platform/language` et ce qu'il faut pour ne pas perdre le premier affichage du thème : il attend le stockage, lit la langue, charge le dictionnaire par `import()` si elle n'est pas le français, pose `document.documentElement.lang`, puis `await import('./boot')`. `boot.tsx` reprend l'ancien `main.tsx`. Piège : `useTheme.ts` importe `core/activities`, donc des tables à textes ; le thème posé avant le stockage (ancien `main.tsx`, vers la ligne 31) doit garder son effet sans cet import. Un test fige la liste des imports de `main.tsx`.
- Réglages : une ligne « Langue » en bouton glissant (`SegmentedControl`), avec les réglages de l'appareil, grisée pendant un enregistrement ; le choix écrit la clé puis recharge la page.
- Banc : `outils/banc/passe.mjs` lance Chrome en `--lang=fr-FR` par défaut, option `--langue fr|en|es`.

## Consignes communes de pose (étapes P)

- **Envelopper** : texte JSX, `title`, `aria-label`, `placeholder`, `alt`, `label`, messages, libellés de table, abréviations d'unités, phrases rendues par les fonctions pures.
- **Laisser** : identifiants et clés (`key`, adresses, noms de fichiers, `STORAGE_KEYS`), noms servant de clé de recherche (couleurs de la palette : `paletteColor('Lagon')`, traduits à l'affichage seulement), données saisies par l'utilisateur, commentaires, journaux techniques (`console.*`), textes des tests, mots français lus par la logique (`guessActivityLogo`, filtres de recherche, tris).
- **Argument littéral toujours** : jamais `t(variable)`. Une table garde `t('…')` à sa définition. Une donnée persistée se traduit à l'affichage, jamais à l'écriture ; une activité de départ ne se traduit que si son nom n'a pas été changé.
- **Variables** : `t('{n} sessions ajoutées', { n })` ; un nombre se passe déjà formaté (`formatDecimal`).
- **Pluriels et accords** : `tn(n, 'phrase au singulier', 'phrase au pluriel', vars)`, avec la règle française exacte du site (cinquième argument si elle n'est pas `n > 1`). Plus de `'s'` collé.
- **Phrases entières** : ni fragment (« de voile ») ni concaténation de morceaux traduits. Changer le code d'appel est permis si le texte français produit reste identique au caractère près.
- **Contexte** : `t('vol', { ctx: 'foil' })` quand un même mot français a deux sens.
- **Texte riche** : `tRich`, DOM identique.
- **Neutralité** : aucun test réécrit. `node outils/verif.mjs --rapide` à la fin de chaque groupe de fichiers.
- **Parallèle** : plusieurs étapes P tournent dans le même arbre, chacune sur sa liste de fichiers ; ne toucher à aucun autre fichier, ignorer un échec venu d'un fichier hors de sa liste et le dire dans le rapport ; aucune commande git qui défait un travail.

## Pièges relevés par le plan

- `core/activities.ts` : noms de couleur employés comme clés (lignes 67 à 78, 153, 165) ; noms des onze activités écrits dans les réglages dès la première modification de la liste ; `FAMILY_OF` « de voile » (ligne 225, employé dans `RecordingPage.tsx`).
- `FlightPumpingPanel.tsx:95` : « Masquer » suivi d'un libellé à capitale forcée.
- `library/importReport.ts:51-79` : accords à la main ; 85 `? 's'` dans 23 fichiers, 33 appels de `plural()`.
- `core/units.ts` : « nds », « NM », « h » et « min » de `formatDuration` ; `core/sportProfiles.ts:473` « 1 mille ».
- `planning/geocoding.ts:39` et `121` : `lang: 'fr'` envoyé au service de noms de lieux, à brancher sur la langue.
- 50 balises (`<b>`, `<em>`) dans du texte : `ManeuversPanel.tsx`, `StatisticsPage`, `RestingHrTestPage`, `VmgPanel`.
- `src/heritage.test.ts` lit aussi le JSON et refuse « tracker » sans g devant : le glossaire interdit « GPS tracker », « tracking app ».
- 42 scripts du banc cliquent par texte français : le banc reste en français ; l'anglais et l'espagnol se contrôlent par `tailles.mjs` adapté et un script `langues.mjs` qui relève les textes restés en français.
- Largeurs à surveiller : barre du bas à cinq cases, barre du haut sur une ligne dès 1000 px, pastilles d'onglets, en-tête d'analyse sur une ligne au téléphone, boutons en capitales.
- Non vérifié par le plan : texte dans `summary` et dans le journal d'enregistrement ; `platform/errorText.ts` et l'affichage des erreurs Java ; textes de `src/App.tsx` et d'`AppShell`.
