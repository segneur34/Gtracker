import { describe, expect, it } from 'vitest';
import { PROFILE_PATH, SESSIONS_PATH, SETTINGS_PAIRING_PATH, SETTINGS_SENSORS_PATH, SETTINGS_TRASH_PATH, analysisPath, parentPage, sessionFamily, sessionsPath, settingsBlockFromSearch } from './parentPage';

describe('settingsBlockFromSearch', () => {
  it("lit le bloc désigné par l'adresse de Réglages, rien sans paramètre", () => {
    expect(settingsBlockFromSearch(SETTINGS_SENSORS_PATH.slice(SETTINGS_SENSORS_PATH.indexOf('?')))).toBe('capteurs');
    expect(settingsBlockFromSearch('')).toBeNull();
    expect(settingsBlockFromSearch('?activite=x')).toBeNull();
  });
  it('Réglages ouverts par le lien de la ceinture renvoient à Enregistrer, sinon au Profil', () => {
    expect(parentPage('/parametres', '?bloc=capteurs')).toBe('/enregistrer');
    expect(parentPage('/parametres', '')).toBe(PROFILE_PATH);
  });
  it('Réglages ouverts pour relier un téléphone : le bloc « relier », retour ordinaire', () => {
    expect(settingsBlockFromSearch(SETTINGS_PAIRING_PATH.slice(SETTINGS_PAIRING_PATH.indexOf('?')))).toBe('relier');
    expect(parentPage('/parametres', '?bloc=relier')).toBe(PROFILE_PATH);
  });
  it('Réglages ouverts sur la corbeille renvoient à Sessions', () => {
    expect(settingsBlockFromSearch(SETTINGS_TRASH_PATH.slice(SETTINGS_TRASH_PATH.indexOf('?')))).toBe('corbeille');
    expect(parentPage('/parametres', '?bloc=corbeille')).toBe(SESSIONS_PATH);
  });
});

