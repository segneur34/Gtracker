import { FILE_FORMATS, MARKER_FILE } from '../core/appIdentity';
import { isFiniteNumber, isObject, parseJson, stringifyJson } from '../core/basics';

export { MARKER_FILE };

/**
 * Disposition du dossier mémoire (détail : `docs/ETAT_DU_PROJET.md` §6.1) :
 *
 *     Gtracker/
 *       gtracker.json    marqueur, pour reconnaître le dossier et dire sa version
 *                        (`readMarkerVersion` : au-delà de `MEMORY_VERSION`, lecture seule)
 *       reglages/        un fichier de réglages par appareil, `<appareil>.json`
 *                        (`settingsFile.ts`)
 *       LISEZMOI.txt     ce qu'est ce dossier, pour qui l'ouvre à la main
 *       fc-repos.json    les tests de FC repos, fusionnés entre appareils
 *                        (`restingHrStore.ts`)
 *       lieux.json       les lieux appris, fusionnés entre appareils
 *                        (`learnedPlaces.ts`)
 *       sessions/        un GPX et sa fiche JSON par session (`record.ts`), et
 *                        ses capteurs `.imu` si les sauts ont été mesurés
 *                        (`core/imuFile.ts`)
 *       itineraires/     une fiche JSON et son GPX par itinéraire planifié
 *                        (`planning/routeRecord.ts`)
 *       journaux/        les journaux d'enregistrement restés illisibles, copiés
 *                        tels quels pour l'utilisateur (`hooks/setAsideJournals.ts`)
 *       corbeille/       programme Windows seulement : l'index des suppressions
 *                        (`corbeille.json`) et un sous-dossier par suppression, gardé
 *                        30 jours (`trash.ts`)
 *       synchro/         programme Windows seulement : la base de la synchronisation
 *                        avec chaque téléphone, et le témoin d'une synchronisation en
 *                        cours (`sync.ts`, `syncBase.ts`)
 */

export const SESSIONS_DIR = 'sessions';
export const ROUTES_DIR = 'itineraires';
/** Journaux d'enregistrement illisibles, rendus à l'utilisateur ; l'application ne les relit pas. */
export const JOURNALS_DIR = 'journaux';
export const SETTINGS_DIR = 'reglages';
export const README_FILE = 'LISEZMOI.txt';
/** Tests de FC repos, à la racine (`restingHrStore.ts`) : pas dans `reglages/`, dont chaque fichier est lu comme un réglage. */
export const RESTING_HR_FILE = 'fc-repos.json';
/** Lieux appris, à la racine pour la même raison (`learnedPlaces.ts`). */
export const LEARNED_PLACES_FILE = 'lieux.json';

export const MEMORY_FORMAT = FILE_FORMATS.memoire;
export const MEMORY_VERSION = 1;

export const sessionPath = (fileName: string): string => `${SESSIONS_DIR}/${fileName}`;
export const routePath = (fileName: string): string => `${ROUTES_DIR}/${fileName}`;
export const settingsPath = (fileName: string): string => `${SETTINGS_DIR}/${fileName}`;

export const markerText = (): string =>
  `${stringifyJson({ format: MEMORY_FORMAT, version: MEMORY_VERSION })}\n`;

/**
 * Version de la disposition dite par le texte du marqueur. Absent, illisible ou d'un autre
 * format : 1, le dossier reste une mémoire ordinaire, et le marqueur n'est pas réécrit pour autant.
 * Au-delà de `MEMORY_VERSION`, le dossier est ouvert en lecture seule.
 */
export const readMarkerVersion = (text: string | null): number => {
  const marker = text === null ? null : parseJson(text);
  return isObject(marker) && marker.format === MEMORY_FORMAT && isFiniteNumber(marker.version) ? marker.version : 1;
};

