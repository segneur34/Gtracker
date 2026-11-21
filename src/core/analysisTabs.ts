import { isObject } from './basics';
import { t } from './i18n';
import type { SportFamily, SportProfile } from './sportProfiles';

/**
 * Onglets des analyses, par module, dans l'ordre de leur barre. Chaque
 * activité choisit dans Réglages ceux qu'elle montre : un onglet du module
 * est montré tant qu'on ne le cache pas, un onglet générique (`generic`) est
 * caché tant qu'on ne le coche pas. Tous se cachent, « général » et
 * « réglages » compris (choix du produit).
 *
 * Pour ajouter un onglet : une entrée dans la liste de son module (ouvert par
 * défaut s'il est `primary`, `tabDefaults`), puis, dans la page, un bloc
 * `{open.maCle && (...)}` ; un onglet générique porte `generic` dans les
 * modules où il n'est pas natif, et sa pièce est partagée (`TopsPanel`).
 */
export interface AnalysisTab<K extends string = string> {
  key: K;
  label: string;
  /** Onglet générique : caché tant que l'activité ne le coche pas. */
  generic?: true;
  /** Onglet de la première rangée, hors d'« avancé » : « général ». */
  primary?: true;
}

/** Choix d'une activité : seulement les onglets montrés ou cachés à l'écart de leur défaut. */
export type TabChoices = Readonly<Record<string, boolean>>;

export type SailingTab = 'general' | 'tops' | 'manoeuvres' | 'graphiques' | 'cardio' | 'vmg' | 'sauts' | 'vols' | 'pumping' | 'vent' | 'matos' | 'reglages';

/** Voile : une seule barre, dans l'ordre voulu par le produit. */
export const SAILING_TABS: AnalysisTab<SailingTab>[] = [
  { key: 'general', label: t('général'), primary: true },
  { key: 'tops', label: t('tops') },
  { key: 'manoeuvres', label: t('manœuvres') },
  { key: 'graphiques', label: t('graphiques') },
  // Seulement pour une session qui a de la FC (ceinture, montre).
  { key: 'cardio', label: t('cardio') },
  { key: 'vmg', label: t('vmg') },
  // Seulement pour une session aux sauts mesurés par les capteurs du téléphone.
  { key: 'sauts', label: t('sauts') },
  // Sur foil seulement : les vols vus par le GPS, puis le pumping, pour une session qui a ses capteurs,
  // les mêmes que les sauts ; deux onglets à part.
  { key: 'vols', label: t('vols') },
  { key: 'pumping', label: t('pumping') },
  { key: 'vent', label: t('vent') },
  { key: 'matos', label: t('matos et conditions') },
  { key: 'reglages', label: t('réglages') },
];

export type SurfTab = 'general' | 'vagues' | 'rame' | 'vols' | 'pumping' | 'tops' | 'graphiques' | 'cardio' | 'notes' | 'reglages';

/** Surf (surf, paddle, SUP foil, kayak, downwind) : « tops » est générique. */
export const SURF_TABS: AnalysisTab<SurfTab>[] = [
  { key: 'general', label: t('général'), primary: true },
  { key: 'vagues', label: t('vagues') },
  { key: 'rame', label: t('rame') },
  // Sur foil seulement ; « pumping » pour une session qui a ses capteurs, à part des vols.
  { key: 'vols', label: t('vols') },
  { key: 'pumping', label: t('pumping') },
  { key: 'tops', label: t('tops'), generic: true },
  { key: 'graphiques', label: t('graphiques') },
  { key: 'cardio', label: t('cardio') },
  { key: 'notes', label: t('matériel et notes') },
  { key: 'reglages', label: t('réglages') },
];

/** Onglets du module de chaque famille. */
const MODULE_TABS: Record<SportFamily, readonly AnalysisTab[]> = { voile: SAILING_TABS, surf: SURF_TABS };

/**
 * Onglets d'un calcul, ceux du module de sa famille, proposés dans Réglages : « sauts » seulement s'il les
 * mesure (ni bateau ni surf), « pumping » de même (voile sur foil, pas le bateau).
 */
