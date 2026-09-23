# Payments setup, Play Console and RevenueCat

The app side is built. This is everything that happens outside the code, in
order, with the exact values the code expects. Where a value must match the
code, it says so.

The page in the app already exists twice: as step 6 of onboarding
(`src/app/onboarding/paywall.tsx`) and as the modal every Pro row opens
(`src/app/paywall.tsx`). Both read prices from the store, so nothing below
needs a code change unless a value in the "must match" column changes.

**Decided: onboarding uses RevenueCat's own paywall** (Paywalls v2, from
`react-native-purchases-ui`). The layout, copy and the 14 day timeline are
edited in their dashboard without an app release, and every price on it is a
product variable, so it always shows what the store will charge. How to build
it is in `docs/revenuecat-paywall-brief.md`.

The app's own screen stays as the fallback, for a build where RevenueCat's
view cannot be drawn: no SDK key, or no native module. The modal every Pro row
opens (`src/app/paywall.tsx`) is still the app's own screen.

Adding `react-native-purchases-ui` adds native code, so it needs a **new
development build** (`npx expo run:android` or EAS). An older build will not
have the paywall view.

## The prices

| | India | United States and the West |
| --- | --- | --- |
| Monthly | ₹199 a month | $5 a month |
| Yearly | ₹499 a year | $19.99 a year |
| First 14 days, yearly only, new subscribers | ₹1 (see below) | $1 |
| Yearly saving the app will show | 79% | 67% |

How the yearly plan runs:

1. Day 1. They pay **$1** (India **₹1**) for the first 14 days.
2. Day 15. Play charges **$19.99** (India **₹499**), and again every year on
   the same date, until they cancel. UPI AutoPay or card, whatever is on their
   Play account.
3. Each charge reaches the Worker through the RevenueCat webhook, which writes
   `subscription_expires_at` in `profiles`. During the 14 days the row says
   `trialing` and expires on day 15. After the first yearly charge it says
   `active` and expires a year out. Each renewal pushes it another year.

Monthly has no intro offer. It is $5 (India ₹199) from day 1, every month.

The saving is worked out from the store's own prices, `yearlySaving` in
`src/lib/offers.ts`, so it is right in each country without anyone typing it.

**Check this first.** Play sets a minimum price per country and India's is
about ₹10. Type ₹1 into the offer and Play Console may refuse it. If it does,
the two honest ways out are:

- **₹10 for the first 14 days.** Same shape as the US offer.
- **A 14 day free trial** in India only. Free trials have no floor.

The app handles either without a change: it shows whatever introductory
price the store returns, or the full price when there is none. Only the
fallback in `src/constants/placeholder.ts` would need the new number.

## 1. Play Console

1. Create the app with package name **`com.scrollsy.app`**. Must match
   `android.package` in `app.json`.
2. Set up a payments profile under Setup, Payments profile. Nothing can be sold
   without one.
3. If Monetize, Products, Subscriptions is locked, upload one build to the
   internal testing track first. `react-native-purchases` adds the billing
   permission Play looks for.
4. Create a subscription.
   - Product ID **`scrollsy_pro`**
   - Name `Scrollsy Pro`
5. Add a base plan.
   - Base plan ID **`monthly`**
   - Auto-renewing, billing period 1 month
   - Prices: set United States to **$5.00** and let Play convert the rest, then
     override India to **₹199**
   - Activate
6. Add a second base plan.
   - Base plan ID **`yearly`**
   - Auto-renewing, billing period 1 year
   - United States **$19.99** and let Play convert the rest, then override
     India to **₹499**
   - Activate
7. On the `yearly` base plan, add an offer.
   - Offer ID `intro-14-days`
   - Eligibility: **New customer acquisition**, customers who have never had
     this subscription
   - Phase: **Single payment**, duration **2 weeks** (14 days)
   - Price: United States **$1.00** and let Play convert the rest, India
     **₹1** (see the floor warning above)
   - Activate
8. Do **not** add an offer to `monthly`. It is full price from day 1.
9. Setup, License testing: add every Google account you will test with.
   Those accounts are never charged. They see Google's test instruments
   instead of UPI or real cards, which is expected.

## 2. Service credentials, so RevenueCat can read Play

1. Google Cloud Console, the project linked to Play Console.
2. Enable the **Google Play Android Developer API**, the **Google Play
   Developer Reporting API** and **Cloud Pub/Sub**.
3. IAM and Admin, Service accounts: create one. Give it **Pub/Sub Editor** and
   **Monitoring Viewer**.
4. On that account, Keys, add a key, **JSON**. Download it and keep it out of
   the repo.
5. Play Console, Users and permissions: invite the service account's email and
   grant
   - View app information and download bulk reports
   - View financial data, orders, and cancellation survey responses
   - Manage orders and subscriptions
   - Manage store presence

It can take **up to 36 hours** before Google accepts the new credentials.
Editing any product's description in Play Console sometimes speeds that up.

## 3. RevenueCat

Menu names below are what the dashboard calls them. Only two strings have to be
exact, because the code compares them: the entitlement `pro`, and the two
package identifiers.

