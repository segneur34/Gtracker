import L from 'leaflet';
import type { SportFamily } from '../core/sportProfiles';

/**
 * Styles et repères communs aux cartes (données de carte, donc en dur).
 */

/**
 * Liseré blanc sous un trait d'épaisseur `weight` sur le fond satellite : la
 * trace reste lisible sur la mer, la forêt ou les toits. Une seule épaisseur
 * partout, trait + 3 (analyses, direct, planification). Un appelant le fige
 * en constante de module : un trait de `components/map/` réapplique son style
 * à chaque nouvel objet (règle 11).
 */
export const haloStyle = (weight: number) => ({ color: '#ffffff', weight: weight + 3, opacity: 0.85, interactive: false }) as const;

/**
 * Trait et flèche de la carte du direct, par famille : couleurs de carte,
 * détachées de la couleur des activités, comme le bleu du tracé de la
 * planification.
 */
export const LIVE_TRACK_COLOR: Record<SportFamily, string> = { voile: '#004aad', surf: '#5b6670' };

/** Couleurs du repère du survol (`HoverMarker`), tour et fond, et de la position sur un graphe qui lui répond. */
export const HOVER_MARKER_COLOR = { stroke: '#1b1f24', fill: '#ffffff' } as const;

/**
 * Cache de repères `divIcon`, un par endroit : un repère est fabriqué une fois
 * par clé et gardé d'un rendu à l'autre, et Leaflet ne le redessine que s'il
 * change.
 */
export const divIconCache = (): ((key: string, build: () => L.DivIconOptions) => L.DivIcon) => {
  const icons = new Map<string, L.DivIcon>();
  return (key, build) => {
    let icon = icons.get(key);
    if (!icon) {
      icon = L.divIcon(build());
      icons.set(key, icon);
    }
    return icon;
  };
};
