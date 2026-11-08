import { plainError } from './platform/errorText';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './theme/tokens.css';
import './theme/base.css';
import './components/ui/ui.css';
import './components/AppShell.css';
import { confirmLeave, installLeaveGuard } from './hooks/leaveGuard';
import { startLiveRecording } from './hooks/useLiveRecording';
import { startMarkGuide } from './hooks/useMarkGuide';
import { startZoneAlertGuide } from './hooks/useZoneAlert';
import { startRecordingNotification } from './hooks/recordingNotification';
import { isRecordingActive, recoverInterruptedRecording, subscribeToRecorder } from './hooks/useRecorder';
import { openLibrary, reportStartupError, settingsUpgraded, startIncomingFiles, startLibraryUi } from './hooks/useSessionLibrary';
import { importRouteGpx } from './hooks/routeFiles';
import { incomingFiles } from './platform/incomingFile';
import { startBeepSound, upgradeStoredActivities, upgradeStoredPresets } from './hooks/useSportSettings';
import { forgetFormerAnalysisTabs } from './hooks/useOpenSections';
import { startTheme } from './hooks/useTheme';
import { installBackButton } from './platform/backButton';
import { clearStaleScreenOn, resetOrientationLock } from './platform/screen';
import { initStorage } from './platform/storage';

/**
 * Attente maximale de la mémoire avant le premier rendu. Au-delà, l'interface
 * s'affiche quand même et la liste des sessions arrive ensuite.
 */
const LIBRARY_OPEN_WAIT_MS = 1500;

// Thème posé tout de suite, sans attendre le stockage : dans le navigateur, le réglage est déjà lisible ; sur le
// téléphone, « Auto » (le défaut) suit déjà le système. Reposé une fois le stockage natif chargé.
startTheme();

// Le stockage natif doit être en mémoire avant le premier rendu : les hooks
// le lisent pendant le rendu (`platform/storage.ts`). La mémoire aussi, si
// possible : les réglages repris de son dossier `reglages/` sont alors en place.
void initStorage()
  .then(() => {
    startTheme();
    resetOrientationLock();
    return Promise.race([openLibrary(), new Promise((resolve) => setTimeout(resolve, LIBRARY_OPEN_WAIT_MS))]);
  })
  .then(() => {
    // Liste d'activités et pré-réglages d'une version d'avant mis à jour, une fois les réglages du dossier repris ;
    // le fichier de l'appareil suit. Les deux mises à jour se font, d'où les deux appels avant le test. Une mise à
    // jour qui lève (réglages d'une forme inattendue) est dite, et l'interface s'affiche quand même.
    let upgradeError: unknown = null;
    const upgrade = (run: () => boolean): boolean => {
      try {
        return run();
      } catch (err) {
        upgradeError ??= err;
        return false;
      }
    };
    const activitiesUpgraded = upgrade(upgradeStoredActivities);
    const presetsUpgraded = upgrade(upgradeStoredPresets);
    if (activitiesUpgraded || presetsUpgraded) void settingsUpgraded();
    // Onglets ouverts que les analyses retenaient avant le 05/11 : effacés une fois.
    upgrade(() => {
      forgetFormerAnalysisTabs();
      return false;
    });
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    startLibraryUi(isRecordingActive);
    if (upgradeError !== null) {
      const detail = plainError(upgradeError, 'erreur inconnue');
      reportStartupError(`Réglages de l'appareil non mis à jour pour cette version : ${detail}`);
    }
    installLeaveGuard();
    // Pendant un enregistrement, la touche retour met l'application en arrière-plan.
    void installBackButton(() => isRecordingActive(), confirmLeave);
    // Un enregistrement coupé reprend seul si son service a survécu à la page ; sinon, ou arrêté sans décision, il revient en attente.
    const recovered = recoverInterruptedRecording();
    // Bips d'approche des balises, pendant un enregistrement de voile qui suit un parcours.
    startMarkGuide();
    // Bips de sortie de la zone cardiaque visée, pendant un enregistrement avec la ceinture.
    startZoneAlertGuide();
    // Une fois l'enregistrement tranché : l'écran allumé d'une session close est rendu.
    const afterRecovery = () => {
      if (!isRecordingActive()) clearStaleScreenOn();
      // Fichiers reçus d'une autre application : rangés hors enregistrement, un enregistrement repris les fait attendre.
      // Un GPX d'itinéraire va dans les itinéraires (lot 194).
      void startIncomingFiles(isRecordingActive, subscribeToRecorder, incomingFiles, importRouteGpx);
    };
    void recovered.then(afterRecovery, afterRecovery);
    // Statistiques du direct, lues par la page Enregistrer et par la notification.
    startLiveRecording();
    // Notification de l'enregistrement, écran verrouillé : chiffres choisis dans Réglages.
    startRecordingNotification();
    // Son de tous les bips (grave à très aigu), choisi dans Réglages.
    startBeepSound();
  });
