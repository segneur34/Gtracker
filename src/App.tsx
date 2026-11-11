import { lazy, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { RESTING_HR_PATH, analysisPath } from './core/parentPage';
import { sportFamily } from './core/sportProfiles';
import AppShell from './components/AppShell';
import { DevThrow } from './components/ErrorBoundary';
import { confirmLeave } from './hooks/leaveGuard';
import {
  acknowledgeRecordingLanding, dismissRecorderResult, finishPendingSession, getRecorderState, markRecorderResultOpened, useRecorderSelector,
} from './hooks/useRecorder';
import Home from './pages/Home';

/**
 * Pages chargées à la demande : seul l'accueil est dans le paquet
 * d'entrée ; chaque autre page, et avec elle Recharts (`vendor-charts`) ou
 * Leaflet (`vendor-map`), ne s'analyse qu'à sa première ouverture. `AppShell`
 * pose le `Suspense` ; les chemins, les `key` et `core/parentPage.ts` ne
 * changent pas. Dans l'application Android, les morceaux sont locaux au
 * paquet : c'est du temps d'analyse JS déplacé hors du premier rendu.
 */
const loaders = {
  SessionLibrary: () => import('./pages/SessionLibrary'),
  RecordingPage: () => import('./pages/RecordingPage'),
  SailingModule: () => import('./pages/SailingModule'),
  SurfModule: () => import('./pages/SurfModule'),
  SettingsPage: () => import('./pages/SettingsPage'),
  PlanningPage: () => import('./pages/PlanningPage'),
  RoutesPage: () => import('./pages/RoutesPage'),
  StatisticsPage: () => import('./pages/StatisticsPage'),
  ProfilePage: () => import('./pages/ProfilePage'),
  RestingHrTestPage: () => import('./pages/RestingHrTestPage'),
  TutorialsPage: () => import('./pages/TutorialsPage'),
  TutorialPage: () => import('./pages/TutorialPage'),
};

const SessionLibrary = lazy(loaders.SessionLibrary);
const RecordingPage = lazy(loaders.RecordingPage);
const SailingModule = lazy(loaders.SailingModule);
const SurfModule = lazy(loaders.SurfModule);
const SettingsPage = lazy(loaders.SettingsPage);
const PlanningPage = lazy(loaders.PlanningPage);
const RoutesPage = lazy(loaders.RoutesPage);
const StatisticsPage = lazy(loaders.StatisticsPage);
const ProfilePage = lazy(loaders.ProfilePage);
const RestingHrTestPage = lazy(loaders.RestingHrTestPage);
const TutorialsPage = lazy(loaders.TutorialsPage);
const TutorialPage = lazy(loaders.TutorialPage);

/** Délai avant le préchargement quand le navigateur n'a pas `requestIdleCallback`. */
const PRELOAD_FALLBACK_MS = 1500;

/**
 * Précharge les pages une fois l'accueil rendu et le fil libre, dans l'ordre
 * où l'utilisateur y va le plus : Enregistrer, une bibliothèque, les
 * analyses, puis le reste ; un morceau à la fois, pour ne pas peser sur le
 * premier rendu. Une page ouverte entre-temps ne l'attend pas : `React.lazy`
 * la charge lui-même.
 */
const preloadPages = (): (() => void) => {
  const order: (keyof typeof loaders)[] = [
    'RecordingPage', 'SessionLibrary', 'SailingModule', 'SurfModule', 'StatisticsPage', 'ProfilePage',
    'SettingsPage', 'PlanningPage', 'RoutesPage', 'RestingHrTestPage', 'TutorialPage', 'TutorialsPage',
  ];
  let cancelled = false;
  let handle: number | null = null;
  const schedule = (fn: () => void) => {
    if (typeof requestIdleCallback === 'function') handle = requestIdleCallback(() => fn());
    else handle = window.setTimeout(fn, PRELOAD_FALLBACK_MS);
  };
  const next = (k: number) => {
    if (cancelled || k >= order.length) return;
    void loaders[order[k]]().catch(() => undefined).then(() => schedule(() => next(k + 1)));
  };
  schedule(() => next(0));
  return () => {
    cancelled = true;
    if (handle !== null) {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
      window.clearTimeout(handle);
    }
  };
};

/** Une recharge mène toujours à l'accueil : après une reprise silencieuse, retour sur Enregistrer. */
function LandOnRecording() {
  const land = useRecorderSelector((s) => s.landOnRecording);
  const navigate = useNavigate();
  useEffect(() => {
    if (!land) return;
    acknowledgeRecordingLanding();
    navigate('/enregistrer', { replace: true });
  }, [land, navigate]);
  return null;
}

/**
 * Fin d'un enregistrement : la session en attente se range seule (`finishPendingSession`), à l'arrêt comme
 * à la réouverture après une coupure, puis son analyse s'ouvre, à la place de la page Enregistrer (le retour mène à
 * la bibliothèque). Un message de l'enregistreur (avertissement de l'arrêt, ménage en échec) reste pour l'analyse,
 * qui le montre. Rien ne s'ouvre si le rangement échoue (la carte de la session sert de filet), si la session n'est
 * pas entrée dans la mémoire ou reste à classer, ou si un brouillon ouvert n'est pas abandonné (`confirmLeave`) : la
 * carte « Session rangée » d'Enregistrer l'annonce alors, avec son message et « Analyser ». Une session reprise qui
 * peut continuer attend « Continuer » sur Enregistrer.
 */
function FinishRecording() {
  const pending = useRecorderSelector((s) => s.pending);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /** Page affichée à la fin du rangement, lue sans relancer l'effet à chaque navigation. */
  const where = useRef(pathname);
  useEffect(() => {
    where.current = pathname;
  });
  useEffect(() => {
    if (pending === null) return;
    void finishPendingSession().then((saved) => {
      if (saved?.libraryFile == null || saved.sport === null) return;
      // Brouillon gardé : rien ne s'ouvre, la carte « Session rangée » d'Enregistrer reste (`resultOpened` faux).
      if (!confirmLeave()) return;
      if (getRecorderState().error === null) dismissRecorderResult();
      else markRecorderResultOpened();
      // Depuis Enregistrer, l'analyse prend sa place dans l'historique.
      const fromRecording = where.current.replace(/\/+$/, '') === '/enregistrer';
      navigate(analysisPath(sportFamily(saved.sport), saved.libraryFile), { replace: fromRecording });
    });
  }, [pending, navigate]);
  return null;
}

function App() {
  useEffect(preloadPages, []);
  return (
    <Router>
      <LandOnRecording />
      <FinishRecording />
      <Routes>
        {/* Toutes les pages dans le même cadre : navigation et bandeau d'enregistrement. */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          {/* Chaque famille : sa bibliothèque, et son module d'analyse ouvert sur une session (`?session=`). */}
          <Route path="/voile" element={<SessionLibrary key="voile" family="voile" />} />
          <Route path="/voile/analyse" element={<SailingModule />} />
          <Route path="/surf" element={<SessionLibrary key="surf" family="surf" />} />
          <Route path="/surf/analyse" element={<SurfModule />} />
          <Route path="/enregistrer" element={<RecordingPage />} />
          <Route path="/itineraires" element={<PlanningPage />} />
          <Route path="/itineraires/liste" element={<RoutesPage />} />
          <Route path="/statistiques" element={<StatisticsPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path={RESTING_HR_PATH} element={<RestingHrTestPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          {/* Tutoriels : la liste, sous Réglages, et chaque leçon. */}
          <Route path="/tutoriels" element={<TutorialsPage />} />
          <Route path="/tutoriels/:id" element={<TutorialPage />} />
          {/* Développement seulement : une page qui lève au rendu, pour essayer la limite d'erreur au banc. */}
          {import.meta.env.DEV && <Route path="/essai/erreur" element={<DevThrow />} />}
          {/* Toute autre adresse mène à l'accueil, au lieu d'une page vide. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
