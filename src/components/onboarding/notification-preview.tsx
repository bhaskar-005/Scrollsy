import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import type { MascotState } from '@/constants/stages';
import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import type { TranslationKey } from '@/i18n';

/**
 * Three pushes landing one after another, oldest at the top, so it gets worse
 * as you read down. A real push carries the app icon rather than a per message
 * avatar, so he wears the same face on all three.
 */
const Alerts = [
  {
    id: 'buzzed',
    timeKey: 'onboarding.notifications.alerts.buzzed.time',
    bodyKey: 'onboarding.notifications.alerts.buzzed.body',
    inset: 16,
  },
  {
    id: 'fried',
    timeKey: 'onboarding.notifications.alerts.fried.time',
    bodyKey: 'onboarding.notifications.alerts.fried.body',
    inset: 8,
  },
  {
    id: 'cooked',
    timeKey: 'onboarding.notifications.alerts.cooked.time',
    bodyKey: 'onboarding.notifications.alerts.cooked.body',
    inset: 0,
  },
] as const satisfies readonly {
  id: string;
  timeKey: TranslationKey;
  bodyKey: TranslationKey;
  /** Pulled in at each side. The oldest is narrowest, so the stack has depth. */
  inset: number;
}[];

/** The face on every push. The one he wears at a hundred reels. */
const AlertMascot: MascotState = 'buzzed';

/** How far apart the pushes land. */
const StaggerMs = 420;
const SlideMs = 460;

/** Gradients run bottom to top, same as the primary button. */
const gradientStart = { x: 0, y: 1 };
const gradientEnd = { x: 0, y: 0 };

/** Art, not layout. The handset is a drawing, so it carries its own numbers. */
const PhoneWidth = 214;
const PhoneHeight = 420;
/** The pushes overhang the handset, they do not stretch across a tablet. */
const AlertsMaxWidth = 360;
const AvatarSize = 40;
/** How much of the handset dissolves back into the screen at the bottom. */
const FadeHeight = 200;
/** Rim around the frosted face, the way the button wears its shell. */
const ShellThickness = 1;

export function NotificationPreview() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /** 0 before a push has landed, 1 once it is sitting there. */
  const [arrival] = useState(() => Alerts.map(() => new Animated.Value(0)));

  useEffect(() => {
    Animated.stagger(
      StaggerMs,
      arrival.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: SlideMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [arrival]);

  return (
    <View style={styles.stage}>
      <View style={styles.phone} pointerEvents="none">
        <View style={styles.island} />
      </View>

      {/** Dissolves the bottom of the handset into the screen, so it has no cut edge. */}
      <LinearGradient
        colors={[theme.backgroundFade, theme.background]}
        style={styles.fade}
        pointerEvents="none"
      />

      <View style={styles.alerts}>
        {Alerts.map((alert, index) => (
          <Animated.View
            key={alert.id}
            style={{
              marginHorizontal: alert.inset,
              opacity: arrival[index],
              transform: [
                {
                  translateY: arrival[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [-22, 0],
                  }),
                },
                {
                  scale: arrival[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            }}>
            <LinearGradient
              colors={[theme.glassRimBottom, theme.glassRimTop]}
              start={gradientStart}
              end={gradientEnd}
              style={styles.shell}>
              <LinearGradient
                colors={[theme.glassBottom, theme.glassTop]}
                start={gradientStart}
                end={gradientEnd}
                style={styles.face}>
                <View style={styles.avatar}>
                  <Mascot stage={AlertMascot} width={AvatarSize} />
                </View>

                <View style={styles.body}>
                  <View style={styles.topLine}>
                    <Text style={styles.sender}>{t('app.name')}</Text>
                    <Text style={styles.time}>{t(alert.timeKey)}</Text>
                  </View>
                  <Text style={styles.message}>{t(alert.bodyKey)}</Text>
                </View>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    /** The handset runs off the bottom edge, so the stage clips it. */
    stage: {
      overflow: 'hidden',
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
    phone: {
      position: 'absolute',
      top: 0,
      alignSelf: 'center',
      width: PhoneWidth,
      height: PhoneHeight,
      borderRadius: 44,
      borderWidth: 7,
      borderColor: c.backgroundElement,
      backgroundColor: c.surface,
      alignItems: 'center',
      paddingTop: Spacing.three,
    },
    island: {
      width: 74,
      height: 22,
      borderRadius: Radius.pill,
      backgroundColor: c.backgroundElement,
    },
    fade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: FadeHeight,
    },
    /** The pushes sit wider than the handset, the way they do on a lock screen. */
    alerts: {
      gap: Spacing.two,
      width: '100%',
      maxWidth: AlertsMaxWidth,
      alignSelf: 'center',
    },
    shell: {
      padding: ShellThickness,
      borderRadius: Radius.card,
    },
    face: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      padding: Spacing.three,
      borderRadius: Radius.card - ShellThickness,
    },
    avatar: {
      width: AvatarSize,
      height: AvatarSize,
      borderRadius: Radius.card,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    body: {
      flex: 1,
      gap: Spacing.half,
    },
    topLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Spacing.two,
    },
    sender: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    time: {
      color: c.textFaint,
      fontSize: 12,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    message: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 19,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
  });
