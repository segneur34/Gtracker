import { lazy, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RESTING_HR_PATH } from './core/parentPage';
import AppShell from './components/AppShell';
import { DevThrow } from './components/ErrorBoundary';
import { hasPositions } from './core/sportProfiles';
import { acknowledgeRecordingLanding, useRecorderSelector } from './hooks/useRecorder';
import { useLibrarySession } from './hooks/useSessionLibrary';
import Home from './pages/Home';

/**
 * Pages chargées à la demande (27/10) : seul l'accueil est dans le paquet
 * d'entrée ; chaque autre page, et avec elle Recharts (`vendor-charts`) ou
 * Leaflet (`vendor-map`), ne s'analyse qu'à sa première ouverture. `AppShell`
 * pose le `Suspense` ; les chemins, les `key` et `core/parentPage.ts` ne
 * changent pas. Dans l'application Android, les morceaux sont locaux au
 * paquet : c'est du temps d'analyse JS déplacé hors du premier rendu.
 */
const loaders = {
  SessionLibrary: () => import('./pages/SessionLibrary'),
  RecordingPage: () => import('./pages/RecordingPage'),
  LandModule: () => import('./pages/LandModule'),
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
const LandModule = lazy(loaders.LandModule);
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
    'RecordingPage', 'SessionLibrary', 'LandModule', 'SailingModule', 'SurfModule', 'StatisticsPage', 'ProfilePage',
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

/**
 * Analyse d'une session de l'Entraînement, famille retirée de cette version
 * (lot 302) mais dont les sessions déjà rangées restent lisibles :
 * `LandModule` ; une session sans trace (muscu) n'a plus d'analyse et renvoie
 * à la bibliothèque de la famille. Le calcul se lit dans la fiche de la
 * session demandée (`?session=`) ; tant que la bibliothèque ne la connaît pas,
 * rien n'est chargé (`useSessionFromUrl`).
 */
function TrainingAnalysis() {
  const [params] = useSearchParams();
  const sport = useLibrarySession(params.get('session'))?.record.sport ?? null;
  return sport !== null && !hasPositions(sport)
    ? <Navigate to="/fractionne" replace />
    : <LandModule key="fractionne" family="fractionne" />;
}

/** Ancienne adresse du test de FC repos (sous l'Entraînement jusqu'au lot 301) : la nouvelle, sous le Profil, réglages d'adresse gardés. */
function RestingHrRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: RESTING_HR_PATH, search }} replace />;
}

/** Une recharge mène toujours à l'accueil : après une reprise silencieuse (lot 156), retour sur Enregistrer. */
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

function App() {
  useEffect(preloadPages, []);
  return (
    <Router>
      <LandOnRecording />
      <Routes>
        {/* Toutes les pages dans le même cadre : navigation et bandeau d'enregistrement. */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          {/* Chaque famille : sa bibliothèque, et son module d'analyse ouvert sur une session (`?session=`). */}
          <Route path="/voile" element={<SessionLibrary key="voile" family="voile" />} />
          <Route path="/voile/analyse" element={<SailingModule />} />
          <Route path="/course" element={<SessionLibrary key="course" family="course" />} />
          <Route path="/course/analyse" element={<LandModule key="course" family="course" />} />
          <Route path="/velo" element={<SessionLibrary key="velo" family="velo" />} />
          <Route path="/velo/analyse" element={<LandModule key="velo" family="velo" />} />
          <Route path="/fractionne" element={<SessionLibrary key="fractionne" family="fractionne" />} />
          <Route path="/fractionne/analyse" element={<TrainingAnalysis />} />
          {/* Ancienne adresse du test de FC repos, passé sous le Profil (lot 301). */}
          <Route path="/fractionne/tests/fc-repos" element={<RestingHrRedirect />} />
          {/* Pages de l'Entraînement retirées (lot 302 : séances, timer, tests) : vers l'accueil. */}
          <Route path="/fractionne/*" element={<Navigate to="/" replace />} />
          <Route path="/surf" element={<SessionLibrary key="surf" family="surf" />} />
          <Route path="/surf/analyse" element={<SurfModule />} />
          <Route path="/enregistrer" element={<RecordingPage />} />
          <Route path="/itineraires" element={<PlanningPage />} />
          <Route path="/itineraires/liste" element={<RoutesPage />} />
          <Route path="/statistiques" element={<StatisticsPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path={RESTING_HR_PATH} element={<RestingHrTestPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          {/* Tutoriels (lot 147) : la liste, sous Réglages, et chaque leçon. */}
          <Route path="/tutoriels" element={<TutorialsPage />} />
          <Route path="/tutoriels/:id" element={<TutorialPage />} />
          {/* Développement seulement : une page qui lève au rendu, pour essayer la limite d'erreur au banc. */}
          {import.meta.env.DEV && <Route path="/essai/erreur" element={<DevThrow />} />}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
