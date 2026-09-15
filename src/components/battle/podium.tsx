import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import type { BoardEntry } from '@/constants/placeholder';
import { Fonts, Podium as Blocks, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Gradients run bottom to top, same as the buttons. */
const gradientStart = { x: 0, y: 1 };
const gradientEnd = { x: 0, y: 0 };

/** Front face heights. The winner is raised and the other two step down. */
const Height = { 1: 130, 2: 94, 3: 72 } as const;
const AvatarSize = { 1: 64, 2: 52, 3: 52 } as const;

/**
 * The top face is a real plane hinged on its front edge and laid back away
 * from you. Perspective narrows the far edge, so it stays inside the column
 * rather than pushing into its neighbour. `Face` is its true depth, `Well` is
 * the room it needs once foreshortened.
 */
const Face = 56;
const Well = 30;
const Lay = '62deg';
const Eye = 420;

/**
 * How far up each block the fade to nothing runs. Fixed rather than a fraction,
 * so all three dissolve over the same distance despite their different heights.
 */
const Melt = 26;

type Place = 1 | 2 | 3;

/**
 * Top three, winner in the middle and raised. Left to right the order is
 * second, first, third, which is how a podium actually reads.
 */
export function Podium({
  top,
  onPick,
}: {
  top: BoardEntry[];
  onPick: (entry: BoardEntry) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const column = (place: Place) => {
    const entry = top[place - 1];
    if (!entry) {
      return <View key={place} style={styles.column} />;
    }

    const won = place === 1;

    return (
      <Pressable
        key={place}
        onPress={() => onPick(entry)}
        accessibilityRole="button"
        accessibilityLabel={entry.name}
        style={({ pressed }) => [styles.column, pressed && styles.pressed]}>
        <Avatar
          name={entry.name}
          photo={entry.photo}
          size={AvatarSize[place]}
          premium={entry.premium}
          style={styles.avatar}
        />

        <Text style={[styles.name, entry.you && styles.you]} numberOfLines={1}>
          {entry.you ? t('battle.you') : entry.name.split(' ')[0]}
        </Text>
        <Text style={styles.reels}>{entry.reels}</Text>

        {/** Reserves only the foreshortened height, so nothing above shifts. */}
        <View style={styles.topWell}>
          <View
            style={[
              styles.topFace,
              { backgroundColor: won ? Blocks.wonTop : Blocks.restTop },
            ]}
          />
        </View>

        <LinearGradient
          colors={won ? Blocks.wonFront : Blocks.restFront}
          locations={[0, Math.min(Melt / Height[place], 0.55), 1]}
          start={gradientStart}
          end={gradientEnd}
          style={[styles.front, { height: Height[place] }]}>
          {/** Where the lid meets the wall. Without it the two faces merge. */}
          <View style={styles.seam} />
          <Text style={[styles.place, won && styles.placeWon]}>{place}</Text>
        </LinearGradient>
      </Pressable>
    );
  };

  return <View style={styles.podium}>{[2, 1, 3].map((place) => column(place as Place))}</View>;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    podium: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.two,
    },
    column: {
      flex: 1,
      alignItems: 'center',
    },
    avatar: {
      marginBottom: Spacing.two,
    },
    name: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    you: {
      color: c.text,
    },
    reels: {
      color: c.text,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      marginBottom: Spacing.two,
    },
    topWell: {
      alignSelf: 'stretch',
      height: Well,
    },
    topFace: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: Face,
      /** Hinged on the front edge and laid back, which is what makes it a lid. */
      transformOrigin: 'bottom',
      transform: [{ perspective: Eye }, { rotateX: Lay }],
    },
    front: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingTop: Spacing.three,
    },
    seam: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: Blocks.seam,
    },
    place: {
      color: Blocks.numeralRest,
      fontSize: 32,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    placeWon: {
      color: Blocks.numeral,
      fontSize: 38,
    },
    pressed: {
      opacity: 0.8,
    },
  });
