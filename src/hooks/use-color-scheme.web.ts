import { useEffect, useState, useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { readAppearance, subscribe } from '@/lib/appearance';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const system = useRNColorScheme();
  const chosen = useSyncExternalStore(subscribe, readAppearance, () => 'system' as const);

  if (!hasHydrated) {
    return 'light';
  }

  return chosen === 'system' ? system : chosen;
}
