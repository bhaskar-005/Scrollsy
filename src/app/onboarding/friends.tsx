import Ionicons from '@expo/vector-icons/Ionicons';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CountPill, Eyebrow, GhostButton, Headline, PrimaryButton } from '@/components/ui';
import { StepScreen } from '@/components/onboarding/step-screen';
import { InviteDuel } from '@/constants/placeholder';
import { Fonts, Gradients, MaxContentWidth, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/**
 * Both plates are edge to edge, so each keeps its own proportion. They are also
 * cropped mid torso, which is what the mask below is for.
 */
const you = {
  art: require('@/assets/mascot/duo-you.png'),
  aspect: 1507 / 1044,
};
const friend = {
  art: require('@/assets/mascot/duo-friend.png'),
  aspect: 1482 / 1062,
};

/** What the bolt down the middle takes out of the row. */
const DividerWidth = 44;

/** How far the friend sits below you, so the two are never level. */
const Stagger = 54;

/** The strike runs the whole height of the arena, so it splits the two of them. */
const BoltWidth = 84;
/** The light it throws sits wider than the strike itself. */
const GlowWidth = 150;

/**
 * Both glows are decoration, so they are dimmed here rather than in the
 * palette. `glow` is shared with the haze every screen wears, and turning that
 * down would take the whole app with it.
 */
const BlobDim = 0.5;
const StrikeDim = 0.65;

/** How much of a plate the mask takes away at the bottom. */
const FadeRatio = 0.2;

/**
 * Channels for the mask, not colours. Solid keeps the pixel, clear drops it,
 * and the ramp between the two is what softens the crop.
 */
const Mask = {
  solid: '#000000',
  clear: 'transparent',
} as const;

export default function FriendsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { width } = useWindowDimensions();
  /** Two plates and the bolt between them, whatever the screen is. */
  const column = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const artWidth = Math.min((column - DividerWidth) / 2, 168);

  const duelist = (side: typeof you, reels: number, label: string, leading: boolean) => {
    const artHeight = artWidth * side.aspect;

    return (
      <View style={[styles.side, !leading && styles.sideBehind]}>
        {/**
         * A real mask, so the crop fades to nothing rather than to a colour.
         * Painting a gradient over it only works when you know what is behind,
         * and here there is a glow behind.
         */}
        <MaskedView
          style={{ width: artWidth, height: artHeight }}
          maskElement={
            <LinearGradient
              colors={[Mask.solid, Mask.solid, Mask.clear]}
              locations={[0, 1 - FadeRatio, 1]}
              style={StyleSheet.absoluteFill}
            />
          }>
          <Image
            source={side.art}
            style={{ width: artWidth, height: artHeight }}
            contentFit="contain"
            transition={240}
          />
        </MaskedView>

        <CountPill count={reels} size="compact" style={styles.pill} />
        <Text style={[styles.label, leading && styles.labelYou]}>{label}</Text>
      </View>
    );
  };

  return (
    <StepScreen
      step={5}
      onSkip={() => router.push('/onboarding/paywall')}
      footer={
        <>
          <PrimaryButton
            label={t('onboarding.friends.add')}
            icon={<Ionicons name="flash" size={18} color={Gradients.onGradient} />}
            onPress={() => router.push('/onboarding/paywall')}
          />
          <GhostButton
            label={t('onboarding.friends.decline')}
            onPress={() => router.push('/onboarding/paywall')}
          />
        </>
      }>
      <View style={styles.intro}>
        <Eyebrow style={styles.centered}>{t('onboarding.friends.eyebrow')}</Eyebrow>
        <Headline style={styles.centered}>{t('onboarding.friends.headline')}</Headline>
      </View>

      <View style={styles.arena}>
        {/** Light behind the two of them and no further. */}
        <View style={styles.blob} pointerEvents="none" />

        {duelist(you, InviteDuel.you, t('onboarding.friends.you'), true)}
        <View style={styles.lane} />
        {duelist(friend, InviteDuel.friend, t('onboarding.friends.friend'), false)}

        {/** Rides over both of them rather than sitting in the gap. */}
        <View style={styles.boltLane} pointerEvents="none">
          <View style={styles.boltGlow} />
          <Image
            source={require('@/assets/images/bolt.svg')}
            style={styles.bolt}
            contentFit="contain"
          />
        </View>
      </View>
    </StepScreen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    centered: {
      textAlign: 'center',
    },
    intro: {
      alignItems: 'center',
      gap: Spacing.two,
    },
    arena: {
      flexDirection: 'row',
      /** Each side sets its own height, so one of them can sit lower. */
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    blob: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: BlobDim,
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
    lane: {
      width: DividerWidth,
    },
    boltLane: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bolt: {
      width: BoltWidth,
      height: '100%',
    },
    /** Light along the strike, tighter and hotter than the one behind the arena. */
    boltGlow: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: GlowWidth,
      opacity: StrikeDim,
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
    side: {
      alignItems: 'center',
    },
    /** Behind on the count, and behind on the card. */
    sideBehind: {
      paddingTop: Stagger,
    },
    /** Lifted onto the art rather than parked under it. */
    pill: {
      marginTop: -Spacing.four,
    },
    label: {
      color: c.textSecondary,
      fontSize: 12,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginTop: Spacing.two,
    },
    /** Your side of the bolt reads a shade louder than theirs. */
    labelYou: {
      color: c.text,
    },
  });
