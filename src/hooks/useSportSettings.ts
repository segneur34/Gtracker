import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  activitiesOfFamily, activityFamily, findActivity, isActivityShown, newActivityId, insertActivity,
  readActivities, visibleActivities, visibleFamilies, withHidden, type Activity,
} from '../core/activities';
import type { ActivityIconId } from '../core/activityIcons';
import { defaultActiveThresholdOf, getSportProfile, type RecordingProfile, type SportFamily } from '../core/sportProfiles';
import type { TabChoices } from '../core/analysisTabs';
import type { SportType } from '../core/types';
import type { DistanceUnit, SpeedUnit } from '../core/units';
import { jsonStore } from '../platform/storage';
import { createJsonSelector, sameJson } from './createStore';
import { setBeepPitch } from '../platform/beeper';
import { DEFAULT_BEEP_SOUND, beepSoundHz, isBeepSound, type BeepSound } from '../recording/beepSound';
import type { LiveFieldKey } from '../recording/liveFields';
import type { MarkGuideSettings } from '../recording/markGuide';
import type { JumpSettings } from '../recording/jumpSettings';
import type { GearGroup, GearItem } from '../library/notes';
import type { ActivitySpeedRanges } from '../library/sessionTrack';
import type { WayType } from '../planning/brouterProfile';
import { DEFAULT_GRADE_RANGE, type GradeRange } from '../planning/grade';
import { resolveGearGroups, resolveGearLabels, sanitizeGearGroups, withGearItem } from '../settings/gear';
import {
  DEFAULT_LONG_PRESS_MS, DEFAULT_STOP_HOLD_MS, defaultSpeedRangeOf, hiddenFamiliesOf, isValidLongPress, isValidStopHold,
  moduleActivity, resetOverrides,
  resolveDistanceUnit, resolveFoil, resolveHeartRate, resolveHrOffset, resolveJumps, resolveLiveFields,
  resolveMarkGuide, resolveNotificationFields, resolvePumping, resolveRecordingProfile, resolveTurns, resolveSpeedRange, resolveSpeedUnit,
  resolveTabChoices, resolveThresholdOverride, settingsView, withSetting, withVisibility, withoutOverrides,
  type SettingField, type SportSettingsView, type StoredSettings,
} from '../settings/activitySettings';
import { STORAGE_KEYS } from '../core/appIdentity';

/**
 * Magasin des réglages par activité (`gtracker.sportSettings`) : sa lecture
 * (`useSyncExternalStore`), ses écritures, relues au moment d'écrire, et les
 * hooks qui les suivent. Le calcul pur d'un réglage (défauts, valeurs
 * effectives, vue de Réglages) est dans `settings/activitySettings.ts` (lot 72).
 *
 * Le seuil est volontairement modifiable : 8 nœuds ne vaut qu'en wingfoil, et
 * le réglage fin dépend du matériel et du pratiquant.
 */

const STORAGE_KEY = STORAGE_KEYS.sportSettings;

/** Seuil fixé pour une activité, hors composant (résumés de la bibliothèque) ; `undefined` sans réglage ni pré-réglage. */
export const effectiveThresholdOverride = (activity: Activity): number | undefined =>
  resolveThresholdOverride(readStoredSettings(), activity) ?? undefined;

/** Bornes de couleur d'une activité, hors composant (vignettes, partage) : réglées ou pré-réglées, et par défaut. */
export const activitySpeedRanges = (activity: Activity): ActivitySpeedRanges => ({
  fixed: resolveSpeedRange(readStoredSettings(), activity),
  fallback: defaultSpeedRangeOf(activity),
});

/** Matériel enregistré de toutes les activités, la même table tant que son texte ne change pas. */
const gearGroupsMap = createJsonSelector<StoredSettings['gearGroups']>(STORAGE_KEY, () => readStoredSettings().gearGroups);

/**
 * Matériel enregistré d'une activité, suivi en direct (Statistiques) ; `null`
 * sans activité, option coupée ou sans groupe. Le magasin rend la même table
 * tant que les réglages ne changent pas : la valeur ne bouge pas d'un rendu à l'autre.
 */
export const useGearGroups = (activity: Activity | null): GearGroup[] | null => {
  const map = useSyncExternalStore(gearGroupsMap.subscribe, gearGroupsMap.get);
  const id = activity?.id ?? null;
  return useMemo(() => (id === null ? null : resolveGearGroups({ gearGroups: map }, id)), [map, id]);
};

