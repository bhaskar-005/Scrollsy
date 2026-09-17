import 'expo-sqlite/localStorage/install';

/**
 * The app's only way to the server. It knows the API's address and nothing
 * about the database behind it: no Supabase URL, no Supabase key.
 *
 * The session lives in expo-sqlite's localStorage, the storage Expo's own
 * Supabase guide recommends for it. SecureStore was ruled out because tokens
 * carrying a Google profile can outgrow its roughly 2KB value limit.
 */

const baseUrl = process.env.EXPO_PUBLIC_API_URL;

export type Session = {
  accessToken: string;
  refreshToken: string;
  /** Seconds since the epoch. */
  expiresAt: number;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const SessionKey = 'auth.session';

/** Refresh this long before expiry, so a token never dies mid request. */
const RefreshMarginMs = 60_000;

/** Unset until `.env.local` names the API. The app still runs and counts without it. */
export const apiConfigured = Boolean(baseUrl);

function readSession(): Session | null {
  const raw = localStorage.getItem(SessionKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

const authListeners = new Set<() => void>();

/**
 * Called when a session appears or disappears, so the screens holding account
 * state can drop it or fetch it. Not called on a refresh, which changes the
 * token but not who is signed in. Returns the unsubscribe.
 */
export function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function writeSession(session: Session | null) {
  const had = readSession() !== null;

  if (session) {
    localStorage.setItem(SessionKey, JSON.stringify(session));
  } else {
    localStorage.removeItem(SessionKey);
  }

  if (had !== Boolean(session)) {
    authListeners.forEach((listener) => listener());
  }
}

export function isSignedIn(): boolean {
  return readSession() !== null;
}

/**
 * One refresh at a time. Refresh tokens rotate, so two refreshes racing with
 * the same token would have the second rejected and sign the person out.
 */
let refreshing: Promise<Session | null> | null = null;

function refresh(session: Session): Promise<Session | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (response.status === 401) {
        // The refresh token itself is dead. That is a real sign out.
        writeSession(null);
        return null;
      }
      if (!response.ok) {
        // An outage, not a verdict. Keep the session and let a later call retry.
        return session;
      }

      const next = (await response.json()) as Session;
      writeSession(next);
      return next;
    } catch {
      return session;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** False for the calls that create a session rather than use one. */
  authenticated?: boolean;
};

/**
 * One call to the API. Attaches the session, refreshes it first when it is
 * about to expire, and retries once if the server still says it expired.
 * Throws `ApiError` with the server's error code on any failure.
 */
export async function api<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!baseUrl) {
    throw new ApiError(0, 'not_configured');
  }

  const authenticated = options.authenticated ?? true;
  let session = authenticated ? readSession() : null;

  if (authenticated) {
    if (session && session.expiresAt * 1000 - Date.now() < RefreshMarginMs) {
      session = await refresh(session);
    }
    if (!session) {
      throw new ApiError(401, 'not_authenticated');
    }
  }

  const send = (current: Session | null) =>
    fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(current ? { Authorization: `Bearer ${current.accessToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  let response = await send(session);

  if (response.status === 401 && session) {
    const next = await refresh(session);
    if (next && next.accessToken !== session.accessToken) {
      response = await send(next);
    }
  }

  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(response.status, failure.error ?? 'request_failed');
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Trades a Google ID token from the device for a session. */
export async function signInWithGoogle(idToken: string): Promise<void> {
  const session = await api<Session>('/auth/google', {
    method: 'POST',
    body: { idToken },
    authenticated: false,
  });
  writeSession(session);
}

/** Revokes the session on the server when it can, and always forgets it here. */
export async function signOut(): Promise<void> {
  try {
    await api('/auth/signout', { method: 'POST' });
  } catch {
    // Offline or already expired. Forgetting it locally is what matters.
  } finally {
    writeSession(null);
  }
}
