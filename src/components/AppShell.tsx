import { Suspense, lazy, useCallback, useEffect, useRef, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { RECORD_PATH, TAB_BAR, TOP_LINKS, alsoActiveOn, type NavDestination, type NavId } from '../core/navigation';
import { t } from '../core/i18n';
import { PROFILE_PATH, parentPage } from '../core/parentPage';
import { formatClock } from '../core/units';
import { useLongPress } from '../hooks/useLongPress';
import { togglePauseRecording, useRecorderStatus, useRecordingClock, type RecorderStatus } from '../hooks/useRecorder';
import { effectiveLongPressMs } from '../hooks/useSportSettings';
import { setBackNavigator } from '../platform/backButton';
import { lockOrientation } from '../platform/screen';
import { IconChart, IconList, IconPause, IconPlay, IconRoute, IconSettings, IconUser } from './icons';
import ErrorBoundary from './ErrorBoundary';
import { HelpProvider } from './Help';
import HoldDial from './ui/HoldDial';
import GongLogo from './GongLogo';
import ImportQuestion from './ImportQuestion';
import IncomingFileNotice from './IncomingFileNotice';

/**
 * Cadre de toutes les pages : navigation et bandeau d'enregistrement.
 *
 * Sur téléphone (moins de 768 px de large, ou tourné : `NARROW_QUERY`), une barre d'onglets en bas, en
 * cinq cases fixes, à la verticale à gauche sur le téléphone tourné, le bouton rond au milieu : Profil · Sessions ·
 * Enregistrer · Statistiques · Réglages. Les itinéraires s'ouvrent depuis la page
 * Sessions, dont la case reste allumée sur l'analyse d'une session. La barre du bas est noire, sa case allumée en vert vif ; le
 * bouton rond est vert vif au repos et en pause, rouge pendant un
 * enregistrement. En haut, le lien allumé est à l'encre, souligné.
 * Sur ordinateur, toutes les destinations dans une barre en haut (Profil, Sessions, Planifier, Statistiques,
 * Réglages), puis le bouton vert « Enregistrer ». L'ordre des deux barres vient de `core/navigation.ts`. Le logo
 * mène au Profil. Le choix se fait en CSS (`AppShell.css`), sans lecture de la
 * taille d'écran en JavaScript.
 *
 * Pendant un enregistrement, un bandeau rouge rappelle sur chaque page qu'il
 * tourne et ramène à la page d'enregistrement ; sa durée (`RecordingClock`)
 * et le bouton rond (`RecordButton`) suivent seuls l'horloge, pas le cadre. Un appui long sur le bouton du
 * milieu (2 s par défaut, réglable) met en pause ou relance, depuis n'importe
 * quelle page ; un appui court y ramène, comme au repos.
 */

/** Icône de chaque destination des barres. */
const NAV_ICON: Record<NavId, ComponentType<{ size?: number }>> = {
  profil: IconUser,
  sessions: IconList,
  planifier: IconRoute,
  statistiques: IconChart,
  reglages: IconSettings,
};

/**
 * Feuille de symboles des logos d'activité, lue à part pour ne pas alourdir l'ouverture : les logos restent vides le
 * temps de la lire. Montée une seule fois, ici, pour toutes les pages.
 */
const LogoSprite = lazy(() => import('./logos/LogoSprite'));

/**
 * Durée de l'enregistrement, seule abonnée à l'horloge : chaque position la
 * redessine, pas le cadre (bouton du haut, bandeau).
 */
function RecordingClock() {
  const { durationMs } = useRecordingClock(false);
  return <span className="num">{formatClock(durationMs)}</span>;
}

/**
 * Bouton rond du milieu de la barre du bas : sa description dit la durée, il
 * suit donc l'horloge, à part du cadre. L'appui long reste tenu par le cadre,
 * qui dessine aussi le grand cadran (`HoldDial`).
 */
function RecordButton({ status, pressingMs, handlers }: {
  status: RecorderStatus;
  pressingMs: number | null;
  handlers: ReturnType<typeof useLongPress>['handlers'];
}) {
  const { durationMs } = useRecordingClock(false);
  const navigate = useNavigate();
  const busy = status !== 'idle';
  const paused = status === 'paused';
  const clock = formatClock(durationMs);
  const canToggle = status === 'recording' || paused;
  return canToggle ? (
    // Un bouton, pas un lien : la WebView d'Android affiche l'adresse d'un lien tenu longtemps.
    <button
      type="button"
      aria-label={paused
        ? t('Enregistrement en pause, {clock} ; appui long : reprendre', { clock })
        : t('Enregistrement en cours, {clock} ; appui long : pause', { clock })}
      className={`shell-record shell-record--busy${paused ? ' shell-record--paused' : ''}`}
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e);
        if (!e.defaultPrevented) navigate(RECORD_PATH);
      }}>
      {paused ? <IconPlay size={24} strokeWidth={2.5} /> : <IconPause size={26} strokeWidth={3} />}
      {pressingMs !== null && (
        <svg className="shell-record__ring" viewBox="0 0 64 64" aria-hidden="true"
          style={{ '--press-ms': `${pressingMs}ms` } as React.CSSProperties}>
          <circle cx="32" cy="32" r="30" pathLength="100" />
        </svg>
      )}
    </button>
  ) : (
    <NavLink
      to={RECORD_PATH}
      aria-label={busy ? t('Enregistrement en cours, {clock}', { clock }) : t('Enregistrer')}
      className={`shell-record${busy ? ' shell-record--busy' : ''}`}>
      <span className={`ui-record-dot${busy ? ' ui-record-dot--stop' : ''}`} />
    </NavLink>
  );
}

