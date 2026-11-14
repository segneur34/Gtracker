import type { SchoolStyle } from '../../core/schoolBasics';
import { FISH_SHAPES } from './fishShapes';
import { fishSymbolId } from './fishSymbols';
import './FishSchool.css';

/**
 * Feuille de symboles des poissons du banc : les huit formes du style reçu, à poser dans le `<svg>` qui les reprend par
 * `<use>` ; seule pièce à importer les dessins, chargée avec la couche du banc. Un même dessin sert le jour et la nuit :
 * ses couleurs sont des classes reliées au thème (`FishSchool.css`), la couleur d'activité lue dans `--fish-act` sur
 * chaque `<use>`. Changer de style ne change que ces symboles, jamais les places.
 */
function FishSprite({ style }: { style: SchoolStyle }) {
  return (
    <defs>
      {FISH_SHAPES[style].map((elements, shape) => (
        <symbol key={shape} id={fishSymbolId(style, shape)} overflow="visible">
          {elements.map(([className, d, strokeWidth], k) => (
            <path key={k} className={className} d={d} fill="none" strokeWidth={strokeWidth}
              strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </symbol>
      ))}
    </defs>
  );
}

export default FishSprite;
