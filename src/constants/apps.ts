import type { AppKey } from '@/lib/usage-store';

/**
 * The apps we count, and what they are called on screen. The keys match
 * `app_key` in the database and the counting service's own list, so a new app
 * is added here, in the migration, and in the service, together.
 */
export const AppNames: Record<AppKey, string> = {
  instagram: 'Instagram Reels',
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  snapchat: 'Snapchat Spotlight',
};

export type AppUsage = { name: string; reels: number; icon: AppKey };

/** Counts from the local store, in the shape the breakdown card draws. */
export function toAppUsage(totals: { app: AppKey; reels: number }[]): AppUsage[] {
  return totals.map((total) => ({ name: AppNames[total.app], reels: total.reels, icon: total.app }));
}
