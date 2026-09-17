import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot/mascot';
import type { MascotState } from '@/constants/stages';
import { Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** How far each ember drifts sideways from centre, left to right. */
const Spread = [-46, -18, 8, 34, -30, 20];
/** Loop length and the head start each one gets, so they never move in step. */
const Duration = [2600, 3100, 2800, 3400, 2900, 3200];
const Delay = [0, 500, 1000, 250, 1400, 800];

/** One full float, down and back up. */
const BobMs = 1600;
const BobRise = 10;

type MascotStageProps = {
  stage: MascotState;
  /** Width in points. The glow and the embers scale off this. */
  width: number;
};

/**
 * The mascot standing in a soft violet pool, floating in place with a few
 * embers drifting up past him. Same glow the rest of the app already uses
 * behind a hero element, just sized up to sit under him.
 */
export function MascotStage({ stage, width }: MascotStageProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [bob] = useState(() => new Animated.Value(0));
  const [particles] = useState(() => Spread.map(() => new Animated.Value(0)));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: BobMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: BobMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    const loops = particles.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(Delay[index]),
          Animated.timing(value, {
            toValue: 1,
            duration: Duration[index],
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());

    return () => loops.forEach((loop) => loop.stop());
  }, [particles]);

  const stageHeight = width * 1.1;
  const riseHeight = width * 0.85;

  return (
    <View style={[styles.stage, { width, height: stageHeight }]}>
      <View
        pointerEvents="none"
        style={[styles.blob, { width: width * 1.4, height: width * 0.55 }]}
      />

      {particles.map((value, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              left: width / 2 + Spread[index],
              opacity: value.interpolate({
                inputRange: [0, 0.15, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -riseHeight],
                  }),
                },
                { scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
              ],
            },
          ]}
        />
      ))}

      <Animated.View
        style={{
          transform: [
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BobRise] }) },
          ],
        }}>
        <Mascot stage={stage} width={width} />
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    stage: {
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    /** The ground glow he stands in. Same radial the app uses everywhere else. */
    blob: {
      position: 'absolute',
      bottom: Spacing.two,
      alignSelf: 'center',
      borderRadius: 999,
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
    particle: {
      position: 'absolute',
      bottom: Spacing.four,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.accent,
    },
  });
