package io.github.segneur.gtracker;

/**
 * Garde contre un enregistrement jamais repris, application fermée : le service s'arrête seul quand le téléphone
 * ne s'est pas éloigné de plus de `radiusM` pendant `stillDelayMs`, ou `maxClosedMs` après la fermeture. Elle ne
 * compte que tant que la page est absente ; son retour remet tout à zéro. Rayon et durées viennent de la page, au
 * départ (`RecordingProfile` de src/core/sportProfiles.ts) ; une valeur nulle ou négative éteint sa règle.
 *
 * « Ne pas s'éloigner » se juge depuis un point d'ancrage : la dernière position connue à la fermeture, puis chaque
 * position qui s'en écarte de plus du rayon, qui devient l'ancrage et relance le compte. Une position dont
 * l'incertitude dépasse le rayon ne prouve aucun départ : elle ne déplace pas l'ancrage. Sans aucune position
 * (téléphone à l'abri, GPS muet), rien ne prouve un départ non plus : le compte court depuis la fermeture.
 *
 * Machine pure, sans API d'Android, sur l'horloge monotone du téléphone (ClosedGuardTest).
 */
final class ClosedGuard {

    private static final long NONE = -1L;
    private static final double EARTH_RADIUS_M = 6_371_000.0;

    private final double radiusM;
    private final long stillDelayMs;
    private final long maxClosedMs;

    private boolean hasLast = false;
    private double lastLat;
    private double lastLon;
    private long closedSinceMs = NONE;
    private boolean hasAnchor = false;
    private double anchorLat;
    private double anchorLon;
    private long anchorSinceMs = NONE;

    ClosedGuard(double radiusM, long stillDelayMs, long maxClosedMs) {
        this.radiusM = radiusM;
        this.stillDelayMs = stillDelayMs;
        this.maxClosedMs = maxClosedMs;
    }

    /** Vrai tant que la page est absente. */
    boolean closed() {
        return closedSinceMs != NONE;
    }

    /** La page s'en va à `nowMs` : les deux comptes partent, ancrés à la dernière position connue. Sans effet si elle l'était déjà. */
    void onClosed(long nowMs) {
        if (closed()) return;
        closedSinceMs = nowMs;
        anchorSinceMs = nowMs;
        hasAnchor = hasLast;
        anchorLat = lastLat;
        anchorLon = lastLon;
    }

    /** La page revient : plus de garde. */
    void onOpened() {
        closedSinceMs = NONE;
        anchorSinceMs = NONE;
        hasAnchor = false;
    }

    /** Une position reçue à `nowMs` ; `accuracyM` : son incertitude, `Double.NaN` si le téléphone ne la donne pas. */
    void onFix(long nowMs, double lat, double lon, double accuracyM) {
        hasLast = true;
        lastLat = lat;
        lastLon = lon;
        if (!closed()) return;
        if (!hasAnchor) {
            // Première position depuis la fermeture : elle fixe l'ancrage, le compte court déjà.
            hasAnchor = true;
            anchorLat = lat;
            anchorLon = lon;
            return;
        }
        boolean proves = Double.isNaN(accuracyM) || accuracyM <= radiusM;
        if (proves && distanceM(anchorLat, anchorLon, lat, lon) > radiusM) {
            anchorLat = lat;
            anchorLon = lon;
            anchorSinceMs = nowMs;
        }
    }

    /** Raison d'arrêter à `nowMs` : FixLog.STOP_STILL, FixLog.STOP_TIMEOUT, ou `null` s'il faut continuer. */
    String check(long nowMs) {
        if (!closed()) return null;
        if (radiusM > 0 && stillDelayMs > 0 && nowMs - anchorSinceMs >= stillDelayMs) return FixLog.STOP_STILL;
        if (maxClosedMs > 0 && nowMs - closedSinceMs >= maxClosedMs) return FixLog.STOP_TIMEOUT;
        return null;
    }

    /** Distance du grand cercle entre deux points, en mètres. */
    static double distanceM(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dPhi = phi2 - phi1;
        double dLambda = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }
}