export const analysisTabs = (profile: SportProfile): readonly AnalysisTab[] =>
  MODULE_TABS[profile.family].filter((tab) => (tab.key !== 'sauts' || profile.jumps !== null)
    && (tab.key !== 'pumping' || profile.pump !== null));

/**
 * Onglets d'une activité proposés dans Réglages › Onglets : ceux de son calcul
 * (`analysisTabs`), « vols » et « pumping » sur foil seulement, « sauts » si
 * l'activité mesure les sauts (case de Réglages). Cocher cette case
 * montre l'onglet (`tabsAfterJumpsChange`). Dans une analyse, « sauts » paraît
 * si la session a sa capture (`useShownJumps`, `visible`) et que le choix
 * d'onglets de l'activité le montre : ce choix prime, la case décochée depuis
 * ne le change pas (un pré-réglage qui cache l'onglet le cache donc même sur
 * une session à capture).
 */
export const activityTabs = (profile: SportProfile, options: { foil: boolean; jumps: boolean }): readonly AnalysisTab[] =>
  analysisTabs(profile).filter((tab) => ((tab.key !== 'vols' && tab.key !== 'pumping') || options.foil) && (tab.key !== 'sauts' || options.jumps));

/**
 * Onglets ouverts à la première visite d'un module : ceux de la première rangée
 * (`primary`), tous les autres fermés ; le résultat sert de défauts fixes à l'état des
 * onglets (`initialTabsState`).
 */
export const tabDefaults = <K extends string>(tabs: readonly AnalysisTab<K>[]): Record<K, boolean> => {
  const defaults = {} as Record<K, boolean>;
  for (const tab of tabs) defaults[tab.key] = tab.primary === true;
  return defaults;
};

/** Onglet montré : le choix de l'activité, sinon son défaut (natif montré, générique caché). */
export const isTabShown = (tab: AnalysisTab, choices: TabChoices | null | undefined): boolean => {
  const own = choices && Object.hasOwn(choices, tab.key) ? choices[tab.key] : undefined;
  return typeof own === 'boolean' ? own : tab.generic !== true;
};

/** Onglets montrés d'un module, dans l'ordre de sa barre. */
export const shownTabs = <K extends string>(tabs: readonly AnalysisTab<K>[], choices: TabChoices | null | undefined): AnalysisTab<K>[] =>
  tabs.filter((tab) => isTabShown(tab, choices));

/** Clé d'onglet admise dans un choix rangé. */
const MAX_TAB_KEY_LENGTH = 40;

/**
 * Choix rangés relus : un objet de booléens aux clés courtes, le reste ignoré ;
 * `null` s'il n'en reste rien. Une clé d'onglet inconnue est gardée sans être
 * jamais lue : le choix qu'elle porte n'est pas perdu si l'onglet existe de nouveau.
 */
export const sanitizeTabChoices = (value: unknown): TabChoices | null => {
  if (!isObject(value)) return null;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, boolean] => entry[0].length > 0 && entry[0].length <= MAX_TAB_KEY_LENGTH && typeof entry[1] === 'boolean'
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

/** Mêmes choix, clé par clé, dans n'importe quel ordre. */
const sameTabChoices = (a: TabChoices, b: TabChoices): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key]);
};

/**
 * Montre ou cache un onglet ; `null` quand il ne reste rien à ranger. Un choix
 * rangé remplace tout entier le pré-réglage de l'activité (`preset`), qui revient
 * dès qu'il n'y a plus de choix (`resolveTabChoices`) : un onglet du pré-réglage
 * s'écrit donc toujours en clair, un choix égal au pré-réglage s'efface, et un
 * choix vidé qui le ramènerait à tort écrit ses onglets à leur défaut du module
 * (un pré-réglage s'en écarte toujours, c'est sa raison d'être ; testé).
 */
