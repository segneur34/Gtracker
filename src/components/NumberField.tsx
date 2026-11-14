import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { HelpText, HelpToggle } from './Help';
import './NumberField.css';

/**
 * Champ numérique optionnel, en `type="number"` avec flèches ↕, même
 * principe que le seuil d'activité du module voile : la valeur s'applique
 * immédiatement. L'affichage suit un brouillon local tant que le champ a le
 * focus, pour ne pas effacer une frappe en cours (valeur hors bornes en
 * cours de saisie, "." d'un décimal) quand un commit sans effet redéclenche
 * un rendu ; à la sortie du champ, le brouillon revient à la valeur commise.
 */
export default function NumberField({
  label, help, helpKey, before, unit, value, onCommit, placeholder, step = 1, min, max,
}: {
  label?: string;
  /** Pièce posée entre le libellé et la case (un bouton) ; le libellé reste lié à la case par son identifiant. */
  before?: ReactNode;
  /** Aide du champ à libellé, sous son « ? » (`helpKey` : sa clé). */
  help?: ReactNode;
  helpKey?: string;
  unit?: string;
  value: number | null;
  onCommit: (next: number | null) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const focused = useRef(false);
  const inputId = useId();

  useEffect(() => {
    if (!focused.current) setDraft(value === null ? '' : String(value));
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDraft(text);
    if (text === '') { onCommit(null); return; }
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) onCommit(parsed);
  };

  const field = (
    <label htmlFor={inputId} className={label ? 'number-field number-field--labelled' : 'number-field'}>
      {label && <span className="ui-field-row__label">{label}{helpKey && <HelpToggle helpKey={helpKey} label={label} />}</span>}
      {before}
      <input
        id={inputId}
        type="number"
        step={step}
        min={min}
        max={max}
        value={draft}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setDraft(value === null ? '' : String(value)); }}
        className="ui-field ui-field--s num set-input-84" />
      {unit && <span className="ui-muted">{unit}</span>}
    </label>
  );
  if (!helpKey) return field;
  return (
    <>
      {field}
      <HelpText helpKey={helpKey}>{help}</HelpText>
    </>
  );
}
