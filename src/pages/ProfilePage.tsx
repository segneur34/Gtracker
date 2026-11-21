import { Suspense, lazy, useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import ActivityChart from '../components/ActivityChart';
import ErrorBoundary from '../components/ErrorBoundary';
import GongLogo from '../components/GongLogo';
import MemoryStatus from '../components/MemoryStatus';
import { PermissionsPrompt } from '../components/PermissionsStatus';
import { PhoneAppOffer } from '../components/PhoneAppCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import ProfilePrompt from '../components/ProfilePrompt';
import TutorialOfDay from '../components/TutorialOfDay';
import ProfileFavorites, { type FavoriteCell } from '../components/ProfileFavorites';
import { brushFrame } from '../components/brushFrame';
import { brushColorFor } from '../core/brushColor';
import { IconChevronRight } from '../components/icons';
import Button from '../components/ui/Button';
import { activityDisplayName, logoColor, type Activity } from '../core/activities';
import { activityLogo, type LogoId } from '../core/activityLogos';
import { DISTANCE_UNIT_SYMBOL, formatDecimal, formatDuration, toDisplayDistance, type DistanceUnit } from '../core/units';
import { sessionsPath } from '../core/parentPage';
import { useNarrowScreen } from '../hooks/useNarrowScreen';
import { useOpenSections } from '../hooks/useOpenSections';
import { useProfileSchool } from '../hooks/useProfileSchool';
import { DEFAULT_SCHOOL_STYLE } from '../core/schoolBasics';
import { athleteAvatar, athleteName, athleteSchoolHidden } from '../library/athleteProfile';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useLibraryFields } from '../hooks/useSessionLibrary';
import { useStoredRecord } from '../hooks/useStoredRecord';
import { useAppliedTheme, useThemedShade } from '../hooks/useTheme';
import { useNow } from '../hooks/useNow';
import { effectiveDistanceUnit, useVisibility } from '../hooks/useSportSettings';
import { useVisibleStatSessions } from '../hooks/useVisibleStatSessions';
import { activityShares, favoriteActivities, favoriteActivity, favoriteSpot } from '../library/profile';
import { phoneAppOfferGate, profilePromptGate } from '../library/profilePrompt';
import { inBounds, profilePeriodOf, statsPeriodBounds, statsTotals } from '../library/stats';
import { TUTORIAL_OF_DAY_VISIBLE, tutorialCardGate } from '../tutorials/tutorials';
import { OTHERS_COLOR } from '../components/chartStyle';
import './ProfilePage.css';
import { STORAGE_KEYS } from '../core/appIdentity';
import { dateLocale, t, tn } from '../core/i18n';

/**
 * Profil, la page où s'ouvre l'application : une période en un coup d'œil (`library/profile.ts`). En tête, une photo
 * (logo GONG et, dessous, le nom de l'application sans son G, en haut à gauche sur téléphone, « Live for it. » en bas à droite), puis, à cheval sur son
 * bord, la photo ronde (un dessin d'activité ou une image importée, choisis en la touchant ; sans
 * choix, un disque vide à silhouette) et dessous le bouton de période, « Bienvenue » et le pseudo. Puis les cartes d'ouverture
 * (mémoire à désigner, autorisations, invitation du profil), quand il y a lieu. Puis
 * la période, qui règle toute la page : semaine, 30 jours, 6 mois, année (les
 * bornes du graphe d'activités et des statistiques) ou depuis le début ; choix
 * retenu sur l'appareil. Puis les trois activités favorites (celles qui ont le
 * plus de temps, du plus grand logo au plus petit, avec leurs sessions et leur
 * distance) et la case du total des kilomètres ; la répartition du temps par activité en
 * anneau (le total au centre ; « Autres » se déplie dans le détail), et le
 * graphe d'activités de la même période. Sur ordinateur, « Vos activités » à droite à partir de 1000 px de large,
 * dessous en deçà (`ProfileActivities`, ni chargé ni monté sur téléphone).
 * Mêmes sessions que les statistiques : ni celles d'une activité ou d'une
 * famille cachée, ni celles à classer. Distance en km quelle que soit l'unité
 * des activités : une somme de toutes les familles ne tient qu'en une unité.
 *
 * Sous le contenu, de la photo au bas de la page, le banc de poissons et son eau (`components/fishSchool/`), qui
 * grandit à chaque session, toutes sessions comptées quelle que soit la période ; chargé à part.
 *
 * Les photos d'en-tête (`assets/profil/`) sont à GONG ou à ses photographes : leur accord est à obtenir avant toute
 * diffusion de l'application hors d'une démonstration faite à GONG.
 */

