# 525 · Mises en garde et texte « À propos » juste

Modèle | Réflexion : Sonnet | medium

Constats C-11 et C-23 de la relecture avant vente. Question posée à l'utilisateur le 23/11 (où, quelle phrase), planche hors dépôt : `D:\gong tracker\atelier\planche-525\planche.html`. Ne pas lancer avant sa réponse.

## Proposé (recommandation, à confirmer)

- Navigation : « L'application n'est ni un instrument de navigation ni un équipement de sécurité : gardez le matériel et les précautions qu'exige votre sortie. »
- Santé : « L'application n'est pas un dispositif médical : la fréquence cardiaque et le test au repos donnent des repères pour votre pratique, pas un avis médical. »
- Où : les deux dans « À propos » (`src/components/AboutSettings.tsx`, deux paragraphes `about__text` après celui d'OpenStreetMap) ; la première à la fin de l'aide « ? » de « Balises sonores » de Planifier (`src/pages/PlanningPage.tsx`, `helpKey="plan:parcours"`) ; la seconde à la fin de l'aide « ? » de « Déroulé » du test de FC repos (`src/pages/RestingHrTestPage.tsx`, `helpKey="repos:deroule"`).
- « L'application », pas le nom du produit : la phrase survit à un changement de nom.
- Trois langues (`src/locales/en.json`, `es.json`) ; scripts du banc qui lisent ces textes (`apropos`, `aides`, celui du test de FC repos).

## Texte « À propos » inexact, relevé le 23/11 en préparant la politique de confidentialité (à proposer à l'utilisateur avec le brouillon `D:\gong tracker\atelier\livraison\a-propos-brouillon.md`)

- Le paragraphe sur Photon ne parle que des sessions : les itinéraires envoient aussi leur départ et leur arrivée (`src/hooks/routePlace.ts`), et la recherche d'un lieu par son nom dans Planifier envoie le texte tapé et le centre de la carte arrondi, sans que la case de Réglages › Mémoire la coupe (`src/pages/PlanningPage.tsx`).
- « rien d'autre » oublie l'adresse IP et l'identification des requêtes.
- Le serveur de cartes n'est pas nommé comme destinataire (zone affichée, adresse IP).
- Ce qui dépend de GONG (éditeur, contact, lien de la politique) reste au lot 308.

## À voir au passage

Sur la page du test de FC repos, à 390 px, le « ? » de « Déroulé » tombe sous le titre au lieu d'être à sa droite (capture de la planche) : le dire dans le rapport, le corriger si c'est un défaut de la page et non du décor de la planche.

## Partie A, faite le 23/11

« À propos » : texte corrigé et les deux mises en garde. Les deux phrases ne sont pas répétées sous les aides de Planifier et du test de FC repos (réponse de l'utilisateur : « le minimum »).

## Partie B : fenêtre à la première ouverture et phrase sous « Démarrer » (réponses de l'utilisateur du 23/11, maquette vue : `D:\gong tracker\atelier\planche-525\planche.html`, variantes 1 et 3)

Modèle | Réflexion : Opus | high

1. **Fenêtre à la toute première ouverture**, avant tout le reste : titre « Avant de partir », les deux phrases longues en deux paragraphes, un seul bouton « J'ai compris ». Elle ne revient plus une fois le bouton touché (état gardé sur l'appareil, par `src/platform/` ; une remise à zéro de l'appareil la fait revenir). Style commun des fenêtres (`components/ui/Dialog`, `ui/Button`), textes à pleine encre. Dans les trois versions (navigateur, téléphone, programme Windows).
2. **Phrase de navigation sous « Démarrer »** de la page Enregistrer, en gris, visible à chaque enregistrement, dans les deux familles ; elle doit rester lisible sur le fond décoratif de la page (capture `v3-sous-demarrer.png` de la planche : elle s'intercale entre « Démarrer » et « Suivre une trace »).
3. Les mêmes clés de traduction que dans « À propos » (texte français identique).

Points à établir par le plan : l'ordre avec les autres fenêtres et cartes de la première ouverture (carte de la mémoire, autorisations, fenêtre du prénom `ProfilePrompt`, qui ne paraît que sur le téléphone) ; où garder « vue » ; et surtout le banc : chaque script part d'un profil de navigateur neuf, une fenêtre modale à la première ouverture bloquerait tous les scripts : le décor commun du banc doit la tenir pour vue par défaut, et un script doit l'éprouver (paraît une fois, « J'ai compris », ne revient pas). Décision à écrire dans `docs/DECISIONS.md` §11 à la passe de documentation.

### Plan de la partie B (agent `Plan`, 23/11, condensé)

- **Où** : la fenêtre se branche dans `components/AppShell.tsx`, à côté d'`ImportQuestion` (toutes les adresses, trois versions). Aujourd'hui, à l'ouverture, `ProfilePage` montre dans l'ordre `MemoryStatus` (carte), `PermissionsPrompt` (carte, téléphone), `ProfilePrompt` (fenêtre, téléphone, `profilePromptGate` et `shouldPromptProfile` de `library/profilePrompt.ts`), `TutorialOfDay` (`tutorialCardGate`), `PhoneAppOffer` (fenêtre, programme Windows, `phoneAppOfferGate`). Faire attendre les autres par le mécanisme d'`askedThisLaunch` : un drapeau de module « fenêtre montrée à ce lancement », une entrée de plus pour les trois gardes ; jamais deux fenêtres l'une sur l'autre.
- **« Vue »** : clé neuve `STORAGE_KEYS.miseEnGarde` (`core/appIdentity.ts`), lue et écrite par `useStoredRecord` / `readStoredRecord` (`hooks/useStoredRecord.ts`, donc `platform/storage.ts`, règle 12) ; hook neuf `hooks/useSafetyNotice.ts` (`{ seen, acknowledge }`), décision pure dans `library/profilePrompt.ts` avec ses tests ; `KEY_CLASSES` de `library/resetPlan.ts` (son test oblige à classer la clé). Elle ne voyage ni dans le fichier de réglages du dossier ni dans la synchronisation.
- **Composant** : `ui/Dialog` ferme aujourd'hui par la croix, le fond, Échap et le retour d'Android (`pushBackLayer`), sans gestion du focus. Option neuve `dismissible={false}` : ni croix, ni fond, ni Échap ; le retour d'Android est absorbé (la couche se repose elle-même : sans couche, le retour fermerait l'application). Focus sur « J'ai compris ». Composant neuf `components/SafetyNotice.tsx`, sans style en ligne.
- **Phrase sous « Démarrer »** : `pages/RecordingPage.tsx`, dans `.rec-actions` (visible au repos seulement, jamais pendant un enregistrement), classe neuve `.rec-notice` dans `RecordingPage.css` : gris `--muted`, `--text-s`, centrée, fond `var(--field-veil)` (le texte ne passe pas sur le champ nu) ; sur téléphone entre les deux boutons (`flex-basis: 100%`), à partir de 768 px sous les deux boutons qui restent côte à côte (`order`).
- **Traductions** : « Avant de partir » et « J'ai compris » sont neuves ; les deux phrases reprennent mot pour mot les clés d'`AboutSettings.tsx`.
- **Banc (agent 2, après l'agent 1)** : `outils/banc/lib/cdp.mjs`, `connect` pose `PAGE_SCRIPT` avant tout document (72 scripts) : y écrire la clé comme vue quand elle manque, à la forme exacte qu'écrit `useStoredRecord`, avec une option pour ne pas la poser ; `shots.mjs` ne passe pas par `connect` ; programme Windows : le premier document de chaque instance est chargé avant `connect` (à vérifier sur `exe-application` et `memoire-disque`). Script neuf `mise-en-garde.mjs` inscrit dans `scripts.mjs` : la fenêtre paraît sur profil neuf, ni Échap ni le fond ni le retour ne la ferment, « J'ai compris » la ferme, elle ne revient pas au rechargement, elle revient après effacement de la clé ; la phrase sous « Démarrer » est là au repos, pas pendant l'enregistrement. `tailles` à 320 px et texte agrandi.

### Tranché par l'orchestrateur

- Classe de la clé : `donnee` (« Tout supprimer » la fait revenir, « Réglages d'usine » la garde).
- Retour d'Android : absorbé.
- `ImportQuestion` (fichier reçu au premier lancement) attend « J'ai compris ».
- Après « J'ai compris », le prénom est demandé au lancement suivant, pas à la suite.
- La croix de la maquette disparaît : la fenêtre ne se ferme que par son bouton.
- Sur ordinateur, la phrase va sous les deux boutons ; capture à montrer à l'utilisateur à la fin du lot.
