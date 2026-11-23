import { useEffect, useState } from 'react';
import { licenseGroup, licensesForShell, mergeLicenseLists, parseLicenseList, type LicenseEntry } from '../core/licenses';
import { t, tn } from '../core/i18n';
import { fetchWithin } from '../planning/fetchJson';
import { appShell } from '../platform/runtime';
import { tRich } from './tRich';
import GongLogo from './GongLogo';
import Button from './ui/Button';
import SettingsPart from './SettingsPart';

/** Nombre de composants montrés dans le groupe « MIT, ISC, BSD » avant « Voir les N autres ». */
const LICENSES_PREVIEW = 3;
/** Fichiers servis avec l'application : le délai ne couvre qu'un serveur qui ne répondrait pas. */
const LOAD_TIMEOUT_MS = 10_000;
const UNAVAILABLE = t('Liste des licences indisponible.');
/** Page du droit d'auteur d'OpenStreetMap, due avec la mention de ses données. */
const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
/** Code source de la bibliothèque FFmpeg que le programme Windows reçoit de Chromium (LGPL 2.1). */
const FFMPEG_SOURCE_URL = 'https://chromium.googlesource.com/chromium/third_party/ffmpeg';

/** Liste rendue par `file`, à côté de l'application ; `null` si elle n'existe pas ou ne se lit pas. */
const loadList = (file: string, signal: AbortSignal): Promise<LicenseEntry[] | null> =>
  fetchWithin(
    `${import.meta.env.BASE_URL}${file}`,
    { signal },
    { noNetwork: UNAVAILABLE, timeout: UNAVAILABLE, timeoutMs: LOAD_TIMEOUT_MS },
    async (response) => (response.ok ? parseLicenseList(await response.text()) : null)
  ).catch(() => null);

/** Une ligne du composant, qui se déplie sur le texte de sa licence, dans une zone qui défile. */
function LicenseRow({ entry, open, onToggle }: { entry: LicenseEntry; open: boolean; onToggle: () => void }) {
  return (
    <li className="about-license">
      <button type="button" className="about-license__row" aria-expanded={open} onClick={onToggle}>
        <span className="about-license__name">
          {entry.name} <span className="about-license__version">{entry.version}</span>
        </span>
        <span className="about-license__id">{entry.identifier || t('Licence non indiquée')}</span>
      </button>
      {open && (
        <div className="about-license__text" tabIndex={0}>
          {entry.notice && <p>{entry.notice}</p>}
          {entry.url && <p><a href={entry.url} target="_blank" rel="noreferrer">{entry.url}</a></p>}
          {entry.components && <p>{entry.components.join(', ')}</p>}
          <pre>{entry.text || t('Le paquet ne fournit pas le texte de sa licence.')}</pre>
        </div>
      )}
    </li>
  );
}

