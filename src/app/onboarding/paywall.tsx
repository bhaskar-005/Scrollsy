import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Backdrop } from '@/components/backdrop';
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
import { buy, preparePurchases, recordCustomerInfo } from '@/lib/purchases';

/** The last step either way. Launch goes straight to Home from here on. */
function finish() {
  recordStep('done');
  router.replace('/home');
}

type PurchasesUI = typeof import('react-native-purchases-ui');

/**
 * Screen 6. RevenueCat's own paywall, designed in their dashboard, so the
 * layout, copy and the 14 day timeline change without an app release. See
 * docs/revenuecat-paywall-brief.md.
 *
 * The written screen below stands in only where RevenueCat cannot run at all:
 * no key, or a build without the native module.
 */
export default function OnboardingPaywallScreen() {
  useOnboardingStep('paywall');

  /** Undefined while loading, null when RevenueCat cannot run in this build. */
  const [ui, setUi] = useState<PurchasesUI | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void (async () => {
      let loaded: PurchasesUI | null = null;
      if (await preparePurchases()) {
        try {
          loaded = await import('react-native-purchases-ui');
        } catch {
          loaded = null;
        }
      }
      if (live) {
        setUi(loaded);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (ui === undefined) {
    /** A beat at most. The SDK is usually configured at launch already. */
    return <Backdrop>{null}</Backdrop>;
  }
  if (ui === null) {
    return <WrittenPaywall />;
  }

  const Paywall = ui.default.Paywall;
  return (
    <View style={layout.store}>
      <Paywall
        onPurchaseCompleted={({ customerInfo }) => {
          recordCustomerInfo(customerInfo);
          void refreshProfile(true);
          finish();
        }}
        onRestoreCompleted={({ customerInfo }) => {
          if (recordCustomerInfo(customerInfo)) {
            void refreshProfile(true);
            finish();
          }
        }}
        /** The paywall's own close button is its "Continue free". */
        onDismiss={finish}
      />
    </View>
  );
}

/** The app's own paywall, for a build where RevenueCat's cannot be drawn. */
function WrittenPaywall() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [plan, setPlan] = useState<PlanId>('yearly');
  /** The store's own prices, in the buyer's currency. Written ones show until they land. */
  const offers = useOffers(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'failed' | 'unavailable' | null>(null);


  const selected = offers.find((offer) => offer.plan === plan) ?? null;
  const price =
    selected?.entry?.price ?? selected?.price ?? (plan === 'yearly' ? Pricing.entry : Pricing.monthly);

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

/** RevenueCat's view draws its own background and safe areas. It only needs the room. */
const layout = StyleSheet.create({
  store: {
    flex: 1,
  },
});

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
