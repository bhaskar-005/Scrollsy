import { apiConfigured, signInWithGoogle } from '@/lib/api';

/**
 * Signing in. Google is the only way in, so this is the whole of it.
 *
 * The phone gets an ID token from Google and the API trades it for a session,
 * which means the app never holds a Google secret and never talks to Supabase
 * itself.
 *
 * The native half only exists in a development build. It is loaded on the
 * first tap rather than imported at the top, because the module throws on
 * import when the native side is missing, and that would take down every
 * screen that reaches this file instead of one button.
 */

/** From Google Cloud, the Web client id, even on Android. See .env.example. */
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** False until the client id and the API address are both set. */
export const googleConfigured = Boolean(webClientId) && apiConfigured;

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let loaded: GoogleModule | null = null;
let configured = false;

async function google(): Promise<GoogleModule | null> {
  if (!loaded) {
    try {
      loaded = await import('@react-native-google-signin/google-signin');
    } catch {
      return null;
    }
  }
  if (!configured && webClientId) {
    loaded.GoogleSignin.configure({ webClientId });
    configured = true;
  }
  return loaded;
}

export type SignInResult =
  /** Signed in. There is a session. */
  | 'signedIn'
  /** They backed out of Google's own sheet. Nothing to say about it. */
  | 'cancelled'
  /** No client id, no API, no native module, or no Play services. */
  | 'unavailable'
  /** It went wrong. Worth offering another go. */
  | 'failed';

export async function signIn(): Promise<SignInResult> {
  if (!googleConfigured) {
    return 'unavailable';
  }

  const module = await google();
  if (!module) {
    return 'unavailable';
  }

  try {
    await module.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await module.GoogleSignin.signIn();
    if (!module.isSuccessResponse(response)) {
      return 'cancelled';
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      return 'failed';
    }

    await signInWithGoogle(idToken);
    return 'signedIn';
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === module.statusCodes.SIGN_IN_CANCELLED) {
      return 'cancelled';
    }
    if (code === module.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'unavailable';
    }
    return 'failed';
  }
}

/** Forgets the Google account too, so the next sign in asks which one to use. */
export async function forgetGoogleAccount(): Promise<void> {
  if (!googleConfigured) {
    return;
  }
  try {
    await (await google())?.GoogleSignin.signOut();
  } catch {
    // Nothing to forget, or no native module. Our own session is what matters.
  }
}
