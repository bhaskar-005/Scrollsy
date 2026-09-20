import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { toAppUsage, type AppUsage } from '@/constants/apps';
import { HistoryDays } from '@/lib/sync';
import {
  localDateKey,
  readApps,
  readDays,
  shiftDateKey,
  subscribe,
  type AppTotal,
  type DayTotal,
} from '@/lib/usage-store';

export type WeekDay = { date: string; reels: number; label: string };

export type UsageWeek = {
  days: WeekDay[];
  apps: AppUsage[];
  total: number;
  /** The span being shown, as `Sep 10 to Sep 16`. */
  range: string;
};

/** One letter, in the phone's own language. */
function dayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'narrow' });
}

function monthDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fold(days: DayTotal[], apps: AppTotal[]): UsageWeek {
  const counts = days.map((day) => day.reels);
  const total = counts.reduce((sum, reels) => sum + reels, 0);

  return {
    days: days.map((day) => ({ ...day, label: dayLabel(day.date) })),
    apps: toAppUsage(apps),
    total,
    range:
      days.length > 0 ? `${monthDay(days[0].date)} to ${monthDay(days[days.length - 1].date)}` : '',
  };
}

/**
 * The last seven days, from the device's own store. The server's copy is
 * folded into that store by the sync worker, never read straight onto a
 * screen, so Stats draws the same numbers with or without a connection.
 */
export function useUsageWeek(): UsageWeek {
  const [totals, setTotals] = useState<{ days: DayTotal[]; apps: AppTotal[] }>({ days: [], apps: [] });

  useEffect(() => {
    let live = true;

    const read = () => {
      const to = localDateKey();
      const from = shiftDateKey(to, -(HistoryDays - 1));
      Promise.all([readDays(from, to), readApps(from, to)]).then(([days, apps]) => {
        if (live) {
          setTotals({ days, apps });
        }
      }, () => {});
    };

    read();
    const unsubscribe = subscribe(read);
    /** Coming back is both when reels were counted and when the day may have turned. */
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        read();
      }
    });

    return () => {
      live = false;
      unsubscribe();
      appState.remove();
    };
  }, []);

  return useMemo(() => fold(totals.days, totals.apps), [totals]);
}
