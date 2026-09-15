import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BadgeProps = {
  label: string;
  /** `accent` marks something paid. `outline` is a neutral chip. */
  tone?: 'accent' | 'outline';
  style?: ViewStyle;
};

export function Badge({ label, tone = 'accent', style }: BadgeProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={[styles.badge, tone === 'outline' && styles.outline, style]}>
      <Text style={[styles.label, tone === 'outline' && styles.outlineLabel]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: c.accent,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: 3,
    },
    outline: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: Spacing.three,
    },
    label: {
      color: c.onAccent,
      fontSize: 12,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    outlineLabel: {
      color: c.text,
      letterSpacing: 0,
    },
  });
