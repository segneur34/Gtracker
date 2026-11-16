# 423 · Surf : le début des vagues n'est pas compté

## Tel que noté (16/11, après une session)

« il faut revoir aussi la façon dont on calcule le départ de la vague. Là j'ai fait une petite session, clairement la fin de mes surfs il est compté en surf mais pas les débuts. Alors après les conditions étaient très légères, etc., pas facile, mais je pense qu'il y a un truc à revoir avec ça. »

Activités citées avec la note voisine (virages, élément 424) : surf, paddle foil, paddle surf.

## Aujourd'hui (lu dans le code le 16/11)

`src/surfing/surfAnalysis.ts` : une vague est une suite de pas dont la vitesse lissée dépasse le seuil de vague de la session (sur foil : un vol au seuil de vol, les vagues étant ses passages au-dessus du seuil de vague en foil), gardée si elle dure et couvre un minimum. Son début est donc le premier point au-dessus du seuil, rien avant.

Conséquence attendue par petites conditions : la planche accélère lentement, le seuil n'est franchi qu'une fois la vague bien entamée, et tout le départ (la mise en vitesse) reste compté en rame. La fin, elle, est comptée jusqu'au retour sous le seuil. Durée, distance et nombre de virages de chaque vague sont alors trop courts, et une vague molle peut ne pas être comptée du tout.

Hypothèse à vérifier, pas un fait : le lissage de la vitesse retarde aussi le franchissement du seuil au départ et le prolonge à la fin, ce qui irait dans le sens de ce que l'utilisateur a vu.

## Premier geste du lot

Comme pour le calage du GPS (lot 417) : une trace synthétique de vagues molles (accélération lente de la vitesse de rame à une vitesse à peine au-dessus du seuil, puis retour) pour mesurer de combien le début est rogné, à 1 Hz et à 5 Hz, avec et sans foil. Rien n'est corrigé avant cette mesure.

## Pistes, à trancher au plan

- Remonter le début d'une vague retenue jusqu'au début de sa mise en vitesse : le dernier moment, avant le franchissement du seuil, où la vitesse était encore à l'allure de rame (borné en secondes, jamais en nombre de points : règles 2 et 10). La fin n'est pas touchée.
- Un rapport sans dimension plutôt qu'un seuil absolu de plus (part de la vitesse de la vague, ou accélération soutenue).
- Corriger le décalage du lissage au départ s'il est mesuré.

## Ce que l'utilisateur peut essayer dès maintenant

Dans l'analyse de cette session, onglet réglages : baisser le seuil de vague de la session. Si les débuts reviennent, le calcul est juste mais le seuil par défaut est trop haut pour de petites conditions ; s'ils ne reviennent pas ou si la rame devient des vagues, c'est bien le départ qu'il faut recalculer.

## Données demandées à l'utilisateur (16/11, en clair)

- L'activité de la session (surf, paddle surf, paddle foil).
- Le seuil de vague affiché dans l'onglet réglages de son analyse.
- À peu près combien de secondes manquent au début d'une vague.
- Ce que donne l'essai du seuil baissé.

## Contraintes

- Noyau du surf : DECISIONS §4 à relire avant tout (« Vague : au-dessus du seuil de vague »), la phrase sera amendée à la passe de documentation.
- Les chiffres des sessions déjà rangées changent : le numéro de version du résumé augmente, les sessions se recalculent.
- Aucun GPX réel dans le dépôt : la validation se fait par l'utilisateur, sur cette session.