describe('parentPage', () => {
  it("Profil : rien au-dessus, ni à l'adresse /, qui y mène ; le retour quitte l'application", () => {
    expect(PROFILE_PATH).toBe('/profil');
    expect(parentPage('/', '')).toBeNull();
    expect(parentPage('/profil', '')).toBeNull();
    expect(parentPage('/profil/', '?x=1')).toBeNull();
  });

  it('Sessions remonte au Profil, filtre ou pas', () => {
    expect(parentPage('/sessions', '')).toBe('/profil');
    expect(parentPage('/sessions/', '?activite=kite')).toBe('/profil');
  });

  it('Planifier remonte à la liste des itinéraires, itinéraire ouvert compris ; la liste à Sessions', () => {
    expect(parentPage('/itineraires', '')).toBe('/itineraires/liste');
    expect(parentPage('/itineraires/', '')).toBe('/itineraires/liste');
    expect(parentPage('/itineraires', '?itineraire=x')).toBe('/itineraires/liste');
    expect(parentPage('/itineraires/liste', '')).toBe('/sessions');
    expect(parentPage('/itineraires/liste/', '')).toBe('/sessions');
    expect(parentPage('/itineraires-autre', '')).toBe('/profil');
  });

  it("l'analyse renvoie à Sessions, quelle que soit sa famille", () => {
    expect(parentPage('/voile/analyse', '?session=a.gpx')).toBe('/sessions');
    expect(parentPage('/surf/analyse', '?session=d.gpx')).toBe('/sessions');
  });

  it("l'analyse rend le filtre d'activité de la page Sessions d'où l'on vient", () => {
    expect(parentPage('/surf/analyse', '?session=b.gpx&activite=a-surf-foil')).toBe('/sessions?activite=a-surf-foil');
    expect(analysisPath('surf', 'b.gpx', 'a-surf-foil')).toBe('/surf/analyse?session=b.gpx&activite=a-surf-foil');
    expect(analysisPath('surf', 'b.gpx', null)).toBe('/surf/analyse?session=b.gpx');
    expect(analysisPath('surf', null, 'a-surf-foil')).toBe('/surf/analyse');
  });

  it('le test de FC repos remonte à Réglages, où est son entrée', () => {
    expect(parentPage('/profil/fc-repos', '')).toBe('/parametres');
    expect(parentPage('/profil/fc-repos/', '?vitesse=10')).toBe('/parametres');
    expect(parentPage('/profil/fc-repos/autre', '')).toBe('/profil');
  });

  it('une leçon des tutoriels remonte à leur liste, la liste à Réglages', () => {
    expect(parentPage('/tutoriels/enregistrer', '')).toBe('/tutoriels');
    expect(parentPage('/tutoriels/voile/', '')).toBe('/tutoriels');
    expect(parentPage('/tutoriels', '')).toBe('/parametres');
  });

  it("Enregistrer renvoie au Profil, filtre d'activité compris", () => {
    expect(parentPage('/enregistrer', '')).toBe('/profil');
    expect(parentPage('/enregistrer', '?activite=a-surf-foil')).toBe('/profil');
  });

  it('les anciennes adresses des bibliothèques renvoient au Profil, filtre compris', () => {
    expect(parentPage('/voile', '')).toBe('/profil');
    expect(parentPage('/surf', '?activite=a-surf-foil')).toBe('/profil');
    expect(parentPage('/voile', '?vue=planifiees')).toBe('/profil');
  });

  it('les autres pages, connues ou non, renvoient au Profil', () => {
    for (const p of ['/ski/analyse', '/parapente/seances', '/enregistrer', '/parametres', '/inconnue', '/voile/autre']) {
      expect(parentPage(p, '')).toBe('/profil');
    }
  });

  it('les Statistiques remontent d\'un cran, la période gardée', () => {
    expect(parentPage('/statistiques', '?famille=voile&activite=kite&periode=annee')).toBe('/statistiques?famille=voile&periode=annee');
    expect(parentPage('/statistiques', '?famille=voile&activite=kite')).toBe('/statistiques?famille=voile');
    expect(parentPage('/statistiques', '?famille=voile&periode=annee')).toBe('/statistiques?periode=annee');
    expect(parentPage('/statistiques', '?famille=surf')).toBe('/statistiques');
    expect(parentPage('/statistiques', '?periode=annee')).toBe('/profil');
    expect(parentPage('/statistiques', '')).toBe('/profil');
  });

  it('une barre oblique finale ne change rien', () => {
    expect(parentPage('/voile/analyse/', '')).toBe('/sessions');
    expect(parentPage('/statistiques/', '?famille=surf')).toBe('/statistiques');
  });
});

describe('chemins de la page Sessions et des analyses', () => {
  it('ouvre la page Sessions, filtrée sur une activité', () => {
    expect(SESSIONS_PATH).toBe('/sessions');
    expect(sessionsPath()).toBe('/sessions');
    expect(sessionsPath(null)).toBe('/sessions');
    expect(sessionsPath('a-paddle é')).toBe('/sessions?activite=a-paddle%20%C3%A9');
  });

  it("ouvre l'analyse d'une famille, sur une session si elle est donnée", () => {
    expect(analysisPath('voile')).toBe('/voile/analyse');
    expect(analysisPath('surf', '2026-09-23 surf.gpx')).toBe('/surf/analyse?session=2026-09-23%20surf.gpx');
    expect(parentPage('/surf/analyse', '?session=x')).toBe('/sessions');
  });

  it('range une session dans la famille de son calcul, une session à classer dans celle donnée', () => {
    expect(sessionFamily({ record: { sport: 'kite' } }, 'surf')).toBe('voile');
    expect(sessionFamily({ record: { sport: null } }, 'voile')).toBe('voile');
    expect(sessionFamily(undefined, 'surf')).toBe('surf');
  });
});
