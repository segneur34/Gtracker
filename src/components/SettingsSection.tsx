import { Children, type ReactNode, type Ref } from 'react';
import './SettingsSection.css';

/**
 * Une partie d'un bloc de Réglages : son titre (toujours dans la même écriture, avec le « ? » de son aide sur la même
 * ligne), son contenu, et un trait fin à l'encre entre deux parties voisines, jamais avant la première ni après la
 * dernière. Les parties d'un bloc se suivent donc dans une même colonne (`ui-stack-3`), sans autre élément entre elles.
 *
 * - `title` : le titre simple ; `extra` se pose à sa droite (le « ? »).
 * - `heading` : un titre déjà fait, quand il se replie (« Remise à zéro », la corbeille) ; il remplace `title`.
 * - Sans titre fourni et sans contenu, la partie ne se montre pas : une partie absente d'un visage de l'application
 *   ne laisse ni titre vide ni trait orphelin.
 *
 * À ne pas confondre avec `SettingsPart`, partie repliable d'une carte d'activité.
 */
function SettingsSection({ title, extra, heading, className, id, ref, children }: {
  title?: string;
  extra?: ReactNode;
  heading?: ReactNode;
  className?: string;
  id?: string;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  if (heading === undefined && Children.toArray(children).length === 0) return null;
  return (
    <div className={className ? `settings-section ${className}` : 'settings-section'} id={id} ref={ref}>
      {heading ?? (title !== undefined && (
        <div className="settings-section__head">
          <strong className="settings-section__title">{title}</strong>
          {extra}
        </div>
      ))}
      {children}
    </div>
  );
}

export default SettingsSection;
