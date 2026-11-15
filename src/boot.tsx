import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { confirmLeave, installLeaveGuard } from './hooks/leaveGuard';
import { startLiveRecording } from './hooks/useLiveRecording';
import { startMarkGuide } from './hooks/useMarkGuide';
import { startRecordingNotification } from './hooks/recordingNotification';
import { retrySetAsideJournals } from './hooks/setAsideJournals';
import { isRecordingActive, recoverInterruptedRecording, subscribeToRecorder } from './hooks/useRecorder';
import { openLibrary, startIncomingFiles, startLibraryUi } from './hooks/useSessionLibrary';
import { importRouteGpx } from './hooks/routeFiles';
import { incomingFiles } from './platform/incomingFile';
import { startBeepSound } from './hooks/useSportSettings';
import { startTheme } from './hooks/useTheme';
import { installBackButton } from './platform/backButton';
import { clearStaleScreenOn, resetOrientationLock } from './platform/screen';

/**
 * Démarrage de l'application, chargé par l'amorçage (`main.tsx`) une fois le stockage en mémoire et la langue posée :
 * tout module importé d'ici lit déjà la bonne langue, tables de module comprises.
 */

/**
 * Attente maximale de la mémoire avant le premier rendu. Au-delà, l'interface
 * s'affiche quand même et la liste des sessions arrive ensuite.
 */
const LIBRARY_OPEN_WAIT_MS = 1500;

/** Thème suivi, mémoire ouverte (ou attendue un temps), puis premier rendu et services de fond. */
export const startApp = async (): Promise<void> => {
  // Un journal mis de côté après cet instant attend le lancement suivant (`retrySetAsideJournals`).
  const launchedAtMs = Date.now();
  // Le stockage est chargé : le thème est reposé d'après son réglage, puis suivi.
  startTheme();
  resetOrientationLock();
  // La mémoire aussi, si possible : les réglages repris de son dossier `reglages/` sont alors en place.
  await Promise.race([openLibrary(), new Promise((resolve) => setTimeout(resolve, LIBRARY_OPEN_WAIT_MS))]);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  startLibraryUi(isRecordingActive);
  installLeaveGuard();
  // Pendant un enregistrement, la touche retour met l'application en arrière-plan.
  void installBackButton(() => isRecordingActive(), confirmLeave);
  // Un enregistrement coupé reprend seul si son service a survécu à la page ; sinon, ou arrêté sans décision, il revient en attente.
  const recovered = recoverInterruptedRecording();
  // Bips d'approche des balises, pendant un enregistrement de voile qui suit un parcours.
  startMarkGuide();
  // Une fois l'enregistrement tranché : l'écran allumé d'une session close est rendu.
  const afterRecovery = () => {
    if (!isRecordingActive()) clearStaleScreenOn();
    // Journaux mis de côté lors d'un lancement précédent : retentés, ou rendus dans le dossier mémoire ; jamais pendant
    // un enregistrement. Celui que la reprise vient de mettre de côté attend le suivant, comme son message le dit.
    void retrySetAsideJournals(isRecordingActive, launchedAtMs);
    // Fichiers reçus d'une autre application : rangés hors enregistrement, un enregistrement repris les fait attendre.
    // Un GPX d'itinéraire va dans les itinéraires.
    void startIncomingFiles(isRecordingActive, subscribeToRecorder, incomingFiles, importRouteGpx);
  };
  void recovered.then(afterRecovery, afterRecovery);
  // Statistiques du direct, lues par la page Enregistrer et par la notification.
  startLiveRecording();
  // Notification de l'enregistrement, écran verrouillé : chiffres choisis dans Réglages.
  startRecordingNotification();
  // Son de tous les bips (grave à très aigu), choisi dans Réglages.
  startBeepSound();
};
