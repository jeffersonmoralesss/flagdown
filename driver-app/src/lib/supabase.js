import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// There is no demo mode in the driver app: its whole job is writing to the real database (sign-up,
// documents, positions), so pretending would test nothing. App.js shows setup steps when keys are missing.
export const isConfigured = Boolean(url && key);

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: {
        storage: localStorage, // the phone's saved storage (see storage.native.js) or the browser's
        autoRefreshToken: true,
        persistSession: true, // stay signed in after closing the app
        detectSessionInUrl: false,
      },
    })
  : null;

// Sign-in tokens expire after an hour and are renewed on a timer. Phones pause timers in the
// background, so the timer only runs while the app is on screen. Background requests still work:
// supabase-js renews an expired token right before sending. (Browsers handle this on their own.)
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
