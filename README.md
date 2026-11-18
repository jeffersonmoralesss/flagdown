# Flagdown (working name)

See licensed DC cabs that are free near you, moving live on a map, and call the driver directly.
Riders pay nothing and need no account. Drivers pay a flat monthly subscription and keep the whole fare.

"Flagdown" is a placeholder. To rename the app, change `rider-web/src/lib/brand.js`, the `<title>` in
`rider-web/index.html`, and the two names in `rider-web/public/manifest.webmanifest`.

## What's in here

| Folder | What it is | Status |
| --- | --- | --- |
| `rider-web/` | Rider web app: welcome, live map, cab list, filters, cab details, call, share | Done (demo or real data) |
| `driver-app/` | Driver app (one codebase for web, iPhone and Android): sign-up, documents, Available switch, location | Done (web tested; phone needs a build) |
| `supabase/` | Database, security rules, tests | Done |
| `admin/` | Approve drivers, handle reports | Later |

## Run the rider app

```bash
cd rider-web
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). To open it on your phone, use the
`Network:` address it prints, with the phone on the same Wi-Fi.

"Find cabs near me" needs location permission. Browsers only allow location on `localhost` or on
`https` sites, so on your phone over Wi-Fi use "Look around downtown DC" until the app is deployed.

Run the tests (no browser needed):

```bash
npm test        # expect: pass 15, fail 0
```

## How the rider app works

The demo runs with no backend. Eight made-up cabs drive around the rider, and every screen works
the way it will with real drivers.

### The files

| File | What it does |
| --- | --- |
| `src/main.jsx` | Starts React and wraps the app in the language provider |
| `src/App.jsx` | The page frame (top bar), and the "find a cab" screen that loads cabs and refreshes them |
| `src/components/Welcome.jsx` | First screen: three steps, and the button that asks for location |
| `src/components/MapView.jsx` | The map, the "you" dot and the moving cab pins |
| `src/components/CabList.jsx` | The filter buttons and the list of cabs |
| `src/components/CabSheet.jsx` | One cab's details, the Call button and "Share cab details" |
| `src/components/Icons.jsx` | Six small icons drawn in code |
| `src/lib/api.js` | The only place cab data comes from: demo cabs without keys, the database with them |
| `src/lib/cabRow.js` | Turns one database row into the shape the screens use |
| `src/lib/demoCabs.js` | The sample cabs and the math that moves them |
| `src/lib/geo.js` | Distance, ETA and "where am I" |
| `src/lib/format.js` | Phone links, dates, car descriptions, filter matching |
| `src/lib/strings.js` | Every sentence on screen, in English and Spanish |
| `src/lib/i18n.jsx` | Remembers the chosen language and gives screens the `t()` function |
| `src/styles.css` | All styling |
| `tests/logic.test.mjs` | Tests for the math, the filters and the translations |
| `tests/cabRow.test.mjs` | Tests that database rows map correctly, and every database color has a translation |

### Why it's built this way

**One door for data (`api.js`).** Screens call `fetchNearbyCabs()` and never know where the answer
comes from. With no Supabase keys in `.env` it answers from the moving demo cabs; with keys it calls
the database function `nearby_cabs`. `cabFromRow()` renames the database's columns
(`display_name`, `vehicle_color`...) to the names the screens already used (`driver`, `color`...),
so connecting the database didn't change a single screen. TowConnect used the same idea.

**Demo cabs are a pure function of time.** `demoCabsAt(center, time)` returns where every cab is at
that moment. There is no stored state to get out of sync, and because the same inputs always give
the same answer, it is easy to test. Each cab drives around its own rectangle of blocks
(`positionOnLoop`), and two are parked at a stand.

**Smooth pins.** The app asks for positions every 2 seconds. Instead of jumping, each pin slides to
its new spot over those same 2 seconds (`glide` in `MapView.jsx`), so cabs look like they are
driving. Riders who turned on "reduce motion" get jumps instead.

**The map lives outside React.** MapLibre draws and manages its own pins. `MapView` creates the map
once, keeps it in a `ref`, and uses effects to push changes in. The map code is also loaded with
`lazy()`, so the welcome screen opens fast even on a weak signal.

**ETA is an honest estimate.** `etaMinutes` stretches the straight-line distance by 1.3 (streets
aren't straight) and assumes 12 mph city driving. The screen says "about" and "Times are estimates."
Real routing can replace it later without touching any screen.

**Two languages from day one.** No sentence is written inside a component. Components ask
`t('call', { name })` and `strings.js` answers in the current language. A test fails if Spanish is
missing a key or a blank that English has. Adding a third language (Amharic would matter for DC
drivers) is one more block in `strings.js`.

**Location is asked for in context.** The browser's permission pop-up only appears after the rider
taps "Find cabs near me". If they say no, the app still works around downtown DC and offers
"Use my location" again.

### What makes it accessible

- Text is 17px or larger and scales with the phone's text-size setting (sizes use `rem`).
- Every button is at least 44px tall. Each cab row is one large button.
- Colors pass WCAG AA contrast. Nothing depends on color alone (an "on" filter also gets a check mark).
- Works with a keyboard and a screen reader: visible focus rings, labels on pins and rows, the
  details sheet takes focus when it opens and closes with Escape.
- English and Spanish, and the page tells screen readers which language it is in.
- Wheelchair-accessible cabs are a first-class filter.

### The design

The look comes from DC's own cabs: a red body with a gray stripe. Red is used only for the brand and
for the one action that matters, calling a driver. The typeface is Overpass, which is modeled on US
highway signs and made to be read at a glance. Minutes away is the largest thing in each row because
it is the first thing a rider wants to know. Plates are drawn like plates because the rider will
match them against a real one on the street.

## Run the driver app

The driver app is built with Expo, so the same code runs in a web browser (for demos), on your phone
in Expo Go (for quick testing), and as a real iPhone and Android app later.

It has no demo mode: its whole job is writing to the real database, so set up the database first
(see "Set up the database" below).

```bash
cd driver-app
npm install
cp .env.example .env     # then paste the same URL and publishable key as rider-web/.env
npx expo start --web     # opens the driver app at http://localhost:8081
npm test                 # expect: pass 26, fail 0
```

### Try the whole thing end to end

1. **Turn off email confirmation while testing.** In Supabase, go to **Authentication → Sign In / Providers
   → Email** and switch off **Confirm email**. (Turn it back on before launch.) Otherwise each test
   account has to click a confirmation link first.
2. Open the driver app, **create an account**, fill in your details, and upload any three PDFs or
   photos as the documents.
3. **Approve yourself** in the Supabase SQL Editor (the admin panel will do this later). Use the same
   full legal name you typed:
   ```sql
   update drivers
     set status = 'approved', subscription_status = 'trialing', subscription_ends_at = now() + interval '30 days'
     where legal_name = 'Your Full Name';
   update driver_documents set verified = true
     where driver_id = (select id from drivers where legal_name = 'Your Full Name');
   ```
4. In the driver app, tap **Check my status**, then **Go Available** and allow location.
5. In another window, open the rider app (`cd rider-web && npm run dev`) and tap **Find cabs near me**.
   Your cab is in the list and on the map. Tap **Go offline** in the driver app and it disappears
   within a few seconds.

That two-window demo is the one to show Robert.

### On your phone

- **Quick test with Expo Go:** install **Expo Go** from the App Store, run `npx expo start` (without
  `--web`), and scan the QR code with your iPhone camera. Everything works except sending location
  while the app is closed: Expo Go can't do that.
- **Location in the background** needs a real build of the app (`npx expo run:ios` with Xcode, or
  EAS Build), and on an iPhone that needs an Apple Developer account ($99 a year).

## How the driver app works

### The screens

The app picks the screen from who's signed in and their status (`App.js`). No navigation library:
a handful of screens chosen by data are easier to follow, and the back button can never land on a
screen that no longer makes sense.

| Situation | Screen | What it does |
| --- | --- | --- |
| Not signed in | `AuthScreen` | Sign in or create an account |
| No details yet, or editing | `ProfileForm` | Who you are and your cab. Locked after approval except phone and payments |
| Pending | `SetupScreen` | A 3-step checklist and the document uploads |
| Approved | `HomeScreen` | The Available switch, what riders see, subscription, details, documents |
| Suspended | `SuspendedScreen` | Explains the account is paused |

### The files

| File | What it does |
| --- | --- |
| `index.js` | Starts the app. Sets up storage and the background location task first (see the comments) |
| `App.js` | Loads the fonts, then chooses the screen |
| `src/lib/supabase.js` | The connection to Supabase, keeping you signed in |
| `src/lib/api.js` | Every database and file call the app makes, in one place |
| `src/lib/validate.js` | Form checks, with the same limits as the database |
| `src/lib/documents.js` | Works out "missing / waiting for review / verified / expires soon / expired" |
| `src/lib/subscription.js` | Whether the subscription lets you go Available, and what to say about it |
| `src/location/tracking.js` | Starts and stops location sharing (background, foreground or web) |
| `src/location/throttle.js` | Decides which GPS readings are worth sending |
| `src/location/report.js` | Sends one position, remembering what was last sent |
| `src/location/task.native.js` | The background task the phone wakes up to deliver locations |
| `src/i18n/strings.js` | Every word on screen, in English and Spanish |
| `src/components/` | Shared pieces: buttons, fields, the documents section, the rider preview |
| `src/screens/` | The five screens above |

Files ending in `.native.js` are used on iPhone and Android; the file with the same name without
`.native` is used on the web. Expo picks the right one automatically. That's how one codebase handles
things browsers can't do (background tasks) or already do (storage).

### Why it's built this way

**One codebase for web and phone.** Robert can see the driver side in a browser today, and the same
code becomes the App Store and Play Store app. Only location sharing behaves differently per platform,
and that's isolated in `src/location/`.

**Location: three modes.** On a phone build with "Always" permission, location keeps sending while
the driver uses Google Maps or locks the screen (`background`). With "While using" permission, or in
Expo Go, it sends only while the app is open (`foreground`), and the app says so. In a browser it sends
while the page is open (`web`), and the app asks the browser to keep the screen on.

**What gets sent, and how often** (`throttle.js`). Riders' maps refresh every 5 seconds, and the
database hides a cab whose position is over 3 minutes old. So the app sends the first position at once,
then whenever the cab has moved 25 m (at most every 5 seconds), and at least every 30 seconds while
parked. Readings worse than 100 m are skipped unless nothing better arrives for a minute. TowConnect
sent once a minute, because tow trucks wait parked; cabs move.

**Available only after location works.** Going Available first gets a position, then tells the
database. Going offline stops sending first, then tells the database. So a cab is never listed without
a position, and no position is sent after going offline.

**Uploading never hides a driver.** Each upload is a new record. A driver renewing their insurance
stays visible on the old, still-valid record while the new one is reviewed.

**Errors in the driver's language.** Checks return a message key (`err.tooLong`), not English text, so
the same check shows English or Spanish.

### What makes it accessible

- Text is 16 to 32 px, and every button and choice is at least 46 px tall (most are 52 or 64).
- Choices show a check mark when selected, so nothing depends on color alone.
- Screen readers hear each field's label, each choice as selected or not, and the Available state
  when it changes.
- In a browser, a blue ring shows which control has keyboard focus (and only for keyboard users).
- English and Spanish everywhere, following the phone's language the first time.

## Set up the database

The demo works without this. Do it when you want real drivers (or the seeded demo drivers) coming
from a real database.

1. Create a free project at [supabase.com](https://supabase.com). Pick the US East region (closest to DC).
2. Open **SQL Editor**, paste all of `supabase/migrations/20261118000000_init.sql`, and click **Run**.
   It should end with "Success. No rows returned".
3. Optional, for testing: in a new query, paste `supabase/seed.sql` and **Run**. This adds the same
   eight made-up cabs as the demo, parked around downtown. Remove them before launch with
   `delete from public.drivers where is_demo;`
4. In **Project Settings → API Keys**, copy the project URL and the **publishable** key
   (starts with `sb_publishable_`). Never use the secret key in an app.
5. In `rider-web/`, copy `.env.example` to `.env`, paste both values, and restart `npm run dev`.
   The "Demo" label in the top bar disappears: you're on real data now.

To make yourself an admin (needed once the admin panel exists): in **Authentication → Users**,
add a user with your email, then run this in the SQL Editor:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'you@example.com';
```

