import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { readAppearance, subscribe } from '@/lib/appearance';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */

/** Hydration happens once and never again, so there is nothing to subscribe to. */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function useColorScheme() {
  /**
   * Whether this is the browser rather than the static render. Asked through
   * `useSyncExternalStore`, which already takes a server answer and a client
   * one, rather than through an effect that sets state on the first paint and
   * makes every page render twice.
   */
  const hasHydrated = useSyncExternalStore(neverChanges, onClient, onServer);

  const system = useRNColorScheme();
  const chosen = useSyncExternalStore(subscribe, readAppearance, () => 'system' as const);

  if (!hasHydrated) {
    return 'light';
  }

  return chosen === 'system' ? system : chosen;
}
