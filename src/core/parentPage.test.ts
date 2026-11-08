import { describe, expect, it } from 'vitest';
import { analysisPath, libraryPath, parentPage, sessionFamily } from './parentPage';

describe('parentPage', () => {
  it("rien au-dessus de l'accueil", () => {
    expect(parentPage('/', '')).toBeNull();
  });

  it("l'analyse renvoie à la bibliothèque de sa famille", () => {
    expect(parentPage('/voile/analyse', '?session=a.gpx')).toBe('/voile');
    expect(parentPage('/surf/analyse', '?session=d.gpx')).toBe('/surf');
  });

  it("l'analyse rend le filtre d'activité de la bibliothèque d'où l'on vient (lot 158)", () => {
    expect(parentPage('/surf/analyse', '?session=b.gpx&activite=a-surf-foil')).toBe('/surf?activite=a-surf-foil');
    expect(analysisPath('surf', 'b.gpx', 'a-surf-foil')).toBe('/surf/analyse?session=b.gpx&activite=a-surf-foil');
    expect(analysisPath('surf', 'b.gpx', null)).toBe('/surf/analyse?session=b.gpx');
    expect(analysisPath('surf', null, 'a-surf-foil')).toBe('/surf/analyse');
  });

  it('le test de FC repos remonte au Profil (lot 301) ; les pages retirées de l\'Entraînement, à l\'accueil (lot 302)', () => {
    expect(parentPage('/profil/fc-repos', '')).toBe('/profil');
    expect(parentPage('/profil/fc-repos/', '?vitesse=10')).toBe('/profil');
    expect(parentPage('/fractionne/seances', '')).toBe('/');
    expect(parentPage('/fractionne/tests/fc-max', '')).toBe('/');
    expect(parentPage('/course/seances', '')).toBe('/');
  });

  it('une leçon des tutoriels remonte à leur liste, la liste à Réglages (lot 147)', () => {
    expect(parentPage('/tutoriels/enregistrer', '')).toBe('/tutoriels');
    expect(parentPage('/tutoriels/voile/', '')).toBe('/tutoriels');
    expect(parentPage('/tutoriels', '')).toBe('/parametres');
  });

  it("Enregistrer renvoie à l'accueil, ancien mode Timer compris (lot 302)", () => {
    expect(parentPage('/enregistrer', '?minuterie=1')).toBe('/');
    expect(parentPage('/enregistrer', '?activite=a-course')).toBe('/');
  });

  it("une bibliothèque renvoie à l'accueil, filtre compris", () => {
    expect(parentPage('/voile', '')).toBe('/');
    expect(parentPage('/course', '?activite=a-marche')).toBe('/');
    expect(parentPage('/velo', '?vue=planifiees')).toBe('/');
  });

  it("les autres pages renvoient à l'accueil, anciennes analyses de la terre comprises (lot 305)", () => {
    for (const p of ['/course/analyse', '/velo/analyse', '/fractionne/analyse', '/enregistrer', '/profil', '/parametres', '/itineraires', '/itineraires/liste', '/inconnue', '/voile/autre']) {
      expect(parentPage(p, '')).toBe('/');
    }
    expect(parentPage('/itineraires', '?itineraire=x')).toBe('/');
  });

  it('les Statistiques remontent d\'un cran, la période gardée', () => {
    expect(parentPage('/statistiques', '?famille=voile&activite=kite&periode=annee')).toBe('/statistiques?famille=voile&periode=annee');
    expect(parentPage('/statistiques', '?famille=voile&activite=kite')).toBe('/statistiques?famille=voile');
    expect(parentPage('/statistiques', '?famille=voile&periode=annee')).toBe('/statistiques?periode=annee');
    expect(parentPage('/statistiques', '?famille=velo')).toBe('/statistiques');
    expect(parentPage('/statistiques', '?periode=annee')).toBe('/');
    expect(parentPage('/statistiques', '')).toBe('/');
  });

  it('une barre oblique finale ne change rien', () => {
    expect(parentPage('/voile/analyse/', '')).toBe('/voile');
    expect(parentPage('/statistiques/', '?famille=surf')).toBe('/statistiques');
  });
});

describe('chemins de la bibliothèque et des analyses (lot 72)', () => {
  it("ouvre la bibliothèque d'une famille, filtrée sur une activité", () => {
    expect(libraryPath('voile')).toBe('/voile');
    expect(libraryPath('surf', 'a-paddle é')).toBe('/surf?activite=a-paddle%20%C3%A9');
  });

  it("ouvre l'analyse d'une famille, sur une session si elle est donnée", () => {
    expect(analysisPath('voile')).toBe('/voile/analyse');
    expect(analysisPath('surf', '2026-09-23 surf.gpx')).toBe('/surf/analyse?session=2026-09-23%20surf.gpx');
    expect(parentPage('/surf/analyse', '?session=x')).toBe('/surf');
  });

  it('range une session dans la famille de son calcul, une session à classer dans celle donnée', () => {
    expect(sessionFamily({ record: { sport: 'kite' } }, 'surf')).toBe('voile');
    expect(sessionFamily({ record: { sport: null } }, 'voile')).toBe('voile');
    expect(sessionFamily(undefined, 'surf')).toBe('surf');
  });
});
