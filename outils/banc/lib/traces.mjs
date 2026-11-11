// Banc de test : les traces synthétiques, au même endroit. Voile et surf seulement (deux familles, §règle 13).
// Chaque fonction rend le texte d'un GPX (`<gpx>…</gpx>`) que `importGpx` de lib/cdp.mjs ou un `writeFileSync` posent
// tel quel ; ni aléa (le bruit vient d'un générateur à graine), ni dépendance : un même appel donne les mêmes octets.
// Les motifs viennent de `make-gpx.mjs` (voile, vent du nord) et de `surf.mjs` (phases à vitesse et cap constants) ;
// les scripts ne redéfinissent plus leur générateur.

/** Auteur de toutes les traces du banc. */
export const CREATEUR = 'banc';
/** Début par défaut : une heure fixe d'une session d'automne, jamais « maintenant » (sauf à le demander : `debutMs: Date.now()`). */
export const DEBUT_PAR_DEFAUT = Date.UTC(2026, 8, 20, 13, 0, 0);

const R = 6_371_000;
const M_PAR_DEGRE_LAT = 111_195;
const NS_FC = 'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"';
const RAD = Math.PI / 180;

/** Pseudo-aléa répétable dans [-1, 1] : la même trace d'un passage à l'autre. */
export const bruitDeGraine = (graine) => {
  let x = graine;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return (x / 4294967296) * 2 - 1;
  };
};

/**
 * L'en-tête commun et la fin : `type` null ou absent pour un GPX sans `<type>` (session à classer) ; `fc` ajoute
 * l'espace de noms des extensions de fréquence cardiaque.
 */
export const enveloppeGpx = ({ nom = 'Banc', type = null, fc = false }, points) => `<?xml version="1.0" encoding="UTF-8"?>\n`
  + `<gpx version="1.1" creator="${CREATEUR}" xmlns="http://www.topografix.com/GPX/1/1"${fc ? ` ${NS_FC}` : ''}>`
  + `<trk><name>${nom}</name>${type ? `<type>${type}</type>` : ''}<trkseg>\n${points.join('\n')}\n</trkseg></trk></gpx>\n`;

/** Un point : position, instant (ms), vitesse (m/s), cap éventuel (degrés, `<course>`), altitude et FC éventuelles. */
export const pointGpx = ({ lat, lon, ms, vitesse, cap = null, alt = null, fc = null }) => `<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">`
  + `${alt === null ? '' : `<ele>${alt.toFixed(1)}</ele>`}<time>${new Date(ms).toISOString()}</time>`
  + `<extensions><speed>${typeof vitesse === 'number' ? vitesse.toFixed(2) : vitesse}</speed>${cap === null ? '' : `<course>${cap}</course>`}`
  + `${fc === null ? '' : `<gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(fc)}</gpxtpx:hr></gpxtpx:TrackPointExtension>`}</extensions></trkpt>`;

/**
 * Voile : bords de près (cap 45 puis 315) et de portant (135 puis 225), virements et empannages, vent du nord ; le
 * motif de `make-gpx.mjs`, à `hz` Hz. `bords` bords de chaque sorte (6 : 3 750 points à 1 Hz) ; avec `secondes`, le
 * motif se répète, coupé net à cette durée (le premier point est à t = 0, le dernier à `secondes` − 1/hz).
 * `sauter` : fonction du temps (s) vers vrai pour omettre le point (un trou de trace, le temps continue). `fc` : fonction du temps (s) vers la FC. `type` : calcul de base de la
 * session (`wingfoil`, `kite`, `windsurf`, `boat`…), null pour un GPX sans type. `virageMin` : vitesse la plus basse
 * d'un virement de près (m/s).
 */
