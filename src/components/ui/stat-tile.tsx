import { StyleSheet, Text, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/card';
import { useMemo } from 'react';
import { Fonts, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatTileProps = {
  value: string | number;
  label: string;
  /** Smaller type, for somewhere tight like a sheet. */
  compact?: boolean;
  style?: ViewStyle;
};

/** Value on top, label under it. Never a label with a colon. */
export function StatTile({ value, label, compact = false, style }: StatTileProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Card style={StyleSheet.flatten([styles.tile, compact && styles.tileCompact, style])}>
      <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      gap: Spacing.half,
      paddingVertical: Spacing.three,
    },
    tileCompact: {
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.two,
    },
    value: {
      color: c.text,
      fontSize: 24,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    valueCompact: {
      fontSize: 19,
    },
    label: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    labelCompact: {
      fontSize: 12,
    },
  });
