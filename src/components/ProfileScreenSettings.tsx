import { Suspense, lazy, useCallback, useMemo } from 'react';
import { logoColor, visibleActivities } from '../core/activities';
import type { LogoId } from '../core/activityLogos';
import { DEFAULT_SCHOOL_STYLE } from '../core/schoolBasics';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useVisibility } from '../hooks/useSportSettings';
import { useThemedShade } from '../hooks/useTheme';
import { ATHLETE_NAME_MAX, SCHOOL_TRIAL_BOUNDS, athleteAvatar, athleteSchoolHidden } from '../library/athleteProfile';
import ErrorBoundary from './ErrorBoundary';
import { HelpText, HelpToggle, SettingRow } from './Help';
import NumberField from './NumberField';
import { AvatarPicker } from './ProfileAvatar';
import './ProfileScreenSettings.css';

const FishStylePicker = lazy(() => import('./fishSchool/FishStylePicker'));

/**
 * Réglages de l'écran Profil, une seule pièce montrée à deux endroits : la fenêtre ouverte en touchant la photo ronde
 * du Profil, et Réglages › Pratiquant. La photo, le nom ou pseudo, le poisson du banc (ou « Aucun », qui cache le banc
 * et l'eau) et le nombre de sessions du banc à l'essai ; tout s'applique tout de suite, au profil du pratiquant.
 */
export default function ProfileScreenSettings() {
  const { profile, setName, setAvatar, setNumber, setSchoolChoice } = useAthleteProfile();
  const { activities, hiddenFamilies } = useVisibility();
  const shade = useThemedShade();
  const shownLogoColor = useCallback((logo: LogoId) => shade(logoColor(logo, activities)), [shade, activities]);
  /** Couleurs de l'aperçu du poisson à la couleur d'activité : celles des activités visibles. */
  const pickerColors = useMemo(() => visibleActivities(activities, hiddenFamilies).map((a) => a.color), [activities, hiddenFamilies]);
  const schoolChoice = athleteSchoolHidden(profile) ? null : profile.schoolStyle ?? DEFAULT_SCHOOL_STYLE;

  return (
    <div className="profile-settings">
      <SettingRow label="Photo de profil" helpKey="pratiquant:photo"
        help="La photo ronde en tête du Profil : un logo d'activité, une image du téléphone, ou rien.">
        <AvatarPicker avatar={athleteAvatar(profile)} logoColor={shownLogoColor} onPick={setAvatar} />
      </SettingRow>
      <label className="ui-field-row">
        <span className="ui-field-row__label">Nom ou pseudo<HelpToggle helpKey="pratiquant:nom" label="Nom ou pseudo" /></span>
        <input type="text" value={profile.name ?? ''} maxLength={ATHLETE_NAME_MAX} placeholder="ex. Tom" autoComplete="nickname"
          onChange={(e) => setName(e.target.value)} className="ui-field ui-field--s profile-settings__name" />
      </label>
      <HelpText helpKey="pratiquant:nom">En titre de la page Profil et au pied des images partagées.</HelpText>
      <SettingRow label="Poisson du banc" helpKey="pratiquant:banc-poisson"
        help="Le dessin des poissons du banc du Profil, « Deux arcs » au départ ; « Couleur d'activité » peint chaque poisson à la couleur de l'activité de sa session. Changer de poisson ne déplace aucun poisson. « Aucun » cache le banc et l'eau ; choisir un poisson les remontre.">
        {/* Décoratif et chargé à part : s'il ne se charge pas (hors ligne), le reste des réglages demeure. */}
        <ErrorBoundary silent>
          <Suspense fallback={null}>
            <FishStylePicker value={schoolChoice} onChange={setSchoolChoice} activityColors={pickerColors} />
          </Suspense>
        </ErrorBoundary>
      </SettingRow>
      <NumberField label="Nombre de sessions du banc (essai, provisoire)" min={SCHOOL_TRIAL_BOUNDS[0]} max={SCHOOL_TRIAL_BOUNDS[1]}
        value={profile.schoolTrialSessions} onCommit={(next) => setNumber('schoolTrialSessions', next)} placeholder="Auto"
        helpKey="pratiquant:banc-essai"
        help={`Réglage provisoire, pour essayer : impose le nombre de sessions que compte le banc de poissons du Profil (de ${SCHOOL_TRIAL_BOUNDS[0]} à ${SCHOOL_TRIAL_BOUNDS[1]}). Vide : automatique, toutes les sessions de la bibliothèque.`} />
    </div>
  );
}
