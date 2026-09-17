import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Eyebrow, GhostButton, Headline, PrimaryButton } from '@/components/ui';
import { StepScreen } from '@/components/onboarding/step-screen';
import { PerkList, PlanPicker, PlanTerms, type PlanId } from '@/components/plans';
import { Pricing } from '@/constants/placeholder';
import { Fonts, Spacing, type Palette } from '@/constants/theme';
import { useOnboardingStep } from '@/hooks/use-onboarding-step';
import { useOffers } from '@/hooks/use-offers';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { recordStep } from '@/lib/onboarding';
import { refreshProfile } from '@/lib/profile';
import { buy } from '@/lib/purchases';

/** The last step either way. Launch goes straight to Home from here on. */
function finish() {
  recordStep('done');
  router.replace('/home');
}

export default function OnboardingPaywallScreen() {
  useOnboardingStep('paywall');
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [plan, setPlan] = useState<PlanId>('yearly');
  /** The store's own prices, in the buyer's currency. Written ones show until they land. */
  const offers = useOffers(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'failed' | 'unavailable' | null>(null);


  const selected = offers.find((offer) => offer.plan === plan) ?? null;
  const price = selected?.entry?.price ?? selected?.price ?? Pricing.entry;

  /**
   * Buying ends onboarding the same way declining does. Nobody is held on this
   * screen by a failed payment, because the way out is the whole reason the
   * free tier exists.
   */
  const start = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await buy(plan);
    setBusy(false);

    if (result === 'bought') {
      void refreshProfile(true);
      finish();
      return;
    }
    if (result === 'cancelled') {
      return;
    }
    setNotice(result === 'unavailable' ? 'unavailable' : 'failed');
  };

  return (
    <StepScreen
      step={6}
      footer={
        <>
          <PrimaryButton
            label={busy ? t('paywall.purchasing') : t('paywall.start', { price })}
            onPress={() => void start()}
            disabled={busy}
          />
          {notice ? <Text style={styles.notice}>{t(`paywall.${notice}`)}</Text> : null}
          {/** Required by the stores, and hiding it is how apps get pulled. */}
          <PlanTerms offer={selected} />
          <GhostButton label={t('paywall.continueFree')} onPress={finish} />
        </>
      }>
      <Eyebrow>{t('paywall.eyebrow')}</Eyebrow>
      <Headline>{t('paywall.headline')}</Headline>
      <PlanPicker value={plan} onChange={setPlan} offers={offers} />
      <PerkList />
    </StepScreen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    notice: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: Spacing.three,
    },
  });