### Run the database tests

They run the real migration in a temporary in-memory Postgres, so no Supabase account is needed:

```bash
cd supabase/tests
npm install
npm test        # expect: pass 33, fail 0
```

## How the database works

Everything is in one file, `supabase/migrations/20261118000000_init.sql`. It's adapted from
TowConnect's four migrations; what's different for cabs is listed at the top of the file.

### The tables

| Table | What it holds | Who can read it |
| --- | --- | --- |
| `drivers` | One row per driver, including their cab (plate, color, seats...), status, subscription and Available switch | The driver (own row), admins |
| `driver_documents` | DC taxi license, vehicle registration, insurance: file, expiry date, verified or not | The driver (own), admins |
| `driver_positions` | Each driver's one current position | The driver (own), admins |
| `location_pings` | Position history, at most one per minute per driver, kept 30 days | The driver (own), admins |
| `reports` | Problems riders report | Admins |
| `admins`, `admin_log` | Who is an admin, and a record of every approval, verification and resolved report | Admins |

Riders never touch a table. The public key can only call two functions:
**`nearby_cabs(lat, lng)`** and **`submit_report(driver, reason, details, contact)`**.

### When a cab shows up for riders

`nearby_cabs` lists a cab only when every one of these is true:

1. An admin approved the driver.
2. The driver switched Available on.
3. Their subscription is active or in a free trial (with 3 days of grace after it ends).
4. All three documents are verified by an admin and not expired.
5. Their phone sent a position in the last 3 minutes.

