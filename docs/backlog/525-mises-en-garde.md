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
