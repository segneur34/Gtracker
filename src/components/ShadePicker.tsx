import { ACTIVITY_PALETTE, paletteColorText } from '../core/activities';
import { useAppliedTheme } from '../hooks/useTheme';
import './ShadePicker.css';

/**
 * Couleur d'une activité : une rangée de pastilles cernées, les douze
 * couleurs de la palette (`ACTIVITY_PALETTE`), communes à toutes les
 * activités. Une couleur hors de la rangée (reprise d'un autre appareil) n'en
 * coche aucune. En sombre, chaque pastille montre sa couleur de nuit et son
 * nom de nuit ; la valeur choisie reste la couleur claire.
 */
function ShadePicker({
  value, onChange, label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const current = value.toLowerCase();
  const dark = useAppliedTheme().theme === 'dark';
  return (
    <div className="shade-picker" role="group" aria-label={label}>
      {ACTIVITY_PALETTE.map((c) => {
        const name = paletteColorText(dark ? c.darkName ?? c.name : c.name);
        return (
          <button key={c.light} type="button" className="shade-picker__swatch" style={{ backgroundColor: dark ? c.dark : c.light }}
            aria-pressed={c.light === current} aria-label={name} title={name}
            onClick={() => onChange(c.light)} />
        );
      })}
    </div>
  );
}

export default ShadePicker;
