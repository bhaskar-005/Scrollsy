import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { BackgroundArt, type Stage } from '@/constants/stages';
import { Gradients, MaxContentWidth, Spacing, type Palette } from '@/constants/theme';
import { PaletteContext, useTheme } from '@/hooks/use-theme';

type BackdropProps = {
  /**
   * Which plate sits behind the screen. Only Home passes one, because only
   * Home is telling you how deep he has drifted. Everywhere else stays flat.
   */
  background?: Stage;
  /**
   * Violet haze spilling down from the top edge, behind everything. Full bleed,
   * so it has to live out here rather than in the padded column. Every screen
   * gets it, so pass false only to turn it off.
   */
  glow?: boolean;
  children: ReactNode;
};

export function Backdrop({ background, glow = true, children }: BackdropProps) {
  const theme = useTheme(background ? 'dark' : undefined);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const content = (
    <View style={styles.root}>
      {background ? (
        <>
          <Image
            source={BackgroundArt[background]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient colors={Gradients.scrim} style={StyleSheet.absoluteFill} />
        </>
      ) : null}

      {glow ? (
        <LinearGradient
          colors={[theme.glow, theme.glowFade]}
          style={styles.glow}
          pointerEvents="none"
        />
      ) : null}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.column}>{children}</View>
      </SafeAreaView>
    </View>
  );

  /** A photo screen reads as dark whatever the device is set to. */
  if (!background) {
    return content;
  }

  return <PaletteContext.Provider value={theme}>{content}</PaletteContext.Provider>;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    /** Reaches just past halfway before it dies out. */
    glow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '52%',
    },
    safeArea: {
      flex: 1,
      alignItems: 'center',
      width: '100%',
    },
    column: {
      flex: 1,
      width: '100%',
      maxWidth: MaxContentWidth,
      paddingHorizontal: Spacing.four,
    },
  });
