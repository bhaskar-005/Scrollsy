import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { Podium } from '@/components/battle/podium';
import { ProfileSheet } from '@/components/battle/profile-sheet';
import { EmptyRow, RankRow } from '@/components/battle/rank-row';
import { Account, Board, Friends, type BoardEntry } from '@/constants/placeholder';
import { BottomTabInset, Fonts, MinTouch, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** How many stand on the podium. Everyone else is a row. */
const PodiumSize = 3;

/**
 * One prompt per open seat. Naming a person converts better than `a friend`,
 * so each empty place asks for someone specific.
 */
const SeatPrompts = ['rival', 'roommate', 'crush', 'worst', 'anyone'] as const;

/** How much of the scroll dissolves into the header on the way up. */
const FadeHeight = 30;

/**
 * Channels for the mask, not colours. Solid keeps the pixel, clear drops it.
 * A real mask rather than a gradient in the page colour, because the haze sits
 * behind this and there is no one colour to fade into.
 */
const Mask = {
  solid: '#000000',
  clear: 'transparent',
} as const;

export default function BattleScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /** Fewest reels wins, so the board is ranked on read. */
  const ranked = useMemo(() => [...Board].sort((a, b) => a.reels - b.reels), []);

  const [picked, setPicked] = useState<BoardEntry | null>(null);
  const pickedRank = picked ? ranked.indexOf(picked) + 1 : 0;

  /** Every place on the board, taken or not, plus the one the plan opens. */
  const listed = ranked.slice(PodiumSize);
  const seats = Math.max(Friends.freeCap - ranked.filter((entry) => !entry.you).length, 0);
  const rows = listed.length + seats;

  return (
    <Backdrop>
      {/** Stays put while the board scrolls under it. */}
      <View style={styles.header}>
        <View style={styles.slot} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('battle.title')}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          style={({ pressed }) => [styles.slot, pressed && styles.pressed]}>
          <Avatar name={Account.name} size={34} />
        </Pressable>
      </View>

      <MaskedView
        style={styles.scroller}
        maskElement={
          <View style={styles.mask}>
            <LinearGradient colors={[Mask.clear, Mask.solid]} style={styles.maskFade} />
            <View style={styles.maskBody} />
          </View>
        }>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Podium top={ranked.slice(0, PodiumSize)} onPick={setPicked} />

          <View style={styles.board}>
            {listed.map((entry, index) => (
              <RankRow
                key={entry.handle}
                entry={entry}
                rank={PodiumSize + index + 1}
                onPress={() => setPicked(entry)}
              />
            ))}

            {Array.from({ length: seats }, (_, seat) => (
              <EmptyRow
                key={`seat-${seat}`}
                rank={PodiumSize + listed.length + seat + 1}
                label={t(`battle.openSpot.${SeatPrompts[seat % SeatPrompts.length]}`)}
                onPress={() => {}}
              />
            ))}

            {/** The seat past the free five. It is here so the ceiling is visible. */}
            <EmptyRow
              rank={PodiumSize + rows + 1}
              locked
              last
              onPress={() => router.push('/paywall')}
            />
          </View>
        </ScrollView>
      </MaskedView>

      <ProfileSheet entry={picked} rank={pickedRank} onClose={() => setPicked(null)} />
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: Spacing.two,
    },
    /** Equal ends, so the title sits dead centre between them. */
    slot: {
      width: MinTouch,
      height: MinTouch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.half,
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    scroller: {
      flex: 1,
    },
    mask: {
      flex: 1,
      backgroundColor: Mask.clear,
    },
    maskFade: {
      height: FadeHeight,
    },
    maskBody: {
      flex: 1,
      backgroundColor: Mask.solid,
    },
    content: {
      gap: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: BottomTabInset + Spacing.four,
    },
    /** One table with shared edges, not a stack of cards. */
    board: {
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    pressed: {
      opacity: 0.75,
    },
  });
