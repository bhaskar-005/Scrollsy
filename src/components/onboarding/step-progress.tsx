import { StyleSheet, View } from 'react-native';

import { useMemo } from 'react';
import { type Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const TotalSteps = 6;

/** Six segments, filled up to the step you are on. */
export function StepProgress({ step }: { step: number }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {Array.from({ length: TotalSteps }, (_, i) => (
        <View key={i} style={[styles.segment, i < step && styles.filled]} />
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: Spacing.one,
      flex: 1,
    },
    segment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.track,
    },
    filled: {
      backgroundColor: c.accent,
    },
  });
