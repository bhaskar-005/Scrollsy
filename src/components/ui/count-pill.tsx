import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';

import { Bevel, Fonts, Gradients, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Gradients run bottom to top, same as the buttons. */
const gradientStart = { x: 0, y: 1 };
const gradientEnd = { x: 0, y: 0 };

type CountPillProps = {
  count: number;
  /**
   * `hero` leads a screen. `compact` is the same pill at the size it floats
   * over another app while you scroll.
   */
  size?: 'hero' | 'compact';
  style?: ViewStyle;
};

/**
 * The count and nothing else, built like a button so it reads as part of the
 * app rather than part of whatever it is floating over. Same shell everywhere
 * it shows up, so the floating counter is already familiar the first time it
 * appears over another app.
 */
export function CountPill({ count, size = 'hero', style }: CountPillProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const compact = size === 'compact';

  return (
    <LinearGradient
      colors={Gradients.accentShell}
      start={gradientStart}
      end={gradientEnd}
      style={[styles.shell, style]}>
      <LinearGradient
        colors={Gradients.accentFace}
        start={gradientStart}
        end={gradientEnd}
        style={[styles.face, compact && styles.faceCompact]}>
        <Text style={[styles.count, compact && styles.countCompact]}>{count}</Text>
      </LinearGradient>
    </LinearGradient>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    shell: {
      alignSelf: 'center',
      padding: 2,
      borderRadius: Radius.pill,
      /** A tight contact shadow, then a wide soft one to lift it off the page. */
      boxShadow: [
        { offsetX: 0, offsetY: 3, blurRadius: 6, color: c.shadowNear },
        { offsetX: 0, offsetY: 12, blurRadius: 24, color: c.shadowFar },
      ],
    },
    face: {
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      /** Light bevel on the top inside edge, dark one along the bottom. */
      boxShadow: [
        { offsetX: 0, offsetY: 1.5, blurRadius: 0, color: Bevel.top, inset: true },
        { offsetX: 0, offsetY: -2, blurRadius: 0, color: Bevel.bottom, inset: true },
      ],
    },
    faceCompact: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
    },
    count: {
      color: Gradients.onGradient,
      fontSize: 26,
      lineHeight: 32,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: -0.5,
      /** Depth in the type, so it sits in the fill rather than on it. */
      textShadowColor: Bevel.label,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    countCompact: {
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: 0,
    },
  });
