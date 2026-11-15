import type { SportFamily } from '../core/sportProfiles';
import { PROFILE_PLANT_VISIBLE } from '../core/profilePlant';
import { t } from '../core/i18n';

/**
 * Programme des tutoriels : une leçon par nouveau jour
 * d'ouverture de l'application, dans cet ordre, pour faire découvrir ses
 * fonctions de l'enregistrement aux balises d'un parcours. Des données seules,
 * sans React : l'icône est un nom (`components/LessonIcon.tsx`), la page à
 * essayer une adresse.
 */

/** Icône d'une leçon, dessinée par `components/LessonIcon.tsx`. */
export type LessonIcon =
  | 'enregistrer' | 'analyse' | 'carte' | 'activites' | 'memoire' | 'profil' | 'notes'
  | 'statistiques' | 'itineraires' | 'cardio' | 'voile' | 'capteurs' | 'partage';

/** Page ouverte par « Essayer » : une adresse de l'application. */
type LessonTarget = `/${string}`;

export interface Lesson {
  /** Identifiant, dans l'adresse (`/tutoriels/:id`) et la liste des leçons lues : ne pas le changer. */
  id: string;
  title: string;
  /** Une ligne, sous le titre de la carte du jour et dans la liste. */
  hook: string;
  /** Familles concernées : la leçon est sautée quand elles sont toutes cachées ; aucune, elle vaut pour tous. */
  families?: readonly SportFamily[];
  icon: LessonIcon;
  target: LessonTarget;
  /** Quelques courts paragraphes, en français courant. */
  body: readonly string[];
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'enregistrer',
    title: t('Enregistrer une session'),
    hook: t("Le bouton rond, le choix de l'activité, puis l'analyse s'ouvre à la fin."),
    icon: 'enregistrer',
    target: '/enregistrer',
    body: [
      t('Le bouton rond, au milieu de la barre du bas, ouvre la page Enregistrer.'),
      t("Choisissez d'abord l'activité : la liste ne propose que les vôtres, celles de Réglages. Elle se change encore pendant la sortie."),
      t("« Démarrer » lance le GPS. L'écran peut s'éteindre, l'enregistrement continue ; un appui long de deux secondes sur le bouton rond met en pause, puis relance."),
      t("Pour finir, tenez « Arrêter » appuyé deux secondes : l'appui long évite un arrêt par mégarde. Ces deux durées se règlent dans Réglages › Enregistrement."),
      t("À l'arrêt, la session est rangée dans la mémoire et son analyse s'ouvre. Pour la jeter : « … » à côté de son nom, puis « Jeter », tenu une seconde et confirmé."),
    ],
  },
  {
    id: 'analyse',
    title: t('Lire une analyse'),
    hook: t('« Général » pour l\'essentiel, « avancé » pour le détail, des panneaux à votre taille.'),
    icon: 'analyse',
    target: '/sessions',
    body: [
      t("Touchez une session dans la page Sessions : son analyse s'ouvre sur l'onglet « général », qui porte l'essentiel des chiffres."),
      t("La pastille « avancé » déplie les autres onglets : tops, graphiques, cardio et la suite, selon le sport. Chaque session s'ouvre sur « général » seul ; « tout fermer », à droite de la barre, replie tout d'un geste."),
      t('Un panneau se redimensionne en tirant sa poignée ; sa taille est gardée.'),
      t('Les onglets montrés se choisissent par activité, dans Réglages, ligne « Onglets ».'),
      t('Les petits « ? » ouvrent une explication sur place ; un second toucher la referme.'),
    ],
  },
  {
    id: 'carte',
    title: t('La carte'),
    hook: t('Zoomer, passer en plein écran, et lire la vitesse dans les couleurs de la trace.'),
    icon: 'carte',
    target: '/sessions',
    body: [
      t("La trace est colorée par la vitesse : grise quand vous allez lentement, puis un dégradé jusqu'aux plus grandes vitesses. Les bornes se règlent par activité dans Réglages, ou pour une seule session dans son onglet « réglages »."),
      t('Deux doigts pour zoomer, un pour se déplacer. Sur le téléphone, un toucher sur la carte l\'ouvre en plein écran ; tourné, il s\'y met de lui-même. Le retour la referme.'),
      t('Sous un graphe, « +carte » ouvre la carte avec les graphes dessous : le doigt posé sur un graphe montre le point sur la trace.'),
      t('Le bouton sous le + et le − passe du plan à la photo satellite.'),
    ],
  },
  {
    id: 'activites',
    title: t('Vos activités'),
    hook: t("Créer les vôtres, choisir leur couleur, les cacher d'un œil."),
    icon: 'activites',
    target: '/parametres',
    body: [
      t('Dans Réglages › Activités, chaque famille (voile, surf) range ses activités. Seules celles-là sont proposées partout : à l\'enregistrement, dans les analyses et sur la page Sessions, où chacune a son logo.'),
      t("Au bas du bloc, créez la vôtre : un nom, une couleur parmi les douze de la palette, et le calcul sur lequel elle repose (wingfoil, kite, surf…)."),
      t("L'œil cache une activité, ou une famille entière : elle disparaît partout, sessions comprises, sans rien effacer."),
      t('Chaque activité démarre sur des réglages tout faits ; « Par défaut », dans le menu « … » de sa carte, les lui rend.'),
    ],
  },
  {
    id: 'memoire',
    title: t('Le dossier mémoire'),
    hook: t('Où sont vos sessions, et comment les garder.'),
    icon: 'memoire',
    target: '/parametres',
    body: [
      t('Sur le téléphone, vos sessions vivent dans un dossier « Gtracker » que vous désignez dans Réglages › Mémoire : pour chacune, son fichier GPX et sa fiche (notes, matériel, réglages de la session).'),
      t('Ce dossier est votre sauvegarde : copiez-le sur un ordinateur ou un disque pour tout garder, ou pour changer de téléphone.'),
      t("Deux appareils peuvent partager le même dossier. Chacun y garde son fichier de réglages ; « Reprendre », dans Réglages › Mémoire, prend ceux d'un autre appareil."),
      t("Pour ajouter des sessions venues d'ailleurs, « Importer des GPX ou FIT » est dans le « … » à droite du titre de la page Sessions."),
    ],
  },
  {
    id: 'profil',
    title: t('Le Profil'),
    hook: PROFILE_PLANT_VISIBLE
      ? t('La racine qui pousse à chaque semaine tenue, et sa fleur.')
      : t("La page où s'ouvre l'application : votre photo, vos chiffres et le temps par activité."),
    icon: 'profil',
    target: '/profil',
    body: PROFILE_PLANT_VISIBLE
      ? [
        t("L'application s'ouvre sur le Profil ; vos sessions sont juste à côté, dans « Sessions »."),
        t('Le Profil résume vos activités sur la période choisie : vos trois activités favorites, la distance et le temps par activité.'),
        t('Autour des cadres pousse une racine : elle gagne une étape à chaque semaine où vous tenez votre objectif, et fait le tour de la page en 26 semaines. Des semaines manquées la font reculer.'),
        t("Au-dessus du sol, la pousse fleurit avec le temps de la semaine : un bouton, une fleur ouverte à l'objectif, épanouie à 4 fois l'objectif ; au-delà, un papillon arrive à côté d'elle, puis s'y pose."),
        t('Touchez le carré à droite du pseudo : une bulle dit où vous en êtes et ce qu\'il reste à faire.'),
        t("L'objectif par semaine se règle dans Réglages › Pratiquant (45 min au départ)."),
      ]
      : [
        t("L'application s'ouvre sur le Profil. Vos sessions sont juste à côté : « Sessions », la case voisine de la barre du bas, ou le lien du haut sur ordinateur."),
        t('Le Profil résume vos activités sur la période choisie : vos trois activités favorites, la distance et le temps par activité.'),
        t('La photo ronde est vide au départ : touchez-la pour choisir un des logos d\'activité, ou une image de votre téléphone ; « Retirer » la vide de nouveau. Le pseudo se règle dans Réglages › Pratiquant.'),
        t('Une seule période pour toute la page : semaine, 30 jours, 6 mois, année ou depuis le début.'),
        t("Sur ordinateur, « Vos activités » se tient à droite avec vos cinq dernières sessions : touchez le logo d'une activité pour ne voir que les siennes ; « Toutes les sessions » ouvre la liste entière."),
      ],
  },
  {
    id: 'notes',
    title: t('Matériel et notes'),
    hook: t('Une appréciation, un commentaire et le matériel de chaque session.'),
    icon: 'notes',
    target: '/sessions',
    body: [
      t("Dans chaque analyse, l'onglet « matériel et notes » (« matos et conditions » en voile), juste avant « réglages », garde votre appréciation de la séance et un commentaire."),
      t('Le matériel se choisit dans la liste de l\'activité, que vous créez dans Réglages (« Créer liste matériel ») ; une session sans matériel donné reste vide, rien n\'est repris d\'une autre.'),
      t("Rien n'est écrit avant « Enregistrer la session » : « Annuler » rend la session telle qu'elle était, et l'application prévient si vous quittez sans enregistrer."),
      t('Le matériel noté se retrouve dans les Statistiques, qui le croisent avec vos chiffres.'),
    ],
  },
  {
    id: 'statistiques',
    title: t('Statistiques'),
    hook: t('Vos sessions mises ensemble : chiffres, graphique, régularité.'),
    icon: 'statistiques',
    target: '/statistiques',
    body: [
      t('Statistiques rassemble toutes vos sessions. Choisissez la famille, puis l\'activité, le matériel et la période : tous les chiffres suivent.'),
      t('Le graphique montre la donnée de votre choix au fil du temps.'),
      t('« Régularité » compte vos semaines actives, votre plus longue série et celle en cours.'),
      t('Le retour remonte d\'un cran à chaque fois : de l\'activité à la famille, puis à la vue d\'ensemble.'),
    ],
  },
  {
    id: 'itineraires',
    title: t('Planifier un parcours'),
    hook: t("Poser des balises, puis les suivre à l'enregistrement."),
    icon: 'itineraires',
    target: '/itineraires',
    body: [
      t("En bas de la page Sessions, « Créer un parcours » ouvre la planification (sur ordinateur, « Planifier » dans la barre du haut) : touchez la carte pour poser les balises, reliées en ligne droite. La recherche trouve un port, une plage ou un spot."),
      t("Le parcours donne la distance et le cap de chaque bord ; « Boucler » ajoute un dernier bord qui ramène au départ."),
      t("Un GPX venu d'ailleurs se charge tel quel comme itinéraire, et un parcours s'exporte en GPX."),
      t("Enregistré, l'itinéraire se retrouve sous « Itinéraires », juste à côté ; « Partir » ouvre l'enregistrement, où « Suivre une trace » le propose avec son activité."),
    ],
  },
  {
    id: 'cardio',
    title: t('Ceinture cardio et zones'),
    hook: t('La ceinture, vos fréquences cardiaques et le test de FC repos.'),
    icon: 'cardio',
    target: '/profil',
    body: [
      t("Une ceinture cardio Bluetooth se relie dans Réglages › Capteurs ; une fois retenue, l'enregistrement la reprend."),
      t('Dans Réglages › Pratiquant, la FC max et la FC de repos fixent vos zones cardiaques, et leurs seuils se règlent au même endroit. Sans FC max, elle est estimée par l\'âge.'),
      t('Un test guidé mesure la FC de repos, trois minutes immobile : il est dans Réglages › Pratiquant.'),
      t("L'onglet « cardio » des analyses montre le temps passé dans chaque zone."),
    ],
  },
  {
    id: 'voile',
    title: t('La voile'),
    hook: t("Le vent, les virements et empannages, et les balises d'un parcours."),
    families: ['voile'],
    icon: 'voile',
    target: '/sessions',
    body: [
      t("Une session de voile s'analyse sans rien saisir : le vent est estimé d'après vos manœuvres et vos vitesses selon le cap."),
      t('Si vous le connaissez, saisissez-le (« Régler ») : tous les angles suivent.'),
      t("L'onglet « manœuvres » compte les virements et les empannages, réussis ou ratés, avec la vitesse gardée ; « vmg » montre ce que vous gagnez face au vent ou sous le vent."),
      t("Le seuil de vitesse sépare le temps en action du temps à l'arrêt ; il suit l'allure de la session, et se règle dans l'onglet « réglages »."),
      t("Pour une régate ou un entraînement, la planification pose des balises numérotées ; à l'enregistrement, des bips annoncent l'approche de chacune."),
    ],
  },
  {
    id: 'capteurs',
    title: t('Sauts et pumping'),
    hook: t('Les capteurs du téléphone mesurent vos sauts et votre pumping.'),
    families: ['voile', 'surf'],
    icon: 'capteurs',
    target: '/parametres',
    body: [
      t('Le téléphone porte des capteurs de mouvement : Gtracker s\'en sert pour mesurer la hauteur et la durée de vos sauts, en wing ou en kite.'),
      t("La case « Mesurer les sauts » se coche par activité, dans Réglages ; elle est alors proposée à l'enregistrement, et l'onglet « sauts » de l'analyse les liste."),
      t("Sur foil, le pumping (coups, fréquence, décollage de chaque vol) se mesure téléphone fixé sur la poitrine : cochez « Pumping foil » sur l'activité, puis « Mesurer le pumping » dans Enregistrer."),
    ],
  },
  {
    id: 'partage',
    title: t('Partager et exporter'),
    hook: t('Une image de votre session, ou son fichier GPX.'),
    icon: 'partage',
    target: '/sessions',
    body: [
      t("Dans une analyse, le « … » à côté du nom de la session propose « Partager l'image » : une image carrée de la trace et des chiffres que vous choisissez, avec ou sans fond de carte."),
      t('Vos choix de chiffres sont retenus par activité.'),
      t("« Télécharger la session » range son fichier GPX dans Téléchargements : il s'ouvre dans les autres applications, et Gtracker le relit tout entier, notes comprises."),
    ],
  },
];
