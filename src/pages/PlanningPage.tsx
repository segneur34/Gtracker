import { roundBearingDeg } from '../core/angles';
import { pushBackLayer } from '../platform/backButton';
import { plainError } from '../platform/errorText';
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import L from 'leaflet';
import MapContainer from '../components/map/MapContainer';
import Marker from '../components/map/Marker';
import { CircleMarker, Polyline } from '../components/map/paths';
import { useMapEvents } from '../components/map/mapContext';
import { Link, useSearchParams } from 'react-router-dom';
import './PlanningPage.css';
import ActivitySelect from '../components/ActivitySelect';
import BeepCurveEditor from '../components/BeepCurveEditor';
import MapAutoResize from '../components/MapAutoResize';
import { divIconCache, haloStyle } from '../components/mapStyles';
import BaseTileLayer from '../components/BaseTileLayer';
import { HelpText } from '../components/Help';
import { useHelp } from '../components/helpContext';
import PanelTitle from '../components/PanelTitle';
import ResizablePanel from '../components/ResizablePanel';
import RouteList from '../components/RouteList';
import RouteImageShare from '../components/RouteImageShare';
import SectionTabs, { type SectionDefinition } from '../components/SectionTabs';
import {
  IconChevronDown, IconChevronUp, IconClose, IconDownload, IconPencil, IconPencilOff, IconShare, IconTrash, IconUndo,
} from '../components/icons';
import { shareRouteGpx } from '../components/routeShare';
import { CARD_STYLE } from '../components/styles';
import Button from '../components/ui/Button';
import HoldButton from '../components/ui/HoldButton';
import MoreMenu from '../components/ui/MoreMenu';
import PageHeader from '../components/ui/PageHeader';
import { activityDisplayName, activityFamily, findActivity, type Activity } from '../core/activities';
import { DEFAULT_MAP_CENTER, trackBounds } from '../core/displayConfig';
import { formatDistance, toDisplayDistance } from '../core/units';
import { useLeaveWarning } from '../hooks/leaveGuard';
import { useGoOnRoute } from '../hooks/useGoOnRoute';
import { useMapBase } from '../hooks/useMapBase';
import { useOpenSections } from '../hooks/useOpenSections';
import { usePlannedRoute } from '../hooks/usePlannedRoute';
import { getLastFix, useRecorderStatus } from '../hooks/useRecorder';
import { useRouteLibrary, type SavedRoute } from '../hooks/useRouteLibrary';
import {
  effectiveDistanceUnit, effectiveMarkGuide, effectiveSpeedUnit, lastRecordActivity, useVisibility,
} from '../hooks/useSportSettings';
import { ROUTES_DIR } from '../library/folderLayout';
import { shownRoutes } from '../planning/routeShown';
import { isAbortError } from '../planning/fetchJson';
import { searchPlaces, type Place } from '../planning/geocoding';
import {
  EMPTY_ROUTE, courseLegs, isLooped, routePoints, routeTotals,
  type PlannedRoute, type RoutePoint, type Waypoint,
} from '../planning/route';
import { END_COLOR, ROUTE_COLOR, START_COLOR } from '../planning/routeColors';
import { buildRouteGpx, markLabel } from '../planning/routeGpx';
import { recordToRoute, routeMarkGuide } from '../planning/routeRecord';
import { beepStartM, simulatedApproachMs, validationRadiusM, type MarkGuideSettings } from '../recording/markGuide';
import { canDownloadFiles, downloadTextFile, safeFileName } from '../platform/files';
import { currentPosition, locationPermissionGranted } from '../platform/location';
import { jsonStore } from '../platform/storage';
import { STORAGE_KEYS } from '../core/appIdentity';
import { ROUTES_LIST_PATH } from '../core/parentPage';
import { dateLocale, t, tn } from '../core/i18n';
import { tRich } from '../components/tRich';

/**
 * Planification d'un parcours : des balises numérotées, posées sur la carte et
 * reliées en ligne droite, que l'enregistrement fait valider une à une, avec
 * des bips d'approche (`recording/markGuide.ts`) : ceux de l'activité
 * (Réglages), ou ceux propres au parcours, rangés dans sa fiche. Un GPX
 * téléchargé ailleurs entre par « Importer un itinéraire » de la liste, puis
 * s'ouvre ici. L'activité se choisit au-dessus de la carte ; dessous, des onglets ouvrent les blocs
 * (tracé et balises, enregistrer, mes itinéraires, balises sonores), comme dans les
 * analyses. Le parcours s'enregistre dans `itineraires/` du dossier mémoire,
 * avec son GPX.
 *
 * Rien ne se calcule : seule la recherche de lieu demande du réseau. On y
 * arrive depuis « Planifier » de la liste des itinéraires (que la pastille « Planification » de Sessions et, sur
 * ordinateur, « Planifier » de la barre du haut ouvrent), où ramènent le retour et le lien « ← » ;
 * `?itineraire=<base>` ouvre un itinéraire rangé (liste des itinéraires).
 *
 * Le crayon, sur la carte, verrouille l'itinéraire : verrouillé, la carte ne fait
 * que se déplacer et se zoomer (ni point posé, ni point déplacé ou touché, ni
 * tronçon touché) ; le reste de la page, listes de points, « Précédent », boucle,
 * recherche, reste actif. Un nouvel itinéraire part modifiable, un itinéraire
 * rangé qu'on ouvre part verrouillé ; cet état n'est ni rangé ni une modification.
 */

/**
 * Préférences de la page sur l'appareil : dernière activité choisie, dernière
 * vue de la carte. Un ancien `mode` ou `loop` (planificateur routier, retiré) y reste, ignoré.
 */
