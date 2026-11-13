import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ActivityBubbles from '../components/ActivityBubbles';
import { useHelp } from '../components/helpContext';
import { IconChevronDown, IconChevronUp, IconFlag, IconHelp, IconRoute } from '../components/icons';
import ImportButtons from '../components/ImportButtons';
import MemoryStatus from '../components/MemoryStatus';
import { PermissionsPrompt } from '../components/PermissionsStatus';
import ProfilePrompt from '../components/ProfilePrompt';
import RefreshLibraryButton from '../components/RefreshLibraryButton';
import SessionRow from '../components/SessionRow';
import TutorialOfDay from '../components/TutorialOfDay';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import MoreMenu from '../components/ui/MoreMenu';
import SegmentedControl from '../components/ui/SegmentedControl';
import { plural } from '../core/basics';
import { findActivity, sessionActivity, type Activity } from '../core/activities';
import { STORAGE_KEYS } from '../core/appIdentity';
import { sessionFamily } from '../core/parentPage';
import { SPORT_FAMILIES } from '../core/sportProfiles';
import { useRetainedScroll } from '../hooks/useRetainedScroll';
import { useRouteLibrary } from '../hooks/useRouteLibrary';
import { useLibraryFields } from '../hooks/useSessionLibrary';
import { effectiveDistanceUnit, useVisibility } from '../hooks/useSportSettings';
import { previewImageStore } from '../library/previewImageStore';
import { previewStore } from '../library/previewStore';
import { profilePromptGate } from '../library/profilePrompt';
import type { LibrarySession } from '../library/record';
import { SESSION_SORTS, SESSION_SORT_DEFAULT, isSessionSort, sortSessions, type SessionSort } from '../library/sessionSort';
import { commonDistanceUnit, filterChoices, filterSessions, ofActivity, sessionsTotals, totalsLine } from '../library/sessionsList';
import { shownRoutes } from '../planning/routeShown';
import { isNativeApp } from '../platform/runtime';
import { jsonStore } from '../platform/storage';
import { TUTORIAL_OF_DAY_VISIBLE, tutorialCardGate } from '../tutorials/tutorials';
import './SessionsPage.css';

/**
 * Page Sessions : toutes les sessions de la mémoire, voile et surf ensemble. En tête, les cartes de la mémoire, des
 * autorisations et du profil quand il y a lieu ; le titre et son « … » (imports, mise à jour) ; la ligne des totaux
 * de la liste et « Tris » ; la rangée des activités visibles, en logos, qui filtre la liste (`?activite=<id>`, gardé
 * dans l'adresse pour le retour d'une analyse) ; les sessions à classer ; la liste ; puis « Créer un parcours » et les
 * itinéraires planifiés.
 *
 * Les sessions d'une activité cachée dans Réglages ne sont pas dans « Toutes », une ligne dit combien ; son adresse
 * (`?activite=` d'une activité cachée) les montre.
 */

/**
 * Résumés refaits en tâche de fond (version du calcul, réglage d'activité changé) : une
 * ligne tant qu'il en reste, lue à part pour que le compteur ne redessine pas la liste.
 */
function OutdatedSummaries() {
  const { toUpdate } = useLibraryFields('toUpdate');
  if (toUpdate <= 0) return null;
  return <p className="ui-hint ui-hint--m">{plural(toUpdate, 'session')} à mettre à jour</p>;
}

/** Tri choisi, propre à l'appareil. */
const SORT_KEY = STORAGE_KEYS.triBibliotheque;
const readSort = (): SessionSort => {
  const stored = jsonStore.read<{ sort?: unknown }>(SORT_KEY)?.sort;
  return isSessionSort(stored) ? stored : SESSION_SORT_DEFAULT;
};

/** Vignettes gardées des sessions disparues déjà oubliées dans ce lancement. */
let previewsPruned = false;

/** Famille d'une session pour son module et sa vignette ; une session à classer prend la première. */
const rowFamily = (session: LibrarySession) => sessionFamily(session, SPORT_FAMILIES[0]);

