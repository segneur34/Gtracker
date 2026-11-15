import { useMemo, useState } from 'react';
import Dialog from '../components/ui/Dialog';
import ChoiceButtons from '../components/ui/ChoiceButtons';
import { FAMILY_LABEL, activitiesOfFamily, activityDisplayName, activityFamily, type Activity } from '../core/activities';
import { SPORT_FAMILIES, type SportFamily } from '../core/sportProfiles';
import { useGearGroups, useVisibility } from '../hooks/useSportSettings';
import { useThemedShade } from '../hooks/useTheme';
import {
  STATS_PERIODS, gearFilterItems, gearFilterRows, gearParamOf, inBounds, normalizeStatsChoice, readGearParam, statsPeriodBounds, withGearPick,
  type GearFilterItem, type GearFilterRow, type GearSelection, type StatSession, type StatsChoice, type StatsPeriod,
} from '../library/stats';

import { t } from '../core/i18n';

/**
 * Lignes du filtre « Matériel », une par groupe : son nom, puis « Tous » et ses pièces. `onChange` reçoit le
 * paramètre `materiel` de la sélection changée (`gearParamOf`). Grande taille dans la fenêtre, petite sur la page.
 */
export function GearChoiceRows({ rows, selection, items, small, onChange }: {
  rows: readonly GearFilterRow[];
  selection: GearSelection;
  items: readonly GearFilterItem[];
  small?: boolean;
  onChange: (gear: string | null) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.groupId} className="stats-gear">
          <span className="stats-gear__label">{row.groupName}</span>
          <ChoiceButtons small={small} label={t('Matériel : {group}', { group: row.groupName })}
            items={[{ key: '', label: t('Tous') }, ...row.items.map((it) => ({ key: it.key, label: it.itemName }))]}
            value={selection.find((it) => it.groupId === row.groupId)?.key ?? ''}
            onChange={(key) => onChange(gearParamOf(withGearPick(selection, row.groupId, row.items.find((it) => it.key === key) ?? null, items)))} />
        </div>
      ))}
    </>
  );
}

/**
 * Fenêtre « Sélection » des Statistiques : famille, activité, période et matériel en gros boutons qui passent à
 * la ligne. Elle travaille sur un brouillon du choix en cours ; « Valider » le rend d'un coup (`onApply`), le
 * reste (Annuler, ×, le fond, Échap, le retour d'Android) ferme sans rien changer. Changer de famille ou
 * d'activité remet le matériel à « Tous » ; le matériel proposé est celui de l'activité du brouillon, porté par
 * ses sessions sur la période du brouillon.
 *
 * `all` : les sessions de la page (celles d'une famille cachée ouverte par son adresse comprises), `activityById`
 * leurs activités, celles de base sans activité créée comprises.
 */
