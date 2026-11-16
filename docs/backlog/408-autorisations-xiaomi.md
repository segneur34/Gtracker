# 408 · Autorisations : que le téléphone ne coupe pas un enregistrement, application fermée

## Demande (15/11, après le lot 403)

« Normalement, il demande automatiquement le sans restriction. Si c'est pas le cas, il faut le préciser à la demande des autorisations. Ou que ça arrive directement dessus, ça serait le mieux. »

## Relevé du 15/11

- La batterie « sans restriction » est déjà demandée d'office par la carte « Autorisations » du Profil (fenêtre d'Android en direct), et son état se lit.
- Le démarrage automatique de Xiaomi n'a qu'un bouton « Ouvrir » : il n'est pas dans « Tout autoriser », son état n'est pas lu, et rien ne prévient au départ d'un enregistrement.
- Sur le téléphone de l'utilisateur (par le câble) : batterie sans restriction accordée, démarrage automatique apparemment refusé (réglage interne de Xiaomi, à confirmer à l'écran).

## À faire

1. « Tout autoriser » finit, sur un Xiaomi (Xiaomi, Redmi, POCO), par l'écran du démarrage automatique.
2. La ligne du démarrage automatique dit pourquoi : « pour que l'enregistrement continue, application fermée ». Elle se cache sur les autres marques.
3. Son état est lu si le téléphone le permet. À essayer ; si la lecture n'est pas fiable, la ligne garde son seul bouton, sans état inventé : le dire dans le rapport.
4. Au départ d'un enregistrement, une ligne avec son bouton prévient si la batterie est restreinte. Elle ne bloque jamais le départ.

## Tranché par l'orchestrateur (questions mineures)

- La ligne du point 4 ne parle que de la batterie, dont l'état se lit ; le démarrage automatique n'y entre que si son état est lu de façon fiable (point 3).
- La page Enregistrer sera redessinée par le lot 416 : la ligne du point 4 reprend les pièces d'alerte déjà en place sur cette page, sans dessin neuf.

## Plan (agent Plan, 16/11, confronté aux décisions par l'orchestrateur)

Existant : la carte est dans `src/components/PermissionsStatus.tsx` (`PermissionsPrompt` au Profil, `PermissionsSettings` dans Réglages, toutes deux sur `PermissionRows` et `askAll`). La ligne « Démarrage automatique » appelle `openAutostart` de `src/platform/permissions.ts`, sans état, sur toutes les marques. Greffon : `PermissionsPlugin.java` (`batteryStatus`, `requestUnrestrictedBattery`, `openAutostart`). La batterie se lit par `readPermissions` (restreinte = `'denied'`), se demande par `requestPermission('battery')`, et se relit au retour dans l'application par `usePermissions` (`src/hooks/usePermissions.ts`, `onAppResume`).

Étapes, dans l'ordre :
1. `PermissionsPlugin.java` : méthode `autostartStatus()` qui rend `{ manufacturer, brand, mode }` ; `manufacturer` et `brand` de `Build` ; `mode` lu par réflexion sur `AppOpsManager.checkOpNoThrow(10008, uid, paquet)`, l'opération interne du démarrage automatique de MIUI : 0 → `granted`, 1 → `denied`, exception ou autre valeur → `unknown`. Commentaire de tête mis à jour (il dit « ni état lisible »).
2. `src/platform/permissions.ts` : `autostartStatus` dans l'interface, `readAutostart()` (`null` dans le navigateur ou sur échec), et `waitForAppResume(timeoutMs)`, une seule fois, sur `onAppResume`.
3. `src/recording/permissionsPrompt.ts`, fonctions pures avec tests dans `permissionsPrompt.test.ts` : `isXiaomiDevice({ manufacturer, brand })` (xiaomi, redmi, poco, casse ignorée), `autostartState(raw)` → `'granted' | 'denied' | 'unknown' | null` (`null` : autre marque), `batteryRestricted(status)`.
4. `src/hooks/usePermissions.ts` : rend aussi `autostart`, lu dans le même `refresh`.
5. `PermissionsStatus.tsx` : ligne cachée si `autostart === null` ; texte « Pour que l'enregistrement continue, application fermée. » ; pastille d'état seulement pour `granted` ou `denied` ; `askAll` : demandes du système, puis batterie, puis, sur un Xiaomi dont l'état n'est pas `granted`, `waitForAppResume` (si l'écran de la batterie a été ouvert) suivi de `openAutostart`.
6. `src/pages/RecordingPage.tsx` : au repos, sous `rec-actions`, une rangée `rec-rescue` avec `rec-rescue__actions` (comme `GpsRescue` et `BeltRescue`) : texte « Batterie restreinte : Android peut couper l'enregistrement, application fermée. » et un `Button size="s"` « Autoriser » qui appelle `requestPermission('battery')` ; montrée si `native && !busy && !pending` et batterie restreinte ; la batterie sort alors de la note de bas de page (`rec-footnote`), pour ne pas la dire deux fois ; `usePermissions` remplace `useMissingPermissions` s'il sert les deux usages ; « Démarrer » n'est jamais désactivé par cette rangée.
7. `src/locales/en.json` et `es.json` : clés neuves, et retrait de la clé de l'ancien texte de la ligne Xiaomi si elle n'est plus employée (sinon `outils/i18n.mjs` la dit orpheline).
8. `src/platform/nativeConstants.test.ts` : un bloc « greffon Permissions » sur le modèle du bloc « greffon Recording » (chaque méthode appelée par `permissions.ts` est un `@PluginMethod` du greffon ; les clés `manufacturer`, `brand`, `mode` sont posées).

Gardes : aucun `style={{` neuf (`outils/styles-en-ligne.json`), seules les classes existantes servent.

Tranché par l'orchestrateur sur les questions du plan :
- un démarrage automatique lu « refusé » ne compte pas dans « il manque » et ne fait pas revenir la carte du Profil : il reste hors de `PermissionKey` et de `missingPermissions` tant que la lecture n'est pas prouvée fiable au téléphone ;
- la rangée de batterie d'Enregistrer ne se montre qu'au repos, pas pendant l'enregistrement ;
- la note « ne pas balayer l'application » de la page Enregistrer n'est pas touchée par ce lot ;
- si le retour de l'écran de la batterie n'est pas signalé dans les 60 s, « Tout autoriser » s'arrête là, sans ouvrir l'écran du démarrage automatique ;
- la lecture de l'état est un essai : si le téléphone ne la voit pas basculer, on ne retirera que la pastille.

À la passe de documentation, après validation : `docs/DECISIONS.md` §8 (« démarrage automatique de Xiaomi en simple lien ») et les lignes d'ETAT sur les autorisations sont à récrire ; le lot n'y touche pas.

## Contraintes

- Autorisations et réglages du téléphone : uniquement par `src/platform/` (règle 12 de `CLAUDE.md`).
- Texte visible par `t`, clé en français, `en.json` et `es.json` complétés.
- Décisions à lire avant : `docs/DECISIONS.md` §6 (enregistrement) et §9 (Profil).
- Aucun style en ligne neuf, couleurs par les variables du thème.

## Résultat attendu

Un utilisateur de Xiaomi arrive sur le bon réglage sans le chercher, et l'essai de l'enregistrement tenu application balayée ne dépend plus d'un réglage fait à la main.

## Essai au téléphone

Sur le Xiaomi : Profil, carte « Autorisations », « Tout autoriser » → l'écran du démarrage automatique s'ouvre en dernier, et la ligne dit à quoi il sert.
