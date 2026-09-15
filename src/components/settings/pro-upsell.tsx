import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Account, Pricing } from '@/constants/placeholder';
import { Bevel, Fonts, Gradients, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Gradients run bottom to top, same as the buttons. */
const gradientStart = { x: 0, y: 1 };
const gradientEnd = { x: 0, y: 0 };
/** The shine runs across instead. */
const shineStart = { x: 0, y: 0 };
const shineEnd = { x: 1, y: 0 };

/** One breath in and out. Slow enough to read as alive, not as a warning. */
const BreathMs = 1000;

/** One sweep of the highlight, then a rest before it comes round again. */
const ShineMs = 1100;
const ShineRestMs = 1500;
/** How much of the row the highlight covers at any moment. */
const ShineWidth = 0.45;

/** The chained handset, mirrored so it faces the label. */
const LockArt = require('@/assets/images/lock-reel.png');
const ArtSize = 42;

/**
 * The one loud thing on Settings. A row rather than a panel, because the offer
 * is one line and a panel only pushed the actual settings off the screen.
 */
export function ProUpsell() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [breath] = useState(() => new Animated.Value(0));
  const [shine] = useState(() => new Animated.Value(0));
  /** The sweep needs a distance, and only layout knows how wide the row is. */
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (Account.premium) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BreathMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BreathMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [breath]);

  useEffect(() => {
    if (Account.premium || width === 0) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, {
          toValue: 1,
          duration: ShineMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(ShineRestMs),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [shine, width]);

  if (Account.premium) {
    return (
      <Pressable
        onPress={() => router.push('/paywall')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.calm, pressed && styles.pressed]}>
        <Feather name="award" size={20} color={theme.accent} />
        <View style={styles.calmText}>
          <Text style={styles.calmLabel}>{t('settings.pro.activeLabel')}</Text>
          <Text style={styles.calmTerms}>{t('settings.pro.activeTerms')}</Text>
        </View>
        <Feather name="chevron-right" size={19} color={theme.textFaint} />
      </Pressable>
    );
  }

  return (
    <View>
      {/** Light under the row, so it lifts off the plain cards around it. */}
      <View style={styles.glow} pointerEvents="none" />

      <Animated.View
        style={{
          transform: [
            { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) },
          ],
        }}>
        <Pressable onPress={() => router.push('/paywall')} accessibilityRole="button">
          {({ pressed }) => (
            <LinearGradient
              colors={Gradients.accentShell}
              start={gradientStart}
              end={gradientEnd}
              style={styles.shell}>
              <LinearGradient
                colors={Gradients.accentFace}
                start={gradientStart}
                end={gradientEnd}
                onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
                style={[styles.face, pressed && styles.facePressed]}>
                <Image source={LockArt} style={styles.art} contentFit="contain" />

                <Text style={styles.cta}>
                  {t('settings.pro.lockCta', { price: Pricing.entry })}
                </Text>

                <Feather name="chevron-right" size={20} color={Gradients.onGradient} />

                {width > 0 ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.shine,
                      {
                        width: width * ShineWidth,
                        transform: [
                          {
                            translateX: shine.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-width * ShineWidth, width],
                            }),
                          },
                          { skewX: '-18deg' },
                        ],
                      },
                    ]}>
                    <LinearGradient
                      colors={Gradients.shine}
                      start={shineStart}
                      end={shineEnd}
                      style={styles.shineFill}
                    />
                  </Animated.View>
                ) : null}
              </LinearGradient>
            </LinearGradient>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    glow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      marginVertical: -Spacing.three,
      opacity: 0.8,
      experimental_backgroundImage: [
        {
          type: 'radial-gradient',
          shape: 'ellipse',
          size: 'farthest-side',
          position: { top: '50%', left: '50%' },
          colorStops: [{ color: c.glow }, { color: c.glowFade }],
        },
      ],
    },
    shell: {
      padding: 2,
      borderRadius: Radius.card,
    },
    face: {
      minHeight: MinTouch + 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      borderRadius: Radius.card - 2,
      /** Keeps the sweep inside the rounded face. */
      overflow: 'hidden',
      /** Light bevel on the top inside edge, dark one along the bottom. */
      boxShadow: [
        { offsetX: 0, offsetY: 1.5, blurRadius: 0, color: Bevel.top, inset: true },
        { offsetX: 0, offsetY: -2, blurRadius: 0, color: Bevel.bottom, inset: true },
      ],
    },
    facePressed: {
      boxShadow: [
        { offsetX: 0, offsetY: 2, blurRadius: 3, color: Bevel.pressedTop, inset: true },
        { offsetX: 0, offsetY: -1, blurRadius: 0, color: Bevel.bottom, inset: true },
      ],
    },
    art: {
      width: ArtSize,
      height: ArtSize,
    },
    cta: {
      flex: 1,
      color: Gradients.onGradient,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: -0.2,
      /** Depth in the type, so it sits in the fill rather than on it. */
      textShadowColor: Bevel.label,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    shine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
    },
    shineFill: {
      flex: 1,
    },
    calm: {
      minHeight: MinTouch + 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: c.borderActive,
      backgroundColor: c.accentSoft,
    },
    calmText: {
      flex: 1,
      gap: 1,
    },
    calmLabel: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    calmTerms: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
    pressed: {
      opacity: 0.8,
    },
  });
