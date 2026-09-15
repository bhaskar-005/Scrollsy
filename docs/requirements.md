# Doomless requirements

Source of truth: `design-ref/Doomless app wireframes/Doomless Wireframes.dc.html`, option `2b` (written scope) plus the wireframe screens in `2a` and `1a`. Everything below is transcribed from those frames. Where the current codebase differs, it is called out in [Open questions](#open-questions).

Platform: Android, portrait only. Dark UI. Deadpan copy. One number, one line, one action per screen.

---

## Core concept

The app reads screen time and counts short form reels seen today. A space suited mascot is your brain. Every 100 reels his tether pays out and he drifts further into deep space. At the daily limit he is cooked and the app shows a recovery countdown to midnight.

### Drift stages

| # | Stage | Reels | Depth |
| --- | --- | --- | --- |
| 1 | Fresh | 0 to 99 | Surface |
| 2 | Buzzed | 100 to 199 | |
| 3 | Dizzy | 200 to 299 | |
| 4 | Fried | 300 to 399 | |
| 5 | Cooked | 400+ | Deep space, no signal |

Stage boundaries are fixed at every 100 reels. The daily limit (120 / 240 / 400) is a separate line that triggers the cooked screen, so a low limit can cook you before stage 5.

### Gone, past the ladder

Not in the original wireframes, added later. A sixth mascot state, a skeleton inside a cracked helmet. It comes after all five stages have been shown, so it is the end of the road rather than a rung.

- [x] Art at `assets/mascot/gone.png`, exported as the `gone` key of `MascotArt`
- [x] Kept out of `StageOrder`, so the onboarding ladder still teaches five
- [ ] Trigger threshold agreed and written down
- [ ] Rendered on screen 09, which does not exist yet

- [x] Five stages defined in `src/constants/stages.ts`
- [x] Mascot art per stage
- [x] Background plate per stage (cooked reuses the fried plate)
- [ ] Stage boundary math against a user chosen limit is written down and agreed

---

## Screen inventory

15 screens. Status reflects what exists in `src/` today, not what is wired to real data.

### Onboarding, 7 steps

Progress bar and Skip appear on steps 2 to 7.

| # | Screen | Route | Built |
| --- | --- | --- | --- |
| 01 | Splash | `src/app/onboarding/welcome.tsx` | [x] |
| 02 | Concept, depth strip | `src/app/onboarding/concept.tsx` | [x] |
| 03 | Screen time permission | `src/app/onboarding/permission.tsx` | [x] |
| 04 | Pick daily limit | `src/app/onboarding/limit.tsx` | [x] |
| 05 | Add friends | `src/app/onboarding/friends.tsx` | [x] |
| 06 | Notifications | `src/app/onboarding/notifications.tsx` | [x] |
| 07 | Paywall | `src/app/onboarding/paywall.tsx` | [x] |

- [x] Onboarding ends at the paywall, not at Home
- [x] Progress plus Skip on steps 2 to 7
- [ ] Skip on every step routes forward correctly and never dead ends

Copy from the wireframes, keep it exact:

- 01 `See how many reels you actually watch.` / `Log in with Google` / `By continuing you agree to our Terms and Privacy Policy`. Revised away from the wireframe, which had `Your brain, but you can see it.` with `Start` and `I already have an account`. One headline, no supporting line. The art carries the explanation instead of copy, and it flexes to fill whatever height is left so the page never opens on a void. One action, a top glow, no wordmark. Terms and Privacy are tappable and open in an in app browser. Never say the app runs in the background, it makes people suspicious of it before they have used it
- 02 `Every 100 reels he drifts further out.` / `Got it`. The five stages run down the screen as a depth strip, each rung showing its reel count, so the hundred reel rule is visible rather than stated
- 03 `Turn these on and we start counting.` Revised from the wireframe, which asked for screen time alone. Now a gated checklist, one row per permission, each with its own `Allow`. `Screen time` reads your time in reels apps, `Display over other apps` floats the counter. Only the next unfinished row is live, finished rows carry a check, later rows sit dimmed until their turn. A `Why do you need these?` pill opens a sheet holding the wireframe's `What we don't` promise, `We never read what you actually watched.`, plus `You can turn either one off later in settings.` Footer is one `Continue`, and Skip still sits in the header
- 04 `How many reels is too many?` with `120 Optimistic`, `240 Realistic`, `400 Be honest`. Button `Set limit`
- 05 `Losing alone is worse.` / `Add 2 friends` / `Scroll alone`
- 06 `He'll tell you when it's bad.` with a sample push `Stage 3. That's 200 reels.` Buttons `Turn on` / `Not now`
- 07 `Bring him home.` with the Pro list, plans, `Start 7 days free` / `Continue free`

### App screens

| # | Screen | Route | Built |
| --- | --- | --- | --- |
| 08 | Home, depth well | `src/app/(tabs)/home.tsx` | [x] |
| 09 | Cooked / lockout | none | [ ] |
| 10 | Friends | `src/app/(tabs)/battle.tsx` | [~] |
| 11 | History | folded into `profile.tsx` | [~] |
| 12 | Settings | folded into `profile.tsx` | [~] |
| 13 | Paywall modal | `src/app/paywall.tsx` | [x] |
| 14 | Overlay counter | none | [ ] |
| 15 | Counter style picker | none | [ ] |

`[~]` means something exists but the structure differs from the wireframe. See [Open questions](#open-questions).

---

## Screen requirements

### 08 Home

The hero is the count. He sinks visually as the number grows.

- [x] Date and streak in the header, `Thu 4 Sep` and `6 day streak`
- [x] Big reel count for today
- [x] Label under the number, `reels seen today`
- [x] Stage name and number, `Stage 3 · Dizzy`
- [x] Depth well showing 0 to limit with the mascot positioned by depth
- [x] Distance to the next stage, `62 to Fried`
- [x] Limit shown, `limit 400`
- [x] Yesterday tile and 7 day average tile
- [x] Persistent Pro row with the price in it
- [ ] Home switches to the cooked screen once the limit is hit

### 09 Cooked / lockout

Replaces Home when the count reaches the daily limit.

- [ ] No signal band at the top
- [ ] Cooked mascot, tether cut, swapping to the gone skeleton past the last stage
- [ ] `That's 400.` and `He's cooked.`
- [ ] Countdown to midnight in `4:12:08` form, label `until he floats back in` under it
- [ ] Primary CTA `Buy 50 more reels` marked Pro
- [ ] `App lock is on` row marked Pro
- [ ] Free tier warns only. The actual app lock is Pro
- [ ] No disguised close, no fake countdown. The timer is the real time to midnight

### 10 Friends

- [x] Title `Scroll battle`, no subtitle. Fewest reels wins, which the ordering shows without being told.
- [x] Podium for the top three, winner raised in the middle, blocks drawn as boxes with a lit top face
- [x] Ranked list from fourth down as one table with shared edges, showing rank, avatar, name and reel count
- [x] Your own row is highlighted
- [x] Every free place is drawn even when empty, so the five friend ceiling is visible from day one
- [x] The place past the free five is drawn locked and priced, and goes to the paywall
- [x] Tapping anyone opens their card, which sells membership to a free viewer
- [ ] Hide the podium when nobody has scrolled anything. A 1-2-3 with three zeroes on it crowns a winner who has not done anything, and it is the first thing a new group sees. Fall back to the plain list until at least one person is above zero.
- [ ] Empty state with a next action when you have no friends yet

#### What the backend owes this screen

Written down because the UI already assumes all of it.

- [ ] Google profile photos on each account. `BoardEntry.photo` exists and is wired through, but every URL in `placeholder.ts` currently points at `randomuser.me`. They are remote, so the initials fallback is what shows with no connection.
- [ ] A membership flag per account. `BoardEntry.premium` drives the gold ring and the seal, and those are visible to *other* people, so it has to come off the server rather than off local state.
- [ ] Ranking is done client side today, on reels ascending. Decide whether the server ranks instead once the board is shared.
- [ ] Invite flow behind the empty places. Tapping one is a no-op right now.
- [ ] Enforce the five friend cap server side. The client only draws the ceiling, it cannot hold it.

#### Decisions worth not relitigating

- Handles and emails are never rendered for other people. They are identifying, and a board is a shared surface. `handle` is a React key only. Your own email stays on Settings, which is your own screen.
- The paid mark is a gold ring plus one seal, named `Scrollsy member` in copy. It is deliberately the only gold in the app.
- Podium block colours are fixed rather than themed, the same way the brand gradients are, so first, second and third read the same to everyone.

### 11 History

- [~] Last 7 days bar chart with the limit drawn across it
- [~] Day initials under the bars
- [x] Average a day, best day, worst stage tiles
- [x] `All 90 days is Pro` gate
- [ ] Lives on its own tab rather than inside Profile

### 12 Settings

- [x] `Get Pro` row at the top with the Pro pitch
- [ ] Counter group. `Show while scrolling` toggle, `Style` row, `Position` row
- [x] Limits group. `Daily limit`, `Lock apps at limit` (Pro), `Notifications`
- [x] Mascot and access group. Suit colour, screen time connection state, replay onboarding
- [ ] Lives on its own tab rather than inside Profile

### 13 Paywall

Both the onboarding step and the modal. The modal opens from every locked row.

- [x] Mascot, headline `Buy back your brain.` (modal) or `Bring him home.` (onboarding)
- [x] Benefit list. Lock apps at your limit, 6 counter styles, full history and unlimited friends, buy back reels after lockout
- [x] Monthly `$4` shown first, yearly `$19` with `save 60%`
- [x] Primary CTA `Start 7 days free`
- [x] Secondary `Continue free`
- [ ] Price and renewal terms stated plainly on the screen
- [ ] Every Pro gated row in the app opens this modal

### 14 Overlay counter

Draws over other apps while you scroll.

- [ ] Floating count over a third party feed
- [ ] Draggable, position remembered
- [ ] On and off toggle
- [ ] Free tier gets exactly one style, the basic pill
- [ ] Explainer card, `Shows the count while you scroll anywhere.` with `Show overlay` and `Change style`
- [x] Android overlay permission is asked for on screen 03, alongside screen time
- [ ] The denied state, and the way back from it, still needs designing

### 15 Counter style picker

1 free style plus 6 Pro styles.

| Style | Tier | Note |
| --- | --- | --- |
| Basic pill | Free | in use by default |
| Mascot bubble | Pro | he sinks inside the bubble |
| Depth gauge | Pro | how far out he has drifted |
| Oxygen bar | Pro | reels left, as air |
| Minimal dot | Pro | colour only, no number |
| Retro LCD | Pro | mission clock look |
| Boss health bar | Pro | your brain's HP |

- [ ] All 7 rendered at real size in the picker
- [ ] Pro styles visibly locked
- [ ] `Unlock 6 styles` CTA opens the paywall modal

---

## Free and Pro

### Free

- [ ] Onboarding, 7 steps
- [ ] Screen time permission, daily limit 120 / 240 / 400
- [ ] Home with today's count, drift depth, stage, progress to next stage, yesterday and 7 day average
- [ ] Cooked screen at the limit with a countdown, no app locking
- [ ] Overlay counter, 1 basic style, draggable, on and off
- [ ] Friends leaderboard, up to 5
- [ ] History, last 7 days
- [ ] Settings. Limit, notifications, suit colour, replay onboarding

### Pro

- [ ] Lock apps at the limit. Free only warns
- [ ] 6 extra counter styles
- [ ] Buy 50 more reels after lockout
- [ ] Full history beyond 7 days
- [ ] More than 5 friends
- [ ] Plans, monthly $4 and yearly $19 (save 60%), 7 day trial
- [ ] Paywall modal reachable from every locked row

Free shows the problem, paid fixes it. The free tier never fully solves the problem.

---

## Rules

- [ ] 4 tabs maximum. Home, Friends, History, Settings
- [ ] No nested navigation
- [ ] Hit targets at least 44px
- [ ] One primary action per screen
- [ ] No explanatory paragraphs
- [ ] 1 to 2 background colours, purple is the only accent
- [ ] Colours and spacing come from `src/constants/theme.ts`, never hardcoded in a screen
- [ ] No em dash, no en dash, no spaced hyphen, no stray colons in visible copy
- [ ] Every screen has a path to the paywall
- [ ] No dead ends. Every empty state and every zero has a next action

Copy checks, expect zero hits.

```bash
grep -rn "[—–]" src/
grep -rn '[A-Za-z]: ' src/
```

---

## Out of scope

- iOS, tablet, web
- Blocking individual apps one by one
- Social feed, comments, sharing
- Rewards, coins, streak shop
- Mascot animation states beyond the 5 stages

---

## Build stages

Work in order, per `AGENTS.md`.

### Stage 1, UI layout

- [ ] All 15 screens exist with real copy and placeholder data
- [ ] Navigation and tabs match the rules above
- [ ] Theme tokens used everywhere
- [ ] Light and dark both look right
- [ ] Copy grep is clean

### Stage 2, local state and persistence

- [ ] Chosen daily limit persists
- [ ] Onboarding completion persists, index stops redirecting to onboarding
- [ ] Counter style, position and on or off persist
- [ ] Suit colour and notification preference persist
- [ ] `src/constants/placeholder.ts` deleted

### Stage 3, real tracking and blocking

- [ ] Screen time permission requested and handled, including denial
- [ ] Reel counting from usage data
- [ ] Overlay permission and the live overlay counter
- [ ] App lock at the limit, Pro only
- [ ] Midnight reset and the recovery countdown
- [ ] Streak calculation

### Stage 4, payments

- [ ] Store products for monthly and yearly
- [ ] 7 day trial
- [ ] Purchase, restore and entitlement checks
- [ ] Buy 50 more reels
- [ ] Every Pro gate reads the real entitlement

---

## Open questions

Decisions needed before the checklist above can be finished. Each one is a real difference between the wireframes and the code as it stands.

1. **App name.** The wireframes say Doomless. `app.json` says name `Scrollsy`, slug `Scrollsy`, scheme `scrollsy`, and `AGENTS.md` calls the project Scrollsy. Which one ships?
2. **Tabs.** The spec calls for 4 tabs, Home, Friends, History, Settings. The code has 3, Home, Battle, Profile, with History and Settings folded into Profile. Keep the 3 tab shape or move to the 4 tab spec?
3. **Battle.** `src/app/(tabs)/battle.tsx` has a head to head duel card and a `Challenge a friend` action. Nothing in the wireframes describes a duel. Is Battle an approved addition to the scope, or does it collapse back into the Friends leaderboard?
4. **Home variants.** The wireframes offer three Home layouts. `1a` mascot led, `1b` number first with a small mascot, `1c` full bleed mascot with a peek sheet. `2a` is the depth well revision. Which one is final?
5. **Lockout variant.** `1d` is a full takeover where the countdown is the hero, with `Fine, I'll wait` as the secondary. `09` in `2a` keeps the tab bar. Which one?
6. **Limit versus stage.** At limit 120 or 240 the cooked screen fires before stage 5. Confirm the cooked screen is driven by the limit, and say what the mascot shows when the limit is hit at stage 2.
7. **Accounts.** Settled in part. Screen 01 is now a Google login and the separate sign in link is gone. Still open, whether there is any way in without a Google account, and what happens to a user who declines. Real auth is Stage 4 work, the button only advances the flow today.
8. **Suit colour.** `1a` settings lists Purple and Green. `2a` shows a colour row with no values. What is the full set, and does it sit alongside the purple only accent rule?
9. **Legal pages.** `src/constants/legal.ts` points Terms and Privacy at `example.com`. Both need real published pages before the first store submission, because a login screen with dead legal links gets rejected.
10. **Accessibility permission.** Screen 03 asks for screen time and overlay. Android usage stats give time in an app, not a count of individual reels, so counting reels the way the app promises probably needs an accessibility service as a third row. Accessibility declarations draw extra Play Store scrutiny and need a written justification, so this wants deciding before Stage 3.
