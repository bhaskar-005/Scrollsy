# Scrollsy

Mobile app built with Expo / React Native. Screen-time and doomscroll app.

The point of this app is conversion. Everything below is a hard rule, not a suggestion.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
Do not write Expo or expo-router code from memory. Check the v57 docs first, every time.

## Setup

```bash
npm install
npx expo start        # then press a (android), i (ios), w (web)
```

Other scripts

```bash
npm run android
npm run ios
npm run web
npm run lint
```

Layout

- `src/app/` file based routes (expo-router). `_layout.tsx` is the root layout.
- `src/components/` shared components. `.web.tsx` suffix for web-only variants.
- `src/constants/theme.ts` colors, spacing, fonts. Never hardcode a color or a pixel gap in a screen, pull it from here.
- `src/hooks/`
- `assets/images/` icons, splash, mascot art.
- Path aliases `@/*` to `src/*`, and `@/assets/*` to `assets/*`. Always use them, no `../../`.
- App config lives in `app.json`. Name `Scrollsy`, slug `Scrollsy`, scheme `scrollsy`.
- TypeScript is strict. No `any`.

## Build stages

Work in order. Do not jump ahead. If a task needs a later stage, say so instead of quietly building it.

1. **UI layout first.** Every screen, navigation, tabs, components, theme, empty states, the paywall screen. Static and hardcoded placeholder data only. No backend, no real usage tracking, no payment SDK, no analytics.
2. Local state and persistence.
3. Real usage tracking and blocking.
4. Payments and paywall wiring.

Stage 1 is not "rough". It ships pixel-quality screens with real copy, because the copy is what converts.

## UI copy rules, STRICT

Applies to every string a human can see. Screens, buttons, labels, tooltips, empty states, errors, push notifications, onboarding, paywall, store listing.

1. **No em dashes.** The character `—` is banned. So is the en dash `–`. Do not substitute a spaced hyphen ` - ` either. Use a period, a comma, or a new line.
2. **No unnecessary colons.** Do not write `Reels today: 42`. Put the label under the value, or on its own line, or drop it. Colons are allowed only in a clock time like `4:10`.
3. No semicolons in UI copy.
4. No label prefixes like `Note:`, `Tip:`, `Warning:`, `Error:`.
5. Short lines. Say it the way a person would say it out loud.
6. Sentence case for body and buttons, unless the design calls for the caps wordmark style.

| Do not write | Write |
| --- | --- |
| `Reels scrolled today: 42` | `42` on one line, `Reels scrolled today` under it |
| `You are on the free plan — upgrade to lock reels` | `You are on the free plan. Upgrade to lock reels.` |
| `Warning: your streak ends in 2 hours` | `Your streak ends in 2 hours` |
| `Time saved: 1h 20m` | `1h 20m` with `Time saved` under it |

Before finishing any UI work, run these and expect zero hits.

```bash
grep -rn "[—–]" src/           # em and en dashes
grep -rn '[A-Za-z]: ' src/     # then check each hit is not visible copy
```

## Conversion is the goal

People must be pushed toward buying the plan. Judge every screen by whether it moves someone closer to paying.

- **Lead with the loss.** The number the user feels bad about is the hero of the screen. Big, centered, unavoidable.
- **The paywall is never more than one tap away.** Keep a persistent Pro row on the home screen with the price in it.
- **Anchor low.** Lead with the smallest entry price, then show the yearly plan as the better deal.
- **Onboarding ends at the paywall**, not at the home screen.
- **Free shows the problem, paid fixes it.** Free tier counts and shames. Paid tier blocks and rescues. Never let the free tier fully solve it.
- **Streaks, stats, and social or battle features exist to bring people back.** Every return is another paywall impression.
- **One primary CTA per screen.** It is the largest and brightest element. Everything else is quiet.
- **No dead ends.** Every empty state, every zero, every finished flow has a next action.
- **State price and renewal terms plainly on the paywall.** Fake countdowns, disguised close buttons, and hidden terms get the app rejected by the stores, so do not use them.

## Reference material

- `brainpal-ref/` screenshots of BrainPal, the closest competitor. Study the flow, the paywall placement, and the layout density. Note what it does. Dark theme, one mascot, one huge number, a persistent priced Pro row, a single fat primary button, two bottom tabs, a separate Stats screen. Do **not** copy its mascot, wordmark, colors, or copy word for word.
- `design-ref/` wireframes and mascot art for this app. This is the source of truth for look and feel.

## Before you say a task is done

- v57 docs were checked for any Expo API used.
- No `—`, no `–`, no stray colons in visible copy.
- Colors and spacing came from `src/constants/theme.ts`.
- The screen has exactly one primary CTA and a path to the paywall.
- It looks right in both light and dark mode.
