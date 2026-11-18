// When a GPS fix gets sent to the database. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanHeading, distanceMeters, HEARTBEAT_MS, MAX_ACCURACY_METERS, MIN_GAP_MS, MOVE_METERS, shouldSend } from '../src/location/throttle.js';

// A point at Union Station, and helpers to make fixes relative to it.
const base = { latitude: 38.8977, longitude: -77.0063, accuracy: 10, timestamp: 1_000_000 };
const later = (ms, extra = {}) => ({ ...base, timestamp: base.timestamp + ms, ...extra });
const north = (meters) => base.latitude + meters / 111_320;

test('distance: 0.001 degrees of latitude is about 111 m', () => {
  const d = distanceMeters(base, { ...base, latitude: base.latitude + 0.001 });
  assert.ok(Math.abs(d - 111) < 1, `got ${d}`);
});

test('the first fix is always sent', () => {
  assert.equal(shouldSend(null, base), true);
});

test('a cab parked at a stand still checks in every 30 seconds', () => {
  assert.equal(shouldSend(base, later(HEARTBEAT_MS - 1)), false);
  assert.equal(shouldSend(base, later(HEARTBEAT_MS)), true);
});

test('a moving cab sends every 25 m, but not more often than every 5 seconds', () => {
  const moved = (ms, meters) => later(ms, { latitude: north(meters) });
  assert.equal(shouldSend(base, moved(MIN_GAP_MS - 1, 100)), false, 'too soon');
  assert.equal(shouldSend(base, moved(MIN_GAP_MS, MOVE_METERS + 1)), true, 'far enough, late enough');
  assert.equal(shouldSend(base, moved(MIN_GAP_MS, MOVE_METERS - 5)), false, 'barely moved');
});

test('an inaccurate fix waits a minute; a rough position beats disappearing', () => {
  const rough = (ms) => later(ms, { accuracy: MAX_ACCURACY_METERS + 50, latitude: north(500) });
  assert.equal(shouldSend(base, rough(HEARTBEAT_MS)), false);
  assert.equal(shouldSend(base, rough(2 * HEARTBEAT_MS)), true);
});

test('a fix that arrives out of order is ignored', () => {
  assert.equal(shouldSend(base, later(-1000)), false);
});

test('every send rule keeps a cab visible: the database hides positions older than 3 minutes', () => {
  assert.ok(2 * HEARTBEAT_MS < 3 * 60_000);
});

test('heading: unknown values become null, and 360 wraps to 0', () => {
  assert.equal(cleanHeading(-1), null);
  assert.equal(cleanHeading(null), null);
  assert.equal(cleanHeading(NaN), null);
  assert.equal(cleanHeading(360), 0);
  assert.equal(cleanHeading(90.5), 90.5);
});
