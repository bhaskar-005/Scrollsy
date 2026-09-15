/*
 * Reanimated shared values are meant to be mutated directly. The compiler
 * reads that as breaking immutability, same as the drag on the sheet itself.
 */
/* eslint-disable react-hooks/immutability */
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Card, CountPill, PrimaryButton, Sheet } from '@/components/ui';
import { Mascot } from '@/components/mascot';
import {
  CounterPrefs,
  CounterStyles,
  Today,
  counterZone,
  type CounterPosition,
  type CounterStyle,
} from '@/constants/placeholder';
import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** The handset you drop the counter onto. Art, so it carries its own numbers. */
const PhoneWidth = 132;
const PhoneAspect = 19 / 9;
const PhoneHeight = PhoneWidth * PhoneAspect;

/** The drag handle's own touch box, kept clear of the handset's edge. */
const HandleSize = 34;
const HalfHandle = HandleSize / 2;

/** Gradients run bottom to top, same as the glass card on notifications. */
const gradientStart = { x: 0, y: 1 };
const gradientEnd = { x: 0, y: 0 };

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function CounterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [style, setStyle] = useState<CounterStyle>(CounterPrefs.style);
  const [position, setPosition] = useState<CounterPosition>(CounterPrefs.position);

  /** Live drag position in phone-local pixels. Committed to `position` on release. */
  const dragX = useSharedValue(CounterPrefs.position.x * PhoneWidth);
  const dragY = useSharedValue(CounterPrefs.position.y * PhoneHeight);
  const grabbedX = useSharedValue(0);
  const grabbedY = useSharedValue(0);

  const commit = (x: number, y: number) => {
    setPosition({ x: x / PhoneWidth, y: y / PhoneHeight });
  };

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          grabbedX.value = dragX.value;
          grabbedY.value = dragY.value;
        })
        .onUpdate((event) => {
          dragX.value = clamp(grabbedX.value + event.translationX, HalfHandle, PhoneWidth - HalfHandle);
          dragY.value = clamp(grabbedY.value + event.translationY, HalfHandle, PhoneHeight - HalfHandle);
        })
        .onEnd(() => {
          runOnJS(commit)(dragX.value, dragY.value);
        }),
    [dragX, dragY, grabbedX, grabbedY],
  );

  const handleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - HalfHandle },
      { translateY: dragY.value - HalfHandle },
    ],
  }));

  const preview = (option: CounterStyle) => {
    if (option === 'pill') {
      return <CountPill count={Today.reels} size="compact" />;
    }
    if (option === 'mascot') {
      return (
        <View style={styles.mascotPreview}>
          <Mascot stage={Today.stage} width={22} />
          <Text style={styles.plain}>{Today.reels}</Text>
        </View>
      );
    }
    if (option === 'outline') {
      return (
        <View style={styles.outline}>
          <Text style={styles.outlineCount}>{Today.reels}</Text>
        </View>
      );
    }
    if (option === 'glass') {
      return (
        <LinearGradient
          colors={[theme.glassRimBottom, theme.glassRimTop]}
          start={gradientStart}
          end={gradientEnd}
          style={styles.glassShell}>
          <LinearGradient
            colors={[theme.glassBottom, theme.glassTop]}
            start={gradientStart}
            end={gradientEnd}
            style={styles.glassFace}>
            <Text style={styles.plain}>{Today.reels}</Text>
          </LinearGradient>
        </LinearGradient>
      );
    }
    return <Text style={styles.plain}>{Today.reels}</Text>;
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.counterSheet.title')}>
      <Text style={styles.caption}>{t('settings.counterSheet.caption')}</Text>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('settings.counterSheet.styleLabel')}</Text>
        <View style={styles.styleRow}>
          {CounterStyles.map((option) => (
            <Card
              key={option}
              selected={style === option}
              onPress={() => setStyle(option)}
              style={styles.styleCard}>
              <View style={styles.stagePreview}>{preview(option)}</View>
              <Text style={styles.styleName}>{t(`settings.counterSheet.styles.${option}`)}</Text>
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('settings.counterSheet.positionLabel')}</Text>
        <Text style={styles.positionHint}>{t('settings.counterSheet.positionHint')}</Text>

        <View style={styles.phoneRow}>
          <View style={styles.phone}>
            <GestureDetector gesture={drag}>
              <Animated.View
                accessibilityRole="adjustable"
                accessibilityLabel={t('settings.counterSheet.positionLabel')}
                accessibilityValue={{
                  text: t(`settings.counterSheet.positions.${counterZone(position)}`),
                }}
                style={[styles.handle, handleStyle]}>
                <View style={styles.handleDot} />
              </Animated.View>
            </GestureDetector>
          </View>

          <Text style={styles.positionName}>
            {t(`settings.counterSheet.positions.${counterZone(position)}`)}
          </Text>
        </View>
      </View>

      <PrimaryButton label={t('settings.counterSheet.save')} onPress={onClose} />
    </Sheet>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    caption: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 21,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      /** Pulls it up under the title rather than floating in the body gap. */
      marginTop: -Spacing.three,
    },
    block: {
      gap: Spacing.two,
    },
    blockLabel: {
      color: c.textSecondary,
      fontSize: 12,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    styleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
    },
    styleCard: {
      /** Two and a bit per row, now that there are five to fit. */
      minWidth: 84,
      flexGrow: 1,
      flexBasis: '30%',
      gap: Spacing.two,
      alignItems: 'center',
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.two,
    },
    /** Fixed height, so five different previews do not stagger the cards. */
    stagePreview: {
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mascotPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    plain: {
      color: c.text,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    outline: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      borderRadius: Radius.pill,
      borderWidth: 2,
      borderColor: c.accent,
    },
    outlineCount: {
      color: c.accent,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    glassShell: {
      padding: 1,
      borderRadius: Radius.pill,
    },
    glassFace: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      borderRadius: Radius.pill - 1,
    },
    styleName: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    positionHint: {
      color: c.textFaint,
      fontSize: 13,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      marginTop: -Spacing.one,
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.four,
    },
    phone: {
      width: PhoneWidth,
      height: PhoneHeight,
      borderRadius: Radius.card,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.backgroundSelected,
      overflow: 'hidden',
    },
    handle: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: HandleSize,
      height: HandleSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    handleDot: {
      width: 22,
      height: 22,
      borderRadius: Radius.pill,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.surfaceStrong,
      /** Lifts it off the handset, so it reads as a thing sitting on the glass. */
      boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 5, color: c.shadowNear }],
    },
    positionName: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
  });
