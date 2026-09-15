/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { createContext, useContext } from 'react';

import { Colors, type Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Lets a screen pin a palette for everything inside it. Home sets this to the
 * dark palette because it sits on a night sky photo, and dark copy would be
 * unreadable there whatever the device scheme says.
 */
export const PaletteContext = createContext<Palette | null>(null);

export function useTheme(pin?: keyof typeof Colors): Palette {
  const inherited = useContext(PaletteContext);
  const scheme = useColorScheme();

  if (pin) {
    return Colors[pin];
  }

  if (inherited) {
    return inherited;
  }

  return scheme === 'dark' ? Colors.dark : Colors.light;
}
