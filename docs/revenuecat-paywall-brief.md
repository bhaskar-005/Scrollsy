# Brief for a browser agent: Scrollsy prices and paywall

You are working in the user's own browser, already signed in as them. You have
two jobs, in this order:

1. **Set the prices** in RevenueCat and Google Play Console (steps 1 to 3).
2. **Build the paywall** the app shows at the end of onboarding, in
   RevenueCat's paywall editor, Paywalls v2 (step 4).

Everything you need to type is written out below.

The app is already wired to the paywall. It shows whatever paywall is attached
to the **current offering**, so nothing in the code needs to change once you
save.

---

## Rules

1. **Do only what is listed here.** Do not rename, delete or tidy anything
   else, even if it looks wrong.
2. **Never delete** a product, base plan, offer, entitlement, offering or
   existing paywall. If a paywall already exists on `default`, stop and ask
   the user before replacing it.
3. **Stop and ask the user** whenever the screen does not match this brief: a
   component or setting is missing, a value is refused, or a dialog asks
   something not covered here. Do not invent a workaround.
4. **Never accept new terms, start a paid RevenueCat plan, or change billing.**
   If the paywall editor needs a paid plan, stop and say so.
5. **Copy is exact.** Type every string below word for word. If the editor
   will not accept one, stop and ask. Do not reword.
6. **Store rules.** The price and the renewal terms must be visible without
   scrolling. No fake countdowns, no timers, no hidden or disguised close
   button, no "only today" claims. Breaking these gets the app pulled from
   Google Play.
7. **Never copy or repeat a secret.** Secret API keys, service account JSON
   and webhook Authorization values stay on screen.
8. **Google Play Console only in step 2,** and only after the user says yes.
9. When done, fill in the report at the bottom.

---

## What is already true

- Entitlement **`pro`**.
- Offering **`default`**, marked current, with two packages:
  - **`$rc_monthly`**, a 1 month product
  - **`$rc_annual`**, a 1 year product
- Prices, set in the store, not typed into the paywall:

| | India | United States, and everywhere else |
| --- | --- | --- |
| Monthly | ₹199 a month | $5 a month |
| Yearly | ₹499 a year | $19.99 a year |
| First 14 days, yearly only, new subscribers | ₹1 | $1 |

- While testing on the **Test Store**, products cannot carry an intro offer.
  The preview will show the full yearly price and hide the timeline. That is
  correct. Do not fake the $1.

The identifiers the app and server check. These must be **exactly** right:

| Thing | Exact value |
| --- | --- |
| Android package | `com.scrollsy.app` |
| Play subscription product ID | `scrollsy_pro` |
| Play base plans | `monthly` and `yearly` |
| Play intro offer ID, on `yearly` only | `intro-14-days` |
| RevenueCat entitlement | `pro` |
| RevenueCat offering, current | `default` |
| RevenueCat packages | `$rc_monthly` and `$rc_annual` |

Other countries: set United States and let Google convert the price into local
currencies. Then override only India with the rupee prices.

What a new yearly subscriber goes through:

1. Day 1. Pays $1 (₹1).
2. Day 15. Charged $19.99 (₹499).
3. Every year after that. Charged $19.99 (₹499) again, until they cancel.

---

## Step 1. RevenueCat, Test Store prices

Go to **app.revenuecat.com**, project **scrollsy**.

The app is being tested against RevenueCat's **Test Store** right now. Its
yearly product shows **$79**, which is wrong and is what the app displays.

1. Left menu **Product catalog → Products**. Find the **Test Store** section.
   Report every product listed there and its price.
2. Open the monthly test product. If the price can be edited, set it to
   **$5.00** and save.
3. Open the yearly test product. If the price can be edited, set it to
   **$19.99** and save. Make sure its duration is **1 year**, not 1 month.
