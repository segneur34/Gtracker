import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pushBackLayer } from '../../platform/backButton';
import { t } from '../../core/i18n';
import './Dialog.css';

/**
 * Fenêtre modale au milieu de l'écran, au-dessus des barres et du menu « … » :
 * un titre, ×, et son contenu. Le fond, × et Échap la ferment. `className`
 * s'ajoute à la fenêtre pour ce qui lui est propre (partage, profil), `style`
 * aussi (la couleur d'un cadre peint, `--brush`). Le retour d'Android la
 * ferme aussi, sans quitter la page.
 */
function Dialog({ title, onClose, className, style, children }: {
  title: string;
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const removeLayer = pushBackLayer(() => closeRef.current());
    return () => {
      window.removeEventListener('keydown', onKey);
      removeLayer();
    };
  }, []);

  return createPortal(
    <div className="ui-modal-backdrop ui-dialog__backdrop" onClick={onClose}>
      <div className={className ? `ui-dialog ${className}` : 'ui-dialog'} role="dialog" aria-modal="true" aria-label={title}
        style={style} onClick={(e) => e.stopPropagation()}>
        <div className="ui-dialog__head">
          <strong>{title}</strong>
          <button type="button" className="ui-dialog__close" onClick={onClose} aria-label={t('Fermer')}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default Dialog;
