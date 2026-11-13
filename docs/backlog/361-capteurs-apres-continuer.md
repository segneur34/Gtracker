# 361 · Enregistrer : après une coupure et « Continuer », la mesure des sauts reprend, et la ceinture injoignable se dit

Modèle | Réflexion : Opus | high. Suite du lot 360 (fiche `docs/backlog/360-ceinture-apres-fermeture.md`, à lire : même chemin de reprise, même journal). Décisions du domaine : `docs/DECISIONS.md` §3 (Sauts) et §6 (Enregistrement).

## Ce que l'utilisateur a vu

1. Le 13/11 sur la 0.00.40, puis sur la 0.00.43, capture d'écran à l'appui : après une fermeture de force de l'application en plein enregistrement puis « Continuer », la page Enregistrer affiche « Capteurs : la mesure ne reprend pas ; ce qu'ils ont mesuré avant la coupure est gardé. » Les sauts du reste de la session ne sont donc pas mesurés.
2. Essai 240 du lot 360, le 13/11 sur la 0.00.43, ceinture cardio éteinte au moment de « Continuer » : « j'ai toujours le même message d'erreur, capteur, la mesure ne reprend pas ». Le message attendu, « Ceinture cardio injoignable », n'est pas celui qu'il a vu. Avec la ceinture allumée, le même essai réussit (la fréquence cardiaque revient).

## Résultat attendu

- Après une coupure puis « Continuer » (et après une reprise seule), la mesure des capteurs reprend pour la suite de la session, ce qui a été mesuré avant la coupure est gardé, et les sauts d'après la coupure sont comptés. Plus de message « la mesure ne reprend pas » quand elle peut reprendre.
- Ceinture éteinte au moment de « Continuer » : le message « Ceinture cardio injoignable » se voit, et l'enregistrement continue.

## À établir avant de coder

- Pourquoi la capture des capteurs ne reprend pas. Piste de l'agent Plan du lot 360, pas vérifiée : Android ferme la capture avec la page de l'application, et « Continuer » ne fait que retrouver son fichier ; garder le réglage des capteurs dans l'en-tête du journal de l'enregistrement, comme la ceinture depuis le lot 360, relancer la capture en ajoutant au même fichier, et faire accepter un trou aux lecteurs du fichier (calcul des sauts compris).
- Pourquoi « Ceinture cardio injoignable » ne s'est pas vu à l'essai 240 : message masqué ou remplacé par celui des capteurs (un seul emplacement d'avertissement ?), message émis seulement après un délai de connexion que l'utilisateur n'a pas attendu, ou jamais émis sur ce chemin. Le dire avec le fichier et la ligne.

## Contraintes

- Règle 12 de `CLAUDE.md` : capteurs et ceinture uniquement par `src/platform/`.
- Règle 2 et règle 10 : le calcul des sauts tient sur un fichier de capteurs troué, sans supposer une cadence.
- Un ancien journal d'enregistrement, sans le réglage des capteurs dans son en-tête, garde le comportement d'aujourd'hui.
- Rien ne fait jamais renoncer à la reprise de l'enregistrement.

## Essais au téléphone (à la fin)

Fermeture de force en plein enregistrement, « Continuer », puis un saut : il est compté. Le même essai ceinture éteinte : « Ceinture cardio injoignable » s'affiche et l'enregistrement continue.