If any one stops being true (insurance expires, the phone dies, a payment fails for good), the cab
disappears from the map on its own. No one has to remember to remove it.

### Why it's built this way

**The rules live in the database, not the apps.** A trigger (`drivers_guard`) runs on every change
to a driver row. It stops drivers from approving themselves, giving themselves a subscription, or
switching Available on before they're allowed. Because it's in the database, it holds even if
someone skips the app and calls Supabase directly with their own login.

**What riders recognize a cab by is locked after approval.** Once approved, a driver can't change
their name, company, cab number, plate, car, seats or wheelchair access themselves. Riders use
those to find the right car on the street, so a change goes through an admin, who checks the
documents again. Phone number and payment types stay editable.

**Positions are shown to about 11 meters.** TowConnect rounded to half a mile because a tow truck
might be parked at someone's home. A cab on duty has to be findable on the right block, so this
rounds to 4 decimal places instead, and only while Available is on.

**History is kept at most once a minute.** The driver app will send a position every few seconds
while driving. Storing every one would fill the free database fast and help nobody. One a minute
is enough to look into a report ("the driver never came").

**Limits on what one request returns.** At most 25 cabs within 15 km. That's plenty for a rider,
but stops anyone from collecting every driver's phone number in one call.

**Free trials before billing exists.** Admins can run `start_free_trial(driver, days)` to let
Robert's beta drivers on without paying. When Stripe is added later, a webhook will set the same
two columns (`subscription_status`, `subscription_ends_at`) automatically.

**Cleanup runs on a schedule.** Every 5 minutes, drivers whose phone went quiet for 30 minutes are
switched off. Every night, history older than 30 days is deleted. Supabase's `pg_cron` runs both;
the migration sets that up.

## Next steps

1. Admin panel: approve drivers, start free trials, handle reports (instead of SQL).
2. Rider app: "Report a problem" (the database side is ready), real routing for arrival times.
3. A real phone build of the driver app, to test background location on an iPhone.
4. Driver billing with Stripe.

## Change log

- 2026-11-15: First version of the rider web app, on demo data.
- 2026-11-18: Driver app (`driver-app/`) with 26 tests, tested end to end in a browser against the real database rules.
- 2026-11-18: Database (`supabase/`) with 33 tests. Rider app uses it when Supabase keys are set, and keeps the moving demo cabs when they aren't.
