import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { hasAccess } from '@/lib/permissions';
import { readProfile, setPreferences } from '@/lib/profile';

type Access = { screenTime: boolean; overlay: boolean };

const read = (): Access => ({
  screenTime: hasAccess('screenTime'),
  overlay: hasAccess('overlay'),
});

/**
 * What Android currently allows, re-read every time the app comes back to the
 * front, which is exactly when a trip to Settings ends.
 *
 * Android is the only truth here. The matching account fields are kept in step
 * with it rather than the other way round, so a permission turned off in
 * Settings months later shows as off here too.
 */
export function useAccess(): Access & { recheck: () => void } {
  const [access, setAccess] = useState(read);

  /** Keeps the old object when nothing moved, so nothing downstream re-runs. */
  const recheck = useCallback(() => {
    setAccess((current) => {
      const next = read();
      return current.screenTime === next.screenTime && current.overlay === next.overlay
        ? current
        : next;
    });
  }, []);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        recheck();
      }
    });
    return () => appState.remove();
  }, [recheck]);

  /** Writes only when the account disagrees, so a resume usually costs nothing. */
  useEffect(() => {
    const profile = readProfile();
    const changed = {
      ...(profile.screenTimeGranted !== access.screenTime
        ? { screenTimeGranted: access.screenTime }
        : {}),
      ...(profile.overlayGranted !== access.overlay ? { overlayGranted: access.overlay } : {}),
    };
    if (Object.keys(changed).length > 0) {
      setPreferences(changed);
    }
  }, [access]);

  return { ...access, recheck };
}
