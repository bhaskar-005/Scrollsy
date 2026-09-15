import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, StatTile } from '@/components/ui';
import { Profile, Week } from '@/constants/placeholder';
import { stageLabel } from '@/constants/stages';
import { Fonts, Gradients, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const peak = Math.max(...Week.map((day) => day.reels));

/** Gradients run bottom to top, same as everywhere else the accent fill shows up. */
const barStart = { x: 0, y: 1 };
const barEnd = { x: 0, y: 0 };

/**
 * The three tiles and the week chart, lifted out of the old Profile tab when
 * Settings replaced it. Nothing renders this yet. It is parked here until we
 * decide which screen it belongs on.
 */
export function StatsPanel() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.panel}>
      <View style={styles.tiles}>
        <StatTile value={Profile.avgPerDay} label={t('profile.averageADay')} compact />
        <StatTile value={Profile.bestDay} label={t('profile.bestDay')} compact />
        <StatTile value={stageLabel(Profile.worstStage)} label={t('profile.worstStage')} compact />
      </View>

      <Card style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={styles.chartTitle}>{t('profile.lastSevenDays')}</Text>
          <Text style={styles.chartLimit}>{t('profile.limit', { reels: Profile.dailyLimit })}</Text>
        </View>

        <View style={styles.chart}>
          {Week.map((day, index) => (
            <View key={`${day.day}-${index}`} style={styles.column}>
              <Text style={styles.columnValue}>{day.reels}</Text>
              <View style={styles.barTrack}>
                <LinearGradient
                  colors={Gradients.accentFace}
                  start={barStart}
                  end={barEnd}
                  style={[styles.bar, { height: `${(day.reels / peak) * 100}%` }]}
                />
              </View>
              <Text style={styles.columnDay}>{day.day}</Text>
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
