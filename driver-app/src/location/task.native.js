// The background location task (iPhone and Android). index.js imports this file before anything
// else, because Expo requires the task to be defined at the top level of the app.
//
// While the driver is Available, the phone calls this function with new locations even when another
// app is in front or the screen is off.
import * as TaskManager from 'expo-task-manager';
import { reportPosition } from './report';

export const LOCATION_TASK = 'flagdown-location';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return; // for example, the driver turned off location in Settings
  const locations = data?.locations ?? [];
  const newest = locations[locations.length - 1]; // the phone may deliver several at once; only the newest matters
  if (newest) await reportPosition(newest);
});
