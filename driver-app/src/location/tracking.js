// Starting and stopping location sharing. Three modes:
//
//   'background' (phone app): keeps sending while other apps are open or the screen is off. Needs a
//                development or store build, and location permission "Always". Android shows a
//                notification the whole time, as it requires.
//   'foreground' (phone app): only while Flagdown is on screen. Used in Expo Go, which can't run
//                background tasks, or when the driver only allows location "While using the app".
//   'web'        (browser): only while the page is open. We also ask the browser to keep the screen on.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { forgetDriver, rememberDriver, reportPosition } from './report';
import { LOCATION_TASK } from './task';
import { HEARTBEAT_MS, MIN_GAP_MS } from './throttle';

export const isWeb = Platform.OS === 'web';
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const canRunInBackground = !isWeb && !isExpoGo;

// High accuracy: riders see the cab to about 11 meters, so the phone's GPS is worth using.
// Fixes every 5 seconds or 10 meters; throttle.js then decides which ones are worth sending.
const WATCH_OPTIONS = {
  accuracy: Location.Accuracy.High,
  timeInterval: MIN_GAP_MS,
  distanceInterval: 10,
};

let watcher = null; // the foreground or web watcher, when running
let heartbeat = null; // resends the last fix every 30 s, for phones that go quiet while parked
let lastFix = null;
let wakeLock = null;

export class SharingError extends Error {
  constructor(key) {
    super(key);
    this.key = key; // a key in src/i18n/strings.js, so the screen can show it in either language
  }
}

// Asks for permission, sends a first position, and starts sharing. Returns the mode that started.
export async function startSharing(driverId) {
  if (!isWeb && !(await Location.hasServicesEnabledAsync())) throw new SharingError('loc.off');

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new SharingError('loc.denied');

  rememberDriver(driverId);

  // One position right away, so the cab appears without waiting.
  const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  lastFix = first;
  await reportPosition(first, { force: true });

  if (canRunInBackground) {
    // On Android 11+ this opens Settings, where the driver has to pick "Allow all the time".
    // If they don't, sharing falls back to foreground mode below.
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        ...WATCH_OPTIONS,
        activityType: Location.ActivityType.AutomotiveNavigation, // iPhone: tuned for driving
        pausesUpdatesAutomatically: false, // iPhone: keep going while parked at a stand
        showsBackgroundLocationIndicator: true, // iPhone: be open that location is in use
        foregroundService: {
          notificationTitle: 'You are Available on Flagdown',
          notificationBody: 'Riders near you can see your cab. Open Flagdown to go offline.',
          notificationColor: '#C8102E',
          killServiceOnDestroy: false, // keep sharing if the app is swiped away; the notification stays as a reminder
        },
      });
      return 'background';
    }
  }

  await startWatching();
  if (isWeb) await keepScreenOn();
  return isWeb ? 'web' : 'foreground';
}

async function startWatching() {
  stopWatching();
  watcher = await Location.watchPositionAsync(WATCH_OPTIONS, (loc) => {
    lastFix = loc;
    reportPosition(loc);
  });
  // A parked phone can stop reporting fixes. Every 30 seconds, resend the last known position with
  // the current time so the cab doesn't vanish from riders' maps. Timers only run while the app or
  // page is open, which is exactly when this mode works anyway.
  heartbeat = setInterval(() => {
    if (lastFix) reportPosition({ ...lastFix, timestamp: Date.now() });
  }, HEARTBEAT_MS);
}

function stopWatching() {
  watcher?.remove();
  watcher = null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

// Web only: ask the browser not to dim and lock the screen while Available, because a locked phone
// stops the page and the cab would disappear. Not every browser supports this; it's a best effort.
async function keepScreenOn() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    // refused (battery saver, for example); the note on screen still tells the driver
  }
}

// Browsers release the wake lock whenever the tab is hidden, so ask again when it comes back.
if (isWeb && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && watcher) keepScreenOn();
  });
}

export async function stopSharing() {
  forgetDriver(); // any location still on its way is now ignored by reportPosition
  stopWatching();
  lastFix = null;
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  if (canRunInBackground && (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false))) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

// Which mode is running now, or null. Used when the app reopens, to find out whether sharing survived
// (after the phone restarts, or the web page reloads, it won't have).
export async function currentMode() {
  if (canRunInBackground && (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false))) {
    return 'background';
  }
  if (!watcher) return null;
  return isWeb ? 'web' : 'foreground';
}
