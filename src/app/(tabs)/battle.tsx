import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Avatar, PrimaryButton } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { Podium } from '@/components/battle/podium';
import { ProfileSheet } from '@/components/battle/profile-sheet';
import { EmptyRow, RankRow } from '@/components/battle/rank-row';
import { BottomTabInset, Fonts, MinTouch, Spacing, type Palette } from '@/constants/theme';
import { useLeaderboard } from '@/hooks/use-leaderboard';
import { usePremium } from '@/hooks/use-premium';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useTodayReels } from '@/hooks/use-today-reels';
import { FreeFriendCap, type BoardEntry } from '@/lib/board';
import { createInviteLink } from '@/lib/invites';
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
  const { profile, signedIn } = useProfile();
  const premium = usePremium();
  const { entries: ranked, failed, refresh } = useLeaderboard();
  const reels = useTodayReels();

  const [picked, setPicked] = useState<BoardEntry | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteFailed, setInviteFailed] = useState(false);
  const pickedRank = picked ? ranked.findIndex((entry) => entry.id === picked.id) + 1 : 0;

  /**
   * A podium needs someone to beat. On your own it is three plinths with two
   * of them empty, announcing places nobody is standing in, so the board
   * starts as plain rows until a friend turns up.
   */
  const podium = ranked.length > 1 ? ranked.slice(0, PodiumSize) : [];

  /** Every place on the board, taken or not, plus the one the plan opens. */
  const listed = ranked.slice(podium.length);
  const seats = Math.max(FreeFriendCap - ranked.filter((entry) => !entry.isMe).length, 0);
  const rows = listed.length + seats;

  /**
   * One link, made by the server and reused until it expires, handed to
   * whatever the phone shares with. The count rides along in the message,
   * because the number is the dare.
   */
  const invite = async () => {
    if (inviting) {
      return;
    }
    setInviting(true);
    setInviteFailed(false);
    try {
      const link = await createInviteLink();
      await Share.share({ message: t('battle.invite.message', { reels, link }) });
    } catch {
      setInviteFailed(true);
    } finally {
      setInviting(false);
    }
  };

  if (!signedIn) {
    return (
      <Backdrop>
        <View style={styles.header}>
          <View style={styles.slot} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{t('battle.title')}</Text>
          </View>
          <View style={styles.slot} />
        </View>

        <View style={styles.gate}>
          <Text style={styles.gateTitle}>{t('battle.signedOut.title')}</Text>
          <Text style={styles.gateBody}>{t('battle.signedOut.body')}</Text>
          <PrimaryButton
            label={t('battle.signedOut.cta')}
            onPress={() => router.push('/onboarding/welcome')}
          />
        </View>
      </Backdrop>
    );
  }

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
          <Avatar
            name={profile.name}
            photo={profile.avatarUrl ?? undefined}
            premium={premium}
            size={34}
          />
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
          {podium.length > 0 ? <Podium top={podium} onPick={setPicked} /> : null}

          {/** Nothing cached and nothing fetched. The board is the one screen that needs the network. */}
          {failed && ranked.length === 0 ? (
            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
              <Text style={styles.retryLabel}>{t('common.retry')}</Text>
            </Pressable>
          ) : null}

          {inviteFailed ? <Text style={styles.inviteFailed}>{t('battle.invite.failed')}</Text> : null}

          <View style={styles.board}>
            {listed.map((entry, index) => (
              <RankRow
                key={entry.id}
                entry={entry}
                rank={podium.length + index + 1}
                onPress={() => setPicked(entry)}
              />
            ))}

            {Array.from({ length: seats }, (_, seat) => (
              <EmptyRow
                key={`seat-${seat}`}
                rank={podium.length + listed.length + seat + 1}
                label={t(`battle.openSpot.${SeatPrompts[seat % SeatPrompts.length]}`)}
                onPress={() => void invite()}
              />
            ))}

            {/** The seat past the free five. It is here so the ceiling is visible. */}
            <EmptyRow
              rank={podium.length + rows + 1}
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
    gate: {
      flex: 1,
      justifyContent: 'center',
      gap: Spacing.three,
      paddingBottom: BottomTabInset,
    },
    gateTitle: {
      color: c.text,
      fontSize: 24,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    gateBody: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 21,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      textAlign: 'center',
    },
    retry: {
      alignSelf: 'center',
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.four,
    },
    retryLabel: {
      color: c.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    inviteFailed: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
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
