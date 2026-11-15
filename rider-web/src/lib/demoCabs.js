import { distanceKm, etaMinutes, offsetKm } from './geo.js'

// Eight made-up cabs for the demo. Names, companies, plates and phone numbers are invented
// (the phone numbers use the 555-01xx range that is reserved for fiction).
//
// Each cab drives around its own rectangle of "city blocks" so the map shows movement.
// `loop` describes that rectangle relative to the rider, in kilometers:
//   east/north = where the rectangle's corner sits, w/h = its size,
//   speedKmh   = how fast the cab drives (0 = parked at a stand),
//   phase      = where on the rectangle it starts (0 to 1), so cabs don't move in sync.
export const DEMO_CABS = [
  { id: 'cab-1', driver: 'Samuel', company: 'Red Line Cab', cabNumber: '142', plate: 'H 00142', color: 'gray', make: 'Toyota', model: 'Camry', seats: 4, wheelchair: false, payments: ['cash', 'card'], phone: '(202) 555-0142', licenseCheckedOn: '2026-10', loop: { east: -0.5, north: 0.2, w: 0.9, h: 0.5, speedKmh: 16, phase: 0.1 } },
  { id: 'cab-2', driver: 'Marisol', company: 'Shaw Street Cab', cabNumber: '27', plate: 'H 00027', color: 'red', make: 'Toyota', model: 'Sienna', seats: 6, wheelchair: true, payments: ['cash', 'card'], phone: '(202) 555-0127', licenseCheckedOn: '2026-11', loop: { east: 0.3, north: -0.9, w: 0.7, h: 0.8, speedKmh: 14, phase: 0.55 } },
  { id: 'cab-3', driver: 'Tesfaye', company: 'Red Line Cab', cabNumber: '88', plate: 'H 00088', color: 'gray', make: 'Ford', model: 'Fusion', seats: 4, wheelchair: false, payments: ['cash', 'card'], phone: '(202) 555-0188', licenseCheckedOn: '2026-09', loop: { east: -1.6, north: -0.4, w: 1.1, h: 0.6, speedKmh: 18, phase: 0.3 } },
  { id: 'cab-4', driver: 'Denise', company: 'Anacostia Taxi Co.', cabNumber: '305', plate: 'H 00305', color: 'white', make: 'Chevrolet', model: 'Malibu', seats: 4, wheelchair: false, payments: ['cash'], phone: '(202) 555-0105', licenseCheckedOn: '2026-10', loop: { east: 1.1, north: 0.6, w: 0, h: 0, speedKmh: 0, phase: 0 } },
  { id: 'cab-5', driver: 'Ahmed', company: 'Shaw Street Cab', cabNumber: '61', plate: 'H 00061', color: 'red', make: 'Dodge', model: 'Grand Caravan', seats: 6, wheelchair: true, payments: ['cash', 'card'], phone: '(202) 555-0161', licenseCheckedOn: '2026-08', loop: { east: -0.9, north: 1.3, w: 1.2, h: 0.7, speedKmh: 15, phase: 0.8 } },
  { id: 'cab-6', driver: 'Lucía', company: 'Anacostia Taxi Co.', cabNumber: '212', plate: 'H 00212', color: 'silver', make: 'Toyota', model: 'Prius', seats: 4, wheelchair: false, payments: ['cash', 'card'], phone: '(202) 555-0112', licenseCheckedOn: '2026-11', loop: { east: 1.4, north: -1.8, w: 0.8, h: 1.0, speedKmh: 17, phase: 0.45 } },
  { id: 'cab-7', driver: 'James', company: 'Red Line Cab', cabNumber: '9', plate: 'H 00009', color: 'gray', make: 'Honda', model: 'Accord', seats: 4, wheelchair: false, payments: ['cash', 'card'], phone: '(202) 555-0109', licenseCheckedOn: '2026-10', loop: { east: -2.4, north: 1.6, w: 0.9, h: 0.9, speedKmh: 16, phase: 0.65 } },
  { id: 'cab-8', driver: 'Nia', company: 'Shaw Street Cab', cabNumber: '174', plate: 'H 00174', color: 'black', make: 'Toyota', model: 'Highlander', seats: 6, wheelchair: false, payments: ['card'], phone: '(202) 555-0174', licenseCheckedOn: '2026-09', loop: { east: 2.2, north: 1.9, w: 0, h: 0, speedKmh: 0, phase: 0 } },
]

// Where a cab is on its rectangle at a given time, as km east/north of the rider.
// The cab drives the four sides in order: east, north, west, south, then starts again.
export function positionOnLoop(loop, timeMs) {
  const { east, north, w, h, speedKmh, phase } = loop
  const perimeter = 2 * (w + h)
  if (perimeter === 0 || speedKmh === 0) return { east, north }
  const driven = (timeMs / 3_600_000) * speedKmh + phase * perimeter
  const d = driven % perimeter
  if (d < w) return { east: east + d, north }
  if (d < w + h) return { east: east + w, north: north + (d - w) }
  if (d < 2 * w + h) return { east: east + w - (d - w - h), north: north + h }
  return { east, north: north + h - (d - 2 * w - h) }
}

// The demo cabs as the app sees them at one moment: each with a position, a distance and an ETA,
// closest first. Sorting uses whole minutes (then the fixed order above), so the list doesn't
// reshuffle every time a cab moves a few meters.
export function demoCabsAt(center, timeMs) {
  return DEMO_CABS.map(({ loop, ...cab }, index) => {
    const spot = positionOnLoop(loop, timeMs)
    const { lat, lng } = offsetKm(center, spot.east, spot.north)
    const distance_km = distanceKm(center.lat, center.lng, lat, lng)
    return { ...cab, lat, lng, distance_km, eta_min: etaMinutes(distance_km), is_demo: true, order: index }
  }).sort((a, b) => a.eta_min - b.eta_min || a.order - b.order)
}