const PREFS_KEY = STORAGE_KEYS.planning;

/** Champ du nom de l'itinéraire, que son intitulé désigne : le menu « … » est posé à côté, hors de l'intitulé. */
const NAME_FIELD_ID = 'plan-nom';

/** Durée de l'appui sur « Supprimer » du menu de l'itinéraire : une seconde, comme « Jeter » d'une session. */
const ROUTE_DELETE_HOLD_MS = 1000;
const routeDeleteHoldMs = (): number => ROUTE_DELETE_HOLD_MS;

interface PlanningPrefs {
  activityId?: string;
  view?: { lat: number; lon: number; zoom: number };
}

/** Centrage sur soi à l'ouverture : délai accordé au GPS, et zoom minimal une fois centré. */
const AUTO_LOCATE_TIMEOUT_MS = 15_000;
const AUTO_LOCATE_MIN_ZOOM = 14;

const readPrefs = (): PlanningPrefs => jsonStore.read<PlanningPrefs>(PREFS_KEY) ?? {};
const writePrefs = (patch: PlanningPrefs): void => jsonStore.write(PREFS_KEY, { ...readPrefs(), ...patch });

/** Épaisseur du tracé. */
const ROUTE_WEIGHT = 5;
/** Liseré blanc sous le tracé, sur le fond satellite, le même que celui des analyses. */
const HALO_STYLE = haloStyle(ROUTE_WEIGHT);
/** Style du tracé, constant : Leaflet ne refait `setStyle` que si l'objet change. */
const LEG_STYLE: L.PathOptions = { color: ROUTE_COLOR, weight: ROUTE_WEIGHT, opacity: 0.9, interactive: false };
/** Trait invisible et large : le toucher qui insère un point n'a pas à viser un trait de 5 px. */
const HIT_STYLE: L.PathOptions = { color: ROUTE_COLOR, weight: 24, opacity: 0, bubblingMouseEvents: false };
/** Rond du lieu trouvé ou de « Ma position », en attente d'être ajouté. */
const CANDIDATE_STYLE: L.PathOptions = { color: '#ffffff', weight: 3, fillColor: ROUTE_COLOR, fillOpacity: 0.6 };

/**
 * Positions Leaflet d'un tracé ou d'un point, gardées tant que la géométrie
 * ne change pas : un rendu de la page (saisie, onglet) ne
 * redonne pas à la carte des tableaux neufs, qu'elle reprojetterait.
 */
const pathPositions = new WeakMap<ReadonlyArray<RoutePoint>, [number, number][]>();
const latLngsOf = (points: ReadonlyArray<RoutePoint>): [number, number][] => {
  let positions = pathPositions.get(points);
  if (!positions) {
    positions = points.map((p): [number, number] => [p.lat, p.lon]);
    pathPositions.set(points, positions);
  }
  return positions;
};
const pointPositions = new WeakMap<Waypoint, [number, number]>();
const latLngOf = (w: Waypoint): [number, number] => {
  let position = pointPositions.get(w);
  if (!position) {
    position = [w.lat, w.lon];
    pointPositions.set(w, position);
  }
  return position;
};
/** Sur une boucle, un seul repère au départ, qui est aussi l'arrivée : moitié vert, moitié rouge. */
const LOOP_FILL = `linear-gradient(90deg, ${START_COLOR} 50%, ${END_COLOR} 50%)`;

/**
 * Repères des points, lettrés, gardés d'un rendu à l'autre : Leaflet ne les
 * redessine que s'ils changent. `fill` : fond CSS, couleur ou dégradé.
 */
