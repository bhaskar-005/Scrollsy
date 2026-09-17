import { AppState } from 'react-native';

import { api, apiConfigured, isSignedIn } from '@/lib/api';
import { flushOnboarding } from '@/lib/onboarding';
import { flushPreferences } from '@/lib/profile';
import { planSync } from '@/lib/sync-plan';
import {
  localDateKey,
  markSynced,
  mergeServerTotals,
  prune,
  readPending,
  shiftDateKey,
  type AppKey,
} from '@/lib/usage-store';

/**
 * How often to look for unsent reels while the app is open. Slow on purpose:
 * reels are counted while some other app is on screen, so very little piles
 * up while this one is. Opening and leaving the app trigger a pass as well.
 */
const IntervalMs = 60_000;

/**
 * One pass at a time. Two overlapping passes would each read the same pending
 * rows and send them twice, and the server adds whatever it is sent.
 */
let inFlight = false;

/**
 * Sends everything pending, oldest first, marking each call's own rows as it
 * goes. A call that fails changes nothing, so those rows stay pending and the
 * next pass tries again. Nothing is lost, because nothing was ever taken out
 * of the totals.
 *
 * This is the whole offline story for counting. A week with no connection is a
 * week of rows piling up on the device, and one pass afterwards clears them.
 */
export async function syncUsage(): Promise<void> {
  if (!apiConfigured || !isSignedIn() || inFlight) {
    return;
  }
  inFlight = true;

  try {
    const pending = await readPending();
    if (pending.length === 0) {
      return;
    }

    for (const batch of planSync(pending)) {
      await api('/usage/sync', { method: 'POST', body: { days: batch.days } });
      await markSynced(batch.rows);
    }
  } catch {
    // Offline, signed out, or the server refused. The rows stay pending.
  } finally {
    inFlight = false;
  }
}

/** The window Stats shows, and all the free plan may read back. */
export const HistoryDays = 7;

/**
 * Brings the server's history down. Only for a device that would otherwise
 * have nothing to show: a new install, a reinstall, or a second phone. Upload
 * first, so what this device is holding is part of what comes back.
 */
export async function pullUsage(): Promise<void> {
  if (!apiConfigured || !isSignedIn()) {
    return;
  }

  const to = localDateKey();
  const from = shiftDateKey(to, -(HistoryDays - 1));

  try {
    const rows = await api<{ date: string; app: string; reels: number }[]>(
      `/usage?from=${from}&to=${to}`,
    );
    await mergeServerTotals(rows as { date: string; app: AppKey; reels: number }[]);
  } catch {
    // Offline or signed out. The device's own numbers are what Stats shows.
  }
}

/**
 * One pass of everything this device owes the server: counted reels, changed
 * settings, and how far onboarding got. Each one is already local, so this is
 * only ever catching the server up.
 */
export async function syncAll(): Promise<void> {
  await syncUsage();
  await flushPreferences();
  await flushOnboarding();
}

/** Starts the sync triggers for the life of the app. Returns a stop. */
export function startUsageSync(): () => void {
  void prune()
    .then(syncAll)
    .then(pullUsage);

  const timer = setInterval(() => void syncAll(), IntervalMs);
  /** Both directions: coming back picks up what piled up, leaving flushes what is left. */
  const subscription = AppState.addEventListener('change', () => void syncAll());

  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}
