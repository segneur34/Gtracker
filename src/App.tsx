import { lazy, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PROFILE_PATH, RESTING_HR_PATH, SESSIONS_PATH, analysisPath, sessionsPath } from './core/parentPage';
import { sportFamily } from './core/sportProfiles';
import AppShell from './components/AppShell';
import { DevThrow } from './components/ErrorBoundary';
import { confirmLeave } from './hooks/leaveGuard';
import { useComputerLinkLauncher } from './hooks/useComputerLink';
import {
  acknowledgeRecordingLanding, finishPendingSession, markRecorderResultOpened, useRecorderSelector,
} from './hooks/useRecorder';
import ProfilePage from './pages/ProfilePage';

/**
 * Pages chargées à la demande : seul le Profil, où s'ouvre l'application, est dans le paquet
 * d'entrée ; chaque autre page, et avec elle Recharts (`vendor-charts`) ou
 * Leaflet (`vendor-map`), ne s'analyse qu'à sa première ouverture. `AppShell`
 * pose le `Suspense` ; les chemins, les `key` et `core/parentPage.ts` ne
 * changent pas. Dans l'application Android, les morceaux sont locaux au
 * paquet : c'est du temps d'analyse JS déplacé hors du premier rendu.
 */
const loaders = {
  SessionsPage: () => import('./pages/SessionsPage'),
  RecordingPage: () => import('./pages/RecordingPage'),
  SailingModule: () => import('./pages/SailingModule'),
  SurfModule: () => import('./pages/SurfModule'),
  SettingsPage: () => import('./pages/SettingsPage'),
  PlanningPage: () => import('./pages/PlanningPage'),
  RoutesPage: () => import('./pages/RoutesPage'),
  StatisticsPage: () => import('./pages/StatisticsPage'),
  RestingHrTestPage: () => import('./pages/RestingHrTestPage'),
  TutorialsPage: () => import('./pages/TutorialsPage'),
  TutorialPage: () => import('./pages/TutorialPage'),
};

const SessionsPage = lazy(loaders.SessionsPage);
const RecordingPage = lazy(loaders.RecordingPage);
const SailingModule = lazy(loaders.SailingModule);
const SurfModule = lazy(loaders.SurfModule);
const SettingsPage = lazy(loaders.SettingsPage);
const PlanningPage = lazy(loaders.PlanningPage);
const RoutesPage = lazy(loaders.RoutesPage);
const StatisticsPage = lazy(loaders.StatisticsPage);
const RestingHrTestPage = lazy(loaders.RestingHrTestPage);
const TutorialsPage = lazy(loaders.TutorialsPage);
const TutorialPage = lazy(loaders.TutorialPage);

/** Délai avant le préchargement quand le navigateur n'a pas `requestIdleCallback`. */
const PRELOAD_FALLBACK_MS = 1500;

/**
 * Précharge les pages une fois la première rendue et le fil libre, dans l'ordre
 * où l'utilisateur y va le plus : Sessions, Enregistrer, les
 * analyses, puis le reste ; un morceau à la fois, pour ne pas peser sur le
 * premier rendu. Une page ouverte entre-temps ne l'attend pas : `React.lazy`
 * la charge lui-même.
 */
const preloadPages = (): (() => void) => {
  const order: (keyof typeof loaders)[] = [
    'SessionsPage', 'RecordingPage', 'SailingModule', 'SurfModule', 'StatisticsPage',
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
 * Anciennes adresses des bibliothèques Voile et Surf (`/voile`, `/surf`) : la page Sessions, filtre d'activité gardé ;
 * leur vue des itinéraires (`?vue=planifiees`), la liste des itinéraires.
 */
function FormerLibrary() {
  const [params] = useSearchParams();
  if (params.get('vue') === 'planifiees') return <Navigate to="/itineraires/liste" replace />;
  return <Navigate to={sessionsPath(params.get('activite'))} replace />;
}

/** Une recharge mène toujours au Profil : après une reprise silencieuse, retour sur Enregistrer. */
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
 * la page Sessions). Le compte rendu de l'enregistreur reste pour l'analyse, qui y reconnaît sa propre fin
 * d'enregistrement : le message (avertissement de l'arrêt, ménage en échec) qu'elle montre, le rappel du matériel. Rien ne s'ouvre si le rangement échoue (la carte de la session sert de filet), si la session n'est
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
      // Le compte rendu reste, marqué ouvert : l'analyse y lit sa propre fin d'enregistrement (avertissement, rappel
      // du matériel) et l'efface elle-même.
      markRecorderResultOpened();
      // Depuis Enregistrer, l'analyse prend sa place dans l'historique.
      const fromRecording = where.current.replace(/\/+$/, '') === '/enregistrer';
      navigate(analysisPath(sportFamily(saved.sport), saved.libraryFile), { replace: fromRecording });
    });
  }, [pending, navigate]);
  return null;
}

/**
 * Liaison sans fil avec l'ordinateur : tentée seule à l'ouverture et à chaque retour au premier plan, sans rien
 * afficher hors de Réglages › Mémoire (`useComputerLinkLauncher`).
 */
function ComputerLinkLauncher() {
  useComputerLinkLauncher();
  return null;
}

function App() {
  useEffect(preloadPages, []);
  return (
    <Router>
      <ComputerLinkLauncher />
      <LandOnRecording />
      <FinishRecording />
      <Routes>
        {/* Toutes les pages dans le même cadre : navigation et bandeau d'enregistrement. */}
        <Route element={<AppShell />}>
          {/* L'application s'ouvre sur le Profil ; la page Sessions liste les sessions des deux familles. */}
          <Route path="/" element={<Navigate to={PROFILE_PATH} replace />} />
          <Route path={PROFILE_PATH} element={<ProfilePage />} />
          <Route path={SESSIONS_PATH} element={<SessionsPage />} />
          {/* Chaque famille : son module d'analyse ouvert sur une session (`?session=`), et l'ancienne adresse de sa bibliothèque. */}
          <Route path="/voile" element={<FormerLibrary />} />
          <Route path="/voile/analyse" element={<SailingModule />} />
          <Route path="/surf" element={<FormerLibrary />} />
          <Route path="/surf/analyse" element={<SurfModule />} />
          <Route path="/enregistrer" element={<RecordingPage />} />
          <Route path="/itineraires" element={<PlanningPage />} />
          <Route path="/itineraires/liste" element={<RoutesPage />} />
          <Route path="/statistiques" element={<StatisticsPage />} />
          <Route path={RESTING_HR_PATH} element={<RestingHrTestPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          {/* Tutoriels : la liste, sous Réglages, et chaque leçon. */}
          <Route path="/tutoriels" element={<TutorialsPage />} />
          <Route path="/tutoriels/:id" element={<TutorialPage />} />
          {/* Développement seulement : une page qui lève au rendu, pour essayer la limite d'erreur au banc. */}
          {import.meta.env.DEV && <Route path="/essai/erreur" element={<DevThrow />} />}
          {/* Toute autre adresse mène au Profil, au lieu d'une page vide. */}
          <Route path="*" element={<Navigate to={PROFILE_PATH} replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
