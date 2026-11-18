# Flagdown (working name)

See licensed DC cabs that are free near you, moving live on a map, and call the driver directly.
Riders pay nothing and need no account. Drivers pay a flat monthly subscription and keep the whole fare.

"Flagdown" is a placeholder. To rename the app, change `rider-web/src/lib/brand.js`, the `<title>` in
`rider-web/index.html`, and the two names in `rider-web/public/manifest.webmanifest`.

## What's in here

| Folder | What it is | Status |
| --- | --- | --- |
| `rider-web/` | Rider web app: welcome, live map, cab list, filters, cab details, call, share | Done (demo or real data) |
| `driver-app/` | Driver app (Expo, iPhone + Android): sign-up, documents, Available switch, background location | Next |
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

1. Driver app: adapt TowConnect's Expo operator app for cab drivers (sign-up, documents, the
   Available switch, background location every few seconds).
2. Rider app: "Report a problem" (the database side is ready), real routing for arrival times.
3. Admin panel: approve drivers, start free trials, handle reports.
4. Driver billing with Stripe.

## Change log

- 2026-11-15: First version of the rider web app, on demo data.
- 2026-11-18: Database (`supabase/`) with 33 tests. Rider app uses it when Supabase keys are set, and keeps the moving demo cabs when they aren't.
