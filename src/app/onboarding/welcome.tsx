import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GhostButton, Headline, PrimaryButton } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { ExternalLink } from '@/components/external-link';
import { Legal } from '@/constants/legal';
import { Fonts, Gradients, Spacing, type Palette } from '@/constants/theme';
import { useOnboardingStep } from '@/hooks/use-onboarding-step';
import { useTheme } from '@/hooks/use-theme';
import { isSignedIn } from '@/lib/api';
import { signIn } from '@/lib/google';
import { t } from '@/i18n';

export default function WelcomeScreen() {
  useOnboardingStep('welcome');
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Signing in is the point of this screen, but it is not a wall. With no
   * account the app still counts, locally, and onboarding carries on, because
   * a person who cannot get past the first screen never sees the offer.
   */
  const start = async () => {
    if (busy) {
      return;
    }
    if (isSignedIn()) {
      router.push('/onboarding/concept');
      return;
    }

    setBusy(true);
    setFailed(false);
    const result = await signIn();
    setBusy(false);

    if (result === 'cancelled') {
      return;
    }
    if (result === 'failed') {
      setFailed(true);
      return;
    }
    router.push('/onboarding/concept');
  };

  return (
    <Backdrop>
      <View style={styles.hero}>
        {/**
         * Flexes rather than sitting at a fixed size, so the art soaks up the
         * leftover height instead of leaving a void between copy and button.
         */}
        <Image
          source={require('@/assets/images/onboarding-hero.png')}
          style={styles.art}
          contentFit="contain"
          transition={220}
        />

        <Headline style={styles.centered}>{t('onboarding.welcome.headline')}</Headline>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={t('onboarding.welcome.start')}
          icon={
            <View style={styles.googleChip}>
              <Image
                source={require('@/assets/images/google-g.svg')}
                style={styles.googleMark}
                contentFit="contain"
                accessibilityLabel={t('onboarding.welcome.googleIcon')}
              />
            </View>
          }
          onPress={() => void start()}
          disabled={busy}
        />

        {/**
         * Only after it has actually failed, so it never competes with the one
         * primary action. Offline, or Google having a bad day, must not be a
         * wall: the app counts on the device either way, and whatever it counts
         * uploads the moment they do sign in.
         */}
        {failed ? (
          <>
            <Text style={styles.failed}>{t('onboarding.welcome.failed')}</Text>
            <GhostButton
              label={t('onboarding.welcome.continueWithout')}
              onPress={() => router.push('/onboarding/concept')}
            />
          </>
        ) : null}

        {/** The stores reject a login screen that hides these. */}
        <Text style={styles.consent}>
          {t('onboarding.welcome.consentLead')}{' '}
          <ExternalLink href={Legal.terms} style={styles.consentLink}>
            {t('onboarding.welcome.terms')}
          </ExternalLink>{' '}
          {t('onboarding.welcome.consentJoin')}{' '}
          <ExternalLink href={Legal.privacy} style={styles.consentLink}>
            {t('onboarding.welcome.privacy')}
          </ExternalLink>
        </Text>
      </View>
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    hero: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.four,
    },
    art: {
      flex: 1,
      width: '100%',
      maxWidth: 420,
    },
    centered: {
      textAlign: 'center',
    },
    footer: {
      gap: Spacing.three,
      /** Pushes off the headline, so the button reads as its own zone. */
      paddingTop: Spacing.five,
      paddingBottom: Spacing.four,
    },
    failed: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
    },
    consent: {
      color: c.textFaint,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      textAlign: 'center',
    },
    consentLink: {
      color: c.textSecondary,
      textDecorationLine: 'underline',
    },
    /**
     * Google asks for their mark on a light surface, never on brand colour, and
     * the button face does not flip with the scheme so neither does this.
     */
    googleChip: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Gradients.onGradient,
    },
    googleMark: {
      width: 16,
      height: 16,
    },
  });
