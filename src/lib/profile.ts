import 'expo-sqlite/localStorage/install';

import {
  isCounterSize,
  isCounterStyle,
  type CounterPosition,
  type CounterSize,
  type CounterStyle,
} from '@/constants/counter';
import { ApiError, api, apiConfigured, isSignedIn } from '@/lib/api';

/**
 * The account, as the device remembers it. Read from the cache first so a cold
 * launch draws the right name and the right Pro state instead of flickering
 * through a signed out one, then refreshed from the server behind that.
 *
 * Preferences are written the same way round: changed here at once, sent after.
 * A change made offline sits in `unsent` until a pass gets through, so the
 * toggle never springs back under someone's thumb.
 */

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  dailyLimit: number;
  counterStyle: CounterStyle;
  counterSize: CounterSize;
  counterPosition: CounterPosition;
  notificationsEnabled: boolean;
  screenTimeGranted: boolean;
  overlayGranted: boolean;
  premium: boolean;
  subscription: { status: string; expiresAt: string | null };
};

/** The preference fields a person can change from inside the app. */
export type Preferences = Pick<
  Profile,
  | 'dailyLimit'
  | 'counterStyle'
  | 'counterSize'
  | 'counterPosition'
  | 'notificationsEnabled'
  | 'screenTimeGranted'
  | 'overlayGranted'
>;

/**
 * What the screens draw before anyone has signed in, and what a missing field
 * falls back to. The values match the column defaults in the migration, so the
 * app and a fresh row agree.
 */
export const DefaultProfile: Profile = {
  id: '',
  name: '',
  email: null,
  avatarUrl: null,
  dailyLimit: 400,
  counterStyle: 'pill',
  counterSize: 'medium',
  counterPosition: { x: 0.86, y: 0.08 },
  notificationsEnabled: false,
  screenTimeGranted: false,
  overlayGranted: false,
  premium: false,
  subscription: { status: 'none', expiresAt: null },
};

const Keys = {
  cache: 'profile.cache',
  unsent: 'profile.unsent',
} as const;

/** How long a read stays fresh, so three tabs mounting do not make three calls. */
const FreshMs = 30_000;

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** The cached account, synchronously, for a first render that is already right. */
export function readProfile(): Profile {
  const cached = readJson<Partial<Profile>>(Keys.cache);
  return cached ? { ...DefaultProfile, ...cached } : DefaultProfile;
}

function writeProfile(profile: Profile) {
  localStorage.setItem(Keys.cache, JSON.stringify(profile));
  notify();
}

/**
 * Fills the name, email and photo from Google's own answer at sign in, so
 * Settings shows who is signed in right away instead of waiting on `/me`.
 * Only fills what is empty. The server's copy replaces it on the next read.
 */
export function seedProfile(identity: Pick<Profile, 'name' | 'email' | 'avatarUrl'>): void {
  const current = readProfile();
  writeProfile({
    ...current,
    name: current.name || identity.name,
    email: current.email ?? identity.email,
    avatarUrl: current.avatarUrl ?? identity.avatarUrl,
  });
}

/** Forgets the account on sign out, so the next person sees none of it. */
export function clearProfile(): void {
  localStorage.removeItem(Keys.cache);
  localStorage.removeItem(Keys.unsent);
  notify();
}

/** The wire shape of a preference patch. Flat, because the API's fields are flat. */
type Patch = Record<string, unknown>;

function readUnsent(): Patch {
  return readJson<Patch>(Keys.unsent) ?? {};
}

function toPatch(preferences: Partial<Preferences>): Patch {
  const { counterPosition, ...rest } = preferences;
  return counterPosition
    ? { ...rest, counterPositionX: counterPosition.x, counterPositionY: counterPosition.y }
    : { ...rest };
}

/**
 * The server's answer, with any preference this device has not managed to send
 * yet laid back over it. Without this, a reply that crossed a change in flight
 * would flip the switch back under someone's thumb, and the next pass would
 * flip it again.
 */