export const traceVoile = ({ debutMs = DEBUT_PAR_DEFAUT, type = 'wingfoil', nom = 'Banc', hz = 1, bords = 6, secondes = null,
  virageMin = 5, lat0 = 43.5, lon0 = 3.95, fc = null, sauter = null } = {}) => {
  let lat = lat0;
  let lon = lon0;
  let t = 0;
  const dt = 1 / hz;
  const pts = [];
  const pas = (cap, vitesse) => {
    if (secondes !== null && t >= secondes) return;
    const d = vitesse * dt;
    lat += (d * Math.cos(cap * RAD)) / R / RAD;
    lon += (d * Math.sin(cap * RAD)) / (R * Math.cos(lat * RAD)) / RAD;
    if (!sauter?.(t)) pts.push(pointGpx({ lat, lon, ms: debutMs + Math.round(t * 1000), vitesse, fc: fc ? fc(t) : null }));
    t += dt;
  };
  const bord = (cap, vitesse, n) => { for (let i = 0; i < n * hz; i++) pas(cap + Math.sin(i / (7 * hz)) * 3, vitesse + Math.sin(i / (5 * hz)) * 0.5); };
  const virage = (de, a, vMin, vMax, n) => {
    const diff = ((a - de + 540) % 360) - 180;
    for (let i = 1; i <= n * hz; i++) {
      const f = i / (n * hz);
      pas((de + diff * f + 360) % 360, vMax - (vMax - vMin) * Math.sin(Math.PI * f));
    }
  };
  const motif = () => {
    for (let k = 0; k < bords; k++) { bord(45, 7, 150); virage(45, 315, virageMin, 7, 6); bord(315, 7, 150); virage(315, 45, virageMin, 7, 6); }
    virage(45, 135, 6, 9, 5);
    for (let k = 0; k < bords; k++) { bord(135, 9, 150); virage(135, 225, 6, 9, 6); bord(225, 9, 150); virage(225, 135, 6, 9, 6); }
  };
  if (secondes === null) motif();
  else {
    while (t < secondes) {
      motif();
      virage(135, 45, 6, 9, 5);
    }
  }
  return enveloppeGpx({ nom, type, fc: Boolean(fc) }, pts);
};

/**
 * Surf : phases `[durée en s, vitesse en m/s, cap]` à vitesse et cap constants (le cap est omis, donc nord, et
 * n'est écrit que si la vitesse est positive) ; le nord est le large. Le premier point est à l'arrêt.
 */
export const traceSurf = ({ debutMs = DEBUT_PAR_DEFAUT, phases, type = 'surf', nom = 'Banc', hz = 1, lat0 = 43.4, lon0 = 3.6, fc = null }) => {
  let lat = lat0;
  let lon = lon0;
  let t = 0;
  const pts = [];
  const pousse = (vitesse, cap) => pts.push(pointGpx({ lat, lon, ms: debutMs + Math.round(t * 1000), vitesse: vitesse.toString(), cap: vitesse > 0 ? cap : null, fc: fc ? fc(t) : null }));
  pousse(0, 0);
  for (const [s, vitesse, cap = 0] of phases) {
    for (let k = 0; k < s * hz; k++) {
      const d = vitesse / hz;
      lat += (d * Math.cos(cap * RAD)) / M_PAR_DEGRE_LAT;
      lon += (d * Math.sin(cap * RAD)) / (M_PAR_DEGRE_LAT * Math.cos(lat * RAD));
      t += 1 / hz;
      pousse(vitesse, cap);
    }
  }
  return enveloppeGpx({ nom, type, fc: Boolean(fc) }, pts);
};

/**
 * Une longue session pour les mesures de fluidité : `heures` h à `hz` Hz. En surf, une rame, une attente au pic et
 * une vague de 12 s toutes les 5 min (bruit à graine) ; sinon, la voile de `traceVoile` répétée. `fc` : fonction du
 * temps (s) vers la FC.
 */
export const traceLongue = (heures, hz = 1, type = 'wingfoil', { debutMs = DEBUT_PAR_DEFAUT, nom = `Banc ${heures} h`, fc = null } = {}) => {
  const secondes = Math.round(heures * 3600);
  if (type !== 'surf') return traceVoile({ debutMs, type, nom, hz, secondes, virageMin: 3, fc });
  const bruit = bruitDeGraine(4);
  let lat = 43.4;
  let lon = 3.6;
  const pts = [];
  for (let k = 0; k < secondes * hz; k++) {
    const t = k / hz;
    const cycle = t % 300;
    const vague = cycle >= 280 && cycle < 292;
    const rame = cycle < 90 || cycle >= 292;
    const vitesse = (vague ? 5.5 : rame ? 1.1 : 0.15) + 0.1 * bruit();
    const cap = vague ? 180 : rame ? 0 : 90;
    lat += (vitesse / hz * Math.cos(cap * RAD)) / M_PAR_DEGRE_LAT;
    lon += (vitesse / hz * Math.sin(cap * RAD)) / (M_PAR_DEGRE_LAT * Math.cos(lat * RAD));
    pts.push(pointGpx({ lat, lon, ms: debutMs + Math.round(t * 1000), vitesse, cap, fc: fc ? fc(t) : null }));
  }
  return enveloppeGpx({ nom, type, fc: Boolean(fc) }, pts);
};

/** Une session de voile sans `<type>` : la bibliothèque la propose « à classer ». */
export const traceSansType = (options = {}) => traceVoile({ ...options, type: null });
