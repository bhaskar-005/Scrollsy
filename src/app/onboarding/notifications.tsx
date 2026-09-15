import { router } from 'expo-router';

import { Caption, GhostButton, Headline, PrimaryButton } from '@/components/ui';
import { NotificationPreview } from '@/components/onboarding/notification-preview';
import { StepScreen } from '@/components/onboarding/step-screen';
import { t } from '@/i18n';

export default function NotificationsScreen() {
  return (
    <StepScreen
      step={4}
      onSkip={() => router.push('/onboarding/paywall')}
      footer={
        <>
          <PrimaryButton
            label={t('onboarding.notifications.enable')}
            onPress={() => router.push('/onboarding/friends')}
          />
          <GhostButton
            label={t('onboarding.notifications.decline')}
            onPress={() => router.push('/onboarding/friends')}
          />
        </>
      }>
      <Headline>{t('onboarding.notifications.headline')}</Headline>
      <Caption>{t('onboarding.notifications.caption')}</Caption>

      <NotificationPreview />
    </StepScreen>
  );
}