/** Le `LISEZMOI.txt` en français, une ligne par élément. */
const readmeFrench = (): string[] =>
  [
    'Dossier mémoire de Gtracker',
    '===========================',
    '',
    'Ce dossier contient toutes vos sessions et vos réglages.',
    '',
    '- sessions/ : une trace GPX par session, et à côté une fiche .json du même nom',
    '  (résumé, support, notes). Le GPX fait foi : la fiche se recalcule, sauf les notes.',
    '  Une session dont les sauts ont été mesurés a aussi un fichier .imu du même nom :',
    '  les mesures de l\'accéléromètre et du gyroscope du téléphone.',
    '- itineraires/ : les itinéraires planifiés. La fiche .json fait foi (points de',
    '  passage, tracé) ; le GPX du même nom est à emporter dans une autre application',
    '  ou sur une montre.',
    '- reglages/ : un fichier de réglages par appareil (telephone.json, pc.json…) :',
    '  activités et leurs réglages, barre du bas, profil du',
    '  pratiquant. Chaque appareil écrit le sien. Pour reprendre ceux d\'un autre',
    '  appareil, ou de quelqu\'un d\'autre : déposez son fichier ici, puis dans',
    '  Réglages > Mémoire, « Mettre à jour » et « Reprendre ».',
    '- fc-repos.json : vos tests de FC repos. Chaque appareil y ajoute les siens et',
    '  reprend ceux des autres à l\'ouverture du dossier.',
    '- lieux.json : les lieux que vous avez corrigés, pour nommer les sessions',
    '  suivantes parties du même endroit. Partagés entre appareils comme fc-repos.json.',
    `- ${JOURNALS_DIR}/ : n'existe que si un enregistrement interrompu n'a pas pu être`,
    '  reconstruit : son journal y est copié tel quel, à garder ou à supprimer.',
    `- ${MARKER_FILE} : permet à l'application de reconnaître ce dossier.`,
    '',
    'Sauvegarder ou changer d\'appareil : copiez le dossier Gtracker entier.',
    'Sur le téléphone, il se trouve dans Stockage interne > Documents > Gtracker',
    '(par câble USB depuis le PC, ou avec le gestionnaire de fichiers).',
    '',
    'Ajouter une trace d\'une autre application : déposez son GPX dans sessions/.',
    'L\'application lui crée sa fiche au lancement suivant, ou en touchant',
    '« Mettre à jour » en tête d\'une liste de sessions.',
    '',
    'Ne modifiez pas les fichiers à la main, sauf pour les supprimer : supprimez',
    'alors le GPX, sa fiche et son .imu ensemble.',
    '',
  ];

/** Le même texte en anglais : les noms de fichiers et de dossiers sont ceux du disque, les intitulés ceux de l'écran anglais. */
const readmeEnglish = (): string[] => [
  'Gtracker storage folder',
  '=======================',
  '',
  'This folder holds all your sessions and settings.',
  '',
  '- sessions/: one GPX track per session, and next to it a .json record with the same',
  '  name (summary, sport, notes). The GPX is the reference: the record can be rebuilt,',
  '  except the notes. A session whose jumps were measured also has an .imu file with',
  '  the same name: the phone\'s accelerometer and gyroscope readings.',
  '- itineraires/: the planned routes. The .json record is the reference (waypoints,',
  '  track); the GPX with the same name is there to take into another app or onto a',
  '  watch.',
  '- reglages/: one settings file per device (telephone.json, pc.json...): activities',
  '  and their settings, bottom bar, athlete profile. Each device writes its own. To',
  '  load those of another device, or of someone else: drop their file here, then in',
  '  Settings > Storage, "Update" and "Load".',
  '- fc-repos.json: your resting heart rate tests. Each device adds its own and loads',
  '  those of the others when the folder is opened.',
  '- lieux.json: the places you corrected, used to name later sessions that start from',
  '  the same spot. Shared between devices like fc-repos.json.',
  `- ${JOURNALS_DIR}/: only exists if an interrupted recording could not be rebuilt: its`,
  '  log is copied there as it is, to keep or to delete.',
  `- ${MARKER_FILE}: lets the app recognise this folder.`,
  '',
  'To back up or to change device: copy the whole Gtracker folder.',
  'On the phone, it is in Internal storage > Documents > Gtracker',
  '(over a USB cable from the PC, or with the file manager).',
  '',
  'To add a track from another app: drop its GPX in sessions/.',
  'The app creates its record at the next launch, or when you tap',
  '"Update" at the top of a session list.',
  '',
  'Do not edit the files by hand, except to delete them: then delete the GPX, its',
  'record and its .imu together.',
  '',
];