function SessionsPage() {
  // Les champs lus seulement : ni le compteur du balayage ni les messages ne redessinent la liste.
  const library = useLibraryFields('sessions', 'status', 'scanning', 'folderLabel', 'error');
  // Une fois par lancement, la mémoire complète : les vignettes gardées des sessions qu'elle ne porte plus sont oubliées.
  // Vide, elle n'oublie rien (dossier mémoire mal ouvert) : la borne du magasin finit par les écarter.
  const complete = library.status === 'ready' && library.scanning === null && library.sessions.length > 0;
  useEffect(() => {
    if (!complete || previewsPruned) return;
    previewsPruned = true;
    const files = library.sessions.map((s) => s.file);
    void previewStore.prune(library.folderLabel, files);
    void previewImageStore.prune(library.folderLabel, files);
  }, [complete, library.folderLabel, library.sessions]);

  // Cartes d'ouverture : la mémoire d'abord (premier lancement, dossier inaccessible, erreur), puis les autorisations,
  // le profil, et la leçon du jour (en pause), chacune sans s'empiler sur les précédentes.
  const memoryNeedsAction = library.status === 'unavailable' || library.status === 'needs-permission' || library.error !== null;
  /** La carte des autorisations paraît-elle ? `null` tant qu'elle n'a pas lu les autorisations. */
  const [permissionsShown, setPermissionsShown] = useState<boolean | null>(null);
  const gate = profilePromptGate({ memoryNeedsAction, memoryReady: library.status === 'ready', permissionsShown });
  /** Le pop-up du profil s'ouvre-t-il ? `null` tant qu'il n'a pas tranché. */
  const [profileShown, setProfileShown] = useState<boolean | null>(null);
  const tutorialGate = tutorialCardGate({ memoryNeedsAction, memoryReady: library.status === 'ready', permissionsShown, profileShown });

  const { activities, isShown, shownActivities } = useVisibility();
  const { routes: allRoutes, loaded: routesLoaded } = useRouteLibrary();
  const routes = useMemo(() => shownRoutes(allRoutes, activities, isShown), [allRoutes, activities, isShown]);
  const [params, setParams] = useSearchParams();
  // Le filtre d'activité vit dans l'adresse : il survit à une analyse ouverte puis fermée.
  const filterId = params.get('activite');
  const selected = useMemo(() => findActivity(activities, filterId), [activities, filterId]);
  const setFilter = (next: string | null) => setParams((current) => {
    const updated = new URLSearchParams(current);
    if (next === null) updated.delete('activite');
    else updated.set('activite', next);
    return updated;
  }, { replace: true });
  const folderHelp = useHelp('biblio:dossier');
  const helpOpen = folderHelp?.open ?? false;
  const [confirmFile, setConfirmFile] = useState<string | null>(null);
  const cancelDelete = useCallback(() => setConfirmFile(null), []);

  /** Activité de chaque session, calculée une fois par liste ; `null` pour une session à classer. */
  const activityByFile = useMemo(
    () => new Map(library.sessions.map((s) => [s.file, sessionActivity(activities, s.record.activityId, s.record.sport)])),
    [library.sessions, activities]
  );
  const activityOf = useCallback((s: LibrarySession): Activity | null => activityByFile.get(s.file) ?? null, [activityByFile]);
  /** « Toutes » : les sessions des activités montrées, et le nombre de celles des activités cachées. */
  const everything = useMemo(() => filterSessions(library.sessions, activityOf, isShown, null), [library.sessions, activityOf, isShown]);
  const listed = useMemo(
    () => (selected ? filterSessions(library.sessions, activityOf, isShown, selected.id).listed : everything.listed),
    [selected, library.sessions, activityOf, isShown, everything]
  );
  const unclassified = useMemo(() => library.sessions.filter((s) => s.record.sport === null), [library.sessions]);
  const shownList = useMemo(() => shownActivities(), [shownActivities]);
  const choices = useMemo(
    () => filterChoices(shownList, everything.listed.map(activityOf), selected),
    [shownList, everything, activityOf, selected]
  );
  const totals = useMemo(() => {
    const units = listed.map((s) => activityOf(s)).filter((a): a is Activity => a !== null).map(effectiveDistanceUnit);
    return totalsLine(sessionsTotals(listed), commonDistanceUnit(units), selected?.name ?? null);
  }, [listed, activityOf, selected]);

  const [sort, setSortState] = useState<SessionSort>(readSort);
  const setSort = (next: SessionSort) => {
    setSortState(next);
    jsonStore.write(SORT_KEY, { sort: next });
  };
  const [sortOpen, setSortOpen] = useState(false);
  const shown = useMemo(() => sortSessions(listed, sort), [listed, sort]);
  const native = isNativeApp();
  // La liste se rouvre là où on l'a laissée en revenant d'une analyse.
  useRetainedScroll('sessions', library.status !== 'opening');

  const fromActivityId = selected?.id ?? null;
  const row = (session: LibrarySession) => (
    <SessionRow
      key={session.file}
      session={session}
      activity={activityOf(session)}
      activities={activities}
      family={rowFamily(session)}
      fromActivityId={fromActivityId}
      folderLabel={library.folderLabel}
      confirming={confirmFile === session.file}
      onAskDelete={setConfirmFile}
      onCancelDelete={cancelDelete} />
  );
  const settled = library.status === 'ready' && !library.scanning;

  return (
    <div className="ui-page sessions-page">
      {memoryNeedsAction && <MemoryStatus />}
      {/* Le dossier de la mémoire d'abord, puis les autorisations (téléphone seulement, s'il en manque). */}
      {!memoryNeedsAction && library.status === 'ready' && <PermissionsPrompt onDecided={setPermissionsShown} />}
      {/* Puis le profil, s'il manque un champ, une fois par lancement ; jamais par-dessus ces deux cartes. */}
      {gate.mount && <ProfilePrompt otherCardShown={gate.otherCardShown} onDecided={setProfileShown} />}
      {TUTORIAL_OF_DAY_VISIBLE && <TutorialOfDay gate={tutorialGate} />}

      <header className="sessions-head">
        <div className="sessions-head__line">
          <h1 className="sessions-head__title">Sessions</h1>
          {/* Imports et mise à jour, de moindre usage : derrière « … », pour que la liste vienne tout de suite. */}
          <MoreMenu label="Importer, mettre à jour">
            {library.status === 'ready' && (
              <span className="ui-more__note">
                Mémoire : {library.folderLabel ?? 'ce navigateur'}, {library.sessions.length} session{library.sessions.length > 1 ? 's' : ''} en tout
              </span>
            )}
            <ImportButtons />
            <RefreshLibraryButton />
            <Button aria-expanded={helpOpen} onClick={() => folderHelp?.toggle()}>
              <IconHelp size={18} />
              À quoi sert « Ajouter les sessions d'un dossier » ?
            </Button>
          </MoreMenu>
        </div>
        <div className="sessions-head__line">
          <p className="sessions-head__totals num">{totals}</p>
          <button type="button" className="ui-tab sessions-head__sort" aria-expanded={sortOpen}
            onClick={() => setSortOpen((open) => !open)}>
            Tris {sortOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </button>
        </div>
        {sortOpen && (
          <SegmentedControl<SessionSort> label="Trier les sessions" className="sessions-head__choice"
            items={SESSION_SORTS} value={sort} onChange={setSort} />
        )}
      </header>

      {!memoryNeedsAction && <MemoryStatus compact />}
      <OutdatedSummaries />
      {helpOpen && (
        <p className="ui-hint ui-hint--m">
          {native
            ? "« Ajouter les sessions d'un dossier » reprend celles d'un dossier Gtracker copié depuis le PC ou un autre téléphone, notes comprises. On peut aussi copier les fichiers directement dans Documents › Gtracker › sessions : ils apparaissent avec « Mettre à jour », ou au lancement suivant. Un dossier qui contient plusieurs activités de montre (fichiers .fit) demande confirmation : si la montre est prêtée, copiez d'abord vos seuls fichiers dans un dossier, ou choisissez-les un par un avec « Importer des GPX ou FIT »."
            : "« Ajouter les sessions d'un dossier » reprend celles d'un dossier Gtracker copié depuis le téléphone ou un autre PC, notes comprises. Chrome demande alors s'il faut importer les fichiers « sur ce site » : ils restent sur ce PC, Gtracker n'envoie rien sur internet. Le dossier mémoire de ce PC, lui, se choisit dans Réglages › Mémoire ; des fichiers copiés dedans pendant que Gtracker est ouvert apparaissent avec « Mettre à jour ». Un dossier qui contient plusieurs activités de montre (fichiers .fit) demande confirmation : si la montre est prêtée, copiez d'abord vos seuls fichiers dans un dossier du PC, ou choisissez-les un par un avec « Importer des GPX ou FIT »."}
        </p>
      )}

      <div className="sessions-body">
        <ActivityBubbles total={everything.listed.length} choices={choices} selected={selected?.id ?? null} onSelect={setFilter} />

        {selected === null && everything.hidden > 0 && (
          <p className="ui-hint ui-hint--m">
            Activités cachées : {plural(everything.hidden, 'session')} en moins dans la liste.
            Elles se ré-affichent dans <Link to="/parametres">Réglages</Link>.
          </p>
        )}

        {unclassified.length > 0 && (
          <Card heading="À classer">
            <p className="ui-hint ui-hint--m">
              Traces dont l'activité n'est pas connue : choisissez-la pour les ranger en voile ou en surf. Ouvrir l'une d'elles la demande d'abord.
            </p>
            <ul className="lib-list">{unclassified.map(row)}</ul>
          </Card>
        )}

        {shown.length > 0 ? (
          <ul className="lib-list">{shown.map(row)}</ul>
        ) : (
          settled && (selected !== null || everything.hidden === 0) && (
            <p className="ui-hint ui-hint--m sessions-empty">
              {selected
                ? `Aucune session ${ofActivity(selected.name)} pour l'instant.`
                : 'Aucune session pour l\'instant. Enregistrez-en une, ou importez des GPX : ils sont rangés dans la mémoire et analysés ici.'}
            </p>
          )
        )}
      </div>

      <div className="sessions-actions">
        <Link to="/itineraires" className="ui-btn ui-btn--primary">
          <IconRoute size={18} /> Créer un parcours
        </Link>
        <Link to="/itineraires/liste" className="ui-btn ui-btn--secondary">
          <IconFlag size={18} /> Itinéraires{routesLoaded ? ` (${routes.length})` : ''}
        </Link>
      </div>
    </div>
  );
}

export default SessionsPage;