/**
 * Ajoute une pièce au matériel enregistré d'une activité, tout de suite, hors
 * du brouillon de la session (« Ajouter à la liste » de l'analyse) ; le module
 * suit par `jsonStore.subscribe`. Rend la pièce, `null` si rien n'est ajouté.
 */
export const addGearItem = (activityId: string, groupId: string, name: string): GearItem | null => {
  const stored = readStoredSettings();
  const next = withGearItem(sanitizeGearGroups(stored.gearGroups?.[activityId]) ?? [], groupId, name);
  if (!next) return null;
  writeStored({ ...stored, gearGroups: { ...stored.gearGroups, [activityId]: next.groups } });
  return next.item;
};

/** Décalage des seuils cardio d'une activité, hors composant (direct, test guidé). */
export const effectiveHrOffset = (activity: Activity): number => resolveHrOffset(readStoredSettings(), activity);

/** Réglages enregistrés, pour qui calcule hors d'un composant : les résumés de la bibliothèque. */
export const readStoredSettings = (): StoredSettings => {
  const raw = jsonStore.read<StoredSettings>(STORAGE_KEY);
  // Même objet tant que la valeur enregistrée ne change pas : c'est l'instantané de `useSyncExternalStore`.
  // Rien de rangé (premier lancement) : le même objet vide à chaque appel, sinon le rendu boucle.
  if (storedCache && storedCache.raw === raw) return storedCache.value;
  const value = raw ?? NO_SETTINGS;
  storedCache = { raw, value };
  return value;
};

const NO_SETTINGS: StoredSettings = {};

let storedCache: { raw: unknown; value: StoredSettings } | null = null;

/** Abonnement aux seules écritures des réglages : les autres clés du stockage ne réveillent personne. */
export const subscribeStoredSettings = (listener: () => void): (() => void) => jsonStore.subscribeKey(STORAGE_KEY, listener);

let activitiesCache: { raw: unknown; text: string; value: Activity[] } | null = null;

/**
 * Activités des réglages, même tableau tant que leur texte ne change pas :
 * une écriture d'un autre réglage ne refait ni la liste ni ce qui en dépend.
 */
const storedActivities = (stored: StoredSettings): Activity[] => {
  const raw = stored.activities;
  if (activitiesCache && activitiesCache.raw === raw) return activitiesCache.value;
  const text = JSON.stringify(raw ?? null);
  if (activitiesCache && activitiesCache.text === text) {
    activitiesCache = { ...activitiesCache, raw };
    return activitiesCache.value;
  }
  activitiesCache = { raw, text, value: readActivities(raw) };
  return activitiesCache.value;
};

const writeStored = (settings: StoredSettings): void => jsonStore.write(STORAGE_KEY, settings);

/**
 * Réécrit les réglages à partir de ceux du moment, relus à l'instant et non
 * figés au dernier rendu : deux écritures d'un même geste se cumulent, et une
 * écriture d'ailleurs n'est pas défaite. `change` rend `null` (ou rien) s'il
 * n'y a rien à écrire.
 */
export const updateStoredSettings = (change: (stored: StoredSettings) => StoredSettings | null | undefined): void => {
  const next = change(readStoredSettings());
  if (next) writeStored(next);
};

export const readStoredActivities = (): Activity[] => readActivities(readStoredSettings().activities);

/** Dernière activité enregistrée, si elle existe encore. */
export const lastRecordActivity = (): Activity | null => {
  const stored = readStoredSettings();
  return readActivities(stored.activities).find((a) => a.id === stored.recordActivity) ?? null;
};

export const rememberRecordActivity = (id: string): void => {
  const stored = readStoredSettings();
  if (stored.recordActivity !== id) writeStored({ ...stored, recordActivity: id });
};

let appliedBeepHz: number | null = null;

/** Donne aux bips la hauteur du son choisi, s'il a changé depuis la dernière fois. */
const applyBeepSound = (): void => {
  const hz = beepSoundHz(readStoredSettings().beepSound);
  if (hz === appliedBeepHz) return;
  appliedBeepHz = hz;
  setBeepPitch(hz).catch(() => {
    appliedBeepHz = null;
  });
};

/**
 * Son des bips, branché une fois au démarrage : appliqué tout de suite, puis
 * à chaque changement des réglages (Réglages, réglages repris d'un autre appareil).
 */