4. **If a price cannot be edited:**
   - Click **+ New** in the Test Store section and make a new product.
     - Monthly: identifier `monthly_5`, duration 1 month, price $5.00
     - Yearly: identifier `yearly_1999`, duration 1 year, price $19.99
   - Left menu **Product catalog → Entitlements**, open **`pro`**, click
     **Attach** and attach the new product.
   - Left menu **Product catalog → Offerings**, open **`default`**. Edit the
     package **`$rc_monthly`** (or **`$rc_annual`**) so it points at the new
     product instead of the old one. Do not delete the old product.
5. Test Store products cannot carry an intro offer. That is expected. While
   testing, the app will show $19.99 instead of $1. Do not try to fake the $1.

Then check:

6. **Product catalog → Offerings**. `default` is marked current, and it has
   exactly two packages: `$rc_monthly` pointing at a 1 month product and
   `$rc_annual` pointing at a 1 year product. Report what each points at and
   its price.
7. **Product catalog → Entitlements → `pro`**. Both products the offering
   uses are attached. Report the list.

---

## Step 2. Google Play Console, real prices

**Ask the user before starting this step.** Say: "Step 1 is done. Step 2 changes
real prices in Google Play Console. Shall I go ahead?" Continue only on a yes.
If they say not yet, skip steps 2 and 3 and go on to step 4.

Go to **play.google.com/console**, app **Scrollsy** (`com.scrollsy.app`).
Left menu **Monetize with Play → Products → Subscriptions**.

If the Subscriptions page is locked, or the app is not listed, stop and tell
the user. Uploading a build is theirs to do.

1. **The subscription.** If `scrollsy_pro` exists, open it. If not, click
   **Create subscription**: product ID `scrollsy_pro`, name `Scrollsy Pro`.
2. **Monthly base plan.** Open base plan `monthly`, or add one.
   - Base plan ID `monthly`, **Auto-renewing**, billing period **1 month**
   - Set prices: United States **$5.00**, apply to all countries with Google's
     conversion, then edit **India** to **₹199**
   - Save and **Activate**
   - It must have **no offers**. If it already has one, **deactivate** it (do
     not delete) and report it.
3. **Yearly base plan.** Open base plan `yearly`, or add one.
   - Base plan ID `yearly`, **Auto-renewing**, billing period **1 year**
   - Set prices: United States **$19.99**, apply to all countries with
     Google's conversion, then edit **India** to **₹499**
   - Save and **Activate**
4. **The intro offer, on `yearly` only.** On the `yearly` base plan, click
   **Add offer**.
   - Offer ID `intro-14-days`
   - Eligibility **New customer acquisition**, for users who have never had
     this subscription
   - Add a phase. Type **Single payment**, duration **2 weeks**
   - Price: United States **$1.00**, apply to all countries with Google's
     conversion, then edit **India** to **₹1**
   - Save and **Activate**
   - If an older offer called `intro-week` exists, **deactivate** it (do not
     delete) and report it.
5. **If India refuses ₹1.** Google has a minimum price per country, about ₹10
   in India. If the field turns red or says the price is too low, **stop and
   ask the user** whether to use ₹10 or a free 14 day trial for India. Do not
   pick yourself and do not round.
6. **If 2 weeks is not a choice** for a single payment phase, stop and report
   what durations are offered.

---

## Step 3. RevenueCat, the Play products

Only after step 2 is done and active. Otherwise skip to step 4.

1. **app.revenuecat.com**, project **scrollsy**, **Product catalog →
   Products**, section **scrollsy (Play Store)**.
2. If `scrollsy_pro:monthly` and `scrollsy_pro:yearly` are not listed, click
   **Import** and import them. If the import list is empty, stop and tell the
   user. Google can take up to 36 hours to accept RevenueCat's credentials.
3. Report the prices RevenueCat shows for both. They are read only here and
   should match the table above. If they do not, report it. Do not edit.
4. **Entitlements → `pro`**: attach both Play products. Leave the Test Store
   products attached too.
5. **Leave the `default` offering on the Test Store products.** The user
   switches it to Play when they are ready to ship. If they tell you to switch
   now, point `$rc_monthly` at `scrollsy_pro:monthly` and `$rc_annual` at
   `scrollsy_pro:yearly`.

---

## Step 4. Build the paywall

