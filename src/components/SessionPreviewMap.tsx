import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '../core/activities';
import { createHeldCache } from '../core/heldCache';
import { t } from '../core/i18n';
import { MAP_BASES } from '../core/mapBase';
import type { SportFamily } from '../core/sportProfiles';
import { coloredSegments } from '../core/trackColor';
import { useElementSize } from '../hooks/useElementSize';
import { useNearViewport } from '../hooks/useNearViewport';
import { readSessionGpx } from '../hooks/useSessionLibrary';
import { activitySpeedRanges } from '../hooks/useSportSettings';
import { useAppliedTheme } from '../hooks/useTheme';
import { previewImageKey } from '../library/previewImages';
import { previewImageStore } from '../library/previewImageStore';
import { previewStore } from '../library/previewStore';
import { previewFingerprint, previewKey, roundPreviewPoints, type PreviewTrack } from '../library/previewTracks';
import type { LibrarySession } from '../library/record';
import { sessionColorTrack, sessionSpeedRange, type SessionColorTrack } from '../library/sessionTrack';
import { drawTrackPreview, thinForPreview, trackPreviewView } from './drawTrackPreview';
import './SessionPreviewMap.css';

/** Mention des vignettes (toujours sur le plan, `drawTrackPreview`), « © » puis le nom, en couleur de lien comme sur la carte. */
const [PREVIEW_CREDIT_MARK, ...previewCreditName] = MAP_BASES.plan.credit.split(' ');
const PREVIEW_CREDIT_NAME = previewCreditName.join(' ');

/** Marge sous l'écran où une vignette se charge déjà, pour être prête quand on y arrive. */
const PREVIEW_PRELOAD_MARGIN = '200px';

/**
 * Ce qu'il faut savoir d'une trace pour cadrer et colorer sa vignette :
 * emprise et, en voile, bornes suggérées par l'allure. La clé tient tout ce
 * dont la trace dépend ; un GPX rangé n'est jamais réécrit.
 */
type PreviewMeta = Pick<SessionColorTrack, 'bounds' | 'suggested'>;
const previewMeta = new Map<string, PreviewMeta>();
const PREVIEW_META_MAX = 400;

/**
 * Points des vignettes déjà calculées : revenir sur la liste des sessions, ou
 * changer de bornes ou de taille, ne relit ni ne réanalyse le GPX. Chaque
 * trace est gardée réduite au zoom de sa vignette (`zoom`, `Infinity` pour les
 * points entiers tirés du GPX) ; une vignette d'un zoom plus fort relit le
 * GPX. Au plus `PREVIEW_POINTS_MAX` points en tout, les moins récents oubliés
 * d'abord. D'un lancement à l'autre, les traces réduites sont gardées sur
 * l'appareil (`previewStore`) : au lancement suivant, une vignette
 * trouvée là se dessine sans relire le GPX.
 */
const previewPoints = new Map<string, { points: SessionColorTrack['points']; zoom: number }>();
const PREVIEW_POINTS_MAX = 400_000;
let previewPointCount = 0;

const rememberMeta = (key: string, meta: PreviewMeta): void => {
  previewMeta.delete(key);
  if (previewMeta.size >= PREVIEW_META_MAX) previewMeta.delete(previewMeta.keys().next().value!);
  previewMeta.set(key, meta);
};

const rememberPoints = (key: string, points: SessionColorTrack['points'], zoom: number): void => {
  previewPointCount -= previewPoints.get(key)?.points.length ?? 0;
  previewPoints.delete(key);
  previewPoints.set(key, { points, zoom });
  previewPointCount += points.length;
  for (const [oldest, entry] of previewPoints) {
    if (previewPointCount <= PREVIEW_POINTS_MAX || oldest === key) break;
    previewPoints.delete(oldest);
    previewPointCount -= entry.points.length;
  }
};

/**
 * Vignettes dessinées (PNG en adresse d'objet), en mémoire le temps de la
 * page. La clé (`previewImageKey`) tient la session, la trace, la taille, la
 * densité de l'écran, le thème économe et les bornes de couleur ; une
 * vignette affichée n'est jamais libérée. D'un lancement à l'autre, l'image
 * finie (trace sur son fond, toutes tuiles présentes) est gardée sur
 * l'appareil sous la même clé (`previewImageStore`), jamais dans la
 * fiche ; en économe, rien n'est gardé (pas de fond à attendre).
 */