export const startBeepSound = (): void => {
  applyBeepSound();
  jsonStore.subscribe((key) => {
    if (key === STORAGE_KEY) applyBeepSound();
  });
};

/** Durée effective de l'appui long, lue à chaque appui. */
export const effectiveLongPressMs = (): number => {
  const value = readStoredSettings().longPressMs;
  return isValidLongPress(value) ? value : DEFAULT_LONG_PRESS_MS;
};

/** Durée effective de l'appui long qui arrête l'enregistrement, lue à chaque appui ; 0 : un simple appui. */
export const effectiveStopHoldMs = (): number => {
  const value = readStoredSettings().stopHoldMs;
  return isValidStopHold(value) ? value : DEFAULT_STOP_HOLD_MS;
};

/** Ce qui est visible (§10, point 100) : la liste complète, les familles cachées, et de quoi filtrer. */
interface Visibility {
  /** Toutes les activités, cachées comprises : elles nomment les sessions (`sessionActivity`). */
  activities: Activity[];
  /** Familles cachées dans Réglages (`hiddenFamiliesOf`). */
  hiddenFamilies: SportFamily[];
  /** Familles visibles, dans l'ordre de `SPORT_FAMILIES`. */
  families: SportFamily[];
  /** Activité visible : ni cachée, ni dans une famille cachée ; une activité de base suit sa famille. */
  isShown: (activity: Activity) => boolean;
  /** Activités visibles, d'une famille ou de toutes. */
  shownActivities: (family?: SportFamily) => Activity[];
}

/**
 * Ce qui est visible, la même valeur tant que le texte des activités et des
 * familles cachées ne change pas : une écriture d'un autre réglage ne refait rien.
 */
const visibility = createJsonSelector<Visibility>(
  STORAGE_KEY,
  () => {
    const stored = readStoredSettings();
    const activities = readActivities(stored.activities);
    const hiddenFamilies = hiddenFamiliesOf(stored);
    return {
      activities,
      hiddenFamilies,
      families: visibleFamilies(activities, hiddenFamilies),
      isShown: (a) => isActivityShown(a, activities, hiddenFamilies),
      shownActivities: (family) => visibleActivities(activities, hiddenFamilies, family),
    };
  },
  (a, b) => sameJson([a.activities, a.hiddenFamilies], [b.activities, b.hiddenFamilies])
);

/** Ce qui est visible, suivi en direct : la barre change dès que Réglages cache ou ré-affiche. */
export const useVisibility = (): Visibility => useSyncExternalStore(visibility.subscribe, visibility.get);

/** Réglage d'enregistrement effectif d'une activité (`resolveRecordingProfile`). Utilisable hors composant. */
export const effectiveRecordingProfile = (activity: Activity): RecordingProfile => resolveRecordingProfile(readStoredSettings(), activity);

/** Chiffres en grand de l'enregistrement, carte réduite : ceux choisis dans Réglages, sinon ceux du calcul. */
export const effectiveLiveFields = (activity: Activity): LiveFieldKey[] => resolveLiveFields(readStoredSettings(), activity);

/** Chiffres de la notification de l'enregistrement : ceux choisis dans Réglages, sinon ceux du calcul. */
export const effectiveNotificationFields = (activity: Activity): LiveFieldKey[] => resolveNotificationFields(readStoredSettings(), activity);

/** Bips d'approche des balises d'un parcours : ceux réglés pour l'activité, sinon le défaut. */
export const effectiveMarkGuide = (activity: Activity): MarkGuideSettings => resolveMarkGuide(readStoredSettings(), activity);

/** Support sur foil d'une activité de voile ou de surf, `null` ailleurs. Utilisable hors composant. */
export const effectiveFoil = (activity: Activity): boolean | null => resolveFoil(readStoredSettings(), activity);

/** Pumping foil d'une activité de surf ou de voile (bateau excepté), `null` ailleurs. Utilisable hors composant. */
export const effectivePumping = (activity: Activity): boolean | null => resolvePumping(readStoredSettings(), activity);

/** Virages du surf mesurés par le gyroscope, `null` hors surf. Utilisable hors composant. */
export const effectiveTurns = (activity: Activity): boolean | null => resolveTurns(readStoredSettings(), activity);

/** Ceinture cardio d'une activité. Utilisable hors composant. */
export const effectiveHeartRate = (activity: Activity): boolean => resolveHeartRate(readStoredSettings(), activity);

