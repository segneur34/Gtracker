// Banc de test : faux service de lieux. Les requêtes au service Photon (recherche inverse du lieu d'une session) sont
// interceptées (`Fetch`) et servies par une réponse enregistrée, sans jamais toucher au réseau ; chacune est notée.
// Usage : `const lieux = await fakePlaces(b)` après `connect` (le service, bloqué d'office, est alors débloqué pour être
// servi ici) ; `lieux.count()`, `lieux.list()` et `lieux.reset()` autour d'une séquence ; `lieux.setMode('panne')` fait
// échouer les requêtes comme un réseau coupé, `'reponse'` rend `lieux.setAnswer(json)` (par défaut `PLAGE`).
// `Fetch.enable` ne garde que ses derniers motifs : ne pas l'employer avec `lib/tuiles.mjs` dans le même onglet.
import { PLACES_URL } from './cdp.mjs';

/** Réponse enregistrée d'une recherche inverse près de Carnon : une rue, le village, la plage à 300 m. */
export const PLAGE = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [3.9715, 43.5492] }, properties: { osm_key: 'highway', osm_value: 'residential', name: 'Avenue Grassion Cibrand', city: 'Mauguio', country: 'France' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [3.9800, 43.5480] }, properties: { osm_key: 'place', osm_value: 'village', name: 'Carnon-Plage', city: 'Mauguio', country: 'France' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [3.9740, 43.5465] }, properties: { osm_key: 'natural', osm_value: 'beach', name: 'Plage du Petit Travers', city: 'Mauguio', country: 'France' } },
  ],
};

/**
 * Intercepte le service de lieux de l'onglet `b` (rendu de `connect`). Rend `count()` (requêtes depuis `reset`),
 * `list()` (leurs adresses), `reset()`, `setMode(mode)` (`reponse` ou `panne`, lu au moment de répondre) et
 * `setAnswer(json)`.
 */
export const fakePlaces = async (b) => {
  let requests = [];
  let mode = 'reponse';
  let answer = PLAGE;
  b.onMessage((msg) => {
    if (msg.method !== 'Fetch.requestPaused') return;
    const p = msg.params;
    if (!/photon\.komoot\.io/.test(p.request.url)) {
      void b.send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => undefined);
      return;
    }
    requests.push(p.request.url);
    const reply = mode === 'panne'
      ? b.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' })
      : b.send('Fetch.fulfillRequest', {
        requestId: p.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Cache-Control', value: 'no-store' },
        ],
        body: Buffer.from(JSON.stringify(answer)).toString('base64'),
      });
    void reply.catch(() => undefined);
  });
  await b.send('Fetch.enable', { patterns: [{ urlPattern: PLACES_URL, requestStage: 'Request' }] });
  await b.allowPlaces();
  return {
    count: () => requests.length,
    list: () => [...requests],
    reset: () => { requests = []; },
    setMode: (next) => { mode = next; },
    setAnswer: (json) => { answer = json; },
  };
};
