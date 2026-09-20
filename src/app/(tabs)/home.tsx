import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui';
import { AppPills } from '@/components/app-pills';
import { Backdrop } from '@/components/backdrop';
import { MascotStage, Thought } from '@/components/mascot';
import { ProUpsell } from '@/components/settings/pro-upsell';
import { StarField } from '@/components/star-field';
import { stageFor } from '@/constants/stages';
import { BottomTabInset, Fonts, MinTouch, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePremium } from '@/hooks/use-premium';
import { useProfile } from '@/hooks/use-profile';
import { useTodayApps } from '@/hooks/use-today-apps';
import { useTodayReels } from '@/hooks/use-today-reels';
import { t } from '@/i18n';

/**
 * The page rises into the sky as one very wide circle, so the seam between the
 * two reads as a curve running across the screen rather than a pair of rounded
 * corners. Wider than the screen, so only the gentle top of it is ever in view.
 */
const DomeSpan = 2.4;

/** How far his feet cross over onto the page he is standing on. */
const DomeOverlap = Spacing.four;

export default function HomeScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reels = useTodayReels();
  const apps = useTodayApps();
  const { profile } = useProfile();
  const premium = usePremium();

  const domeRadius = (width * DomeSpan) / 2;
  const domeHeight = Math.max(height, domeRadius + Spacing.six);
  /** How far the curve has fallen away by the time it reaches the screen edge. */
  const arcDrop = domeRadius - Math.sqrt(Math.max(domeRadius ** 2 - (width / 2) ** 2, 0));

  return (
    <Backdrop glow={false}>
      <View style={styles.page}>
        <View style={styles.hero}>
          {/**
           * Deepest at the top edge, easing down to meet the page. Runs up
           * behind the status bar, and past the lowest point of the curve.
           */}
          <LinearGradient
            colors={[theme.skyTop, theme.skyMid, theme.skyBottom]}
            style={[styles.sky, { top: -insets.top, bottom: -(arcDrop + Spacing.two) }]}>
            <StarField />
          </LinearGradient>

          <View
            style={[
              styles.dome,
              {
                width: domeRadius * 2,
                height: domeHeight,
                borderTopLeftRadius: domeRadius,
                borderTopRightRadius: domeRadius,
                marginLeft: -domeRadius,
                bottom: -(domeHeight - DomeOverlap),
              },
            ]}
          />

          <View style={styles.header}>
            <View style={styles.slot} />
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('app.name')}</Text>
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

          <Thought stage={stageFor(reels)} reels={reels} />

          <MascotStage stage={stageFor(reels)} width={Math.min(width * 0.62, 280)} />
        </View>

        <View style={styles.count}>
          <Text style={styles.reels}>{reels}</Text>
          <Text style={styles.reelsLabel}>{t('home.reelsToday')}</Text>
        </View>

        {/** Where the damage came from, under the number that totals it. */}
        <AppPills apps={apps} />

        <ProUpsell />
      </View>
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    page: {
      flex: 1,
      gap: Spacing.four,
      paddingBottom: BottomTabInset + Spacing.four,
    },
    hero: {
      alignItems: 'center',
      paddingTop: Spacing.three,
      gap: Spacing.three,
    },
    /** Reaches past the page's own side margin, so the colour runs edge to edge. */
    sky: {
      position: 'absolute',
      left: -Spacing.four,
      right: -Spacing.four,
    },
    /**
     * The page itself, curving up into the sky.
     *
     * Cast upward rather than down, because the page is the thing in front and
     * the sky is behind it. Three passes: a hairline to seat the curve, a
     * short one right under it, and a wide soft one that gives it real height
     * off the sky.
     *
     * Whether that reads as a shadow or a glow is the palette's business, not
     * this screen's. Light scheme darkens the sky around the curve, dark
     * scheme lights it, because in the dark the page is the black thing and
     * more darkness around it would only hide the edge. See `skyLift`.
     */
    dome: {
      position: 'absolute',
      left: '50%',
      backgroundColor: c.background,
      boxShadow: [
        { offsetX: 0, offsetY: -1, blurRadius: 2, color: c.skyLiftNear },
        { offsetX: 0, offsetY: -6, blurRadius: 14, color: c.skyLiftNear },
        { offsetX: 0, offsetY: -20, blurRadius: 44, color: c.skyLiftFar },
      ],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
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
    /** Takes whatever height is left over, so the number floats between the two. */
    count: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reels: {
      color: c.text,
      fontSize: 64,
      lineHeight: 70,
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
  });
