package io.github.segneur.gtracker;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * La garde contre un enregistrement jamais repris, application fermée, avec les valeurs de l'enregistrement :
 * arrêt après 1 h sans s'éloigner de 200 m, ou 12 h après la fermeture. Les positions sont posées le long d'un
 * méridien : un degré de latitude y vaut 111,2 km.
 */
public class ClosedGuardTest {

    private static final double RADIUS_M = 200.0;
    private static final long STILL_MS = 3_600_000L;
    private static final long MAX_MS = 12 * 3_600_000L;
    private static final double LAT = 48.0;
    private static final double LON = -4.0;
    private static final double NONE = Double.NaN;

    private static ClosedGuard guard() {
        return new ClosedGuard(RADIUS_M, STILL_MS, MAX_MS);
    }

    /** Latitude à `meters` au nord du point de départ. */
    private static double north(double meters) {
        return LAT + meters / 111_195.0;
    }

    @Test
    public void distanceDuGrandCercle() {
        assertEquals(0.0, ClosedGuard.distanceM(LAT, LON, LAT, LON), 1e-9);
        assertEquals(250.0, ClosedGuard.distanceM(LAT, LON, north(250), LON), 0.5);
        // À 48° de latitude, un degré de longitude est plus court qu'un degré de latitude.
        assertEquals(111_195.0 * Math.cos(Math.toRadians(LAT)), ClosedGuard.distanceM(LAT, LON, LAT, LON + 1), 50.0);
    }

    @Test
    public void rienTantQueLaPageEstLa() {
        ClosedGuard guard = guard();
        for (long t = 0; t <= 2 * MAX_MS; t += 600_000L) {
            guard.onFix(t, LAT, LON, 5);
            assertNull(guard.check(t));
        }
        assertFalse(guard.closed());
    }

    @Test
    public void arretApresUneHeureSurPlaceA1HzCommeA5Hz() {
        for (long stepMs : new long[] { 1000L, 200L }) {
            ClosedGuard guard = guard();
            guard.onFix(0, LAT, LON, 5);
            guard.onClosed(10_000L);
            assertTrue(guard.closed());
            // Le téléphone bouge un peu, sans sortir du rayon.
            for (long t = 10_000L + stepMs; t < 10_000L + STILL_MS; t += stepMs) {
                guard.onFix(t, north((t / stepMs) % 2 == 0 ? 150 : -40), LON, 5);
            }
            assertNull(guard.check(10_000L + STILL_MS - 1));
            assertEquals(FixLog.STOP_STILL, guard.check(10_000L + STILL_MS));
        }
    }

    @Test
    public void sEloignerRelanceLeCompteDepuisLeNouveauPoint() {
        ClosedGuard guard = guard();
        guard.onFix(0, LAT, LON, 5);
        guard.onClosed(0);
        // Une navigation : 5 m/s vers le nord pendant deux heures, jamais une heure dans le même rayon.
        long t = 0;
        for (; t <= 2 * STILL_MS; t += 1000L) {
            guard.onFix(t, north(5.0 * t / 1000.0), LON, 5);
            assertNull(guard.check(t));
        }
        // Puis le téléphone reste posé : arrêt une heure après le dernier départ d'un rayon.
        double restLat = north(5.0 * (t - 1000L) / 1000.0);
        long rest = t;
        for (; t < rest + STILL_MS; t += 1000L) guard.onFix(t, restLat, LON, 5);
        assertEquals(FixLog.STOP_STILL, guard.check(t));
    }

    @Test
    public void juste200MetresNeSuffitPas() {
        ClosedGuard guard = guard();
        guard.onFix(0, LAT, LON, 5);
        guard.onClosed(0);
        guard.onFix(1000L, north(199), LON, 5);
        assertEquals(FixLog.STOP_STILL, guard.check(STILL_MS));
        ClosedGuard gone = guard();
        gone.onFix(0, LAT, LON, 5);
        gone.onClosed(0);
        gone.onFix(1000L, north(205), LON, 5);
        assertNull(gone.check(STILL_MS));
        assertEquals(FixLog.STOP_STILL, gone.check(1000L + STILL_MS));
    }

