# 418 · Supprimer : un seul geste partout

## Tel que noté (16/11)

« il faudrait homogénéiser les méthodes de supression il y en a plusieurs qui coexister, en plus du code en superflu on ce perd un peu j'aime bien
Le texte en rouge
Appuis long 1 sec
Message de confirmation mais avec la DA de la surpression des session depuis la page où toute les sessions sont ouvertes en liste »

Lecture de Claude, à confirmer : les trois ensemble, pour toute suppression. Le mot « Supprimer » s'écrit en rouge, il se tient une seconde, puis une confirmation s'affiche sur place, au dessin de celle de la liste des sessions, à la place de la fenêtre grise du téléphone.

## Aujourd'hui (relevé dans le code le 16/11)

Cinq façons coexistent.

1. Confirmation sur la ligne, façon Sessions (`src/components/SessionRow.tsx`) : menu « … » › « Supprimer », puis sous la ligne la question « Supprimer cette session de la mémoire ? », un bouton rouge « Confirmer » et « Annuler ». C'est le dessin que l'utilisateur aime.
2. Confirmation sur la ligne, autres mots (`src/pages/RoutesPage.tsx`, `src/pages/PlanningPage.tsx`) : « Supprimer » puis « Supprimer définitivement » / « Garder », sans question écrite ; dans Planifier, un grand bouton rouge « Supprimer l'itinéraire » et, dans la liste, un petit bouton rouge « Supprimer » direct.
3. Bouton tenu une seconde, puis fenêtre du téléphone (`src/components/ui/HoldButton.tsx`) : « Jeter » dans le menu « … » d'une analyse (`src/components/SessionNameEditor.tsx`), « Tout supprimer » et « Réglages d'usine » (`src/components/ResetZone.tsx`).
4. Fenêtre du téléphone seule, sans dessin de l'application : supprimer une activité, couper le matériel d'une activité, effacer les cartes gardées (`src/pages/SettingsPage.tsx`), supprimer un groupe ou une ligne de matériel (`src/components/GearGroupsEditor.tsx`), remplacer les réglages par un fichier (`src/components/SettingsFiles.tsx`), « Jeter » de l'écran de fin d'enregistrement quand il reste (`src/pages/RecordingPage.tsx`), abandonner un itinéraire non enregistré (`src/pages/PlanningPage.tsx`).
5. Un seul appui, sans rien : « Retirer » (photo du Profil, test de FC repos, point d'un itinéraire, point de la courbe des bips, trace suivie), « Supprimer la note » (`src/components/SessionMarks.tsx`), « Oublier » une ceinture (`src/components/HeartRateBeltSettings.tsx`), « Vider » (Réglages).

Trois vocabulaires de confirmation (« Confirmer / Annuler », « Supprimer définitivement / Garder », « OK / Annuler » du téléphone), deux dessins du bouton (rouge plein, discret dans un menu), et le code de chaque confirmation est écrit à part dans sa page.

## Voulu

- Une seule pièce commune (dans `src/components/ui/`) que toutes les suppressions emploient : mot en rouge, tenu une seconde (le cadran de `HoldButton` montre l'appui sous le doigt), puis confirmation sur place au dessin de la liste des sessions : la question écrite, un bouton rouge, « Annuler ».
- Plus aucune fenêtre grise du téléphone pour une suppression ; le code propre à chaque page disparaît.
- Les mots de la confirmation sont les mêmes partout (ceux de Sessions, sauf réponse contraire).
- Rouge : la variable de danger du thème, jamais une valeur en dur.

## Tranché par l'utilisateur le 16/11

- Les trois ensemble, pour toute suppression définitive : mot en rouge, tenu une seconde, puis confirmation sur place au dessin de la liste des sessions.
- Les petits retraits de la façon 5 restent en un seul appui quand ils se rattrapent (point d'itinéraire ou de courbe, note encore en brouillon, photo, trace suivie) ; ce qui est définitif prend le geste commun. Le tri, retrait par retrait, se montre sur la planche (« Oublier » une ceinture et « Vider » sont à classer là).
- Rangé en 3e d'Ensuite, après les lots 416 et 406.

## Proposition de Claude, à montrer sur la planche

- « Abandonner » un itinéraire non enregistré et « remplacer les réglages » ne sont pas des suppressions au sens strict : ils prennent la même confirmation sur place, sans l'appui long.

## Décisions écrites que le lot récrit (passe de documentation, après validation)

- `docs/DECISIONS.md` §6 : « Jeter » […] tenu une seconde puis confirmé (la confirmation change de dessin).
- §7 : liste des itinéraires, « Supprimer définitivement » / « Garder ».
- §11 : remise à zéro, « deux boutons tenus une seconde puis confirmés » ; carte d'une activité, menu « … » avec Supprimer ; liste des sessions, « Supprimer avec confirmation ».

## Contraintes

- Change ce que l'utilisateur voit sur une dizaine d'écrans : maquette d'abord (une planche montrant le geste sur une ligne de session, dans un menu « … » et sur « Tout supprimer »).
- Un appui long dans un menu « … » qui se referme au premier appui : à régler au plan.
- Textes dans les trois langues ; aucun style en ligne neuf ; le banc relève le texte des pages avant et après (les scripts qui suppriment par un simple clic ou par la fenêtre du téléphone sont à adapter, partie à part).

## Essai au téléphone

Rendu tactile de l'appui d'une seconde, du pouce, sur une ligne de la liste des sessions et dans Réglages : à écrire au lot.
