# 440 · Surf : orienter les vagues à la main, et une orientation automatique fiable

| Modèle | Réflexion |
|---|---|
| Fable | high (après le 439 ; plan par l'agent `Plan`) |

## Tel que dit (18/11)

« Ensuite, on le fera plus tard, mais dans un prochain lot, il va falloir pouvoir orienter les vagues. Et avoir une orientation automatique des vagues. » Confié à Fable avec les éléments 439 (zone du pic, retour au pic) et 424 (virages).

## Aujourd'hui

Le sens des vagues est seulement estimé (`src/surfing/waveSense.ts`, lot 436 A) et peut valoir `null` ; rien ne permet de le dire à la main. Il sert à écarter, sur foil, les remontées pompées prises pour des vagues, et à orienter la zone du pic (lot 436 B).

## Voulu

- **Orientation automatique** : le sens des vagues estimé sur chaque session de surf, fiable en surf comme sur foil, avec un repli dit clairement quand il n'est pas estimable (ce que le 439 aura appris sur les sessions réelles).
- **Orientation à la main** : dans l'onglet réglages de l'analyse surf, l'utilisateur donne le sens des vagues de la session, comme le vent saisi en voile (DECISIONS §1, règle 7 de `CLAUDE.md`, et « Donnée propre à une session » de `CLAUDE.md` : dans la fiche, par le brouillon et « Enregistrer la session ») ; le sens saisi prime sur l'estimé, et tout ce qui en dépend se recalcule (zone du pic, remontées pompées sur foil).
- Le sens se voit sur la carte (par exemple une flèche, comme le vent en voile) : dessin sur planche d'abord (« Maquette d'abord » de `/chaine`).
- Questions de produit à poser à l'utilisateur au plan : forme de la saisie (cap en degrés, rose des vents, glisser une flèche sur la carte), et si un sens saisi doit se retenir par lieu (même spot, même orientation) ou rester propre à la session.

## Dépend de

Le 439 : il dit sur données réelles pourquoi le sens automatique échoue, et ce lot en part.