export const toggleTabChoice = (choices: TabChoices | null, tab: AnalysisTab, preset: TabChoices | null): TabChoices | null => {
  const shown = !isTabShown(tab, choices);
  const next: Record<string, boolean> = { ...choices };
  if (shown === (tab.generic !== true) && !(preset && Object.hasOwn(preset, tab.key))) delete next[tab.key];
  else next[tab.key] = shown;
  if (preset && sameTabChoices(next, preset)) return null;
  if (Object.keys(next).length > 0) return next;
  if (!preset) return null;
  return Object.fromEntries(Object.entries(preset).map(([key, value]) => [key, !value]));
};

/**
 * Sections ouvertes, les onglets cachés fermés : un onglet caché
 * n'affiche pas son panneau, même laissé ouvert, et sa surbrillance s'efface.
 * Rend l'objet reçu tel quel quand rien n'est caché.
 */
export const maskHiddenTabs = <K extends string>(
  open: Record<K, boolean>,
  tabs: readonly AnalysisTab<K>[],
  choices: TabChoices | null | undefined
): Record<K, boolean> => {
  let masked: Record<K, boolean> | null = null;
  for (const tab of tabs) {
    if (open[tab.key] && !isTabShown(tab, choices)) {
      masked ??= { ...open };
      masked[tab.key] = false;
    }
  }
  return masked ?? open;
};

/**
 * Sections ouvertes, celles de la rangée « avancé » fermées tant qu'elle l'est :
 * refermer « avancé » replie ses onglets et leurs panneaux, gardés pour sa
 * réouverture. Rend l'objet reçu tel quel quand rien ne change.
 */
export const maskAdvancedTabs = <K extends string>(
  open: Record<K, boolean>,
  tabs: readonly AnalysisTab<K>[],
  advancedOpen: boolean
): Record<K, boolean> => {
  if (advancedOpen) return open;
  let masked: Record<K, boolean> | null = null;
  for (const tab of tabs) {
    if (open[tab.key] && tab.primary !== true) {
      masked ??= { ...open };
      masked[tab.key] = false;
    }
  }
  return masked ?? open;
};

/**
 * Ce qu'un onglet fait montrer sur la carte (surbrillance, case cumulable),
 * réduit à ses onglets ouverts : celles d'un onglet fermé partent, et rien ne
 * les ramène à sa réouverture. Rend la liste reçue telle quelle quand rien ne change.
 */
export const keepOpenTabEntries = <K extends string, E extends { panel: K }>(
  entries: readonly E[],
  open: Readonly<Record<K, boolean>>
): readonly E[] => (entries.every((entry) => open[entry.panel]) ? entries : entries.filter((entry) => open[entry.panel]));

/** « général » après un toucher sur « avancé » : l'ouvrir ferme « général », le refermer le rouvre. */
export const generalOpenAfterAdvanced = (advancedOpen: boolean): boolean => !advancedOpen;

/**
 * Onglets d'une analyse ouverte, en mémoire vive : toute ouverture
 * d'une analyse rend « général » seul ouvert, « avancé » fermé ; rien n'est
 * retenu d'une session à l'autre ni d'une visite à l'autre. `key` est la trace
 * dont l'état vient (`sessionKey`).
 */
export interface AnalysisTabsState<K extends string> {
  key: string | null;
  open: Record<K, boolean>;
  advanced: boolean;
}

/** État d'ouverture : les défauts du module (`tabDefaults`), « avancé » fermé. */
export const initialTabsState = <K extends string>(defaults: Record<K, boolean>, key: string | null): AnalysisTabsState<K> => ({
  key, open: { ...defaults }, advanced: false,
});

/**
 * État valable pour la trace `key` : celui reçu s'il en vient, sinon les défauts
 * (une autre session s'ouvre sur « général » seul). Une trace pas encore lue
 * (`null`) garde l'état reçu. Rend l'objet reçu tel quel quand rien ne change.
 */
export const tabsStateFor = <K extends string>(state: AnalysisTabsState<K>, defaults: Record<K, boolean>, key: string | null): AnalysisTabsState<K> =>
  key !== null && key !== state.key ? initialTabsState(defaults, key) : state;

