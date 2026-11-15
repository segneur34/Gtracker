# 382 · Glossaire de traduction (étape G)

Référence commune des dictionnaires `src/locales/en.json` et `src/locales/es.json` : chaque agent qui traduit une moitié s'y tient mot pour mot, pour qu'un même mot français donne partout le même mot anglais et espagnol. Relevé sur les 1 813 clés posées le 14/11 (`node outils/i18n.mjs --manquantes en`), complété par les noms de la palette et des activités, pas encore posés.

Réponses par défaut appliquées en attendant l'utilisateur : anglais britannique (metres, colour, favourite, gybe, manoeuvre, customise), espagnol d'Espagne (móvil, ajustes, vosotros jamais employé), vocabulaire des pratiquants de wing, de kite et de foil, tutoiement en espagnol, impératif simple en anglais. Les termes marqués « à trancher » renvoient à la dernière section ; tant qu'elle n'a pas de réponse, la colonne donne la préférence.

## Noms propres et mots interdits

| français | English | español | note |
|---|---|---|---|
| Gtracker | Gtracker | Gtracker | jamais traduit, jamais décliné |
| GONG | GONG | GONG | jamais traduit |
| (tracker, sans le G) | interdit | interdit | refusé par la garde (`outils/i18n.mjs`) ; dire « GPS recording », « the app », « session recorder » ; en espagnol « grabación GPS », « la app », « registro de sesiones » |
| Wingfoil, Parawing, Windsurf, Windfoil, Kite, Kitefoil, Surf, Paddle, Surf foil, Pumping | identiques | identiques | noms des activités de départ, jamais traduits |
| Bateau (activité et calcul) | Boat | Barco | seule activité de départ traduite |
| Planche à voile (calcul) | Windsurf | Windsurf | |
| Kitesurf (calcul) | Kitesurf | Kitesurf | |
| Voile (famille) | Sailing | Vela | |
| Surf (famille) | Surf | Surf | |
| Toutes les familles | All families | Todas las familias | |

## Navigation et pages

