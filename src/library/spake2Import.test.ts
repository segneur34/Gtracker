import { describe, expect, it } from 'vitest';
import { conclure, confirmationValide, commencerAppairage } from '../../bureau/spake2';

// La page conduit l'appairage avec le même calcul que le programme Windows : le module du dossier bureau, importé
// tel quel, sans copie. Ce test garde que l'import passe la vérification de types de la page et s'exécute ici.
describe('calcul de l’appairage partagé avec le programme Windows', () => {
  it('s’importe depuis la page et conclut un échange', () => {
    const empreinte = new Uint8Array(32).fill(7);
    const a = commencerAppairage('A', '042917', empreinte, () => new Uint8Array(32).fill(1));
    const b = commencerAppairage('B', '042917', empreinte, () => new Uint8Array(32).fill(2));
    expect(confirmationValide(conclure(b, a.part), conclure(a, b.part).confirmationEnvoyee)).toBe(true);
  });
});
