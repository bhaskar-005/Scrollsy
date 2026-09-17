import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { isSignedIn, subscribeAuth } from '@/lib/api';
import { readProfile, refreshProfile, subscribe, type Profile } from '@/lib/profile';

/**
 * The account, from the device's cache, refreshed behind the first render.
 * Every screen that shows a name, a photo, or anything Pro reads it from here,
 * so they all change together the moment a plan starts or a setting moves.
 */
export function useProfile(): { profile: Profile; signedIn: boolean } {
  const [profile, setProfile] = useState(readProfile);
  const [signedIn, setSignedIn] = useState(isSignedIn);

  useEffect(() => {
    const unsubscribe = subscribe(() => setProfile(readProfile()));
    const unsubscribeAuth = subscribeAuth(() => setSignedIn(isSignedIn()));
    void refreshProfile();

    /** Coming back is when a purchase made outside the app will have landed. */
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshProfile();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeAuth();
      appState.remove();
    };
  }, []);

  return { profile, signedIn };
}
