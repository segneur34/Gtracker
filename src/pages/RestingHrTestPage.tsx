import { dayMonthTime } from '../core/calendar';
import { t } from '../core/i18n';
import { tRich } from '../components/tRich';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HelpText, HelpToggle } from '../components/Help';
import RestingHrChart from '../components/RestingHrChart';
import { BluetoothSettingsButton } from '../components/BeltStatus';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { IconPlay } from '../components/icons';
import { formatMinSec } from '../core/units';
import { SETTINGS_PATH } from '../core/parentPage';
import { useRestingHrResults } from '../hooks/useRestingHrResults';
import { useRestingHrTest } from '../hooks/useRestingHrTest';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { BELT_STATE_LABEL } from '../platform/heartRate';
import { RESTING_HR_TEST, restingRemainingS } from '../recording/restingHrTest';
import { toStoredRestingResult, type StoredRestingResult } from '../library/restingHrStore';
import { restingHrSeries } from '../library/restingHrResults';
import './RestingHrTestPage.css';

const PROTOCOL = RESTING_HR_TEST;
/** Plage de la FC repos de Pratiquant (`useAthleteProfile`), pour proposer de la retenir. */
const RETAINABLE_BPM = [25, 120] as const;

/** Vitesse de l'exemple du navigateur : `?vitesse=10` (banc), 1 par défaut. */
const exampleSpeed = (search: string): number => {
  const v = Number(new URLSearchParams(search).get('vitesse'));
  return isFinite(v) && v >= 1 && v <= 60 ? v : 1;
};

const dateText = dayMonthTime;

