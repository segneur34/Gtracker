# 333 · Retirer la zone cardiaque visée et ses bips

**Décision de l'utilisateur (11/11/2026)**, à l'essai 216 : « il faut supprimer cette fonctionnalité, pas de FC visée ». Elle annule celle du 30/10 (`docs/DECISIONS.md` §6, « Zone cardio visée et bips de sortie de zone »).

**But.** Sur la page Enregistrer, plus de bouton « Zone visée : aucune, Z1 à Z5 », et plus aucun bip ni vibration de sortie ou de retour de zone pendant un enregistrement. On verra que c'est fini quand `rg -n -i "zoneAlert|zone visée|ZONE_ALERT" src outils android/app/src` ne rend plus rien et que le reste de l'enregistrement (ceinture, FC en direct, balises, test de FC repos) est inchangé.

**Taille** petit · **Modèle** Sonnet / high · **Risque** faible à moyen (l'enregistrement : `RecordingPage`, reprise après coupure).

## Ce qui reste, à ne pas toucher

- La ceinture cardio, la FC en direct, l'onglet cardio des analyses, les zones cardiaques du Pratiquant (Réglages, analyses, image de partage) : rien ne change.
- Le test de FC repos et ses bips (`recording/restingHrTest.ts`, `hooks/useRestingHrTest.ts`, `GUIDE_SIGNAL_TONES` pour ce qu'il en lit).
- Les bips de balises, de GPS perdu, de ceinture perdue (`platform/beeper.ts`, `core/beepDurations.ts`, `TonePlayer.java`, `BeeperPlugin.java`) : ne retirer côté son que ce qui ne servait **qu'à** la zone visée, TS et Java ensemble, et seulement si plus rien ne le lit (le test de FC repos emploie peut-être les mêmes motifs : vérifier avant).
- « Écouter » de Réglages et le réglage de hauteur des bips restent ; leur aide perd seulement les mots « zone visée ».

## À faire

- Supprimer `src/hooks/useZoneAlert.ts`, `src/recording/zoneAlert.ts`, `src/recording/zoneAlert.test.ts`, et leurs appels : `startZoneAlertGuide` dans `src/main.tsx`, le bouton glissant et son état dans `src/pages/RecordingPage.tsx` (et son CSS s'il en a un propre), la reprise après coupure dans `useRecorder` (voir `src/hooks/useRecorder.resume.test.ts` : retirer les cas de la zone visée, garder les autres).
- Clé de l'appareil `zoneAlertTarget` : la retirer de `STORAGE_KEYS` (`src/core/appIdentity.ts`), de `src/core/appIdentity.test.ts` et des constantes du banc (`outils/banc/lib/cdp.mjs`, `CLES`). Aucune lecture de compatibilité : la clé disparaît.
- `src/recording/signalTones.ts` et son test : retirer les signaux propres à la zone (au-dessus, en dessous, retour) ; garder ceux du test de FC repos. Si `windowMean` (`src/core/windowMean.ts`) n'a plus d'appelant après le retrait, le supprimer avec son test.
- Commentaires qui citent la zone visée : `src/platform/beeper.ts`, `src/core/beepDurations.ts`, `src/hooks/usePerActivityChoice.ts` (si ce hook n'a plus d'autre usage que la zone visée, le dire dans le rapport plutôt que de le supprimer à l'aveugle ; s'il n'a plus aucun appelant, le supprimer), `TonePlayer.java`, `BeeperPlugin.java`.
- Texte visible : aide du réglage des bips dans `src/pages/SettingsPage.tsx` (« Pour tous les bips : balises, zone visée, FC repos. » → « Pour tous les bips : balises, FC repos. »). Leçons (`src/tutorials/lessons.ts`) : retirer toute phrase qui parle de la zone visée.
- Banc : `rg -n -i "zone visée|zoneAlert|Zone visée" outils` ; adapter les scripts qui la cherchent (étapes retirées, pas de script cassé).

## Pièges

- La page Enregistrer ne doit pas bouger d'un pixel hors la ligne retirée : pas de remise en page.
- Règle 12 de `CLAUDE.md` : son et vibreur ne passent que par `src/platform/`.
- Ne pas toucher `docs/` (l'orchestrateur met à jour `DECISIONS.md` §6, ETAT et INVENTAIRE).

## Vérification

- `npx tsc -b --force`, `npm run lint`, `npx vitest run` ; la recherche de contrôle du « But » à zéro.
- Banc (orchestrateur) : `cardio`, `notification`, `general`, `fc-repos`, `test-fcrepos`, plus tout script adapté.
- Pas d'essai au téléphone propre à ce lot : l'absence du bouton se voit au banc ; l'enregistrement avec ceinture reste couvert par l'essai 206.
