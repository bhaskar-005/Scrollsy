import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, GhostButton, PrimaryButton, Sheet, StatTile } from '@/components/ui';
import { Fonts, Member, Radius, Spacing, type Palette } from '@/constants/theme';
import { useEntryPrice } from '@/hooks/use-offers';
import { usePremium } from '@/hooks/use-premium';
import { useTheme } from '@/hooks/use-theme';
import type { BoardEntry } from '@/lib/board';
import { t } from '@/i18n';

const AvatarSize = 76;
const TickSize = 30;

/** The same seal the members wear, so the pitch and the mark are one thing. */
const TickArt = require('@/assets/images/member-tick.svg');

/** Diagonal, so the metal catches light across the pill. */
const sheenStart = { x: 0, y: 0 };
const sheenEnd = { x: 1, y: 1 };

/**
 * Someone's card, opened by tapping them on the board. A paid account shows a
 * ring here too, and a free viewer gets sold that ring on the way out.
 */
export function ProfileSheet({
  entry,
  rank,
  onClose,
}: {
  entry: BoardEntry | null;
  rank: number;
  onClose: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const premium = usePremium();
  const price = useEntryPrice();

  /** Closes first, so the sheet is not left standing behind the paywall. */
  const upgrade = () => {
    onClose();
    router.push('/paywall');
  };

  return (
    <Sheet visible={entry !== null} onClose={onClose}>
      {entry ? (
        <>
          <View style={styles.identity}>
            <Avatar
              name={entry.name}
              photo={entry.avatarUrl ?? undefined}
              size={AvatarSize}
              premium={entry.premium}
            />
            <Text style={styles.name}>{entry.isMe ? t('battle.you') : entry.name}</Text>

            {entry.premium ? (
              <LinearGradient
                colors={Member.tick}
                start={sheenStart}
                end={sheenEnd}
                style={styles.memberPill}>
                <Text style={styles.memberLabel}>{t('common.member')}</Text>
              </LinearGradient>
            ) : null}
          </View>

          <View style={styles.stats}>
            <StatTile compact value={rank} label={t('battle.profile.rank')} />
            <StatTile compact value={entry.reels} label={t('battle.profile.reels')} />
          </View>

          {premium ? (
            <GhostButton label={t('battle.profile.done')} onPress={onClose} />
          ) : (
            /** Standing next to someone wearing the ring is the whole pitch. */
            <View style={styles.upsell}>
              <View style={styles.upsellHead}>
                <Image source={TickArt} style={styles.upsellTick} contentFit="contain" />
                <Text style={styles.upsellTitle}>{t('battle.profile.upsellTitle')}</Text>
              </View>
              <Text style={styles.upsellBody}>{t('battle.profile.upsellBody')}</Text>
              <PrimaryButton
                shine
                label={t('battle.profile.upsellCta', { price })}
                onPress={upgrade}
              />
            </View>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    identity: {
      alignItems: 'center',
      gap: Spacing.one,
    },
    name: {
      color: c.text,
      fontSize: 22,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      marginTop: Spacing.two,
    },
    memberPill: {
      alignSelf: 'center',
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.three,
      paddingVertical: 3,
      marginTop: Spacing.two,
    },
    memberLabel: {
      color: Member.onTick,
      fontSize: 12,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    stats: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    upsell: {
      gap: Spacing.two,
      padding: Spacing.three,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: c.borderActive,
      backgroundColor: c.accentSoft,
    },
    upsellHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    upsellTick: {
      width: TickSize,
      height: TickSize,
    },
    upsellTitle: {
      flex: 1,
      color: c.text,
      fontSize: 20,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    upsellBody: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 21,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      marginBottom: Spacing.one,
    },
  });
