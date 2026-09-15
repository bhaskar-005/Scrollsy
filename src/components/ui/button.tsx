import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';

import { Bevel, Fonts, Gradients, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Gradients run bottom to top. */
const gradientStart = { x: 0, y: 1 };
const gradientEnd = { x: 0, y: 0 };
/** The shine runs across instead. */
const shineStart = { x: 0, y: 0 };
const shineEnd = { x: 1, y: 0 };

/** One sweep of the highlight, then a rest before it comes round again. */
const ShineMs = 1100;
const ShineRestMs = 1500;
/** How much of the face the highlight covers at any moment. */
const ShineWidth = 0.45;

type ButtonProps = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
};

/**
 * The one loud action on a screen. A 2px gradient shell around a gradient face.
 * `icon` sits to the left of the label, for a provider mark like the Google G.
 *
 * `small` is the same button shrunk to a pill, for an action that lives inside
 * a row. It stays quieter than the full size one so the screen still has an
 * obvious single loudest thing.
 */
export function PrimaryButton({
  label,
  onPress,
  icon,
  size = 'regular',
  disabled = false,
  shine = false,
  style,
}: ButtonProps & {
  icon?: ReactNode;
  size?: 'regular' | 'small';
  disabled?: boolean;
  /** Sweeps a highlight across the face, for the one button that must be taken. */
  shine?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /** 0 at rest, 1 while held. Drives the sink into the page. */
  const [press] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));
  /** The sweep needs a distance, and only layout knows how wide the face is. */
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!shine || width === 0) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
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
  }, [shine, sweep, width]);

  const settle = (held: boolean) =>
    Animated.timing(press, {
      toValue: held ? 1 : 0,
      duration: held ? 90 : 170,
      easing: held ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

  const sink = press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const shrink = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });

  const small = size === 'small';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => settle(true)}
      onPressOut={() => settle(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[disabled && styles.disabled, style]}>
      {({ pressed }) => (
        <Animated.View style={{ transform: [{ translateY: sink }, { scale: shrink }] }}>
          <LinearGradient
            colors={Gradients.accentShell}
            start={gradientStart}
            end={gradientEnd}
            style={[styles.shell, small && styles.shellSmall, pressed && styles.shellPressed]}>
            <LinearGradient
              colors={Gradients.accentFace}
              start={gradientStart}
              end={gradientEnd}
              onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
              style={[
                styles.face,
                small && styles.faceSmall,
                shine && styles.faceShining,
                pressed && styles.facePressed,
              ]}>
              {icon}
              <Text style={[styles.primaryLabel, small && styles.primaryLabelSmall]}>{label}</Text>

              {shine && width > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shine,
                    {
                      width: width * ShineWidth,
                      transform: [
                        {
                          translateX: sweep.interpolate({
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
        </Animated.View>
      )}
    </Pressable>
  );
}

/**
 * The quiet way out. Never competes with the primary action.
 * `compact` is the inline version, for a Skip sitting next to something else.
 */
export function GhostButton({
  label,
  onPress,
  compact = false,
  style,
}: ButtonProps & { compact?: boolean }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={style}>
      {({ pressed }) => (
        <View style={[compact ? styles.ghostCompact : styles.ghost, pressed && styles.pressed]}>
          <Text style={styles.ghostLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A round button carrying one glyph, such as the close on a modal. */
export function IconButton({
  glyph,
  onPress,
  accessibilityLabel,
  style,
}: {
  glyph: string;
  onPress: () => void;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}>
      {({ pressed }) => (
        <View style={[styles.icon, pressed && styles.pressed]}>
          <Text style={styles.iconGlyph}>{glyph}</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    shell: {
      padding: 2,
      borderRadius: Radius.button,
      /** A tight contact shadow, then a wide soft one to lift it off the page. */
      boxShadow: [
        { offsetX: 0, offsetY: 3, blurRadius: 6, color: c.shadowNear },
        { offsetX: 0, offsetY: 12, blurRadius: 24, color: c.shadowFar },
      ],
    },
    shellSmall: {
      borderRadius: Radius.pill,
      /** Sits closer to the page, so a row of them does not shout. */
      boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 6, color: c.shadowNear }],
    },
    shellPressed: {
      /** Held, it sits almost flat on the page. */
      boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: c.shadowNear }],
    },
    face: {
      minHeight: MinTouch + 8,
      borderRadius: Radius.buttonFace,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.five,
      paddingVertical: Spacing.three,
      /** Light bevel on the top inside edge, dark one along the bottom. */
      boxShadow: [
        { offsetX: 0, offsetY: 1.5, blurRadius: 0, color: Bevel.top, inset: true },
        { offsetX: 0, offsetY: -2, blurRadius: 0, color: Bevel.bottom, inset: true },
      ],
    },
    faceSmall: {
      minHeight: MinTouch - 4,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
    },
    /** Keeps the sweep inside the rounded face. */
    faceShining: {
      overflow: 'hidden',
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
    facePressed: {
      /** The highlight flips to a shadow, so the face reads as pushed in. */
      boxShadow: [
        { offsetX: 0, offsetY: 2, blurRadius: 3, color: Bevel.pressedTop, inset: true },
        { offsetX: 0, offsetY: -1, blurRadius: 0, color: Bevel.bottom, inset: true },
      ],
    },
    primaryLabel: {
      color: Gradients.onGradient,
      fontSize: 17,
      fontFamily: Fonts.bold,
      fontWeight: '700',
      letterSpacing: 0.2,
      /** Depth in the type, so it sits in the fill rather than on it. */
      textShadowColor: Bevel.label,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    primaryLabelSmall: {
      fontSize: 15,
      letterSpacing: 0,
    },
    ghost: {
      minHeight: MinTouch,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
    },
    ghostCompact: {
      minHeight: MinTouch,
      justifyContent: 'center',
      paddingLeft: Spacing.three,
    },
    ghostLabel: {
      color: c.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    icon: {
      width: MinTouch,
      height: MinTouch,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceStrong,
      borderWidth: 1,
      borderColor: c.border,
    },
    iconGlyph: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    pressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.92,
    },
    /** Waiting its turn. Still legible, clearly not the thing to press. */
    disabled: {
      opacity: 0.35,
    },
  });