/**
 * Onglet ouvert depuis ailleurs que la barre (« Oui » du rappel du matériel) : la rangée « avancé » s'ouvre s'il en
 * fait partie, ce qui ferme « général » comme le fait sa pastille, et l'onglet s'ouvre. `keepPrimary` (tuile de
 * « général ») laisse les onglets de la première rangée comme ils sont : l'onglet s'ouvre en plus. Rend l'état reçu
 * tel quel quand l'onglet est déjà ouvert sans rien à déplier.
 */
export const revealTab = <K extends string>(
  state: AnalysisTabsState<K>,
  tabs: readonly AnalysisTab<K>[],
  key: K,
  options: { keepPrimary?: boolean } = {}
): AnalysisTabsState<K> => {
  const inAdvanced = tabs.find((tab) => tab.key === key)?.primary !== true;
  if (state.open[key] && (!inAdvanced || state.advanced)) return state;
  const open: Record<K, boolean> = { ...state.open, [key]: true };
  if (inAdvanced && !state.advanced && options.keepPrimary !== true) {
    for (const tab of tabs) if (tab.primary === true) open[tab.key] = generalOpenAfterAdvanced(true);
  }
  return { ...state, advanced: inAdvanced ? true : state.advanced, open };
};

/**
 * L'onglet est-il ouvert à l'écran ? Ouvert dans l'état, et, s'il est rangé dans « avancé », la rangée dépliée
 * (refermée, elle replie ses onglets sans les oublier, `maskAdvancedTabs`).
 */
export const isTabOpenOnScreen = <K extends string>(state: AnalysisTabsState<K>, tabs: readonly AnalysisTab<K>[], key: K): boolean =>
  state.open[key] === true && (tabs.find((tab) => tab.key === key)?.primary === true || state.advanced);

/**
 * Tuile de « général » touchée : son onglet fermé s'ouvre en plus de « général » (`revealTab` avec `keepPrimary`) ;
 * ouvert à l'écran, il se referme, seul : « général » et « avancé » restent comme ils sont.
 */
export const toggleTabFromTile = <K extends string>(state: AnalysisTabsState<K>, tabs: readonly AnalysisTab<K>[], key: K): AnalysisTabsState<K> =>
  isTabOpenOnScreen(state, tabs, key)
    ? { ...state, open: { ...state.open, [key]: false } }
    : revealTab(state, tabs, key, { keepPrimary: true });

/**
 * Onglet que chaque tuile de « général » ouvre, par clé de chiffre (`ShareStat.key`) et par famille. Une tuile
 * absente n'en a pas (distances, temps, moyennes) : elle reste un simple bloc. Jamais « général » lui-même.
 */
const SAILING_TILE_TABS: Readonly<Record<string, SailingTab>> = {
  top2s: 'tops',
  tacks: 'manoeuvres',
  jibes: 'manoeuvres',
  jumps: 'sauts',
  highestJump: 'sauts',
  pumpCadence: 'pumping',
  pumpShare: 'pumping',
  heartRate: 'cardio',
};

const SURF_TILE_TABS: Readonly<Record<string, SurfTab>> = {
  waves: 'vagues',
  waveTime: 'vagues',
  longestWave: 'vagues',
  maxSpeed: 'vagues',
  flightTime: 'vols',
  longestFlight: 'vols',
  pumpCadence: 'pumping',
  pumpShare: 'pumping',
  heartRate: 'cardio',
};

export const TILE_TABS: Record<SportFamily, Readonly<Record<string, string>>> = { voile: SAILING_TILE_TABS, surf: SURF_TILE_TABS };

/**
 * Tuiles du bloc du vol quand la session est sur foil (« Distance en vol », « Temps total », « Temps en vol »,
 * « Ratio de vol », « Moyenne en vol ») : elles ouvrent l'onglet du détail des vols, même si leurs chiffres
 * viennent du seuil de vitesse. En surf, les tuiles de vol ont leur propre clé, déjà dans `SURF_TILE_TABS`.
 */