/** « Vos activités », sur ordinateur seulement : ses lignes et leurs vignettes ne pèsent pas sur le téléphone. */
const ProfileActivities = lazy(() => import('../components/ProfileActivities'));
/** Le banc de poissons et son eau, sous le contenu : son calcul et ses dessins ne se chargent qu'avec lui. */
const FishSchool = lazy(() => import('../components/fishSchool/FishSchool'));
/** Fenêtre des réglages de l'écran Profil : chargée au premier toucher de la photo, hors du paquet de l'ouverture. */
const ProfileSettingsWindow = lazy(() => import('../components/ProfileSettingsWindow'));


/** Période retenue sur l'appareil ; l'année au départ. */
interface ProfileView {
  periode: string;
}
const VIEW_NAMESPACE = STORAGE_KEYS.profil;
const VIEW_KEY = 'affichage';
const VIEW_DEFAULTS: ProfileView = { periode: 'annee' };

/** Détail par activité sous l'anneau : replié au départ, état retenu sur l'appareil. */
const DETAIL_DEFAULT = { detail: false };

/** Au-delà, les plus petites parts se regroupent en « Autres » : un anneau ne se lit plus. */
const MAX_SLICES = 6;
const OTHERS_KEY = '__autres';

/** Anneau : rayon médian et épaisseur, en unités du dessin (200 de côté). */
const RING_R = 78;
const RING_W = 26;
const RING_GAP = 2;

interface Slice {
  key: string;
  label: string;
  color: string;
  durationS: number;
  share: number;
  /** `null` : « Autres ». */
  activity: Activity | null;
}

const hoursText = (s: number): string => formatDuration(s * 1000);

/** Distance dans l'unité donnée, avec son symbole : une décimale sous 100, aucune au-delà (« 4,5 km », « 310 km »). */
const distanceText = (m: number, unit: DistanceUnit): string => {
  const v = toDisplayDistance(m, unit);
  const shownValue = v < 100 ? formatDecimal(v, 1).replace(/[,.]0$/, '') : Math.round(v).toLocaleString(dateLocale());
  return `${shownValue} ${DISTANCE_UNIT_SYMBOL[unit]}`;
};

const percentText = (share: number): string =>
  share > 0 && share < 0.01 ? '< 1 %' : `${Math.round(share * 100)} %`;

/** Pastille, nom, temps et part d'une ligne du détail. */
const LegendContent = ({ slice: s }: { slice: Slice }) => (
  <>
    <span className="profile-legend__dot" style={{ background: s.color }} />
    <span className="profile-legend__name">{s.label}</span>
    <span className="profile-legend__time num">{hoursText(s.durationS)}</span>
    <span className="profile-legend__share num">{percentText(s.share)}</span>
  </>
);