/** Réglages des sauts d'une activité, `null` si son calcul ne les mesure pas. Utilisable hors composant. */
export const effectiveJumpSettings = (activity: Activity): JumpSettings | null => resolveJumps(readStoredSettings(), activity);

/** Onglets choisis pour les analyses d'une activité, `null` sans choix. Utilisable hors composant. */
export const effectiveTabChoices = (activity: Activity): TabChoices | null => resolveTabChoices(readStoredSettings(), activity);

/** Unité de vitesse effective d'une activité : celle choisie dans Réglages, sinon celle du profil. Utilisable hors composant. */
export const effectiveSpeedUnit = (activity: Activity): SpeedUnit => resolveSpeedUnit(readStoredSettings(), activity);

/** Unité de distance effective d'une activité : celle choisie dans Réglages, sinon le kilomètre. */
export const effectiveDistanceUnit = (activity: Activity): DistanceUnit => resolveDistanceUnit(readStoredSettings(), activity);

// Planification, valeurs neutres jusqu'au lot 304 (planificateur routier) : la voile et le surf ne règlent ni
// boucle, ni pente, ni voies ; les fonctions restent pour la planification qui les lit.

/** Retour de boucle d'une activité en planification : aucun en voile et en surf (lot 304). */
export const effectiveLoopReturnRatio = (_activity: Activity): number | null => null;

/** Bornes de la couleur de pente d'une activité : celles par défaut, sans réglage en voile et en surf (lot 304). */
export const effectiveGradeRange = (_activity: Activity): GradeRange => DEFAULT_GRADE_RANGE;

/** Types de voie cochés d'office en planification : aucun en voile et en surf (lot 304). */
export const effectiveWayTypes = (_activity: Activity): WayType[] => [];

/**
 * Accès à toutes les activités à la fois, pour la page Réglages : leurs
 * réglages, et la liste elle-même (ajouter, renommer, supprimer). Chaque
 * modification est écrite immédiatement ; les modules la lisent à leur
 * prochain affichage.
 */
