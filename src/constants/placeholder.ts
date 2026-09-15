/**
 * Stage 1 is UI only. Every number here is invented so the screens can be
 * built and judged. Delete this file when real tracking lands.
 */
import type { Stage } from '@/constants/stages';

export const Today = {
  date: 'Thu 4 Sep',
  streakDays: 6,
  stage: 'dizzy' as Stage,
  stageNumber: 3,
  reels: 338,
  limit: 400,
  toNextStage: 62,
  yesterday: 412,
  weekAverage: 356,
};

export type AppUsageEntry = {
  name: string;
  reels: number;
  icon: 'instagram' | 'tiktok' | 'youtube';
};

/** What made up today's count, most reels first. Adds up to `Today.reels`. */
export const AppUsage: AppUsageEntry[] = [
  { name: 'Instagram Reels', reels: 168, icon: 'instagram' },
  { name: 'TikTok', reels: 122, icon: 'tiktok' },
  { name: 'YouTube Shorts', reels: 48, icon: 'youtube' },
];

export type BoardEntry = {
  name: string;
  handle: string;
  stage: Stage;
  reels: number;
  /** Stands in for the Google photo. Swap the host out when auth is real. */
  photo?: string;
  /** Paid accounts wear a ring. Being seen with one is half the pitch. */
  premium?: boolean;
  you?: boolean;
};

/** Free placeholder portraits. Remote, so they need a connection to appear. */
const portrait = (path: string) => `https://randomuser.me/api/portraits/${path}.jpg`;

/**
 * Fewest reels wins, so this is sorted on read rather than written in order.
 * Photos come from Google once auth is real. Until then the avatar falls back
 * to initials, which is what Google itself shows for an account with no photo.
 */
export const Board: BoardEntry[] = [
  { name: 'Ravi Menon', handle: 'ravimenon', stage: 'fresh', reels: 48, premium: true, photo: portrait('men/32') },
  { name: 'Anya Kapoor', handle: 'anyakapoor', stage: 'buzzed', reels: 160, premium: true, photo: portrait('women/44') },
  { name: 'You', handle: 'you', stage: 'dizzy', reels: 338, you: true, photo: portrait('men/75') },
  { name: 'Dev Sharma', handle: 'devsharma', stage: 'fried', reels: 402, photo: portrait('men/54') },
];

/**
 * Five friends free, so the board always shows every place including the ones
 * nobody is standing in. The sixth is what the plan is for.
 */
export const Friends = {
  freeCap: 5,
};

/**
 * The head to head preview in onboarding. You are ahead, because the whole
 * point of the screen is daring someone to come at that number.
 */
export const InviteDuel = {
  you: 20,
  friend: 64,
};

export const Week = [
  { day: 'F', reels: 402 },
  { day: 'S', reels: 512 },
  { day: 'S', reels: 468 },
  { day: 'M', reels: 148 },
  { day: 'T', reels: 260 },
  { day: 'W', reels: 412 },
  { day: 'T', reels: 338 },
];

/** The span the Stats screen is showing. Free plan sees this week only. */
export const WeekRange = 'Aug 29 to Sep 4';

/** What made up the week, same shape as `AppUsage`. Adds up to the `Week` total. */
export const WeekAppUsage: AppUsageEntry[] = [
  { name: 'Instagram Reels', reels: 1260, icon: 'instagram' },
  { name: 'TikTok', reels: 920, icon: 'tiktok' },
  { name: 'YouTube Shorts', reels: 360, icon: 'youtube' },
];

export const Profile = {
  name: 'You',
  handle: 'you',
  stage: 'dizzy' as Stage,
  avgPerDay: 356,
  bestDay: 148,
  worstStage: 'cooked' as Stage,
  dailyLimit: 400,
  screenTimeConnected: true,
};

/**
 * Who is signed in. Google is the only way in, so the avatar and the email
 * both come from there once auth is real.
 */
export const Account = {
  name: 'Bhaskar Bhandari',
  email: 'bhandari222ji@gmail.com',
  /** Flip this to see the settings screen in its paid state. */
  premium: false,
};

/** The looks the floating counter can wear. */
export const CounterStyles = ['pill', 'outline', 'glass', 'plain', 'mascot'] as const;
export type CounterStyle = (typeof CounterStyles)[number];

/** Where it sits over the screen, as a fraction of width and height. Drop it anywhere. */
export type CounterPosition = { x: number; y: number };

/** The nine named zones a dropped point can fall into, for a plain-language summary. */
export type CounterZone =
  | 'topLeft'
  | 'top'
  | 'topRight'
  | 'left'
  | 'center'
  | 'right'
  | 'bottomLeft'
  | 'bottom'
  | 'bottomRight';

const ZoneGrid: CounterZone[][] = [
  ['topLeft', 'top', 'topRight'],
  ['left', 'center', 'right'],
  ['bottomLeft', 'bottom', 'bottomRight'],
];

/** Buckets a free position into the nearest named zone, thirds on each axis. */
export function counterZone(position: CounterPosition): CounterZone {
  const row = position.y < 0.33 ? 0 : position.y > 0.66 ? 2 : 1;
  const col = position.x < 0.33 ? 0 : position.x > 0.66 ? 2 : 1;
  return ZoneGrid[row][col];
}

export const CounterPrefs = {
  style: 'pill' as CounterStyle,
  position: { x: 0.86, y: 0.08 } as CounterPosition,
};

/** One for now. The picker is built so the rest just drop in. */
export const Languages = [{ id: 'en', label: 'English' }] as const;

export const FeedbackTopics = ['bug', 'idea', 'billing', 'other'] as const;
export type FeedbackTopic = (typeof FeedbackTopics)[number];

export const Pricing = {
  /** What we lead with everywhere. Anchor low, then let the paywall upsell. */
  entry: '₹1',
  entryDays: 7,
  monthly: '₹199',
  yearly: '₹999',
  trialDays: 7,
};
