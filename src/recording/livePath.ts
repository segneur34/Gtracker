/**
 * Trait de raccord de la carte du direct : la trace calculée (`useLiveRecording`,
 * toutes les 2 s au plus) est prolongée jusqu'à la position du moment par un
 * trait à part, entre deux calculs. Ce trait ne joint jamais deux segments :
 * juste après une reprise, la position est déjà dans le nouveau segment alors
 * que la trace calculée s'arrête encore au point de la pause (d'où le trait
 * droit vers la nouvelle position à la reprise d'une pause manuelle).
 */

interface LatLonPoint {
  lat: number;
  lon: number;
}

/**
 * Les deux bouts du raccord, ou `null` : `segments` est la trace calculée, un
 * tableau par segment ; `positionSegment` le rang, dans l'enregistrement, du
 * segment de la position (le dernier pour une position gardée), `null` pour
 * une position qui n'est pas gardée. Raccord seulement si la position est dans
 * le dernier segment calculé (de longueur nulle juste après un calcul).
 */
export const liveTail = <P extends LatLonPoint>(
  segments: ReadonlyArray<ReadonlyArray<P>>,
  position: P | null,
  positionSegment: number | null
): [P, P] | null => {
  const last = segments[segments.length - 1]?.at(-1);
  if (!last || !position || positionSegment !== segments.length - 1) return null;
  return [last, position];
};

/**
 * Nombre de points d'un bloc de la carte du direct. C'est un découpage du dessin, pas un calcul : aucune
 * fenêtre d'analyse n'en dépend, d'où un nombre de points et non une durée.
 */
export const LIVE_BLOCK_POINTS = 300;

/**
 * Découpe d'un segment de `length` points en blocs de dessin, en plages `[début, fin)` d'au plus `size`
 * points. Deux blocs voisins partagent leur point de jonction (`début(k + 1) = fin(k) - 1`) : le trait
 * ne s'interrompt pas entre eux. Quand le segment s'allonge, les blocs déjà pleins restent les mêmes et
 * seul le dernier grandit, puis un nouveau bloc commence : la carte ne retravaille qu'un bloc fermé une
 * fois, à sa fermeture. Moins de deux points par bloc ne ferait pas avancer la découpe : `size` vaut au
 * moins 2.
 */
export const liveBlocks = (length: number, size = LIVE_BLOCK_POINTS): Array<[number, number]> => {
  const step = Math.max(2, Math.floor(size));
  const blocks: Array<[number, number]> = [];
  if (length <= 0) return blocks;
  let start = 0;
  for (;;) {
    const end = Math.min(start + step, length);
    blocks.push([start, end]);
    if (end >= length) return blocks;
    start = end - 1;
  }
};
