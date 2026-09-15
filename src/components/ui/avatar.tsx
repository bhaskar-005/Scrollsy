import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Fonts, Member, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Diagonal, so the metal catches light across the ring rather than down it. */
const sheenStart = { x: 0, y: 0 };
const sheenEnd = { x: 1, y: 1 };

/** Ring thickness, and how big the tick sits against the face. */
const Ring = 2.5;
const TickRatio = 0.4;

/** The scalloped gold seal. A plain check in a circle did not read as verified. */
const TickArt = require('@/assets/images/member-tick.svg');

type AvatarProps = {
  name: string;
  size: number;
  /** Google photo once auth is real. Initials stand in until then. */
  photo?: string;
  /** A member wears the gold ring and the tick, so the plan is visible. */
  premium?: boolean;
  style?: ViewStyle;
};

export function Avatar({ name, size, photo, premium = false, style }: AvatarProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const tick = Math.round(size * TickRatio);
  const inner = premium ? size - Ring * 2 : size;

  const face = (
    <View style={[styles.face, { borderRadius: inner / 2 }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={200} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
      )}
    </View>
  );

  return (
    <View style={[{ width: size, height: size }, style]}>
      {premium ? (
        <LinearGradient
          colors={Member.ring}
          start={sheenStart}
          end={sheenEnd}
          style={[styles.ring, { borderRadius: size / 2 }]}>
          {face}
        </LinearGradient>
      ) : (
        <View style={[styles.plain, { borderRadius: size / 2 }]}>{face}</View>
      )}

      {premium ? (
        <Image
          source={TickArt}
          style={[styles.tick, { width: tick, height: tick }]}
          contentFit="contain"
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    ring: {
      flex: 1,
      padding: Ring,
      /**
       * A plain drop shadow, not a gold halo. Lighting the metal from behind
       * muddied it. Depth is what makes the ring look like metal.
       */
      boxShadow: [
        { offsetX: 0, offsetY: 2, blurRadius: 5, color: c.shadowNear },
        { offsetX: 0, offsetY: 6, blurRadius: 14, color: c.shadowFar },
      ],
    },
    plain: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
    },
    face: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: c.backgroundSelected,
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    initials: {
      color: c.text,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    tick: {
      position: 'absolute',
      right: -2,
      bottom: -2,
    },
  });
