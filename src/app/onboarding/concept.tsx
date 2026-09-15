import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Caption, CountPill, Headline, PrimaryButton } from '@/components/ui';
import { Mascot } from '@/components/mascot';
import { StepScreen } from '@/components/onboarding/step-screen';
import { StageOrder } from '@/constants/stages';
import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** The tether pays out one rung every hundred. */
const ReelsPerStage = 100;
/** The climb stops on the bottom rung. Nothing counts past it. */
const TopReels = (StageOrder.length - 1) * ReelsPerStage;

/** How long the count takes to climb, and how often it redraws. */
const RunMs = 2800;
const TickMs = 40;

/** How far he sinks over the climb. His size never changes, only his depth. */
const Drift = 34;

/** Slow enough to read as him turning into the next one. */
const Dissolve = { duration: 520, timing: 'ease-in-out', effect: 'cross-dissolve' } as const;

export default function ConceptScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { width } = useWindowDimensions();
  const mascotWidth = Math.min(width * 0.45, 182);

  /** Bumped by a tap on him, which is all it takes to run it again. */
  const [run, setRun] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const since = Date.now() - start;
      setElapsed(since);
      if (since >= RunMs) {
        clearInterval(id);
      }
    }, TickMs);

    return () => clearInterval(id);
  }, [run]);

  const progress = Math.min(elapsed / RunMs, 1);
  const reels = Math.round(TopReels * progress);
  const rung = Math.min(Math.floor(reels / ReelsPerStage), StageOrder.length - 1);
  /** The climb stops on the bottom rung and stays there. */
  const done = progress >= 1;
  const state = StageOrder[rung];

  return (
    <StepScreen
      step={2}
      footer={
        <PrimaryButton
          label={t('onboarding.concept.next')}
          onPress={() => router.push('/onboarding/permission')}
        />
      }>
      <Headline style={styles.centered}>{t('onboarding.concept.headline')}</Headline>

      <Pressable
        onPress={() => {
          setElapsed(0);
          setRun((previous) => previous + 1);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.concept.replay')}
        style={styles.stack}>
        {/**
         * Holds the full sink height from the start, so the pill below it never
         * shifts while he drops.
         */}
        <View style={[styles.orbit, { height: mascotWidth + Drift }]}>
          <Mascot
            stage={state}
            width={mascotWidth}
            transition={Dissolve}
            style={{ transform: [{ translateY: progress * Drift }] }}
          />
        </View>

        <CountPill count={reels} />
        <Text style={styles.reelsLabel}>{t('onboarding.concept.reels')}</Text>

        {/** One notch per rung. The wide one is the rung he is on. */}
        <View style={styles.rail}>
          {StageOrder.map((stage, index) => (
            <View
              key={stage}
              style={[
                styles.notch,
                index <= rung && styles.notchPassed,
                index === rung && styles.notchHere,
              ]}
            />
          ))}
        </View>
      </Pressable>

      <View style={styles.tail}>
        <Caption style={styles.centered}>{t('onboarding.concept.caption')}</Caption>
        {/** Kept in the layout the whole time so nothing jumps when it lands. */}
        <Text style={[styles.replay, !done && styles.replayHidden]}>
          {t('onboarding.concept.replay')}
        </Text>
      </View>
    </StepScreen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    centered: {
      textAlign: 'center',
    },
    stack: {
      alignItems: 'center',
    },
    orbit: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      /** Keeps him off the pill once he has drifted the whole way down. */
      marginBottom: Spacing.three,
    },
    reelsLabel: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      marginTop: Spacing.two,
    },
    rail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.three,
    },
    notch: {
      width: 8,
      height: 8,
      borderRadius: Radius.pill,
      backgroundColor: c.track,
    },
    notchPassed: {
      backgroundColor: c.accent,
    },
    notchHere: {
      width: 26,
    },
    tail: {
      gap: Spacing.one,
    },
    replay: {
      color: c.textFaint,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
    },
    replayHidden: {
      opacity: 0,
    },
  });
