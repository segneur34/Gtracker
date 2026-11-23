import { plainError } from '../platform/errorText';
import { t } from '../core/i18n';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FAMILY_ACCENT } from '../core/activities';
import { pickShareStats, SHARE_IMAGE, type ShareStat } from '../core/shareImage';
import type { SportFamily } from '../core/sportProfiles';
import type { RouteShareContent } from '../planning/routeShareImage';
import { useMapBase } from '../hooks/useMapBase';
import { readAthleteProfile } from '../hooks/useAthleteProfile';
import { athleteName } from '../library/athleteProfile';
import { shareFile } from '../platform/share';
import { jsonStore } from '../platform/storage';
import { lightToken } from '../theme/lightToken';
import { createTileImageLoader, drawShareImage } from './drawShareImage';
import { IconShare } from './icons';
import type { TrackSegment } from './TrackSegmentsLayer';
import Button from './ui/Button';
import Dialog from './ui/Dialog';
import './ShareDialog.css';
import { STORAGE_KEYS } from '../core/appIdentity';

/** Choix retenus sur l'appareil, par activité : les chiffres de l'image et le fond de carte. */
const STORAGE_KEY = STORAGE_KEYS.partage;

interface ShareChoice {
  /** Clés des chiffres retenus ; absent, les premiers de la synthèse (`pickShareStats`). */
  stats?: string[];
  map?: boolean;
}

const readChoice = (activityId: string): ShareChoice =>
  jsonStore.read<Record<string, ShareChoice>>(STORAGE_KEY)?.[activityId] ?? {};

const writeChoice = (activityId: string, choice: ShareChoice): void =>
  jsonStore.write(STORAGE_KEY, { ...jsonStore.read<Record<string, ShareChoice>>(STORAGE_KEY), [activityId]: choice });

interface ShareDialogProps {
  family: SportFamily;
  /** Fichier de la session dans la mémoire : son fond de carte (fiche) est celui de l'image ; sans lui, celui de la famille. */
  file?: string;
  /** Activité de la session (ou son calcul, sans activité) : clé du choix retenu. */
  activityId: string;
  /** Titre de l'image : nom de la session, ou de l'activité. */
  title: string;
  /** Activité et date, sous le titre. */
  subtitle: string;
  /** Nom du fichier partagé, sans extension. */
  fileName: string;
  segments: ReadonlyArray<TrackSegment>;
  /** Chiffres de la synthèse de la session, parmi lesquels l'utilisateur choisit. */
  stats: ReadonlyArray<ShareStat>;
  /** Chiffres fixes : tous sur l'image, sans choix à faire. */
  fixedStats?: boolean;
  /** Parcours d'un itinéraire, dessiné à la place de la trace. */
  course?: RouteShareContent;
  /** Couleur du liseré ; sans elle, celle de la famille. */
  accent?: string;
  /** Texte de l'image, porté par l'aperçu ; sans lui, une phrase générique. */
  description?: string;
  onClose: () => void;
}

/**
 * Fenêtre « Partager l'image » : l'aperçu de l'image (trace, fond de
 * carte, chiffres), les chiffres à y mettre et le fond, retenus par activité
 * sur l'appareil (six chiffres au plus), et le bouton qui ouvre le menu de partage du téléphone
 * (`platform/share.ts`). Ouverte depuis le « … » de l'analyse et des cartes de fin d'enregistrement ;
 * celle d'un itinéraire (`RouteImageShare`) montre son parcours et ses chiffres fixes, seul le fond se choisit.
 */
