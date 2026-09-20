import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toAppUsage, type AppUsage } from '@/constants/apps';
import { localDateKey, readApps, subscribe } from '@/lib/usage-store';

/**
 * Which apps today's reels came from, most first, from the device's own store.
 *
 * The same numbers as `useTodayReels`, only split up, so the row under the
 * count always adds up to the count above it. Refreshed on the same two
 * signals: a reel landing, and the app coming back to the front, which is when
 * the service will have added what it counted while this was closed.
 */
export function useTodayApps(): AppUsage[] {
  const [apps, setApps] = useState<AppUsage[]>([]);

  useEffect(() => {
    let live = true;

    const read = () => {
      const today = localDateKey();
      readApps(today, today).then((totals) => {
        if (live) {
          setApps(toAppUsage(totals));
        }
      }, () => {});
    };

    read();
    const unsubscribe = subscribe(read);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        read();
      }
    });

    return () => {
      live = false;
      unsubscribe();
      appState.remove();
    };
  }, []);

  return apps;
}