export const FLIGHT_TILE_TABS: Partial<Record<SportFamily, Readonly<Record<string, string>>>> = {
  voile: {
    activeDistance: 'vols', totalTime: 'vols', activeTime: 'vols', activeRatio: 'vols', activeAverage: 'vols',
  } satisfies Record<string, SailingTab>,
};

/**
 * Onglet qu'ouvre la tuile `statKey` de « général », pris parmi les onglets montrés pour la session (`shown`,
 * liste déjà filtrée par l'activité et les données) ; `null` si la tuile n'en a pas ou que son onglet n'est
 * pas montré. `inFlight` : session sur foil, ses tuiles actives sont celles du vol (`FLIGHT_TILE_TABS`).
 */
export const tileTab = <K extends string>(
  family: SportFamily,
  statKey: string,
  shown: readonly AnalysisTab<K>[],
  options: { inFlight?: boolean } = {}
): AnalysisTab<K> | null => {
  const flight = options.inFlight === true ? FLIGHT_TILE_TABS[family] : undefined;
  const own = TILE_TABS[family];
  const target = flight && Object.hasOwn(flight, statKey) ? flight[statKey] : Object.hasOwn(own, statKey) ? own[statKey] : null;
  if (target === null) return null;
  return shown.find((tab) => tab.key === target && tab.primary !== true) ?? null;
};

/** Ancre HTML du panneau d'un onglet (`ResizablePanel`, `anchorId`), où défile la page quand une tuile l'ouvre. */
export const tabAnchorId = (key: string): string => `an-onglet-${key}`;

/** Hauteur du haut d'un panneau qui doit paraître pour le dire à l'écran : son titre et une ligne. */
export const PANEL_HEAD_VISIBLE_PX = 80;

/**
 * La page doit-elle défiler jusqu'au panneau ouvert ? Non si son haut est déjà à l'écran, sous ce qui colle en
 * haut (`topInset` : barre du haut, bandeaux, barre « Non enregistré ») et au moins `PANEL_HEAD_VISIBLE_PX` au-dessus
 * de ce qui colle en bas (`bottomInset` : barre d'onglets du téléphone, 0 sur ordinateur) ; oui s'il est caché
 * dessous ou passé au-dessus.
 */
export const panelNeedsScroll = (top: number, topInset: number, viewportH: number, bottomInset = 0): boolean =>
  top < topInset || top > viewportH - bottomInset - PANEL_HEAD_VISIBLE_PX;

/** Nombre d'onglets ouverts, parmi les clés montrées, à partir duquel la barre propose « tout fermer » plutôt que « tout ouvrir ». */
export const CLOSE_ALL_MIN_OPEN = 2;

/** Bouton de la barre : « tout fermer » à partir de deux onglets ouverts parmi ceux montrés, « tout ouvrir » sinon. */
export const tabsBulkAction = <K extends string>(open: Record<K, boolean>, shownKeys: readonly K[]): 'openAll' | 'closeAll' =>
  shownKeys.filter((key) => open[key]).length >= CLOSE_ALL_MIN_OPEN ? 'closeAll' : 'openAll';

/**
 * « tout ouvrir » : chaque onglet montré s'ouvre, « général » compris, et la rangée « avancé » se déplie si
 * un onglet montré en fait partie. Les onglets absents de `shownKeys` gardent leur état. Rend l'état reçu
 * tel quel quand rien ne change.
 */
export const openAllTabs = <K extends string>(
  state: AnalysisTabsState<K>,
  tabs: readonly AnalysisTab<K>[],
  shownKeys: readonly K[]
): AnalysisTabsState<K> => {
  const open = { ...state.open };
  for (const key of shownKeys) open[key] = true;
  const hasAdvanced = tabs.some((tab) => tab.primary !== true && shownKeys.includes(tab.key));
  return { ...state, advanced: state.advanced || hasAdvanced, open };
};

/** « tout fermer » : chaque onglet fermé, « général » compris ; « avancé » ne change pas. */
export const closeAllTabs = <K extends string>(open: Record<K, boolean>): Record<K, boolean> =>
  Object.fromEntries(Object.keys(open).map((key) => [key, false])) as Record<K, boolean>;
