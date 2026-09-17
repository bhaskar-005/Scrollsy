import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { readAppearance, subscribe } from '@/lib/appearance';

/**
 * The scheme every palette is chosen from. The phone's own setting, unless
 * someone picked one in Settings, in which case theirs wins everywhere the
 * moment they pick it.
 */
export function useColorScheme() {
  const system = useRNColorScheme();
  const chosen = useSyncExternalStore(subscribe, readAppearance, readAppearance);

  return chosen === 'system' ? system : chosen;
}
