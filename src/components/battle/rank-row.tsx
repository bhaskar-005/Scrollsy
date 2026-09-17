import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge } from '@/components/ui';
import type { BoardEntry } from '@/lib/board';
import { Fonts, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useEntryPrice } from '@/hooks/use-offers';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const AvatarSize = 40;

/** One place on the board, from fourth down. */
export function RankRow({
  entry,
  rank,
  last = false,
  onPress,
}: {
  entry: BoardEntry;
  rank: number;
  last?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divided,
        entry.isMe && styles.rowYou,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.rank}>{rank}</Text>

      <Avatar name={entry.name} photo={entry.avatarUrl ?? undefined} size={AvatarSize} premium={entry.premium} />

      <Text style={[styles.name, entry.isMe && styles.you]} numberOfLines={1}>
        {entry.isMe ? t('battle.you') : entry.name}
      </Text>

      <Text style={styles.reels}>{entry.reels}</Text>
    </Pressable>
  );
}

/**
 * A place nobody is standing in. Showing the free five as empty seats makes the
 * ceiling visible from the first day rather than the day you hit it.
 */
export function EmptyRow({
  rank,
  label,
  locked = false,
  last = false,
  onPress,
}: {
  rank: number;
  /** What this seat asks for. Each one asks for someone different. */
  label?: string;
  /** Past the free five. The seat exists but the plan is what opens it. */
  locked?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const price = useEntryPrice();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.divided, pressed && styles.pressed]}>
      <Text style={[styles.rank, styles.rankEmpty]}>{rank}</Text>

      <View style={styles.seat}>
        <Feather
          name={locked ? 'lock' : 'plus'}
          size={18}
          color={locked ? theme.accent : theme.textFaint}
        />
      </View>

      <Text style={styles.seatLabel} numberOfLines={1}>
        {locked ? t('battle.proRow', { cap: rank - 1 }) : label}
      </Text>

      {locked ? (
        <>
          <Badge label={t('common.pro')} style={styles.badge} />
          <Text style={styles.reels}>{price}</Text>
        </>
      ) : (
        <Feather name="chevron-right" size={19} color={theme.textFaint} />
      )}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      minHeight: MinTouch + 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    /** A table, so the rows share one edge rather than each being its own card. */
    divided: {
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    rowYou: {
      backgroundColor: c.backgroundSelected,
    },
    pressed: {
      opacity: 0.75,
    },
    rank: {
      width: 20,
      color: c.textFaint,
      fontSize: 15,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    rankEmpty: {
      opacity: 0.5,
    },
    name: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    you: {
      color: c.text,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    reels: {
      color: c.text,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    /** Dashed, so it reads as a shape waiting to be filled. */
    seat: {
      width: AvatarSize,
      height: AvatarSize,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.border,
    },
    /**
     * Smaller than a name, because an empty place carries a whole line plus an
     * emoji and it has to hold on a narrow screen without truncating.
     */
    seatLabel: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    badge: {
      alignSelf: 'center',
    },
  });
