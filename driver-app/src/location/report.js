// The one function every location source goes through: the background task, the foreground watcher
// and the 30-second heartbeat all call reportPosition().
//
// Its memory (which driver, what was last sent) lives in localStorage, not in normal variables.
// When Android wakes the app in the background just to deliver a location, it starts a fresh copy of
// the JavaScript with empty variables; localStorage survives that.
import { sendPosition } from '../lib/api';
import { cleanHeading, shouldSend } from './throttle';

const DRIVER_KEY = 'flagdown.sharing.driverId';
const LAST_SENT_KEY = 'flagdown.sharing.lastSent';
const LAST_ERROR_KEY = 'flagdown.sharing.lastError';

export function rememberDriver(driverId) {
  localStorage.setItem(DRIVER_KEY, driverId);
  localStorage.removeItem(LAST_SENT_KEY); // so the next fix is sent straight away
  localStorage.removeItem(LAST_ERROR_KEY);
}

export function forgetDriver() {
  localStorage.removeItem(DRIVER_KEY);
}

// For the home screen: when did we last send, and did the last attempt fail?
export function sharingStatus() {
  const raw = localStorage.getItem(LAST_SENT_KEY);
  return { lastSentAt: raw ? JSON.parse(raw).timestamp : null, lastError: localStorage.getItem(LAST_ERROR_KEY) };
}

// `location` is what expo-location gives: { coords: { latitude, longitude, accuracy, heading }, timestamp }.
// Returns true if it was sent.
export async function reportPosition(location, { force = false } = {}) {
  const driverId = localStorage.getItem(DRIVER_KEY);
  if (!driverId || !location?.coords) return false; // sharing was switched off

  const next = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    heading: cleanHeading(location.coords.heading),
    timestamp: location.timestamp ?? Date.now(),
  };
  const raw = localStorage.getItem(LAST_SENT_KEY);
  const last = raw ? JSON.parse(raw) : null;
  if (!force && !shouldSend(last, next)) return false;

  try {
    await sendPosition(driverId, next);
    localStorage.setItem(LAST_SENT_KEY, JSON.stringify(next));
    localStorage.removeItem(LAST_ERROR_KEY);
    return true;
  } catch (e) {
    // No signal in a tunnel, for example. Not fatal: LAST_SENT_KEY wasn't updated, so the next fix retries.
    localStorage.setItem(LAST_ERROR_KEY, e.message);
    return false;
  }
}