1. **app.revenuecat.com**, project switcher top left, **+ Create new project**,
   named `Scrollsy`.
2. **Apps** in the left menu, **+ New app, Google Play Store**. Package
   `com.scrollsy.app`.
3. On that app's page, **Service Credentials**: upload the JSON key from part 2.
   Showing as pending at first is normal, see the 36 hours above.
4. On the same page, connect **Real-time developer notifications**. RevenueCat
   gives you a Pub/Sub topic; paste it into Play Console, Monetization setup.
   Renewals and cancellations then arrive in seconds rather than by polling.
5. **Product catalog, Products tab, + New, Import Products**. Tick
   **`scrollsy_pro:monthly`** and **`scrollsy_pro:yearly`**. Nothing listed
   means the credentials are not live yet; either wait, or **+ New product** and
   type the identifier, which is subscription ID, colon, base plan ID.
6. **Product catalog, Entitlements tab, + New entitlement**. Identifier
   **`pro`** exactly. Open it and press **Attach** to attach both products.
   Must match `EntitlementId` in `src/lib/purchases.ts` and
   `REVENUECAT_ENTITLEMENT_ID` in `api/wrangler.jsonc`.
7. **Product catalog, Offerings tab, + New**. Identifier **`default`**, which
   cannot be renamed later. Open it and press **+ Add package** twice:
   - **`$rc_monthly`** with `scrollsy_pro:monthly`
   - **`$rc_annual`** with `scrollsy_pro:yearly`

   Then make it the **current** offering. The app renders whichever offering is
   current, and reads only those two package types. A custom package is ignored.
8. **Project settings**, restore or transfer behaviour: choose **transfer to new
   App User ID**. It decides what happens when someone buys before signing in
   and then signs in.

### Testing before Play is ready

RevenueCat's **Test Store** sells simulated products with no Play setup at all,
which is the way to prove the whole path while Play Console and the service
credentials are still pending.

Make the products under Product catalog, attach them to the same `pro`
entitlement, point the `default` offering at them, and put the **Test Store API
key**, which is separate from the `goog_` one, in `.env.local`. Buying then
opens a RevenueCat modal where you choose the outcome, and everything after
that is real: the entitlement, the webhook, the database row.

Two differences to expect. Test products have no introductory phase, so the
button shows the full price and the terms line is the plain one. Renewals are
accelerated and stop after five.

**Never ship a build carrying the Test Store key.** Swap it for the `goog_` key
before any release.
9. **API keys** in the left menu, its own item:
   - The **Google public SDK key** goes in `.env.local` as
     `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. It is safe in the app.
   - A **V1 secret key** goes in `api/.dev.vars` as `REVENUECAT_API_KEY`, and in
     production with `npx wrangler secret put REVENUECAT_API_KEY`. The webhook
     calls RevenueCat's v1 API with it. Never put it in the app.
10. **Integrations, Webhooks, Add new configuration**:
    - **Name** anything, such as Doomless Worker
    - **HTTPS URL**
      `https://doomless-api.<your-subdomain>.workers.dev/v1/webhooks/revenuecat`
    - **Authorization header**: a long random value you invent. The same value
      goes in `api/.dev.vars` as `REVENUECAT_WEBHOOK_AUTH`, and in production
      with `npx wrangler secret put REVENUECAT_WEBHOOK_AUTH`.
    - **Environment**: production and sandbox both, so test purchases land too.
    - **App scope**: this app. **Event filtering**: off, send everything.

## 4. Build and test

1. `npx expo run:android`, or an EAS development build. Expo Go cannot buy.
2. Sign in on the phone with a **license tester** account. A sideloaded debug
   build works for license testers, as long as the package name matches.
3. Open the paywall. It should show the store's prices, in the tester's
   currency, and the saving badge.
4. Buy with **Test instrument, always approves**. The app unlocks at once, from
   the store's own answer. Within seconds the webhook writes the same thing to
   the database, which is what a second phone would read.
5. Watch it renew. For testers a week and a month each take **5 minutes**, a
   year takes **30**, and a test subscription renews at most **6 times**.
6. Try **always declines**. The paywall should say nothing was charged.
7. Sign out, sign in as a second tester, and check the new account is not a
   member. Then restore on the first account and check it is.

## What each person sees

| Who | Button | Terms line |
| --- | --- | --- |
| New in India, yearly | Start for ₹1 | ₹1 for 14 days, then ₹499 a year |
| New in the US, yearly | Start for $1 | $1 for 14 days, then $19.99 a year |
| Monthly, India | Start for ₹199 | ₹199 a month |
| Monthly, US | Start for $5 | $5 a month |
| Had the plan before, yearly | Start for ₹499 or $19.99 | ₹499 or $19.99 a year |
| Store not reached yet | Written price from `placeholder.ts` | Same, written |

A returning subscriber is not eligible for the offer, so Play leaves it out
and the app falls back to the full price and the plain terms line.

The Play account's country decides all of this, not the phone's language or
location.
