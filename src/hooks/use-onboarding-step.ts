import { useEffect } from 'react';

import { recordStep, type OnboardingStep } from '@/lib/onboarding';

/** Records that this onboarding screen was reached, once it is on screen. */
export function useOnboardingStep(step: OnboardingStep): void {
  useEffect(() => {
    recordStep(step);
  }, [step]);
}
