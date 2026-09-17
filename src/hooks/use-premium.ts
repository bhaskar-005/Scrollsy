import { useSyncExternalStore } from 'react';

import { useProfile } from '@/hooks/use-profile';
import { isEntitled, subscribeEntitlement } from '@/lib/purchases';

/**
 * Whether this person is a member, from both places that know.
 *
 * The database is the durable answer, set by the RevenueCat webhook, and it is
 * what a new phone reads. The store's own answer on this device is the fast
 * one, and it is what makes the app change the instant a purchase goes
 * through rather than a webhook later. Either one being true is enough.
 */
export function usePremium(): boolean {
  const { profile } = useProfile();
  const entitled = useSyncExternalStore(subscribeEntitlement, isEntitled, isEntitled);

  return profile.premium || entitled;
}
