/**
 * Conversions d'unités. Le noyau travaille en m/s, l'affichage se fait ici.
 */
import { toFixedNumber } from './basics';

export const MS_TO_KNOTS = 1.94384;
export const MS_TO_KMH = 3.6;

/** Pesanteur normale, en m/s² : l'unité des seuils exprimés en g. */
export const STANDARD_G = 9.80665;

/** Unité dans laquelle une vitesse est présentée à l'utilisateur. */
export type SpeedUnit = 'kn' | 'kmh' | 'ms';

export const msToKnots = (ms: number): number => ms * MS_TO_KNOTS;
export const knotsToMs = (kn: number): number => kn / MS_TO_KNOTS;

export const msToKmh = (ms: number): number => ms * MS_TO_KMH;
export const kmhToMs = (kmh: number): number => kmh / MS_TO_KMH;

/**
 * Nombre décimal à l'affichage : virgule française, `decimals` chiffres fixes
 * (« 12,40 »). Le seul formateur des décimales d'écran : les valeurs passées aux
 * bibliothèques, aux fichiers et aux fiches restent des nombres à point.
 */
export const formatDecimal = (value: number, decimals = 1): string => (isFinite(value) ? value.toFixed(decimals).replace('.', ',') : '-');

/** Texte décimal déjà arrondi (« 12.4 ») mis à la virgule pour l'affichage ; tout autre texte est rendu tel quel. */
export const commaDecimal = (text: string | number): string => String(text).replace(/^(-?\d+)\.(\d+)$/, '$1,$2');

/** Nombre lu dans un texte d'affichage (virgule ou point) : l'inverse de `formatDecimal`. */
export const parseDecimal = (text: string): number => parseFloat(text.replace(',', '.'));

/** Entier sur deux chiffres, « 05 ». */
export const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Écart signé, en pourcentage, d'une fraction : « +1,2 % », « −3.0 % ». Un écart
 * nul s'écrit « 0 % » ; avec `zeroSign`, il garde son signe (« +0,0 % »).
 */
export const signedPercent = (fraction: number, { decimals = 1, zeroSign = false }: { decimals?: number; zeroSign?: boolean } = {}): string => {
  const value = formatDecimal(Math.abs(fraction * 100), decimals);
  if (!zeroSign && parseDecimal(value) === 0) return '0 %';
  return `${zeroSign ? (fraction >= 0 ? '+' : '−') : fraction < 0 ? '−' : '+'}${value} %`;
};

/** Convertit une vitesse en m/s vers une unité d'affichage. */
export function toDisplaySpeed(ms: number, unit: SpeedUnit): number {
  switch (unit) {
    case 'kn':
      return msToKnots(ms);
    case 'kmh':
      return msToKmh(ms);
    case 'ms':
      return ms;
  }
}

/** Convertit une vitesse saisie dans une unité d'affichage vers des m/s. */
export const fromDisplaySpeed = (value: number, unit: SpeedUnit): number => {
  switch (unit) {
    case 'kn':
      return knotsToMs(value);
    case 'kmh':
      return kmhToMs(value);
    case 'ms':
      return value;
  }
};

/**
 * Vitesse saisie (`text`, dans l'unité d'affichage `unit`, virgule ou point)
 * rendue dans `thresholdUnit`, l'unité où elle est rangée ; `null` pour un
 * texte vide, illisible (« 12a »), nul ou négatif. Le texte entier doit être
 * un nombre : `parseFloat` lirait « 12 » dans « 12a ».
 */
export const speedFromText = (text: string, unit: SpeedUnit, thresholdUnit: SpeedUnit): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed.replace(',', '.'));
  if (!isFinite(parsed) || parsed <= 0) return null;
  const next = toDisplaySpeed(fromDisplaySpeed(parsed, unit), thresholdUnit);
  return isFinite(next) && next > 0 ? next : null;
};

export const SPEED_UNIT_LABEL: Record<SpeedUnit, string> = {
  kn: 'nœuds',
  kmh: 'km/h',
  ms: 'm/s',
};

