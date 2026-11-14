import SectionTabs, { type SectionDefinition } from './SectionTabs';
import { IconChevronDown, IconChevronUp } from './icons';
import { useStoredRecord } from '../hooks/useStoredRecord';
import { STORAGE_KEYS } from '../core/appIdentity';
import { t } from '../core/i18n';

/**
 * Barre d'onglets d'une analyse, sous la carte : la première rangée porte
 * « général », puis « avancé », qui déplie dessous les
 * autres onglets ; le refermer replie ces onglets et leurs panneaux, que le
 * module masque (`maskAdvancedTabs`) ; l'ouvrir ferme « général », le refermer
 * le rouvre (`useAnalysisTabs`). Une flèche en fin de rangée cache la
 * barre ; cachée, il ne reste qu'un bouton fin « onglets » qui la ramène et
 * disparaît. Seule la barre se cache : les panneaux ouverts restent.
 * Un seul état pour toutes les analyses, retenu sur l'appareil. Après la
 * flèche, « tout fermer » ferme chaque onglet ouvert, « général » compris ;
 * « avancé » reste comme il est.
 */

const BAR_DEFAULTS = { cachee: false };

interface CollapsibleSectionTabsProps<K extends string> {
  /** Onglets montrés, dans l'ordre ; `primary` pour ceux de la première rangée. */
  sections: ReadonlyArray<SectionDefinition<K> & { primary?: true }>;
  open: Record<K, boolean>;
  onToggle: (key: K) => void;
  /** « tout fermer » (`useAnalysisTabs`). */
  onCloseAll: () => void;
  /** Rangée « avancé » dépliée (`useAnalysisTabs`). */
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  accent?: string;
}

function CollapsibleSectionTabs<K extends string>({ sections, open, onToggle, onCloseAll, advancedOpen, onToggleAdvanced, accent }: CollapsibleSectionTabsProps<K>) {
  const { value, update } = useStoredRecord(STORAGE_KEYS.sections, 'analyses-barre', BAR_DEFAULTS);

  if (value.cachee) {
    return (
      <button type="button" className="an-tabs-reveal" onClick={() => update({ cachee: false })} aria-label={t('Montrer les onglets')}>
        {t('onglets')} <IconChevronDown size={14} />
      </button>
    );
  }
  const primary = sections.filter((s) => s.primary === true);
  const advanced = sections.filter((s) => s.primary !== true);
  return (
    <div className="an-tabs">
      <SectionTabs sections={primary} open={open} onToggle={onToggle} accent={accent}
        trailing={(
          <>
            {advanced.length > 0 && (
              <button type="button" className="ui-tab an-tabs-advanced-toggle" onClick={onToggleAdvanced} aria-expanded={advancedOpen}
                title={advancedOpen ? t('Replier les onglets avancés et leurs panneaux') : t('Montrer les onglets avancés')}>
                {t('avancé')} {advancedOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              </button>
            )}
            <button type="button" className="an-tabs-hide" onClick={() => update({ cachee: true })}
              aria-label={t('Cacher les onglets')} title={t('Cacher les onglets')}>
              <IconChevronUp size={16} />
            </button>
            <button type="button" className="an-tabs-close-all" onClick={onCloseAll} title={t('Fermer tous les onglets ouverts')}>
              {t('tout fermer')}
            </button>
          </>
        )} />
      {advancedOpen && advanced.length > 0 && (
        <SectionTabs sections={advanced} open={open} onToggle={onToggle} accent={accent} className="an-tabs-advanced" />
      )}
    </div>
  );
}

export default CollapsibleSectionTabs;