    @Test
    public void positionTropIncertaineNeProuveAucunDepart() {
        ClosedGuard guard = guard();
        guard.onFix(0, LAT, LON, 5);
        guard.onClosed(0);
        // Un saut de 1 km donné à 500 m près, téléphone à l'abri : l'ancrage ne bouge pas.
        guard.onFix(1_800_000L, north(1000), LON, 500);
        assertEquals(FixLog.STOP_STILL, guard.check(STILL_MS));
        // Sans incertitude donnée, la position compte.
        ClosedGuard unknown = guard();
        unknown.onFix(0, LAT, LON, 5);
        unknown.onClosed(0);
        unknown.onFix(1_800_000L, north(1000), LON, NONE);
        assertNull(unknown.check(STILL_MS));
    }

    @Test
    public void sansAucunePositionLeCompteCourtDepuisLaFermeture() {
        ClosedGuard guard = guard();
        guard.onClosed(5000L);
        assertNull(guard.check(5000L + STILL_MS - 1));
        assertEquals(FixLog.STOP_STILL, guard.check(5000L + STILL_MS));
        // Une première position tardive fixe l'ancrage sans relancer le compte.
        ClosedGuard late = guard();
        late.onClosed(5000L);
        late.onFix(1_800_000L, LAT, LON, 5);
        assertEquals(FixLog.STOP_STILL, late.check(5000L + STILL_MS));
    }

    @Test
    public void dureeMaximaleApresLaFermetureMemeEnNaviguant() {
        ClosedGuard guard = guard();
        guard.onFix(0, LAT, LON, 5);
        guard.onClosed(0);
        // Un départ toutes les demi-heures : jamais « sur place », mais douze heures sans rouvrir.
        for (long t = 0; t < MAX_MS; t += 1_800_000L) {
            guard.onFix(t, north(300.0 * (t / 1_800_000L)), LON, 5);
            assertNull(guard.check(t + 1_799_999L));
        }
        assertEquals(FixLog.STOP_TIMEOUT, guard.check(MAX_MS));
    }

    @Test
    public void retourDeLaPageRemetToutAZero() {
        ClosedGuard guard = guard();
        guard.onFix(0, LAT, LON, 5);
        guard.onClosed(0);
        guard.onClosed(1_000_000L);
        assertEquals("Fermée deux fois : le premier compte tient.", FixLog.STOP_STILL, guard.check(STILL_MS));
        guard.onOpened();
        assertFalse(guard.closed());
        assertNull(guard.check(10 * MAX_MS));
        // Refermée plus tard : les deux comptes repartent de cette fermeture, ancrés à la dernière position connue.
        long closedAgain = 20 * MAX_MS;
        guard.onClosed(closedAgain);
        assertNull(guard.check(closedAgain + STILL_MS - 1));
        guard.onFix(closedAgain + 1000L, north(150), LON, 5);
        assertEquals(FixLog.STOP_STILL, guard.check(closedAgain + STILL_MS));
    }

    @Test
    public void valeurNulleEteintSaRegle() {
        ClosedGuard noStill = new ClosedGuard(0, 0, MAX_MS);
        noStill.onFix(0, LAT, LON, 5);
        noStill.onClosed(0);
        assertNull(noStill.check(MAX_MS - 1));
        assertEquals(FixLog.STOP_TIMEOUT, noStill.check(MAX_MS));
        ClosedGuard noMax = new ClosedGuard(RADIUS_M, STILL_MS, 0);
        noMax.onClosed(0);
        for (long t = 0; t <= 3 * MAX_MS; t += 1_800_000L) noMax.onFix(t, north(300.0 * (t / 1_800_000L)), LON, 5);
        assertNull(noMax.check(3 * MAX_MS));
        ClosedGuard none = new ClosedGuard(0, 0, 0);
        none.onClosed(0);
        assertNull(none.check(100 * MAX_MS));
    }
}
