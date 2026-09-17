import { router } from 'expo-router';

import { Caption, GhostButton, Headline, PrimaryButton } from '@/components/ui';
import { NotificationPreview } from '@/components/onboarding/notification-preview';
import { StepScreen } from '@/components/onboarding/step-screen';
import { useOnboardingStep } from '@/hooks/use-onboarding-step';
import { setPreferences } from '@/lib/profile';
import { t } from '@/i18n';

export default function NotificationsScreen() {
  useOnboardingStep('notifications');

  /** The answer is kept either way, so Settings opens showing what was chosen here. */
  const answer = (enabled: boolean) => {
    setPreferences({ notificationsEnabled: enabled });
    router.push('/onboarding/friends');
  };

  return (
    <StepScreen
      step={4}
      onSkip={() => router.push('/onboarding/paywall')}
      footer={
        <>
          <PrimaryButton
            label={t('onboarding.notifications.enable')}
            onPress={() => answer(true)}
          />
          <GhostButton
            label={t('onboarding.notifications.decline')}
            onPress={() => answer(false)}
          />
        </>
      }>
      <Headline>{t('onboarding.notifications.headline')}</Headline>
      <Caption>{t('onboarding.notifications.caption')}</Caption>

      <NotificationPreview />
    </StepScreen>
  );
}
