import { createClient } from '@supabase/supabase-js'
import { byEta, cabFromRow } from './cabRow.js'
import { demoCabsAt } from './demoCabs.js'

// Every request for cab data goes through this file. Screens never fetch data themselves, so
// switching between demo cabs and the real database happens here and nowhere else.

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// No keys in .env = demo mode: eight made-up cabs that drive around the rider, computed on the phone.
// Keys present = real mode: approved, Available drivers from the database.
export const isDemo = !url || !key

// Riders never sign in, so the client doesn't need to keep or refresh a session.
const supabase = isDemo ? null : createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// How often the screen asks for fresh positions. Demo cabs cost nothing to recompute, so every
// 2 seconds. Real cabs: every 5 seconds, which matches how often the driver app sends a position
// while driving, and keeps the free database plan comfortably within its limits.
export const REFRESH_MS = isDemo ? 2000 : 5000

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Free, verified cabs near a point, closest first. */
export async function fetchNearbyCabs({ lat, lng }, { first = false } = {}) {
  if (isDemo) {
    if (first) await wait(400) // a short pause on the first load, so the loading state is visible in the demo
    return demoCabsAt({ lat, lng }, Date.now())
  }
  const { data, error } = await supabase.rpc('nearby_cabs', { p_lat: lat, p_lng: lng })
  if (error) throw new Error(error.message)
  return (data ?? []).map(cabFromRow).sort(byEta)
}
