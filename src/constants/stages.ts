import { t } from '@/i18n';

/**
 * The five drift stages. Every 100 reels the tether pays out and he sinks
 * one stage deeper, from a hillside on a clear day to no signal at all.
 */
export const StageOrder = ['fresh', 'buzzed', 'dizzy', 'fried', 'cooked'] as const;

export type Stage = (typeof StageOrder)[number];

/**
 * What he can look like. Gone comes after all five stages have been shown,
 * so it is not a rung on the ladder, it is what is left once you pass the
 * bottom of it.
 */
export type MascotState = Stage | 'gone';

export function stageLabel(stage: MascotState): string {
  return t(`stage.${stage}`);
}

export const MascotArt: Record<MascotState, number> = {
  fresh: require('@/assets/mascot/fresh.png'),
  buzzed: require('@/assets/mascot/buzzed.png'),
  dizzy: require('@/assets/mascot/dizzy.png'),
  fried: require('@/assets/mascot/fried.png'),
  cooked: require('@/assets/mascot/cooked.png'),
  gone: require('@/assets/mascot/gone.png'),
};

/** Cooked reuses the deep space plate, there is nothing further down. */
export const BackgroundArt = {
  fresh: require('@/assets/backgrounds/fresh.jpg'),
  buzzed: require('@/assets/backgrounds/buzzed.jpg'),
  dizzy: require('@/assets/backgrounds/dizzy.jpg'),
  fried: require('@/assets/backgrounds/fried.jpg'),
  cooked: require('@/assets/backgrounds/fried.jpg'),
} as const;

/** Mascot art is a 512 square, keep him in proportion at any width. */
export const MascotAspect = 1;
