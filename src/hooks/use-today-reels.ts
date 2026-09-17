import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { localDateKey, readDay, readDaySync, subscribe } from '@/lib/usage-store';

/**
 * Today's reel count, from the device's own store and never the network.
 *
 * The first render reads it synchronously, so the number is right from the
 * first frame instead of a zero that jumps. After that it refreshes when this
 * app records a count, and whenever the app comes back to the foreground,
 * which is both when the counting service will have added reels and when a new
 * day may have started.
 */
export function useTodayReels(): number {
  const [reels, setReels] = useState(() => readDaySync(localDateKey()));

  useEffect(() => {
    const refresh = () => {
      readDay(localDateKey()).then(setReels, () => {});
    };

    const unsubscribe = subscribe(refresh);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => {
      unsubscribe();
      appState.remove();
    };
  }, []);

  return reels;
}
