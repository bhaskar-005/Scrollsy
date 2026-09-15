import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = {
  children: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Frosted panel that sits over whatever the screen is standing on. */
export function Card({ children, selected = false, onPress, style }: CardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const body = (pressed: boolean) => (
    <View style={[styles.card, selected && styles.selected, pressed && styles.pressed, style]}>
      {children}
    </View>
  );

  if (!onPress) {
    return body(false);
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: c.border,
      padding: Spacing.four,
    },
    selected: {
      borderColor: c.borderActive,
      backgroundColor: c.surfaceStrong,
    },
    pressed: {
      opacity: 0.88,
    },
  });
