import 'expo-sqlite/localStorage/install';

import { api, apiConfigured, isSignedIn } from '@/lib/api';
import { localDateKey } from '@/lib/usage-store';

/**
 * The leaderboard. The one screen that cannot be answered from this device,
 * because it is other people's counts, so it is fetched, then cached for the
 * day. A cached board draws instantly and is only ever minutes stale, which
 * beats an empty screen while a request is in the air.
 */

export type BoardEntry = {
  id: string;
  name: string;
  avatarUrl: string | null;
  premium: boolean;
  reels: number;
  isMe: boolean;
};

/** Five friends free. The sixth is what the plan is for. Matches `friend_cap_reached`. */
export const FreeFriendCap = 5;

const Key = 'board.cache';

type Cache = { date: string; entries: BoardEntry[] };

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The last board this device saw, if it was for today. Yesterday's would lie. */
export function readBoard(): BoardEntry[] | null {
  const raw = localStorage.getItem(Key);
  if (!raw) {
    return null;
  }
  try {
    const cache = JSON.parse(raw) as Cache;
    return cache.date === localDateKey() ? cache.entries : null;
  } catch {
    return null;
  }
}

function writeBoard(entries: BoardEntry[]) {
  localStorage.setItem(Key, JSON.stringify({ date: localDateKey(), entries } satisfies Cache));
  listeners.forEach((listener) => listener());
}

export function clearBoard(): void {
  localStorage.removeItem(Key);
  listeners.forEach((listener) => listener());
}

/** Fewest reels first, because fewest is what winning looks like here. */
export async function fetchBoard(): Promise<BoardEntry[]> {
  if (!apiConfigured || !isSignedIn()) {
    return [];
  }

  const entries = await api<BoardEntry[]>(`/leaderboard?date=${localDateKey()}`);
  const ranked = [...entries].sort((a, b) => a.reels - b.reels);
  writeBoard(ranked);
  return ranked;
}
