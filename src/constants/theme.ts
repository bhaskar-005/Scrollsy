/**
 * Every colour in the app lives here and nowhere else. Two palettes with the
 * same keys, so any screen can read a token and get the right value for the
 * scheme it is being viewed in.
 *
 * Read them through `useTheme()` rather than importing `Colors` directly.
 */

import { Platform } from 'react-native';

import '@/global.css';

export const Colors = {
  light: {
    /** Primary copy. */
    text: '#12101A',
    /** Supporting copy, labels under a number. */
    textSecondary: 'rgba(18, 16, 26, 0.62)',
    /** Timestamps, ranks, the quietest thing on screen. */
    textFaint: 'rgba(18, 16, 26, 0.38)',

    /** The ground a screen sits on. */
    background: '#FBFAFD',
    /** The same ground with the colour pulled out, so art can fade into it. */
    backgroundFade: 'rgba(251, 250, 253, 0)',
    /** A raised block on that ground. */
    backgroundElement: '#F0EEF5',
    backgroundSelected: '#E4E0EE',

    /** Card fill. */
    surface: 'rgba(255, 255, 255, 0.82)',
    /** Card fill when it needs to hold its own against a busy backdrop. */
    surfaceStrong: '#FFFFFF',
    /** Frosted face of a floating card, lit from the top. */
    glassTop: 'rgba(255, 255, 255, 0.94)',
    glassBottom: 'rgba(240, 238, 245, 0.72)',
    /**
     * Rim around that face. A dark hairline here, because a lit top edge is
     * white on white and the card loses its shape against the page.
     */
    glassRimTop: 'rgba(18, 16, 26, 0.17)',
    glassRimBottom: 'rgba(18, 16, 26, 0.07)',

    border: 'rgba(18, 16, 26, 0.12)',
    borderActive: 'rgba(109, 40, 217, 0.75)',
    /** Between rows of a list. Lighter than a border, which outlines an object. */
    divider: 'rgba(18, 16, 26, 0.07)',

    /** Violet is the only accent. Dark enough here to carry white text. */
    accent: '#6D28D9',
    /** Accent as a wash behind a row. */
    accentSoft: 'rgba(109, 40, 217, 0.12)',
    /** What reads on top of `accent`. */
    onAccent: '#FFFFFF',

    /** Unfilled part of a progress bar or a chart column. */
    track: 'rgba(18, 16, 26, 0.10)',
    tabBar: '#FFFFFF',

    /** Violet haze spilling down from the top of a screen, and where it dies. */
    glow: 'rgba(124, 58, 237, 0.16)',
    glowFade: 'rgba(124, 58, 237, 0)',

    /**
     * The space he floats in across the top of Home. Deepest at the very top,
     * easing down to where the page curves up into it. It stops a clear step
     * short of the page itself, so that curve still reads as an edge.
     */
    skyTop: '#BCA7F2',
    skyMid: '#D6CAF9',
    skyBottom: '#E9E1FC',
    /**
     * What separates the page's curve from the sky it rises into.
     *
     * Darker than the sky here, because the page is the pale thing and the
     * shade of the sky's own violet is what gives it depth. Never black: a
     * black smudge on a coloured ground reads as dirt on the glass.
     */
    skyLiftNear: 'rgba(76, 29, 149, 0.26)',
    skyLiftFar: 'rgba(76, 29, 149, 0.18)',
    /** Specks drifting up through it. */
    star: 'rgba(255, 255, 255, 0.92)',

    /** Contact shadow, right under a raised element. */
    shadowNear: 'rgba(24, 16, 48, 0.16)',
    /** The wide soft one that gives it height off the page. */
    shadowFar: 'rgba(24, 16, 48, 0.20)',

    /** Darkens the whole screen behind a sheet. Heavier than a shadow. */
    scrim: 'rgba(24, 16, 48, 0.42)',

    link: '#1B5FD0',
  },
  dark: {
    text: '#F4F3F7',
    textSecondary: 'rgba(244, 243, 247, 0.66)',
    textFaint: 'rgba(244, 243, 247, 0.38)',

    background: '#06050E',
    /** The same ground with the colour pulled out, so art can fade into it. */
    backgroundFade: 'rgba(6, 5, 14, 0)',
    backgroundElement: '#17151F',
    backgroundSelected: '#221F2E',

    surface: 'rgba(12, 10, 22, 0.58)',
    surfaceStrong: 'rgba(12, 10, 22, 0.86)',
    /** Frosted face of a floating card, lit from the top. */
    glassTop: 'rgba(52, 47, 74, 0.92)',
    glassBottom: 'rgba(21, 18, 34, 0.78)',
    /** Rim around that face. A real bevel, because there is room to light it. */
    glassRimTop: 'rgba(255, 255, 255, 0.22)',
    glassRimBottom: 'rgba(0, 0, 0, 0.40)',

    border: 'rgba(255, 255, 255, 0.13)',
    borderActive: 'rgba(167, 139, 250, 0.85)',
    /** Between rows of a list. Lighter than a border, which outlines an object. */
    divider: 'rgba(255, 255, 255, 0.07)',

    /** Bright on a night sky, so it takes dark text rather than white. */
    accent: '#A78BFA',
    accentSoft: 'rgba(167, 139, 250, 0.18)',
    onAccent: '#1E1233',

    track: 'rgba(255, 255, 255, 0.16)',
    tabBar: '#0B0A14',

    /** Violet haze spilling down from the top of a screen, and where it dies. */
    glow: 'rgba(139, 92, 246, 0.34)',
    glowFade: 'rgba(139, 92, 246, 0)',

    /** Deep space at the top edge, warming to violet where the page curves into it. */
    skyTop: '#0B0715',
    skyMid: '#1B0F35',
    skyBottom: '#4C1D95',
    /**
     * Lighter than the sky here, which is the opposite of the light scheme and
     * the whole point. The page is nearly black in the dark, so darkening the
     * sky around it only buries the curve in what is already dark. Light
     * gathering along the edge is what makes it stand out instead.
     */
    skyLiftNear: 'rgba(196, 174, 255, 0.50)',
    skyLiftFar: 'rgba(139, 92, 246, 0.28)',
    /** Specks drifting up through it. */
    star: 'rgba(255, 255, 255, 0.85)',

    shadowNear: 'rgba(6, 4, 16, 0.34)',
    shadowFar: 'rgba(6, 4, 16, 0.40)',

    /** Darkens the whole screen behind a sheet. Heavier than a shadow. */
    scrim: 'rgba(2, 1, 8, 0.66)',

    link: '#3C87F7',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** One scheme's worth of colour. What `useTheme()` hands back. */
export type Palette = (typeof Colors)[keyof typeof Colors];

/**
 * Brand gradients do not flip with the scheme. The button is the same purple
 * in both, and the scrim always darkens the photo behind Home so white copy
 * stays readable on it. All run bottom to top.
 */
export const Gradients = {
  /** 2px shell around a primary button. */
  accentShell: ['#5B21B6', '#A78BFA'] as const,
  /** Inner face of a primary button. */
  accentFace: ['#5B21B6', '#7C3AED'] as const,
  /** Label on that face. Fixed, because the face itself does not flip. */
  onGradient: '#FFFFFF',
  /** A highlight swept across a gradient face, left to right. */
  shine: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.32)', 'rgba(255, 255, 255, 0)'] as const,
} as const;

/**
 * A primary button is built like a sticker. A light bevel along the top inside
 * edge, a dark one along the bottom, and the label carries its own shadow so
 * the type sits in the fill rather than on it. Pressing it sinks the whole
 * thing into the page, so these do not flip with the scheme either.
 */
/**
 * The podium blocks. Fixed like the other brand gradients, so first, second
 * and third read the same in either scheme. The top faces are a clear step
 * lighter than the fronts, which is what makes the blocks read as solid.
 */
export const Podium = {
  /**
   * Bottom to top, and the first stop is the same colour at zero alpha so the
   * block melts into the page instead of ending on a cut line.
   */
  wonFront: ['rgba(76, 29, 149, 0)', '#4C1D95', '#7C3AED'] as const,
  wonTop: '#A78BFA',
  restFront: ['rgba(36, 28, 61, 0)', '#241C3D', '#372C58'] as const,
  restTop: '#544777',
  /** Hairline where the top meets the front. */
  seam: 'rgba(0, 0, 0, 0.28)',
  numeral: '#FFFFFF',
  numeralRest: 'rgba(255, 255, 255, 0.62)',
} as const;

/**
 * The paid mark. Gold does not flip with the scheme, the same way the brand
 * gradients do not, so a member looks the same to everyone who sees them.
 */
export const Member = {
  /** Metallic sweep for the ring. Dark, bright, highlight, dark again. */
  ring: ['#8C6B1E', '#F2D479', '#FFF7D6', '#D9AE3A'] as const,
  /** The tick badge sitting on the ring. */
  tick: ['#F7E08F', '#C9992B'] as const,
  /** The check inside it. Dark, because a white one washes out on gold. */
  onTick: '#3D2C06',
} as const;

/**
 * Real app colours for the breakdown rows. Fixed like the other brand
 * gradients, an app's icon does not go grey because the phone is in dark
 * mode.
 */
export const AppBrand = {
  instagram: ['#4F5BD5', '#962FBF', '#D62976', '#FA7E1E'] as const,
  tiktok: ['#101010', '#101010'] as const,
  youtube: ['#FF0000', '#FF0000'] as const,
  snapchat: ['#FFFC00', '#FFFC00'] as const,
} as const;

export const Bevel = {
  top: 'rgba(255, 255, 255, 0.22)',
  bottom: 'rgba(0, 0, 0, 0.40)',
  /** Replaces the top highlight while held, so the face reads as pushed in. */
  pressedTop: 'rgba(0, 0, 0, 0.26)',
  label: 'rgba(0, 0, 0, 0.45)',
} as const;

/** Whatever the platform already ships. Nothing here is Plus Jakarta Sans. */
const System = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Plus Jakarta Sans, the whole app. React Native cannot pick a weight out of a
 * family at runtime, so every weight is loaded as its own family and the weight
 * is baked into the name.
 *
 * Set `fontFamily` on every piece of text you write. A bare `fontWeight` will
 * quietly leave you on the system font. Keep the `fontWeight` line next to it
 * so the weight still reads at a glance and the web build has it too.
 *
 * These names are the keys the root layout loads the files under. Change one
 * and change the other.
 */
/**
 * The art panel at the top of a sheet is a pale plate in both schemes, the way
 * a photo print is, so nothing sitting on it flips either.
 */
export const Overlay = {
  /** The plate itself. */
  hero: '#EFEAFB',
  /** On the dark blurred disc that floats over it. */
  glyph: '#FFFFFF',
  /** The grab pill where it lands on the plate rather than on the sheet. */
  grabber: 'rgba(24, 16, 48, 0.26)',
  /**
   * The mascot's speech bubble on Home, for the same reason as the plate
   * above. It sits on the sky, and the sky is pale in the light scheme and
   * nearly black in the dark one. A bubble that followed the scheme would be
   * white on lavender one way and black on black the other, so it does not.
   */
  bubble: '#FFFFFF',
  bubbleText: '#181030',
  bubbleEdge: 'rgba(24, 16, 48, 0.12)',
} as const;

export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',

  serif: System.serif,
  rounded: System.rounded,
  mono: System.mono,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  button: 16,
  buttonFace: 14,
  card: 20,
  /** Rounder than a card, so a sheet reads as a sheet of paper coming up. */
  sheet: 28,
  pill: 999,
} as const;

/** Minimum touch target, Android guidance. */
export const MinTouch = 48;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