function StatsSelectionDialog({ initial, all, activityById, nowMs, onApply, onClose }: {
  initial: StatsChoice;
  all: readonly StatSession[];
  activityById: ReadonlyMap<string, Activity>;
  nowMs: number;
  onApply: (choice: StatsChoice) => void;
  onClose: () => void;
}) {
  const { activities, families, isShown } = useVisibility();
  const shade = useThemedShade();
  const [draft, setDraft] = useState<StatsChoice>(() => normalizeStatsChoice(initial));
  const patch = (next: Partial<StatsChoice>) => setDraft((d) => normalizeStatsChoice({ ...d, ...next }));

  // Les familles visibles, et celle ouverte par l'adresse.
  const familyItems: { key: SportFamily | 'tout'; label: string }[] = [
    { key: 'tout', label: t('Tout') },
    ...SPORT_FAMILIES.filter((f) => families.includes(f) || f === initial.family).map((f) => ({ key: f, label: FAMILY_LABEL[f] })),
  ];

  // Toutes les activités visibles de la famille du brouillon, avec ou sans session, et celles de base qui en ont.
  const draftFamily = draft.family;
  const activityItems = useMemo(() => {
    if (draftFamily === null) return [];
    const familyHidden = !families.includes(draftFamily);
    const withSessions = new Set(all.filter((s) => s.family === draftFamily).map((s) => s.activityId));
    const listed = activitiesOfFamily(activities, draftFamily)
      .filter((a) => isShown(a) || familyHidden || withSessions.has(a.id) || a.id === initial.activityId);
    const extra = [...withSessions].filter((id) => !listed.some((a) => a.id === id)).map((id) => activityById.get(id)!);
    return [...listed, ...extra].map((a) => ({ key: a.id, label: activityDisplayName(a), color: shade(a.color) }));
  }, [draftFamily, families, all, activities, isShown, initial.activityId, activityById, shade]);

  const candidate = draft.activityId !== null ? activityById.get(draft.activityId) : undefined;
  const draftActivity: Activity | null = candidate && draftFamily !== null && activityFamily(candidate) === draftFamily ? candidate : null;

  // Matériel de l'activité du brouillon, sur sa période.
  const gearGroups = useGearGroups(draftActivity);
  const gearItems = useMemo(() => gearFilterItems(gearGroups ?? []), [gearGroups]);
  const gearKnown = useMemo(() => new Set(gearItems.map((it) => it.key)), [gearItems]);
  const gearSelection = useMemo(() => readGearParam(draft.gear, gearItems), [draft.gear, gearItems]);
  const bounds = useMemo(() => statsPeriodBounds(draft.period, nowMs), [draft.period, nowMs]);
  const gearRows = useMemo(
    () => (draftActivity === null ? [] : gearFilterRows(
      gearItems, all.filter((s) => s.activityId === draftActivity.id && inBounds(s.startMs, bounds)), gearSelection, gearKnown
    )),
    [draftActivity, gearItems, all, bounds, gearSelection, gearKnown]
  );

  return (
    <Dialog title={t('Sélection')} onClose={onClose} className="stats-selection-dialog">
      <div className="stats-selection__body">
        <section className="stats-selection__block">
          <span className="ui-subtitle">{t('Famille')}</span>
          <ChoiceButtons label={t('Famille')} columns={3} items={familyItems} value={draft.family ?? 'tout'}
            onChange={(key) => patch({ family: key === 'tout' ? null : key, activityId: null, gear: null })} />
        </section>
        {draftFamily !== null && activityItems.length > 0 && (
          <section className="stats-selection__block">
            <span className="ui-subtitle">{t('Activité')}</span>
            <ChoiceButtons label={t('Activité')} columns={2} items={[{ key: '', label: t('Toutes') }, ...activityItems]} value={draftActivity?.id ?? ''}
              onChange={(key) => patch({ activityId: key === '' ? null : key, gear: null })} />
          </section>
        )}
        <section className="stats-selection__block">
          <span className="ui-subtitle">{t('Période')}</span>
          <ChoiceButtons label={t('Période')} columns={3} items={STATS_PERIODS.map((p) => ({ key: p.id, label: p.label }))} value={draft.period}
            onChange={(key: StatsPeriod) => patch({ period: key })} />
        </section>
        {draftActivity !== null && gearGroups !== null && (
          <section className="stats-selection__block">
            <span className="ui-subtitle">{t('Matériel')}</span>
            {gearRows.length === 0
              ? <p className="ui-hint">{t('Aucun matériel sur les sessions de cette période.')}</p>
              : <GearChoiceRows rows={gearRows} selection={gearSelection} items={gearItems} onChange={(gear) => patch({ gear })} />}
          </section>
        )}
      </div>
      <div className="stats-selection__foot">
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose}>{t('Annuler')}</button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={() => onApply(normalizeStatsChoice(draft))}>{t('Valider')}</button>
      </div>
    </Dialog>
  );
}

export default StatsSelectionDialog;
