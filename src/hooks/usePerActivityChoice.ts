import { useState } from 'react';

/** Choix fait sur la page pour une activité (case cochée ou décochée). */
export interface PerActivityChoice {
  activityId: string;
  measure: boolean;
}

/** Valeur d'un choix : celui fait sur la page pour cette activité, sinon `fallback` (Réglages). */
export const choiceFor = (choice: PerActivityChoice | null, activityId: string | null, fallback: boolean): boolean =>
  choice !== null && activityId !== null && choice.activityId === activityId ? choice.measure : fallback;

/**
 * Choix d'Enregistrer qui vaut pour cet enregistrement (sauts, pumping,
 * cadence, ceinture) : celui de l'activité dans Réglages
 * (`fallback`), jusqu'à ce que l'utilisateur le change ; son choix ne suit pas
 * une autre activité choisie ensuite. Rend la valeur et de quoi la changer.
 */
export const usePerActivityChoice = (activityId: string | null, fallback: boolean): [boolean, (measure: boolean) => void] => {
  const [choice, setChoice] = useState<PerActivityChoice | null>(null);
  const set = (measure: boolean) => {
    if (activityId !== null) setChoice({ activityId, measure });
  };
  return [choiceFor(choice, activityId, fallback), set];
};
