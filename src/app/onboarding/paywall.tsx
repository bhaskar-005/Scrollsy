import { router } from 'expo-router';

import { Eyebrow, GhostButton, Headline, PrimaryButton } from '@/components/ui';
import { StepScreen } from '@/components/onboarding/step-screen';
import { PerkList } from '@/components/plans';
import { Pricing } from '@/constants/placeholder';
import { t } from '@/i18n';

/**
 * The plan picker and its terms are parked until RevenueCat drives them. Both
 * still live in `@/components/plans` and the modal paywall still uses them, so
 * bringing them back here is a matter of uncommenting the four lines below.
 */
// import { useState } from 'react';
// import { PlanPicker, PlanTerms, type PlanId } from '@/components/plans';

export default function OnboardingPaywallScreen() {
  // const [plan, setPlan] = useState<PlanId>('yearly');

  return (
    <StepScreen
      step={6}
      footer={
        <>
          <PrimaryButton
            label={t('paywall.start', { days: Pricing.trialDays })}
            onPress={() => router.replace('/home')}
          />
          {/* <PlanTerms /> */}
          <GhostButton label={t('paywall.continueFree')} onPress={() => router.replace('/home')} />
        </>
      }>
      <Eyebrow>{t('paywall.eyebrow')}</Eyebrow>
      <Headline>{t('paywall.headline')}</Headline>
      {/* <PlanPicker value={plan} onChange={setPlan} /> */}
      <PerkList />
    </StepScreen>
  );
}
