import { etaMinutes } from './geo.js'

// The database speaks in snake_case column names (display_name, vehicle_color...); the screens use
// the same shape as the demo cabs (driver, color...). This turns one database row into that shape,
// so no screen needs to know which one it's looking at.
export function cabFromRow(row) {
  return {
    id: row.id,
    driver: row.display_name,
    company: row.company_name,
    cabNumber: row.cab_number,
    plate: row.plate,
    color: row.vehicle_color,
    make: row.vehicle_make,
    model: row.vehicle_model,
    seats: row.seats,
    wheelchair: row.wheelchair_accessible,
    payments: row.payments ?? [],
    phone: row.phone,
    // '2026-10-06' -> '2026-10'. Null if the license date is missing; the details screen then hides that line.
    licenseCheckedOn: row.license_checked_on ? String(row.license_checked_on).slice(0, 7) : null,
    lat: row.lat,
    lng: row.lng,
    distance_km: row.distance_km,
    eta_min: etaMinutes(row.distance_km),
    is_demo: row.is_demo,
  }
}

// Closest first by whole minutes, then by exact distance. Same idea as the demo: the list
// doesn't reshuffle when two cabs are a few meters apart.
export function byEta(a, b) {
  return a.eta_min - b.eta_min || a.distance_km - b.distance_km
}