/** Le même texte en espagnol, sur le même principe. */
const readmeSpanish = (): string[] => [
  'Carpeta de almacenamiento de Gtracker',
  '=====================================',
  '',
  'Esta carpeta contiene todas tus sesiones y tus ajustes.',
  '',
  '- sessions/: un track GPX por sesión, y al lado una ficha .json con el mismo nombre',
  '  (resumen, deporte, notas). El GPX es la referencia: la ficha se puede recalcular,',
  '  salvo las notas. Una sesión cuyos saltos se han medido tiene además un archivo',
  '  .imu con el mismo nombre: las mediciones del acelerómetro y del giroscopio del',
  '  teléfono.',
  '- itineraires/: las rutas planificadas. La ficha .json es la referencia (puntos de',
  '  paso, trazado); el GPX con el mismo nombre sirve para llevarlo a otra aplicación o',
  '  a un reloj.',
  '- reglages/: un archivo de ajustes por dispositivo (telephone.json, pc.json...):',
  '  actividades y sus ajustes, barra inferior, perfil del deportista. Cada dispositivo',
  '  escribe el suyo. Para cargar los de otro dispositivo, o de otra persona: deja su',
  '  archivo aquí y, en Ajustes > Almacenamiento, pulsa «Actualizar» y «Cargar».',
  '- fc-repos.json: tus tests de FC en reposo. Cada dispositivo añade los suyos y',
  '  recupera los de los demás al abrir la carpeta.',
  '- lieux.json: los lugares que has corregido, para nombrar las sesiones siguientes',
  '  salidas del mismo sitio. Se comparten entre dispositivos como fc-repos.json.',
  `- ${JOURNALS_DIR}/: solo existe si una grabación interrumpida no se pudo reconstruir:`,
  '  su registro se copia aquí tal cual, para conservarlo o borrarlo.',
  `- ${MARKER_FILE}: permite que la aplicación reconozca esta carpeta.`,
  '',
  'Para hacer una copia de seguridad o cambiar de dispositivo: copia la carpeta Gtracker entera.',
  'En el teléfono está en Almacenamiento interno > Documents > Gtracker',
  '(por cable USB desde el PC, o con el gestor de archivos).',
  '',
  'Para añadir un track de otra aplicación: deja su GPX en sessions/.',
  'La aplicación crea su ficha en el siguiente arranque, o al pulsar',
  '«Actualizar» en la parte superior de una lista de sesiones.',
  '',
  'No modifiques los archivos a mano, salvo para borrarlos: borra entonces el GPX,',
  'su ficha y su .imu juntos.',
  '',
];

/** Ligne qui sépare les trois langues du `LISEZMOI.txt`. */
export const README_SEPARATOR = '-'.repeat(78);

/**
 * Texte du `LISEZMOI.txt` : français, puis anglais, puis espagnol, dans un seul fichier (le dossier se partage entre
 * appareils et il s'ouvre à la main, sans langue connue), séparés par une ligne de tirets, en fins de ligne Windows :
 * il sera surtout ouvert sur un PC.
 */
export const readmeText = (): string =>
  [...readmeFrench(), README_SEPARATOR, '', ...readmeEnglish(), README_SEPARATOR, '', ...readmeSpanish()].join('\r\n');
