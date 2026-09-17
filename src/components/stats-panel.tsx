import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, StatTile } from '@/components/ui';
import { stageLabel } from '@/constants/stages';
import { Fonts, Gradients, Spacing, type Palette } from '@/constants/theme';
import type { UsageWeek } from '@/hooks/use-usage-week';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Gradients run bottom to top, same as everywhere else the accent fill shows up. */
const barStart = { x: 0, y: 1 };
const barEnd = { x: 0, y: 0 };

/**
 * The three tiles and the week chart. Every number comes from the device's own
 * store, so it is the same count the home screen is showing.
 */
export function StatsPanel({ week, dailyLimit }: { week: UsageWeek; dailyLimit: number }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /** A week of zeroes would divide by zero, and every bar is flat anyway. */
  const peak = Math.max(...week.days.map((day) => day.reels), 1);

  return (
    <View style={styles.panel}>
      <View style={styles.tiles}>
        <StatTile value={week.average} label={t('profile.averageADay')} compact />
        <StatTile value={week.best} label={t('profile.bestDay')} compact />
        <StatTile value={stageLabel(week.worstStage)} label={t('profile.worstStage')} compact />
      </View>

      <Card style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={styles.chartTitle}>{t('profile.lastSevenDays')}</Text>
          <Text style={styles.chartLimit}>{t('profile.limit', { reels: dailyLimit })}</Text>
        </View>

        <View style={styles.chart}>
          {week.days.map((day) => (
            <View key={day.date} style={styles.column}>
              <Text style={styles.columnValue}>{day.reels}</Text>
              <View style={styles.barTrack}>
                <LinearGradient
                  colors={Gradients.accentFace}
                  start={barStart}
                  end={barEnd}
                  style={[styles.bar, { height: `${(day.reels / peak) * 100}%` }]}
                />
              </View>
              <Text style={styles.columnDay}>{day.label}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    panel: {
      gap: Spacing.four,
    },
    tiles: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    chartCard: {
      gap: Spacing.three,
    },
    chartHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    chartTitle: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    chartLimit: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    chart: {
      flexDirection: 'row',
      gap: Spacing.two,
      height: 132,
    },
    column: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.one,
    },
    columnValue: {
      color: c.textSecondary,
      fontSize: 11,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    barTrack: {
      flex: 1,
      alignSelf: 'stretch',
      justifyContent: 'flex-end',
      backgroundColor: c.track,
      borderRadius: 5,
      overflow: 'hidden',
    },
    bar: {
      width: '100%',
      borderRadius: 5,
    },
    columnDay: {
      color: c.textFaint,
      fontSize: 12,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
  });
