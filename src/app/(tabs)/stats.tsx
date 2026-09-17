import Feather from '@expo/vector-icons/Feather';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, StatTile } from '@/components/ui';
import { AppBreakdownCard } from '@/components/app-breakdown';
import { Backdrop } from '@/components/backdrop';
import { ProUpsell } from '@/components/settings/pro-upsell';
import { StatsPanel } from '@/components/stats-panel';
import { BottomTabInset, Fonts, MinTouch, Spacing, type Palette } from '@/constants/theme';
import { usePremium } from '@/hooks/use-premium';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useUsageWeek } from '@/hooks/use-usage-week';
import { t } from '@/i18n';

/** How much of the scroll dissolves into the header on the way up. Matches Settings. */
const FadeHeight = 30;

/**
 * Channels for the mask, not colours. Solid keeps the pixel, clear drops it.
 * A real mask rather than a gradient in the page colour, because the haze sits
 * behind this and there is no one colour to fade into.
 */
const Mask = {
  solid: '#000000',
  clear: 'transparent',
} as const;

export default function StatsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const week = useUsageWeek();
  const { profile } = useProfile();
  const premium = usePremium();

  return (
    <Backdrop>
      <View style={styles.header}>
        <View style={styles.slot} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('stats.title')}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          style={({ pressed }) => [styles.slot, pressed && styles.pressed]}>
          <Avatar
            name={profile.name}
            photo={profile.avatarUrl ?? undefined}
            premium={premium}
            size={34}
          />
        </Pressable>
      </View>

      <MaskedView
        style={styles.scroller}
        maskElement={
          <View style={styles.mask}>
            <LinearGradient colors={[Mask.clear, Mask.solid]} style={styles.maskFade} />
            <View style={styles.maskBody} />
          </View>
        }>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.weekRow}>
            {/** Nothing to page into yet either direction, free or not. */}
            <View style={[styles.weekArrow, styles.weekArrowDisabled]}>
              <Feather name="chevron-left" size={18} color={theme.textFaint} />
            </View>

            <View style={styles.weekLabelBlock}>
              <Text style={styles.weekLabel}>{t('stats.thisWeek')}</Text>
              <Text style={styles.weekRange}>{week.range}</Text>
            </View>

            <View style={[styles.weekArrow, styles.weekArrowDisabled]}>
              <Feather name="chevron-right" size={18} color={theme.textFaint} />
            </View>
          </View>

          {/** Free plan only sees this week. Full history is what the plan is for. */}
          <ProUpsell />

          <StatsPanel week={week} dailyLimit={profile.dailyLimit} />

          <StatTile value={week.total} label={t('stats.totalReels')} />

          <AppBreakdownCard title={t('stats.appsThisWeek')} apps={week.apps} />
        </ScrollView>
      </MaskedView>
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: Spacing.two,
    },
    /** Equal ends, so the title sits dead centre between them. */
    slot: {
      width: MinTouch,
      height: MinTouch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.half,
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    pressed: {
      opacity: 0.75,
    },
    scroller: {
      flex: 1,
    },
    mask: {
      flex: 1,
      backgroundColor: Mask.clear,
    },
    maskFade: {
      height: FadeHeight,
    },
    maskBody: {
      flex: 1,
      backgroundColor: Mask.solid,
    },
    content: {
      gap: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: BottomTabInset + Spacing.four,
    },
    weekRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
    },
    weekArrow: {
      width: MinTouch - 8,
      height: MinTouch - 8,
      borderRadius: MinTouch,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    weekArrowDisabled: {
      opacity: 0.5,
    },
    weekLabelBlock: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.half,
    },
    weekLabel: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    weekRange: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
  });
