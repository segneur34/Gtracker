import { describe, expect, it } from 'vitest';
import { EMPTY_NOTES } from '../library/notes';
import { resolveGearReminderCloses, resetOverrides, withSetting, type StoredSettings } from './activitySettings';
import { GEAR_REMINDER_MAX_CLOSES, notesHaveGear, shouldRemindGear, type GearReminderInput } from './gearReminder';

const ready: GearReminderInput = { followsRecording: true, hasGearList: true, sessionHasGear: false, closes: 0, tabShown: true };

describe('rappel du matériel à l\'analyse', () => {
  it('s\'ouvre à l\'analyse qui suit un enregistrement, activité à liste, session sans matériel', () => {
    expect(shouldRemindGear(ready)).toBe(true);
  });

  it('ne s\'ouvre pas à la réouverture d\'une ancienne session', () => {
    expect(shouldRemindGear({ ...ready, followsRecording: false })).toBe(false);
  });

  it('ne s\'ouvre pas sans liste de matériel pour l\'activité', () => {
    expect(shouldRemindGear({ ...ready, hasGearList: false })).toBe(false);
  });

  it('ne s\'ouvre pas si la session porte déjà du matériel', () => {
    expect(shouldRemindGear({ ...ready, sessionHasGear: true })).toBe(false);
  });

  it('ne s\'ouvre pas si l\'onglet du matériel est caché pour l\'activité', () => {
    expect(shouldRemindGear({ ...ready, tabShown: false })).toBe(false);
  });

  it('s\'ouvre encore après une fermeture, plus après deux', () => {
    expect(GEAR_REMINDER_MAX_CLOSES).toBe(2);
    expect(shouldRemindGear({ ...ready, closes: 1 })).toBe(true);
    expect(shouldRemindGear({ ...ready, closes: 2 })).toBe(false);
    expect(shouldRemindGear({ ...ready, closes: 5 })).toBe(false);
  });
});

describe('matériel porté par les notes', () => {
  const piece = { groupId: 'g', groupName: 'Aile', itemId: 'i', itemName: '5 m' };

  it('rien : ni pièce, ni texte', () => {
    expect(notesHaveGear(EMPTY_NOTES, [{ field: 'wing' }])).toBe(false);
    expect(notesHaveGear({ ...EMPTY_NOTES, gear: [] }, [])).toBe(false);
  });

  it('une pièce choisie compte', () => {
    expect(notesHaveGear({ ...EMPTY_NOTES, gear: [piece] }, [])).toBe(true);
  });

  it('un texte saisi dans un champ de l\'activité compte, pas dans un autre', () => {
    expect(notesHaveGear({ ...EMPTY_NOTES, wing: '5 m²' }, [{ field: 'wing' }])).toBe(true);
    expect(notesHaveGear({ ...EMPTY_NOTES, wing: '  ' }, [{ field: 'wing' }])).toBe(false);
    expect(notesHaveGear({ ...EMPTY_NOTES, gear1: 'planche' }, [{ field: 'wing' }])).toBe(false);
  });
});

describe('compte des fermetures, rangé par activité', () => {
  it('vaut zéro sans compte ou avec un compte abîmé', () => {
    expect(resolveGearReminderCloses({}, 'wingfoil')).toBe(0);
    for (const bad of [-1, 1.5, '2', null, Number.NaN]) {
      expect(resolveGearReminderCloses({ gearReminderCloses: { wingfoil: bad as never } }, 'wingfoil')).toBe(0);
    }
  });

  it('s\'écrit sous l\'activité seule, sans toucher aux autres', () => {
    const base: StoredSettings = { gearReminderCloses: { kite: 1 } };
    const next = withSetting(base, 'wingfoil', 'gearReminderCloses', 1);
    expect(next?.gearReminderCloses).toEqual({ kite: 1, wingfoil: 1 });
    expect(resolveGearReminderCloses(next!, 'wingfoil')).toBe(1);
    expect(base.gearReminderCloses).toEqual({ kite: 1 });
  });

  it('refuse un compte négatif ou décimal', () => {
    expect(withSetting({}, 'wingfoil', 'gearReminderCloses', -1)).toBeNull();
    expect(withSetting({}, 'wingfoil', 'gearReminderCloses', 1.5)).toBeNull();
  });

  it('survit à « Par défaut » de l\'activité', () => {
    const stored: StoredSettings = { gearReminderCloses: { wingfoil: 2 }, thresholds: { wingfoil: 9 } };
    const reset = resetOverrides(stored, 'wingfoil');
    expect(reset.gearReminderCloses).toEqual({ wingfoil: 2 });
    expect(reset.thresholds).toEqual({});
  });
});
