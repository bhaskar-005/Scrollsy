import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { acceptPendingInvite, savePendingInvite } from '@/lib/invites';
import { isOnboarded, resumeHref } from '@/lib/onboarding';

/**
 * Where an invite link lands, from the website's button or a shared link.
 * Nothing to show: it keeps the code, accepts it when there is already an
 * account, and moves on. Someone new keeps the code through onboarding and it
 * is accepted as soon as they sign in.
 */
export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    savePendingInvite(code ?? '');
    void acceptPendingInvite();
    /** Straight to the board when there is one to see, otherwise carry on where they were. */
    router.replace(isOnboarded() ? '/battle' : resumeHref());
  }, [code]);

  return null;
}
