import type { ComponentProps } from 'react';
import HeartRatePanel from './HeartRatePanel';
import ResizablePanel from './ResizablePanel';
import { ANALYSIS_PANEL_STYLE } from './styles';

type PanelProps = ComponentProps<typeof HeartRatePanel>;

/**
 * Onglet « cardio » d'une analyse, le même dans les quatre modules : le
 * `ResizablePanel` d'`id` donné et `HeartRatePanel`, dont la FC max du
 * pratiquant se lit dans `athlete`. `zone` est la zone montrée sur la carte et
 * son choix (`useHeartRateZoneHighlight`).
 * `hrEnergy` (`SportProfile.hrEnergy`) passe tel quel au panneau : la tuile
 * « Énergie estimée » en voile et en surf.
 */
export default function CardioTab({ id, athlete, zone, ...panel }: Omit<PanelProps, 'profileHrMax' | 'selectedZone' | 'onSelectZone'> & {
  id: string;
  zone: { selectedZone: number | null; select: (zone: number | null) => void };
}) {
  return (
    <ResizablePanel id={id} style={ANALYSIS_PANEL_STYLE}>
      <HeartRatePanel {...panel} athlete={athlete} profileHrMax={athlete.hrMax}
        selectedZone={zone.selectedZone} onSelectZone={zone.select} />
    </ResizablePanel>
  );
}
