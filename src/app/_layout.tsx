import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isSignedIn, subscribeAuth } from '@/lib/api';
import { collectCounted } from '@/lib/counting';
import { acceptPendingInvite } from '@/lib/invites';
import { pullOnboardingProgress } from '@/lib/onboarding';
import { clearProfile, readProfile, refreshProfile } from '@/lib/profile';
import { forgetCustomer, identifyCustomer, startPurchases } from '@/lib/purchases';
import { pullUsage, startUsageSync, syncAll } from '@/lib/sync';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  /** Pushes locally counted reels to the server for as long as the app is alive. */
  useEffect(() => startUsageSync(), []);

  /**
   * Collects whatever the counting service tallied while this app was closed,
   * and again every time it comes back to the front. This is the only route
   * those numbers take into the app, so it runs before anything reads them.
   */
  useEffect(() => {
    void collectCounted();
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void collectCounted();
      }
    });
    return () => appState.remove();
  }, []);

  /**
   * Catches up on a plan bought, renewed or cancelled somewhere else, so a
   * member who paid on another phone opens this one already unlocked.
   */
  useEffect(() => {
    void startPurchases().then(() => {
      /** Also covers someone already signed in from before purchases existed. */
      if (isSignedIn()) {
        return identifyCustomer(readProfile().id);
      }
    });
  }, []);

  /** Picks up onboarding progress made on another phone, and any waiting invite. */
  useEffect(() => {
    void pullOnboardingProgress();
    /** An invite from a link waits here until there is an account to accept it with. */
    void acceptPendingInvite();
  }, []);

  /**
   * Signing in hands the server everything this device counted and changed
   * while there was nobody to attach it to, then fills the account and brings
   * back whatever history it already had.
   *
   * Signing out, whether from Settings or because the session died, drops every
   * trace of the account from this device.
   */
  useEffect(
    () =>
      subscribeAuth(() => {
        if (isSignedIn()) {
          /** Push first, so the account is read back with this device's work already in it. */
          void syncAll()
            .then(() => refreshProfile(true))
            /** Purchases are tied to the account id, which the read above is what supplies. */
            .then(() => identifyCustomer(readProfile().id))
            .then(pullUsage);
          void acceptPendingInvite();
        } else {
          clearProfile();
          void forgetCustomer();
        }
      }),
    [],
  );

  /** Keyed off the theme tokens, so a name can never drift from what a screen asks for. */
  const [fontsLoaded, fontError] = useFonts({
    [Fonts.regular]: PlusJakartaSans_400Regular,
    [Fonts.medium]: PlusJakartaSans_500Medium,
    [Fonts.semiBold]: PlusJakartaSans_600SemiBold,
    [Fonts.bold]: PlusJakartaSans_700Bold,
    [Fonts.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  /** Hold the splash rather than let the first paint land in the system font. */
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