Go back to **app.revenuecat.com**, project **scrollsy**.

### Never type a price

Every price, period and date on this paywall comes from a **product variable**,
so it is always the price the store will charge, in the buyer's own currency.
Typing `$1` or `₹499` anywhere is wrong.

The variables you will use:

| Variable | Shows |
| --- | --- |
| `{{ product.price }}` | Full price, e.g. $19.99 |
| `{{ product.price_per_period }}` | Full price with its period, e.g. $19.99/yr |
| `{{ product.period_with_unit }}` | e.g. 1 year |
| `{{ product.price_per_month }}` | Yearly price worked out per month |
| `{{ product.relative_discount }}` | Saving against the dearer package |
| `{{ product.offer_price }}` | The intro price, e.g. $1 |
| `{{ product.offer_period_with_unit }}` | The intro length, e.g. 14 days |
| `{{ product.offer_end_date }}` | The date the intro ends and the year starts |

**Offer variables** (`offer_*`) may only go inside something that shows **only
to people eligible for the intro offer**. The editor will refuse to save
otherwise. Where this brief uses them, it says which visibility rule to set.

---

### The layout, top to bottom

Start with **Paywalls** in the left menu (or open the `default` offering and
choose **Create paywall**). Pick the closest template to this layout, a single
page with a header image, a feature list, two packages and one button. Then
change it to match below. If no template is close, start blank.

#### Page

- Background, light mode **`#FBFAFD`**, dark mode **`#06050E`**
- Text, light mode **`#12101A`**, dark mode **`#F4F3F7`**
- Accent, light mode **`#6D28D9`**, dark mode **`#A78BFA`**
- Font. If the editor lets you choose a Google font, choose **Plus Jakarta
  Sans**, headings extra bold (800), body medium (500). If it only offers
  system fonts, use the system font and report it. Do not upload font files.
- Make sure the paywall has a **dark mode** version with the dark colours
  above. Check both in the preview.

#### 1. Close button, top right

- A **Button** component with the **close / dismiss** action.
- Icon only, an ✕, clearly visible, at least 44 by 44 points to tap.
- Visible from the first frame. **No delay.**

This is the app's "Continue free". Pressing it finishes onboarding and opens
the free app. It must never be hidden, faded out or disguised.

#### 2. Mascot image

- An **Image** component, centred, about 160 points tall.
- Ask the user for the image file. It lives in their repo as
  `assets/mascot/cooked.png`. Do not use a stock image or an AI generated one.

#### 3. Headline

- **Text**, centred, extra bold, about 32 points.
- `Buy back your brain.`

#### 4. Feature list

- **Feature list** component, four items, each with a check or dot icon in
  the accent colour:
  1. `Lock apps at your limit`
  2. `Buy back 50 reels after lockout`
  3. `Full history, not just 7 days`
  4. `More than 5 friends`

#### 5. How the first 14 days work (the timeline)

- A **Timeline** component, three items, connector line in the accent colour.
- Set its visibility rule to **Introductory offer eligible → Show**. It must
  not appear for anyone who is not getting the intro price, and it must not
  appear for monthly.
- If the editor lets the timeline follow the selected package, show it only
  when **`$rc_annual`** is selected. If it cannot, place it inside the yearly
  package component (step 6) instead. If neither is possible, stop and ask.

The three items, icon, title, then description:

| # | Icon | Title | Description |
| --- | --- | --- | --- |
| 1 | unlock | `Today` | `Pay {{ product.offer_price }}. Reels lock at your limit right away.` |
| 2 | calendar | `{{ product.offer_end_date }}` | `Your year starts. {{ product.price }} for the next 12 months.` |
| 3 | repeat | `Every year after` | `{{ product.price_per_period }}. Cancel anytime in Play Store.` |

#### 6. The two packages

Two **Package** components, side by side or stacked, yearly first.

**Yearly**, package `$rc_annual`, **selected by default**:

- Title `Yearly`
- Badge `Save {{ product.relative_discount }}`. Only show it if the editor
  hides it when the discount is empty.