function ShareDialog({
  family, file, activityId, title, subtitle, fileName, segments, stats, fixedStats, course, accent, description, onClose,
}: ShareDialogProps) {
  const [choice, setChoice] = useState<ShareChoice>(() => readChoice(activityId));
  /** Nom ou pseudo de Réglages, au pied de l'image. */
  const [author] = useState(() => athleteName(readAthleteProfile()));
  /** Dernière image dessinée, et ce qu'elle montre (`drawKey`). */
  const [image, setImage] = useState<{ blob: Blob; url: string; key: string } | null>(null);
  /** Échec du dessin, pour ce qu'il devait montrer. */
  const [failure, setFailure] = useState<{ text: string; key: string } | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  /** Fond de carte de la session, celui de l'analyse (sinon de la famille). */
  const [base] = useMapBase(family, file);
  const tileImage = useMemo(() => createTileImageLoader(base), [base]);
  const withMap = choice.map ?? true;
  const chosen = fixedStats ? stats.slice(0, SHARE_IMAGE.maxStats) : pickShareStats(stats, choice.stats ?? null);
  /** Ce que l'image montre, en texte : un rendu de l'analyse (survol d'un graphe) ne la redessine pas. */
  const drawKey = JSON.stringify([chosen, withMap, base]);
  const drawing = image?.key !== drawKey && failure?.key !== drawKey;

  const update = (next: ShareChoice) => {
    setChoice(next);
    writeChoice(activityId, next);
  };

  const toggleStat = (key: string) => {
    const current = choice.stats ?? chosen.map((s) => s.key);
    update({ ...choice, stats: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] });
  };

  useEffect(() => {
    let cancelled = false;
    // Couleur de la famille dans la palette claire : l'image reste claire en thème sombre.
    const edge = accent ?? lightToken(`--${family}`, '#000000');
    const [shown, map] = JSON.parse(drawKey) as [ShareStat[], boolean];
    drawShareImage({ title, subtitle, accent: edge, segments, stats: shown, withMap: map, base, author, course }, tileImage)
      .then((blob) => {
        if (cancelled) return;
        setImage((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return { blob, url: URL.createObjectURL(blob), key: drawKey };
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailure({ text: plainError(err, t('Image impossible à produire.')), key: drawKey });
      });
    return () => {
      cancelled = true;
    };
  }, [family, title, subtitle, segments, drawKey, tileImage, base, author, course, accent]);

  /** Aperçu libéré à la fermeture. */
  const imageRef = useRef(image);
  useEffect(() => {
    imageRef.current = image;
  });
  useEffect(() => () => {
    if (imageRef.current) URL.revokeObjectURL(imageRef.current.url);
  }, []);

  const share = async () => {
    if (!image) return;
    setNote(null);
    try {
      const outcome = await shareFile(image.blob, `${fileName}.png`, t("Partager l'image"));
      if (outcome === 'downloaded') setNote({ text: t("Ce navigateur ne partage pas d'image : elle est téléchargée."), error: false });
    } catch (err) {
      setNote({ text: t('Partage impossible : {reason}', { reason: plainError(err, t('erreur inconnue')) }), error: true });
    }
  };

  return (
    <Dialog title={t("Partager l'image")} onClose={onClose} className="share-dialog">

      <div className="share-dialog__preview" aria-busy={drawing}>
        {image
          ? <img src={image.url} alt={description ?? t("Aperçu de l'image partagée")} style={{ opacity: drawing ? 0.5 : 1 }} />
          : <span className="share-dialog__wait">{t("Préparation de l'image…")}</span>}
      </div>

      {/* Sans trace ni parcours, pas de fond de carte à choisir. */}
      {(segments.length > 0 || course !== undefined) && (
        <label className="share-dialog__check">
          <input type="checkbox" checked={withMap} onChange={(e) => update({ ...choice, map: e.target.checked })} />
          {t('Fond de carte')}
        </label>
      )}

      {!fixedStats && stats.length > 0 && (
        <div>
          <div className="share-dialog__label">{t("Chiffres sur l'image ({count} sur {max} au plus)", { count: chosen.length, max: SHARE_IMAGE.maxStats })}</div>
          <div className="ui-tabs ui-tabs--compact" role="group" aria-label={t("Chiffres sur l'image")}
            style={{ '--tab-accent': FAMILY_ACCENT[family] } as CSSProperties}>
            {stats.map((stat) => {
              const on = chosen.some((s) => s.key === stat.key);
              return (
                <button key={stat.key} type="button" className="ui-tab" aria-pressed={on}
                  disabled={!on && chosen.length >= SHARE_IMAGE.maxStats} onClick={() => toggleStat(stat.key)}>
                  {stat.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {failure?.key === drawKey && <div role="status" className="ui-alert ui-alert--danger">{failure.text}</div>}
      {note && <div role="status" className={note.error ? 'ui-alert ui-alert--danger' : 'share-dialog__note'}>{note.text}</div>}

      <div className="share-dialog__actions">
        <Button variant="ghost" onClick={onClose}>{t('Fermer')}</Button>
        <Button variant="primary" disabled={!image || image.key !== drawKey} onClick={() => void share()}>
          <IconShare size={18} />
          {t('Partager')}
        </Button>
      </div>
    </Dialog>
  );
}

export default ShareDialog;
