import { demoCabsAt } from './demoCabs.js'

// Every request for cab data goes through this file. Screens never fetch data themselves, so when
// the real database is connected (next build step), this is the only file that has to change.

// For now the app always runs on demo data.
export const isDemo = true

// How often the screen should ask for fresh positions. Demo cabs are computed on the phone, so
// asking often is free. The real backend will use a slower pace to save data and battery.
export const REFRESH_MS = 2000

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Free, verified cabs near a point, closest first. */
export async function fetchNearbyCabs({ lat, lng }, { first = false } = {}) {
  if (first) await wait(400) // a short pause on the first load, so the loading state is visible in the demo
  return demoCabsAt({ lat, lng }, Date.now())
}
