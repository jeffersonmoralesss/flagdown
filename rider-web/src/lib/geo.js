// Downtown DC, used when the rider's location is unavailable.
export const DC_CENTER = { lat: 38.9007, lng: -77.0365 }

const KM_PER_MILE = 1.609344
const KM_PER_DEG_LAT = 111.32

// Straight-line distance between two points on the globe (the haversine formula).
export function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)))
}

// The point that sits `eastKm` east and `northKm` north of `origin`. Good enough at city scale.
export function offsetKm(origin, eastKm, northKm) {
  const lat = origin.lat + northKm / KM_PER_DEG_LAT
  const lng = origin.lng + eastKm / (KM_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180))
  return { lat, lng }
}

// Rough minutes for a cab to reach the rider. Streets aren't straight lines, so the distance is
// stretched by 1.3, then divided by a city driving speed of 12 mph. Never less than 1 minute.
// This is an estimate until real routing is added, and the screen says so.
export function etaMinutes(km) {
  const streetMiles = (km * 1.3) / KM_PER_MILE
  return Math.max(1, Math.round((streetMiles / 12) * 60))
}

// Ask the phone for the rider's position. Resolves to null when denied or unavailable.
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
