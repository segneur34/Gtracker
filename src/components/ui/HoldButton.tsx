import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLongPress } from '../../hooks/useLongPress';
import { useTransientValue } from '../../hooks/useTransientValue';
import Button from './Button';
import HoldDial from './HoldDial';
import { dateLocale, t } from '../../core/i18n';

/** Carré rouge de l'arrêt, dans le grand cadran. */
const STOP_ICON = <span className="ui-record-dot ui-record-dot--stop" style={{ width: '48px', height: '48px', borderRadius: '8px' }} />;

/** Gestes que le bouton rappelle ; l'identifiant n'est pas affiché, la phrase vient de `holdHint`. */
export type HoldAction = 'arrêter' | 'supprimer' | "revenir aux réglages d'usine" | 'tout supprimer' | 'vider la corbeille';

/** Rappel du geste, en phrase entière par geste (jamais un verbe collé à une phrase). */
const holdHint = (action: HoldAction, holdS: string): string => {
  switch (action) {
    case 'supprimer':
      return t('Maintenir {holdS} s pour supprimer', { holdS });
    case "revenir aux réglages d'usine":
      return t("Maintenir {holdS} s pour revenir aux réglages d'usine", { holdS });
    case 'tout supprimer':
      return t('Maintenir {holdS} s pour tout supprimer', { holdS });
    case 'vider la corbeille':
      return t('Maintenir {holdS} s pour vider la corbeille', { holdS });
    default:
      return t('Maintenir {holdS} s pour arrêter', { holdS });
  }
};

/**
 * Bouton qu'on tient pour agir (arrêt de l'enregistrement, « Supprimer » une
 * session depuis le menu « … » de son analyse) : tenu `getHoldMs()`, le grand
 * cadran sous le doigt ; un appui court rappelle le geste quelques secondes
 * (« Maintenir 2 s pour arrêter »). À 0, un simple appui agit. Le cadran est
 * posé à la racine de la page : un bouton logé dans un menu ne le cache pas.
 */
function HoldButton({
  onHold, getHoldMs, label, lead, dialTitle, color = 'var(--recording)', icon = STOP_ICON, disabled = false, size, style,
  action = 'arrêter', ariaLabel, keepMenuOpen = false,
}: {
  onHold: () => void;
  /** Lue au rendu et à chaque appui : un réglage changé vaut au retour sur la page. */
  getHoldMs: () => number;
  label: string;
  /** Devant le texte, gardé pendant le rappel du geste (le carré de l'arrêt). */
  lead?: ReactNode;
  dialTitle: string;
  color?: string;
  icon?: ReactNode;
  disabled?: boolean;
  size?: 's' | 'm' | 'l';
  style?: CSSProperties;
  /** Geste rappelé après un appui court : choisit la phrase entière « Maintenir 1 s pour … » (`holdHint`). */
  action?: HoldAction;
  /** Nom lu par les lecteurs d'écran, s'il doit dire le geste. */
  ariaLabel?: string;
  /** Bouton posé dans un menu « … » (`MoreMenu`) : un appui court ne le referme pas, le rappel s'y lit. */
  keepMenuOpen?: boolean;
}) {
  const holdMs = getHoldMs();
  const { pressingMs, handlers } = useLongPress(onHold, getHoldMs, holdMs > 0 && !disabled);
  /** Rappel du geste après un appui trop court, effacé au bout de quelques secondes. */
  const [hint, setHint] = useTransientValue<true>(3000);

  const onClick = (e: MouseEvent) => {
    if (holdMs === 0) {
      onHold();
      return;
    }
    handlers.onClick(e);
    // Le clic qui suit un appui long abouti est annulé par `useLongPress` : seul un appui court rappelle le geste.
    if (!e.defaultPrevented) setHint(true);
  };

  const holdS = (holdMs / 1000).toLocaleString(dateLocale());
  return (
    <>
      <Button variant="danger" size={size} className="ui-btn--hold" style={style} disabled={disabled} aria-label={ariaLabel}
        data-keep-open={keepMenuOpen ? '' : undefined} {...handlers} onClick={onClick}>
        {lead}
        {hint ? holdHint(action, holdS) : label}
      </Button>
      {pressingMs !== null && createPortal(
        <HoldDial pressMs={pressingMs} color={color} icon={icon} title={dialTitle} hint={t('Maintenez le bouton')} />,
        document.body
      )}
    </>
  );
}

export default HoldButton;