const waypointIcons = divIconCache();
const waypointIcon = (label: string, fill: string, selected: boolean): L.DivIcon => waypointIcons(`${label}|${fill}|${selected}`, () => ({
  className: 'plan-marker',
  html: `<span class="plan-marker__dot${selected ? ' plan-marker__dot--selected' : ''}" style="background:${fill}">${label}</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
}));

const toWaypoint = (latlng: L.LatLng): Waypoint => ({ lat: latlng.lat, lon: latlng.lng });

/** Toucher de la carte, prise en main (toucher, glisser, zoomer), et vue retenue pour la prochaine ouverture. */
function MapEvents({ onTap, onTakeOver }: { onTap: (w: Waypoint) => void; onTakeOver: () => void }) {
  useMapEvents({
    click: (e) => {
      onTakeOver();
      onTap(toWaypoint(e.latlng));
    },
    dragstart: onTakeOver,
    zoomstart: onTakeOver,
    moveend: (e) => {
      const map = e.target as L.Map;
      const center = map.getCenter();
      writePrefs({ view: { lat: center.lat, lon: center.lng, zoom: map.getZoom() } });
    },
  });
  return null;
}

const defaultName = (): string => `Itinéraire du ${new Date().toLocaleDateString(dateLocale())}`;

const sameGuide = (a: MarkGuideSettings | null, b: MarkGuideSettings | null): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Aucune action à mener en quittant : l'itinéraire non enregistré est simplement abandonné. */
const noop = () => {};

/**
 * Onglets sous la carte. `balises` : « tracé et balises » ; `ranger` : « enregistrer » ;
 * `parcours` : « balises sonores » ; clés gardées pour l'état mémorisé. Le tracé et
 * les bips sont ouverts au départ. Le bloc réuni a sa propre clé, ouverte par défaut :
 * il n'hérite pas de l'état fermé gardé pour les anciens blocs `trace` (boutons seuls)
 * et `points`, qui peuvent rester dans la mémoire sans effet.
 */
type PlanningSection = 'balises' | 'ranger' | 'liste' | 'parcours';

const PLANNING_SECTION_DEFAULTS: Record<PlanningSection, boolean> = {
  balises: true,
  ranger: false,
  liste: false,
  parcours: true,
};

/**
 * Bloc d'un onglet, montré tant que l'onglet est ouvert (état mémorisé) ; son
 * titre le ferme. Il se redimensionne en hauteur sur ordinateur
 * (`ResizablePanel`, taille mémorisée sous `id`, à ne pas renommer).
 */
function PlanBlock({ id, label, open, onToggle, aside, helpKey, children }: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  aside?: ReactNode;
  /** Le « ? » du bloc, à droite de son titre ; son texte (`HelpText`) vient en tête des enfants. */
  helpKey?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <ResizablePanel id={id} direction="vertical" minHeight={80} style={CARD_STYLE}>
      <div className="plan-block__head">
        <PanelTitle label={label} open={open} onToggle={onToggle} helpKey={helpKey} />
        {aside}
      </div>
      {children}
    </ResizablePanel>
  );
}

function PlanningPage() {
  // Une activité cachée dans Réglages n'est ni proposée (`ActivitySheet`) ni reprise.
  const { activities, isShown } = useVisibility();
  const plannable = (a: Activity | null): a is Activity => a !== null && isShown(a);
  const [activityId, setActivityIdState] = useState<string | null>(
    () => [findActivity(activities, readPrefs().activityId), lastRecordActivity(), ...activities].find(plannable)?.id ?? null
  );
  const setActivityId = (id: string) => {
    setActivityIdState(id);
    writePrefs({ activityId: id });
  };
  const activity = findActivity(activities, activityId) ?? activities.find(plannable) ?? null;
  const distanceUnit = activity ? effectiveDistanceUnit(activity) : 'km';
  /** Famille de l'activité planifiée : son fond de carte, celui de ses analyses. */
  // Sans activité, le fond de la voile.
  const mapFamily = activity ? activityFamily(activity) : 'voile';
  const satellite = useMapBase(mapFamily)[0] === 'satellite';

  const planner = usePlannedRoute();
  const { route } = planner;
  const library = useRouteLibrary();
  /** « Mes itinéraires » : sans ceux d'une activité cachée. */
  const listedRoutes = useMemo(() => shownRoutes(library.routes, activities, isShown), [library.routes, activities, isShown]);
  const { go, canGo } = useGoOnRoute();

  const [map, setMap] = useState<L.Map | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  /** Carte verrouillée : un toucher ou un glissement n'y change pas l'itinéraire. */
  const [locked, setLocked] = useState(false);
  const helpOpen = useHelp('plan:trace')?.open ?? false;
  const { open, toggle } = useOpenSections<PlanningSection>('planning', PLANNING_SECTION_DEFAULTS);

  // Itinéraire enregistré en cours d'édition, et l'état enregistré, pour savoir s'il a changé.
  const [current, setCurrent] = useState<SavedRoute | null>(null);
  const [savedRoute, setSavedRoute] = useState<PlannedRoute>(EMPTY_ROUTE);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  /**
   * Itinéraire (`base`) dont « Supprimer » a été tenu dans le menu « … » : la confirmation n'y remplace l'entrée que pour
   * lui, et tombe à la fermeture du menu ou dès qu'un autre itinéraire, ou aucun, est ouvert.
   */
  const [confirmingMenuDelete, setConfirmingMenuDelete] = useState<string | null>(null);
  /** Itinéraire dont l'image de partage est ouverte (« Partager l'image » du menu « … »). */
  const [sharingImage, setSharingImage] = useState<SavedRoute | null>(null);

  // Recherche d'un lieu.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Place | null>(null);
  // Le retour d'Android ferme la fiche du point ou le lieu proposé avant de quitter la page ; un indice qui ne
  // désigne plus aucune balise n'ouvre rien.
  const selectedOpen = selected !== null && route.waypoints[selected] !== undefined;
  const candidateOpen = candidate !== null;
  useEffect(() => (selectedOpen ? pushBackLayer(() => setSelected(null)) : undefined), [selectedOpen]);
  useEffect(() => (candidateOpen ? pushBackLayer(() => setCandidate(null)) : undefined), [candidateOpen]);

  // Ma position : celle de l'enregistrement s'il tourne (il tient le GPS), sinon une lecture unique.
  const recording = useRecorderStatus() !== 'idle';
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [initialView] = useState(() => readPrefs().view ?? { lat: DEFAULT_MAP_CENTER[0], lon: DEFAULT_MAP_CENTER[1], zoom: 13 });
  /** Vrai dès que l'utilisateur ou la page a déplacé la carte : le centrage sur soi à l'ouverture n'a plus lieu. */
  const tookOver = useRef(false);
  const takeOver = () => {
    tookOver.current = true;
  };

  const totals = useMemo(() => routeTotals(route), [route]);
  const looped = isLooped(route);
  /** Nom des balises : 1, 2, 3… */
  const label = markLabel;
  /** Nom d'une balise ; sur une boucle, l'arrivée est le départ : 1. */
  const pointLabel = (i: number) => label(looped && i === route.waypoints.length - 1 ? 0 : i);
  /** Nom d'une balise au milieu du parcours, en toutes lettres. */
  const pointName = (i: number) => t('Balise {label}', { label: label(i) });
  const legs = useMemo(() => courseLegs(route), [route]);
  /** Bips d'approche propres au parcours (`null` : ceux de l'activité), et l'éditeur ouvert ou non. */
  const [courseGuide, setCourseGuide] = useState<MarkGuideSettings | null>(null);
  const [beepsOpen, setBeepsOpen] = useState(false);
  const activityGuide = useMemo(() => (activity ? effectiveMarkGuide(activity) : null), [activity]);
  const guide = courseGuide ?? activityGuide;
  /** Fond d'un point de la liste : départ en vert, arrivée en rouge, les autres en bleu, comme le tracé. */
  const pointFill = (i: number) => (i === 0 ? START_COLOR : i === route.waypoints.length - 1 ? END_COLOR : ROUTE_COLOR);
  /** Fond d'un repère sur la carte : sur une boucle, le repère unique A porte départ et arrivée. */
  const markerFill = (i: number) => (i === 0 && looped ? LOOP_FILL : pointFill(i));

  const dirty = current !== null
    ? route !== savedRoute || name.trim() !== current.record.name || (activity?.id ?? null) !== current.record.activityId
      || !sameGuide(courseGuide, routeMarkGuide(current.record))
    : route.waypoints.length > 0 || courseGuide !== null;
  useLeaveWarning(dirty ? { message: t('L\'itinéraire en cours n\'est pas enregistré. Quitter quand même ?'), discard: noop } : null);

  // --- Carte ---

  const onMapTap = (w: Waypoint) => {
    // Un toucher ferme d'abord ce qui est ouvert, sans poser de point par mégarde.
    if (selected !== null || candidate !== null || results !== null) {
      setSelected(null);
      setCandidate(null);
      setResults(null);
      return;
    }
    if (locked) return;
    planner.add(w);
  };

  /**
   * « Précédent », « Inverser » et « Boucler » changent l'ordre ou le nombre des balises d'un coup : la balise
   * touchée n'est plus à son indice, sa ligne se replie et son bandeau se ferme.
   */
  const undo = () => {
    planner.undo();
    setSelected(null);
  };
  const reverse = () => {
    planner.reverse();
    setSelected(null);
  };
  const closeLoop = () => {
    planner.closeLoop();
    setSelected(null);
  };

  /** Le verrouillage ferme le bandeau d'un point ou d'un lieu proposé : plus rien à modifier sur la carte. */
  const toggleLock = () => {
    if (!locked) {
      setSelected(null);
      setCandidate(null);
    }
    setLocked(!locked);
  };

  /** Point choisi dans la liste : même bandeau qu'au toucher sur la carte, carte centrée dessus. */
  const selectPoint = (index: number) => {
    const w = route.waypoints[index];
    if (!w) return;
    setCandidate(null);
    setResults(null);
    setSelected(index);
    map?.panTo([w.lat, w.lon]);
  };

  const fitTo = (r: PlannedRoute) => {
    const bounds = trackBounds(routePoints(r).length > 0 ? routePoints(r) : r.waypoints);
    takeOver();
    if (map && bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  };

  /**
   * Gestionnaires des tracés et des repères, gardés d'un rendu à l'autre :
   * un trait ou un repère les débranche et les rebranche dès qu'ils changent.
   */
  const legCount = route.legs.length;
  const insertPoint = planner.insert;
  const legHandlers = useMemo(() => Array.from({ length: legCount }, (_, i): L.LeafletEventHandlerFnMap => ({
    click: (e) => {
      setSelected(null);
      setCandidate(null);
      insertPoint(i, toWaypoint(e.latlng));
    },
  })), [legCount, insertPoint]);
  const waypointCount = route.waypoints.length;
  const movePoint = planner.move;
  const markerHandlers = useMemo(() => Array.from({ length: waypointCount }, (_, i): L.LeafletEventHandlerFnMap => (locked ? {} : {
    click: () => {
      setCandidate(null);
      setSelected(i);
    },
    dragend: (e) => movePoint(i, toWaypoint((e.target as L.Marker).getLatLng())),
  })), [waypointCount, movePoint, locked]);

  // --- Recherche ---

  // Une recherche en cours est abandonnée quand une autre part, ou en quittant la page : une réponse périmée ne remplace pas la dernière demande.
  const searchControl = useRef<AbortController | null>(null);
  useEffect(() => () => searchControl.current?.abort(), []);

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (text === '') return;
    searchControl.current?.abort();
    const controller = new AbortController();
    searchControl.current = controller;
    setSearching(true);
    setSearchError(null);
    try {
      const center = map?.getCenter();
      const found = await searchPlaces(text, center ? { lat: center.lat, lon: center.lng } : undefined, controller.signal);
      if (controller.signal.aborted) return;
      setResults(found);
      if (found.length === 0) setSearchError(t('Aucun lieu trouvé.'));
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return;
      setResults(null);
      setSearchError(plainError(err, t('Recherche impossible.')));
    } finally {
      if (searchControl.current === controller) setSearching(false);
    }
  };

  const choosePlace = (place: Place) => {
    setResults(null);
    setSelected(null);
    setCandidate(place);
    takeOver();
    map?.setView([place.lat, place.lon], Math.max(map.getZoom(), 15));
  };

  const locate = async () => {
    takeOver();
    setLocating(true);
    setLocateError(null);
    try {
      const fix = recording ? getLastFix() : await currentPosition();
      if (!fix) throw new Error(t('Aucune position reçue pour l\'instant.'));
      setSelected(null);
      setResults(null);
      setCandidate({ label: t('Votre position'), detail: '', lat: fix.lat, lon: fix.lon });
      map?.setView([fix.lat, fix.lon], Math.max(map.getZoom(), 15));
    } catch (err) {
      setLocateError(plainError(err, t('Position introuvable.')));
    } finally {
      setLocating(false);
    }
  };

  // --- Enregistrement ---

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const finalName = name.trim() || defaultName();
      const saved = await library.save(route, { name: finalName, activityId: activity?.id ?? null, markGuide: courseGuide }, current ?? undefined);
      setCurrent(saved);
      setSavedRoute(route);
      setName(finalName);
      setMessage(t('Enregistré dans {dir}/{base}.json, avec son GPX.', { dir: ROUTES_DIR, base: saved.base }));
    } catch (err) {
      setMessage(plainError(err, t('Enregistrement impossible.')));
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscard = () => !dirty || window.confirm(t('L\'itinéraire en cours n\'est pas enregistré. L\'abandonner ?'));

  const openSaved = (saved: SavedRoute) => {
    if (!confirmDiscard()) return;
    const known = findActivity(activities, saved.record.activityId);
    const opened = recordToRoute(saved.record);
    planner.replace(opened);
    setCourseGuide(routeMarkGuide(saved.record));
    setLocked(true);
    setCurrent(saved);
    setConfirmingMenuDelete(null);
    setSavedRoute(opened);
    setName(saved.record.name);
    if (known) setActivityId(known.id);
    setSelected(null);
    setMessage(null);
    fitTo(opened);
  };

  const startNew = () => {
    if (!confirmDiscard()) return;
    planner.replace(EMPTY_ROUTE);
    setLocked(false);
    setCurrent(null);
    setConfirmingMenuDelete(null);
    setSavedRoute(EMPTY_ROUTE);
    setName('');
    setCourseGuide(null);
    setSelected(null);
    setMessage(null);
  };

  /** Supprime un itinéraire enregistré ; celui qui est ouvert laisse la place à une carte vide. */
  const deleteSaved = async (saved: SavedRoute) => {
    setConfirmingDelete(null);
    setConfirmingMenuDelete(null);
    try {
      await library.remove(saved);
      if (current?.base === saved.base) {
        planner.replace(EMPTY_ROUTE);
        setLocked(false);
        setCurrent(null);
        setSavedRoute(EMPTY_ROUTE);
        setName('');
        setCourseGuide(null);
        setSelected(null);
        setMessage(t('Itinéraire supprimé.'));
      }
    } catch (err) {
      setMessage(plainError(err, t('Suppression impossible.')));
    }
  };

  const exportGpx = () => {
    const fileName = `${current?.base ?? safeFileName(name.trim() || defaultName())}.gpx`;
    downloadTextFile(fileName, buildRouteGpx(route, name.trim() || defaultName(), label));
  };

  /**
   * Menu « … » de l'itinéraire, en haut de la page à droite du titre : il se montre sur un itinéraire rangé, ou sur ordinateur dès qu'un tracé peut s'exporter.
   * Le partage porte le GPX rangé : un itinéraire modifié ou jamais rangé doit d'abord être enregistré, comme pour « Partir ».
   */
  const showMenu = current !== null || (canDownloadFiles() && route.waypoints.length >= 2);
  const shareBlocked = current === null || dirty;
  const shareCurrent = async () => {
    if (!current) return;
    setMessage(null);
    setMessage((await shareRouteGpx(current))?.text ?? null);
  };

  // Itinéraire demandé par l'adresse : ouvert une fois la liste lue et la carte prête, puis l'adresse est
  // nettoyée, pour qu'un retour sur la page ne le rouvre pas par-dessus un tracé en cours.
  const [params, setParams] = useSearchParams();
  const requestedBase = params.get('itineraire');
  useEffect(() => {
    if (!requestedBase || !map) return;
    const saved = library.routes.find((r) => r.base === requestedBase);
    if (!saved) return;
    openSaved(saved);
    setParams({}, { replace: true });
    // openSaved n'est pas stable ; seuls la demande, la liste et la carte comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedBase, map, library.routes]);

  // À l'ouverture, carte centrée sur soi si la position est déjà permise (jamais demandée ici) ; sans réponse,
  // en silence, la dernière vue reste. Rien si un itinéraire est demandé ou si la carte a bougé entre-temps.
  useEffect(() => {
    if (!map || requestedBase) return;
    let cancelled = false;
    void (async () => {
      try {
        const fix = recording
          ? getLastFix()
          : (await locationPermissionGranted()) ? await currentPosition(AUTO_LOCATE_TIMEOUT_MS) : null;
        if (!fix || cancelled || tookOver.current) return;
        map.setView([fix.lat, fix.lon], Math.max(map.getZoom(), AUTO_LOCATE_MIN_ZOOM));
      } catch {
        // Localisation coupée ou trop lente : la dernière vue suffit.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Une fois, quand la carte est prête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const canSave = library.canSave && route.waypoints.length >= 2 && !saving && !current?.readOnly;

  /** Onglets sous la carte : le tracé et ses balises, l'enregistrement, la liste, puis les bips s'il y en a. */
  const pointCount = route.waypoints.length;
  /** Balises du parcours, sans le retour au départ d'une boucle. */
  const markCount = pointCount - (looped ? 1 : 0);
  const sections: SectionDefinition<PlanningSection>[] = [
    { key: 'balises', label: t('tracé et balises ({n})', { n: pointCount }) },
    { key: 'ranger', label: t('enregistrer', { ctx: 'garder' }) },
    { key: 'liste', label: t('mes itinéraires ({n})', { n: listedRoutes.length }) },
    ...(guide && activity ? [{ key: 'parcours' as const, label: t('balises sonores') }] : []),
  ];

  return (
    <div className="ui-page ui-page--wide plan-page">
      <PageHeader
        title={t('Itinéraires')}
        back={{ to: ROUTES_LIST_PATH, label: t('Itinéraires planifiés') }}
        aside={showMenu ? (
          <MoreMenu label={t("Plus d'actions sur l'itinéraire")} onClose={() => setConfirmingMenuDelete(null)}>
            <Button onClick={() => setSharingImage(current)} disabled={shareBlocked}>
              <IconShare size={18} />
              {t("Partager l'image")}
            </Button>
            <Button onClick={() => void shareCurrent()} disabled={shareBlocked}>
              <IconShare size={18} />
              {t('Partager le GPX')}
            </Button>
            {shareBlocked && <span className="ui-more__note">{t("Enregistrez d'abord les modifications")}</span>}
            {canDownloadFiles() && (
              <Button onClick={exportGpx} disabled={route.waypoints.length < 2}>
                <IconDownload size={18} />
                {t('Exporter le GPX')}
              </Button>
            )}
            {current !== null && (confirmingMenuDelete === current.base ? (
              <>
                <Button variant="danger" onClick={() => void deleteSaved(current)}>{t('Supprimer définitivement')}</Button>
                <Button variant="ghost" onClick={() => setConfirmingMenuDelete(null)}>{t('Garder')}</Button>
              </>
            ) : (
              <HoldButton onHold={() => setConfirmingMenuDelete(current.base)} getHoldMs={routeDeleteHoldMs} label={t('Supprimer')}
                lead={<IconTrash size={18} />} dialTitle={t('Supprimer')} icon={<IconTrash size={48} />} action="supprimer" keepMenuOpen
                ariaLabel={t("Supprimer l'itinéraire : maintenir une seconde")} />
            ))}
          </MoreMenu>
        ) : undefined}
        subtitle={t('Posez les balises sur la carte : le parcours les relie en ligne droite.')} />

      <div className="plan-layout">
        <div className="plan-map-col">
          <div className="plan-toolbar">
            <ActivitySelect activities={activities} value={activity?.id ?? null} label={t('Activité')}
              onChange={(next) => setActivityId(next.id)} />
            <span className="plan-toolbar__note">{t('Balises reliées en ligne droite')}</span>
          </div>
          <form className="plan-search" onSubmit={(e) => void onSearch(e)}>
            <input
              type="search"
              className="ui-field"
              placeholder={t('Chercher un lieu : port, plage, spot…')}
              aria-label={t('Chercher un lieu')}
              value={query}
              onChange={(e) => setQuery(e.target.value)} />
            <Button type="submit" disabled={searching || query.trim() === ''}>{searching ? t('Recherche…') : t('Chercher')}</Button>
          </form>
          {searchError && <div className="ui-alert ui-alert--warning">{searchError}</div>}
          {locateError && <div className="ui-alert ui-alert--warning">{locateError}</div>}
          {results && results.length > 0 && (
            <ul className="plan-results">
              {results.map((place, i) => (
                <li key={i}>
                  <button type="button" onClick={() => choosePlace(place)}>
                    <strong>{place.label}</strong>
                    {place.detail && <span>{place.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ResizablePanel id="planning.carte" direction="vertical" minHeight={240} className="plan-map ui-overflow-hidden">
            <MapContainer ref={setMap} center={[initialView.lat, initialView.lon]} zoom={initialView.zoom} className="ui-fill">
              <MapAutoResize />
              {/* Fond de la famille de l'activité planifiée : celui de ses analyses, changé ici aussi. */}
              <BaseTileLayer family={mapFamily} />
              <MapEvents onTap={onMapTap} onTakeOver={takeOver} />
              {satellite && route.legs.map((leg, i) => (
                <Polyline key={`halo-${i}`} positions={latLngsOf(leg.points)} pathOptions={HALO_STYLE} />
              ))}
              {route.legs.map((leg, i) => {
                const positions = latLngsOf(leg.points);
                return (
                  <Fragment key={i}>
                    <Polyline positions={positions} pathOptions={LEG_STYLE} />
                    {!locked && <Polyline positions={positions} pathOptions={HIT_STYLE} eventHandlers={legHandlers[i]} />}
                  </Fragment>
                );
              })}
              {/* Sur une boucle, l'arrivée est au départ : un seul repère, 1, qui les déplace ensemble. */}
              {(looped ? route.waypoints.slice(0, -1) : route.waypoints).map((w, i) => (
                <Marker
                  key={i}
                  position={latLngOf(w)}
                  draggable={!locked}
                  icon={waypointIcon(label(i), markerFill(i), selected === i)}
                  eventHandlers={markerHandlers[i]} />
              ))}
              {candidate && (
                <CircleMarker center={[candidate.lat, candidate.lon]} radius={9}
                  pathOptions={CANDIDATE_STYLE} />
              )}
            </MapContainer>
            <div className="plan-map-tools theme-light">
              <Button size="s" onClick={() => void locate()} disabled={locating}>
                {locating ? t('Recherche…') : t('Ma position')}
              </Button>
              <Button size="s" onClick={undo} disabled={!planner.canUndo} aria-label={t('Précédent : défaire la dernière modification')}>
                <IconUndo size={16} />
                {t('Précédent')}
              </Button>
              <Button size="s" onClick={toggleLock}
                aria-label={locked ? t("Modifier l'itinéraire") : t("Verrouiller l'itinéraire")}
                title={locked ? t("Modifier l'itinéraire") : t("Verrouiller l'itinéraire : la carte ne pose plus de point")}>
                {locked ? <IconPencil size={16} /> : <IconPencilOff size={16} />}
              </Button>
            </div>

            {selected !== null && route.waypoints[selected] && (
              <div className="plan-overlay theme-light">
                <strong>{t('Balise {label}', { label: pointLabel(selected) })}</strong>
                {selected === 0 && route.waypoints.length >= 2 && !looped && (
                  <Button size="s" variant="primary" onClick={() => { planner.closeLoop(); setSelected(null); }}>{t('Boucler ici')}</Button>
                )}
                <Button size="s" variant="danger" onClick={() => { planner.remove(selected); setSelected(null); }}>{t('Retirer')}</Button>
                <button type="button" className="plan-overlay__close" aria-label={t('Fermer')} onClick={() => setSelected(null)}>×</button>
              </div>
            )}
            {candidate && (
              <div className="plan-overlay theme-light">
                <span className="plan-overlay__place"><strong>{candidate.label}</strong>{candidate.detail && ` · ${candidate.detail}`}</span>
                <Button size="s" variant="primary" onClick={() => { planner.add(candidate); setCandidate(null); }}>
                  {t('Ajouter cette balise')}
                </Button>
                <button type="button" className="plan-overlay__close" aria-label={t('Fermer')} onClick={() => setCandidate(null)}>×</button>
              </div>
            )}
          </ResizablePanel>
        </div>

        <div className="plan-panel">
          <SectionTabs sections={sections} open={open} onToggle={toggle} />
          <PlanBlock id="planning.balises" label={t('Tracé et balises ({n})', { n: pointCount })} open={open.balises} onToggle={() => toggle('balises')} helpKey="plan:trace">
            {helpOpen && (
              <ul className="plan-help">
                <li>{t('Touchez la carte pour poser les balises : 1, puis 2, puis 3… Le départ est en vert, l\'arrivée en rouge.')}</li>
                <li>{t('Les balises sont reliées en ligne droite : sur l\'eau, pas de chemin à suivre.')}</li>
                <li>{t('Touchez le parcours pour insérer une balise entre deux autres ; faites glisser une balise pour la déplacer.')}</li>
                <li>{t('Touchez une balise pour la retirer ; touchez la 1 pour boucler, retour au départ.')}</li>
                <li>{t('« Précédent » défait la dernière modification. Touchez une balise de la liste pour la monter, la descendre ou la retirer.')}</li>
                <li>{t('Le crayon, sur la carte, verrouille le parcours pour la déplacer sans poser de balise ; un parcours rangé s\'ouvre verrouillé, le crayon le rend modifiable.')}</li>
                <li>
                  {t('En navigation (« Partir »), chaque balise, départ compris, se valide en passant près d\'elle, avec des bips de plus en plus rapides à l\'approche ; « Passer » saute une balise. Distances, rythme et vibration se règlent dans Réglages.')}
                </li>
              </ul>
            )}
            <div className="plan-trace">
              <div className="plan-figures">
                <strong className="plan-figures__distance num">
                  {formatDistance(totals.distanceM, distanceUnit, toDisplayDistance(totals.distanceM, distanceUnit) >= 100 ? 1 : 2)}
                </strong>
                <span className="plan-figures__item num">{tn(markCount, '{n} balise', '{n} balises')}</span>
                <span className="plan-figures__item">
                  {t('bord max')}{' '}
                  <strong className="num">{legs.length > 0 ? formatDistance(Math.max(...legs.map((l) => l.distanceM)), distanceUnit) : '—'}</strong>
                </span>
              </div>
              <div className="plan-actions">
                <Button size="s" onClick={undo} disabled={!planner.canUndo}
                  aria-label={t('Précédent : défaire la dernière modification')} title={t('Précédent : défaire la dernière modification')}>
                  <IconUndo size={16} />
                </Button>
                <Button size="s" onClick={reverse} disabled={route.waypoints.length < 2}>{t('Inverser')}</Button>
                <Button size="s" onClick={closeLoop} disabled={route.waypoints.length < 2 || looped}>{t('Boucler')}</Button>
                <Button size="s" variant="ghost" onClick={() => { planner.clear(); setSelected(null); setLocked(false); }} disabled={route.waypoints.length === 0}>{t('Tout effacer')}</Button>
              </div>
              {route.waypoints.length === 0 ? (
                <p className="plan-note">{t('Aucun point : touchez la carte pour poser le départ.')}</p>
              ) : (
                <ol className="plan-points">
                  {route.waypoints.map((_, i) => {
                    const last = route.waypoints.length - 1;
                    const touched = selected === i;
                    // Le bord qui mène à la balise : aucun pour le départ.
                    const leg = i > 0 ? legs[i - 1] : undefined;
                    return (
                      <li key={i} className={touched ? 'plan-point plan-point--selected' : 'plan-point'}>
                        <button type="button" className="plan-point__main" aria-expanded={touched}
                          onClick={() => (touched ? setSelected(null) : selectPoint(i))}>
                          <span className="plan-point__dot" style={{ background: pointFill(i) }}>{pointLabel(i)}</span>
                          <strong className="plan-point__name">
                            {i === 0 ? t('Départ') : i === last ? (looped ? t('Arrivée, retour au départ') : t('Arrivée')) : pointName(i)}
                          </strong>
                          <span className="plan-point__leg num">{leg ? formatDistance(leg.distanceM, distanceUnit) : '—'}</span>
                          <span className="plan-point__bearing num">{leg ? `${roundBearingDeg(leg.bearingDeg)}°` : ''}</span>
                        </button>
                        {touched && (
                          <span className="plan-point__actions">
                            <Button size="s" aria-label={t('Monter : {name}', { name: pointName(i) })}
                              disabled={i === 0} onClick={() => { planner.reorder(i, i - 1); setSelected(i - 1); }}>
                              <IconChevronUp size={16} />
                              {t('Monter')}
                            </Button>
                            <Button size="s" aria-label={t('Descendre : {name}', { name: pointName(i) })}
                              disabled={i === last} onClick={() => { planner.reorder(i, i + 1); setSelected(i + 1); }}>
                              <IconChevronDown size={16} />
                              {t('Descendre')}
                            </Button>
                            <Button size="s" className="plan-point__remove" aria-label={t('Retirer : {name}', { name: pointName(i) })}
                              title={t('Retirer')} onClick={() => { planner.remove(i); setSelected(null); }}>
                              <IconClose size={16} />
                            </Button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </PlanBlock>

          <PlanBlock id="planning.ranger" label={current ? t('Itinéraire enregistré') : t('Enregistrer l\'itinéraire')} open={open.ranger} onToggle={() => toggle('ranger')}
            helpKey={canDownloadFiles() ? undefined : 'plan:ranger'}>
            <HelpText helpKey="plan:ranger" note>
              {t('Le GPX est enregistré avec l\'itinéraire, dans le dossier Gtracker/{dir}, pour l\'emporter dans une autre application.', { dir: ROUTES_DIR })}
            </HelpText>
            <div className="plan-form">
              <div className="plan-form__field">
                <label className="ui-eyebrow" htmlFor={NAME_FIELD_ID}>{t('Nom')}</label>
                <input id={NAME_FIELD_ID} className="ui-field" value={name} placeholder={defaultName()} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            {!library.canSave && (
              <div className="ui-alert ui-alert--warning">{t('Aucun dossier mémoire : choisissez-le dans Réglages pour enregistrer vos itinéraires.')}</div>
            )}
            {current?.readOnly && (
              <div className="ui-alert ui-alert--warning">{t('Cet itinéraire vient d\'une version plus récente de l\'application : il se consulte sans se modifier.')}</div>
            )}
            <div className="plan-actions">
              <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave || (current !== null && !dirty)}>
                {saving ? t('Enregistrement…') : current ? t('Enregistrer les modifications') : t('Enregistrer', { ctx: 'garder' })}
              </Button>
              {current !== null && (
                <Button variant="record" onClick={() => go(current)} disabled={dirty || !canGo}
                  title={dirty ? t("Enregistrez d'abord les modifications") : canGo ? undefined : t('Un enregistrement est en cours')}>
                  {t('Partir')}
                </Button>
              )}
              {(current !== null || route.waypoints.length > 0) && <Button variant="ghost" onClick={startNew}>{t('Nouvel itinéraire')}</Button>}
            </div>
            {message && <p className="plan-note">{message}</p>}
            {sharingImage && <RouteImageShare saved={sharingImage} activities={activities} onClose={() => setSharingImage(null)} />}
          </PlanBlock>

          <PlanBlock id="planning.liste" label={t('Mes itinéraires ({n})', { n: listedRoutes.length })} open={open.liste} onToggle={() => toggle('liste')}>
            {library.error && <div className="ui-alert ui-alert--danger">{library.error}</div>}
            {listedRoutes.length === 0 ? (
              <p className="plan-note">{t('Aucun itinéraire enregistré pour l\'instant.')}</p>
            ) : (
              <RouteList
                routes={listedRoutes}
                activities={activities}
                onOpen={openSaved}
                currentBase={current?.base ?? null}
                go={false}
                actions={(saved) => (confirmingDelete === saved.base ? (
                  <span className="plan-saved__confirm">
                    <Button size="s" variant="danger" onClick={() => void deleteSaved(saved)}>{t('Supprimer')}</Button>
                    <Button size="s" variant="ghost" onClick={() => setConfirmingDelete(null)}>{t('Garder')}</Button>
                  </span>
                ) : (
                  <Button size="s" variant="ghost" onClick={() => setConfirmingDelete(saved.base)} aria-label={t('Supprimer {name}', { name: saved.record.name })}>{t('Supprimer')}</Button>
                ))} />
            )}
          </PlanBlock>

          {guide && activity && (
            <PlanBlock id="planning.bips" label={t('Balises sonores')} open={open.parcours} onToggle={() => toggle('parcours')} helpKey="plan:parcours">
              <HelpText helpKey="plan:parcours" note>
                {courseGuide
                  ? tRich(
                    'En navigation, chaque balise, départ compris, se valide à moins de {radius} m. Bips dès {start} m : propres à ce parcours. « Régler pour ce parcours » ouvre leur courbe : tirez un point pour le déplacer, touchez le graphe pour en ajouter un.',
                    { radius: validationRadiusM(guide), start: beepStartM(guide) }
                  )
                  : tRich(
                    'En navigation, chaque balise, départ compris, se valide à moins de {radius} m. Bips dès {start} m : ceux de l\'activité {name}, réglés dans <a>Réglages</a>. « Régler pour ce parcours » ouvre leur courbe : tirez un point pour le déplacer, touchez le graphe pour en ajouter un.',
                    { radius: validationRadiusM(guide), start: beepStartM(guide), name: activityDisplayName(activity) },
                    { a: (c) => <Link to="/parametres">{c}</Link> }
                  )}
              </HelpText>
              <div className="plan-beeps">
                <div className="plan-beeps__head">
                  <Button size="s" onClick={() => setBeepsOpen((o) => !o)} aria-expanded={beepsOpen}>
                    {beepsOpen ? t('Fermer') : t('Régler pour ce parcours')}
                  </Button>
                </div>
                {beepsOpen && activityGuide && (
                  <BeepCurveEditor value={guide} overridden={courseGuide !== null} fallback={activityGuide}
                    resetLabel={t("Comme l'activité")} fallbackMark={t("ceux de l'activité {name}", { name: activityDisplayName(activity) })}
                    approachMs={simulatedApproachMs(activityFamily(activity))} speedUnit={effectiveSpeedUnit(activity)}
                    onChange={setCourseGuide} />
                )}
              </div>
            </PlanBlock>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlanningPage;
