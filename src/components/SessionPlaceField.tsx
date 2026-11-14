import type { KeyboardEvent } from 'react';
import { t } from '../core/i18n';
import type { PlaceDraft } from '../library/places';
import Button from './ui/Button';

/**
 * Saisie du lieu d'une session (« Lieu », à côté de « Renommer ») : le champ du lieu, un second pour l'arrivée
 * quand la session finit ailleurs, et leurs boutons « Valider » et « Annuler » (Entrée valide, Échap annule). Le
 * même dans la liste des sessions et dans l'en-tête d'une analyse (`SessionNameEditor`), qui posent le texte en
 * cours et ce qu'il advient de la validation (`correctSessionPlace`).
 */
export default function SessionPlaceField({ value, onChange, onSave, onCancel, className = 'ui-field ui-field--s' }: {
  value: PlaceDraft;
  onChange: (value: PlaceDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Classe de chaque champ ; celle d'un petit champ par défaut. */
  className?: string;
}) {
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSave();
    else if (e.key === 'Escape') onCancel();
  };
  const both = value.arrival !== null;
  return (
    <>
      <input
        className={className}
        value={value.departure}
        autoFocus
        maxLength={80}
        placeholder={both ? t('Lieu de départ') : t('Lieu de la session')}
        aria-label={both ? t('Lieu de départ') : t('Lieu de la session')}
        onChange={(e) => onChange({ ...value, departure: e.target.value })}
        onKeyDown={keys} />
      {value.arrival !== null && (
        <input
          className={className}
          value={value.arrival}
          maxLength={80}
          placeholder={t("Lieu d'arrivée")}
          aria-label={t("Lieu d'arrivée")}
          onChange={(e) => onChange({ ...value, arrival: e.target.value })}
          onKeyDown={keys} />
      )}
      <Button size="s" onClick={onSave}>{t('Valider')}</Button>
      <Button size="s" variant="ghost" onClick={onCancel}>{t('Annuler')}</Button>
    </>
  );
}
