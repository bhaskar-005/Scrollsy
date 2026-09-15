/*
 * The compiler rules read a shared value as frozen and a gesture callback as if
 * it ran during render. Both are wrong here. Reanimated mutates shared values
 * on purpose, and Pan only stores these callbacks to run them later on the UI
 * thread.
 */
/* eslint-disable react-hooks/immutability, react-hooks/refs */
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Fonts,
  MaxContentWidth,
  MinTouch,
  Overlay,
  Radius,
  Spacing,
  type Palette,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Coming in. Just enough overshoot to read as a real object, not a fade. */
const enter = { damping: 24, stiffness: 240, mass: 0.9 };
/** Let go above the line. Springs back carrying the finger's own speed. */
const settle = { damping: 26, stiffness: 300 };
/** Let go below the line. Carries the throw out, but never bounces back in. */
const leave = { damping: 40, stiffness: 320, overshootClamping: true };
/** Closed from a button or the scrim, so there is no throw to carry. */
const fall = { duration: 220, easing: Easing.in(Easing.cubic) };

/** Drag past this much of the sheet, or flick faster than this, and it goes. */
const dragToClose = 0.3;
const flickToClose = 800;

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * A full bleed block across the top of the sheet, under the rounded corners
   * and behind the close button. Art goes here, never copy.
   */
  hero?: ReactNode;
  children: ReactNode;
};

/**
 * Bottom sheet. Grab the pill or anywhere on the body and throw it down to
 * close, tap the scrim to close, or hit back on Android.
 *
 * The scrim is tied to how far the sheet has travelled rather than to a timer
 * of its own, so it darkens as the sheet rises and lifts back under your finger
 * on the way out. One value driving both is what keeps them from drifting apart.
 */
export function Sheet({ visible, onClose, title, hero, children }: SheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();

  /** Stays up through the exit, so the modal outlives `visible` going false. */
  const [shown, setShown] = useState(visible);

  /** Distance below its resting place. 0 is open, one sheet height is gone. */
  const offset = useSharedValue(screen.height);
  const height = useSharedValue(0);
  const grabbedAt = useSharedValue(0);
  /** Armed while the sheet is parked offstage. The next layout plays it in. */
  const entering = useRef(true);
  /** Android blurs a named view rather than whatever happens to be behind. */
  const blurTarget = useRef<View>(null);

  if (visible && !shown) {
    setShown(true);
  }

  /** The sheet is fully offstage. Take the modal down and arm the next entrance. */
  const park = useCallback(() => {
    entering.current = true;
    setShown(false);
  }, []);

  /** Thrown away by hand, so the parent has not heard about it yet. */
  const parkAndTell = useCallback(() => {
    entering.current = true;
    setShown(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible || !shown) {
      return;
    }

    offset.value = withTiming(height.value || screen.height, fall, (done) => {
      if (done) {
        runOnJS(park)();
      }
    });
  }, [height, offset, park, screen.height, shown, visible]);

  /** Nothing can animate until we know how tall the thing is. */
  const measure = useCallback(
    (measured: number) => {
      height.value = measured;
      if (entering.current) {
        entering.current = false;
        offset.value = measured;
        offset.value = withSpring(0, enter);
      }
    },
    [height, offset],
  );

  const drag = useMemo(
    () =>
      Gesture.Pan()
        /** Vertical intent only, so a tap still reaches the buttons inside. */
        .activeOffsetY([-10, 10])
        .onStart(() => {
          grabbedAt.value = offset.value;
        })
        .onUpdate((event) => {
          const next = grabbedAt.value + event.translationY;
          /** Above the resting place it goes heavy, so it cannot be torn off. */
          offset.value = next < 0 ? next / 4 : next;
        })
        .onEnd((event) => {
          const full = height.value || screen.height;

          if (offset.value > full * dragToClose || event.velocityY > flickToClose) {
            offset.value = withSpring(full, { ...leave, velocity: event.velocityY }, (done) => {
              if (done) {
                runOnJS(parkAndTell)();
              }
            });
            return;
          }

          offset.value = withSpring(0, { ...settle, velocity: event.velocityY });
        }),
    [grabbedAt, height, offset, parkAndTell, screen.height],
  );

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, height.value || 1], [1, 0], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        </Pressable>

        <GestureDetector gesture={drag}>
          <Animated.View
            accessibilityViewIsModal
            onLayout={(event) => measure(event.nativeEvent.layout.height)}
            style={[styles.sheet, sheetStyle]}>
            {hero ? (
              <BlurTargetView ref={blurTarget} style={styles.hero}>
                {hero}
              </BlurTargetView>
            ) : null}

            <View style={[styles.grabber, hero ? styles.grabberOverHero : null]} />

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.closeSlot}>
              {({ pressed }) => (
                <BlurView
                  intensity={60}
                  tint="systemThickMaterialDark"
                  blurTarget={blurTarget}
                  blurMethod="dimezisBlurViewSdk31Plus"
                  style={[styles.close, pressed && styles.closePressed]}>
                  <Ionicons name="close" size={20} color={Overlay.glyph} />
                </BlurView>
              )}
            </Pressable>

            <View style={[styles.body, { paddingBottom: insets.bottom + Spacing.four }]}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {children}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    scrim: {
      backgroundColor: c.scrim,
    },
    sheet: {
      width: '100%',
      maxWidth: MaxContentWidth,
      alignSelf: 'center',
      /** Clips the hero art to the rounded top corners. */
      overflow: 'hidden',
      borderTopLeftRadius: Radius.sheet,
      borderTopRightRadius: Radius.sheet,
      backgroundColor: c.backgroundElement,
    },
    hero: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Overlay.hero,
    },
    body: {
      gap: Spacing.four,
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.four,
    },
    grabber: {
      width: 40,
      height: 5,
      marginTop: Spacing.two,
      borderRadius: Radius.pill,
      alignSelf: 'center',
      backgroundColor: c.track,
    },
    /** Over art it floats on top rather than pushing the picture down. */
    grabberOverHero: {
      position: 'absolute',
      top: 0,
      backgroundColor: Overlay.grabber,
    },
    closeSlot: {
      position: 'absolute',
      top: Spacing.three,
      right: Spacing.three,
      zIndex: 1,
    },
    close: {
      width: MinTouch,
      height: MinTouch,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      /** BlurView paints to its own bounds, so the circle has to clip it. */
      overflow: 'hidden',
    },
    closePressed: {
      transform: [{ scale: 0.92 }],
      opacity: 0.85,
    },
    title: {
      color: c.text,
      fontSize: 26,
      lineHeight: 32,
      letterSpacing: -0.4,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
  });