/**
 * Origine de la vitesse d'une trace, pour l'aide de l'onglet réglages : celle de
 * l'appareil (avec son unité si ce n'est pas le m/s, lue puis convertie) ou
 * dérivée des positions.
 */
export const speedSourceText = (hasDeviceSpeed: boolean, deviceSpeedUnit: SpeedUnit | null | undefined): string =>
  hasDeviceSpeed
    ? `fournie par l'appareil${deviceSpeedUnit && deviceSpeedUnit !== 'ms' ? `, lue en ${SPEED_UNIT_LABEL[deviceSpeedUnit]} et convertie` : ''}`
    : 'dérivée des positions, filtrée';

/** Symbole court, accolé à une valeur (« 12,4 nds »). */
export const SPEED_UNIT_SYMBOL: Record<SpeedUnit, string> = {
  kn: 'nds',
  kmh: 'km/h',
  ms: 'm/s',
};

/** Formate une vitesse en m/s dans l'unité choisie, avec son symbole. */
export function formatSpeed(ms: number | null, unit: SpeedUnit): string {
  if (ms === null || !isFinite(ms)) return '-';
  switch (unit) {
    case 'kn':
      return `${formatDecimal(msToKnots(ms), 1)} ${SPEED_UNIT_SYMBOL.kn}`;
    case 'kmh':
      return `${formatDecimal(msToKmh(ms), 1)} ${SPEED_UNIT_SYMBOL.kmh}`;
    case 'ms':
      return `${formatDecimal(ms, 2)} ${SPEED_UNIT_SYMBOL.ms}`;
  }
}

/** Formate une valeur déjà exprimée dans l'unité, pour les axes de graphe. */
export const formatSpeedValue = (value: number, unit: SpeedUnit): string => {
  if (!isFinite(value)) return '-';
  return formatDecimal(value, unit === 'ms' ? 2 : 1);
};

/**
 * Vitesse en nœuds convertie dans une unité d'affichage. Le module voile
 * calcule en nœuds (règle 5) : il ne convertit qu'en sortie.
 */
export const knotsToDisplay = (kn: number, unit: SpeedUnit): number => toDisplaySpeed(knotsToMs(kn), unit);

/**
 * Valeur en nœuds, nombre ou texte déjà arrondi (tops, VMG), formatée dans
 * l'unité, sans symbole. Un texte qui n'est pas un nombre (« - ») est rendu
 * tel quel. En nœuds, le texte reçu est rendu inchangé.
 */
export const formatKnots = (kn: number | string, unit: SpeedUnit): string => {
  const value = typeof kn === 'number' ? kn : parseFloat(kn);
  if (!isFinite(value)) return String(kn);
  if (unit === 'kn') return commaDecimal(typeof kn === 'string' ? kn : value.toFixed(1));
  return formatSpeedValue(knotsToDisplay(value, unit), unit);
};

/**
 * Vitesse en nœuds pour un graphe, dans l'unité : le nombre que rend la
 * lecture de `formatKnots`, au même arrondi que l'affichage, sans passer par
 * le texte.
 */
export const knotsToChartValue = (kn: number, unit: SpeedUnit): number => {
  if (!isFinite(kn)) return kn;
  if (unit === 'kn') return toFixedNumber(kn, 1);
  const value = knotsToDisplay(kn, unit);
  return toFixedNumber(value, unit === 'ms' ? 2 : 1);
};

/** Unité dans laquelle une distance est présentée : kilomètres ou milles nautiques. */
export type DistanceUnit = 'km' | 'nm';

export const DISTANCE_UNIT_LABEL: Record<DistanceUnit, string> = {
  km: 'kilomètres',
  nm: 'milles nautiques',
};

export const DISTANCE_UNIT_SYMBOL: Record<DistanceUnit, string> = {
  km: 'km',
  nm: 'NM',
};

/** Longueur d'une unité de distance, en mètres. */
export const METERS_PER_DISTANCE_UNIT: Record<DistanceUnit, number> = {
  km: 1000,
  nm: 1852,
};