/** Classe d'un lien des barres : `active` sur sa page, et sur celles où sa case reste allumée. */
const linkClass = (base: string, d: NavDestination, pathname: string) => ({ isActive }: { isActive: boolean }) =>
  isActive || alsoActiveOn(d.id, pathname) ? `${base} active` : base;

const tabLink = (d: NavDestination, pathname: string) => {
  const Icon = NAV_ICON[d.id];
  return (
    <NavLink key={d.to} to={d.to} className={linkClass('shell-tab', d, pathname)}>
      <Icon size={24} />
      <span>{d.label}</span>
    </NavLink>
  );
};

const topLink = (d: NavDestination, pathname: string) => (
  <NavLink key={d.to} to={d.to} className={linkClass('shell-toplink', d, pathname)}>
    {d.label}
  </NavLink>
);

function AppShell() {
  const status = useRecorderStatus();
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  // Touche retour d'Android : vers la page au-dessus, en remplaçant l'adresse (l'historique n'y sert plus).
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => setBackNavigator(() => {
    const to = parentPage(locationRef.current.pathname, locationRef.current.search);
    if (to === null) return false;
    navigate(to, { replace: true });
    return true;
  }), [navigate]);
  const busy = status !== 'idle';
  const paused = status === 'paused';
  const canToggle = status === 'recording' || paused;
  const onLongPress = useCallback(() => void togglePauseRecording(), []);
  const goHome = useCallback(() => navigate(PROFILE_PATH), [navigate]);
  const { pressingMs, handlers } = useLongPress(onLongPress, effectiveLongPressMs, canToggle);

  // Orientation figée par le cadenas d'Enregistrer : rendue libre à la fin de l'enregistrement.
  useEffect(() => {
    if (status === 'idle') lockOrientation(false);
  }, [status]);

  // Hauteur des bandeaux, sous laquelle se fixe ce qui tient à l'écran (carte d'un téléphone tourné).
  const bannersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bannersRef.current;
    if (!el) return undefined;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--shell-top', `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--shell-top');
    };
  }, []);

  return (
    <div className="shell">
      <div className="shell-field" aria-hidden="true" />
      <Suspense fallback={null}>
        <LogoSprite />
      </Suspense>
      <header className="shell-topbar">
        <Link to={PROFILE_PATH} className="shell-brand" aria-label="GONG Gtracker">
          <GongLogo className="shell-brand__mark" />
          <span className="shell-brand__name" aria-hidden="true">Gtracker</span>
        </Link>
        <nav aria-label={t('Navigation principale')} className="shell-toplinks">
          {TOP_LINKS.map((d) => topLink(d, pathname))}
        </nav>
        <div className="shell-topactions">
          <NavLink to={RECORD_PATH} className={`shell-toprecord${busy ? ' shell-toprecord--busy' : ''}`}>
            <span className={`ui-record-dot${busy ? ' ui-record-dot--stop' : ''}`} />
            {busy ? <RecordingClock /> : t('Enregistrer')}
          </NavLink>
        </div>
      </header>

      <div className="shell-banners" ref={bannersRef}>
        {busy && pathname !== RECORD_PATH && (
          <Link to={RECORD_PATH} className="shell-banner">
            <span className="shell-banner__dot" />
            <span className="shell-banner__text">{paused ? t('Enregistrement en pause') : t('Enregistrement en cours')}</span>
            <RecordingClock />
          </Link>
        )}
        <IncomingFileNotice />
      </div>

      <main className="shell-main">
        <HelpProvider resetKey={pathname}>
          {/* Une exception au rendu d'une page n'emporte ni la barre, ni les bandeaux, ni le bouton rond. */}
          <ErrorBoundary key={pathname} onHome={goHome}>
            {/* Pages chargées à la demande (`App.tsx`) : le temps de lire le morceau, la page est vide, barre et bandeaux restent. */}
            <Suspense fallback={<div className="ui-page" aria-busy="true" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </HelpProvider>
      </main>

      <nav aria-label={t('Navigation principale')} className="shell-tabbar">
        {TAB_BAR.before.map((d) => tabLink(d, pathname))}
        <div className="shell-tabbar__record">
          <RecordButton status={status} pressingMs={pressingMs} handlers={handlers} />
        </div>
        {TAB_BAR.after.map((d) => tabLink(d, pathname))}
      </nav>

      {pressingMs !== null && (
        // Le doigt cache l'anneau du bouton : le même remplissage, en grand, au milieu de l'écran.
        // Reprise : l'arc à l'encre, le vert vif ne se verrait pas sur la piste claire ; pause : le rouge de l'enregistrement.
        <HoldDial pressMs={pressingMs} color={paused ? 'var(--ink)' : 'var(--recording)'}
          icon={paused ? <IconPlay size={56} strokeWidth={2.5} /> : <IconPause size={56} strokeWidth={3} />}
          title={paused ? t('Reprise') : t('Pause')} hint={t('Maintenez le bouton')} />
      )}

      <ImportQuestion />
    </div>
  );
}

export default AppShell;