/** Courbe d'un test gardé, à la demande : le graphe n'est monté que déplié. */
function StoredResultRow({ result, onRemove }: { result: StoredRestingResult; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const incomplete = result.coverage < PROTOCOL.minCoverage;
  return (
    <li className="rest-history__item">
      <span className="rest-history__text">
        <span className="rest-history__name">{result.lowestBpm} bpm</span>
        <span className="rest-history__detail">
          {dateText(result.startedAtMs)}
          {result.meanBpm !== null && ` · ${t('moyenne {bpm} bpm', { bpm: result.meanBpm })}`}
          {incomplete && ` · ${t('mesures sur {pct} % du temps', { pct: Math.round(result.coverage * 100) })}`}
        </span>
      </span>
      <span className="rest-history__actions">
        <Button size="s" onClick={() => setOpen((o) => !o)}>{open ? t('Masquer') : t('Courbe')}</Button>
        <Button size="s" variant="ghost" onClick={onRemove} aria-label={t('Retirer le test du {date}', { date: dateText(result.startedAtMs) })}>{t('Retirer')}</Button>
      </span>
      {open && (
        <div className="rest-history__chart">
          <RestingHrChart series={result.series} durationS={PROTOCOL.durationS} lowest={{ fromS: result.fromS, toS: result.toS, bpm: result.lowestBpm }} height={180} />
        </div>
      )}
    </li>
  );
}

/**
 * Test de FC repos, ouvert depuis Réglages (Pratiquant) : 3 minutes immobile, la FC lue sur
 * la ceinture, sans GPS ni enregistreur (`useRestingHrTest`). Le résultat est
 * la moyenne de 30 s la plus basse après la première minute, avec la courbe des 3 minutes ; on peut la
 * retenir comme FC repos de Pratiquant. Les tests faits restent sur l'appareil.
 */
function RestingHrTestPage() {
  const { search } = useLocation();
  const { results, add, remove } = useRestingHrResults();
  const { profile, retainHr } = useAthleteProfile();
  const { run, belt, beltChosen, native, error, start, cancel } = useRestingHrTest(
    (result, startedAtMs) => {
      const stored = toStoredRestingResult(result, startedAtMs, PROTOCOL);
      if (stored) add(stored);
    },
    { speed: exampleSpeed(search) }
  );

  const phase = run?.state.phase ?? null;
  const live = useMemo(
    () => (run && run.state.phase === 'mesure' ? restingHrSeries(run.state.samples, run.state.startMs, PROTOCOL) : []),
    // La courbe se refait à chaque mesure reçue, pas à chaque pas de la minuterie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run?.state.samples, run?.state.phase]
  );
  const result = run?.result ?? null;
  const retained = result?.lowestBpm != null && profile.hrRest === result.lowestBpm;
  const canRetain = result?.lowestBpm != null && result.lowestBpm >= RETAINABLE_BPM[0] && result.lowestBpm <= RETAINABLE_BPM[1];
  const beltReady = belt.state === 'connected' && belt.bpm !== null;
  const remainingS = run ? Math.ceil(restingRemainingS(run.state, run.nowMs)) : 0;

  return (
    <div className="ui-page rest-page" style={{ '--help-accent': 'var(--rest-accent)' } as React.CSSProperties}>
      <PageHeader title={t('FC repos')} back={{ to: SETTINGS_PATH, label: t('Réglages') }}
        subtitle={t('Trois minutes immobile, la FC lue sur la ceinture, sans GPS : la moyenne de {s} s la plus basse, après la première minute, est votre FC de repos.', { s: PROTOCOL.windowS })} />

      {native && !beltChosen && (
        <div className="ui-alert ui-alert--warning">
          {tRich('Aucune ceinture cardio choisie : choisissez-la dans <a>Réglages</a>, bloc « Connexion ».', undefined, { a: (c) => <Link to={SETTINGS_PATH}>{c}</Link> })}
        </div>
      )}
      {error && <div className="ui-alert ui-alert--danger">{error}</div>}

      {phase === null && (
        <>
          <Card heading={<>{t('Déroulé')}<HelpToggle helpKey="repos:deroule" label={t('Déroulé')} size="s" /></>}>
            <HelpText helpKey="repos:deroule" note>
              {t('Le téléphone reste allumé pendant le test ; aucun GPS ni enregistrement, rien ne peut le couper. Si la ceinture lâche, le test va quand même à son terme, et dit la part du temps mesurée.')}
            </HelpText>
            <ol className="rest-steps">
              <li>{tRich('<strong>Installez-vous</strong>, allongé ou assis, au calme, depuis quelques minutes (le matin au réveil est idéal), la ceinture posée et connectée.')}</li>
              <li>{tRich('<strong>« Démarrer »</strong> : {s} s pour vous poser, puis un bip court.', { s: PROTOCOL.leadInS })}</li>
              <li>{tRich('<strong>{min} min</strong> sans bouger ni parler, en respirant calmement. Un bip long à la fin.', { min: PROTOCOL.durationS / 60 })}</li>
              <li>{tRich('<strong>Résultat</strong> : la moyenne de {w} s la plus basse après les {settle} premières secondes (le temps que le cœur se pose), avec la courbe.', { w: PROTOCOL.windowS, settle: PROTOCOL.settleS })}</li>
            </ol>
          </Card>
          <Card heading={t('Mesure')}>
            {native ? (
              <p className="rest-belt">
                {tRich('Ceinture : {belt}', { belt: beltChosen ? <>{beltChosen.name}, {BELT_STATE_LABEL[belt.state]}</> : t('aucune') })}
                {beltReady && <strong className="rest-belt__bpm"> · {belt.bpm} bpm</strong>}
                {belt.state === 'connected' && belt.bpm === null && ` · ${t('pas de contact avec la peau')}`}
                {belt.state === 'searching' && <> <BluetoothSettingsButton /></>}
              </p>
            ) : (
              <p className="ui-hint">{t('Pas de ceinture dans le navigateur : l\'exemple joue une FC d\'exemple, pour voir le déroulé et le résultat.')}</p>
            )}
            <div className="rest-buttons">
              {native ? (
                <Button variant="primary" disabled={!beltReady} onClick={() => start(false)}>
                  <IconPlay size={18} />
                  {t('Démarrer')}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => start(true)}>
                  <IconPlay size={18} />
                  {t('Essayer avec une FC d\'exemple')}
                </Button>
              )}
              {native && !beltReady && <span className="ui-hint">{t('« Démarrer » attend la FC de la ceinture.')}</span>}
            </div>
          </Card>
        </>
      )}

      {phase === 'preparation' && run && (
        <Card heading={t('Installez-vous')}>
          <p className="rest-count" role="timer" aria-live="off">{remainingS} s</p>
          <p className="ui-hint">{t('Le bip court lance les {n} minutes.', { n: PROTOCOL.durationS / 60 })}{run.simulated && ` ${t('Exemple : FC simulée.')}`}</p>
          <div className="rest-buttons rest-actions"><Button onClick={cancel}>{t('Annuler')}</Button></div>
        </Card>
      )}

      {phase === 'mesure' && run && (
        <Card heading={t('Ne bougez pas')}>
          <div className="rest-live">
            <p className="rest-count" role="timer" aria-live="off">{formatMinSec(remainingS)}</p>
            <p className="rest-live__bpm">{run.bpm !== null ? <><strong>{run.bpm}</strong> bpm</> : t('pas de mesure')}</p>
          </div>
          <RestingHrChart series={live} durationS={PROTOCOL.durationS} />
          <p className="ui-hint">{t('Un bip long annoncera la fin.')}{run.simulated && ` ${t('Exemple : FC simulée.')}`}</p>
          <div className="rest-buttons rest-actions"><Button onClick={cancel}>{t('Annuler')}</Button></div>
        </Card>
      )}

      {phase === 'fini' && run && result && (
        <Card heading={<>{t('Résultat')}{result.fromS !== null && result.toS !== null && <HelpToggle helpKey="repos:resultat" label={t('Résultat')} size="s" />}</>}>
          {result.fromS !== null && result.toS !== null && (
            <HelpText helpKey="repos:resultat" note>
              {t('Moyenne de {w} s la plus basse, de {from} à {to}.', { w: PROTOCOL.windowS, from: formatMinSec(result.fromS), to: formatMinSec(result.toS) })}
            </HelpText>
          )}
          {result.lowestBpm !== null && result.fromS !== null && result.toS !== null ? (
            <>
              <p className="rest-result"><strong className="rest-result__bpm">{result.lowestBpm}</strong> bpm</p>
              <RestingHrChart series={result.series} durationS={PROTOCOL.durationS}
                lowest={{ fromS: result.fromS, toS: result.toS, bpm: result.lowestBpm }} />
              <p className="ui-hint">
                {t('Sur les {n} minutes : moyenne {mean} bpm, maximum {max} bpm.', { n: PROTOCOL.durationS / 60, mean: result.meanBpm ?? '', max: result.maxBpm ?? '' })}
                {' '}{t('Mesures sur {pct} % du temps.', { pct: Math.round(result.coverage * 100) })}
              </p>
              {!result.complete && (
                <div className="ui-alert ui-alert--warning">
                  {t('Il manque des mesures (ceinture mal posée ou perdue) : ce résultat est moins sûr. À refaire.')}
                </div>
              )}
            </>
          ) : (
            <div className="ui-alert ui-alert--warning">{t('Aucune mesure exploitable : vérifiez la ceinture (peau humide, bien serrée) et refaites le test.')}</div>
          )}
          <div className="rest-buttons rest-actions">
            {canRetain && (
              <Button variant="primary" disabled={retained} onClick={() => retainHr('hrRest', result.lowestBpm!, { kind: 'test', atMs: run.state.startMs })}>
                {retained ? t('Retenue comme FC repos') : t('La retenir comme FC repos')}
              </Button>
            )}
            <Button onClick={cancel}>{t('Refaire')}</Button>
          </div>
          {canRetain && !retained && profile.hrRest !== null && <p className="ui-hint">{tRich('Votre FC repos actuelle : {bpm} bpm (Pratiquant, dans <a>Réglages</a>).', { bpm: profile.hrRest }, { a: (c) => <Link to="/parametres">{c}</Link> })}</p>}
        </Card>
      )}

      {results.length > 0 && phase === null && (
        <Card heading={<>{t('Vos tests')}<HelpToggle helpKey="repos:historique" label={t('Vos tests')} size="s" /></>}>
          <HelpText helpKey="repos:historique" note>{t('Gardés sur cet appareil (les 60 derniers).')}</HelpText>
          <ul className="rest-history">
            {results.map((r) => <StoredResultRow key={r.startedAtMs} result={r} onRemove={() => remove(r.startedAtMs)} />)}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default RestingHrTestPage;