const previewImages = createHeldCache<string>(200, (url) => URL.revokeObjectURL(url));

/**
 * Vignette carte d'une session, toujours affichée à droite de ses chiffres :
 * quand la ligne approche de l'écran, le GPX est relu une fois, et la trace,
 * réduite au demi-pixel près à l'échelle de la vignette, est dessinée sur son
 * fond en une image fixe (`drawTrackPreview`), au cadrage et à la coloration
 * de l'analyse ; redessinée seulement si la vignette change de taille ou la
 * trace de bornes. Aucune carte vivante : une longue liste reste
 * légère. Un toucher ouvre l'analyse. En économe (choix du produit), la
 * trace seule, sur le fond noir des cartes de la page, sans le plan d'OSM.
 * `family` : celle de la session (`sessionFamily`), qui entre dans les clés et les empreintes des vignettes gardées.
 */
function SessionPreviewMap({ session, activity, family, folderLabel, onOpen }: {
  session: LibrarySession;
  activity: Activity | null;
  family: SportFamily;
  /** Dossier mémoire en service : un autre dossier peut avoir un fichier de même nom. */
  folderLabel: string | null;
  onOpen: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const { eco } = useAppliedTheme();
  const size = useElementSize(frame);
  const { file } = session;
  const sport = session.record.sport;
  const referenceOverrideMs = session.record.analysis?.referenceSpeedMs ?? null;
  const cacheKey = `${folderLabel}|${file}|${sport}|${referenceOverrideMs}|${family}`;
  /** Clé et empreinte de la trace gardée sur l'appareil. */
  const storeKey = previewKey(folderLabel, file);
  const { startMs, endMs, pointCount } = session.record.summary;
  const fingerprint = previewFingerprint({ sport, referenceOverrideMs, family, summary: { startMs, endMs, pointCount } });
  /** Emprise et bornes suggérées tirées du GPX par cette vignette, pour sa clé. */
  const [loaded, setLoaded] = useState<{ key: string; meta: PreviewMeta } | null>(null);
  const meta = previewMeta.get(cacheKey) ?? (loaded?.key === cacheKey ? loaded.meta : null);
  // Déjà calculée, rien à attendre.
  const near = useNearViewport(frame, meta !== null, PREVIEW_PRELOAD_MARGIN);
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * Trace de la vignette, gardée pour elle : celle gardée sur l'appareil si
   * elle est réduite à `minZoom` ou plus fin, sinon tirée du GPX comme
   * l'analyse la calcule (points entiers, zoom `Infinity`) ; `null` si elle
   * manque ou est illisible.
   */
  const loadTrack = useCallback(async (minZoom: number): Promise<PreviewTrack | null> => {
    const kept = await previewStore.stored(storeKey, fingerprint);
    if (kept && kept.zoom >= minZoom) {
      rememberMeta(cacheKey, { bounds: kept.bounds, suggested: kept.suggested });
      rememberPoints(cacheKey, kept.points, kept.zoom);
      return kept;
    }
    const gpx = await readSessionGpx(file);
    if (gpx === null) return null;
    try {
      const track = sessionColorTrack(gpx, sport, referenceOverrideMs, family);
      if (!track) return null;
      rememberMeta(cacheKey, { bounds: track.bounds, suggested: track.suggested });
      // Points entiers, réduits au premier dessin.
      rememberPoints(cacheKey, track.points, Infinity);
      return { ...track, zoom: Infinity };
    } catch {
      return null;
    }
  }, [file, sport, referenceOverrideMs, family, cacheKey, storeKey, fingerprint]);

  useEffect(() => {
    if (!near || meta) return undefined;
    let cancelled = false;
    // Emprise seule : toute trace gardée convient, quel que soit son zoom.
    void loadTrack(0).then((track) => {
      if (cancelled) return;
      if (track) setLoaded({ key: cacheKey, meta: { bounds: track.bounds, suggested: track.suggested } });
      else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [near, meta, cacheKey, loadTrack]);

  const range = useMemo(
    () => (meta ? sessionSpeedRange(session.record, activity ? activitySpeedRanges(activity) : null, family, meta.suggested) : null),
    [meta, session, activity, family]
  );
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const minMs = range?.minMs ?? null;
  const maxMs = range?.maxMs ?? null;

  useEffect(() => {
    if (!meta || minMs === null || maxMs === null || width < 1 || height < 1) return undefined;
    const view = trackPreviewView(meta.bounds, width, height);
    if (!view) return undefined;
    const pixelRatio = window.devicePixelRatio || 1;
    const imageKey = previewImageKey({ cacheKey, fingerprint, width, height, pixelRatio, eco, minMs, maxMs });
    const controller = new AbortController();
    let held = false;
    let draft: string | null = null;
    const dropDraft = () => {
      if (draft) URL.revokeObjectURL(draft);
      draft = null;
    };
    /**
     * Points réduits une fois au zoom de la vignette, puis gardés ainsi ; arrondis avant le premier dessin à la
     * précision gardée sur l'appareil, pour que le lancement suivant dessine la même image. Tirés du GPX, ils y sont gardés.
     */
    const thinned = (stored: { points: SessionColorTrack['points']; zoom: number }): SessionColorTrack['points'] => {
      if (stored.zoom === view.zoom) return stored.points;
      const points = roundPreviewPoints(thinForPreview(stored.points, view));
      rememberPoints(cacheKey, points, view.zoom);
      if (stored.zoom === Infinity) void previewStore.keep(storeKey, fingerprint, { zoom: view.zoom, bounds: meta.bounds, suggested: meta.suggested, points });
      return points;
    };
    void (async () => {
      const cached = previewImages.acquire(imageKey);
      if (cached) {
        held = true;
        setImage(cached);
        return;
      }
      // Image finie gardée sur l'appareil : montrée d'un coup, sans image d'attente ni tuile à relire.
      if (!eco) {
        const kept = await previewImageStore.stored(storeKey, imageKey);
        if (controller.signal.aborted) return;
        if (kept) {
          held = true;
          setImage(previewImages.put(imageKey, URL.createObjectURL(kept)));
          // Trace oubliée du magasin des traces mais image gardée : l'emprise vient d'être relue du GPX, la trace réduite y retourne.
          const whole = previewPoints.get(cacheKey);
          if (whole?.zoom === Infinity) thinned(whole);
          return;
        }
      }
      let stored = previewPoints.get(cacheKey);
      if (!stored || stored.zoom < view.zoom) {
        // Zoom de la trace rendue, pas `Infinity` d'office : celle gardée sur l'appareil est déjà réduite.
        const track = await loadTrack(view.zoom);
        stored = track ? { points: track.points, zoom: track.zoom } : undefined;
      }
      if (controller.signal.aborted) return;
      if (!stored) {
        setFailed(true);
        return;
      }
      const points = thinned(stored);
      const drawn = await drawTrackPreview(
        { view, segments: coloredSegments(points, { minMs, maxMs }), pixelRatio, withMap: !eco },
        {
          signal: controller.signal,
          onTrace: (trace) => {
            dropDraft();
            draft = URL.createObjectURL(trace);
            setImage(draft);
          },
        }
      );
      if (controller.signal.aborted || !drawn) return;
      held = true;
      setImage(previewImages.put(imageKey, URL.createObjectURL(drawn.png)));
      // Gardée pour le lancement suivant si son fond est entier (une tuile manquante hors réseau : non).
      if (!eco && drawn.complete) void previewImageStore.keep(storeKey, imageKey, drawn.png);
      // L'image d'attente, remplacée, part après le rendu.
      setTimeout(dropDraft, 0);
    })();
    return () => {
      controller.abort();
      dropDraft();
      if (held) previewImages.release(imageKey);
    };
  }, [meta, minMs, maxMs, width, height, eco, cacheKey, loadTrack, storeKey, fingerprint]);

  return (
    <div ref={frame} className="lib-row__preview" role="link" aria-label={t("Ouvrir l'analyse")} onClick={onOpen}>
      {image ? (
        <>
          <img className="lib-row__preview-image" src={image} alt="" draggable={false} />
          {/* Mention qu'exigent les conditions d'usage du plan, celle de l'image de partage, sans lien : un toucher ouvre l'analyse. */}
          {!eco && <span className="lib-row__preview-credit">{PREVIEW_CREDIT_MARK} <span className="lib-row__preview-credit-name">{PREVIEW_CREDIT_NAME}</span></span>}
        </>
      ) : (
        <span className="lib-row__preview-status">{failed ? t('Carte indisponible') : t('Carte…')}</span>
      )}
    </div>
  );
}

export default SessionPreviewMap;
