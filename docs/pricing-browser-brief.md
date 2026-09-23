# Brief for a browser agent: set Scrollsy's prices

You are working in the user's own browser, already signed in as them. Your job
is to make the store and RevenueCat match the prices below. Everything you need
to type is written out. Go through the parts in order.

These are live billing dashboards for a real app. Read the rules first.

---

## Rules

1. **Do only what is listed here.** Do not explore, tidy, rename or delete
   anything you were not asked to touch, even if it looks wrong.
2. **Never delete** a product, base plan, offer, entitlement or offering. If
   something has to be replaced, make the new one next to it and report both.
3. **Stop and ask the user** whenever the screen does not match this brief:
   a button is missing, a field rejects a value, a dialog asks something not
   covered here, or a step is already done differently. Do not work around it.
4. **Never accept new terms, enter payment details, or change anything on a
   billing, payout or plan page** belonging to RevenueCat or Google.
5. **Never copy or repeat a secret.** Secret API keys, service account JSON and
   webhook Authorization values stay on screen. Public SDK keys are fine to
   report.
6. **Google Play Console only in part B,** and only after the user says yes.
7. When a part is done, say what you did and what the screen showed. At the
   end, fill in the report at the bottom.

---

## The prices

Two plans. The yearly plan has an intro offer: new subscribers pay a small
amount for the first 14 days, then the yearly price. It renews every year
until they cancel. Monthly has no intro offer.

| | India | United States, and everywhere else |
| --- | --- | --- |
| Monthly | ₹199 a month | $5.00 a month |
| Yearly | ₹499 a year | $19.99 a year |
| First 14 days, yearly only, new subscribers | ₹1 | $1.00 |

Other countries: set United States and let Google convert the price into local
currencies. Then override only India with the rupee prices above.

What a new yearly subscriber goes through:

1. Day 1. Pays $1 (₹1).
2. Day 15. Charged $19.99 (₹499).
3. Every year after that. Charged $19.99 (₹499) again, until they cancel.

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

---

## Part A. RevenueCat, Test Store prices

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

## Part B. Google Play Console, real prices

**Ask the user before starting this part.** Say: "Part A is done. Part B changes
real prices in Google Play Console. Shall I go ahead?" Continue only on a yes.

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

## Part C. RevenueCat, the Play products

Only after part B is done and active.

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

## Report back

```
Test Store monthly          product ..., price ...
Test Store yearly           product ..., price ..., duration ...
New test products made      none / ...
Offering default current    yes / no
$rc_monthly                 points at ..., price ...
$rc_annual                  points at ..., price ...
Entitlement pro attached    ...

Part B approved             yes / no
Play monthly base plan      $... US, ₹... India, active yes / no, offers ...
Play yearly base plan       $... US, ₹... India, active yes / no
Play intro-14-days offer    $... US, ₹... India, 2 weeks, active yes / no
Deactivated                 none / ...

Play products in RevenueCat imported / not yet, because ...
Prices RevenueCat shows     monthly ..., yearly ...
Anything unexpected         ...
```

---

## Why it matters

The app never types a price. It shows exactly what the store returns through
RevenueCat, so whatever is set here is what every user sees and pays. The
server records the expiry date from RevenueCat's webhook on every charge, so
the 14 day window and each yearly renewal need nothing else from you.