function withUnsent(remote: Profile, local: Profile, unsent: Patch): Profile {
  const held = Object.hasOwn.bind(null, unsent);
  return {
    ...remote,
    ...(held('dailyLimit') ? { dailyLimit: local.dailyLimit } : {}),
    ...(held('counterStyle') ? { counterStyle: local.counterStyle } : {}),
    ...(held('counterSize') ? { counterSize: local.counterSize } : {}),
    ...(held('counterPositionX') || held('counterPositionY')
      ? { counterPosition: local.counterPosition }
      : {}),
    ...(held('notificationsEnabled') ? { notificationsEnabled: local.notificationsEnabled } : {}),
    ...(held('screenTimeGranted') ? { screenTimeGranted: local.screenTimeGranted } : {}),
    ...(held('overlayGranted') ? { overlayGranted: local.overlayGranted } : {}),
  };
}

let lastRead = 0;
let reading: Promise<void> | null = null;

/**
 * Counts accepted preference writes. A read that was already in the air when
 * one landed is answering an older question, so its reply is dropped rather
 * than written over the newer state.
 */
let writes = 0;

/** Pulls the account from the server, at most once every `FreshMs` unless forced. */
export async function refreshProfile(force = false): Promise<void> {
  if (!apiConfigured || !isSignedIn()) {
    return;
  }
  if (!force && Date.now() - lastRead < FreshMs) {
    return;
  }

  reading ??= (async () => {
    const asked = writes;
    try {
      const remote = await api<Profile>('/me');
      if (writes !== asked) {
        // A patch landed while this was in the air. Its answer is the fresher one.
        return;
      }
      writeProfile(withUnsent(remote, readProfile(), readUnsent()));
      lastRead = Date.now();
    } catch {
      // Offline, or the session went. What is cached stands.
    } finally {
      reading = null;
    }
  })();

  return reading;
}

/**
 * Changes preferences here first, then sends them. Everything unsent goes in
 * one call, so flipping three toggles in a row is one request, not three.
 */
export function setPreferences(preferences: Partial<Preferences>): void {
  const current = readProfile();
  writeProfile({ ...current, ...preferences });
  localStorage.setItem(Keys.unsent, JSON.stringify({ ...readUnsent(), ...toPatch(preferences) }));
  void flushPreferences();
}

let sending = false;

/**
 * Sends the unsent preferences. Clears only the fields it sent and only if
 * they have not changed since, so a toggle flipped mid request stays unsent
 * and goes out on the next pass.
 */
export async function flushPreferences(): Promise<void> {
  const patch = readUnsent();
  const fields = Object.keys(patch);
  if (!apiConfigured || !isSignedIn() || sending || fields.length === 0) {
    return;
  }

  sending = true;
  let sent = false;
  try {
    const saved = await api<Profile>('/me', { method: 'PATCH', body: patch });
    /** Anything changed while this was in flight stays as the person left it. */
    const stillHeld = { ...readUnsent() };
    for (const field of fields) {
      if (stillHeld[field] === patch[field]) {
        delete stillHeld[field];
      }
    }
    writeProfile(withUnsent(saved, readProfile(), stillHeld));
    lastRead = Date.now();
    writes += 1;
    sent = true;
  } catch (error) {
    /**
     * A refusal can never succeed on a retry, so drop it rather than loop on
     * it forever. Not being signed in is not a refusal of the value: that one
     * waits for a session.
     */
    sent =
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 401 &&
      error.status !== 429;
  } finally {
    sending = false;
  }

  if (!sent) {
    return;
  }

  const remaining = readUnsent();
  for (const field of fields) {
    if (remaining[field] === patch[field]) {
      delete remaining[field];
    }
  }
  localStorage.setItem(Keys.unsent, JSON.stringify(remaining));
  if (Object.keys(remaining).length > 0) {
    void flushPreferences();
  }
}

/** Narrows a stored style, so an old cache or a new server value cannot break the picker. */
export function counterStyleOf(profile: Profile): CounterStyle {
  return isCounterStyle(profile.counterStyle) ? profile.counterStyle : DefaultProfile.counterStyle;
}

/** Narrows a stored size the same way, so an account made before it existed still draws. */
export function counterSizeOf(profile: Profile): CounterSize {
  return isCounterSize(profile.counterSize) ? profile.counterSize : DefaultProfile.counterSize;
}
