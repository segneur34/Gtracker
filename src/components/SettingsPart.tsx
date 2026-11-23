import type { ReactNode } from 'react';
import FoldTitle from './ui/FoldTitle';

/**
 * Partie repliable de Réglages (partie d'une carte d'activité, licences d'« À propos ») : une ligne titre, un filet au
 * dessus, ses lignes dessous une fois ouverte. L'état est tenu par l'appelant.
 */
function SettingsPart({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="settings-part">
      <FoldTitle className="settings-part__toggle" open={open} onToggle={onToggle} chevronClassName="settings-activity__chevron">
        {label}
      </FoldTitle>
      {open && <div className="settings-part__body">{children}</div>}
    </div>
  );
}

export default SettingsPart;
