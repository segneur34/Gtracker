import { useState } from 'react';
import { useHelpCollapsed } from './helpContext';
import { LOGO_IDS, LOGO_LABEL, type LogoId } from '../core/activityLogos';
import { LogoGlyph } from './logos/ActivityLogo';
import './IconPicker.css';
import Button from './ui/Button';

/**
 * Logo d'une activité : les onze dessins, seuls (sans leur cadre) et à l'encre. Celui coché est le choisi, ou à défaut
 * celui deviné du nom (`activityLogo`). Repliée au départ : le dessin en cours et « Changer », qui déplie la grille ;
 * un choix la replie, « Tout réduire » de Réglages aussi.
 */
function IconPicker({
  value, onChange, label,
}: {
  value: LogoId;
  onChange: (logo: LogoId) => void;
  label: string;
}) {
  const collapsed = useHelpCollapsed();
  /** Repère du « Tout réduire » au moment de l'ouverture ; un appui suivant le rend périmé, donc replié. */
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const open = openedAt === collapsed;
  const setOpen = (next: boolean) => setOpenedAt(next ? collapsed : null);
  return (
    <div className="icon-picker" role="group" aria-label={label}>
      <div className="icon-picker__head">
        <span className="icon-picker__current" title={LOGO_LABEL[value]}>
          <LogoGlyph logo={value} size={20} />
        </span>
        <Button size="s" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Réduire' : 'Changer'}
        </Button>
      </div>
      {open && (
        <div className="icon-picker__grid">
          {LOGO_IDS.map((id) => (
            <button key={id} type="button" className="icon-picker__choice"
              aria-pressed={id === value} aria-label={LOGO_LABEL[id]} title={LOGO_LABEL[id]}
              onClick={() => { onChange(id); setOpen(false); }}>
              <LogoGlyph logo={id} size={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default IconPicker;
