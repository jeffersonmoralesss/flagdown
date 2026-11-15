# Flagdown (working name)

See licensed DC cabs that are free near you, moving live on a map, and call the driver directly.
Riders pay nothing and need no account. Drivers pay a flat monthly subscription and keep the whole fare.

"Flagdown" is a placeholder. To rename the app, change `rider-web/src/lib/brand.js`, the `<title>` in
`rider-web/index.html`, and the two names in `rider-web/public/manifest.webmanifest`.

## What's in here

| Folder | What it is | Status |
| --- | --- | --- |
| `rider-web/` | Rider web app: welcome, live map, cab list, filters, cab details, call, share | Demo ready (sample cabs) |
| `driver-app/` | Driver app (Expo, iPhone + Android): sign-up, documents, Available switch, background location | Next |
| `supabase/` | Database, security rules, tests | Next |
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
npm test        # expect: pass 11, fail 0
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
| `src/lib/api.js` | The only place cab data comes from. Today: demo data. Later: the database |
| `src/lib/demoCabs.js` | The sample cabs and the math that moves them |
| `src/lib/geo.js` | Distance, ETA and "where am I" |
| `src/lib/format.js` | Phone links, dates, car descriptions, filter matching |
| `src/lib/strings.js` | Every sentence on screen, in English and Spanish |
| `src/lib/i18n.jsx` | Remembers the chosen language and gives screens the `t()` function |
| `src/styles.css` | All styling |
| `tests/logic.test.mjs` | Tests for the math, the filters and the translations |

### Why it's built this way

**One door for data (`api.js`).** Screens call `fetchNearbyCabs()` and never know where the answer
comes from. When the database is ready, only `api.js` changes. TowConnect used the same idea.

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

## Next steps

1. Database: adapt TowConnect's Supabase schema for cab drivers, then switch `api.js` to it.
2. Driver app: adapt TowConnect's Expo operator app (Available switch, background location).
3. Rider app: "Report a problem", a service worker for weak signal, real routing for ETAs.
4. Admin panel and driver billing.

## Change log

- 2026-11-15: First version of the rider web app, on demo data.
