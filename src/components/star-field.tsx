import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Where each speck sits, how big it is, how long its climb takes and the head
 * start it gets. Placed by hand rather than at random, so the sky is composed
 * and does not reshuffle itself every time the screen redraws. Most of them
 * sit high, where the sky is deep enough to hold them.
 */
const Stars = [
  { x: '7%', y: '18%', size: 2, ms: 9600, delay: 0 },
  { x: '18%', y: '52%', size: 1.5, ms: 11200, delay: 1400 },
  { x: '27%', y: '9%', size: 2.5, ms: 8400, delay: 2600 },
  { x: '34%', y: '38%', size: 1.5, ms: 12400, delay: 600 },
  { x: '44%', y: '14%', size: 2, ms: 10200, delay: 3200 },
  { x: '52%', y: '61%', size: 1.5, ms: 9000, delay: 1900 },
  { x: '61%', y: '24%', size: 3, ms: 11800, delay: 400 },
  { x: '69%', y: '47%', size: 1.5, ms: 8800, delay: 2900 },
  { x: '77%', y: '12%', size: 2, ms: 10600, delay: 1100 },
  { x: '86%', y: '35%', size: 2.5, ms: 9400, delay: 2300 },
  { x: '92%', y: '58%', size: 1.5, ms: 12000, delay: 700 },
  { x: '12%', y: '68%', size: 2, ms: 10800, delay: 3600 },
  { x: '39%', y: '70%', size: 1.5, ms: 9200, delay: 2100 },
  { x: '57%', y: '6%', size: 1.5, ms: 11600, delay: 1600 },
  { x: '81%', y: '65%', size: 2, ms: 8600, delay: 3000 },
  { x: '23%', y: '27%', size: 1.5, ms: 12800, delay: 900 },
] as const;

/** How far a speck climbs before it fades out and starts the run again. */
const Rise = 120;

/** Slow drift up through the sky behind him. Decoration, so it never takes a touch. */
export function StarField() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [drift] = useState(() => Stars.map(() => new Animated.Value(0)));

  useEffect(() => {
    const loops = drift.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(Stars[index].delay),
          Animated.timing(value, {
            toValue: 1,
            duration: Stars[index].ms,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());

    return () => loops.forEach((loop) => loop.stop());
  }, [drift]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Stars.map((star, index) => (
        <Animated.View
          key={index}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: drift[index].interpolate({
                inputRange: [0, 0.2, 0.75, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: drift[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -Rise],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    star: {
      position: 'absolute',
      backgroundColor: c.star,
    },
  });
