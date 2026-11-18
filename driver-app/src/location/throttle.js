// Decides whether a new GPS fix is worth sending. Pure functions, so tests/throttle.test.mjs runs them
// exactly as the phone does.
//
// Cabs are different from TowConnect's tow trucks: they're usually moving, riders watch them on a
// live map that refreshes every 5 seconds, and the database hides a cab whose last position is more
// than 3 minutes old. So:
//
//   1. Always send the first fix, so the cab appears right away.
//   2. Send at least every 30 seconds, even when parked at a stand, so the cab never vanishes.
//   3. While moving, send whenever the cab has gone 25 m or more, but at most every 5 seconds.
//      At city speeds that's about one update per refresh of the rider's map.
//   4. Ignore inaccurate fixes (worse than 100 m, common between tall buildings), unless nothing
//      better has arrived for a minute: a rough position beats a cab disappearing.

export const HEARTBEAT_MS = 30_000;
export const MIN_GAP_MS = 5_000;
export const MOVE_METERS = 25;
export const MAX_ACCURACY_METERS = 100;

// Distance in meters between two { latitude, longitude } points (the haversine formula).
export function distanceMeters(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// last: the last fix we SENT, or null. next: the new fix. Both look like
// { latitude, longitude, accuracy, timestamp } (timestamp in milliseconds).
export function shouldSend(last, next) {
  if (!last) return true; // rule 1
  const elapsed = next.timestamp - last.timestamp;
  if (elapsed < 0) return false; // an older fix arrived late; ignore it

  const accurate = next.accuracy == null || next.accuracy <= MAX_ACCURACY_METERS;
  if (!accurate) return elapsed >= 2 * HEARTBEAT_MS; // rule 4

  if (elapsed >= HEARTBEAT_MS) return true; // rule 2
  return elapsed >= MIN_GAP_MS && distanceMeters(last, next) >= MOVE_METERS; // rule 3
}

// The compass direction the cab is heading, 0-359, or null. The database stores it so the rider map
// can point the pin the right way later. Phones report -1 or null when they don't know.
export function cleanHeading(heading) {
  if (heading == null || !Number.isFinite(heading) || heading < 0) return null;
  return heading % 360;
}
