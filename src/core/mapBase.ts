import { t } from './i18n';
import type { TileCoord } from './tiles';

/**
 * Fonds de carte, choisis par famille sur la carte (`hooks/useMapBase.ts`) :
 * le plan d'OpenStreetMap seul dans cette version. La couche Leaflet est dans
 * `components/BaseTileLayer.tsx`, les tuiles dans `platform/mapTiles.ts`.
 *
 * Ajouter un fond : une entrée de `MAP_BASES` (adresse, mentions exigées par
 * le fournisseur, `keyPrefix` propre pour que ses tuiles gardées ne se mêlent
 * pas à celles du plan, `overzoomDepth`, `fetchAncestors`, `photo`), puis son
 * champ d'adresse dans Réglages › Cartes hors ligne (`OfflineMapsSettings`).
 * Le bouton de choix du fond apparaît seul sur les cartes dès qu'il y a deux
 * fonds. Les conditions d'usage du fournisseur disent si ses tuiles peuvent
 * être gardées sur l'appareil, et combien de temps.
 */

export interface MapBaseSource {
  /** Nom du fond dans le menu de la carte. */
  label: string;
  /** Gabarit d'adresse : `{z}`, `{x}`, `{y}`. */
  url: string;
  /** Mention exigée par les conditions d'usage, en HTML (carte). */
  attribution: string;
  /** Mention en texte, courte, pour les vignettes de la bibliothèque. */
  credit: string;
  /** Adresse de la page de licence, ajoutée à la mention de l'image de partage (qui ne peut pas porter de lien). */
  creditUrl: string;
  /** Préfixe de la clé des tuiles gardées ; vide pour le plan, dont les tuiles déjà gardées restent lisibles. */
  keyPrefix: string;
  /** Zooms au-dessus d'une tuile gardée où on l'agrandit plutôt que de laisser une case vide. */
  overzoomDepth: number;
  /** Une tuile que le serveur n'a pas est remplacée par l'agrandissement d'une parente, demandée au serveur au besoin. */
  fetchAncestors: boolean;
  /**
   * Fond photographique : un liseré blanc sous les traits les détache de l'image, et la mention se replie sur
   * téléphone en une ligne qu'un toucher déplie (`BaseTileLayer.tsx`). Jamais pour le plan : la règle d'OSM interdit
   * de cacher sa mention.
   */
  photo: boolean;
}

export const MAP_BASES = {
  plan: {
    label: t('Plan'),
    // Sans sous-domaine : OSM les déconseille depuis 2023 (une seule adresse, servie en HTTP/2).
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    credit: '© OpenStreetMap',
    creditUrl: 'openstreetmap.org/copyright',
    keyPrefix: '',
    overzoomDepth: 3,
    fetchAncestors: false,
    photo: false,
  },
} as const satisfies Record<string, MapBaseSource>;

export type MapBase = keyof typeof MAP_BASES;

export const MAP_BASE_DEFAULT: MapBase = 'plan';

/** Fond d'une session : celui de sa fiche s'il existe, sinon celui de sa famille. */
export const resolveMapBase = (sessionBase: unknown, familyBase: MapBase): MapBase => (isMapBase(sessionBase) ? sessionBase : familyBase);

/** Vrai pour un fond de cette version ; un fond retiré, rangé dans une fiche ou un réglage, n'en est plus un. */
export const isMapBase = (value: unknown): value is MapBase => typeof value === 'string' && Object.hasOwn(MAP_BASES, value);

/** Mention écrite sur l'image de partage : celle du fond, suivie de l'adresse de sa licence. */
export const shareCredit = (base: MapBase): string => `${MAP_BASES[base].credit} · ${MAP_BASES[base].creditUrl}`;

/** Adresses choisies sur l'appareil (Réglages › Cartes hors ligne), par fond ; absente ou vide : celle d'origine. */
export type TileUrlOverrides = Partial<Record<MapBase, string>>;

const TILE_MARKS = ['{z}', '{x}', '{y}'] as const;

/** Vrai pour une adresse web qui porte `{z}`, `{x}` et `{y}` une fois chacun, et aucun autre repère entre accolades (`{s}`…). */
export const isTileTemplate = (value: string): boolean => {
  if (!/^https?:\/\/\S+$/.test(value)) return false;
  const marks = value.match(/\{[^}]*\}/g) ?? [];
  return marks.length === TILE_MARKS.length && TILE_MARKS.every((mark) => marks.filter((m) => m === mark).length === 1);
};

/**
 * Gabarit d'adresse retenu pour un fond : celui saisi, s'il est une adresse web qui porte `{z}`, `{x}` et `{y}`,
 * sinon celui d'origine. Une adresse sans les trois repères donnerait la même image à toutes les cases, et la
 * garderait sous chacune de leurs clés.
 */
export const tileTemplate = (base: MapBase, overrides?: TileUrlOverrides): string => {
  const custom = overrides?.[base]?.trim() ?? '';
  return isTileTemplate(custom) ? custom : MAP_BASES[base].url;
};

/** Adresse d'une tuile d'après un gabarit (`{z}`, `{x}`, `{y}`). */
export const fillTileTemplate = (template: string, { z, x, y }: TileCoord): string =>
  template
    .replaceAll('{z}', String(z))
    .replaceAll('{x}', String(x))
    .replaceAll('{y}', String(y));

/** Adresse d'une tuile, d'après le gabarit d'origine du fond ou `template`. */
export const tileUrl = (base: MapBase, tile: TileCoord, template: string = MAP_BASES[base].url): string =>
  fillTileTemplate(template, tile);
