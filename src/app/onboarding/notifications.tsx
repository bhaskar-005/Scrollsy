import { router } from 'expo-router';

import { Caption, GhostButton, Headline, PrimaryButton } from '@/components/ui';
import { NotificationPreview } from '@/components/onboarding/notification-preview';
import { StepScreen } from '@/components/onboarding/step-screen';
import { useOnboardingStep } from '@/hooks/use-onboarding-step';
import { requestNotifications } from '@/lib/permissions';
import { setPreferences } from '@/lib/profile';
import { t } from '@/i18n';

export default function NotificationsScreen() {
  useOnboardingStep('notifications');

  /**
   * Enable asks Android for real, and what is kept is Android's answer, not
   * the tap. Declining never asks, so the prompt is still there to spend later
   * if they turn notifications on from Settings instead.
   */
  const answer = async (enabled: boolean) => {
    setPreferences({ notificationsEnabled: enabled ? await requestNotifications() : false });
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
            onPress={() => void answer(true)}
          />
          <GhostButton
            label={t('onboarding.notifications.decline')}
            onPress={() => void answer(false)}
          />
        </>
      }>
      <Headline>{t('onboarding.notifications.headline')}</Headline>
      <Caption>{t('onboarding.notifications.caption')}</Caption>

      <NotificationPreview />
    </StepScreen>
  );
}
