# 350 · Avatar du Profil

Modèle | Réflexion : Sonnet | high

## Tel que noté

Réponse du 12/11 : « de base avatar vide et ensuite à choisir parmi les logos des activités ou sur son tel ». Dernier lot du paquet de la nouvelle apparence, après les logos (349) et l'ouverture sur le Profil (351).

## Aujourd'hui (vérifié le 13/11)

`src/components/ProfileAvatar.tsx` : la photo ronde du Profil est une image importée (`readPickedImage`, `platform/files`), ou un des onze logos dans son cadre au pinceau, choisis dans `AvatarPicker` (grille des onze logos, « Importer une image », « Retirer ») ; l'avatar est rangé avec le profil (`library/athleteProfile.ts`, `AthleteAvatar`). Sans choix, la photo montre le logo du sport préféré (`fallback`), et le rond vide à silhouette (`profile-avatar__disc--empty`) ne se voit que sans aucune session.

## Décisions déjà prises

- Au départ, l'avatar est vide : sans choix, plus de logo du sport préféré à sa place.
- Ensuite, au choix : un logo d'activité ou une photo prise dans le téléphone. Les deux existent déjà et ne changent pas.
- Rien d'imposé : « Retirer » rend l'avatar vide.
- Tranché par l'orchestrateur : l'avatar vide est le rond à silhouette d'aujourd'hui (`profile-avatar__disc--empty`), sans dessin neuf ; un choix déjà enregistré (logo ou photo) est gardé tel quel ; le cadre « Sport préféré » du Profil ne change pas.

## Voulu

1. `ProfileAvatar` sans repli sur le sport préféré : la propriété `fallback` et ce qui ne sert plus qu'à elle s'en vont (appelants compris : `ProfilePage`, et tout autre endroit qui montre l'avatar).
2. L'avatar vide dit qu'on peut le choisir : son bouton porte un nom accessible clair (« Choisir une photo de profil »).
3. La leçon « Le Profil » (`src/tutorials/lessons.ts`) et toute aide « ? » qui dit que la photo montre le sport préféré : réécrites.
4. Tests à jour (ceux qui lisent le repli).
5. Banc : `outils/banc/profil.mjs` et `icones.mjs` (contrôles « photo au départ : le logo du sport préféré », « Retirer rend le dessin du sport préféré », « Profil : photo au logo dans son cadre ») adaptés : avatar vide au départ, logo encadré après un choix, vide après « Retirer » ; `outils/banc/SCRIPTS.md` suit. Lance ces deux scripts un par un (`node outils/banc/passe.mjs <nom> -j 1`).

## Ne pas faire

- Ne pas toucher à l'import d'image, à la grille des logos, ni à la forme enregistrée de l'avatar.
- Ne pas toucher à `docs/` hors de ce brief, ni à `CLAUDE.md`, ni à `package.json`, ni commit ni version.

## Rapport attendu

Le rapport habituel, avec : les fichiers modifiés, les textes changés, le résultat des deux scripts du banc.