export const useAllSportSettings = () => {
  // Lus par `useSyncExternalStore` : une écriture d'ailleurs (réglages repris du dossier), même faite
  // entre le rendu et l'abonnement, est vue.
  const stored = useSyncExternalStore(subscribeStoredSettings, readStoredSettings);
  const activities = storedActivities(stored);

  const view = useCallback((activity: Activity): SportSettingsView => settingsView(stored, activity), [stored]);

  /** Écrit ou efface (`null`) un réglage d'une activité ; une valeur refusée par `SETTING_FIELDS` n'écrit rien. */
  const setFor = useCallback(
    <F extends SettingField>(id: string, field: F, value: SportSettingsView[F] | null) =>
      updateStoredSettings((stored) => withSetting(stored, id, field, value)),
    []
  );

  /** Remet tous les réglages d'une activité au défaut de son calcul ; le matériel enregistré reste. */
  const resetActivity = useCallback((id: string) => updateStoredSettings((stored) => resetOverrides(stored, id)), []);

  /** Ajoute une activité, rangée avec sa famille ; rend son identifiant, `null` si le nom est vide. */
  const addActivity = useCallback(
    (name: string, base: SportType, color: string, icon?: ActivityIconId): string | null => {
      const trimmed = name.trim();
      if (trimmed === '') return null;
      let id = '';
      updateStoredSettings((stored) => {
        const activities = storedActivities(stored);
        id = newActivityId(trimmed, activities);
        const activity: Activity = { id, name: trimmed, base, color, ...(icon ? { icon } : {}) };
        return { ...stored, activities: insertActivity(activities, activity) };
      });
      return id;
    },
    []
  );

  /** Renomme, recolore ou change l'icône d'une activité ; un nom vide est ignoré. */
  const updateActivity = useCallback(
    (id: string, patch: { name?: string; color?: string; icon?: ActivityIconId }) => {
      const name = patch.name?.trim();
      updateStoredSettings((stored) => ({
        ...stored,
        activities: storedActivities(stored).map((a) =>
          a.id === id
            ? { ...a, ...(name ? { name } : {}), ...(patch.color ? { color: patch.color } : {}), ...(patch.icon ? { icon: patch.icon } : {}) }
            : a
        ),
      }));
    },
    []
  );

  /**
   * Supprime une activité et ses réglages. Ses sessions restent, sous le nom
   * de leur calcul (`sessionActivity`).
   */
  const removeActivity = useCallback(
    (id: string) =>
      updateStoredSettings((stored) => ({
        ...withoutOverrides(stored, id),
        activities: storedActivities(stored).filter((a) => a.id !== id),
      })),
    []
  );

  /**
   * Cache ou ré-affiche une activité (§10, point 100) ; rien n'est effacé.
   * Ré-afficher une activité d'une famille cachée ré-affiche la famille.
   * Cacher la dernière activité visible de la dernière famille visible est refusé.
   */
  const setActivityHidden = useCallback(
    (id: string, hidden: boolean) =>
      updateStoredSettings((stored) => {
        const activities = storedActivities(stored);
        const hiddenFamilies = hiddenFamiliesOf(stored);
        const target = activities.find((a) => a.id === id);
        if (!target) return null;
        const nextActivities = activities.map((a) => (a.id === id ? withHidden(a, hidden) : a));
        const family = activityFamily(target);
        return withVisibility(stored, nextActivities, hidden ? hiddenFamilies : hiddenFamilies.filter((f) => f !== family));
      }),
    []
  );

  /**
   * Cache ou ré-affiche une famille. Ré-afficher une famille dont toutes les
   * activités sont cachées les ré-affiche toutes ; sinon chacune garde son
   * choix. Cacher la dernière famille visible est refusé.
   */
  const setFamilyHidden = useCallback(
    (family: SportFamily, hidden: boolean) =>
      updateStoredSettings((stored) => {
        const activities = storedActivities(stored);
        const hiddenFamilies = hiddenFamiliesOf(stored);
        if (hidden) return withVisibility(stored, activities, hiddenFamilies.includes(family) ? hiddenFamilies : [...hiddenFamilies, family]);
        const own = activitiesOfFamily(activities, family);
        const allHidden = own.length > 0 && own.every((a) => a.hidden);
        const nextActivities = allHidden ? activities.map((a) => (activityFamily(a) === family ? withHidden(a, false) : a)) : activities;
        return withVisibility(stored, nextActivities, hiddenFamilies.filter((f) => f !== family));
      }),
    []
  );

  const longPressMs = isValidLongPress(stored.longPressMs) ? stored.longPressMs : DEFAULT_LONG_PRESS_MS;
  /** Durée de l'appui long, en millisecondes ; `null` revient au défaut. */
  const setLongPressMs = useCallback(
    (value: number | null) => {
      if (value !== null && !isValidLongPress(value)) return;
      updateStoredSettings((stored) => {
        const next: StoredSettings = { ...stored };
        if (value === null) delete next.longPressMs;
        else next.longPressMs = value;
        return next;
      });
    },
    []
  );

  const stopHoldMs = isValidStopHold(stored.stopHoldMs) ? stored.stopHoldMs : DEFAULT_STOP_HOLD_MS;
  /** Durée de l'appui long qui arrête l'enregistrement, en millisecondes (0 : simple appui) ; `null` revient au défaut. */
  const setStopHoldMs = useCallback(
    (value: number | null) => {
      if (value !== null && !isValidStopHold(value)) return;
      updateStoredSettings((stored) => {
        const next: StoredSettings = { ...stored };
        if (value === null) delete next.stopHoldMs;
        else next.stopHoldMs = value;
        return next;
      });
    },
    []
  );

  const beepSound = isBeepSound(stored.beepSound) ? stored.beepSound : DEFAULT_BEEP_SOUND;
  /**
   * Son de tous les bips ; le choix est toujours écrit (26/10), pour qu'un
   * changement du défaut ne touche pas un son choisi.
   */
  const setBeepSound = useCallback(
    (value: BeepSound) => {
      updateStoredSettings((stored) => ({ ...stored, beepSound: value }));
    },
    []
  );

  return {
    activities, view, setFor, resetActivity, addActivity, updateActivity, removeActivity, longPressMs, setLongPressMs,
    stopHoldMs, setStopHoldMs, beepSound, setBeepSound, hiddenFamilies: hiddenFamiliesOf(stored), setActivityHidden, setFamilyHidden,
  };
};



/**
 * `value` lui-même, ou celui d'un rendu précédent de même texte : une valeur
 * relue du stockage à chaque écriture ne refait pas ce qui en dépend
 * (coloration de la trace) tant qu'elle ne change pas.
 */
