# Brief for a browser agent: set up RevenueCat for Scrollsy

You are operating the RevenueCat dashboard at **app.revenuecat.com** in the
user's own browser, already signed in as them. Work through the tasks below in
order. Everything you need to type is written out.

This is a live billing dashboard for a real app. Read the rules before clicking.

---

## Rules

1. **Do only what is listed here.** Do not explore, tidy, rename, or delete
   anything you were not asked to touch, even if it looks wrong.
2. **Never delete a product, entitlement or offering** that already exists.
   Create new ones alongside, and report what you found.
3. **Stop and ask the user** whenever the screen does not match this brief: a
   button is missing, a field rejects a value, a dialog asks something not
   covered here, or a step is already done differently. Do not improvise a
   workaround.
4. **Never accept new terms, start a paid plan, enter payment details, or
   change anything on a billing or plan page.**
5. **Secrets.** You may read and report the **public SDK key**, which is safe:
   it ships inside the app. You must **not** transcribe the **secret API key**
   anywhere. Create it, then stop and tell the user to copy it themselves from
   the screen. The same goes for the Google service account JSON.
6. **Do not open Google Play Console** or change anything there. That half is
   the user's, by hand.
7. When a task is done, say what you did and what the screen showed. When every
   task is done, fill in the report at the bottom.

---

## What is already true

- The project in RevenueCat is called **scrollsy**.
- The **Product catalog → Products** page currently shows two **Test Store**
  products named `Monthly` and `Yearly`, each with one entitlement attached.
  Leave them. They are how the app gets tested before Play is ready.
- The **Play Store** section of that page is empty.
- The app's package name is **`com.scrollsy.app`**.

---

## The plan and its prices

Two plans, sold in every country, with an introductory price for the first
week for people who have never subscribed before.

| | India | United States |
| --- | --- | --- |
| Monthly | ₹49 | $5 |
| Yearly | ₹499 | $10 |
| First 7 days | ₹1, see the warning | $1 |

**Warning about ₹1.** Google Play enforces a minimum price per country and
India's is roughly ₹10. If any field refuses ₹1, **stop and ask the user**
whether to use ₹10 for the first week or a 7 day free trial instead. Do not
pick one yourself, and do not round the price silently.

Prices are set in Play Console, not in RevenueCat. They appear here read only,
imported from Play. If a price on screen disagrees with the table above, report
it rather than editing it.

---

## Task 1. Confirm the entitlement

Left menu **Product catalog → Entitlements**.

- If an entitlement with the identifier **`pro`** exists, open it and continue
  to task 2.
- If the only entitlement has a different identifier, do **not** rename or
  delete it. Click **+ New entitlement**, identifier exactly **`pro`**, all
  lowercase, description `Scrollsy Pro`. Then open it, click **Attach**, and
  attach both Test Store products, `Monthly` and `Yearly`.

Report which of these two cases you found.

The identifier must be `pro` exactly. The app and the server both compare that
literal string, and any other spelling means nobody is ever unlocked.

---

## Task 2. Create the offering

Left menu **Product catalog → Offerings**.

1. Click **+ New**.
2. Identifier: **`default`**, all lowercase. It cannot be renamed later.
3. Description: `Scrollsy Pro plans`.
4. Save, then open the offering.
5. Click **+ Add package**. Choose the identifier **`$rc_monthly`** from the
   dropdown, attach the product `Monthly`, save.
6. Click **+ Add package** again. Choose **`$rc_annual`**, attach the product
   `Yearly`, save.
7. Make this offering the project's **current** (or default) offering. The
   control may be a toggle on the offering, or a "Make current" action in its
   overflow menu.

The two package identifiers must be exactly `$rc_monthly` and `$rc_annual`. The
app looks for those two and ignores anything else, so a custom identifier means
an empty paywall.

---

## Task 3. Report the public SDK key

Left menu **API keys**.

- Find the **public** key for the Test Store, and the **public** key for the
  Play Store app if one is listed.
- Report both, labelled. These are safe to share.

Do not create, regenerate or delete any key in this task.

---