| français | English | español | note |
|---|---|---|---|
| Profil | Profile | Perfil | « Le Profil » : The Profile / El perfil |
| Sessions | Sessions | Sesiones | |
| session, séance, sortie | session | sesión | les trois mots français donnent le même mot |
| Enregistrer (barre du haut, page, bouton rond) | Record | Grabar | sens « enregistrer une trace » |
| Enregistrer (bouton d'un formulaire) | Save | Guardar | sens « garder » : voir « Clés à double sens » |
| Enregistrement | Recording | Grabación | |
| Enregistrer la session | Save session | Guardar la sesión | |
| Enregistrer les modifications | Save changes | Guardar los cambios | |
| Planifier | Plan | Planificar | |
| Planifier un parcours, Créer un parcours | Plan a course, Create a course | Planificar un recorrido, Crear un recorrido | |
| Itinéraire, Itinéraires | Route, Routes | Ruta, Rutas | un parcours enregistré |
| Statistiques | Statistics | Estadísticas | |
| Réglages | Settings | Ajustes | « Réglages › Pratiquant » : Settings › Rider / Ajustes › Deportista |
| Réglages de la session | Session settings | Ajustes de la sesión | |
| Réglages par appareil | Device settings | Ajustes del dispositivo | |
| Mémoire | Storage | Almacenamiento | à trancher (point 5) |
| dossier mémoire | storage folder | carpeta de almacenamiento | à trancher (point 5) |
| fiche (d'une session) | record | ficha | les données propres à une session (nom, notes, vent saisi) |
| activité | activity | actividad | |
| calcul (d'une activité) | base sport | deporte base | le calcul sur lequel s'appuie une activité ; libellé court : « base » / « base » |
| Famille | Family | Familia | |
| Pratiquant (bloc de Réglages) | Rider | Deportista | |
| trace | track | track | à trancher en espagnol (point 8) |
| Trace à suivre, Suivre une trace | Track to follow, Follow a track | Track a seguir, Seguir un track | |
| tracé (dessin de la planification) | path | trazado | |
| Lieu, Lieu de la session | Location, Session location | Lugar, Lugar de la sesión | |
| Classer la session, À classer | File session, Unsorted | Clasificar la sesión, Sin clasificar | ranger une session sous une activité |
| Sans activité | No activity | Sin actividad | |
| Tutoriels, Leçon du jour | Tutorials, Lesson of the day | Tutoriales, Lección del día | |
| Racine du Profil | Profile root | Raíz del perfil | dessin du Profil qui grandit |
| graine, radicelle, étape, fleur, papillon | seed, rootlet, stage, flower, butterfly | semilla, raicilla, etapa, flor, mariposa | vocabulaire de la racine |
| Objectif par semaine | Weekly goal | Objetivo semanal | |
| Activités favorites | Favourite activities | Actividades favoritas | |
| Autorisations | Permissions | Permisos | |
| À propos | About | Acerca de | |

## Voile

| français | English | español | note |
|---|---|---|---|
| vent | wind | viento | onglet « vent » : wind / viento |
| vent saisi, vent calculé | entered wind, calculated wind | viento introducido, viento calculado | « saisi · calculé {deg}° » : entered · calculated {deg}° |
| Direction du vent | Wind direction | Dirección del viento | |
| Variations du Vent, Évolution du Vent | Wind shifts, Wind trend | Rolas del viento, Evolución del viento | |
| Vent inconnu | Wind unknown | Viento desconocido | |
| Régler le vent | Set wind | Ajustar el viento | |
| Régularité (vent et Statistiques) | Consistency | Regularidad | |
| Tendance | Trend | Tendencia | |
| bord | leg | bordo | à trancher (point 1) ; « Plus long bord » : Longest leg / Bordo más largo ; vaut aussi pour les bords d'un parcours planifié |
| Bord en cours, Bord précédent | Current leg, Previous leg | Bordo actual, Bordo anterior | |
| Moyenne du bord | Leg average | Media del bordo | |
| amure | side | amura | à trancher (point 2) ; « Manœuvres par amure » : Manoeuvres by side / Maniobras por amura |
| Bâbord, Tribord | Port, Starboard | Babor, Estribor | « Bâbord (Moy/Max) » : Port (Avg/Max) / Babor (Med/Máx) |
| Près | Upwind | Ceñida | « Tops Près (10s) » : Upwind tops (10 s) / Tops ceñida (10 s) |
| Portant | Downwind | Popa | |
| manœuvre | manoeuvre | maniobra | orthographe britannique |
| virement (tack) | tack | virada | la clé française porte déjà l'anglais entre parenthèses : en anglais, dire « tack » seul |
| empannage (jibe) | gybe | trasluchada | britannique : gybe, jamais jibe |
| Sens incertain | Undecided | Indeterminada | manœuvre ni virement ni empannage |
| réussi, raté | clean, missed | lograda, fallida | accord en espagnol sur le nom (maniobra, virada : féminin ; salto, vuelo : masculin) |
| Manœuvres réussies, % de manœuvres réussies | Clean manoeuvres, % clean manoeuvres | Maniobras logradas, % de maniobras logradas | |
| Gain au vent | Upwind gain | Ganancia a barlovento | |
| Distance de manœuvre | Manoeuvre distance | Distancia de maniobra | |
| Conservation de vitesse | Speed retention | Conservación de velocidad | |
| Temps de relance, sans relance | Recovery time, without recovery | Tiempo de recuperación, sin recuperación | retour à la vitesse après une manœuvre ou un vol |
| Vmin (vitesse minimale en manœuvre) | Vmin | Vmín | |
| VMG | VMG | VMG | onglet « vmg » en minuscules dans les trois langues |
| cap | heading | rumbo | « Changement de cap » : Heading change / Cambio de rumbo |
| Cap balise, Cap bal. | Bearing to mark, Mark brg | Rumbo a baliza, Rbo. bal. | |
| allure (de la session) | cruising speed | velocidad de crucero | à trancher (point 6) ; ce n'est pas l'allure par rapport au vent |
| seuil selon l'allure | speed-adjusted threshold | umbral según la velocidad | |
| polaire | polar | polar | « Polaire de Vitesse (TWA) » : Speed polar (TWA) / Polar de velocidad (TWA) |
| vol (foil) | flight | vuelo | à trancher (point 3) ; « Plus long vol » : Longest flight / Vuelo más largo |
| en vol, Temps en vol, Distance en vol | on foil, Time on foil, Distance on foil | en vuelo, Tiempo en vuelo, Distancia en vuelo | |
| Ratio de vol | Flight ratio | Ratio de vuelo | |
| Seuil de vol | Flight threshold | Umbral de vuelo | |
| vol perdu {s} s | flight lost {s} s | vuelo perdido {s} s | |
| Vols enchaînés | Linked flights | Vuelos encadenados | |
| foil, Support sur foil | foil, Foiling board | foil, Tabla con foil | |
| Mât, Aile / voile | Mast, Wing / sail | Mástil, Ala / vela | champs du matériel |
| pumping, pompé, Temps pompé | pumping, pumped, Pumping time | pumping, bombeado, Tiempo de bombeo | « pumping » reste tel quel |
| Part du vol pompée | Share of flight pumped | Parte del vuelo bombeada | |
| coup (de pumping), m/coup, Par coup | pump, m/pump, Per pump | bombeo, m/bombeo, Por bombeo | |
| série (de pumping) | series | serie | invariable en anglais |
| Ratio de planing | Planing ratio | Ratio de planeo | |
| Ratio de navigation | Sailing ratio | Ratio de navegación | |
| balise | mark | baliza | jamais « buoy » ni « boya » |
| Balises validées | Marks reached | Balizas alcanzadas | |
| Bips d'approche des balises | Mark approach beeps | Pitidos de aproximación a baliza | |
| parcours | course | recorrido | parcours de balises |
| Départ, Arrivée | Start, Finish | Salida, Llegada | « au départ » au sens « au début » : by default / de inicio |
| Arrivée, retour au départ | Finish, back at start | Llegada, vuelta a la salida | |
| Boucler | Close loop | Cerrar el bucle | |
| tronçon | leg | tramo | |
| Meilleurs segments | Best segments | Mejores segmentos | |
| tops (onglet), Top 2 s | tops, Top 2 s | tops, Top 2 s | |
| Sur (en-tête de la table des tops) | Over | En | durée ou distance du passage |
| Plan d'eau | Water | Estado del agua | |
| Plat, Clapot | Flat, Chop | Plano, Picado | |
| Très faible, Faible, Moyen (vent), Fort, Très fort | Very light, Light, Moderate, Strong, Very strong | Muy flojo, Flojo, Moderado, Fuerte, Muy fuerte | clé « Moyen\|\|vent » |

## Surf

| français | English | español | note |
|---|---|---|---|
| vague | wave | ola | onglet « vagues » : waves / olas |
| Sur la vague, Hors vague | On the wave, Off the wave | En la ola, Fuera de la ola | |
| Seuil de vague | Wave threshold | Umbral de ola | |
| Plus longue vague | Longest wave | Ola más larga | |
| Vagues enchaînées, Vagues en un vol | Linked waves, Waves in one flight | Olas encadenadas, Olas en un vuelo | |
| Tri des vagues | Wave sorting | Orden de las olas | |
| rame (onglet) | paddling | remada | pas « paddle », qui est une activité |
| Temps de rame, Vitesse de rame | Paddling time, Paddling speed | Tiempo de remada, Velocidad de remada | |
| Rame et attente | Paddling and waiting | Remada y espera | |
| attente, Temps d'attente | waiting, Waiting time | espera, Tiempo de espera | |
| pic | line-up | pico | à trancher (point 7) |
| Retour au pic, Rame et retour au pic | Back to the line-up, Paddling and back to the line-up | Vuelta al pico, Remada y vuelta al pico | |
| Remontée, Vitesse de remontée | Return, Return speed | Regreso, Velocidad de regreso | trajet vers le pic après une vague ou un vol |
| prise (d'une vague) | caught | cogida | « Prise sans attente » : Caught without waiting / Cogida sin espera |
| décollage | take-off | despegue | vagues, vols et sauts |
| Virages (comptés par le gyroscope) | Turns | Giros | pas « manœuvres » |

## Sauts

| français | English | español | note |
|---|---|---|---|
| saut, Sauts | jump, Jumps | salto, Saltos | |
| Hauteur, Hauteur minimale | Height, Minimum height | Altura, Altura mínima | |
| En l'air | Airtime | En el aire | durée de vol du saut |
| atterrissage | landing | aterrizaje | |
| Plus long saut, Les plus hauts | Longest jump, Highest | Salto más largo, Los más altos | |
| Courbe des sauts | Jump curve | Curva de los saltos | |
| Mesurer les sauts | Measure jumps | Medir los saltos | |
| Emplacement du téléphone | Phone position | Posición del móvil | en espagnol d'Espagne, « móvil », jamais « celular » |
| Bras (brassard) | Arm (armband) | Brazo (brazalete) | |
| Dos (sac) | Back (backpack) | Espalda (mochila) | |
| Poitrine (gilet, harnais haut) | Chest (vest, high harness) | Pecho (chaleco, arnés alto) | |
| Taille (harnais, ceinture) | Waist (harness, belt) | Cintura (arnés, cinturón) | ne pas confondre avec « Taille » seule, la stature (Height / Estatura) |
| Capteurs | Sensors | Sensores | |
| accéléromètre, gyroscope | accelerometer, gyroscope | acelerómetro, giroscopio | |

## Cardio

| français | English | español | note |
|---|---|---|---|
| Fréquence cardiaque | Heart rate | Frecuencia cardiaca | |
| FC | HR | FC | |
| FC max, FC moy., FC moyenne | Max HR, Avg HR, Average HR | FC máx., FC med., FC media | |
| FC repos | Resting HR | FC en reposo | |
| Test de FC repos | Resting HR test | Test de FC en reposo | |
| FC perdue | HR lost | FC perdida | |
| cardio (onglet) | heart rate | cardio | en anglais, l'onglet dit « heart rate » ; « Cardio » seul ailleurs : Heart rate |
| bpm, BPM | bpm | ppm | pulsaciones por minuto |
| Zone cardiaque, Temps par zone | HR zone, Time in zones | Zona cardiaca, Tiempo por zona | Z1 à Z5 restent tels quels ; « sous Z1 » : below Z1 / bajo Z1 |
| Seuils cardio | HR thresholds | Umbrales de FC | |
| S1, seuil aérobie | S1, aerobic threshold | S1, umbral aeróbico | sigle gardé tel quel dans les trois langues (point 10) |
| S2, seuil anaérobie | S2, anaerobic threshold | S2, umbral anaeróbico | sigle gardé tel quel dans les trois langues (point 10) |
| Ceinture cardio | Heart rate strap | Banda de frecuencia cardiaca | court : strap / banda ; « Ceinture : {belt} » : Strap: {belt} / Banda: {belt} |
| Ceintures et montres | Straps and watches | Bandas y relojes | |
| Appareil cardio | HR device | Sensor de FC | |
| pas de contact avec la peau | no skin contact | sin contacto con la piel | |
| Charge | Load | Carga | charge d'entraînement |
| Énergie estimée, env. {kcal} kcal | Estimated energy, approx. {kcal} kcal | Energía estimada, aprox. {kcal} kcal | |
| estimée par l'âge | estimated from age | estimada por la edad | |

## Enregistrement

| français | English | español | note |
|---|---|---|---|
| Démarrer, Arrêter | Start, Stop | Iniciar, Detener | |
| Pause, Reprendre | Pause, Resume | Pausa, Reanudar | |
| Pause automatique, pause auto | Auto-pause, auto-pause | Pausa automática, pausa auto | |
| Démarrage automatique | Auto-start | Inicio automático | |
| Continuer l'enregistrement | Continue recording | Continuar la grabación | |
| Enregistrement en pause | Recording paused | Grabación en pausa | |
| Session terminée | Session finished | Sesión terminada | |
| Gtracker enregistre | Gtracker is recording | Gtracker está grabando | titre de la notification |
| GPS perdu | GPS lost | GPS perdido | |
| en attente du GPS, sans signal | waiting for GPS, no signal | esperando el GPS, sin señal | |
| Satellites utilisés, Précision | Satellites in use, Accuracy | Satélites en uso, Precisión | |
| Bips, Son des bips | Beeps, Beep sound | Pitidos, Sonido de los pitidos | |
| Vibrer aussi | Also vibrate | Vibrar también | |
| Note (bouton), Note {n} posée | Note, Note {n} added | Nota, Nota {n} añadida | |
| repères | markers | marcadores | les notes posées pendant la sortie ; jamais « marks » (réservé aux balises) |
| Appui long pour arrêter, Maintenez le bouton | Long press to stop, Hold the button | Mantén pulsado para detener, Mantén pulsado el botón | |
| Notification, Chiffres de la notification | Notification, Notification figures | Notificación, Datos de la notificación | |
| Jeter (une session) | Discard | Descartar | |
| Rejeu | Replay | Reproducción | rejeu d'un GPX |
| Batterie sans restriction | Unrestricted battery | Batería sin restricciones | |
| Analyser sans les capteurs | Analyse without sensors | Analizar sin los sensores | |

## Matériel et notes

| français | English | español | note |
|---|---|---|---|
| matos et conditions (onglet voile) | gear and conditions | material y condiciones | à trancher (point 4) |
| matériel et notes (onglet surf) | gear and notes | material y notas | à trancher (point 4) |
| Matériel | Gear | Material | |
| pièce (de matériel), groupe | item, group | elemento, grupo | « Créer groupe matériel » : Create gear group / Crear grupo de material |
| Conditions | Conditions | Condiciones | |
| Appréciation, Appréciation de la séance | Rating, Session rating | Valoración, Valoración de la sesión | |
| Nul, Bof, Moyen (appréciation), Bien, Très bien | Awful, Meh, Average, Good, Great | Fatal, Regulín, Normal, Bien, Muy bien | clé « Moyen\|\|appréciation » |
| Commentaire libre | Comments | Comentario libre | |
| notes | notes | notas | |

## Cartes, mémoire et fichiers

| français | English | español | note |
|---|---|---|---|
| Carte, La carte | Map, The map | Mapa, El mapa | |
| Fond de carte, Plan, Satellite | Base map, Standard, Satellite | Mapa base, Estándar, Satélite | |
| Cartes hors ligne | Offline maps | Mapas sin conexión | |
| morceaux (de carte) | tiles | teselas | |
| Place occupée, Plafond | Space used, Limit | Espacio ocupado, Límite | |
| Ma position | My location | Mi ubicación | |
| Légende | Legend | Leyenda | |
| couleurs de la trace, Colorisation de la trace | track colours, Track colouring | colores del track, Coloreado del track | |
| Importer, Importer des GPX ou FIT | Import, Import GPX or FIT files | Importar, Importar GPX o FIT | |
| Exporter le GPX, Télécharger le GPX | Export GPX, Download GPX | Exportar el GPX, Descargar el GPX | |
| Partager, Partager et exporter | Share, Share and export | Compartir, Compartir y exportar | |
| Mettre à jour, Importer, mettre à jour | Update, Import and update | Actualizar, Importar y actualizar | |
| Remise à zéro | Reset | Restablecer | |
| Réglages d'usine | Factory settings | Ajustes de fábrica | |
| Mo, Go | MB, GB | MB, GB | |

## Statistiques

| français | English | español | note |
|---|---|---|---|
| Charge par semaine, Heures par semaine | Load per week, Hours per week | Carga por semana, Horas por semana | |
| Semaines actives | Active weeks | Semanas activas | |
| Plus longue série, Série en cours | Longest streak, Current streak | Racha más larga, Racha actual | semaines d'affilée, pas une série de pumping |
| Records, Record | Records, Record | Récords, Récord | |
| Répartition par activité | Breakdown by activity | Reparto por actividad | |
| Tout, depuis le début | All, all time | Todo, desde el principio | |
| 30 jours, 6 mois, Année | 30 days, 6 months, Year | 30 días, 6 meses, Año | |
| Semaine du {monday} | Week of {monday} | Semana del {monday} | |
| S{week} (semaine) | W{week} | S{week} | |
| Part (colonne) | Share | Parte | |

## Chiffres de la session et unités

| français | English | español | note |
|---|---|---|---|
| Vitesse, Vit. | Speed, Spd | Velocidad, Vel. | |
| Vitesse max, Vmax, v. max | Max speed, Vmax, max spd | Velocidad máx., Vmáx, v. máx. | |
| Vitesse moyenne, Moyenne, Moy. | Average speed, Average, Avg | Velocidad media, Media, Med. | |
| Moyenne active, Moy. act. | Active average, Act. avg | Media activa, Med. act. | |
| Max | Max | Máx. | |
| méd. (médiane) | med. | mdna. | « Vmin méd. » : Vmin med. / Vmín mdna. |
| Distance, Dist., Distance totale | Distance, Dist., Total distance | Distancia, Dist., Distancia total | |
| Durée, Temps total | Duration, Total time | Duración, Tiempo total | |
| Temps en mouvement | Moving time | Tiempo en movimiento | |
| Temps actif, Temps en action, Moyenne en action | Active time, Active time, Active average | Tiempo activo, Tiempo activo, Media activa | |
| Seuil d'activité | Activity threshold | Umbral de actividad | |
| Restant, Reste, Temps restant, Temps rest. | Remaining, Left, Time left, Time left | Restante, Resta, Tiempo restante, T. rest. | |
| Dernier km, Dern. km | Last km, Last km | Último km, Últ. km | |
| Dernier mille, Dern. mille, 1 mille | Last NM, Last NM, 1 NM | Última milla, Últ. milla, 1 milla | mille nautique |
| nœuds, nds | knots, kn | nudos, kn | |
| kilomètres | kilometres | kilómetros | |
| milles nautiques, NM | nautical miles, NM | millas náuticas, MN | MN : abréviation espagnole réglementaire |
| D+ {m} m | Gain {m} m | D+ {m} m | |
| N, E, S, O (points cardinaux) | N, E, S, W | N, E, S, O | clés « N\|\|point cardinal »… ; « O(270°) » : W(270°) / O(270°) |
| 1er, 2e, 3e | 1st, 2nd, 3rd | 1.º, 2.º, 3.º | voir « Clés à double sens » pour « {n}e » |
| N°, n° {n} | No., no. {n} | N.º, n.º {n} | |
| {age} ans | {age} yrs | {age} años | |
| il y a {n} semaines | {n} weeks ago | hace {n} semanas | |
| env. | approx. | aprox. | |
| ex. 178 | e.g. 178 | p. ej. 178 | toutes les clés « ex. … » |

## Couleurs de la palette

| français | English | español | note |
|---|---|---|---|
| Blanc, Noir | White, Black | Blanco, Negro | |
| Océan, Lagon | Ocean, Lagoon | Océano, Laguna | |
| Bleu, Violet, Vert, Jaune | Blue, Purple, Green, Yellow | Azul, Violeta, Verde, Amarillo | |
| Orange, Magenta | Orange, Magenta | Naranja, Magenta | |
| Bordeaux, Graphite | Burgundy, Graphite | Burdeos, Grafito | |

## Mots d'interface récurrents

| français | English | español | note |
|---|---|---|---|
| Annuler | Cancel | Cancelar | |
| Supprimer, Supprimer définitivement, Tout supprimer | Delete, Delete permanently, Delete all | Eliminar, Eliminar definitivamente, Eliminar todo | |
| Tout effacer, Vider | Clear all, Empty | Borrar todo, Vaciar | |
| Fermer, tout fermer | Close, close all | Cerrar, cerrar todo | |
| général (onglet) | overview | general | |
| avancé (pastille) | advanced | avanzado | |
| Tout voir, Voir | See all, View | Ver todo, Ver | |
| Afficher, Montrer | Show | Mostrar | |
| Masquer, Cacher | Hide | Ocultar | |
| Afficher plus | Show more | Mostrar más | |
| Replier, Déplier | Collapse, Expand | Contraer, Desplegar | |
| Réduire, Tout réduire | Shrink, Collapse all | Reducir, Contraer todo | |
| Ajouter | Add | Añadir | |
| Retirer | Remove | Quitar | |
| Renommer | Rename | Renombrar | |
| Modifier | Edit | Editar | |
| Valider, Confirmer | Apply, Confirm | Aplicar, Confirmar | |
| Oui, Non | Yes, No | Sí, No | |
| Garder, Oublier | Keep, Forget | Conservar, Olvidar | |
| Retour, Précédent, Suivant | Back, Previous, Next | Volver, Anterior, Siguiente | |
| Réessayer | Try again | Reintentar | |
| Passer, Plus tard | Skip, Later | Omitir, Más tarde | |
| Ouvrir, Ouvrir l'analyse | Open, Open analysis | Abrir, Abrir el análisis | |
| Chercher, Recherche… | Search, Searching… | Buscar, Buscando… | |
| Chargement…, Lecture… | Loading…, Reading… | Cargando…, Leyendo… | |
| Trier, Trier par, Filtrer par activité | Sort, Sort by, Filter by activity | Ordenar, Ordenar por, Filtrar por actividad | |
| Personnaliser | Customise | Personalizar | |
| Défaut, Par défaut, Revenir au défaut | Default, Default, Reset to default | Predeterminado, Por defecto, Volver al predeterminado | |
| Recentrer | Recentre | Recentrar | |
| Tous, Toutes | All | Todos, Todas | en espagnol, accorder au nom sous-entendu |
| Aucun, Aucune | None | Ninguno, Ninguna | même règle |
| Thème, Économe | Theme, Battery saver | Tema, Ahorro de batería | |
| Langue | Language | Idioma | |
| Aide : {label} | Help: {label} | Ayuda: {label} | |

## Clés à double sens (à corriger dans le code avant les dictionnaires)

- `Enregistrer` sert à la fois pour « enregistrer une trace » (`AppShell.tsx`, `RecordingPage.tsx` : Record / Grabar) et pour « garder » (`ProfilePrompt.tsx`, `PlanningPage.tsx` ligne 856 : Save / Guardar). Une seule traduction est impossible : il faut un contexte sur l'un des deux emplois (`t('Enregistrer||garder')`), et de même pour `enregistrer` en minuscules de `PlanningPage.tsx` ligne 596 (sens « garder »).
- `{n}e` (`SailingModule.tsx` ligne 446) reçoit 2 ou 3 : l'anglais demande « 2nd » et « 3rd », qu'un seul gabarit ne sait pas écrire. Le remplacer par les clés `2e` et `3e` déjà employées par `PODIUM_RANKS`.

## Règles de style

1. Casse : garder celle de la clé. Les onglets et pastilles sont en minuscules en français (« général », « vols », « matos et conditions ») et le restent dans les trois langues ; les titres et libellés commencent par une majuscule, le reste en minuscules (« Max speed », pas « Max Speed »), y compris en anglais. Les boutons d'action passent en capitales par la feuille de style : ne jamais écrire de capitales dans la traduction (sauf sigles : GPS, GPX, FIT, VMG, HR, FC).
2. Ponctuation, anglais : pas d'espace avant « : », « ? », « ! », « ; » ; guillemets doubles typographiques “…” (les simples ‘…’ se confondraient avec l'apostrophe) ; apostrophe droite ' comme dans les clés.
3. Ponctuation, espagnol : pas d'espace avant « : », « ? », « ! », « ; » ; « ¿…? » et « ¡…! » obligatoires ; guillemets «…» sans espace intérieur («Sesiones»), comme le veut l'usage espagnol.
4. Pourcentage : « {n} % » en français et en espagnol (avec espace), « {n}% » en anglais (sans espace). Une unité garde son espace partout : « 12 kn », « 3 s », « 85 cm ».
5. Nombres : les variables `{n}`, `{v}`, `{max}`… arrivent déjà formatées (point décimal en anglais, virgule en espagnol) ; ne rien convertir, ne pas écrire de chiffre à la place d'une variable.
6. Variables et balises : recopier à l'identique chaque `{nom}` (même nom, même casse) et chaque balise `<b>`, `<strong>`, `<em>`, `<a>`, `<lien>`, `</…>` ; on peut les déplacer dans la phrase, jamais les renommer, les traduire, en ôter ou en ajouter. La garde refuse un écart.
7. Contexte : une clé « texte||contexte » (« Moyen||vent », « N||point cardinal ») se traduit selon le contexte ; la traduction ne contient jamais « || » ni le contexte.
8. Pluriels : `tn` donne deux clés, singulier et pluriel ; traduire chacune dans sa forme (« {n} session » : “{n} session”, « {n} sessions » : “{n} sessions”).
9. Longueur : un onglet, une pastille, un en-tête de colonne, une case du direct ou un bouton ne dépasse pas le français de plus de deux ou trois lettres. Abréviations retenues : Spd / Vel., Avg / Med., Act. avg / Med. act., Dist., Last km / Últ. km, Time left / T. rest., Left / Resta, Mark brg / Rbo. bal., max spd / v. máx., Max / Máx.
10. Abréviations : avec point en espagnol (« máx. », « med. », « aprox. », « p. ej. ») ; en anglais, celles du tableau telles quelles (« Avg », « Spd », « Max » sans point ; « approx. », « e.g. », « Dist. » avec).
11. Impératif simple en anglais (« Choose the folder », jamais « Please choose ») ; tutoiement en espagnol (« Elige la carpeta », « Mantén pulsado »), jamais « usted » ni « vosotros ».
12. Points de suspension : le caractère unique « … » de la clé, recopié tel quel (« Loading… »).
13. Mots interdits dans les deux dictionnaires : « tracker » sans son G, et le vocabulaire de la course à pied et du vélo (pace, run au sens de courir, cycling, ritmo de carrera) ; « pace » et « ritmo » sont exclus même pour « allure ».
14. Ce que l'utilisateur a saisi (nom d'activité créée, nom de session, matériel) et les unités SI ne se traduisent pas.

## Points à faire trancher par l'utilisateur

1. « bord » (le tronçon tenu entre deux virages, et chaque segment d'un parcours planifié) : en anglais « leg » ou « tack » ; en espagnol « bordo » ou « tramo ». Préférence : « leg » et « bordo » (« tack » veut déjà dire « virement de bord » en anglais, et « run » rappelle la course à pied).
2. « amure » (bâbord ou tribord, colonne des manœuvres) : en anglais « tack » (port tack, starboard tack, l'usage des régatiers) ou « side ». Préférence : « side », pour ne pas confondre avec les virements, qui s'appellent « tacks » ; en espagnol « amura » sans hésitation.
3. « vol » sur foil : en anglais « flight » (Longest flight, Flight ratio) ou « foiling » (Longest foil run, Time foiling). Préférence : « flight », plus court et le même mot que l'espagnol « vuelo ».
4. « matos » et « matériel » : en anglais « gear » (international) ou « kit » (plus britannique, plus familier comme « matos »). Préférence : « gear » pour les deux onglets, « material » en espagnol.
5. « mémoire » de l'application (le dossier où vivent les sessions) : en anglais « storage » (storage folder) ou « library » (library folder) ; en espagnol « almacenamiento » ou « memoria ». Préférence : « storage » et « almacenamiento ».
6. « allure de la session » (la vitesse de croisière qui sert à régler les seuils, pas l'allure par rapport au vent) : en anglais « cruising speed » ou « session speed » ; en espagnol « velocidad de crucero » ou « velocidad de la sesión ». Préférence : « cruising speed » et « velocidad de crucero ».
7. « pic » en surf (retour au pic) : en anglais « line-up » (Back to the line-up, le mot des surfeurs) ou « peak » (mot à mot) ; en espagnol « pico » sans hésitation. Préférence : « line-up ».
8. « trace » en espagnol : « track » (l'anglicisme courant chez les pratiquants et les applications GPS en Espagne) ou « traza ». Préférence : « track » ; en anglais « track » sans hésitation.
9. Espagnol : tutoiement (« Elige la carpeta », comme la plupart des applications de sport) ou vouvoiement (« Elija la carpeta », plus distant). Préférence : tutoiement.
10. Seuils cardio S1 et S2 : en anglais « T1 / T2 » (threshold) ou garder « S1 / S2 » ; en espagnol « U1 / U2 » (umbral) ou garder « S1 / S2 ». Retenu en attendant : « S1 / S2 » gardés tels quels dans les trois langues (le sigle est aussi un repère du code, et « T1 », « U1 » ne sont pas des abréviations plus connues).
