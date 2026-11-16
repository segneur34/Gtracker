import { useCallback, useEffect, useState } from 'react';
import { onAppResume, readAutostart, readPermissions } from '../platform/permissions';
import { autostartState, type AutostartState, type PermissionsStatus } from '../recording/permissionsPrompt';

/**
 * État des autorisations du téléphone et du démarrage automatique (`null` hors de Xiaomi), relus au retour au
 * premier plan (après un écran système) ; `status` vaut `null` tant qu'il n'est pas lu.
 */
export function usePermissions(): {
  status: PermissionsStatus | null;
  autostart: AutostartState | null;
  refresh: () => Promise<PermissionsStatus>;
} {
  const [status, setStatus] = useState<PermissionsStatus | null>(null);
  const [autostart, setAutostart] = useState<AutostartState | null>(null);
  const apply = useCallback((next: PermissionsStatus, raw: Awaited<ReturnType<typeof readAutostart>>) => {
    setStatus(next);
    setAutostart(autostartState(raw));
    return next;
  }, []);
  const refresh = useCallback(async () => {
    const [next, raw] = await Promise.all([readPermissions(), readAutostart()]);
    return apply(next, raw);
  }, [apply]);
  useEffect(() => {
    void Promise.all([readPermissions(), readAutostart()]).then(([next, raw]) => apply(next, raw));
    return onAppResume(() => void refresh());
  }, [apply, refresh]);
  return { status, autostart, refresh };
}
