import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Radius, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Track and thumb. The stock Switch cannot be sized or coloured to match the
 * rest of the app, so this is the one we use.
 */
const TrackWidth = 52;
const TrackHeight = 32;
const Inset = 3;
const ThumbSize = TrackHeight - Inset * 2;
const Travel = TrackWidth - ThumbSize - Inset * 2;

const SlideMs = 190;

type ToggleProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
};

export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /** 0 off, 1 on. Drives the slide and the fill together. */
  const [slide] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(slide, {
      toValue: value ? 1 : 0,
      duration: SlideMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide, value]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}>
      <View style={styles.track}>
        {/** The lit track sits over the dead one, so the colour can cross fade. */}
        <Animated.View style={[styles.trackOn, { opacity: slide }]} />
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, Travel] }) }] },
          ]}
        />
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    track: {
      width: TrackWidth,
      height: TrackHeight,
      borderRadius: Radius.pill,
      padding: Inset,
      justifyContent: 'center',
      backgroundColor: c.track,
    },
    trackOn: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: Radius.pill,
      backgroundColor: c.accent,
    },
    thumb: {
      width: ThumbSize,
      height: ThumbSize,
      borderRadius: Radius.pill,
      backgroundColor: c.surfaceStrong,
      boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: c.shadowNear }],
    },
  });
