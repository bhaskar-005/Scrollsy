import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Badge, Card, StatTile } from '@/components/ui';
import { AppBreakdownCard } from '@/components/app-breakdown';
import { Backdrop } from '@/components/backdrop';
import { MascotStage } from '@/components/mascot-stage';
import { ProUpsell } from '@/components/settings/pro-upsell';
import { Account, AppUsage, Today } from '@/constants/placeholder';
import { stageLabel } from '@/constants/stages';
import { useMemo } from 'react';
import { BottomTabInset, Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export default function HomeScreen() {
  // Home stands on a night sky photo, so it reads as dark in either scheme.
  const theme = useTheme('dark');
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { width } = useWindowDimensions();
  const progress = Math.min(Today.reels / Today.limit, 1);
  const initial = Account.name.trim().charAt(0).toUpperCase();

  return (
    <Backdrop background={Today.stage}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.date}>{Today.date}</Text>
          <Badge label={t('home.streak', { days: Today.streakDays })} tone="outline" />

          {/** Settings is off here rather than in the tab bar, so the bar stays two wide. */}
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}>
            <Text style={styles.initial}>{initial}</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.stage}>
            {t('stage.line', { number: Today.stageNumber, label: stageLabel(Today.stage) })}
          </Text>
          <MascotStage stage={Today.stage} width={Math.min(width * 0.62, 280)} />
        </View>

        <View style={styles.count}>
          <Text style={styles.reels}>{Today.reels}</Text>
          <Text style={styles.reelsLabel}>{t('home.reelsToday')}</Text>
        </View>

        <AppBreakdownCard title={t('home.appsToday')} apps={AppUsage} />

        <Card style={styles.progressCard}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressLeft}>
              {t('home.toNextStage', { reels: Today.toNextStage })}
            </Text>
            <Text style={styles.progressRight}>{t('home.limit', { reels: Today.limit })}</Text>
          </View>
        </Card>

        <View style={styles.stats}>
          <StatTile value={Today.yesterday} label={t('home.yesterday')} />
          <StatTile value={Today.weekAverage} label={t('home.weekAverage')} />
        </View>

        <ProUpsell />
      </ScrollView>
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: {
      gap: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: BottomTabInset + Spacing.four,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.three,
    },
    date: {
      /** Takes the slack, so the avatar stays pinned to the right edge. */
      flex: 1,
      color: c.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    avatarPressed: {
      opacity: 0.75,
    },
    initial: {
      color: c.text,
      fontSize: 15,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    hero: {
      alignItems: 'center',
      gap: Spacing.two,
    },
    stage: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.bold,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    count: {
      alignItems: 'center',
    },
    reels: {
      color: c.text,
      fontSize: 76,
      lineHeight: 82,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: -2,
    },
    reelsLabel: {
      color: c.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    progressCard: {
      gap: Spacing.two,
      paddingVertical: Spacing.three,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.track,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: c.accent,
    },
    progressMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressLeft: {
      color: c.text,
      fontSize: 13,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    progressRight: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    stats: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
  });