- Price line, with a text rule:
  - Intro offer eligible: `{{ product.offer_price }} for {{ product.offer_period_with_unit }}`
  - Otherwise: `{{ product.price_per_period }}`
- Small line under it, not eligible only: `{{ product.price_per_month }} a month`

**Monthly**, package `$rc_monthly`:

- Title `Monthly`
- Price line `{{ product.price_per_period }}`

The selected package gets an accent border, 2 points, and the accent soft fill.
The other has a plain border.

#### 7. Purchase button

- One **Purchase button**, full width, the biggest and brightest thing on the
  page. Accent fill, gradient bottom to top **`#5B21B6`** to **`#7C3AED`**
  if gradients are offered, white text, extra bold.
- Text, with a rule:
  - Intro offer eligible: `Start for {{ product.offer_price }}`
  - Otherwise: `Start for {{ product.price }}`

There is no other button styled like this one. Everything else is quiet.

#### 8. Terms, right under the button

- **Text**, small, centred, secondary colour, never hidden and never below
  the fold. With a rule:
  - Intro offer eligible: `{{ product.offer_price }} for {{ product.offer_period_with_unit }}, then {{ product.price_per_period }}. Renews automatically. Cancel anytime in Play Store.`
  - Otherwise: `{{ product.price_per_period }}. Renews automatically. Cancel anytime in Play Store.`

#### 9. Footer links, small and quiet

Three text buttons in one row:

- `Restore`, action **restore purchases**
- `Terms`, action **open URL** `https://scrollsy.pages.dev/terms`
- `Privacy`, action **open URL** `https://scrollsy.pages.dev/privacy`

---

### Writing rules for every string

These are hard rules from the app. The copy above already follows them. If
you have to type anything not written here, stop and ask instead.

- No em dash `—`, no en dash `–`, and no spaced hyphen ` - ` in their place.
- No colons, except in a clock time.
- No semicolons.
- Sentence case. Short lines.

---

### Check before saving

1. Preview **Yearly selected**, intro eligible: timeline shows, button says
   `Start for $1`, terms say `$1 for 14 days, then $19.99/yr...`. On the Test
   Store the offer is missing, so check this once Play products are attached.
2. Preview **Monthly selected**: no timeline, button says `Start for $5`.
3. Preview **not eligible**: no timeline, no offer text anywhere.
4. Preview **dark mode**: everything readable.
5. Price, terms, the button and the ✕ are all visible without scrolling on a
   small phone preview.
6. Save, then **publish** the paywall and make sure it is attached to the
   **`default`** offering, which is still **current**.

---

## Report back

```
Test Store monthly           product ..., price ...
Test Store yearly            product ..., price ..., duration ...
New test products made       none / ...
Offering default current     yes / no
$rc_monthly                  points at ..., price ...
$rc_annual                   points at ..., price ...
Entitlement pro attached     ...

Play Console approved        yes / no
Play monthly base plan       $... US, ₹... India, active yes / no, offers ...
Play yearly base plan        $... US, ₹... India, active yes / no
Play intro-14-days offer     $... US, ₹... India, 2 weeks, active yes / no
Deactivated                  none / ...
Play products in RevenueCat  imported / not yet, because ...
Prices RevenueCat shows      monthly ..., yearly ...

Template started from        ...
Font                         Plus Jakarta Sans / system, because ...
Dark mode version            yes / no
Close button                 top right, visible at once, yes / no
Mascot image                 uploaded / waiting on the user
Timeline                     intro eligible only, yearly only, how: ...
Packages                     yearly default selected, yes / no
Purchase button text rules   set / blocked because ...
Terms text rules             set / blocked because ...
Restore, Terms, Privacy      set / ...
Published and on default     yes / no
Anything the editor refused  ...
Anything unexpected          ...
```

---

## How it reaches the app

The onboarding screen draws RevenueCat's paywall view for the current offering.
The ✕ finishes onboarding on the free plan. A purchase or a restore unlocks the
app and finishes onboarding. The webhook then writes the expiry date on the
server: 14 days out during the intro, a year out after each yearly charge.