/** Un groupe de licences ; `limit` n'en montre que les premières, le reste derrière « Voir les N autres ». */
function LicenseGroupList({ title, entries, limit, openKey, onToggle }: {
  title: string;
  entries: LicenseEntry[];
  limit?: number;
  openKey: string | null;
  onToggle: (key: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (entries.length === 0) return null;
  const shown = showAll || limit === undefined ? entries : entries.slice(0, limit);
  const hiddenCount = entries.length - shown.length;
  return (
    <>
      <p className="ui-eyebrow about-licenses__group">{title}</p>
      <ul className="about-licenses__list">
        {shown.map((entry) => {
          const key = `${entry.name}@${entry.version}`;
          return <LicenseRow key={key} entry={entry} open={openKey === key} onToggle={() => onToggle(key)} />;
        })}
      </ul>
      {hiddenCount > 0 && (
        <Button size="s" className="about-licenses__more" onClick={() => setShowAll(true)}>
          {tn(hiddenCount, "Voir l'autre", 'Voir les {n} autres', { n: hiddenCount }, hiddenCount !== 1)}
        </Button>
      )}
    </>
  );
}

/** Liste des licences, chargée au dépliage seulement : rien au démarrage de l'application. */
function LicensesList() {
  const [lists, setLists] = useState<{ built: LicenseEntry[] | null; extra: LicenseEntry[] | null } | null>(null);
  // Un composant ouvert à la fois : la page ne s'allonge que d'une zone de texte.
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([loadList('licences.json', controller.signal), loadList('licences-hors-js.json', controller.signal)]).then(([built, extra]) => {
      if (!controller.signal.aborted) setLists({ built, extra });
    });
    return () => controller.abort();
  }, []);

  if (!lists) return <p className="about-licenses__intro">{t('Chargement…')}</p>;
  // Le code Android n'est pas dans le programme Windows, ni Electron dans l'application du téléphone.
  const entries = licensesForShell(mergeLicenseLists(lists.built, lists.extra), appShell());
  if (entries.length === 0) return <p className="about-licenses__intro">{UNAVAILABLE}</p>;
  const toggle = (key: string) => setOpenKey((current) => (current === key ? null : key));
  return (
    <>
      <p className="about-licenses__intro">{t("Gtracker s'appuie sur ces composants. Touchez-en un pour lire sa licence.")}</p>
      {/* Sous `npm run dev` : Vite n'écrit la liste du JS qu'à la construction. */}
      {!lists.built && <p className="about-licenses__intro">{t('Liste complète dans la version construite.')}</p>}
      <LicenseGroupList title="MIT, ISC, BSD" entries={entries.filter((e) => licenseGroup(e.identifier) === 'permissive')} limit={LICENSES_PREVIEW} openKey={openKey} onToggle={toggle} />
      <LicenseGroupList title={t('Autres licences')}entries={entries.filter((e) => licenseGroup(e.identifier) === 'other')} openKey={openKey} onToggle={toggle} />
    </>
  );
}

/** Bloc « À propos » de Réglages : logo, version, où vont les données, et les licences des composants. */
function AboutSettings() {
  const [licensesOpen, setLicensesOpen] = useState(false);
  return (
    <div className="about">
      <div className="about__logo">
        <GongLogo className="about__logo-mark" />
        <span className="about__logo-name">Gtracker</span>
      </div>
      <p className="about__version">{t('Version {v}', { v: __APP_VERSION__ })}</p>
      <p className="about__text">
        {t('Vos sessions restent sur cet appareil et dans votre dossier mémoire, sans compte. Les fonds de carte et la recherche de lieux passent par des services en ligne.')}
      </p>
      <p className="about__text">
        {t("Le lieu qui nomme une session est cherché par le service Photon de komoot : il reçoit le point de départ de la session et, si la sortie finit ailleurs, son point d'arrivée, arrondis à une centaine de mètres, la langue et le rayon de recherche, rien d'autre (Réglages › Mémoire pour s'en passer).")}
      </p>
      <p className="about__text">
        {tRich("Données des cartes et des lieux : © les contributeurs d'OpenStreetMap, sous licence ODbL (<a>openstreetmap.org/copyright</a>).", undefined, {
          a: (children) => <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noreferrer">{children}</a>,
        })}
      </p>
      {appShell() === 'ordinateur' && (
        <p className="about__text">
          {tRich('Ce programme utilise des bibliothèques du projet FFmpeg sous LGPL 2.1 (code source : <a>chromium.googlesource.com/chromium/third_party/ffmpeg</a>).', undefined, {
            a: (children) => <a href={FFMPEG_SOURCE_URL} target="_blank" rel="noreferrer">{children}</a>,
          })}
        </p>
      )}
      <SettingsPart label={t('Licences des composants utilisés')} open={licensesOpen} onToggle={() => setLicensesOpen((o) => !o)}>
        <LicensesList />
      </SettingsPart>
    </div>
  );
}

export default AboutSettings;