/** Convertit une distance en mètres vers une unité d'affichage. */
export const toDisplayDistance = (m: number, unit: DistanceUnit): number => m / METERS_PER_DISTANCE_UNIT[unit];

/** Formate une distance en mètres dans l'unité choisie, avec son symbole. */
export const formatDistance = (m: number, unit: DistanceUnit, decimals = 2): string =>
  isFinite(m) ? `${formatDecimal(toDisplayDistance(m, unit), decimals)} ${DISTANCE_UNIT_SYMBOL[unit]}` : '-';

/** Distance dans l'unité, deux décimales sous 10 unités et une au-delà (bibliothèque, statistiques). */
export const formatDistanceAuto = (m: number, unit: DistanceUnit): string => formatDistance(m, unit, toDisplayDistance(m, unit) < 10 ? 2 : 1);

/** Mètres entiers, « 120 m » ; « — » sans valeur ou sans valeur finie. */
export const formatMeters = (m: number | null): string => (m === null || !isFinite(m) ? '—' : `${Math.round(m)} m`);

/** Distance d'approche (une balise) : en mètres sous 1 000 m, quelle que soit l'unité ; au-delà, dans l'unité. */
export const formatShortDistance = (m: number, unit: DistanceUnit): string =>
  isFinite(m) && m < 1000 ? `${Math.round(m)} m` : formatDistance(m, unit);

/**
 * Formate une durée en millisecondes, par exemple `1 h 24` ou `37 min` : la
 * seule écriture des durées. « - » pour une durée négative, `NaN` ou infinie
 * (C2-6) : aucune durée de l'application n'est négative, et une telle valeur
 * ne s'écrit pas comme un chiffre.
 */
export const formatDuration = (ms: number): string => {
  if (!isFinite(ms) || ms < 0) return '-';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h.toLocaleString('fr-FR')} h ${pad2(m)}` : `${m} min`;
};

/**
 * Durée courte, en secondes : « 45 s », « 1 min 05 », puis comme `formatDuration`
 * au-delà d'une heure ; « - » si `NaN` ou infinie. Une durée négative garde son
 * plancher à 0 : un reste de soustraction (temps pompé) s'écrit « 0 s ».
 */
export const formatShortDuration = (s: number): string => {
  if (!isFinite(s)) return '-';
  const total = Math.max(0, Math.round(s));
  if (total < 60) return `${total} s`;
  if (total >= 3600) return formatDuration(total * 1000);
  return `${Math.floor(total / 60)} min ${pad2(total % 60)}`;
};

/**
 * Durée en `h:mm:ss`, pour un chronomètre ; « - » si `NaN` ou infinie. Une
 * durée négative garde son plancher à 0 : le chrono du direct ne doit jamais
 * montrer « - » sur un reste de soustraction (pause, reprise).
 */
export const formatClock = (ms: number): string => {
  if (!isFinite(ms)) return '-';
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 3600)}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
};

/** Axe de temps d'un graphe, donné en minutes : `h:mm`, ou `h:mm:ss` hors de la minute ronde (graphe zoomé). */
export const formatClockMinutes = (minutes: number): string => formatClock(minutes * 60_000).replace(/:00$/, '');

/** Joules par kilocalorie. */
export const J_PER_KCAL = 4184;

/** Durée en secondes au format `m:ss` (de 0 à 59 min), pour un décompte ; « - » si `NaN` ou infinie, plancher à 0 pour un reste négatif. */
export const formatMinSec = (s: number): string => {
  if (!isFinite(s)) return '-';
  const total = Math.max(0, Math.round(s));
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
};

/** Heure locale `hh:mm:ss` d'un instant, pour désigner un moment de la session. */
export const formatTimeOfDay = (ms: number): string => {
  const date = new Date(ms);
  if (isNaN(date.getTime())) return '-';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

const WEEKDAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** Date et heure de départ d'une session, en heure locale : « mer. 14/10/2026 · 10:02 ». */
export const formatSessionDate = (ms: number): string => {
  const date = new Date(ms);
  if (isNaN(date.getTime())) return '-';
  return `${WEEKDAYS_FR[date.getDay()]} ${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};