function ProfilePage() {
  const navigate = useNavigate();
  const { status, sessions, scanning, error } = useLibraryFields('status', 'sessions', 'scanning', 'error');
  const narrow = useNarrowScreen();
  const { activities, isShown } = useVisibility();

  // Cartes d'ouverture : la mémoire d'abord (premier lancement, dossier inaccessible, erreur), puis les autorisations,
  // le profil, et la leçon du jour (en pause), chacune sans s'empiler sur les précédentes.
  const memoryNeedsAction = status === 'unavailable' || status === 'needs-permission' || error !== null;
  /** La carte des autorisations paraît-elle ? `null` tant qu'elle n'a pas lu les autorisations. */
  const [permissionsShown, setPermissionsShown] = useState<boolean | null>(null);
  const gate = profilePromptGate({ memoryNeedsAction, memoryReady: status === 'ready', permissionsShown });
  /** Le pop-up du profil s'ouvre-t-il ? `null` tant qu'il n'a pas tranché. */
  const [profileShown, setProfileShown] = useState<boolean | null>(null);
  const tutorialGate = tutorialCardGate({ memoryNeedsAction, memoryReady: status === 'ready', permissionsShown, profileShown });

  /** « Bienvenue » au-dessus du nom ou pseudo de Réglages, « Bienvenue » seul sans lui. */
  const { profile } = useAthleteProfile();
  const name = athleteName(profile);
  const avatar = athleteAvatar(profile);
  /** Réglages de l'écran Profil ouverts sous l'en-tête : non retenu. */
  const [picking, setPicking] = useState(false);
  const nowMs = useNow();
  const { value: view, update: rememberView } = useStoredRecord<ProfileView>(VIEW_NAMESPACE, VIEW_KEY, VIEW_DEFAULTS);
  const period = profilePeriodOf(view.periode);
  const periodLabel = period === 'tout' ? t('Tout') : t('Année {year}', { year: new Date(nowMs).getFullYear() });
  const otherPeriodLabel = period === 'tout' ? t('Année {year}', { year: new Date(nowMs).getFullYear() }) : t('Tout');
  const [active, setActive] = useState<string | null>(null);
  /** Activités regroupées dans « Autres », dépliées sous sa ligne : non retenu. */
  const [othersOpen, setOthersOpen] = useState(false);
  const { open, toggle } = useOpenSections('profil', DETAIL_DEFAULT);

  // Sessions classées et visibles, avec les activités de base qu'elles emploient (nom et couleur).
  const { all, activityById } = useVisibleStatSessions();

  // Banc de poissons : toutes les sessions de la bibliothèque (ou le réglage d'essai), quelle que soit la période.
  const school = useProfileSchool(sessions, profile);
  /** « Aucun » poisson : ni banc ni eau, la couche n'est pas montée et les cadres gardent leur fond. */
  const schoolOn = school.sessions > 0 && !athleteSchoolHidden(profile);
  /** Le banc est dessiné, voile des cadres compris : les cadres deviennent transparents. */
  const [schoolShown, setSchoolShown] = useState(false);

  const inPeriod = useMemo(() => {
    const bounds = statsPeriodBounds(period, nowMs);
    return all.filter((s) => inBounds(s.startMs, bounds));
  }, [all, period, nowMs]);
  const totals = useMemo(() => statsTotals(inPeriod), [inPeriod]);
  const activityOrder = useMemo(() => activities.map((a) => a.id), [activities]);

  const shown = useThemedShade();
  const shownLogoColor = useCallback((logo: LogoId) => shown(logoColor(logo, activities)), [shown, activities]);
  const { slices, others } = useMemo((): { slices: Slice[]; others: Slice[] } => {
    const shares = activityShares(inPeriod, activityOrder).filter((s) => s.totals.durationS > 0);
    const ofShare = (s: (typeof shares)[number]): Slice => {
      const a = activityById.get(s.activityId) ?? null;
      return { key: s.activityId, label: a ? activityDisplayName(a) : s.activityId, color: a ? shown(a.color) : OTHERS_COLOR, durationS: s.totals.durationS, share: s.share, activity: a };
    };
    if (shares.length <= MAX_SLICES) return { slices: shares.map(ofShare), others: [] };
    const rest = shares.slice(MAX_SLICES - 1);
    return {
      slices: [
        ...shares.slice(0, MAX_SLICES - 1).map(ofShare),
        {
          key: OTHERS_KEY, label: t('Autres ({n})', { n: rest.length }), color: OTHERS_COLOR, activity: null,
          durationS: rest.reduce((n, s) => n + s.totals.durationS, 0), share: rest.reduce((n, s) => n + s.share, 0),
        },
      ],
      others: rest.map(ofShare),
    };
  }, [inPeriod, activityOrder, activityById, shown]);
  const favoriteId = useMemo(() => favoriteActivity(inPeriod, activityOrder), [inPeriod, activityOrder]);
  const favorite = favoriteId ? activityById.get(favoriteId) ?? null : null;
  // Sport préféré de toutes les sessions, qui ne change pas avec la période : donne l'unité de distance quand la période est vide.
  const overallFavoriteId = useMemo(() => favoriteActivity(all, activityOrder), [all, activityOrder]);
  const overallFavorite = overallFavoriteId ? activityById.get(overallFavoriteId) ?? null : null;
  const openLibrary = (a: Activity) => navigate(sessionsPath(a.id));

  /** Toucher une part l'éclaire ; « Autres » ouvre aussi le détail et y déplie ses activités. */
  const pickSlice = (key: string) => {
    if (key === OTHERS_KEY && active !== key) {
      if (!open.detail) toggle('detail');
      setOthersOpen(true);
    }
    setActive(active === key ? null : key);
  };

  // Distance dans l'unité de l'activité la plus pratiquée de la période (sinon de toutes), le kilomètre à défaut.
  const practised = favorite ?? overallFavorite;
  const distanceUnit = practised ? effectiveDistanceUnit(practised) : 'km';
  // Les trois activités favorites, chacune avec sa distance dans l'unité de son activité.
  const favoriteCells = useMemo((): FavoriteCell[] => favoriteActivities(inPeriod, activityOrder).flatMap((f) => {
    // Une activité supprimée garde ses sessions sous son calcul : `activityById` porte cette activité de base (nom et logo).
    const a = activityById.get(f.activityId);
    if (!a) return [];
    return [{
      key: a.id, name: activityDisplayName(a), logo: activityLogo(a), color: shown(a.color),
      sessions: f.totals.sessions, distance: distanceText(f.totals.distanceM, effectiveDistanceUnit(a)),
      // Une activité cachée par l'œil de Réglages n'a pas de filtre dans Sessions : le lien y mène sans filtre.
      to: sessionsPath(isShown(a) ? a.id : null),
    }];
  }), [inPeriod, activityOrder, activityById, shown, isShown]);
  // Le spot préféré : le lieu de départ qui revient le plus dans les mêmes sessions que les activités favorites.
  const spot = useMemo(() => favoriteSpot(inPeriod), [inPeriod]);
  // Coup de pinceau des cadres : la couleur de la première favorite de la période (l'encre sans session), vue du thème.
  const dark = useAppliedTheme().theme === 'dark';
  const brushColor = useMemo(() => {
    const first = favoriteActivities(inPeriod, activityOrder)[0];
    const a = first ? activityById.get(first.activityId) : undefined;
    return a ? brushColorFor(a.color, dark) : 'var(--ink)';
  }, [inPeriod, activityOrder, activityById, dark]);
  // Un cadre par rang dans la page : favoris, répartition, graphe ; l'ouverture tourne de l'un à l'autre.
  const frames = useMemo(
    () => ({ favs: brushFrame(0, brushColor), split: brushFrame(1, brushColor), chart: brushFrame(2, brushColor) }),
    [brushColor]
  );
  /** Couleur du pinceau des cartes d'ouverture, posée sur leur conteneur. */
  const openersStyle = useMemo(() => ({ '--brush': brushColor }) as CSSProperties, [brushColor]);
  const activeSlice = slices.find((s) => s.key === active) ?? null;

  // Anneau : chaque part est un arc du même cercle, en trait épais, à partir du haut, dans le sens des aiguilles.
  const circumference = 2 * Math.PI * RING_R;
  const arcs = slices.map((s, i) => {
    const len = s.share * circumference;
    const gap = slices.length > 1 ? Math.min(RING_GAP, len / 2) : 0;
    const before = slices.slice(0, i).reduce((n, p) => n + p.share, 0) * circumference;
    return { slice: s, dash: `${Math.max(0, len - gap)} ${circumference}`, offset: -before };
  });

  /** Le Profil lui-même : la colonne de gauche sur ordinateur, la page entière sur téléphone. */
  const column = (
    <div className="ui-page profile">
      <header className="profile-head">
        {/* La photo ronde, et dessous, dans son ovale au pinceau, le bouton de la période de toute la page. */}
        <div className="profile-head__side">
          <button type="button" className="profile-head__avatar" aria-expanded={picking}
            aria-label={t('Photo de profil : ouvrir les réglages du Profil')}
            onClick={() => setPicking(!picking)}>
            <ProfileAvatar avatar={avatar} logoColor={shownLogoColor} />
          </button>
          <Button className="profile-periods brush-oval" aria-label={t('Période : {period}. Toucher pour afficher : {other}.', { period: periodLabel, other: otherPeriodLabel })}
            onClick={() => rememberView({ periode: period === 'tout' ? 'annee' : 'tout' })}>
            {period === 'tout' ? t('Tout') : String(new Date(nowMs).getFullYear())}
          </Button>
        </div>
        <div className="profile-head__main">
          <div className="profile-head__text">
            {name !== null && <span className="profile-head__hello">{t('Bienvenue')}</span>}
            <h1 className="profile-head__title">{name ?? t('Bienvenue')}</h1>
          </div>
        </div>
      </header>
      {picking && (
        <Suspense fallback={null}>
          <ProfileSettingsWindow onClose={() => setPicking(false)} />
        </Suspense>
      )}

      {/* Cartes d'ouverture, peintes comme les autres cadres : un conteneur sans boîte (`display: contents`). */}
      <div className="profile-openers brush-frames" style={openersStyle}>
        {memoryNeedsAction && <MemoryStatus />}
        {/* Le dossier de la mémoire d'abord, puis les autorisations (téléphone seulement, s'il en manque). */}
        {!memoryNeedsAction && status === 'ready' && <PermissionsPrompt onDecided={setPermissionsShown} />}
        {TUTORIAL_OF_DAY_VISIBLE && <TutorialOfDay gate={tutorialGate} />}
      </div>
      {/* Puis le profil, s'il manque un champ, une fois par lancement ; jamais par-dessus ces deux cartes. */}
      {gate.mount && <ProfilePrompt otherCardShown={gate.otherCardShown} onDecided={setProfileShown} />}
      {/* Programme Windows : l'application du téléphone qu'il emporte, proposée une fois par version, après toutes les
          autres cartes d'ouverture et jamais par-dessus l'une d'elles. */}
      {phoneAppOfferGate({ memoryNeedsAction, memoryReady: status === 'ready', permissionsShown, profileShown }) && <PhoneAppOffer />}

      {!memoryNeedsAction && <MemoryStatus compact />}

      {status === 'opening' ? (
        <p className="ui-hint">{t('Lecture de la mémoire…')}</p>
      ) : (
        <>
          {scanning && <p className="ui-hint">{t('Fiches en cours de calcul ({done} / {total}) : chiffres provisoires.', { done: scanning.done, total: scanning.total })}</p>}

          <ProfileFavorites cells={favoriteCells} total={distanceText(totals.distanceM, distanceUnit)} frame={frames.favs} spot={spot} />

          {slices.length > 0 && (
            <section className={`profile-split ui-card-col ${frames.split.className}`} style={frames.split.style} aria-label={t('Répartition par activité')}>
              <h2 className="profile-card__title">{t('Répartition du temps')}</h2>
              <div className="profile-split__body">
                <div className="profile-donut">
                  <svg viewBox="0 0 200 200" role="img" aria-label={t('Part de chaque activité dans le temps de la période')}>
                    {/* Bords gris de l'anneau, juste dehors : une part blanche se voit sur blanc, une noire sur noir. */}
                    {[RING_R - RING_W / 2 - 0.5, RING_R + RING_W / 2 + 0.5].map((r) => (
                      <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--line-strong)" strokeWidth={1} />
                    ))}
                    <g transform="rotate(-90 100 100)" onMouseLeave={() => setActive(null)}>
                      {arcs.map(({ slice, dash, offset: o }) => (
                        <circle key={slice.key} cx="100" cy="100" r={RING_R} fill="none" stroke={slice.color} strokeWidth={RING_W}
                          strokeDasharray={dash} strokeDashoffset={o}
                          opacity={active === null || active === slice.key ? 1 : 0.35}
                          onMouseEnter={() => setActive(slice.key)} onClick={() => pickSlice(slice.key)} />
                      ))}
                    </g>
                  </svg>
                  <div className="profile-donut__center">
                    <span className="profile-donut__label">{activeSlice ? activeSlice.label : t('Total')}</span>
                    <span className="profile-donut__value num">{hoursText(activeSlice ? activeSlice.durationS : totals.durationS)}</span>
                    {activeSlice && <span className="profile-donut__label num">{percentText(activeSlice.share)}</span>}
                  </div>
                </div>
                <div className="profile-split__detail">
                  <button type="button" className="profile-fold" aria-expanded={open.detail} onClick={() => toggle('detail')}>
                    <span className="profile-fold__label">{t('Par activité')}</span>
                    <span className="profile-fold__meta num">{tn(slices.length, '{n} activité', '{n} activités')}</span>
                    <IconChevronRight size={16} className="profile-fold__chevron" style={{ transform: `rotate(${open.detail ? -90 : 90}deg)` }} />
                  </button>
                  {open.detail && (
                    <ul className="profile-legend">
                      {slices.flatMap((s) => {
                        const row = (
                          <li key={s.key} onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)}
                            className={active === s.key ? 'is-active' : undefined}>
                            {s.activity ? (
                              <button type="button" className="profile-legend__row" onClick={() => openLibrary(s.activity!)}>
                                <LegendContent slice={s} />
                              </button>
                            ) : (
                              <button type="button" className="profile-legend__row" aria-expanded={othersOpen}
                                onClick={() => setOthersOpen(!othersOpen)}>
                                <LegendContent slice={s} />
                                <IconChevronRight size={14} className="profile-fold__chevron" style={{ transform: `rotate(${othersOpen ? -90 : 90}deg)` }} />
                              </button>
                            )}
                          </li>
                        );
                        if (s.key !== OTHERS_KEY || !othersOpen) return [row];
                        // Sous « Autres », ses activités en retrait ; leur survol éclaire sa part de l'anneau.
                        return [row, ...others.map((o) => (
                          <li key={o.key} className={`profile-legend__sub${active === OTHERS_KEY ? ' is-active' : ''}`}
                            onMouseEnter={() => setActive(OTHERS_KEY)} onMouseLeave={() => setActive(null)}>
                            {o.activity ? (
                              <button type="button" className="profile-legend__row" onClick={() => openLibrary(o.activity!)}>
                                <LegendContent slice={o} />
                              </button>
                            ) : (
                              <div className="profile-legend__row"><LegendContent slice={o} /></div>
                            )}
                          </li>
                        ))];
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {sessions.length > 0 && <ActivityChart key={period} period={period} nowMs={nowMs} frame={frames.chart} />}
    </div>
  );

  return (
    <div className={schoolOn && schoolShown ? 'profile-page profile-page--school' : 'profile-page'}>
      {/* Décoratif : un morceau qui ne se charge pas (hors ligne) ou une erreur n'enlèvent que le banc, les cadres
          gardent leur fond. */}
      {schoolOn && (
        <ErrorBoundary silent>
          <Suspense fallback={null}>
            <FishSchool fishPerSession={school.fish} colors={school.colors} style={profile.schoolStyle ?? DEFAULT_SCHOOL_STYLE}
              ready={status === 'ready' && !scanning} onShown={setSchoolShown} />
          </Suspense>
        </ErrorBoundary>
      )}
      {/* Photo d'en-tête, posée en fond par le CSS : celle de l'écran seule se télécharge, aucune en économe. */}
      <div className="profile-hero">
        <span className="profile-hero__brand">
          <GongLogo className="profile-hero__mark" />
          <span className="profile-hero__name">tracker</span>
        </span>
        <p className="profile-hero__motto">Live for it.</p>
      </div>
      <div className={narrow ? 'profile-body' : 'profile-body profile-body--columns'}>
        {column}
        {!narrow && (
          <Suspense fallback={null}>
            <ProfileActivities />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