## Task 4. Create a secret API key

Still on **API keys**, under **Secret API keys**.

1. Click **+ New secret API key**.
2. Name it `Doomless Worker`.
3. If asked to choose an API version, choose the one valid for the **v1** REST
   API. If only V2 is offered, **stop and tell the user**, because the server
   calls a v1 endpoint and someone has to change the code.
4. The key is shown once. **Do not copy it, repeat it, or write it anywhere.**
   Stop and tell the user to copy it from the screen now.

---

## Task 5. Transfer behaviour

Left menu **Project settings**. Find the setting for restore or transfer
behaviour between App User IDs, and choose **transfer to new App User ID**.

Report the exact wording of the option you selected. If no such setting exists
on that page, say so rather than hunting through other pages.

---

## Task 6. Webhook

Left menu **Integrations → Webhooks → Add new configuration**.

- **Name**: `Doomless Worker`
- **HTTPS URL**: ask the user for it. It ends in `/v1/webhooks/revenuecat`.
  Do not guess the domain.
- **Authorization header**: ask the user for the value. Do not invent one, and
  do not report it back once entered.
- **Environment**: both production and sandbox.
- **App scope**: this app.
- **Event filtering**: leave off, so every event is sent.

If the user does not have the URL or the header value yet, skip this task and
say it is outstanding.

---

## Task 7. The Play Store side, later

Only when the user says Play Console is ready and the service credentials have
been accepted by Google:

1. **Product catalog → Products**, in the **scrollsy (Play Store)** section,
   click **Import**.
2. Import `scrollsy_pro:monthly` and `scrollsy_pro:yearly`.
3. Attach both to the existing **`pro`** entitlement.
4. In the **`default`** offering, point `$rc_monthly` at
   `scrollsy_pro:monthly` and `$rc_annual` at `scrollsy_pro:yearly`, replacing
   the Test Store products.

Do not do this task before the user confirms. An empty Play section means
Google has not accepted the credentials yet, which can take up to 36 hours.

---

## Optional. Only if the user asks for a RevenueCat paywall

The app has its own paywall screen and is not using RevenueCat's paywall
builder. Skip this section unless the user explicitly asks for it.

If they do, these are the app's own values, so the two look like one product.

**Colours**

| Role | Value |
| --- | --- |
| Accent, light background | `#6D28D9` |
| Accent, dark background | `#A78BFA` |
| Button gradient, bottom to top | `#5B21B6` to `#7C3AED` |
| Text on the accent | `#FFFFFF` |

**Type**: Plus Jakarta Sans. Headings extra bold at 800, body medium at 500.

**Copy**, word for word:

- Eyebrow: `Scrollsy Pro`
- Headline: `Buy back your brain.`
- Button: `Start for {price}`
- Secondary: `Continue free`
- Benefits, in this order:
  - `Lock apps at your limit`
  - `Buy back 50 reels after lockout`
  - `Full history, not just 7 days`
  - `More than 5 friends`
- Terms, shown plainly and never hidden:
  `{entry} for 7 days, then {price} a year. Cancel anytime in Play Store.`

**Writing rules for anything you type into a paywall.** No em dashes or en
dashes. No colons except in a clock time. Sentence case. Short lines. The price
and the renewal terms must be visible without scrolling, because hiding them
gets the app rejected.

---

## Report back

Fill this in when you finish.

```
Entitlement `pro`          found already / created / blocked because ...
Products attached to it    ...
Offering `default`         created / already existed / blocked because ...
$rc_monthly                attached to ...
$rc_annual                 attached to ...
Marked current             yes / no, because ...
Public SDK key, test       ...
Public SDK key, Play       ... or none listed
Secret API key             created, user copied it / not created, because ...
Transfer behaviour         the option chosen, word for word
Webhook                    configured / skipped, because ...
Play Store products        imported / not yet, section still empty
Anything unexpected        ...
```

---

## What the user does with all this

The public SDK key goes in their `.env.local` as
`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. The secret key and the webhook
Authorization value go into the server's own secrets, never into the app. They
know where. You do not need to touch any of it.
