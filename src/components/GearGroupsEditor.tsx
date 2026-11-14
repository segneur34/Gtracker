import { useState } from 'react';
import { newId } from '../core/basics';
import { t, tn } from '../core/i18n';
import { MAX_GEAR_LABEL_LENGTH, cleanGearName, withGearItem } from '../settings/gear';
import type { GearGroup } from '../library/notes';
import Button from './ui/Button';
import { IconChevronDown, IconChevronRight, IconClose } from './icons';
import './Gear.css';

/**
 * Nom d'un groupe ou d'une pièce, renommé à la sortie du champ (ou à Entrée) ;
 * un nom vidé reprend l'ancien : on supprime par la croix, pas en effaçant.
 */
function NameField({ value, label, className, onRename }: {
  value: string;
  label: string;
  className?: string;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  // Changé d'ailleurs (fichier de réglages repris) : relu, pendant le rendu.
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  const commit = () => {
    const name = cleanGearName(draft);
    if (name !== '' && name !== value) onRename(name);
    setDraft(name === '' ? value : name);
  };
  return (
    <input value={draft} maxLength={MAX_GEAR_LABEL_LENGTH} aria-label={label} className={`ui-field ui-field--s${className ? ` ${className}` : ''}`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

/** Champ et bouton d'ajout : le nom saisi, ajouté par le bouton ou par Entrée, puis le champ se vide. */
function AddField({ placeholder, button, testId, onAdd }: {
  placeholder: string;
  button: string;
  testId: string;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const add = () => {
    if (cleanGearName(name) === '') return;
    onAdd(name);
    setName('');
  };
  return (
    <div className="gear-editor__row">
      <input value={name} maxLength={MAX_GEAR_LABEL_LENGTH} placeholder={placeholder} aria-label={placeholder} className="ui-field ui-field--s"
        data-testid={`${testId}-name`}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
      <Button size="s" disabled={cleanGearName(name) === ''} onClick={add} data-testid={testId}>{button}</Button>
    </div>
  );
}

/**
 * Matériel enregistré d'une activité (Réglages, partie « Matériel »), posé en ligne
 * sous la case : « Créer groupe matériel » ajoute un groupe (« Voile », « Aile avant », « Mât »…),
 * chaque groupe se déplie (chevron, replié par défaut, un groupe neuf s'ouvre) sur ses
 * lignes et le champ d'ajout d'une ligne. Groupes et lignes se renomment et se suppriment.
 * Chaque changement est écrit tout de suite (`onChange`). Une pièce supprimée reste dans
 * les sessions qui la portent : Statistiques la retrouve par son nom.
 */
function GearGroupsEditor({ groups, onChange }: {
  groups: readonly GearGroup[];
  onChange: (groups: GearGroup[]) => void;
}) {
  /** Groupes dépliés, propres à l'écran (repliés à la réouverture de Réglages). */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (groupId: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    return next;
  });

  const update = (groupId: string, change: (group: GearGroup) => GearGroup) =>
    onChange(groups.map((g) => (g.id === groupId ? change(g) : g)));

  const removeGroup = (group: GearGroup) => {
    const question = group.items.length > 0
      ? tn(group.items.length,
        'Supprimer le groupe « {name} » et ses {n} pièce ? Les sessions qui les portent les gardent.',
        'Supprimer le groupe « {name} » et ses {n} pièces ? Les sessions qui les portent les gardent.', { name: group.name })
      : t('Supprimer le groupe « {name} » ? Les sessions qui les portent les gardent.', { name: group.name });
    if (window.confirm(question)) {
      onChange(groups.filter((g) => g.id !== group.id));
    }
  };

  const removeItem = (group: GearGroup, itemId: string, name: string) => {
    if (window.confirm(t('Supprimer « {name} » de « {group} » ? Les sessions qui la portent la gardent.', { name, group: group.name }))) {
      update(group.id, (g) => ({ ...g, items: g.items.filter((item) => item.id !== itemId) }));
    }
  };

  const addGroup = (name: string) => {
    const id = newId();
    onChange([...groups, { id, name: cleanGearName(name), items: [] }]);
    setOpen((prev) => new Set(prev).add(id));
  };

  const addItem = (groupId: string, name: string) => {
    const next = withGearItem(groups, groupId, name);
    if (next) onChange(next.groups);
  };

  return (
    <div className="gear-editor">
      <AddField placeholder={t('Nom du matériel (voile, mât…)')} button={t('Créer groupe matériel')} testId="gear-group-add" onAdd={addGroup} />
      {groups.map((group) => {
        const isOpen = open.has(group.id);
        return (
          <div key={group.id} className="gear-editor__group" data-testid={`gear-group-${group.id}`}>
            <div className="gear-editor__row">
              <button type="button" className="gear-editor__icon" data-testid={`gear-group-toggle-${group.id}`}
                aria-expanded={isOpen} aria-label={isOpen ? t('Replier {name}', { name: group.name }) : t('Déplier {name}', { name: group.name })}
                title={isOpen ? t('Replier') : t('Déplier')} onClick={() => toggle(group.id)}>
                {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
              </button>
              <NameField value={group.name} label={t('Nom du groupe {name}', { name: group.name })} className="gear-editor__name"
                onRename={(name) => update(group.id, (g) => ({ ...g, name }))} />
              {!isOpen && <span className="gear-editor__count">{tn(group.items.length, '{n} ligne', '{n} lignes')}</span>}
              <button type="button" className="gear-editor__icon" aria-label={t('Supprimer le groupe {name}', { name: group.name })} title={t('Supprimer le groupe')}
                onClick={() => removeGroup(group)}>
                <IconClose size={18} />
              </button>
            </div>
            {isOpen && (
              <div className="gear-editor__items">
                {group.items.map((item) => (
                  <div key={item.id} className="gear-editor__row">
                    <NameField value={item.name} label={t('Nom de la ligne {name}', { name: item.name })}
                      onRename={(name) => update(group.id, (g) => ({ ...g, items: g.items.map((it) => (it.id === item.id ? { ...it, name } : it)) }))} />
                    <button type="button" className="gear-editor__icon" aria-label={t('Supprimer {name}', { name: item.name })} title={t('Supprimer la ligne')}
                      onClick={() => removeItem(group, item.id, item.name)}>
                      <IconClose size={16} />
                    </button>
                  </div>
                ))}
                <AddField placeholder={t('Nouvelle ligne')} button={t('Ajouter une ligne')} testId="gear-item-add" onAdd={(name) => addItem(group.id, name)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default GearGroupsEditor;
