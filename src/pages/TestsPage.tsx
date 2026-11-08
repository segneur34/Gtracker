import { IconChevronRight, IconPulse } from '../components/icons';
import { Link, Navigate } from 'react-router-dom';
import { WORKOUT_LISTS } from '../recording/workoutLists';
import './TrainingPages.css';

/**
 * Tuiles des tests (24/10), chacune vers son protocole : la FC max (guidée
 * par bips) ; la VMA (VAMeval) viendra. La FC repos est passée sous le Profil
 * (lot 301). Rangées sous la liste des séances de « Fractionné et tests »
 * (lot I du 25/10).
 */
export function TestTiles() {
  return (
    <nav className="train-hub" aria-label="Tests">
      <Link to="/fractionne/tests/fc-max" className="train-tile">
        <span className="train-tile__icon" aria-hidden="true"><IconPulse size={16} /></span>
        <span className="train-tile__text">
          <span className="ui-subtitle">FC max</span>
          <span className="train-tile__sub">Échauffement, rampe de +0,6 km/h par minute jusqu'à ne plus tenir, récupération</span>
        </span>
        <IconChevronRight size={14} className="train-tile__go" />
      </Link>
    </nav>
  );
}

/**
 * Ancienne page des tests (`/fractionne/tests`) : ses tuiles sont passées
 * sous les séances de « Fractionné et tests » ; l'adresse y mène, pour
 * qu'un lien gardé marche encore.
 */
function TestsPage() {
  return <Navigate to={WORKOUT_LISTS.fractionne.listPath} replace />;
}

export default TestsPage;