const useStableByText = <T,>(value: T): T => {
  const text = JSON.stringify(value);
  const [kept, setKept] = useState({ text, value });
  if (kept.text === text) return kept.value;
  setKept({ text, value });
  return value;
};

/**
 * Réglages d'un module d'analyse : son activité courante, le profil de son
 * calcul et les réglages rangés sous elle. Un module ne reprend que les
 * activités de sa famille : le surf n'hérite pas du seuil de vol du
 * wingfoil (règle 9).
 */
export const useSportSettings = (family: SportFamily) => {
  // Lus par `useSyncExternalStore`, abonnés aux seuls réglages : une écriture d'ailleurs (Réglages,
  // réglages repris du dossier), même faite entre le rendu et l'abonnement, est vue (E-B6, A4).
  const stored = useSyncExternalStore(subscribeStoredSettings, readStoredSettings);
  const activities = storedActivities(stored);
  // Refaite seulement si l'activité retenue ou la liste change, pas à chaque écriture d'un autre réglage.
  const remembered = stored.moduleActivity?.[family];
  const activity = useMemo(
    () => moduleActivity({ moduleActivity: { [family]: remembered } }, activities, family),
    [remembered, activities, family]
  );
  const sport = activity.base;
  const profile = useMemo(() => getSportProfile(sport), [sport]);
  const id = activity.id;

  /** Change l'activité du module ; un identifiant d'une autre famille est ignoré. */
  const setActivity = useCallback(
    (nextId: string) => {
      // Relus à l'instant : une écriture d'ailleurs, faite depuis le dernier rendu, est gardée.
      updateStoredSettings((current) => {
        const next = findActivity(storedActivities(current), nextId);
        if (!next || activityFamily(next) !== family) return null;
        return { ...current, moduleActivity: { ...current.moduleActivity, [family]: next.id } };
      });
    },
    [family]
  );

  /** Support sur foil de l'activité, réglé dans Réglages ; une session peut avoir le sien. */
  const foil = resolveFoil(stored, activity) ?? false;
  /** Pumping foil de l'activité, réglé dans Réglages ; une session peut avoir le sien. */
  const pumping = resolvePumping(stored, activity) ?? false;

  /**
   * Seuil réglé ou pré-réglé pour l'activité (0 : aucun seuil réglé, arrêts complets ôtés d'office),
   * `null` sans l'un ni l'autre : en voile, la suggestion selon l'allure ; en surf, le défaut dépend du
   * foil de la session.
   */
  const thresholdOverride = resolveThresholdOverride(stored, activity);
  const activeThreshold = thresholdOverride ?? defaultActiveThresholdOf(profile, foil);
  const isThresholdOverridden = thresholdOverride !== null;

  // Lecture seule : les unités se choisissent dans Réglages, par activité.
  const speedUnit = resolveSpeedUnit(stored, activity);
  const distanceUnit = resolveDistanceUnit(stored, activity);

  // Lecture seule ici : les bornes de l'activité se règlent dans Réglages, celles
  // d'une trace dans sa fiche (brouillon du module).
  const speedRange = useStableByText(resolveSpeedRange(stored, activity));
  const gearLabels = useStableByText(resolveGearLabels(stored, id));
  const gearGroups = useStableByText(resolveGearGroups(stored, id));
  // Cardio : décalage des seuils S1 et S2, réglé dans Réglages.
  const hrOffsetBpm = resolveHrOffset(stored, activity);

  return {
    activity,
    setActivity,
    sport,
    profile,
    activeThreshold,
    thresholdOverride,
    isThresholdOverridden,
    speedUnit,
    distanceUnit,
    /** Bornes du dégradé réglées pour l'activité dans Réglages ou pré-réglées, ou `null` pour le défaut du module. */
    speedRange,
    /** Bornes du dégradé à défaut de réglage, propres au traitement du calcul. */
    defaultSpeedRange: defaultSpeedRangeOf(activity),
    /** Intitulés des deux champs de matériel des notes (hors voile), réglés dans Réglages ou par défaut. */
    gearLabels,
    /** Matériel enregistré de l'activité, choisi par groupe dans l'onglet du matériel ; `null` : option coupée ou aucun groupe. */
    gearGroups,
    /** Décalage des seuils cardio de l'activité, en bpm. */
    hrOffsetBpm,
    foil,
    pumping,
  };
};
