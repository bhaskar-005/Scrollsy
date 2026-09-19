import * as SQLite from 'expo-sqlite';

/**
 * The device's own record of what it has counted. Every screen reads its own
 * numbers from here, never from the network, so they show instantly and work
 * with no connection. See docs/tracking-and-sync.md.
 *
 * One row per day per app, holding a running total rather than a row per reel.
 * `synced_reels` is how much of that total the server has confirmed, so what
 * is still waiting to upload is a subtraction, not a queue.
 *
 * The Android counting service does not write here. It keeps counting while
 * this JavaScript is not running, so it tallies on its own side and the app
 * collects that into this table on the way back in, through `addCounted`.
 * That keeps one writer for this file and no locking between two processes.
 */

export type AppKey = 'instagram' | 'tiktok' | 'youtube' | 'snapchat';

export type DayTotal = { date: string; reels: number };

export type AppTotal = { app: AppKey; reels: number };

/** What one sync pass sends, captured at the moment it read the row. */
export type PendingRow = { date: string; app: AppKey; pending: number };

/** Days of history kept on the device. Older rows are pruned, the server keeps the rest. */
export const KeepDays = 30;

const SchemaVersion = 1;

const db = SQLite.openDatabaseSync('usage.db');

/** Synchronous on purpose, so the first render already has real numbers in it. */
function migrate() {
  const current = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;

  if (current < 1) {
    db.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS usage (
        usage_date TEXT NOT NULL,
        app_key TEXT NOT NULL,
        total_reels INTEGER NOT NULL DEFAULT 0,
        synced_reels INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (usage_date, app_key)
      );
    `);
  }

  db.execSync(`PRAGMA user_version = ${SchemaVersion}`);
}

migrate();

/** `YYYY-MM-DD` for the device's own calendar day. Local time, never UTC. */
export function localDateKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The date key a number of days before or after another one. */
export function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

const listeners = new Set<() => void>();

/** Called after anything this module writes. Returns the unsubscribe. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Today's total, read synchronously, for a first render that is already right. */
export function readDaySync(date: string): number {
  return (
    db.getFirstSync<{ reels: number | null }>(
      'SELECT SUM(total_reels) AS reels FROM usage WHERE usage_date = ?',
      date,
    )?.reels ?? 0
  );
}

export async function readDay(date: string): Promise<number> {
  const row = await db.getFirstAsync<{ reels: number | null }>(
    'SELECT SUM(total_reels) AS reels FROM usage WHERE usage_date = ?',
    date,
  );
  return row?.reels ?? 0;
}

/** Every day from `from` to `to` inclusive, oldest first, with empty days as zero. */
export async function readDays(from: string, to: string): Promise<DayTotal[]> {
  const rows = await db.getAllAsync<DayTotal>(
    `SELECT usage_date AS date, SUM(total_reels) AS reels
     FROM usage WHERE usage_date BETWEEN ? AND ?
     GROUP BY usage_date`,
    from,
    to,
  );
  const byDate = new Map(rows.map((row) => [row.date, row.reels]));

  const days: DayTotal[] = [];
  for (let date = from; date <= to; date = shiftDateKey(date, 1)) {
    days.push({ date, reels: byDate.get(date) ?? 0 });
  }
  return days;
}

/** Totals per app across a range, biggest first. Apps with nothing are left out. */
export async function readApps(from: string, to: string): Promise<AppTotal[]> {
  return db.getAllAsync<AppTotal>(
    `SELECT app_key AS app, SUM(total_reels) AS reels
     FROM usage WHERE usage_date BETWEEN ? AND ?
     GROUP BY app_key HAVING reels > 0
     ORDER BY reels DESC`,
    from,
    to,
  );
}

/** One day's worth of one app, as the counting service hands it over. */
export type CountedRow = { date: string; app: AppKey; reels: number };

/**
 * Adds many days at once, in one transaction.
 *
 * A phone that counted all week without the app being opened hands back every
 * day it slept through, and each one has to land on its own date rather than
 * piling onto the day it was collected. Writing them together means one
 * transaction and one redraw, however many days were missed.
 */
export async function addCounted(rows: CountedRow[]): Promise<void> {
  const real = rows.filter((row) => row.reels > 0);
  if (real.length === 0) {
    return;
  }

  await db.withTransactionAsync(async () => {
    for (const row of real) {
      await db.runAsync(
        `INSERT INTO usage (usage_date, app_key, total_reels) VALUES (?, ?, ?)
         ON CONFLICT (usage_date, app_key) DO UPDATE SET total_reels = total_reels + excluded.total_reels`,
        row.date,
        row.app,
        row.reels,
      );
    }
  });
  notify();
}

/**
 * Folds the server's own totals in, for a phone that has no record of them: a
 * new install, a reinstall, a second device. Takes the larger of the two on
 * both columns, so nothing the device counted is lost, and anything the server
 * already holds is marked as sent rather than uploaded a second time.
 */
export async function mergeServerTotals(
  rows: { date: string; app: AppKey; reels: number }[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        `INSERT INTO usage (usage_date, app_key, total_reels, synced_reels) VALUES (?, ?, ?, ?)
         ON CONFLICT (usage_date, app_key) DO UPDATE SET
           total_reels = MAX(total_reels, excluded.total_reels),
           synced_reels = MIN(
             MAX(total_reels, excluded.total_reels),
             MAX(synced_reels, excluded.synced_reels)
           )`,
        row.date,
        row.app,
        row.reels,
        row.reels,
      );
    }
  });
  notify();
}

/** Rows holding reels the server has not confirmed yet, inside the kept window. */
export async function readPending(): Promise<PendingRow[]> {
  return db.getAllAsync<PendingRow>(
    `SELECT usage_date AS date, app_key AS app, total_reels - synced_reels AS pending
     FROM usage
     WHERE total_reels > synced_reels AND usage_date >= ?
     ORDER BY usage_date`,
    shiftDateKey(localDateKey(), -KeepDays),
  );
}

/**
 * Marks exactly what a sync pass sent as confirmed. Adds the captured amount
 * rather than copying `total_reels`, so a reel counted while the request was
 * in flight stays pending for the next pass instead of being marked sent.
 *
 * Capped at the total. Past it, pending would read as zero while new reels
 * piled up underneath, and those reels would never upload. The sync worker
 * only marks once per send, but the native counter writes this table too, so
 * the rule lives in the statement rather than in every caller.
 */
export async function markSynced(rows: PendingRow[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        'UPDATE usage SET synced_reels = MIN(total_reels, synced_reels + ?) WHERE usage_date = ? AND app_key = ?',
        row.pending,
        row.date,
        row.app,
      );
    }
  });
}

/**
 * Empties the table, for signing out or deleting the account. Anything still
 * pending is pushed before this is called, so what goes is only a copy.
 */
export async function clearUsage(): Promise<void> {
  await db.runAsync('DELETE FROM usage');
  notify();
}

/** Drops days past the kept window. The server still has them. */
export async function prune(): Promise<void> {
  await db.runAsync('DELETE FROM usage WHERE usage_date < ?', shiftDateKey(localDateKey(), -KeepDays));
}

